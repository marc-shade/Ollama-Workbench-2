<script lang="ts">
	import { onMount } from 'svelte';
	import { toolsStore, toOllamaToolFormat, validateToolSchema, type ToolDefinition, type ToolParameter, type ToolCallTrace } from '$stores/tools';
	import { modelsStore } from '$stores/models';
	import { settingsStore } from '$stores/settings';
	import {
		Wrench,
		Play,
		Code,
		Bug,
		BarChart3,
		Plus,
		Trash2,
		Copy,
		Edit3,
		ChevronDown,
		ChevronRight,
		Check,
		X,
		AlertCircle,
		Clock,
		Zap,
		ListTree,
		FileJson,
		RefreshCw,
		History
	} from 'lucide-svelte';

	// State
	let selectedToolId = $state<string | null>(null);
	let isCreating = $state(false);
	let testPrompt = $state('What is the weather in San Francisco?');
	let selectedModel = $state('');
	let isRunning = $state(false);
	let currentTrace = $state<ToolCallTrace | null>(null);
	let showTraceHistory = $state(false);
	let compareModels = $state<string[]>([]);
	let isComparing = $state(false);
	let activeTab = $state<'editor' | 'json'>('editor');
	let jsonEditorValue = $state('');
	let validationErrors = $state<string[]>([]);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formParameters = $state<ToolParameter[]>([]);
	let expandedParams = $state<Set<number>>(new Set());

	const tools = $derived($toolsStore.tools);
	const traces = $derived($toolsStore.traces);
	const models = $derived($modelsStore.models);
	const selectedTool = $derived(tools.find(t => t.id === selectedToolId) || null);

	onMount(() => {
		toolsStore.loadTools();
		modelsStore.fetchModels();
		if (!selectedModel) {
			selectedModel = $settingsStore.defaultModel || 'llama3.2';
		}
	});

	function selectTool(tool: ToolDefinition) {
		selectedToolId = tool.id;
		isCreating = false;
		loadToolToForm(tool);
	}

	function loadToolToForm(tool: ToolDefinition) {
		formName = tool.name;
		formDescription = tool.description;
		formParameters = JSON.parse(JSON.stringify(tool.parameters));
		updateJsonEditor();
		validateTool();
	}

	function startCreate() {
		isCreating = true;
		selectedToolId = null;
		formName = '';
		formDescription = '';
		formParameters = [];
		updateJsonEditor();
		validationErrors = [];
	}

	function saveTool() {
		const validation = validateToolSchema({
			id: '',
			name: formName,
			description: formDescription,
			parameters: formParameters,
			createdAt: '',
			updatedAt: ''
		});

		if (!validation.valid) {
			validationErrors = validation.errors;
			return;
		}

		if (isCreating) {
			toolsStore.addTool({
				name: formName,
				description: formDescription,
				parameters: formParameters
			});
		} else if (selectedToolId) {
			toolsStore.updateTool(selectedToolId, {
				name: formName,
				description: formDescription,
				parameters: formParameters
			});
		}
		isCreating = false;
	}

	function deleteTool(id: string) {
		toolsStore.deleteTool(id);
		if (selectedToolId === id) {
			selectedToolId = null;
			formName = '';
			formDescription = '';
			formParameters = [];
		}
	}

	function addParameter() {
		formParameters = [...formParameters, {
			name: '',
			type: 'string',
			description: '',
			required: false
		}];
		expandedParams.add(formParameters.length - 1);
		expandedParams = new Set(expandedParams);
		updateJsonEditor();
	}

	function removeParameter(index: number) {
		formParameters = formParameters.filter((_, i) => i !== index);
		updateJsonEditor();
	}

	function toggleParamExpand(index: number) {
		if (expandedParams.has(index)) {
			expandedParams.delete(index);
		} else {
			expandedParams.add(index);
		}
		expandedParams = new Set(expandedParams);
	}

	function updateJsonEditor() {
		const tool = {
			name: formName,
			description: formDescription,
			parameters: formParameters
		};
		jsonEditorValue = JSON.stringify(toOllamaToolFormat({ ...tool, id: '', createdAt: '', updatedAt: '' }), null, 2);
	}

	function validateTool() {
		const validation = validateToolSchema({
			id: '',
			name: formName,
			description: formDescription,
			parameters: formParameters,
			createdAt: '',
			updatedAt: ''
		});
		validationErrors = validation.errors;
	}

	async function runTest() {
		if (!formName || !testPrompt || !selectedModel) return;

		isRunning = true;
		currentTrace = null;

		const tool = toOllamaToolFormat({
			id: selectedToolId || 'test',
			name: formName,
			description: formDescription,
			parameters: formParameters,
			createdAt: '',
			updatedAt: ''
		});

		const startTime = performance.now();

		try {
			const response = await fetch(`${$settingsStore.ollamaHost}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: selectedModel,
					messages: [{ role: 'user', content: testPrompt }],
					tools: [tool],
					stream: false
				})
			});

			const latencyMs = Math.round(performance.now() - startTime);
			const data = await response.json();

			const trace: Omit<ToolCallTrace, 'id' | 'timestamp'> = {
				toolId: selectedToolId || 'test',
				model: selectedModel,
				prompt: testPrompt,
				toolCalls: data.message?.tool_calls || [],
				rawResponse: data,
				latencyMs,
				success: true
			};

			toolsStore.addTrace(trace);
			currentTrace = { ...trace, id: 'current', timestamp: new Date().toISOString() };
		} catch (error) {
			const latencyMs = Math.round(performance.now() - startTime);
			const trace: Omit<ToolCallTrace, 'id' | 'timestamp'> = {
				toolId: selectedToolId || 'test',
				model: selectedModel,
				prompt: testPrompt,
				toolCalls: [],
				rawResponse: null,
				latencyMs,
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
			toolsStore.addTrace(trace);
			currentTrace = { ...trace, id: 'current', timestamp: new Date().toISOString() };
		}

		isRunning = false;
	}

	async function runComparison() {
		if (!formName || !testPrompt || compareModels.length < 2) return;

		isComparing = true;

		const tool = toOllamaToolFormat({
			id: selectedToolId || 'test',
			name: formName,
			description: formDescription,
			parameters: formParameters,
			createdAt: '',
			updatedAt: ''
		});

		const results = [];

		for (const model of compareModels) {
			const startTime = performance.now();
			try {
				const response = await fetch(`${$settingsStore.ollamaHost}/api/chat`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model,
						messages: [{ role: 'user', content: testPrompt }],
						tools: [tool],
						stream: false
					})
				});

				const latencyMs = Math.round(performance.now() - startTime);
				const data = await response.json();

				results.push({
					model,
					toolCalls: data.message?.tool_calls || [],
					latencyMs,
					success: true
				});
			} catch (error) {
				const latencyMs = Math.round(performance.now() - startTime);
				results.push({
					model,
					toolCalls: [],
					latencyMs,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		toolsStore.addComparison({
			toolId: selectedToolId || 'test',
			prompt: testPrompt,
			results
		});

		isComparing = false;
	}

	function toggleCompareModel(model: string) {
		if (compareModels.includes(model)) {
			compareModels = compareModels.filter(m => m !== model);
		} else {
			compareModels = [...compareModels, model];
		}
	}

	function formatLatency(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
</script>

<div class="flex h-full">
	<!-- Tool Library Sidebar -->
	<div class="w-64 border-r border-border bg-card flex flex-col">
		<div class="p-4 border-b border-border">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-semibold text-sm">Tool Library</h2>
				<button
					type="button"
					onclick={startCreate}
					class="rounded-lg p-1.5 hover:bg-muted transition-colors"
					title="New Tool"
				>
					<Plus class="h-4 w-4" />
				</button>
			</div>
			<p class="text-xs text-muted-foreground">{tools.length} tools defined</p>
		</div>

		<div class="flex-1 overflow-y-auto p-2 space-y-1">
			{#each tools as tool (tool.id)}
				<button
					type="button"
					onclick={() => selectTool(tool)}
					class="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors {selectedToolId === tool.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}"
				>
					<Wrench class="h-4 w-4 flex-shrink-0" />
					<div class="flex-1 min-w-0">
						<p class="font-medium truncate">{tool.name}</p>
						<p class="text-xs text-muted-foreground truncate">{tool.parameters.length} params</p>
					</div>
				</button>
			{/each}
		</div>

		<!-- Trace History -->
		<div class="border-t border-border">
			<button
				type="button"
				onclick={() => showTraceHistory = !showTraceHistory}
				class="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted transition-colors"
			>
				<span class="flex items-center gap-2">
					<History class="h-4 w-4" />
					Trace History
				</span>
				<span class="text-xs text-muted-foreground">{traces.length}</span>
			</button>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex flex-col overflow-hidden">
		<!-- Header -->
		<div class="border-b border-border bg-card px-6 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold">Tools Debugger</h1>
					<p class="text-sm text-muted-foreground mt-1">
						Test, trace, and debug function calling with Ollama models
					</p>
				</div>
				{#if selectedTool || isCreating}
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={saveTool}
							disabled={!formName || !formDescription}
							class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							<Check class="h-4 w-4" />
							{isCreating ? 'Create Tool' : 'Save Changes'}
						</button>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-6">
			{#if showTraceHistory}
				<!-- Trace History View -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="text-lg font-semibold">Trace History</h2>
						<button
							type="button"
							onclick={() => toolsStore.clearTraces()}
							class="text-sm text-muted-foreground hover:text-destructive transition-colors"
						>
							Clear All
						</button>
					</div>

					{#if traces.length === 0}
						<div class="text-center py-12 text-muted-foreground">
							<History class="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No trace history yet</p>
							<p class="text-sm">Run some tests to see traces here</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each traces as trace (trace.id)}
								<div class="rounded-xl border border-border bg-card p-4">
									<div class="flex items-start justify-between mb-3">
										<div>
											<div class="flex items-center gap-2">
												<span class="font-medium">{trace.model}</span>
												<span class="text-xs px-2 py-0.5 rounded-full {trace.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}">
													{trace.success ? 'Success' : 'Failed'}
												</span>
											</div>
											<p class="text-sm text-muted-foreground mt-1 truncate max-w-md">{trace.prompt}</p>
										</div>
										<div class="text-right text-sm text-muted-foreground">
											<div class="flex items-center gap-1">
												<Clock class="h-3 w-3" />
												{formatLatency(trace.latencyMs)}
											</div>
											<div class="text-xs">{new Date(trace.timestamp).toLocaleTimeString()}</div>
										</div>
									</div>

									{#if trace.toolCalls.length > 0}
										<div class="bg-muted rounded-lg p-3">
											<p class="text-xs font-medium text-muted-foreground mb-2">Tool Calls:</p>
											{#each trace.toolCalls as call}
												<div class="font-mono text-sm">
													<span class="text-primary">{call.function?.name || call.name}</span>
													<span class="text-muted-foreground">(</span>
													<span class="text-foreground">{JSON.stringify(call.function?.arguments || call.arguments)}</span>
													<span class="text-muted-foreground">)</span>
												</div>
											{/each}
										</div>
									{:else if trace.error}
										<div class="bg-red-500/10 text-red-500 rounded-lg p-3 text-sm">
											{trace.error}
										</div>
									{:else}
										<div class="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
											No tool calls made
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if selectedTool || isCreating}
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Left: Tool Definition -->
					<div class="space-y-4">
						<div class="rounded-xl border border-border bg-card overflow-hidden">
							<!-- Tabs -->
							<div class="flex border-b border-border">
								<button
									type="button"
									onclick={() => activeTab = 'editor'}
									class="flex-1 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'editor' ? 'bg-muted border-b-2 border-primary' : 'hover:bg-muted/50'}"
								>
									<Edit3 class="h-4 w-4 inline mr-2" />
									Visual Editor
								</button>
								<button
									type="button"
									onclick={() => activeTab = 'json'}
									class="flex-1 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'json' ? 'bg-muted border-b-2 border-primary' : 'hover:bg-muted/50'}"
								>
									<FileJson class="h-4 w-4 inline mr-2" />
									JSON Schema
								</button>
							</div>

							<div class="p-4">
								{#if activeTab === 'editor'}
									<div class="space-y-4">
										<div>
											<label for="tool-name" class="mb-1 block text-sm font-medium">Tool Name</label>
											<input
												id="tool-name"
												type="text"
												bind:value={formName}
												oninput={updateJsonEditor}
												placeholder="get_weather"
												class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>

										<div>
											<label for="tool-desc" class="mb-1 block text-sm font-medium">Description</label>
											<textarea
												id="tool-desc"
												bind:value={formDescription}
												oninput={updateJsonEditor}
												rows="2"
												placeholder="Get the current weather for a location"
												class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
											></textarea>
										</div>

										<div>
											<div class="flex items-center justify-between mb-2">
												<span class="text-sm font-medium">Parameters</span>
												<button
													type="button"
													onclick={addParameter}
													class="text-xs text-primary hover:underline"
												>
													+ Add Parameter
												</button>
											</div>

											<div class="space-y-2">
												{#each formParameters as param, index (index)}
													<div class="border border-border rounded-lg overflow-hidden">
														<div class="relative group">
															<button
																type="button"
																onclick={() => toggleParamExpand(index)}
																class="w-full flex items-center justify-between px-3 py-2 pr-10 bg-muted/50 hover:bg-muted transition-colors"
															>
																<div class="flex items-center gap-2">
																	{#if expandedParams.has(index)}
																		<ChevronDown class="h-4 w-4" />
																	{:else}
																		<ChevronRight class="h-4 w-4" />
																	{/if}
																	<span class="font-mono text-sm">{param.name || 'unnamed'}</span>
																	<span class="text-xs px-2 py-0.5 rounded bg-background">{param.type}</span>
																	{#if param.required}
																		<span class="text-xs text-destructive">*</span>
																	{/if}
																</div>
															</button>
															<button
																type="button"
																onclick={(e) => { e.stopPropagation(); removeParameter(index); }}
																class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors opacity-0 group-hover:opacity-100"
															>
																<X class="h-3 w-3" />
															</button>
														</div>

														{#if expandedParams.has(index)}
															<div class="p-3 space-y-3 bg-background">
																<div class="grid grid-cols-2 gap-3">
																	<div>
																		<label for="param-name-{index}" class="text-xs font-medium mb-1 block">Name</label>
																		<input
																			id="param-name-{index}"
																			type="text"
																			bind:value={param.name}
																			oninput={updateJsonEditor}
																			placeholder="param_name"
																			class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
																		/>
																	</div>
																	<div>
																		<label for="param-type-{index}" class="text-xs font-medium mb-1 block">Type</label>
																		<select
																			id="param-type-{index}"
																			bind:value={param.type}
																			onchange={updateJsonEditor}
																			class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
																		>
																			<option value="string">string</option>
																			<option value="number">number</option>
																			<option value="boolean">boolean</option>
																			<option value="array">array</option>
																			<option value="object">object</option>
																		</select>
																	</div>
																</div>

																<div>
																	<label for="param-desc-{index}" class="text-xs font-medium mb-1 block">Description</label>
																	<input
																		id="param-desc-{index}"
																		type="text"
																		bind:value={param.description}
																		oninput={updateJsonEditor}
																		placeholder="Parameter description"
																		class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
																	/>
																</div>

																<div class="flex items-center gap-4">
																	<label class="flex items-center gap-2 text-sm">
																		<input
																			type="checkbox"
																			bind:checked={param.required}
																			onchange={updateJsonEditor}
																			class="rounded"
																		/>
																		Required
																	</label>
																</div>
															</div>
														{/if}
													</div>
												{/each}

												{#if formParameters.length === 0}
													<div class="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
														No parameters defined
													</div>
												{/if}
											</div>
										</div>
									</div>
								{:else}
									<div>
										<p class="text-xs text-muted-foreground mb-2">Ollama Tool Format (read-only)</p>
										<pre class="rounded-lg bg-muted p-4 text-sm overflow-x-auto font-mono max-h-96"><code>{jsonEditorValue}</code></pre>
									</div>
								{/if}
							</div>

							<!-- Validation -->
							{#if validationErrors.length > 0}
								<div class="border-t border-border p-4 bg-destructive/5">
									<div class="flex items-center gap-2 text-destructive mb-2">
										<AlertCircle class="h-4 w-4" />
										<span class="text-sm font-medium">Validation Errors</span>
									</div>
									<ul class="text-sm text-destructive space-y-1">
										{#each validationErrors as error}
											<li>- {error}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>

						<!-- Actions for existing tool -->
						{#if selectedTool}
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => toolsStore.duplicateTool(selectedTool.id)}
									class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
								>
									<Copy class="h-4 w-4" />
									Duplicate
								</button>
								<button
									type="button"
									onclick={() => deleteTool(selectedTool.id)}
									class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors"
								>
									<Trash2 class="h-4 w-4" />
									Delete
								</button>
							</div>
						{/if}
					</div>

					<!-- Right: Testing -->
					<div class="space-y-4">
						<!-- Test Prompt -->
						<div class="rounded-xl border border-border bg-card p-4">
							<h2 class="mb-4 font-semibold flex items-center gap-2">
								<Zap class="h-4 w-4" />
								Test Tool
							</h2>

							<div class="space-y-3">
								<div>
									<label for="test-model" class="mb-1 block text-sm font-medium">Model</label>
									<select
										id="test-model"
										bind:value={selectedModel}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									>
										{#each models as model}
											<option value={model.name}>{model.name}</option>
										{/each}
									</select>
								</div>

								<div>
									<label for="test-prompt" class="mb-1 block text-sm font-medium">Test Prompt</label>
									<textarea
										id="test-prompt"
										bind:value={testPrompt}
										rows="3"
										placeholder="Enter a prompt that should trigger this tool..."
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
									></textarea>
								</div>

								<button
									type="button"
									onclick={runTest}
									disabled={isRunning || !formName || !testPrompt}
									class="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
								>
									{#if isRunning}
										<RefreshCw class="h-4 w-4 animate-spin" />
										Running...
									{:else}
										<Play class="h-4 w-4" />
										Run Test
									{/if}
								</button>
							</div>
						</div>

						<!-- Call Trace -->
						<div class="rounded-xl border border-border bg-card p-4">
							<h2 class="mb-4 font-semibold flex items-center gap-2">
								<Bug class="h-4 w-4" />
								Call Trace
							</h2>

							{#if currentTrace}
								<div class="space-y-3">
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Status:</span>
										<span class="flex items-center gap-1 {currentTrace.success ? 'text-green-500' : 'text-red-500'}">
											{#if currentTrace.success}
												<Check class="h-4 w-4" />
												Success
											{:else}
												<X class="h-4 w-4" />
												Failed
											{/if}
										</span>
									</div>
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Latency:</span>
										<span class="flex items-center gap-1">
											<Clock class="h-3 w-3" />
											{formatLatency(currentTrace.latencyMs)}
										</span>
									</div>

									{#if currentTrace.toolCalls.length > 0}
										<div class="mt-4">
											<p class="text-sm font-medium mb-2 flex items-center gap-2">
												<ListTree class="h-4 w-4" />
												Tool Calls ({currentTrace.toolCalls.length})
											</p>
											<div class="space-y-2">
												{#each currentTrace.toolCalls as call, i}
													<div class="rounded-lg bg-muted p-3">
														<div class="flex items-center gap-2 mb-2">
															<span class="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">#{i + 1}</span>
															<span class="font-mono text-sm font-medium">{call.function?.name || call.name}</span>
														</div>
														<pre class="text-xs bg-background rounded p-2 overflow-x-auto"><code>{JSON.stringify(call.function?.arguments || call.arguments, null, 2)}</code></pre>
													</div>
												{/each}
											</div>
										</div>
									{:else if currentTrace.error}
										<div class="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
											<p class="font-medium">Error:</p>
											<p>{currentTrace.error}</p>
										</div>
									{:else}
										<div class="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
											<p>No tool calls were made</p>
											<p class="text-xs mt-1">The model did not decide to use the tool</p>
										</div>
									{/if}
								</div>
							{:else}
								<div class="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
									<Bug class="h-8 w-8 mx-auto mb-2 opacity-50" />
									<p>Run a test to see the call trace</p>
								</div>
							{/if}
						</div>

						<!-- Raw Response -->
						{#if currentTrace?.rawResponse}
							<div class="rounded-xl border border-border bg-card p-4">
								<h2 class="mb-4 font-semibold flex items-center gap-2">
									<Code class="h-4 w-4" />
									Raw Response
								</h2>
								<pre class="rounded-lg bg-muted p-4 text-xs overflow-x-auto max-h-64 font-mono"><code>{JSON.stringify(currentTrace.rawResponse, null, 2)}</code></pre>
							</div>
						{/if}

						<!-- Model Comparison -->
						<div class="rounded-xl border border-border bg-card p-4">
							<h2 class="mb-4 font-semibold flex items-center gap-2">
								<BarChart3 class="h-4 w-4" />
								Model Comparison
							</h2>

							<p class="text-sm text-muted-foreground mb-3">
								Compare how different models handle this tool
							</p>

							<div class="flex flex-wrap gap-2 mb-3">
								{#each models.slice(0, 6) as model}
									<button
										type="button"
										onclick={() => toggleCompareModel(model.name)}
										class="text-xs px-2 py-1 rounded-full border transition-colors {compareModels.includes(model.name) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}"
									>
										{model.name}
									</button>
								{/each}
							</div>

							<button
								type="button"
								onclick={runComparison}
								disabled={isComparing || compareModels.length < 2 || !formName || !testPrompt}
								class="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
							>
								{#if isComparing}
									<RefreshCw class="h-4 w-4 animate-spin" />
									Comparing...
								{:else}
									<BarChart3 class="h-4 w-4" />
									Compare {compareModels.length} Models
								{/if}
							</button>

							{#if $toolsStore.comparisons.length > 0}
								<div class="mt-4 pt-4 border-t border-border">
									<p class="text-xs font-medium text-muted-foreground mb-2">Latest Comparison</p>
									<div class="space-y-2">
										{#each $toolsStore.comparisons[0].results as result}
											<div class="flex items-center justify-between text-sm p-2 rounded-lg bg-muted">
												<span class="font-medium">{result.model}</span>
												<div class="flex items-center gap-3">
													<span class="text-xs {result.success ? 'text-green-500' : 'text-red-500'}">
														{result.toolCalls.length} calls
													</span>
													<span class="text-xs text-muted-foreground">
														{formatLatency(result.latencyMs)}
													</span>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<!-- Empty State -->
				<div class="flex flex-col items-center justify-center h-full text-center">
					<div class="rounded-full bg-muted p-6 mb-4">
						<Wrench class="h-12 w-12 text-muted-foreground" />
					</div>
					<h2 class="text-xl font-semibold mb-2">Tools Debugger</h2>
					<p class="text-muted-foreground mb-6 max-w-md">
						Define, test, and debug function calling tools. See how different models interpret and call your tools.
					</p>
					<div class="flex gap-3">
						<button
							type="button"
							onclick={startCreate}
							class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<Plus class="h-4 w-4" />
							Create New Tool
						</button>
						{#if tools.length > 0}
							<button
								type="button"
								onclick={() => selectTool(tools[0])}
								class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
							>
								Select Existing Tool
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
