import { writable, derived } from 'svelte/store';

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, {
			type: string;
			description?: string;
			enum?: string[];
			default?: unknown;
		}>;
		required?: string[];
	};
}

export interface MCPResource {
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
}

export interface MCPPrompt {
	name: string;
	description?: string;
	arguments?: {
		name: string;
		description?: string;
		required?: boolean;
	}[];
}

export interface MCPServerConfig {
	id: string;
	name: string;
	description?: string;
	transport: 'stdio' | 'sse' | 'http';
	command?: string; // For stdio
	args?: string[];
	env?: Record<string, string>;
	url?: string; // For sse/http
	enabled: boolean;
	status: 'disconnected' | 'connecting' | 'connected' | 'error';
	lastError?: string;
	tools: MCPTool[];
	resources: MCPResource[];
	prompts: MCPPrompt[];
	createdAt: string;
	updatedAt: string;
}

export interface MCPToolCall {
	id: string;
	serverId: string;
	toolName: string;
	arguments: Record<string, unknown>;
	result?: unknown;
	error?: string;
	latencyMs: number;
	timestamp: string;
	success: boolean;
}

export interface MCPState {
	servers: MCPServerConfig[];
	toolCalls: MCPToolCall[];
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-mcp';

function loadFromStorage(): { servers: MCPServerConfig[]; toolCalls: MCPToolCall[] } {
	if (typeof window === 'undefined') return { servers: [], toolCalls: [] };
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
		return { servers: getDefaultServers(), toolCalls: [] };
	} catch {
		return { servers: getDefaultServers(), toolCalls: [] };
	}
}

function saveToStorage(data: { servers: MCPServerConfig[]; toolCalls: MCPToolCall[] }) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getDefaultServers(): MCPServerConfig[] {
	return [
		{
			id: 'example-filesystem',
			name: 'Filesystem Server',
			description: 'Access and manage local files',
			transport: 'stdio',
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
			enabled: false,
			status: 'disconnected',
			tools: [
				{
					name: 'read_file',
					description: 'Read the contents of a file',
					inputSchema: {
						type: 'object',
						properties: {
							path: { type: 'string', description: 'Path to the file to read' }
						},
						required: ['path']
					}
				},
				{
					name: 'write_file',
					description: 'Write content to a file',
					inputSchema: {
						type: 'object',
						properties: {
							path: { type: 'string', description: 'Path to the file to write' },
							content: { type: 'string', description: 'Content to write' }
						},
						required: ['path', 'content']
					}
				},
				{
					name: 'list_directory',
					description: 'List contents of a directory',
					inputSchema: {
						type: 'object',
						properties: {
							path: { type: 'string', description: 'Path to the directory' }
						},
						required: ['path']
					}
				}
			],
			resources: [],
			prompts: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'example-brave-search',
			name: 'Brave Search',
			description: 'Web search using Brave Search API',
			transport: 'stdio',
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-brave-search'],
			env: { BRAVE_API_KEY: '' },
			enabled: false,
			status: 'disconnected',
			tools: [
				{
					name: 'brave_web_search',
					description: 'Search the web using Brave Search',
					inputSchema: {
						type: 'object',
						properties: {
							query: { type: 'string', description: 'Search query' },
							count: { type: 'number', description: 'Number of results (1-20)' }
						},
						required: ['query']
					}
				}
			],
			resources: [],
			prompts: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'example-memory',
			name: 'Memory Server',
			description: 'Persistent memory and knowledge graph',
			transport: 'stdio',
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-memory'],
			enabled: false,
			status: 'disconnected',
			tools: [
				{
					name: 'create_entities',
					description: 'Create entities in the knowledge graph',
					inputSchema: {
						type: 'object',
						properties: {
							entities: {
								type: 'array',
								description: 'Array of entities to create'
							}
						},
						required: ['entities']
					}
				},
				{
					name: 'search_nodes',
					description: 'Search for entities in the knowledge graph',
					inputSchema: {
						type: 'object',
						properties: {
							query: { type: 'string', description: 'Search query' }
						},
						required: ['query']
					}
				}
			],
			resources: [],
			prompts: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];
}

function createMCPStore() {
	const { subscribe, set, update } = writable<MCPState>({
		servers: [],
		toolCalls: [],
		loading: true,
		error: null
	});

	// Initialize
	if (typeof window !== 'undefined') {
		const data = loadFromStorage();
		set({
			servers: data.servers,
			toolCalls: data.toolCalls,
			loading: false,
			error: null
		});
	}

	return {
		subscribe,

		loadServers: () => {
			const data = loadFromStorage();
			set({
				servers: data.servers,
				toolCalls: data.toolCalls,
				loading: false,
				error: null
			});
		},

		addServer: (server: Omit<MCPServerConfig, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'tools' | 'resources' | 'prompts'>) => {
			update((state) => {
				const newServer: MCPServerConfig = {
					...server,
					id: `mcp-${Date.now()}`,
					status: 'disconnected',
					tools: [],
					resources: [],
					prompts: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newServers = [...state.servers, newServer];
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		updateServer: (id: string, updates: Partial<MCPServerConfig>) => {
			update((state) => {
				const newServers = state.servers.map((s) =>
					s.id === id
						? { ...s, ...updates, updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		deleteServer: (id: string) => {
			update((state) => {
				const newServers = state.servers.filter((s) => s.id !== id);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		duplicateServer: (id: string) => {
			update((state) => {
				const original = state.servers.find((s) => s.id === id);
				if (!original) return state;

				const duplicate: MCPServerConfig = {
					...original,
					id: `mcp-${Date.now()}`,
					name: `${original.name} (copy)`,
					enabled: false,
					status: 'disconnected',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newServers = [...state.servers, duplicate];
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		setServerStatus: (id: string, status: MCPServerConfig['status'], error?: string) => {
			update((state) => {
				const newServers = state.servers.map((s) =>
					s.id === id
						? { ...s, status, lastError: error, updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		setServerTools: (id: string, tools: MCPTool[], resources: MCPResource[], prompts: MCPPrompt[]) => {
			update((state) => {
				const newServers = state.servers.map((s) =>
					s.id === id
						? { ...s, tools, resources, prompts, updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		addToolCall: (call: Omit<MCPToolCall, 'id' | 'timestamp'>) => {
			update((state) => {
				const newCall: MCPToolCall = {
					...call,
					id: `call-${Date.now()}`,
					timestamp: new Date().toISOString()
				};
				const newCalls = [newCall, ...state.toolCalls].slice(0, 100);
				saveToStorage({ servers: state.servers, toolCalls: newCalls });
				return { ...state, toolCalls: newCalls };
			});
		},

		clearToolCalls: () => {
			update((state) => {
				saveToStorage({ servers: state.servers, toolCalls: [] });
				return { ...state, toolCalls: [] };
			});
		},

		addToolToServer: (serverId: string, tool: MCPTool) => {
			update((state) => {
				const newServers = state.servers.map((s) =>
					s.id === serverId
						? { ...s, tools: [...s.tools, tool], updatedAt: new Date().toISOString() }
						: s
				);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		updateToolInServer: (serverId: string, toolName: string, updates: Partial<MCPTool>) => {
			update((state) => {
				const newServers = state.servers.map((s) =>
					s.id === serverId
						? {
								...s,
								tools: s.tools.map((t) =>
									t.name === toolName ? { ...t, ...updates } : t
								),
								updatedAt: new Date().toISOString()
							}
						: s
				);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		},

		deleteToolFromServer: (serverId: string, toolName: string) => {
			update((state) => {
				const newServers = state.servers.map((s) =>
					s.id === serverId
						? {
								...s,
								tools: s.tools.filter((t) => t.name !== toolName),
								updatedAt: new Date().toISOString()
							}
						: s
				);
				saveToStorage({ servers: newServers, toolCalls: state.toolCalls });
				return { ...state, servers: newServers };
			});
		}
	};
}

export const mcpStore = createMCPStore();

// Derived stores
export const enabledServers = derived(
	mcpStore,
	($store) => $store.servers.filter((s) => s.enabled)
);

export const connectedServers = derived(
	mcpStore,
	($store) => $store.servers.filter((s) => s.status === 'connected')
);

export const allTools = derived(
	mcpStore,
	($store) => $store.servers.flatMap((s) => s.tools.map((t) => ({ ...t, serverId: s.id, serverName: s.name })))
);

// Helper to generate MCP tool schema
export function generateMCPToolSchema(tool: MCPTool): object {
	return {
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema
	};
}

// Helper to validate tool input against schema
export function validateToolInput(
	tool: MCPTool,
	input: Record<string, unknown>
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	const schema = tool.inputSchema;

	// Check required fields
	if (schema.required) {
		for (const field of schema.required) {
			if (!(field in input) || input[field] === undefined || input[field] === '') {
				errors.push(`Required field "${field}" is missing`);
			}
		}
	}

	// Check types
	for (const [key, value] of Object.entries(input)) {
		const propSchema = schema.properties[key];
		if (!propSchema) {
			errors.push(`Unknown field "${key}"`);
			continue;
		}

		if (value !== undefined && value !== null && value !== '') {
			const expectedType = propSchema.type;
			const actualType = Array.isArray(value) ? 'array' : typeof value;
			if (expectedType !== actualType) {
				errors.push(`Field "${key}" should be ${expectedType}, got ${actualType}`);
			}

			// Check enum
			if (propSchema.enum && !propSchema.enum.includes(value as string)) {
				errors.push(`Field "${key}" must be one of: ${propSchema.enum.join(', ')}`);
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
