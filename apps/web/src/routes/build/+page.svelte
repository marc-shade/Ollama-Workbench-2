<script lang="ts">
	import { modelsStore } from '$stores/models';
	import {
		workflowStore,
		activeWorkflow,
		activeExecution,
		selectedNode,
		workflowExecutions,
		templateWorkflows,
		userWorkflows,
		getStatusColor,
		getStatusBgColor,
		formatDuration,
		type AgentConfig,
		type WorkflowNode,
		type ExecutionStep
	} from '$stores/workflow';
	import { onMount } from 'svelte';
	import WorkflowCanvas from '$components/workflow/WorkflowCanvas.svelte';
	import {
		Plus,
		Play,
		Save,
		Trash2,
		Bot,
		Wrench,
		MessageSquare,
		Send,
		GitBranch,
		Zap,
		ChevronRight,
		ChevronDown,
		Settings,
		Activity,
		History,
		Layers,
		Copy,
		Pause,
		Square,
		RotateCcw,
		Clock,
		CheckCircle2,
		XCircle,
		AlertCircle,
		Loader2,
		Terminal,
		FileCode2,
		Cpu,
		MemoryStick,
		Sparkles,
		Sliders,
		Code2,
		FolderOpen,
		ArrowRight,
		Eye,
		EyeOff,
		X
	} from 'lucide-svelte';

	let canvas: WorkflowCanvas;

	// UI State
	let activeTab = $state<'design' | 'execute' | 'history'>('design');
	let showNodePalette = $state(true);
	let showAgentDesigner = $state(false);
	let editingAgent = $state<AgentConfig | null>(null);
	let showWorkflowList = $state(true);

	// Form state for agent designer
	let agentForm = $state<Partial<AgentConfig>>({
		name: '',
		model: 'llama3.2',
		systemPrompt: '',
		temperature: 0.7,
		maxTokens: 4096,
		tools: [],
		memory: { enabled: true, type: 'buffer', maxMessages: 10 },
		description: ''
	});

	// Simulated execution state
	let isSimulating = $state(false);
	let simulationInterval: ReturnType<typeof setInterval> | null = null;

	const nodeTypes = [
		{
			category: 'Agents',
			icon: Bot,
			items: [
				{ type: 'agent', label: 'LLM Agent', icon: Bot, data: { label: 'New Agent', model: 'llama3.2', description: 'Configure agent...' } }
			]
		},
		{
			category: 'Tools',
			icon: Wrench,
			items: [
				{ type: 'tool', label: 'Function', icon: Zap, data: { label: 'Function', toolType: 'function', description: 'Custom function' } },
				{ type: 'tool', label: 'MCP Tool', icon: Wrench, data: { label: 'MCP Tool', toolType: 'mcp', description: 'MCP server tool' } }
			]
		},
		{
			category: 'I/O',
			icon: MessageSquare,
			items: [
				{ type: 'input', label: 'Text Input', icon: MessageSquare, data: { label: 'Input', inputType: 'text' } },
				{ type: 'output', label: 'Response', icon: Send, data: { label: 'Output', outputType: 'response' } }
			]
		}
	];

	onMount(() => {
		modelsStore.fetchModels();
		workflowStore.loadData();
	});

	function addNodeToCanvas(type: string, data: Record<string, unknown>) {
		canvas?.addNode(type, data);
	}

	function createNewWorkflow() {
		const id = workflowStore.createWorkflow('Untitled Workflow');
		workflowStore.setActiveWorkflow(id);
	}

	function runWorkflow() {
		if (!$activeWorkflow) return;

		const executionId = workflowStore.startExecution($activeWorkflow.id, { userInput: 'Test input' });
		activeTab = 'execute';

		// Simulate execution for demo
		simulateExecution(executionId);
	}

	function simulateExecution(executionId: string) {
		if (!$activeWorkflow || isSimulating) return;

		isSimulating = true;
		const nodes = $activeWorkflow.nodes ?? [];
		let currentIndex = 0;

		simulationInterval = setInterval(() => {
			if (currentIndex >= nodes.length) {
				clearInterval(simulationInterval!);
				workflowStore.completeExecution(executionId, { result: 'Workflow completed successfully!' });
				isSimulating = false;
				return;
			}

			const node = nodes[currentIndex];

			// Mark current node as running
			workflowStore.updateExecutionStep(executionId, node.id, {
				status: 'running',
				startedAt: new Date().toISOString()
			});
			workflowStore.addExecutionLog(executionId, node.id, {
				level: 'info',
				message: `Starting execution of ${node.data.label}`
			});

			// After a delay, complete the node
			setTimeout(() => {
				const tokens = node.type === 'agent' ? { input: Math.floor(Math.random() * 500) + 100, output: Math.floor(Math.random() * 1000) + 200 } : undefined;
				workflowStore.updateExecutionStep(executionId, node.id, {
					status: 'completed',
					completedAt: new Date().toISOString(),
					durationMs: Math.floor(Math.random() * 2000) + 500,
					tokens,
					output: `Output from ${node.data.label}`
				});
				workflowStore.addExecutionLog(executionId, node.id, {
					level: 'info',
					message: `Completed ${node.data.label}`
				});
			}, 1000);

			currentIndex++;
		}, 1500);
	}

	function cancelExecution() {
		if ($activeExecution) {
			if (simulationInterval) clearInterval(simulationInterval);
			isSimulating = false;
			workflowStore.cancelExecution($activeExecution.id);
		}
	}

	function saveWorkflow() {
		if (!$activeWorkflow) return;
		const workflow = canvas?.getWorkflow();
		if (workflow) {
			workflowStore.updateWorkflow($activeWorkflow.id, {
				nodes: workflow.nodes as WorkflowNode[],
				edges: workflow.edges
			});
		}
	}

	function clearWorkflow() {
		canvas?.clearCanvas();
	}

	function duplicateWorkflow(id: string) {
		const newId = workflowStore.duplicateWorkflow(id);
		if (newId) workflowStore.setActiveWorkflow(newId);
	}

	function openAgentDesigner(agent?: AgentConfig) {
		if (agent) {
			editingAgent = agent;
			agentForm = { ...agent };
		} else {
			editingAgent = null;
			agentForm = {
				name: '',
				model: 'llama3.2',
				systemPrompt: '',
				temperature: 0.7,
				maxTokens: 4096,
				tools: [],
				memory: { enabled: true, type: 'buffer', maxMessages: 10 },
				description: ''
			};
		}
		showAgentDesigner = true;
	}

	function saveAgent() {
		if (!agentForm.name) return;

		if (editingAgent) {
			workflowStore.updateAgentTemplate(editingAgent.id, agentForm as AgentConfig);
		} else {
			workflowStore.addAgentTemplate(agentForm as Omit<AgentConfig, 'id'>);
		}
		showAgentDesigner = false;
	}

	function useAgentTemplate(template: AgentConfig) {
		addNodeToCanvas('agent', {
			label: template.name,
			model: template.model,
			description: template.description,
			systemPrompt: template.systemPrompt,
			config: template
		});
	}

	function getStepIcon(step: ExecutionStep) {
		switch (step.status) {
			case 'pending': return Clock;
			case 'running': return Loader2;
			case 'completed': return CheckCircle2;
			case 'error': return XCircle;
			default: return Clock;
		}
	}

	function selectExecution(id: string) {
		workflowStore.setActiveExecution(id);
	}

	function rerunExecution(execution: typeof $activeExecution) {
		if (!execution) return;
		const newId = workflowStore.startExecution(execution.workflowId, execution.input);
		simulateExecution(newId);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header with Tabs -->
	<div class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
		<div class="flex items-center gap-4">
			<!-- Workflow name -->
			{#if $activeWorkflow}
				<input
					type="text"
					value={$activeWorkflow.name}
					oninput={(e) => workflowStore.updateWorkflow($activeWorkflow!.id, { name: e.currentTarget.value })}
					class="bg-transparent text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring rounded px-2 py-1"
				/>
			{:else}
				<span class="text-lg font-semibold text-muted-foreground">Select or create a workflow</span>
			{/if}

			<!-- Tabs -->
			<div class="flex items-center gap-1 ml-4">
				<button
					onclick={() => (activeTab = 'design')}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors {activeTab === 'design' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
				>
					<Layers class="h-4 w-4" />
					Design
				</button>
				<button
					onclick={() => (activeTab = 'execute')}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors {activeTab === 'execute' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
				>
					<Activity class="h-4 w-4" />
					Execute
				</button>
				<button
					onclick={() => (activeTab = 'history')}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors {activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
				>
					<History class="h-4 w-4" />
					History
				</button>
			</div>
		</div>

		<div class="flex items-center gap-2">
			{#if activeTab === 'design'}
				<button
					onclick={clearWorkflow}
					disabled={!$activeWorkflow}
					class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" />
					Clear
				</button>
				<button
					onclick={saveWorkflow}
					disabled={!$activeWorkflow}
					class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
				>
					<Save class="h-4 w-4" />
					Save
				</button>
			{/if}
			<button
				onclick={runWorkflow}
				disabled={!$activeWorkflow || isSimulating}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
			>
				{#if isSimulating}
					<Loader2 class="h-4 w-4 animate-spin" />
					Running...
				{:else}
					<Play class="h-4 w-4" />
					Run
				{/if}
			</button>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<!-- Left Sidebar - Workflow List -->
		{#if showWorkflowList}
			<div class="w-64 border-r border-border bg-card overflow-y-auto">
				<div class="p-3 border-b border-border">
					<button
						onclick={createNewWorkflow}
						class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
					>
						<Plus class="h-4 w-4" />
						New Workflow
					</button>
				</div>

				<!-- User Workflows -->
				<div class="p-3">
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">My Workflows</h3>
					<div class="space-y-1">
						{#each $userWorkflows as workflow}
							<button
								onclick={() => workflowStore.setActiveWorkflow(workflow.id)}
								class="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors {$activeWorkflow?.id === workflow.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}"
							>
								<GitBranch class="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium truncate">{workflow.name}</p>
									<p class="text-xs text-muted-foreground">{workflow.nodes.length} nodes</p>
								</div>
							</button>
						{/each}
						{#if $userWorkflows.length === 0}
							<p class="text-xs text-muted-foreground px-3 py-2">No workflows yet</p>
						{/if}
					</div>
				</div>

				<!-- Templates -->
				<div class="p-3 border-t border-border">
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Templates</h3>
					<div class="space-y-1">
						{#each $templateWorkflows as workflow}
							<div class="flex items-center gap-1">
								<button
									onclick={() => workflowStore.setActiveWorkflow(workflow.id)}
									class="flex flex-1 items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
								>
									<Sparkles class="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium truncate">{workflow.name}</p>
										<p class="text-xs text-muted-foreground truncate">{workflow.description}</p>
									</div>
								</button>
								<button
									onclick={() => duplicateWorkflow(workflow.id)}
									class="p-1.5 rounded hover:bg-muted"
									title="Use template"
								>
									<Copy class="h-3.5 w-3.5 text-muted-foreground" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Main Content Area -->
		<div class="flex-1 flex flex-col overflow-hidden">
			{#if activeTab === 'design'}
				<!-- Design Tab -->
				<div class="flex flex-1 overflow-hidden">
					<!-- Node Palette -->
					{#if showNodePalette && $activeWorkflow}
						<div class="w-64 border-r border-border bg-card overflow-y-auto">
							<div class="p-4 space-y-4">
								<!-- Node Categories -->
								{#each nodeTypes as category}
									<div>
										<h3 class="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											<category.icon class="h-3 w-3" />
											{category.category}
										</h3>
										<div class="space-y-1">
											{#each category.items as item}
												<button
													onclick={() => addNodeToCanvas(item.type, item.data)}
													class="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted hover:border-primary/50 transition-all"
												>
													<item.icon class="h-4 w-4 text-muted-foreground" />
													<span>{item.label}</span>
													<Plus class="ml-auto h-3 w-3 text-muted-foreground" />
												</button>
											{/each}
										</div>
									</div>
								{/each}

								<!-- Agent Templates -->
								<div class="pt-4 border-t border-border">
									<div class="flex items-center justify-between mb-2">
										<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent Templates</h3>
										<button
											onclick={() => openAgentDesigner()}
											class="p-1 rounded hover:bg-muted"
											title="Create agent template"
										>
											<Plus class="h-3.5 w-3.5 text-muted-foreground" />
										</button>
									</div>
									<div class="space-y-1">
										{#each $workflowStore.agentTemplates as template}
											<div class="flex items-center gap-1 group">
												<button
													onclick={() => useAgentTemplate(template)}
													class="flex flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted hover:border-primary/50 transition-all"
												>
													<Bot class="h-4 w-4 text-primary" />
													<div class="flex-1 min-w-0">
														<p class="text-sm font-medium truncate">{template.name}</p>
														<p class="text-xs text-muted-foreground truncate">{template.model}</p>
													</div>
												</button>
												<button
													onclick={() => openAgentDesigner(template)}
													class="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
													title="Edit template"
												>
													<Settings class="h-3.5 w-3.5 text-muted-foreground" />
												</button>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Canvas -->
					<div class="flex-1">
						{#if $activeWorkflow}
							<WorkflowCanvas
								bind:this={canvas}
								initialNodes={$activeWorkflow.nodes ?? []}
								initialEdges={$activeWorkflow.edges ?? []}
							/>
						{:else}
							<div class="flex items-center justify-center h-full text-muted-foreground">
								<div class="text-center">
									<GitBranch class="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p class="text-lg font-medium">No workflow selected</p>
									<p class="text-sm">Create a new workflow or select one from the list</p>
									<button
										onclick={createNewWorkflow}
										class="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
									>
										<Plus class="h-4 w-4" />
										Create Workflow
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>

			{:else if activeTab === 'execute'}
				<!-- Execute Tab - Execution Monitor -->
				<div class="flex flex-1 overflow-hidden">
					{#if $activeExecution}
						<!-- Execution Steps -->
						<div class="w-80 border-r border-border bg-card overflow-y-auto">
							<div class="p-4 border-b border-border">
								<div class="flex items-center justify-between mb-2">
									<h3 class="font-semibold">Execution Progress</h3>
									{#if $activeExecution.status === 'running'}
										<button
											onclick={cancelExecution}
											class="flex items-center gap-1 px-2 py-1 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20"
										>
											<Square class="h-3 w-3" />
											Stop
										</button>
									{/if}
								</div>
								<div class="flex items-center gap-2 text-sm">
									<span class="{getStatusColor($activeExecution.status)} font-medium capitalize">{$activeExecution.status}</span>
									{#if $activeExecution.totalDurationMs}
										<span class="text-muted-foreground">• {formatDuration($activeExecution.totalDurationMs)}</span>
									{/if}
								</div>
							</div>

							<!-- Steps List -->
							<div class="p-4 space-y-3">
								{#each $activeExecution.steps as step, i}
									{@const StepIcon = getStepIcon(step)}
									<div class="relative">
										{#if i < $activeExecution.steps.length - 1}
											<div class="absolute left-4 top-8 bottom-0 w-0.5 {step.status === 'completed' ? 'bg-green-500' : 'bg-border'}"></div>
										{/if}
										<div class="flex items-start gap-3">
											<div class="{getStatusBgColor(step.status)} rounded-full p-1.5 {step.status === 'running' ? 'animate-pulse' : ''}">
												<StepIcon class="h-3.5 w-3.5 text-white {step.status === 'running' ? 'animate-spin' : ''}" />
											</div>
											<div class="flex-1 min-w-0">
												<p class="font-medium text-sm">{step.nodeName}</p>
												<p class="text-xs text-muted-foreground capitalize">{step.nodeType}</p>
												{#if step.durationMs}
													<p class="text-xs text-muted-foreground mt-1">{formatDuration(step.durationMs)}</p>
												{/if}
												{#if step.tokens}
													<div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
														<span>In: {step.tokens.input}</span>
														<span>Out: {step.tokens.output}</span>
													</div>
												{/if}
												{#if step.error}
													<p class="text-xs text-destructive mt-1">{step.error}</p>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Execution Details -->
						<div class="flex-1 flex flex-col overflow-hidden">
							<!-- Stats Bar -->
							<div class="flex items-center gap-6 p-4 border-b border-border bg-muted/30">
								<div class="flex items-center gap-2">
									<Cpu class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm">
										<span class="font-medium">{$activeExecution.totalTokens.input + $activeExecution.totalTokens.output}</span>
										<span class="text-muted-foreground"> tokens</span>
									</span>
								</div>
								<div class="flex items-center gap-2">
									<Clock class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm">
										{#if $activeExecution.totalDurationMs}
											<span class="font-medium">{formatDuration($activeExecution.totalDurationMs)}</span>
										{:else}
											<span class="text-muted-foreground">Running...</span>
										{/if}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<Activity class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm">
										<span class="font-medium">{$activeExecution.steps.filter(s => s.status === 'completed').length}</span>
										<span class="text-muted-foreground">/{$activeExecution.steps.length} steps</span>
									</span>
								</div>
							</div>

							<!-- Logs Panel -->
							<div class="flex-1 overflow-y-auto p-4">
								<h4 class="font-medium mb-3 flex items-center gap-2">
									<Terminal class="h-4 w-4" />
									Execution Logs
								</h4>
								<div class="space-y-1 font-mono text-sm">
									{#each $activeExecution.steps as step}
										{#each step.logs as log}
											<div class="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50">
												<span class="text-muted-foreground text-xs w-20 flex-shrink-0">
													{new Date(log.timestamp).toLocaleTimeString()}
												</span>
												<span class="w-12 flex-shrink-0 {log.level === 'error' ? 'text-destructive' : log.level === 'warn' ? 'text-yellow-500' : 'text-muted-foreground'} text-xs uppercase">
													{log.level}
												</span>
												<span class="flex-1">{log.message}</span>
											</div>
										{/each}
									{/each}
									{#if $activeExecution.steps.every(s => s.logs.length === 0)}
										<p class="text-muted-foreground text-center py-8">No logs yet</p>
									{/if}
								</div>
							</div>

							<!-- Output Panel -->
							{#if $activeExecution.output}
								<div class="border-t border-border p-4">
									<h4 class="font-medium mb-2">Output</h4>
									<pre class="bg-muted rounded-lg p-3 text-sm overflow-x-auto">{JSON.stringify($activeExecution.output, null, 2)}</pre>
								</div>
							{/if}
						</div>
					{:else}
						<div class="flex-1 flex items-center justify-center text-muted-foreground">
							<div class="text-center">
								<Activity class="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p class="text-lg font-medium">No active execution</p>
								<p class="text-sm">Run a workflow to see execution progress</p>
							</div>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'history'}
				<!-- History Tab -->
				<div class="flex-1 overflow-y-auto p-4">
					<div class="max-w-4xl mx-auto">
						<h2 class="text-lg font-semibold mb-4">Execution History</h2>

						{#if $workflowExecutions.length > 0}
							<div class="space-y-3">
								{#each $workflowExecutions as execution}
									<div
										role="button"
										tabindex="0"
										class="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
										onclick={() => selectExecution(execution.id)}
										onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectExecution(execution.id); } }}
									>
										<div class="{getStatusBgColor(execution.status)} rounded-full p-2">
											{#if execution.status === 'completed'}
												<CheckCircle2 class="h-4 w-4 text-white" />
											{:else if execution.status === 'failed'}
												<XCircle class="h-4 w-4 text-white" />
											{:else if execution.status === 'running'}
												<Loader2 class="h-4 w-4 text-white animate-spin" />
											{:else if execution.status === 'cancelled'}
												<AlertCircle class="h-4 w-4 text-white" />
											{:else}
												<Clock class="h-4 w-4 text-white" />
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<p class="font-medium truncate">{execution.workflowName}</p>
												<span class="{getStatusColor(execution.status)} text-xs font-medium capitalize">{execution.status}</span>
											</div>
											<p class="text-sm text-muted-foreground">
												{new Date(execution.startedAt).toLocaleString()}
												{#if execution.totalDurationMs}
													• {formatDuration(execution.totalDurationMs)}
												{/if}
											</p>
										</div>
										<div class="flex items-center gap-4 text-sm text-muted-foreground">
											<span>{execution.totalTokens.input + execution.totalTokens.output} tokens</span>
											<span>{execution.steps.length} steps</span>
										</div>
										<div class="flex items-center gap-1">
											<button
												onclick={(e) => { e.stopPropagation(); rerunExecution(execution); }}
												class="p-2 rounded hover:bg-muted"
												title="Re-run"
											>
												<RotateCcw class="h-4 w-4" />
											</button>
											<button
												onclick={(e) => { e.stopPropagation(); workflowStore.deleteExecution(execution.id); }}
												class="p-2 rounded hover:bg-muted text-destructive"
												title="Delete"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-center py-12 text-muted-foreground">
								<History class="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p class="text-lg font-medium">No execution history</p>
								<p class="text-sm">Run workflows to see their history here</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Agent Designer Modal -->
{#if showAgentDesigner}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
			<div class="flex items-center justify-between p-4 border-b border-border">
				<h2 class="text-lg font-semibold">
					{editingAgent ? 'Edit Agent Template' : 'Create Agent Template'}
				</h2>
				<button onclick={() => (showAgentDesigner = false)} class="p-1 rounded hover:bg-muted">
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
				<!-- Name -->
				<div>
					<label for="agent-name" class="block text-sm font-medium mb-1">Name</label>
					<input
						id="agent-name"
						type="text"
						bind:value={agentForm.name}
						placeholder="Agent name"
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="agent-description" class="block text-sm font-medium mb-1">Description</label>
					<input
						id="agent-description"
						type="text"
						bind:value={agentForm.description}
						placeholder="What does this agent do?"
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>

				<!-- Model -->
				<div>
					<label for="agent-model" class="block text-sm font-medium mb-1">Model</label>
					<select
						id="agent-model"
						bind:value={agentForm.model}
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
					>
						{#each $modelsStore.models as model}
							<option value={model.name}>{model.name}</option>
						{/each}
						{#if $modelsStore.models.length === 0}
							<option value="llama3.2">llama3.2</option>
						{/if}
					</select>
				</div>

				<!-- System Prompt -->
				<div>
					<label for="agent-system-prompt" class="block text-sm font-medium mb-1">System Prompt</label>
					<textarea
						id="agent-system-prompt"
						bind:value={agentForm.systemPrompt}
						placeholder="Instructions for the agent..."
						rows={4}
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
					></textarea>
				</div>

				<!-- Parameters -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="agent-temperature" class="block text-sm font-medium mb-1">Temperature</label>
						<div class="flex items-center gap-2">
							<input
								id="agent-temperature"
								type="range"
								min="0"
								max="2"
								step="0.1"
								bind:value={agentForm.temperature}
								class="flex-1"
							/>
							<span class="text-sm w-10 text-right">{agentForm.temperature}</span>
						</div>
					</div>
					<div>
						<label for="agent-max-tokens" class="block text-sm font-medium mb-1">Max Tokens</label>
						<input
							id="agent-max-tokens"
							type="number"
							bind:value={agentForm.maxTokens}
							min="256"
							max="32768"
							step="256"
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
						/>
					</div>
				</div>

				<!-- Memory -->
				<div class="p-3 rounded-lg border border-border bg-muted/30">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium">Memory</span>
						<button
							onclick={() => agentForm.memory = { ...agentForm.memory!, enabled: !agentForm.memory?.enabled }}
							class="text-xs px-2 py-1 rounded {agentForm.memory?.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted'}"
						>
							{agentForm.memory?.enabled ? 'Enabled' : 'Disabled'}
						</button>
					</div>
					{#if agentForm.memory?.enabled}
						<div class="grid grid-cols-2 gap-3 mt-3">
							<div>
								<label for="agent-memory-type" class="block text-xs text-muted-foreground mb-1">Type</label>
								<select
									id="agent-memory-type"
									bind:value={agentForm.memory!.type}
									class="w-full rounded border border-input bg-background px-2 py-1 text-sm"
								>
									<option value="buffer">Buffer</option>
									<option value="summary">Summary</option>
									<option value="vector">Vector</option>
								</select>
							</div>
							{#if agentForm.memory?.type === 'buffer'}
								<div>
									<label for="agent-max-messages" class="block text-xs text-muted-foreground mb-1">Max Messages</label>
									<input
										id="agent-max-messages"
										type="number"
										bind:value={agentForm.memory!.maxMessages}
										min="1"
										max="100"
										class="w-full rounded border border-input bg-background px-2 py-1 text-sm"
									/>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 p-4 border-t border-border">
				<button
					onclick={() => (showAgentDesigner = false)}
					class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					onclick={saveAgent}
					disabled={!agentForm.name}
					class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
				>
					{editingAgent ? 'Save Changes' : 'Create Agent'}
				</button>
			</div>
		</div>
	</div>
{/if}
