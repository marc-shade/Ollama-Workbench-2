import { writable, derived } from 'svelte/store';

export type SourceType = 'arxiv' | 'web' | 'local' | 'semantic_scholar' | 'wikipedia';

export interface Citation {
	id: string;
	title: string;
	authors: string[];
	year: number;
	source: SourceType;
	url?: string;
	doi?: string;
	arxivId?: string;
	abstract?: string;
	snippet?: string;
	relevanceScore: number;
	addedAt: string;
}

export interface ResearchSource {
	id: string;
	type: SourceType;
	query: string;
	results: Citation[];
	status: 'idle' | 'searching' | 'completed' | 'error';
	error?: string;
	searchedAt?: string;
}

export interface SynthesisSection {
	id: string;
	title: string;
	content: string;
	citations: string[]; // Citation IDs
	order: number;
}

export interface ResearchSession {
	id: string;
	title: string;
	description: string;
	query: string;
	sources: ResearchSource[];
	citations: Citation[];
	synthesis: {
		summary: string;
		sections: SynthesisSection[];
		generatedAt?: string;
		model?: string;
	};
	notes: string;
	status: 'active' | 'completed' | 'archived';
	createdAt: string;
	updatedAt: string;
}

export interface ResearchConfig {
	defaultSources: SourceType[];
	maxResultsPerSource: number;
	autoSynthesize: boolean;
	synthesisModel: string;
	citationStyle: 'apa' | 'mla' | 'chicago' | 'ieee' | 'bibtex';
}

export interface ResearchState {
	sessions: ResearchSession[];
	activeSessionId: string | null;
	config: ResearchConfig;
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-research';

function getDefaultConfig(): ResearchConfig {
	return {
		defaultSources: ['arxiv', 'web', 'semantic_scholar'],
		maxResultsPerSource: 10,
		autoSynthesize: false,
		synthesisModel: 'llama3.2',
		citationStyle: 'apa'
	};
}

function loadFromStorage(): { sessions: ResearchSession[]; config: ResearchConfig } {
	if (typeof window === 'undefined') return { sessions: [], config: getDefaultConfig() };
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const data = JSON.parse(stored);
			return {
				sessions: data.sessions || [],
				config: { ...getDefaultConfig(), ...data.config }
			};
		}
		return { sessions: [], config: getDefaultConfig() };
	} catch {
		return { sessions: [], config: getDefaultConfig() };
	}
}

function saveToStorage(data: { sessions: ResearchSession[]; config: ResearchConfig }) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createResearchStore() {
	const { subscribe, set, update } = writable<ResearchState>({
		sessions: [],
		activeSessionId: null,
		config: getDefaultConfig(),
		loading: true,
		error: null
	});

	// Initialize
	if (typeof window !== 'undefined') {
		const data = loadFromStorage();
		set({
			sessions: data.sessions,
			activeSessionId: null,
			config: data.config,
			loading: false,
			error: null
		});
	}

	return {
		subscribe,

		loadSessions: () => {
			const data = loadFromStorage();
			set({
				sessions: data.sessions,
				activeSessionId: null,
				config: data.config,
				loading: false,
				error: null
			});
		},

		createSession: (title: string, description: string, query: string): string => {
			const id = `research-${Date.now()}`;
			update((state) => {
				const newSession: ResearchSession = {
					id,
					title,
					description,
					query,
					sources: [],
					citations: [],
					synthesis: {
						summary: '',
						sections: []
					},
					notes: '',
					status: 'active',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newSessions = [newSession, ...state.sessions];
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions, activeSessionId: id };
			});
			return id;
		},

		updateSession: (id: string, updates: Partial<ResearchSession>) => {
			update((state) => {
				const newSessions = state.sessions.map((s) =>
					s.id === id
						? { ...s, ...updates, updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		deleteSession: (id: string) => {
			update((state) => {
				const newSessions = state.sessions.filter((s) => s.id !== id);
				saveToStorage({ sessions: newSessions, config: state.config });
				return {
					...state,
					sessions: newSessions,
					activeSessionId: state.activeSessionId === id ? null : state.activeSessionId
				};
			});
		},

		setActiveSession: (id: string | null) => {
			update((state) => ({ ...state, activeSessionId: id }));
		},

		addSource: (sessionId: string, type: SourceType, query: string) => {
			update((state) => {
				const newSessions = state.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					const newSource: ResearchSource = {
						id: `source-${Date.now()}`,
						type,
						query,
						results: [],
						status: 'idle'
					};
					return {
						...s,
						sources: [...s.sources, newSource],
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		updateSource: (sessionId: string, sourceId: string, updates: Partial<ResearchSource>) => {
			update((state) => {
				const newSessions = state.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					return {
						...s,
						sources: s.sources.map((src) =>
							src.id === sourceId ? { ...src, ...updates } : src
						),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		removeSource: (sessionId: string, sourceId: string) => {
			update((state) => {
				const newSessions = state.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					return {
						...s,
						sources: s.sources.filter((src) => src.id !== sourceId),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		addCitation: (sessionId: string, citation: Omit<Citation, 'id' | 'addedAt'>) => {
			update((state) => {
				const newSessions = state.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					const newCitation: Citation = {
						...citation,
						id: `citation-${Date.now()}`,
						addedAt: new Date().toISOString()
					};
					return {
						...s,
						citations: [...s.citations, newCitation],
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		removeCitation: (sessionId: string, citationId: string) => {
			update((state) => {
				const newSessions = state.sessions.map((s) => {
					if (s.id !== sessionId) return s;
					return {
						...s,
						citations: s.citations.filter((c) => c.id !== citationId),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		updateSynthesis: (sessionId: string, synthesis: ResearchSession['synthesis']) => {
			update((state) => {
				const newSessions = state.sessions.map((s) =>
					s.id === sessionId
						? { ...s, synthesis, updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		updateConfig: (updates: Partial<ResearchConfig>) => {
			update((state) => {
				const newConfig = { ...state.config, ...updates };
				saveToStorage({ sessions: state.sessions, config: newConfig });
				return { ...state, config: newConfig };
			});
		},

		duplicateSession: (id: string) => {
			update((state) => {
				const original = state.sessions.find((s) => s.id === id);
				if (!original) return state;

				const duplicate: ResearchSession = {
					...original,
					id: `research-${Date.now()}`,
					title: `${original.title} (copy)`,
					status: 'active',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newSessions = [duplicate, ...state.sessions];
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		},

		archiveSession: (id: string) => {
			update((state) => {
				const newSessions = state.sessions.map((s) =>
					s.id === id
						? { ...s, status: 'archived' as const, updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ sessions: newSessions, config: state.config });
				return { ...state, sessions: newSessions };
			});
		}
	};
}

export const researchStore = createResearchStore();

// Derived stores
export const activeSession = derived(
	researchStore,
	($store) => $store.sessions.find((s) => s.id === $store.activeSessionId) || null
);

export const activeSessions = derived(
	researchStore,
	($store) => $store.sessions.filter((s) => s.status === 'active')
);

export const archivedSessions = derived(
	researchStore,
	($store) => $store.sessions.filter((s) => s.status === 'archived')
);

// Citation formatting helpers
export function formatCitation(citation: Citation, style: ResearchConfig['citationStyle']): string {
	const authors = citation.authors.length > 3
		? `${citation.authors[0]} et al.`
		: citation.authors.join(', ');

	switch (style) {
		case 'apa':
			return `${authors} (${citation.year}). ${citation.title}. ${citation.source === 'arxiv' ? 'arXiv preprint' : ''}${citation.arxivId ? ` arXiv:${citation.arxivId}` : ''}`;
		case 'mla':
			return `${authors}. "${citation.title}." ${citation.year}.`;
		case 'chicago':
			return `${authors}. "${citation.title}." ${citation.year}.`;
		case 'ieee':
			return `${authors}, "${citation.title}," ${citation.year}.`;
		case 'bibtex':
			const key = citation.authors[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
			return `@article{${key}${citation.year},
  title={${citation.title}},
  author={${citation.authors.join(' and ')}},
  year={${citation.year}}${citation.arxivId ? `,\n  eprint={${citation.arxivId}}` : ''}
}`;
		default:
			return `${authors} (${citation.year}). ${citation.title}.`;
	}
}

export function getSourceIcon(type: SourceType): string {
	switch (type) {
		case 'arxiv': return 'FileText';
		case 'web': return 'Globe';
		case 'local': return 'FolderOpen';
		case 'semantic_scholar': return 'GraduationCap';
		case 'wikipedia': return 'BookOpen';
		default: return 'Search';
	}
}

export function getSourceLabel(type: SourceType): string {
	switch (type) {
		case 'arxiv': return 'arXiv';
		case 'web': return 'Web Search';
		case 'local': return 'Local Documents';
		case 'semantic_scholar': return 'Semantic Scholar';
		case 'wikipedia': return 'Wikipedia';
		default: return type;
	}
}
