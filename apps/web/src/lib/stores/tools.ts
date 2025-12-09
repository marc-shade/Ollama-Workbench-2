import { writable, derived } from 'svelte/store';

export interface ToolParameter {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'array' | 'object';
	description: string;
	required: boolean;
	enum?: string[];
	default?: unknown;
}

export interface ToolDefinition {
	id: string;
	name: string;
	description: string;
	parameters: ToolParameter[];
	createdAt: string;
	updatedAt: string;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolCallTrace {
	id: string;
	toolId: string;
	model: string;
	prompt: string;
	toolCalls: ToolCall[];
	rawResponse: unknown;
	latencyMs: number;
	timestamp: string;
	success: boolean;
	error?: string;
}

export interface ModelComparison {
	id: string;
	toolId: string;
	prompt: string;
	results: {
		model: string;
		toolCalls: ToolCall[];
		latencyMs: number;
		success: boolean;
		error?: string;
	}[];
	timestamp: string;
}

export interface ToolsState {
	tools: ToolDefinition[];
	traces: ToolCallTrace[];
	comparisons: ModelComparison[];
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-tools';

function loadFromStorage(): { tools: ToolDefinition[]; traces: ToolCallTrace[]; comparisons: ModelComparison[] } {
	if (typeof window === 'undefined') return { tools: [], traces: [], comparisons: [] };
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
		return { tools: getDefaultTools(), traces: [], comparisons: [] };
	} catch {
		return { tools: getDefaultTools(), traces: [], comparisons: [] };
	}
}

function saveToStorage(data: { tools: ToolDefinition[]; traces: ToolCallTrace[]; comparisons: ModelComparison[] }) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getDefaultTools(): ToolDefinition[] {
	return [
		{
			id: 'default-weather',
			name: 'get_weather',
			description: 'Get the current weather for a specified location',
			parameters: [
				{
					name: 'location',
					type: 'string',
					description: 'The city and state, e.g. San Francisco, CA',
					required: true
				},
				{
					name: 'unit',
					type: 'string',
					description: 'Temperature unit',
					required: false,
					enum: ['celsius', 'fahrenheit'],
					default: 'fahrenheit'
				}
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'default-search',
			name: 'web_search',
			description: 'Search the web for information',
			parameters: [
				{
					name: 'query',
					type: 'string',
					description: 'The search query',
					required: true
				},
				{
					name: 'num_results',
					type: 'number',
					description: 'Number of results to return',
					required: false,
					default: 5
				}
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'default-calculator',
			name: 'calculate',
			description: 'Perform mathematical calculations',
			parameters: [
				{
					name: 'expression',
					type: 'string',
					description: 'Mathematical expression to evaluate, e.g. "2 + 2 * 3"',
					required: true
				}
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];
}

function createToolsStore() {
	const { subscribe, set, update } = writable<ToolsState>({
		tools: [],
		traces: [],
		comparisons: [],
		loading: true,
		error: null
	});

	// Initialize
	if (typeof window !== 'undefined') {
		const data = loadFromStorage();
		set({
			tools: data.tools,
			traces: data.traces,
			comparisons: data.comparisons,
			loading: false,
			error: null
		});
	}

	return {
		subscribe,

		loadTools: () => {
			const data = loadFromStorage();
			set({
				tools: data.tools,
				traces: data.traces,
				comparisons: data.comparisons,
				loading: false,
				error: null
			});
		},

		addTool: (tool: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>) => {
			update((state) => {
				const newTool: ToolDefinition = {
					...tool,
					id: `tool-${Date.now()}`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newTools = [...state.tools, newTool];
				saveToStorage({ tools: newTools, traces: state.traces, comparisons: state.comparisons });
				return { ...state, tools: newTools };
			});
		},

		updateTool: (id: string, updates: Partial<ToolDefinition>) => {
			update((state) => {
				const newTools = state.tools.map((t) =>
					t.id === id
						? { ...t, ...updates, updatedAt: new Date().toISOString() }
						: t
				);
				saveToStorage({ tools: newTools, traces: state.traces, comparisons: state.comparisons });
				return { ...state, tools: newTools };
			});
		},

		deleteTool: (id: string) => {
			update((state) => {
				const newTools = state.tools.filter((t) => t.id !== id);
				saveToStorage({ tools: newTools, traces: state.traces, comparisons: state.comparisons });
				return { ...state, tools: newTools };
			});
		},

		duplicateTool: (id: string) => {
			update((state) => {
				const original = state.tools.find((t) => t.id === id);
				if (!original) return state;

				const duplicate: ToolDefinition = {
					...original,
					id: `tool-${Date.now()}`,
					name: `${original.name}_copy`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newTools = [...state.tools, duplicate];
				saveToStorage({ tools: newTools, traces: state.traces, comparisons: state.comparisons });
				return { ...state, tools: newTools };
			});
		},

		addTrace: (trace: Omit<ToolCallTrace, 'id' | 'timestamp'>) => {
			update((state) => {
				const newTrace: ToolCallTrace = {
					...trace,
					id: `trace-${Date.now()}`,
					timestamp: new Date().toISOString()
				};
				const newTraces = [newTrace, ...state.traces].slice(0, 100); // Keep last 100
				saveToStorage({ tools: state.tools, traces: newTraces, comparisons: state.comparisons });
				return { ...state, traces: newTraces };
			});
		},

		clearTraces: () => {
			update((state) => {
				saveToStorage({ tools: state.tools, traces: [], comparisons: state.comparisons });
				return { ...state, traces: [] };
			});
		},

		addComparison: (comparison: Omit<ModelComparison, 'id' | 'timestamp'>) => {
			update((state) => {
				const newComparison: ModelComparison = {
					...comparison,
					id: `comparison-${Date.now()}`,
					timestamp: new Date().toISOString()
				};
				const newComparisons = [newComparison, ...state.comparisons].slice(0, 50);
				saveToStorage({ tools: state.tools, traces: state.traces, comparisons: newComparisons });
				return { ...state, comparisons: newComparisons };
			});
		}
	};
}

export const toolsStore = createToolsStore();

// Helper to convert ToolDefinition to Ollama format
export function toOllamaToolFormat(tool: ToolDefinition) {
	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	for (const param of tool.parameters) {
		const prop: Record<string, unknown> = {
			type: param.type,
			description: param.description
		};
		if (param.enum) {
			prop.enum = param.enum;
		}
		if (param.default !== undefined) {
			prop.default = param.default;
		}
		properties[param.name] = prop;

		if (param.required) {
			required.push(param.name);
		}
	}

	return {
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: 'object',
				properties,
				required
			}
		}
	};
}

// Helper to validate JSON schema
export function validateToolSchema(tool: ToolDefinition): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!tool.name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tool.name)) {
		errors.push('Tool name must start with a letter or underscore and contain only alphanumeric characters');
	}

	if (!tool.description) {
		errors.push('Tool description is required');
	}

	for (const param of tool.parameters) {
		if (!param.name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
			errors.push(`Parameter "${param.name}" has invalid name format`);
		}
		if (!param.description) {
			errors.push(`Parameter "${param.name}" is missing description`);
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
