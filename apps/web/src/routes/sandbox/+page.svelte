<script lang="ts">
	import {
		sandboxStore,
		activeExecution,
		getRuntimeLabel,
		getRuntimeColor,
		type RuntimeType,
		type CodeExecution,
		type CodeSnippet,
		type ExecutionOutput
	} from '$stores/sandbox';
	import {
		Play,
		Square,
		Plus,
		Trash2,
		Copy,
		Download,
		Settings,
		Terminal,
		FileCode2,
		Braces,
		Code,
		ChevronRight,
		X,
		Save,
		FolderOpen,
		Clock,
		AlertCircle,
		CheckCircle,
		Loader2,
		RefreshCw,
		Maximize2,
		Minimize2,
		MoreVertical,
		BookOpen
	} from 'lucide-svelte';

	// View state
	let currentView = $state<'editor' | 'snippets'>('editor');
	let showNewModal = $state(false);
	let showSnippetModal = $state(false);
	let showSettingsModal = $state(false);
	let outputExpanded = $state(false);

	// New execution form
	let newName = $state('');
	let newRuntime = $state<RuntimeType>('python');

	// New snippet form
	let snippetName = $state('');
	let snippetDescription = $state('');
	let snippetTags = $state('');

	// Execution state
	let isRunning = $state(false);
	let executionError = $state<string | null>(null);

	const store = $derived($sandboxStore);
	const execution = $derived($activeExecution);

	function getRuntimeIcon(runtime: RuntimeType) {
		switch (runtime) {
			case 'python': return FileCode2;
			case 'node': return Braces;
			case 'bash': return Terminal;
			default: return Code;
		}
	}

	function createExecution() {
		if (!newName.trim()) return;
		sandboxStore.createExecution(newName.trim(), newRuntime);
		newName = '';
		newRuntime = 'python';
		showNewModal = false;
	}

	function selectExecution(id: string) {
		sandboxStore.setActiveExecution(id);
	}

	async function runCode() {
		if (!execution || isRunning) return;

		isRunning = true;
		executionError = null;
		sandboxStore.clearOutputs(execution.id);
		sandboxStore.updateExecution(execution.id, {
			status: 'running',
			startedAt: new Date().toISOString()
		});

		const startTime = Date.now();

		try {
			// Build the execution request
			const response = await fetch('/api/sandbox/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					runtime: execution.runtime,
					code: execution.code,
					timeout: store.config.timeout
				})
			});

			if (!response.ok) {
				throw new Error(`Execution failed: ${response.statusText}`);
			}

			const result = await response.json();

			// Add outputs
			if (result.stdout) {
				sandboxStore.addOutput(execution.id, { type: 'stdout', content: result.stdout });
			}
			if (result.stderr) {
				sandboxStore.addOutput(execution.id, { type: 'stderr', content: result.stderr });
			}
			if (result.error) {
				sandboxStore.addOutput(execution.id, { type: 'error', content: result.error });
			}
			if (result.result) {
				sandboxStore.addOutput(execution.id, { type: 'result', content: JSON.stringify(result.result, null, 2) });
			}

			sandboxStore.updateExecution(execution.id, {
				status: result.error ? 'error' : 'completed',
				completedAt: new Date().toISOString(),
				executionTimeMs: Date.now() - startTime,
				error: result.error
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Execution failed';
			sandboxStore.addOutput(execution.id, { type: 'error', content: errorMessage });
			sandboxStore.updateExecution(execution.id, {
				status: 'error',
				completedAt: new Date().toISOString(),
				executionTimeMs: Date.now() - startTime,
				error: errorMessage
			});
			executionError = errorMessage;
		} finally {
			isRunning = false;
		}
	}

	function stopExecution() {
		// In a real implementation, this would send a cancel signal
		isRunning = false;
		if (execution) {
			sandboxStore.updateExecution(execution.id, { status: 'error', error: 'Execution cancelled' });
		}
	}

	function saveAsSnippet() {
		if (!execution) return;
		snippetName = execution.name;
		snippetDescription = '';
		snippetTags = '';
		showSnippetModal = true;
	}

	function createSnippet() {
		if (!execution || !snippetName.trim()) return;
		sandboxStore.addSnippet({
			name: snippetName.trim(),
			description: snippetDescription.trim(),
			runtime: execution.runtime,
			code: execution.code,
			tags: snippetTags.split(',').map(t => t.trim()).filter(Boolean)
		});
		showSnippetModal = false;
		snippetName = '';
		snippetDescription = '';
		snippetTags = '';
	}

	function loadSnippet(snippet: CodeSnippet) {
		if (!execution) {
			sandboxStore.createExecution(snippet.name, snippet.runtime, snippet.code);
		} else {
			sandboxStore.updateExecution(execution.id, {
				code: snippet.code,
				runtime: snippet.runtime
			});
		}
		currentView = 'editor';
	}

	function copyOutput() {
		if (!execution) return;
		const text = execution.outputs.map(o => o.content).join('\n');
		navigator.clipboard.writeText(text);
	}

	function downloadOutput() {
		if (!execution) return;
		const text = execution.outputs.map(o => `[${o.type}] ${o.content}`).join('\n');
		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${execution.name}-output.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatDate(date: string) {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(date));
	}

	function getOutputTypeColor(type: ExecutionOutput['type']): string {
		switch (type) {
			case 'stdout': return 'text-foreground';
			case 'stderr': return 'text-yellow-500';
			case 'error': return 'text-destructive';
			case 'result': return 'text-green-500';
			default: return 'text-muted-foreground';
		}
	}

	function getStatusIcon(status: CodeExecution['status']) {
		switch (status) {
			case 'running': return Loader2;
			case 'completed': return CheckCircle;
			case 'error': return AlertCircle;
			default: return Clock;
		}
	}

	function getStatusColor(status: CodeExecution['status']): string {
		switch (status) {
			case 'running': return 'text-primary animate-spin';
			case 'completed': return 'text-green-500';
			case 'error': return 'text-destructive';
			default: return 'text-muted-foreground';
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border bg-card px-6 py-4">
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<Terminal class="h-6 w-6 text-primary" />
				<h1 class="text-xl font-semibold">Code Sandbox</h1>
			</div>

			<!-- View Toggle -->
			<div class="flex rounded-lg border border-border p-1">
				<button
					type="button"
					onclick={() => currentView = 'editor'}
					class="rounded-md px-3 py-1 text-sm transition-colors {currentView === 'editor'
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Editor
				</button>
				<button
					type="button"
					onclick={() => currentView = 'snippets'}
					class="rounded-md px-3 py-1 text-sm transition-colors {currentView === 'snippets'
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Snippets
				</button>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => showSettingsModal = true}
				class="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
				title="Settings"
			>
				<Settings class="h-5 w-5" />
			</button>
			<button
				type="button"
				onclick={() => showNewModal = true}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				<Plus class="h-4 w-4" />
				New
			</button>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-hidden">
		{#if currentView === 'snippets'}
			<!-- Snippets View -->
			<div class="h-full overflow-y-auto p-6">
				<div class="mb-6">
					<h2 class="text-lg font-semibold mb-2">Code Snippets</h2>
					<p class="text-sm text-muted-foreground">Reusable code templates for quick access</p>
				</div>

				<!-- Group by runtime -->
				{#each ['python', 'node', 'bash'] as runtime}
					{@const snippets = store.snippets.filter(s => s.runtime === runtime)}
					{#if snippets.length > 0}
						{@const Icon = getRuntimeIcon(runtime as RuntimeType)}
						<div class="mb-8">
							<div class="flex items-center gap-2 mb-4">
								<Icon class="h-5 w-5 {getRuntimeColor(runtime as RuntimeType)}" />
								<h3 class="font-medium">{getRuntimeLabel(runtime as RuntimeType)}</h3>
								<span class="text-xs text-muted-foreground">({snippets.length})</span>
							</div>

							<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{#each snippets as snippet (snippet.id)}
									<div class="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
										<div class="flex items-start justify-between mb-2">
											<div>
												<h4 class="font-medium">{snippet.name}</h4>
												{#if snippet.description}
													<p class="text-sm text-muted-foreground mt-0.5">{snippet.description}</p>
												{/if}
											</div>
											<div class="flex items-center gap-1">
												<button
													type="button"
													onclick={() => loadSnippet(snippet)}
													class="rounded p-1.5 text-muted-foreground hover:bg-muted"
													title="Load snippet"
												>
													<Play class="h-4 w-4" />
												</button>
												<button
													type="button"
													onclick={() => sandboxStore.deleteSnippet(snippet.id)}
													class="rounded p-1.5 text-destructive hover:bg-destructive/10"
													title="Delete"
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
										</div>

										<pre class="rounded-lg bg-muted p-2 text-xs font-mono overflow-hidden max-h-24">{snippet.code.slice(0, 200)}{snippet.code.length > 200 ? '...' : ''}</pre>

										{#if snippet.tags.length > 0}
											<div class="flex flex-wrap gap-1 mt-2">
												{#each snippet.tags as tag}
													<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{tag}</span>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				{#if store.snippets.length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center">
						<BookOpen class="mb-4 h-12 w-12 text-muted-foreground/30" />
						<h3 class="mb-2 font-medium">No snippets yet</h3>
						<p class="text-sm text-muted-foreground">
							Save code from the editor to create reusable snippets
						</p>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Editor View -->
			<div class="flex h-full">
				<!-- Sidebar: Executions List -->
				<div class="w-64 flex-shrink-0 border-r border-border overflow-y-auto">
					<div class="p-3 border-b border-border">
						<h3 class="text-sm font-medium text-muted-foreground">Executions</h3>
					</div>
					<div class="p-2 space-y-1">
						{#each store.executions as exec (exec.id)}
							{@const Icon = getRuntimeIcon(exec.runtime)}
							{@const StatusIcon = getStatusIcon(exec.status)}
							<button
								type="button"
								onclick={() => selectExecution(exec.id)}
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors {execution?.id === exec.id
									? 'bg-primary/10 text-primary'
									: 'hover:bg-muted'}"
							>
								<Icon class="h-4 w-4 flex-shrink-0 {getRuntimeColor(exec.runtime)}" />
								<div class="flex-1 min-w-0">
									<p class="truncate text-sm font-medium">{exec.name}</p>
									<div class="flex items-center gap-1 text-xs text-muted-foreground">
										<StatusIcon class="h-3 w-3 {getStatusColor(exec.status)}" />
										{exec.status}
									</div>
								</div>
							</button>
						{/each}

						{#if store.executions.length === 0}
							<div class="px-3 py-8 text-center text-sm text-muted-foreground">
								No executions yet
							</div>
						{/if}
					</div>
				</div>

				<!-- Main Editor Area -->
				{#if execution}
					{@const Icon = getRuntimeIcon(execution.runtime)}
					<div class="flex-1 flex flex-col overflow-hidden">
						<!-- Editor Toolbar -->
						<div class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
							<div class="flex items-center gap-3">
								<Icon class="h-5 w-5 {getRuntimeColor(execution.runtime)}" />
								<span class="font-medium">{execution.name}</span>
								<span class="rounded-full bg-muted px-2 py-0.5 text-xs">
									{getRuntimeLabel(execution.runtime)}
								</span>
							</div>

							<div class="flex items-center gap-2">
								{#if isRunning}
									<button
										type="button"
										onclick={stopExecution}
										class="flex items-center gap-2 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
									>
										<Square class="h-4 w-4" />
										Stop
									</button>
								{:else}
									<button
										type="button"
										onclick={runCode}
										disabled={!execution.code.trim()}
										class="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
									>
										<Play class="h-4 w-4" />
										Run
									</button>
								{/if}
								<button
									type="button"
									onclick={saveAsSnippet}
									disabled={!execution.code.trim()}
									class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
								>
									<Save class="h-4 w-4" />
									Save
								</button>
								<button
									type="button"
									onclick={() => sandboxStore.deleteExecution(execution.id)}
									class="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>

						<!-- Code Editor -->
						<div class="flex-1 flex flex-col overflow-hidden {outputExpanded ? 'h-1/3' : 'h-2/3'}">
							<textarea
								bind:value={execution.code}
								onblur={() => sandboxStore.updateExecution(execution.id, { code: execution.code })}
								placeholder="Enter your code here..."
								spellcheck="false"
								class="flex-1 resize-none bg-background p-4 font-mono text-sm focus:outline-none"
								style="font-size: {store.config.fontSize}px; tab-size: 4;"
							></textarea>
						</div>

						<!-- Output Panel -->
						<div class="border-t border-border flex flex-col {outputExpanded ? 'h-2/3' : 'h-1/3'}">
							<div class="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium">Output</span>
									{#if execution.executionTimeMs}
										<span class="text-xs text-muted-foreground">
											{execution.executionTimeMs}ms
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => sandboxStore.clearOutputs(execution.id)}
										class="rounded p-1 text-muted-foreground hover:bg-muted"
										title="Clear output"
									>
										<RefreshCw class="h-4 w-4" />
									</button>
									<button
										type="button"
										onclick={copyOutput}
										class="rounded p-1 text-muted-foreground hover:bg-muted"
										title="Copy output"
									>
										<Copy class="h-4 w-4" />
									</button>
									<button
										type="button"
										onclick={downloadOutput}
										class="rounded p-1 text-muted-foreground hover:bg-muted"
										title="Download output"
									>
										<Download class="h-4 w-4" />
									</button>
									<button
										type="button"
										onclick={() => outputExpanded = !outputExpanded}
										class="rounded p-1 text-muted-foreground hover:bg-muted"
										title={outputExpanded ? 'Minimize' : 'Maximize'}
									>
										{#if outputExpanded}
											<Minimize2 class="h-4 w-4" />
										{:else}
											<Maximize2 class="h-4 w-4" />
										{/if}
									</button>
								</div>
							</div>

							<div class="flex-1 overflow-y-auto bg-background p-4 font-mono text-sm">
								{#if execution.outputs.length === 0}
									<div class="text-muted-foreground text-center py-8">
										{#if isRunning}
											<Loader2 class="h-6 w-6 animate-spin mx-auto mb-2" />
											Running...
										{:else}
											Run your code to see output
										{/if}
									</div>
								{:else}
									{#each execution.outputs as output}
										<div class="mb-2 {getOutputTypeColor(output.type)}">
											{#if output.type === 'error'}
												<div class="flex items-start gap-2">
													<AlertCircle class="h-4 w-4 mt-0.5 flex-shrink-0" />
													<pre class="whitespace-pre-wrap break-all">{output.content}</pre>
												</div>
											{:else}
												<pre class="whitespace-pre-wrap break-all">{output.content}</pre>
											{/if}
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="flex-1 flex flex-col items-center justify-center text-center p-8">
						<Terminal class="mb-4 h-16 w-16 text-muted-foreground/30" />
						<h2 class="text-lg font-medium mb-2">No execution selected</h2>
						<p class="text-sm text-muted-foreground mb-6">
							Create a new execution or select one from the sidebar
						</p>
						<button
							type="button"
							onclick={() => showNewModal = true}
							class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							<Plus class="h-4 w-4" />
							New Execution
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- New Execution Modal -->
{#if showNewModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">New Execution</h2>
				<button
					type="button"
					onclick={() => showNewModal = false}
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="new-sandbox-name" class="mb-1.5 block text-sm font-medium">Name</label>
					<input
						id="new-sandbox-name"
						type="text"
						bind:value={newName}
						placeholder="My Script"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<span class="mb-1.5 block text-sm font-medium">Runtime</span>
					<div class="grid grid-cols-3 gap-2" role="group" aria-label="Select runtime">
						{#each ['python', 'node', 'bash'] as runtime}
							{@const Icon = getRuntimeIcon(runtime as RuntimeType)}
							<button
								type="button"
								onclick={() => newRuntime = runtime as RuntimeType}
								class="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors {newRuntime === runtime
									? 'border-primary bg-primary/10'
									: 'border-border hover:bg-muted'}"
							>
								<Icon class="h-6 w-6 {getRuntimeColor(runtime as RuntimeType)}" />
								<span class="text-sm">{getRuntimeLabel(runtime as RuntimeType)}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={() => showNewModal = false}
					class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={createExecution}
					disabled={!newName.trim()}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Save as Snippet Modal -->
{#if showSnippetModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Save as Snippet</h2>
				<button
					type="button"
					onclick={() => showSnippetModal = false}
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="snippet-name" class="mb-1.5 block text-sm font-medium">Name</label>
					<input
						id="snippet-name"
						type="text"
						bind:value={snippetName}
						placeholder="My Snippet"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="snippet-description" class="mb-1.5 block text-sm font-medium">Description</label>
					<textarea
						id="snippet-description"
						bind:value={snippetDescription}
						placeholder="Brief description..."
						rows="2"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>

				<div>
					<label for="snippet-tags" class="mb-1.5 block text-sm font-medium">Tags (comma-separated)</label>
					<input
						id="snippet-tags"
						type="text"
						bind:value={snippetTags}
						placeholder="data, visualization, pandas"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={() => showSnippetModal = false}
					class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={createSnippet}
					disabled={!snippetName.trim()}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					Save Snippet
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Settings Modal -->
{#if showSettingsModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Sandbox Settings</h2>
				<button
					type="button"
					onclick={() => showSettingsModal = false}
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="config-timeout" class="mb-1.5 block text-sm font-medium">Execution Timeout (seconds)</label>
					<input
						id="config-timeout"
						type="number"
						min="5"
						max="300"
						bind:value={store.config.timeout}
						onchange={() => sandboxStore.updateConfig({ timeout: store.config.timeout })}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="config-font-size" class="mb-1.5 block text-sm font-medium">Font Size</label>
					<input
						id="config-font-size"
						type="range"
						min="10"
						max="20"
						bind:value={store.config.fontSize}
						onchange={() => sandboxStore.updateConfig({ fontSize: store.config.fontSize })}
						class="w-full"
					/>
					<span class="text-sm text-muted-foreground">{store.config.fontSize}px</span>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<span class="text-sm font-medium">Show Line Numbers</span>
						<p class="text-xs text-muted-foreground">Display line numbers in editor</p>
					</div>
					<button
						type="button"
						onclick={() => sandboxStore.updateConfig({ showLineNumbers: !store.config.showLineNumbers })}
						class="relative h-6 w-11 rounded-full transition-colors {store.config.showLineNumbers ? 'bg-primary' : 'bg-muted'}"
						role="switch"
						aria-checked={store.config.showLineNumbers}
						aria-label="Show line numbers"
					>
						<span
							class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform {store.config.showLineNumbers ? 'translate-x-5' : ''}"
						></span>
					</button>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<span class="text-sm font-medium">Auto Save</span>
						<p class="text-xs text-muted-foreground">Automatically save code changes</p>
					</div>
					<button
						type="button"
						onclick={() => sandboxStore.updateConfig({ autoSave: !store.config.autoSave })}
						class="relative h-6 w-11 rounded-full transition-colors {store.config.autoSave ? 'bg-primary' : 'bg-muted'}"
						role="switch"
						aria-checked={store.config.autoSave}
						aria-label="Auto save"
					>
						<span
							class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform {store.config.autoSave ? 'translate-x-5' : ''}"
						></span>
					</button>
				</div>
			</div>

			<div class="mt-6 flex justify-end">
				<button
					type="button"
					onclick={() => showSettingsModal = false}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
