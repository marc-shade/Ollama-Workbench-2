import { writable, derived } from 'svelte/store';

export type RuntimeType = 'python' | 'node' | 'bash';

export interface ExecutionOutput {
	type: 'stdout' | 'stderr' | 'result' | 'error' | 'plot' | 'table' | 'html';
	content: string;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

export interface CodeExecution {
	id: string;
	name: string;
	runtime: RuntimeType;
	code: string;
	outputs: ExecutionOutput[];
	status: 'idle' | 'running' | 'completed' | 'error';
	startedAt?: string;
	completedAt?: string;
	executionTimeMs?: number;
	error?: string;
}

export interface CodeSnippet {
	id: string;
	name: string;
	description: string;
	runtime: RuntimeType;
	code: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface SandboxEnvironment {
	id: string;
	name: string;
	runtime: RuntimeType;
	version: string;
	packages: string[];
	envVars: Record<string, string>;
	isDefault: boolean;
	createdAt: string;
}

export interface SandboxConfig {
	timeout: number; // seconds
	maxOutputSize: number; // bytes
	autoSave: boolean;
	showLineNumbers: boolean;
	fontSize: number;
	theme: 'dark' | 'light';
}

export interface SandboxState {
	executions: CodeExecution[];
	snippets: CodeSnippet[];
	environments: SandboxEnvironment[];
	activeExecutionId: string | null;
	config: SandboxConfig;
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-sandbox';

function getDefaultConfig(): SandboxConfig {
	return {
		timeout: 30,
		maxOutputSize: 1024 * 1024, // 1MB
		autoSave: true,
		showLineNumbers: true,
		fontSize: 14,
		theme: 'dark'
	};
}

function getDefaultEnvironments(): SandboxEnvironment[] {
	return [
		{
			id: 'env-python-default',
			name: 'Python 3',
			runtime: 'python',
			version: '3.11',
			packages: ['numpy', 'pandas', 'matplotlib'],
			envVars: {},
			isDefault: true,
			createdAt: new Date().toISOString()
		},
		{
			id: 'env-node-default',
			name: 'Node.js',
			runtime: 'node',
			version: '20',
			packages: [],
			envVars: {},
			isDefault: true,
			createdAt: new Date().toISOString()
		},
		{
			id: 'env-bash-default',
			name: 'Bash Shell',
			runtime: 'bash',
			version: '5.0',
			packages: [],
			envVars: {},
			isDefault: true,
			createdAt: new Date().toISOString()
		}
	];
}

function getDefaultSnippets(): CodeSnippet[] {
	return [
		{
			id: 'snippet-python-hello',
			name: 'Hello World',
			description: 'Simple Python hello world',
			runtime: 'python',
			code: 'print("Hello, World!")',
			tags: ['basics', 'hello'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'snippet-python-plot',
			name: 'Simple Plot',
			description: 'Create a matplotlib plot',
			runtime: 'python',
			code: `import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(10, 6))
plt.plot(x, y)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)
plt.show()`,
			tags: ['visualization', 'matplotlib'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'snippet-python-data',
			name: 'Data Analysis',
			description: 'Basic pandas data analysis',
			runtime: 'python',
			code: `import pandas as pd
import numpy as np

# Create sample data
data = {
    'name': ['Alice', 'Bob', 'Charlie', 'David'],
    'age': [25, 30, 35, 28],
    'score': [85, 92, 78, 95]
}

df = pd.DataFrame(data)
print("Data Summary:")
print(df.describe())
print("\\nMean age:", df['age'].mean())
print("Max score:", df['score'].max())`,
			tags: ['data', 'pandas'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'snippet-node-hello',
			name: 'Hello World',
			description: 'Simple Node.js hello world',
			runtime: 'node',
			code: 'console.log("Hello, World!");',
			tags: ['basics', 'hello'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'snippet-node-fetch',
			name: 'HTTP Request',
			description: 'Make an HTTP request',
			runtime: 'node',
			code: `// Using built-in fetch (Node 18+)
const response = await fetch('https://api.github.com/users/github');
const data = await response.json();
console.log('GitHub user:', data.login);
console.log('Public repos:', data.public_repos);`,
			tags: ['http', 'async'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'snippet-bash-system',
			name: 'System Info',
			description: 'Display system information',
			runtime: 'bash',
			code: `echo "System Information"
echo "=================="
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime -p)"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2}')"`,
			tags: ['system', 'info'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];
}

function loadFromStorage(): {
	executions: CodeExecution[];
	snippets: CodeSnippet[];
	environments: SandboxEnvironment[];
	config: SandboxConfig;
} {
	if (typeof window === 'undefined') {
		return {
			executions: [],
			snippets: getDefaultSnippets(),
			environments: getDefaultEnvironments(),
			config: getDefaultConfig()
		};
	}
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const data = JSON.parse(stored);
			return {
				executions: data.executions || [],
				snippets: data.snippets?.length ? data.snippets : getDefaultSnippets(),
				environments: data.environments?.length ? data.environments : getDefaultEnvironments(),
				config: { ...getDefaultConfig(), ...data.config }
			};
		}
		return {
			executions: [],
			snippets: getDefaultSnippets(),
			environments: getDefaultEnvironments(),
			config: getDefaultConfig()
		};
	} catch {
		return {
			executions: [],
			snippets: getDefaultSnippets(),
			environments: getDefaultEnvironments(),
			config: getDefaultConfig()
		};
	}
}

function saveToStorage(data: {
	executions: CodeExecution[];
	snippets: CodeSnippet[];
	environments: SandboxEnvironment[];
	config: SandboxConfig;
}) {
	if (typeof window === 'undefined') return;
	// Don't save outputs to avoid storage bloat
	const sanitized = {
		...data,
		executions: data.executions.map(e => ({
			...e,
			outputs: [] // Clear outputs before saving
		}))
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

function createSandboxStore() {
	const { subscribe, set, update } = writable<SandboxState>({
		executions: [],
		snippets: [],
		environments: [],
		activeExecutionId: null,
		config: getDefaultConfig(),
		loading: true,
		error: null
	});

	// Initialize
	if (typeof window !== 'undefined') {
		const data = loadFromStorage();
		set({
			executions: data.executions,
			snippets: data.snippets,
			environments: data.environments,
			activeExecutionId: null,
			config: data.config,
			loading: false,
			error: null
		});
	}

	return {
		subscribe,

		loadData: () => {
			const data = loadFromStorage();
			set({
				executions: data.executions,
				snippets: data.snippets,
				environments: data.environments,
				activeExecutionId: null,
				config: data.config,
				loading: false,
				error: null
			});
		},

		createExecution: (name: string, runtime: RuntimeType, code: string = ''): string => {
			const id = `exec-${Date.now()}`;
			update((state) => {
				const newExecution: CodeExecution = {
					id,
					name,
					runtime,
					code,
					outputs: [],
					status: 'idle'
				};
				const newExecutions = [newExecution, ...state.executions];
				saveToStorage({
					executions: newExecutions,
					snippets: state.snippets,
					environments: state.environments,
					config: state.config
				});
				return { ...state, executions: newExecutions, activeExecutionId: id };
			});
			return id;
		},

		updateExecution: (id: string, updates: Partial<CodeExecution>) => {
			update((state) => {
				const newExecutions = state.executions.map((e) =>
					e.id === id ? { ...e, ...updates } : e
				);
				saveToStorage({
					executions: newExecutions,
					snippets: state.snippets,
					environments: state.environments,
					config: state.config
				});
				return { ...state, executions: newExecutions };
			});
		},

		deleteExecution: (id: string) => {
			update((state) => {
				const newExecutions = state.executions.filter((e) => e.id !== id);
				saveToStorage({
					executions: newExecutions,
					snippets: state.snippets,
					environments: state.environments,
					config: state.config
				});
				return {
					...state,
					executions: newExecutions,
					activeExecutionId: state.activeExecutionId === id ? null : state.activeExecutionId
				};
			});
		},

		setActiveExecution: (id: string | null) => {
			update((state) => ({ ...state, activeExecutionId: id }));
		},

		addOutput: (executionId: string, output: Omit<ExecutionOutput, 'timestamp'>) => {
			update((state) => {
				const newExecutions = state.executions.map((e) => {
					if (e.id !== executionId) return e;
					return {
						...e,
						outputs: [...e.outputs, { ...output, timestamp: new Date().toISOString() }]
					};
				});
				return { ...state, executions: newExecutions };
			});
		},

		clearOutputs: (executionId: string) => {
			update((state) => {
				const newExecutions = state.executions.map((e) =>
					e.id === executionId ? { ...e, outputs: [] } : e
				);
				return { ...state, executions: newExecutions };
			});
		},

		// Snippets
		addSnippet: (snippet: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt'>) => {
			update((state) => {
				const newSnippet: CodeSnippet = {
					...snippet,
					id: `snippet-${Date.now()}`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				const newSnippets = [newSnippet, ...state.snippets];
				saveToStorage({
					executions: state.executions,
					snippets: newSnippets,
					environments: state.environments,
					config: state.config
				});
				return { ...state, snippets: newSnippets };
			});
		},

		updateSnippet: (id: string, updates: Partial<CodeSnippet>) => {
			update((state) => {
				const newSnippets = state.snippets.map((s) =>
					s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
				);
				saveToStorage({
					executions: state.executions,
					snippets: newSnippets,
					environments: state.environments,
					config: state.config
				});
				return { ...state, snippets: newSnippets };
			});
		},

		deleteSnippet: (id: string) => {
			update((state) => {
				const newSnippets = state.snippets.filter((s) => s.id !== id);
				saveToStorage({
					executions: state.executions,
					snippets: newSnippets,
					environments: state.environments,
					config: state.config
				});
				return { ...state, snippets: newSnippets };
			});
		},

		// Config
		updateConfig: (updates: Partial<SandboxConfig>) => {
			update((state) => {
				const newConfig = { ...state.config, ...updates };
				saveToStorage({
					executions: state.executions,
					snippets: state.snippets,
					environments: state.environments,
					config: newConfig
				});
				return { ...state, config: newConfig };
			});
		}
	};
}

export const sandboxStore = createSandboxStore();

// Derived stores
export const activeExecution = derived(
	sandboxStore,
	($store) => $store.executions.find((e) => e.id === $store.activeExecutionId) || null
);

export const pythonSnippets = derived(
	sandboxStore,
	($store) => $store.snippets.filter((s) => s.runtime === 'python')
);

export const nodeSnippets = derived(
	sandboxStore,
	($store) => $store.snippets.filter((s) => s.runtime === 'node')
);

export const bashSnippets = derived(
	sandboxStore,
	($store) => $store.snippets.filter((s) => s.runtime === 'bash')
);

// Helper functions
export function getRuntimeIcon(runtime: RuntimeType): string {
	switch (runtime) {
		case 'python': return 'FileCode2';
		case 'node': return 'Braces';
		case 'bash': return 'Terminal';
		default: return 'Code';
	}
}

export function getRuntimeLabel(runtime: RuntimeType): string {
	switch (runtime) {
		case 'python': return 'Python';
		case 'node': return 'Node.js';
		case 'bash': return 'Bash';
		default: return runtime;
	}
}

export function getRuntimeColor(runtime: RuntimeType): string {
	switch (runtime) {
		case 'python': return 'text-yellow-500';
		case 'node': return 'text-green-500';
		case 'bash': return 'text-blue-500';
		default: return 'text-muted-foreground';
	}
}
