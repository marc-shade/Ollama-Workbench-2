import { writable, derived } from 'svelte/store';

// ============================================================================
// Types - Comprehensive Agent Settings (v1 feature parity + enhancements)
// ============================================================================

export interface AgentType {
	id: string;
	name: string;
	description: string;
	systemPrompt: string;
	icon?: string;
	isBuiltIn: boolean;
}

export interface MetacognitiveType {
	id: string;
	name: string;
	description: string;
	promptPrefix: string;
	promptSuffix?: string;
	isBuiltIn: boolean;
}

export interface VoiceType {
	id: string;
	name: string;
	description: string;
	toneInstruction: string;
	isBuiltIn: boolean;
}

export interface Corpus {
	id: string;
	name: string;
	description: string;
	documentCount: number;
	lastUpdated: Date;
}

export interface ThinkingStep {
	id: string;
	content: string;
	enabled: boolean;
}

export type ChatMode = 'general' | 'code' | 'creative' | 'analysis';
export type CoTStrategy = 'none' | 'chain-of-thought' | 'IAP-ss' | 'IAP-mv' | 'tree-of-thought';

export interface IAPSettings {
	enabled: boolean;
	strategy: CoTStrategy;
	saliencyThreshold: number; // 0.0 - 1.0 for IAP-ss
	topPromptsCount: number; // 1 - 9 for IAP-mv
}

export interface ModelParameters {
	temperature: number;
	maxTokens: number;
	topP: number;
	topK: number;
	repeatPenalty: number;
	presencePenalty: number;
	frequencyPenalty: number;
	contextLength: number;
	seed?: number;
	stop?: string[];
	mirostat?: 0 | 1 | 2;
	mirostatTau?: number;
	mirostatEta?: number;
	numGpu?: number;
	numThread?: number;
}

export interface AgentSettings {
	// Core Agent Settings
	chatMode: ChatMode;
	agentTypeId: string | null;
	metacognitiveTypeId: string | null;
	voiceTypeId: string | null;
	corpusId: string | null;

	// Model Parameters
	parameters: ModelParameters;

	// Advanced Features
	enableWorkspaceContext: boolean;
	enableEpisodicMemory: boolean;
	enableAdvancedThinking: boolean;
	enableToolUse: boolean;
	enableStreaming: boolean;
	enableRAG: boolean;

	// IAP / Chain of Thought
	iapSettings: IAPSettings;
	customThinkingSteps: ThinkingStep[];

	// Context Settings
	systemPromptOverride: string | null;
	contextWindowSize: number;
	includeTimestamp: boolean;
	includeModelInfo: boolean;
}

// ============================================================================
// Default Data - Built-in Agent Types, Metacognitive Types, Voice Types
// ============================================================================

export const DEFAULT_AGENT_TYPES: AgentType[] = [
	{
		id: 'coder',
		name: 'Coder',
		description: 'Expert software developer focused on clean, efficient code',
		systemPrompt: `You are an expert software developer. You write clean, efficient, well-documented code. You follow best practices and design patterns. When asked to write code:
- Always include comments explaining complex logic
- Use meaningful variable and function names
- Handle edge cases and errors appropriately
- Suggest optimizations when relevant
- Explain your design decisions`,
		icon: 'code',
		isBuiltIn: true
	},
	{
		id: 'analyst',
		name: 'Analyst',
		description: 'Data-driven analyst providing structured insights',
		systemPrompt: `You are a skilled data analyst. You approach problems systematically and provide data-driven insights. When analyzing:
- Break down complex problems into components
- Use structured frameworks and methodologies
- Support conclusions with evidence and reasoning
- Present findings clearly with actionable recommendations
- Consider multiple perspectives and alternatives`,
		icon: 'chart-bar',
		isBuiltIn: true
	},
	{
		id: 'creative-writer',
		name: 'Creative Writer',
		description: 'Creative writer with vivid imagination and expressive style',
		systemPrompt: `You are a creative writer with a vivid imagination. You craft engaging narratives with rich descriptions and compelling characters. When writing:
- Use evocative language and sensory details
- Develop distinct character voices
- Build tension and maintain pacing
- Create immersive worlds and atmospheres
- Employ literary techniques effectively`,
		icon: 'pen-tool',
		isBuiltIn: true
	},
	{
		id: 'researcher',
		name: 'Researcher',
		description: 'Thorough researcher with academic rigor',
		systemPrompt: `You are a thorough researcher with academic rigor. You investigate topics deeply and present balanced, well-sourced information. When researching:
- Explore multiple authoritative sources
- Distinguish between facts and opinions
- Acknowledge limitations and uncertainties
- Cite sources and provide references
- Synthesize information into coherent summaries`,
		icon: 'search',
		isBuiltIn: true
	},
	{
		id: 'tutor',
		name: 'Tutor',
		description: 'Patient educator who adapts to learning styles',
		systemPrompt: `You are a patient and effective tutor. You explain concepts clearly and adapt to different learning styles. When teaching:
- Start with foundational concepts before advanced topics
- Use analogies and examples to illustrate points
- Check for understanding with questions
- Provide practice problems when appropriate
- Encourage and motivate learners`,
		icon: 'graduation-cap',
		isBuiltIn: true
	},
	{
		id: 'assistant',
		name: 'General Assistant',
		description: 'Helpful assistant for everyday tasks',
		systemPrompt: `You are a helpful, friendly assistant. You provide clear, accurate information and assistance for a wide variety of tasks. You are conversational but focused on being genuinely useful.`,
		icon: 'message-circle',
		isBuiltIn: true
	}
];

export const DEFAULT_METACOGNITIVE_TYPES: MetacognitiveType[] = [
	{
		id: 'chain-of-thought',
		name: 'Chain of Thought',
		description: 'Step-by-step reasoning through problems',
		promptPrefix: `Let me think through this step by step:

`,
		promptSuffix: `

Therefore, my conclusion is:`,
		isBuiltIn: true
	},
	{
		id: 'visualization-of-thought',
		name: 'Visualization of Thought',
		description: 'Visual/spatial reasoning approach',
		promptPrefix: `Let me visualize this problem mentally:

I'll imagine the components and their relationships spatially:
`,
		promptSuffix: `

Based on this mental model:`,
		isBuiltIn: true
	},
	{
		id: 'tree-of-thought',
		name: 'Tree of Thought',
		description: 'Explore multiple reasoning branches',
		promptPrefix: `I'll explore multiple reasoning paths:

**Branch 1:**
`,
		promptSuffix: `

**Evaluation of branches:**
Based on analyzing these paths, the best approach is:`,
		isBuiltIn: true
	},
	{
		id: 'self-reflection',
		name: 'Self-Reflection',
		description: 'Critical self-evaluation of responses',
		promptPrefix: `Let me provide my initial response, then critically evaluate it:

**Initial Response:**
`,
		promptSuffix: `

**Self-Reflection:**
- What did I do well?
- What could be improved?
- Am I missing anything important?

**Refined Response:**`,
		isBuiltIn: true
	},
	{
		id: 'socratic',
		name: 'Socratic Method',
		description: 'Question-driven exploration',
		promptPrefix: `Let me explore this through questions:

**Key questions to consider:**
`,
		promptSuffix: `

**Answers and insights:**`,
		isBuiltIn: true
	},
	{
		id: 'first-principles',
		name: 'First Principles',
		description: 'Break down to fundamental truths',
		promptPrefix: `Let me break this down to first principles:

**Fundamental assumptions:**
`,
		promptSuffix: `

**Building up from basics:**`,
		isBuiltIn: true
	}
];

export const DEFAULT_VOICE_TYPES: VoiceType[] = [
	{
		id: 'professional',
		name: 'Professional',
		description: 'Formal, business-appropriate tone',
		toneInstruction: 'Respond in a professional, formal tone. Use precise language and maintain objectivity.',
		isBuiltIn: true
	},
	{
		id: 'friendly',
		name: 'Friendly',
		description: 'Warm, approachable communication',
		toneInstruction: 'Respond in a warm, friendly tone. Be approachable and conversational while remaining helpful.',
		isBuiltIn: true
	},
	{
		id: 'concise',
		name: 'Concise',
		description: 'Brief, to-the-point responses',
		toneInstruction: 'Be extremely concise. Give direct answers without unnecessary elaboration. Prioritize brevity.',
		isBuiltIn: true
	},
	{
		id: 'detailed',
		name: 'Detailed',
		description: 'Thorough, comprehensive explanations',
		toneInstruction: 'Provide detailed, thorough explanations. Cover all relevant aspects and include examples.',
		isBuiltIn: true
	},
	{
		id: 'casual',
		name: 'Casual',
		description: 'Relaxed, informal style',
		toneInstruction: 'Keep it casual and relaxed. Use informal language and a conversational style.',
		isBuiltIn: true
	},
	{
		id: 'academic',
		name: 'Academic',
		description: 'Scholarly, rigorous discourse',
		toneInstruction: 'Use academic language and rigorous analysis. Structure responses formally with clear arguments.',
		isBuiltIn: true
	},
	{
		id: 'encouraging',
		name: 'Encouraging',
		description: 'Supportive, motivational approach',
		toneInstruction: 'Be encouraging and supportive. Celebrate progress and provide motivation.',
		isBuiltIn: true
	}
];

export const DEFAULT_THINKING_STEPS: ThinkingStep[] = [
	{ id: '1', content: 'Understand the problem or question fully', enabled: true },
	{ id: '2', content: 'Identify key components and constraints', enabled: true },
	{ id: '3', content: 'Consider relevant knowledge and context', enabled: true },
	{ id: '4', content: 'Generate potential approaches or solutions', enabled: true },
	{ id: '5', content: 'Evaluate and compare options', enabled: true },
	{ id: '6', content: 'Select and refine the best approach', enabled: true },
	{ id: '7', content: 'Formulate clear, structured response', enabled: true },
	{ id: '8', content: 'Review for accuracy and completeness', enabled: true }
];

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_PARAMETERS: ModelParameters = {
	temperature: 0.7,
	maxTokens: 4096,
	topP: 0.9,
	topK: 40,
	repeatPenalty: 1.1,
	presencePenalty: 0.0,
	frequencyPenalty: 0.0,
	contextLength: 4096
};

export const DEFAULT_IAP_SETTINGS: IAPSettings = {
	enabled: false,
	strategy: 'none',
	saliencyThreshold: 0.5,
	topPromptsCount: 3
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
	chatMode: 'general',
	agentTypeId: null,
	metacognitiveTypeId: null,
	voiceTypeId: null,
	corpusId: null,
	parameters: { ...DEFAULT_PARAMETERS },
	enableWorkspaceContext: false,
	enableEpisodicMemory: false,
	enableAdvancedThinking: false,
	enableToolUse: false,
	enableStreaming: true,
	enableRAG: false,
	iapSettings: { ...DEFAULT_IAP_SETTINGS },
	customThinkingSteps: DEFAULT_THINKING_STEPS.map((s) => ({ ...s })),
	systemPromptOverride: null,
	contextWindowSize: 4096,
	includeTimestamp: false,
	includeModelInfo: false
};

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_SETTINGS = 'ollama-workbench-agent-settings';
const STORAGE_KEY_AGENT_TYPES = 'ollama-workbench-agent-types';
const STORAGE_KEY_METACOGNITIVE_TYPES = 'ollama-workbench-metacognitive-types';
const STORAGE_KEY_VOICE_TYPES = 'ollama-workbench-voice-types';

// ============================================================================
// Storage Helpers
// ============================================================================

function loadFromStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	try {
		const stored = localStorage.getItem(key);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Ignore errors
	}
	return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Ignore quota errors
	}
}

// ============================================================================
// Agent Settings Store
// ============================================================================

// Valid chatMode values
const VALID_CHAT_MODES: ChatMode[] = ['general', 'code', 'creative', 'analysis'];

function createAgentSettingsStore() {
	const stored = loadFromStorage<AgentSettings>(STORAGE_KEY_SETTINGS, DEFAULT_AGENT_SETTINGS);

	// Validate and fix stale chatMode values from localStorage
	const validatedChatMode: ChatMode = VALID_CHAT_MODES.includes(stored.chatMode as ChatMode)
		? stored.chatMode
		: 'general';

	const { subscribe, set, update } = writable<AgentSettings>({
		...DEFAULT_AGENT_SETTINGS,
		...stored,
		chatMode: validatedChatMode,
		parameters: { ...DEFAULT_PARAMETERS, ...stored.parameters },
		iapSettings: { ...DEFAULT_IAP_SETTINGS, ...stored.iapSettings }
	});

	return {
		subscribe,

		// Update entire settings
		setSettings: (settings: AgentSettings) => {
			set(settings);
			saveToStorage(STORAGE_KEY_SETTINGS, settings);
		},

		// Update partial settings
		updateSettings: (partial: Partial<AgentSettings>) => {
			update((s) => {
				const newSettings = { ...s, ...partial };
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		// Update model parameters
		updateParameters: (params: Partial<ModelParameters>) => {
			update((s) => {
				const newSettings = {
					...s,
					parameters: { ...s.parameters, ...params }
				};
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		// Update IAP settings
		updateIAPSettings: (iap: Partial<IAPSettings>) => {
			update((s) => {
				const newSettings = {
					...s,
					iapSettings: { ...s.iapSettings, ...iap }
				};
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		// Update thinking steps
		setThinkingSteps: (steps: ThinkingStep[]) => {
			update((s) => {
				const newSettings = { ...s, customThinkingSteps: steps };
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		toggleThinkingStep: (stepId: string) => {
			update((s) => {
				const newSteps = s.customThinkingSteps.map((step) =>
					step.id === stepId ? { ...step, enabled: !step.enabled } : step
				);
				const newSettings = { ...s, customThinkingSteps: newSteps };
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		addThinkingStep: (content: string) => {
			update((s) => {
				const newStep: ThinkingStep = {
					id: crypto.randomUUID(),
					content,
					enabled: true
				};
				const newSettings = {
					...s,
					customThinkingSteps: [...s.customThinkingSteps, newStep]
				};
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		removeThinkingStep: (stepId: string) => {
			update((s) => {
				const newSettings = {
					...s,
					customThinkingSteps: s.customThinkingSteps.filter((step) => step.id !== stepId)
				};
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		},

		// Reset to defaults
		resetToDefaults: () => {
			const defaults = { ...DEFAULT_AGENT_SETTINGS };
			set(defaults);
			saveToStorage(STORAGE_KEY_SETTINGS, defaults);
		},

		resetParameters: () => {
			update((s) => {
				const newSettings = { ...s, parameters: { ...DEFAULT_PARAMETERS } };
				saveToStorage(STORAGE_KEY_SETTINGS, newSettings);
				return newSettings;
			});
		}
	};
}

// ============================================================================
// Custom Types Stores (User-defined agent types, metacognitive types, etc.)
// ============================================================================

function createCustomTypesStore<T extends { id: string; isBuiltIn: boolean }>(
	key: string,
	defaults: T[]
) {
	const storedCustom = loadFromStorage<T[]>(key, []);
	const { subscribe, set, update } = writable<T[]>([...defaults, ...storedCustom]);

	return {
		subscribe,

		add: (item: Omit<T, 'id' | 'isBuiltIn'>) => {
			update((items) => {
				const newItem = {
					...item,
					id: crypto.randomUUID(),
					isBuiltIn: false
				} as T;
				const custom = [...items.filter((i) => !i.isBuiltIn), newItem];
				saveToStorage(key, custom);
				return [...defaults, ...custom];
			});
		},

		update: (id: string, updates: Partial<T>) => {
			update((items) => {
				const newItems = items.map((item) =>
					item.id === id && !item.isBuiltIn ? { ...item, ...updates } : item
				);
				const custom = newItems.filter((i) => !i.isBuiltIn);
				saveToStorage(key, custom);
				return newItems;
			});
		},

		remove: (id: string) => {
			update((items) => {
				const newItems = items.filter((item) => item.id !== id || item.isBuiltIn);
				const custom = newItems.filter((i) => !i.isBuiltIn);
				saveToStorage(key, custom);
				return newItems;
			});
		},

		reset: () => {
			set([...defaults]);
			saveToStorage(key, []);
		}
	};
}

// ============================================================================
// Corpus Store
// ============================================================================

function createCorpusStore() {
	const { subscribe, set, update } = writable<Corpus[]>([]);

	return {
		subscribe,

		// Fetch corpora from API
		async fetch() {
			try {
				const response = await fetch('/api/corpus');
				if (response.ok) {
					const data = await response.json();
					set(
						data.map((c: Corpus) => ({
							...c,
							lastUpdated: new Date(c.lastUpdated)
						}))
					);
				}
			} catch (error) {
				console.error('Failed to fetch corpora:', error);
			}
		},

		add: (corpus: Corpus) => {
			update((corpora) => [...corpora, corpus]);
		},

		remove: (id: string) => {
			update((corpora) => corpora.filter((c) => c.id !== id));
		}
	};
}

// ============================================================================
// Export Stores
// ============================================================================

export const agentSettingsStore = createAgentSettingsStore();

export const agentTypesStore = createCustomTypesStore<AgentType>(
	STORAGE_KEY_AGENT_TYPES,
	DEFAULT_AGENT_TYPES
);

export const metacognitiveTypesStore = createCustomTypesStore<MetacognitiveType>(
	STORAGE_KEY_METACOGNITIVE_TYPES,
	DEFAULT_METACOGNITIVE_TYPES
);

export const voiceTypesStore = createCustomTypesStore<VoiceType>(
	STORAGE_KEY_VOICE_TYPES,
	DEFAULT_VOICE_TYPES
);

export const corpusStore = createCorpusStore();

// ============================================================================
// Derived Stores
// ============================================================================

export const selectedAgentType = derived(
	[agentSettingsStore, agentTypesStore],
	([$settings, $types]) => $types.find((t) => t.id === $settings.agentTypeId) || null
);

export const selectedMetacognitiveType = derived(
	[agentSettingsStore, metacognitiveTypesStore],
	([$settings, $types]) => $types.find((t) => t.id === $settings.metacognitiveTypeId) || null
);

export const selectedVoiceType = derived(
	[agentSettingsStore, voiceTypesStore],
	([$settings, $types]) => $types.find((t) => t.id === $settings.voiceTypeId) || null
);

export const selectedCorpus = derived([agentSettingsStore, corpusStore], ([$settings, $corpora]) =>
	$corpora.find((c) => c.id === $settings.corpusId) || null
);

// Computed system prompt combining all settings
export const computedSystemPrompt = derived(
	[agentSettingsStore, selectedAgentType, selectedMetacognitiveType, selectedVoiceType],
	([$settings, $agent, $meta, $voice]) => {
		const parts: string[] = [];

		// Start with agent type system prompt
		if ($agent) {
			parts.push($agent.systemPrompt);
		}

		// Add voice/tone instruction
		if ($voice) {
			parts.push(`\n\n**Communication Style:**\n${$voice.toneInstruction}`);
		}

		// Add metacognitive prefix if advanced thinking is enabled
		if ($settings.enableAdvancedThinking && $meta) {
			parts.push(`\n\n**Reasoning Approach:**\n${$meta.promptPrefix}`);
		}

		// Add custom thinking steps if enabled
		if ($settings.enableAdvancedThinking && $settings.customThinkingSteps.length > 0) {
			const enabledSteps = $settings.customThinkingSteps.filter((s) => s.enabled);
			if (enabledSteps.length > 0) {
				parts.push('\n\n**Thinking Steps:**');
				enabledSteps.forEach((step, i) => {
					parts.push(`${i + 1}. ${step.content}`);
				});
			}
		}

		// Add any system prompt override
		if ($settings.systemPromptOverride) {
			parts.push(`\n\n**Additional Instructions:**\n${$settings.systemPromptOverride}`);
		}

		return parts.join('\n');
	}
);

// Get Ollama options object from current settings
export const ollamaOptions = derived(agentSettingsStore, ($settings) => ({
	temperature: $settings.parameters.temperature,
	num_predict: $settings.parameters.maxTokens,
	top_p: $settings.parameters.topP,
	top_k: $settings.parameters.topK,
	repeat_penalty: $settings.parameters.repeatPenalty,
	presence_penalty: $settings.parameters.presencePenalty,
	frequency_penalty: $settings.parameters.frequencyPenalty,
	num_ctx: $settings.parameters.contextLength,
	...(($settings.parameters.seed !== undefined) && { seed: $settings.parameters.seed }),
	...(($settings.parameters.mirostat !== undefined) && { mirostat: $settings.parameters.mirostat }),
	...(($settings.parameters.mirostatTau !== undefined) && { mirostat_tau: $settings.parameters.mirostatTau }),
	...(($settings.parameters.mirostatEta !== undefined) && { mirostat_eta: $settings.parameters.mirostatEta }),
	...(($settings.parameters.stop?.length) && { stop: $settings.parameters.stop })
}));
