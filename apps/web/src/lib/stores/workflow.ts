import { writable, derived } from 'svelte/store';

export type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'error';

export interface AgentConfig {
	id: string;
	name: string;
	model: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	tools: string[];
	memory: {
		enabled: boolean;
		type: 'buffer' | 'summary' | 'vector';
		maxMessages?: number;
	};
	description: string;
}

export interface ToolConfig {
	id: string;
	name: string;
	type: 'function' | 'mcp';
	mcpServer?: string;
	mcpTool?: string;
	functionCode?: string;
	parameters?: Record<string, unknown>;
	description: string;
}

export interface WorkflowNode {
	id: string;
	type: 'agent' | 'tool' | 'input' | 'output' | 'conditional' | 'loop';
	position: { x: number; y: number };
	data: {
		label: string;
		config?: AgentConfig | ToolConfig;
		[key: string]: unknown;
	};
}

export interface WorkflowEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
	label?: string;
	animated?: boolean;
}

export interface ExecutionStep {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	status: NodeStatus;
	startedAt?: string;
	completedAt?: string;
	durationMs?: number;
	input?: unknown;
	output?: unknown;
	error?: string;
	tokens?: {
		input: number;
		output: number;
	};
	logs: ExecutionLog[];
}

export interface ExecutionLog {
	timestamp: string;
	level: 'info' | 'warn' | 'error' | 'debug';
	message: string;
	data?: unknown;
}

export interface WorkflowExecution {
	id: string;
	workflowId: string;
	workflowName: string;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	startedAt: string;
	completedAt?: string;
	totalDurationMs?: number;
	steps: ExecutionStep[];
	input?: unknown;
	output?: unknown;
	error?: string;
	totalTokens: {
		input: number;
		output: number;
	};
}

export interface Workflow {
	id: string;
	name: string;
	description: string;
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	createdAt: string;
	updatedAt: string;
	lastExecutedAt?: string;
	executionCount: number;
	tags: string[];
	isTemplate: boolean;
}

export interface WorkflowState {
	workflows: Workflow[];
	activeWorkflowId: string | null;
	executions: WorkflowExecution[];
	activeExecutionId: string | null;
	agentTemplates: AgentConfig[];
	selectedNodeId: string | null;
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'ollama-workbench-workflows';

function getDefaultAgentTemplates(): AgentConfig[] {
	return [
		{
			id: 'template-researcher',
			name: 'Researcher',
			model: 'llama3.2',
			systemPrompt: 'You are a research assistant. Analyze information, find patterns, and provide detailed insights.',
			temperature: 0.7,
			maxTokens: 4096,
			tools: [],
			memory: { enabled: true, type: 'buffer', maxMessages: 10 },
			description: 'Gathers and analyzes information'
		},
		{
			id: 'template-writer',
			name: 'Writer',
			model: 'llama3.2',
			systemPrompt: 'You are a skilled writer. Create clear, engaging, and well-structured content.',
			temperature: 0.8,
			maxTokens: 4096,
			tools: [],
			memory: { enabled: true, type: 'buffer', maxMessages: 5 },
			description: 'Creates content based on input'
		},
		{
			id: 'template-coder',
			name: 'Coder',
			model: 'qwen2.5-coder:14b',
			systemPrompt: 'You are an expert programmer. Write clean, efficient, and well-documented code.',
			temperature: 0.3,
			maxTokens: 8192,
			tools: [],
			memory: { enabled: false, type: 'buffer' },
			description: 'Writes and reviews code'
		},
		{
			id: 'template-critic',
			name: 'Critic',
			model: 'llama3.2',
			systemPrompt: 'You are a critical reviewer. Analyze content for accuracy, clarity, and potential improvements.',
			temperature: 0.5,
			maxTokens: 2048,
			tools: [],
			memory: { enabled: true, type: 'summary' },
			description: 'Reviews and improves content'
		},
		{
			id: 'template-orchestrator',
			name: 'Orchestrator',
			model: 'llama3.2',
			systemPrompt: 'You coordinate multi-agent workflows. Delegate tasks, synthesize results, and ensure coherent outputs.',
			temperature: 0.6,
			maxTokens: 4096,
			tools: [],
			memory: { enabled: true, type: 'buffer', maxMessages: 20 },
			description: 'Coordinates multi-agent tasks'
		}
	];
}

function getDefaultWorkflows(): Workflow[] {
	return [
		{
			id: 'workflow-research',
			name: 'Research Pipeline',
			description: 'Multi-agent research and synthesis workflow',
			nodes: [
				{
					id: 'input-1',
					type: 'input',
					position: { x: 50, y: 150 },
					data: { label: 'Research Topic', inputType: 'text' }
				},
				{
					id: 'agent-researcher',
					type: 'agent',
					position: { x: 300, y: 100 },
					data: {
						label: 'Researcher',
						model: 'llama3.2',
						description: 'Gathers and analyzes information'
					}
				},
				{
					id: 'agent-writer',
					type: 'agent',
					position: { x: 300, y: 250 },
					data: {
						label: 'Writer',
						model: 'llama3.2',
						description: 'Creates content based on research'
					}
				},
				{
					id: 'output-1',
					type: 'output',
					position: { x: 550, y: 175 },
					data: { label: 'Final Report', outputType: 'response' }
				}
			],
			edges: [
				{ id: 'e1', source: 'input-1', target: 'agent-researcher', animated: true },
				{ id: 'e2', source: 'agent-researcher', target: 'agent-writer', animated: true },
				{ id: 'e3', source: 'agent-writer', target: 'output-1', animated: true }
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			executionCount: 0,
			tags: ['research', 'multi-agent'],
			isTemplate: true
		}
	];
}

function loadFromStorage(): Partial<WorkflowState> {
	if (typeof window === 'undefined') {
		return {
			workflows: getDefaultWorkflows(),
			executions: [],
			agentTemplates: getDefaultAgentTemplates()
		};
	}
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const data = JSON.parse(stored);
			return {
				workflows: data.workflows?.length ? data.workflows : getDefaultWorkflows(),
				executions: data.executions || [],
				agentTemplates: data.agentTemplates?.length ? data.agentTemplates : getDefaultAgentTemplates()
			};
		}
	} catch {
		// Ignore parse errors
	}
	return {
		workflows: getDefaultWorkflows(),
		executions: [],
		agentTemplates: getDefaultAgentTemplates()
	};
}

function saveToStorage(data: { workflows: Workflow[]; executions: WorkflowExecution[]; agentTemplates: AgentConfig[] }) {
	if (typeof window === 'undefined') return;
	// Limit executions to prevent storage bloat
	const recentExecutions = data.executions.slice(0, 50);
	localStorage.setItem(STORAGE_KEY, JSON.stringify({
		workflows: data.workflows,
		executions: recentExecutions,
		agentTemplates: data.agentTemplates
	}));
}

function createWorkflowStore() {
	const initial = loadFromStorage();

	const { subscribe, set, update } = writable<WorkflowState>({
		workflows: initial.workflows || [],
		activeWorkflowId: null,
		executions: initial.executions || [],
		activeExecutionId: null,
		agentTemplates: initial.agentTemplates || [],
		selectedNodeId: null,
		loading: false,
		error: null
	});

	return {
		subscribe,

		loadData: () => {
			const data = loadFromStorage();
			update((state) => ({
				...state,
				workflows: data.workflows || [],
				executions: data.executions || [],
				agentTemplates: data.agentTemplates || [],
				loading: false
			}));
		},

		// Workflow CRUD
		createWorkflow: (name: string, description: string = ''): string => {
			const id = `workflow-${Date.now()}`;
			update((state) => {
				const newWorkflow: Workflow = {
					id,
					name,
					description,
					nodes: [],
					edges: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					executionCount: 0,
					tags: [],
					isTemplate: false
				};
				const newWorkflows = [newWorkflow, ...state.workflows];
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows, activeWorkflowId: id };
			});
			return id;
		},

		updateWorkflow: (id: string, updates: Partial<Workflow>) => {
			update((state) => {
				const newWorkflows = state.workflows.map((w) =>
					w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
				);
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows };
			});
		},

		deleteWorkflow: (id: string) => {
			update((state) => {
				const newWorkflows = state.workflows.filter((w) => w.id !== id);
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return {
					...state,
					workflows: newWorkflows,
					activeWorkflowId: state.activeWorkflowId === id ? null : state.activeWorkflowId
				};
			});
		},

		setActiveWorkflow: (id: string | null) => {
			update((state) => ({ ...state, activeWorkflowId: id, selectedNodeId: null }));
		},

		duplicateWorkflow: (id: string): string | null => {
			let newId: string | null = null;
			update((state) => {
				const workflow = state.workflows.find((w) => w.id === id);
				if (!workflow) return state;

				newId = `workflow-${Date.now()}`;
				const newWorkflow: Workflow = {
					...workflow,
					id: newId,
					name: `${workflow.name} (Copy)`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					executionCount: 0,
					isTemplate: false
				};
				const newWorkflows = [newWorkflow, ...state.workflows];
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows };
			});
			return newId;
		},

		// Node operations
		addNode: (workflowId: string, node: Omit<WorkflowNode, 'id'>) => {
			const nodeId = `${node.type}-${Date.now()}`;
			update((state) => {
				const newWorkflows = state.workflows.map((w) => {
					if (w.id !== workflowId) return w;
					return {
						...w,
						nodes: [...w.nodes, { ...node, id: nodeId }],
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows, selectedNodeId: nodeId };
			});
			return nodeId;
		},

		updateNode: (workflowId: string, nodeId: string, updates: Partial<WorkflowNode>) => {
			update((state) => {
				const newWorkflows = state.workflows.map((w) => {
					if (w.id !== workflowId) return w;
					return {
						...w,
						nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows };
			});
		},

		deleteNode: (workflowId: string, nodeId: string) => {
			update((state) => {
				const newWorkflows = state.workflows.map((w) => {
					if (w.id !== workflowId) return w;
					return {
						...w,
						nodes: w.nodes.filter((n) => n.id !== nodeId),
						edges: w.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return {
					...state,
					workflows: newWorkflows,
					selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
				};
			});
		},

		selectNode: (nodeId: string | null) => {
			update((state) => ({ ...state, selectedNodeId: nodeId }));
		},

		// Edge operations
		addEdge: (workflowId: string, edge: Omit<WorkflowEdge, 'id'>) => {
			const edgeId = `edge-${edge.source}-${edge.target}-${Date.now()}`;
			update((state) => {
				const newWorkflows = state.workflows.map((w) => {
					if (w.id !== workflowId) return w;
					// Prevent duplicate edges
					const exists = w.edges.some((e) => e.source === edge.source && e.target === edge.target);
					if (exists) return w;
					return {
						...w,
						edges: [...w.edges, { ...edge, id: edgeId, animated: true }],
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows };
			});
			return edgeId;
		},

		deleteEdge: (workflowId: string, edgeId: string) => {
			update((state) => {
				const newWorkflows = state.workflows.map((w) => {
					if (w.id !== workflowId) return w;
					return {
						...w,
						edges: w.edges.filter((e) => e.id !== edgeId),
						updatedAt: new Date().toISOString()
					};
				});
				saveToStorage({ workflows: newWorkflows, executions: state.executions, agentTemplates: state.agentTemplates });
				return { ...state, workflows: newWorkflows };
			});
		},

		// Execution operations
		startExecution: (workflowId: string, input?: unknown): string => {
			const executionId = `exec-${Date.now()}`;
			update((state) => {
				const workflow = state.workflows.find((w) => w.id === workflowId);
				if (!workflow) return state;

				const steps: ExecutionStep[] = workflow.nodes.map((node) => ({
					nodeId: node.id,
					nodeName: node.data.label,
					nodeType: node.type,
					status: 'pending',
					logs: []
				}));

				const newExecution: WorkflowExecution = {
					id: executionId,
					workflowId,
					workflowName: workflow.name,
					status: 'running',
					startedAt: new Date().toISOString(),
					steps,
					input,
					totalTokens: { input: 0, output: 0 }
				};

				const newExecutions = [newExecution, ...state.executions];
				const newWorkflows = state.workflows.map((w) =>
					w.id === workflowId
						? { ...w, executionCount: w.executionCount + 1, lastExecutedAt: new Date().toISOString() }
						: w
				);

				saveToStorage({ workflows: newWorkflows, executions: newExecutions, agentTemplates: state.agentTemplates });
				return {
					...state,
					workflows: newWorkflows,
					executions: newExecutions,
					activeExecutionId: executionId
				};
			});
			return executionId;
		},

		updateExecutionStep: (executionId: string, nodeId: string, updates: Partial<ExecutionStep>) => {
			update((state) => {
				const newExecutions = state.executions.map((e) => {
					if (e.id !== executionId) return e;
					const newSteps = e.steps.map((s) =>
						s.nodeId === nodeId ? { ...s, ...updates } : s
					);
					// Calculate totals
					let totalInputTokens = 0;
					let totalOutputTokens = 0;
					newSteps.forEach((s) => {
						if (s.tokens) {
							totalInputTokens += s.tokens.input;
							totalOutputTokens += s.tokens.output;
						}
					});
					return {
						...e,
						steps: newSteps,
						totalTokens: { input: totalInputTokens, output: totalOutputTokens }
					};
				});
				return { ...state, executions: newExecutions };
			});
		},

		addExecutionLog: (executionId: string, nodeId: string, log: Omit<ExecutionLog, 'timestamp'>) => {
			update((state) => {
				const newExecutions = state.executions.map((e) => {
					if (e.id !== executionId) return e;
					const newSteps = e.steps.map((s) => {
						if (s.nodeId !== nodeId) return s;
						return {
							...s,
							logs: [...s.logs, { ...log, timestamp: new Date().toISOString() }]
						};
					});
					return { ...e, steps: newSteps };
				});
				return { ...state, executions: newExecutions };
			});
		},

		completeExecution: (executionId: string, output?: unknown, error?: string) => {
			update((state) => {
				const newExecutions = state.executions.map((e) => {
					if (e.id !== executionId) return e;
					const completedAt = new Date().toISOString();
					const startedAt = new Date(e.startedAt).getTime();
					const totalDurationMs = new Date(completedAt).getTime() - startedAt;
					return {
						...e,
						status: error ? 'failed' : 'completed',
						completedAt,
						totalDurationMs,
						output,
						error
					} as WorkflowExecution;
				});
				saveToStorage({
					workflows: state.workflows,
					executions: newExecutions,
					agentTemplates: state.agentTemplates
				});
				return { ...state, executions: newExecutions };
			});
		},

		cancelExecution: (executionId: string) => {
			update((state) => {
				const newExecutions = state.executions.map((e) => {
					if (e.id !== executionId) return e;
					return { ...e, status: 'cancelled', completedAt: new Date().toISOString() } as WorkflowExecution;
				});
				saveToStorage({
					workflows: state.workflows,
					executions: newExecutions,
					agentTemplates: state.agentTemplates
				});
				return { ...state, executions: newExecutions };
			});
		},

		setActiveExecution: (id: string | null) => {
			update((state) => ({ ...state, activeExecutionId: id }));
		},

		deleteExecution: (id: string) => {
			update((state) => {
				const newExecutions = state.executions.filter((e) => e.id !== id);
				saveToStorage({
					workflows: state.workflows,
					executions: newExecutions,
					agentTemplates: state.agentTemplates
				});
				return {
					...state,
					executions: newExecutions,
					activeExecutionId: state.activeExecutionId === id ? null : state.activeExecutionId
				};
			});
		},

		// Agent templates
		addAgentTemplate: (template: Omit<AgentConfig, 'id'>) => {
			update((state) => {
				const newTemplate = { ...template, id: `agent-template-${Date.now()}` };
				const newTemplates = [newTemplate, ...state.agentTemplates];
				saveToStorage({
					workflows: state.workflows,
					executions: state.executions,
					agentTemplates: newTemplates
				});
				return { ...state, agentTemplates: newTemplates };
			});
		},

		updateAgentTemplate: (id: string, updates: Partial<AgentConfig>) => {
			update((state) => {
				const newTemplates = state.agentTemplates.map((t) =>
					t.id === id ? { ...t, ...updates } : t
				);
				saveToStorage({
					workflows: state.workflows,
					executions: state.executions,
					agentTemplates: newTemplates
				});
				return { ...state, agentTemplates: newTemplates };
			});
		},

		deleteAgentTemplate: (id: string) => {
			update((state) => {
				const newTemplates = state.agentTemplates.filter((t) => t.id !== id);
				saveToStorage({
					workflows: state.workflows,
					executions: state.executions,
					agentTemplates: newTemplates
				});
				return { ...state, agentTemplates: newTemplates };
			});
		}
	};
}

export const workflowStore = createWorkflowStore();

// Derived stores
export const activeWorkflow = derived(
	workflowStore,
	($store) => $store.workflows.find((w) => w.id === $store.activeWorkflowId) || null
);

export const activeExecution = derived(
	workflowStore,
	($store) => $store.executions.find((e) => e.id === $store.activeExecutionId) || null
);

export const selectedNode = derived(
	[workflowStore, activeWorkflow],
	([$store, $workflow]) => {
		if (!$workflow || !$store.selectedNodeId) return null;
		return $workflow.nodes.find((n) => n.id === $store.selectedNodeId) || null;
	}
);

export const workflowExecutions = derived(
	[workflowStore, activeWorkflow],
	([$store, $workflow]) => {
		if (!$workflow) return [];
		return $store.executions.filter((e) => e.workflowId === $workflow.id);
	}
);

export const templateWorkflows = derived(
	workflowStore,
	($store) => $store.workflows.filter((w) => w.isTemplate)
);

export const userWorkflows = derived(
	workflowStore,
	($store) => $store.workflows.filter((w) => !w.isTemplate)
);

// Helper functions
export function getStatusColor(status: NodeStatus | WorkflowExecution['status']): string {
	switch (status) {
		case 'pending':
			return 'text-muted-foreground';
		case 'running':
			return 'text-blue-500';
		case 'completed':
			return 'text-green-500';
		case 'failed':
		case 'error':
			return 'text-destructive';
		case 'cancelled':
			return 'text-yellow-500';
		default:
			return 'text-muted-foreground';
	}
}

export function getStatusBgColor(status: NodeStatus | WorkflowExecution['status']): string {
	switch (status) {
		case 'pending':
			return 'bg-muted';
		case 'running':
			return 'bg-blue-500';
		case 'completed':
			return 'bg-green-500';
		case 'failed':
		case 'error':
			return 'bg-destructive';
		case 'cancelled':
			return 'bg-yellow-500';
		default:
			return 'bg-muted';
	}
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}
