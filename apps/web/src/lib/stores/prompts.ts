import { writable, derived } from 'svelte/store';

// Version history for prompts
export interface PromptVersion {
	id: string;
	content: string;
	title: string;
	createdAt: string;
	changeDescription?: string;
}

// Execution metrics for a prompt
export interface PromptExecution {
	id: string;
	timestamp: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	responseTimeMs: number;
	rating?: number; // 1-5 star rating
	wasSuccessful: boolean;
	variantId?: string; // For A/B testing
}

// A/B Testing variant
export interface PromptVariant {
	id: string;
	name: string;
	content: string;
	weight: number; // Percentage of traffic (0-100)
	createdAt: string;
	executions: PromptExecution[];
}

// Aggregated metrics
export interface PromptMetrics {
	totalExecutions: number;
	avgResponseTimeMs: number;
	avgInputTokens: number;
	avgOutputTokens: number;
	avgRating: number;
	successRate: number;
	lastUsed?: string;
}

export interface Prompt {
	id: string;
	title: string;
	content: string;
	category: string;
	tags: string[];
	isFavorite: boolean;
	createdAt: string;
	updatedAt: string;
	usageCount: number;
	// Version control
	versions: PromptVersion[];
	currentVersion: number;
	// A/B Testing
	variants: PromptVariant[];
	abTestingEnabled: boolean;
	// Metrics
	executions: PromptExecution[];
}

export interface PromptsState {
	prompts: Prompt[];
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-prompts';

function loadFromStorage(): Prompt[] {
	if (typeof window === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const prompts = JSON.parse(stored);
			// Migrate old prompts to new format
			return prompts.map(migratePrompt);
		}
		return getDefaultPrompts();
	} catch {
		return getDefaultPrompts();
	}
}

// Migrate old prompt format to new format with versions, variants, and executions
function migratePrompt(prompt: Partial<Prompt>): Prompt {
	return {
		id: prompt.id || `prompt-${Date.now()}`,
		title: prompt.title || 'Untitled',
		content: prompt.content || '',
		category: prompt.category || 'General',
		tags: prompt.tags || [],
		isFavorite: prompt.isFavorite ?? false,
		createdAt: prompt.createdAt || new Date().toISOString(),
		updatedAt: prompt.updatedAt || new Date().toISOString(),
		usageCount: prompt.usageCount || 0,
		versions: prompt.versions || [{
			id: `v-${Date.now()}`,
			content: prompt.content || '',
			title: prompt.title || 'Untitled',
			createdAt: prompt.createdAt || new Date().toISOString(),
			changeDescription: 'Initial version'
		}],
		currentVersion: prompt.currentVersion ?? 0,
		variants: prompt.variants || [],
		abTestingEnabled: prompt.abTestingEnabled ?? false,
		executions: prompt.executions || []
	};
}

function saveToStorage(prompts: Prompt[]) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function getDefaultPrompts(): Prompt[] {
	const now = new Date().toISOString();
	return [
		{
			id: 'default-1',
			title: 'Code Review',
			content: 'Please review the following code and provide feedback on:\n1. Code quality and readability\n2. Potential bugs or issues\n3. Performance improvements\n4. Best practices\n\nCode:\n{{code}}',
			category: 'Development',
			tags: ['code', 'review', 'quality'],
			isFavorite: true,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			versions: [{
				id: 'v-default-1',
				content: 'Please review the following code and provide feedback on:\n1. Code quality and readability\n2. Potential bugs or issues\n3. Performance improvements\n4. Best practices\n\nCode:\n{{code}}',
				title: 'Code Review',
				createdAt: now,
				changeDescription: 'Initial version'
			}],
			currentVersion: 0,
			variants: [],
			abTestingEnabled: false,
			executions: []
		},
		{
			id: 'default-2',
			title: 'Explain Code',
			content: 'Please explain the following code in detail. Include:\n- What it does\n- How it works step by step\n- Any important concepts used\n\nCode:\n{{code}}',
			category: 'Development',
			tags: ['code', 'explanation', 'learning'],
			isFavorite: false,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			versions: [{
				id: 'v-default-2',
				content: 'Please explain the following code in detail. Include:\n- What it does\n- How it works step by step\n- Any important concepts used\n\nCode:\n{{code}}',
				title: 'Explain Code',
				createdAt: now,
				changeDescription: 'Initial version'
			}],
			currentVersion: 0,
			variants: [],
			abTestingEnabled: false,
			executions: []
		},
		{
			id: 'default-3',
			title: 'Write Unit Tests',
			content: 'Please write comprehensive unit tests for the following code. Include:\n- Edge cases\n- Error handling\n- Happy path scenarios\n\nCode:\n{{code}}',
			category: 'Development',
			tags: ['code', 'testing', 'unit-tests'],
			isFavorite: false,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			versions: [{
				id: 'v-default-3',
				content: 'Please write comprehensive unit tests for the following code. Include:\n- Edge cases\n- Error handling\n- Happy path scenarios\n\nCode:\n{{code}}',
				title: 'Write Unit Tests',
				createdAt: now,
				changeDescription: 'Initial version'
			}],
			currentVersion: 0,
			variants: [],
			abTestingEnabled: false,
			executions: []
		},
		{
			id: 'default-4',
			title: 'Summarize Text',
			content: 'Please summarize the following text in a clear and concise manner. Highlight the key points and main ideas.\n\nText:\n{{text}}',
			category: 'Writing',
			tags: ['summary', 'text', 'analysis'],
			isFavorite: false,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			versions: [{
				id: 'v-default-4',
				content: 'Please summarize the following text in a clear and concise manner. Highlight the key points and main ideas.\n\nText:\n{{text}}',
				title: 'Summarize Text',
				createdAt: now,
				changeDescription: 'Initial version'
			}],
			currentVersion: 0,
			variants: [],
			abTestingEnabled: false,
			executions: []
		},
		{
			id: 'default-5',
			title: 'Brainstorm Ideas',
			content: 'Help me brainstorm ideas for: {{topic}}\n\nPlease provide:\n- At least 10 creative ideas\n- Brief explanation for each\n- Pros and cons where relevant',
			category: 'Creative',
			tags: ['brainstorm', 'ideas', 'creative'],
			isFavorite: true,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			versions: [{
				id: 'v-default-5',
				content: 'Help me brainstorm ideas for: {{topic}}\n\nPlease provide:\n- At least 10 creative ideas\n- Brief explanation for each\n- Pros and cons where relevant',
				title: 'Brainstorm Ideas',
				createdAt: now,
				changeDescription: 'Initial version'
			}],
			currentVersion: 0,
			variants: [],
			abTestingEnabled: false,
			executions: []
		},
		{
			id: 'default-6',
			title: 'Debug Error',
			content: 'I\'m getting the following error. Please help me debug it:\n\nError:\n{{error}}\n\nCode context:\n{{code}}\n\nPlease explain:\n1. What the error means\n2. Likely causes\n3. How to fix it',
			category: 'Development',
			tags: ['debug', 'error', 'troubleshoot'],
			isFavorite: true,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			versions: [{
				id: 'v-default-6',
				content: 'I\'m getting the following error. Please help me debug it:\n\nError:\n{{error}}\n\nCode context:\n{{code}}\n\nPlease explain:\n1. What the error means\n2. Likely causes\n3. How to fix it',
				title: 'Debug Error',
				createdAt: now,
				changeDescription: 'Initial version'
			}],
			currentVersion: 0,
			variants: [],
			abTestingEnabled: false,
			executions: []
		}
	];
}

// Calculate metrics for a prompt
export function calculateMetrics(prompt: Prompt): PromptMetrics {
	const executions = prompt.executions;
	if (executions.length === 0) {
		return {
			totalExecutions: 0,
			avgResponseTimeMs: 0,
			avgInputTokens: 0,
			avgOutputTokens: 0,
			avgRating: 0,
			successRate: 0
		};
	}

	const successful = executions.filter(e => e.wasSuccessful);
	const rated = executions.filter(e => e.rating !== undefined);

	return {
		totalExecutions: executions.length,
		avgResponseTimeMs: Math.round(executions.reduce((sum, e) => sum + e.responseTimeMs, 0) / executions.length),
		avgInputTokens: Math.round(executions.reduce((sum, e) => sum + e.inputTokens, 0) / executions.length),
		avgOutputTokens: Math.round(executions.reduce((sum, e) => sum + e.outputTokens, 0) / executions.length),
		avgRating: rated.length > 0 ? rated.reduce((sum, e) => sum + (e.rating || 0), 0) / rated.length : 0,
		successRate: successful.length / executions.length * 100,
		lastUsed: executions.length > 0 ? executions[executions.length - 1].timestamp : undefined
	};
}

// Calculate metrics for a variant
export function calculateVariantMetrics(variant: PromptVariant): PromptMetrics {
	const executions = variant.executions;
	if (executions.length === 0) {
		return {
			totalExecutions: 0,
			avgResponseTimeMs: 0,
			avgInputTokens: 0,
			avgOutputTokens: 0,
			avgRating: 0,
			successRate: 0
		};
	}

	const successful = executions.filter(e => e.wasSuccessful);
	const rated = executions.filter(e => e.rating !== undefined);

	return {
		totalExecutions: executions.length,
		avgResponseTimeMs: Math.round(executions.reduce((sum, e) => sum + e.responseTimeMs, 0) / executions.length),
		avgInputTokens: Math.round(executions.reduce((sum, e) => sum + e.inputTokens, 0) / executions.length),
		avgOutputTokens: Math.round(executions.reduce((sum, e) => sum + e.outputTokens, 0) / executions.length),
		avgRating: rated.length > 0 ? rated.reduce((sum, e) => sum + (e.rating || 0), 0) / rated.length : 0,
		successRate: successful.length / executions.length * 100,
		lastUsed: executions.length > 0 ? executions[executions.length - 1].timestamp : undefined
	};
}

// Select a variant based on weights for A/B testing
export function selectVariant(prompt: Prompt): PromptVariant | null {
	if (!prompt.abTestingEnabled || prompt.variants.length === 0) {
		return null;
	}

	const totalWeight = prompt.variants.reduce((sum, v) => sum + v.weight, 0);
	if (totalWeight === 0) return prompt.variants[0];

	const random = Math.random() * totalWeight;
	let cumulative = 0;

	for (const variant of prompt.variants) {
		cumulative += variant.weight;
		if (random <= cumulative) {
			return variant;
		}
	}

	return prompt.variants[prompt.variants.length - 1];
}

function createPromptsStore() {
	const { subscribe, set, update } = writable<PromptsState>({
		prompts: [],
		loading: true,
		error: null
	});

	// Initialize
	if (typeof window !== 'undefined') {
		const prompts = loadFromStorage();
		set({ prompts, loading: false, error: null });
	}

	return {
		subscribe,

		loadPrompts: () => {
			const prompts = loadFromStorage();
			set({ prompts, loading: false, error: null });
		},

		addPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'versions' | 'currentVersion' | 'variants' | 'abTestingEnabled' | 'executions'>) => {
			update((state) => {
				const now = new Date().toISOString();
				const newPrompt: Prompt = {
					...prompt,
					id: `prompt-${Date.now()}`,
					createdAt: now,
					updatedAt: now,
					usageCount: 0,
					versions: [{
						id: `v-${Date.now()}`,
						content: prompt.content,
						title: prompt.title,
						createdAt: now,
						changeDescription: 'Initial version'
					}],
					currentVersion: 0,
					variants: [],
					abTestingEnabled: false,
					executions: []
				};
				const newPrompts = [...state.prompts, newPrompt];
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		updatePrompt: (id: string, updates: Partial<Prompt>, createVersion: boolean = true) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== id) return p;

					const now = new Date().toISOString();
					const updatedPrompt = { ...p, ...updates, updatedAt: now };

					// Create new version if content or title changed
					if (createVersion && (updates.content !== undefined || updates.title !== undefined)) {
						const newVersion: PromptVersion = {
							id: `v-${Date.now()}`,
							content: updates.content ?? p.content,
							title: updates.title ?? p.title,
							createdAt: now,
							changeDescription: `Updated ${updates.title ? 'title' : ''}${updates.title && updates.content ? ' and ' : ''}${updates.content ? 'content' : ''}`
						};
						updatedPrompt.versions = [...p.versions, newVersion];
						updatedPrompt.currentVersion = updatedPrompt.versions.length - 1;
					}

					return updatedPrompt;
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		deletePrompt: (id: string) => {
			update((state) => {
				const newPrompts = state.prompts.filter((p) => p.id !== id);
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		toggleFavorite: (id: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) =>
					p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
				);
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		incrementUsage: (id: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) =>
					p.id === id ? { ...p, usageCount: p.usageCount + 1 } : p
				);
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		duplicatePrompt: (id: string) => {
			update((state) => {
				const original = state.prompts.find((p) => p.id === id);
				if (!original) return state;

				const now = new Date().toISOString();
				const duplicate: Prompt = {
					...original,
					id: `prompt-${Date.now()}`,
					title: `${original.title} (Copy)`,
					createdAt: now,
					updatedAt: now,
					usageCount: 0,
					versions: [{
						id: `v-${Date.now()}`,
						content: original.content,
						title: `${original.title} (Copy)`,
						createdAt: now,
						changeDescription: 'Duplicated from ' + original.title
					}],
					currentVersion: 0,
					variants: [],
					abTestingEnabled: false,
					executions: []
				};
				const newPrompts = [...state.prompts, duplicate];
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		// Version control methods
		restoreVersion: (promptId: string, versionIndex: number) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId || versionIndex >= p.versions.length) return p;

					const version = p.versions[versionIndex];
					const now = new Date().toISOString();
					const restoredVersion: PromptVersion = {
						id: `v-${Date.now()}`,
						content: version.content,
						title: version.title,
						createdAt: now,
						changeDescription: `Restored from version ${versionIndex + 1}`
					};

					return {
						...p,
						content: version.content,
						title: version.title,
						updatedAt: now,
						versions: [...p.versions, restoredVersion],
						currentVersion: p.versions.length
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		deleteVersion: (promptId: string, versionIndex: number) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId || p.versions.length <= 1) return p; // Keep at least one version

					const newVersions = p.versions.filter((_, i) => i !== versionIndex);
					return {
						...p,
						versions: newVersions,
						currentVersion: Math.min(p.currentVersion, newVersions.length - 1)
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		// A/B Testing methods
		addVariant: (promptId: string, name: string, content: string, weight: number = 50) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					const newVariant: PromptVariant = {
						id: `var-${Date.now()}`,
						name,
						content,
						weight,
						createdAt: new Date().toISOString(),
						executions: []
					};

					return {
						...p,
						variants: [...p.variants, newVariant],
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		updateVariant: (promptId: string, variantId: string, updates: Partial<PromptVariant>) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					return {
						...p,
						variants: p.variants.map((v) =>
							v.id === variantId ? { ...v, ...updates } : v
						),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		deleteVariant: (promptId: string, variantId: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					return {
						...p,
						variants: p.variants.filter((v) => v.id !== variantId),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		toggleABTesting: (promptId: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					return {
						...p,
						abTestingEnabled: !p.abTestingEnabled,
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		// Metrics methods
		recordExecution: (promptId: string, execution: Omit<PromptExecution, 'id' | 'timestamp'>, variantId?: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					const newExecution: PromptExecution = {
						...execution,
						id: `exec-${Date.now()}`,
						timestamp: new Date().toISOString(),
						variantId
					};

					// Record execution in variant if applicable
					let newVariants = p.variants;
					if (variantId) {
						newVariants = p.variants.map((v) =>
							v.id === variantId
								? { ...v, executions: [...v.executions, newExecution] }
								: v
						);
					}

					return {
						...p,
						executions: [...p.executions, newExecution],
						variants: newVariants,
						usageCount: p.usageCount + 1,
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		rateExecution: (promptId: string, executionId: string, rating: number) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					const newExecutions = p.executions.map((e) =>
						e.id === executionId ? { ...e, rating } : e
					);

					// Also update in variant if applicable
					const execution = p.executions.find(e => e.id === executionId);
					let newVariants = p.variants;
					if (execution?.variantId) {
						newVariants = p.variants.map((v) =>
							v.id === execution.variantId
								? {
									...v,
									executions: v.executions.map((e) =>
										e.id === executionId ? { ...e, rating } : e
									)
								}
								: v
						);
					}

					return {
						...p,
						executions: newExecutions,
						variants: newVariants
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		clearExecutionHistory: (promptId: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					return {
						...p,
						executions: [],
						variants: p.variants.map((v) => ({ ...v, executions: [] }))
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		},

		// Promote a variant to the main prompt
		promoteVariant: (promptId: string, variantId: string) => {
			update((state) => {
				const newPrompts = state.prompts.map((p) => {
					if (p.id !== promptId) return p;

					const variant = p.variants.find((v) => v.id === variantId);
					if (!variant) return p;

					const now = new Date().toISOString();
					const newVersion: PromptVersion = {
						id: `v-${Date.now()}`,
						content: variant.content,
						title: p.title,
						createdAt: now,
						changeDescription: `Promoted variant "${variant.name}"`
					};

					return {
						...p,
						content: variant.content,
						versions: [...p.versions, newVersion],
						currentVersion: p.versions.length,
						updatedAt: now
					};
				});
				saveToStorage(newPrompts);
				return { ...state, prompts: newPrompts };
			});
		}
	};
}

export const promptsStore = createPromptsStore();

// Derived stores
export const categories = derived(promptsStore, ($store) =>
	[...new Set($store.prompts.map((p) => p.category))].sort()
);

export const favoritePrompts = derived(promptsStore, ($store) =>
	$store.prompts.filter((p) => p.isFavorite)
);

export const promptsWithABTesting = derived(promptsStore, ($store) =>
	$store.prompts.filter((p) => p.abTestingEnabled)
);

// Get top performing prompts by average rating
export const topRatedPrompts = derived(promptsStore, ($store) => {
	return $store.prompts
		.map(p => ({ ...p, metrics: calculateMetrics(p) }))
		.filter(p => p.metrics.avgRating > 0)
		.sort((a, b) => b.metrics.avgRating - a.metrics.avgRating)
		.slice(0, 10);
});

// Get most used prompts
export const mostUsedPrompts = derived(promptsStore, ($store) => {
	return [...$store.prompts]
		.sort((a, b) => b.usageCount - a.usageCount)
		.slice(0, 10);
});
