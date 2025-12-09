import { writable, derived } from 'svelte/store';

export interface DocumentChunk {
	id: string;
	documentId: string;
	content: string;
	embedding?: number[];
	metadata: {
		startIndex: number;
		endIndex: number;
		pageNumber?: number;
	};
	createdAt: string;
}

export interface KnowledgeDocument {
	id: string;
	name: string;
	type: 'text' | 'pdf' | 'markdown' | 'html' | 'json' | 'code';
	mimeType: string;
	size: number;
	content?: string;
	chunks: DocumentChunk[];
	chunkingConfig: {
		strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic';
		chunkSize: number;
		chunkOverlap: number;
	};
	embeddingModel: string;
	embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
	embeddingProgress: number;
	collectionId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface KnowledgeCollection {
	id: string;
	name: string;
	description: string;
	documentIds: string[];
	vectorStoreConfig: {
		provider: 'qdrant' | 'memory' | 'pinecone' | 'chroma';
		collectionName: string;
		dimension: number;
		distance: 'cosine' | 'euclidean' | 'dot';
	};
	createdAt: string;
	updatedAt: string;
}

export interface SearchResult {
	id: string;
	documentId: string;
	documentName: string;
	content: string;
	score: number;
	metadata: Record<string, unknown>;
}

export interface RAGConfig {
	id: string;
	name: string;
	collectionId: string;
	embeddingModel: string;
	retrievalConfig: {
		topK: number;
		scoreThreshold: number;
		maxTokens: number;
		rerank: boolean;
		rerankModel?: string;
	};
	generationConfig: {
		model: string;
		systemPrompt: string;
		temperature: number;
		maxTokens: number;
	};
	createdAt: string;
	updatedAt: string;
}

export interface KnowledgeState {
	documents: KnowledgeDocument[];
	collections: KnowledgeCollection[];
	ragConfigs: RAGConfig[];
	searchResults: SearchResult[];
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-knowledge';

function loadFromStorage(): {
	documents: KnowledgeDocument[];
	collections: KnowledgeCollection[];
	ragConfigs: RAGConfig[];
} {
	if (typeof window === 'undefined') return { documents: [], collections: [], ragConfigs: [] };
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
		return { documents: [], collections: getDefaultCollections(), ragConfigs: getDefaultRAGConfigs() };
	} catch {
		return { documents: [], collections: getDefaultCollections(), ragConfigs: getDefaultRAGConfigs() };
	}
}

function saveToStorage(data: {
	documents: KnowledgeDocument[];
	collections: KnowledgeCollection[];
	ragConfigs: RAGConfig[];
}) {
	if (typeof window === 'undefined') return;
	// Don't store embeddings to avoid localStorage size limits
	const sanitized = {
		...data,
		documents: data.documents.map((doc) => ({
			...doc,
			chunks: doc.chunks.map((chunk) => ({
				...chunk,
				embedding: undefined
			}))
		}))
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

function getDefaultCollections(): KnowledgeCollection[] {
	return [
		{
			id: 'default-collection',
			name: 'Default',
			description: 'Default knowledge collection',
			documentIds: [],
			vectorStoreConfig: {
				provider: 'qdrant',
				collectionName: 'ollama_workbench_default',
				dimension: 1024,
				distance: 'cosine'
			},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];
}

function getDefaultRAGConfigs(): RAGConfig[] {
	return [
		{
			id: 'default-rag',
			name: 'Default RAG Pipeline',
			collectionId: 'default-collection',
			embeddingModel: 'bge-m3',
			retrievalConfig: {
				topK: 5,
				scoreThreshold: 0.7,
				maxTokens: 2000,
				rerank: false
			},
			generationConfig: {
				model: 'llama3.2',
				systemPrompt:
					'You are a helpful assistant. Answer questions based on the provided context. If the context does not contain relevant information, say so.',
				temperature: 0.7,
				maxTokens: 1000
			},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];
}

function createKnowledgeStore() {
	const { subscribe, set, update } = writable<KnowledgeState>({
		documents: [],
		collections: [],
		ragConfigs: [],
		searchResults: [],
		loading: true,
		error: null
	});

	// Initialize
	if (typeof window !== 'undefined') {
		const data = loadFromStorage();
		set({
			documents: data.documents,
			collections: data.collections,
			ragConfigs: data.ragConfigs,
			searchResults: [],
			loading: false,
			error: null
		});
	}

	return {
		subscribe,

		loadKnowledge: () => {
			const data = loadFromStorage();
			set({
				documents: data.documents,
				collections: data.collections,
				ragConfigs: data.ragConfigs,
				searchResults: [],
				loading: false,
				error: null
			});
		},

		// Document Management
		addDocument: (
			doc: Omit<
				KnowledgeDocument,
				'id' | 'createdAt' | 'updatedAt' | 'chunks' | 'embeddingStatus' | 'embeddingProgress'
			>
		) => {
			update((state) => {
				const newDoc: KnowledgeDocument = {
					...doc,
					id: `doc-${Date.now()}`,
					chunks: [],
					embeddingStatus: 'pending',
					embeddingProgress: 0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newDocs = [...state.documents, newDoc];
				saveToStorage({
					documents: newDocs,
					collections: state.collections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs };
			});
		},

		updateDocument: (id: string, updates: Partial<KnowledgeDocument>) => {
			update((state) => {
				const newDocs = state.documents.map((d) =>
					d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
				);
				saveToStorage({
					documents: newDocs,
					collections: state.collections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs };
			});
		},

		deleteDocument: (id: string) => {
			update((state) => {
				const newDocs = state.documents.filter((d) => d.id !== id);
				// Remove from collections
				const newCollections = state.collections.map((c) => ({
					...c,
					documentIds: c.documentIds.filter((docId) => docId !== id)
				}));
				saveToStorage({
					documents: newDocs,
					collections: newCollections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs, collections: newCollections };
			});
		},

		// Chunking
		setDocumentChunks: (documentId: string, chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[]) => {
			update((state) => {
				const newDocs = state.documents.map((d) =>
					d.id === documentId
						? {
								...d,
								chunks: chunks.map((chunk, i) => ({
									...chunk,
									id: `chunk-${documentId}-${i}`,
									createdAt: new Date().toISOString()
								})),
								updatedAt: new Date().toISOString()
							}
						: d
				);
				saveToStorage({
					documents: newDocs,
					collections: state.collections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs };
			});
		},

		updateEmbeddingStatus: (
			documentId: string,
			status: KnowledgeDocument['embeddingStatus'],
			progress: number
		) => {
			update((state) => {
				const newDocs = state.documents.map((d) =>
					d.id === documentId
						? { ...d, embeddingStatus: status, embeddingProgress: progress }
						: d
				);
				saveToStorage({
					documents: newDocs,
					collections: state.collections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs };
			});
		},

		// Collection Management
		addCollection: (collection: Omit<KnowledgeCollection, 'id' | 'createdAt' | 'updatedAt'>) => {
			update((state) => {
				const newCollection: KnowledgeCollection = {
					...collection,
					id: `collection-${Date.now()}`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newCollections = [...state.collections, newCollection];
				saveToStorage({
					documents: state.documents,
					collections: newCollections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, collections: newCollections };
			});
		},

		updateCollection: (id: string, updates: Partial<KnowledgeCollection>) => {
			update((state) => {
				const newCollections = state.collections.map((c) =>
					c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
				);
				saveToStorage({
					documents: state.documents,
					collections: newCollections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, collections: newCollections };
			});
		},

		deleteCollection: (id: string) => {
			update((state) => {
				const newCollections = state.collections.filter((c) => c.id !== id);
				saveToStorage({
					documents: state.documents,
					collections: newCollections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, collections: newCollections };
			});
		},

		addDocumentToCollection: (collectionId: string, documentId: string) => {
			update((state) => {
				const newCollections = state.collections.map((c) =>
					c.id === collectionId && !c.documentIds.includes(documentId)
						? {
								...c,
								documentIds: [...c.documentIds, documentId],
								updatedAt: new Date().toISOString()
							}
						: c
				);
				const newDocs = state.documents.map((d) =>
					d.id === documentId ? { ...d, collectionId } : d
				);
				saveToStorage({
					documents: newDocs,
					collections: newCollections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs, collections: newCollections };
			});
		},

		removeDocumentFromCollection: (collectionId: string, documentId: string) => {
			update((state) => {
				const newCollections = state.collections.map((c) =>
					c.id === collectionId
						? {
								...c,
								documentIds: c.documentIds.filter((id) => id !== documentId),
								updatedAt: new Date().toISOString()
							}
						: c
				);
				const newDocs = state.documents.map((d) =>
					d.id === documentId ? { ...d, collectionId: undefined } : d
				);
				saveToStorage({
					documents: newDocs,
					collections: newCollections,
					ragConfigs: state.ragConfigs
				});
				return { ...state, documents: newDocs, collections: newCollections };
			});
		},

		// RAG Config Management
		addRAGConfig: (config: Omit<RAGConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
			update((state) => {
				const newConfig: RAGConfig = {
					...config,
					id: `rag-${Date.now()}`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newConfigs = [...state.ragConfigs, newConfig];
				saveToStorage({
					documents: state.documents,
					collections: state.collections,
					ragConfigs: newConfigs
				});
				return { ...state, ragConfigs: newConfigs };
			});
		},

		updateRAGConfig: (id: string, updates: Partial<RAGConfig>) => {
			update((state) => {
				const newConfigs = state.ragConfigs.map((c) =>
					c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
				);
				saveToStorage({
					documents: state.documents,
					collections: state.collections,
					ragConfigs: newConfigs
				});
				return { ...state, ragConfigs: newConfigs };
			});
		},

		deleteRAGConfig: (id: string) => {
			update((state) => {
				const newConfigs = state.ragConfigs.filter((c) => c.id !== id);
				saveToStorage({
					documents: state.documents,
					collections: state.collections,
					ragConfigs: newConfigs
				});
				return { ...state, ragConfigs: newConfigs };
			});
		},

		// Search Results
		setSearchResults: (results: SearchResult[]) => {
			update((state) => ({ ...state, searchResults: results }));
		},

		clearSearchResults: () => {
			update((state) => ({ ...state, searchResults: [] }));
		},

		// Error handling
		setError: (error: string | null) => {
			update((state) => ({ ...state, error }));
		}
	};
}

export const knowledgeStore = createKnowledgeStore();

// Derived stores
export const documentsByCollection = derived(knowledgeStore, ($store) => {
	const grouped: Record<string, KnowledgeDocument[]> = { uncategorized: [] };
	for (const collection of $store.collections) {
		grouped[collection.id] = [];
	}
	for (const doc of $store.documents) {
		if (doc.collectionId && grouped[doc.collectionId]) {
			grouped[doc.collectionId].push(doc);
		} else {
			grouped.uncategorized.push(doc);
		}
	}
	return grouped;
});

export const totalChunks = derived(knowledgeStore, ($store) =>
	$store.documents.reduce((sum, doc) => sum + doc.chunks.length, 0)
);

export const pendingEmbeddings = derived(knowledgeStore, ($store) =>
	$store.documents.filter((d) => d.embeddingStatus === 'pending' || d.embeddingStatus === 'processing')
);

// Helper functions
export function chunkText(
	text: string,
	strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic',
	chunkSize: number,
	overlap: number
): string[] {
	const chunks: string[] = [];

	switch (strategy) {
		case 'fixed': {
			for (let i = 0; i < text.length; i += chunkSize - overlap) {
				chunks.push(text.slice(i, i + chunkSize));
			}
			break;
		}
		case 'sentence': {
			const sentences = text.split(/(?<=[.!?])\s+/);
			let current = '';
			for (const sentence of sentences) {
				if ((current + sentence).length > chunkSize && current) {
					chunks.push(current.trim());
					// Include overlap from previous chunk
					const words = current.split(' ');
					const overlapWords = Math.ceil(overlap / 5);
					current = words.slice(-overlapWords).join(' ') + ' ' + sentence;
				} else {
					current += (current ? ' ' : '') + sentence;
				}
			}
			if (current) chunks.push(current.trim());
			break;
		}
		case 'paragraph': {
			const paragraphs = text.split(/\n\s*\n/);
			let current = '';
			for (const para of paragraphs) {
				if ((current + para).length > chunkSize && current) {
					chunks.push(current.trim());
					current = para;
				} else {
					current += (current ? '\n\n' : '') + para;
				}
			}
			if (current) chunks.push(current.trim());
			break;
		}
		case 'semantic':
		default: {
			// Fall back to sentence-based for now
			return chunkText(text, 'sentence', chunkSize, overlap);
		}
	}

	return chunks.filter((c) => c.length > 0);
}

export function detectFileType(
	filename: string,
	mimeType: string
): KnowledgeDocument['type'] {
	const ext = filename.split('.').pop()?.toLowerCase();
	if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
	if (mimeType === 'text/markdown' || ext === 'md') return 'markdown';
	if (mimeType === 'text/html' || ext === 'html' || ext === 'htm') return 'html';
	if (mimeType === 'application/json' || ext === 'json') return 'json';
	if (
		['js', 'ts', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'svelte', 'vue', 'jsx', 'tsx'].includes(
			ext || ''
		)
	) {
		return 'code';
	}
	return 'text';
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
