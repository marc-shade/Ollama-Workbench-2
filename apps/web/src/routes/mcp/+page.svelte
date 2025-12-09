<script lang="ts">
	import { mcpStore, type MCPServerConfig, type MCPTool, validateToolInput, generateMCPToolSchema } from '$stores/mcp';
	import { onMount } from 'svelte';
	import {
		Plug,
		Plus,
		RefreshCw,
		Play,
		Trash2,
		Check,
		X,
		Settings,
		Code,
		Server,
		ChevronDown,
		ChevronRight,
		Terminal,
		Clock,
		AlertCircle,
		CheckCircle,
		Copy,
		Eye,
		Wrench,
		FileJson,
		Zap,
		History,
		MoreVertical,
		Edit3,
		Power,
		PowerOff
	} from 'lucide-svelte';

	// View state
	type ViewMode = 'servers' | 'playground' | 'builder' | 'history';
	let viewMode = $state<ViewMode>('servers');
	let selectedServer = $state<MCPServerConfig | null>(null);
	let selectedTool = $state<MCPTool | null>(null);

	// Server editor state
	let isEditing = $state(false);
	let isCreating = $state(false);
	let editForm = $state({
		name: '',
		description: '',
		transport: 'stdio' as 'stdio' | 'sse' | 'http',
		command: '',
		args: '',
		url: '',
		env: ''
	});

	// Tool builder state
	let isToolEditing = $state(false);
	let isToolCreating = $state(false);
	let toolForm = $state({
		name: '',
		description: '',
		properties: [] as { name: string; type: string; description: string; required: boolean; enum?: string }[]
	});

	// Playground state
	let testToolArgs = $state<Record<string, string>>({});
	let testResult = $state<{ success: boolean; result?: unknown; error?: string; latencyMs?: number } | null>(null);
	let isExecuting = $state(false);

	// Expanded servers/tools
	let expandedServers = $state<Set<string>>(new Set());

	const servers = $derived($mcpStore.servers);
	const toolCalls = $derived($mcpStore.toolCalls);

	onMount(() => {
		mcpStore.loadServers();
	});

	function toggleServerExpand(id: string) {
		const next = new Set(expandedServers);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedServers = next;
	}

	function startCreateServer() {
		isCreating = true;
		isEditing = false;
		editForm = {
			name: '',
			description: '',
			transport: 'stdio',
			command: '',
			args: '',
			url: '',
			env: ''
		};
	}

	function startEditServer(server: MCPServerConfig) {
		isEditing = true;
		isCreating = false;
		selectedServer = server;
		editForm = {
			name: server.name,
			description: server.description || '',
			transport: server.transport,
			command: server.command || '',
			args: server.args?.join(' ') || '',
			url: server.url || '',
			env: server.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
		};
	}

	function cancelEdit() {
		isEditing = false;
		isCreating = false;
	}

	function saveServer() {
		const envObj: Record<string, string> = {};
		if (editForm.env) {
			for (const line of editForm.env.split('\n')) {
				const [key, ...valueParts] = line.split('=');
				if (key && valueParts.length > 0) {
					envObj[key.trim()] = valueParts.join('=').trim();
				}
			}
		}

		if (isCreating) {
			mcpStore.addServer({
				name: editForm.name,
				description: editForm.description || undefined,
				transport: editForm.transport,
				command: editForm.transport === 'stdio' ? editForm.command : undefined,
				args: editForm.transport === 'stdio' && editForm.args ? editForm.args.split(' ').filter(Boolean) : undefined,
				url: editForm.transport !== 'stdio' ? editForm.url : undefined,
				env: Object.keys(envObj).length > 0 ? envObj : undefined,
				enabled: false
			});
		} else if (selectedServer) {
			mcpStore.updateServer(selectedServer.id, {
				name: editForm.name,
				description: editForm.description || undefined,
				transport: editForm.transport,
				command: editForm.transport === 'stdio' ? editForm.command : undefined,
				args: editForm.transport === 'stdio' && editForm.args ? editForm.args.split(' ').filter(Boolean) : undefined,
				url: editForm.transport !== 'stdio' ? editForm.url : undefined,
				env: Object.keys(envObj).length > 0 ? envObj : undefined
			});
		}

		cancelEdit();
	}

	function toggleServerEnabled(server: MCPServerConfig) {
		mcpStore.updateServer(server.id, { enabled: !server.enabled });
	}

	function deleteServer(id: string) {
		if (selectedServer?.id === id) {
			selectedServer = null;
		}
		mcpStore.deleteServer(id);
	}

	// Tool builder
	function startCreateTool() {
		if (!selectedServer) return;
		isToolCreating = true;
		isToolEditing = false;
		toolForm = {
			name: '',
			description: '',
			properties: [{ name: '', type: 'string', description: '', required: false }]
		};
	}

	function startEditTool(tool: MCPTool) {
		isToolEditing = true;
		isToolCreating = false;
		selectedTool = tool;
		toolForm = {
			name: tool.name,
			description: tool.description,
			properties: Object.entries(tool.inputSchema.properties).map(([name, prop]) => ({
				name,
				type: prop.type,
				description: prop.description || '',
				required: tool.inputSchema.required?.includes(name) || false,
				enum: prop.enum?.join(', ')
			}))
		};
	}

	function cancelToolEdit() {
		isToolEditing = false;
		isToolCreating = false;
		selectedTool = null;
	}

	function addToolProperty() {
		toolForm.properties = [...toolForm.properties, { name: '', type: 'string', description: '', required: false }];
	}

	function removeToolProperty(index: number) {
		toolForm.properties = toolForm.properties.filter((_, i) => i !== index);
	}

	function saveTool() {
		if (!selectedServer) return;

		const properties: Record<string, { type: string; description?: string; enum?: string[] }> = {};
		const required: string[] = [];

		for (const prop of toolForm.properties) {
			if (!prop.name) continue;
			properties[prop.name] = {
				type: prop.type,
				description: prop.description || undefined,
				enum: prop.enum ? prop.enum.split(',').map(s => s.trim()).filter(Boolean) : undefined
			};
			if (prop.required) {
				required.push(prop.name);
			}
		}

		const newTool: MCPTool = {
			name: toolForm.name,
			description: toolForm.description,
			inputSchema: {
				type: 'object',
				properties,
				required: required.length > 0 ? required : undefined
			}
		};

		if (isToolCreating) {
			mcpStore.addToolToServer(selectedServer.id, newTool);
		} else if (selectedTool) {
			mcpStore.deleteToolFromServer(selectedServer.id, selectedTool.name);
			mcpStore.addToolToServer(selectedServer.id, newTool);
		}

		cancelToolEdit();
	}

	// Playground
	function selectToolForTest(server: MCPServerConfig, tool: MCPTool) {
		selectedServer = server;
		selectedTool = tool;
		testToolArgs = {};
		testResult = null;
		viewMode = 'playground';

		// Initialize default values
		for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
			testToolArgs[key] = prop.default !== undefined ? String(prop.default) : '';
		}
	}

	async function executeTest() {
		if (!selectedServer || !selectedTool) return;

		isExecuting = true;
		testResult = null;

		// Parse arguments
		const args: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(testToolArgs)) {
			const prop = selectedTool.inputSchema.properties[key];
			if (prop) {
				if (prop.type === 'number') {
					args[key] = parseFloat(value) || 0;
				} else if (prop.type === 'boolean') {
					args[key] = value === 'true';
				} else if (prop.type === 'array' || prop.type === 'object') {
					try {
						args[key] = JSON.parse(value);
					} catch {
						args[key] = value;
					}
				} else {
					args[key] = value;
				}
			}
		}

		// Validate
		const validation = validateToolInput(selectedTool, args);
		if (!validation.valid) {
			testResult = {
				success: false,
				error: validation.errors.join('; ')
			};
			isExecuting = false;
			return;
		}

		const startTime = Date.now();

		// Simulate MCP call (in real implementation, this would call the actual MCP server)
		// For now, we'll simulate a response
		await new Promise(resolve => setTimeout(resolve, 500));

		const latencyMs = Date.now() - startTime;

		// Simulated result
		testResult = {
			success: true,
			result: {
				_note: 'This is a simulated response. Connect to a real MCP server for actual results.',
				tool: selectedTool.name,
				arguments: args,
				timestamp: new Date().toISOString()
			},
			latencyMs
		};

		// Record the call
		mcpStore.addToolCall({
			serverId: selectedServer.id,
			toolName: selectedTool.name,
			arguments: args,
			result: testResult.result,
			latencyMs,
			success: true
		});

		isExecuting = false;
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function getStatusColor(status: MCPServerConfig['status']) {
		switch (status) {
			case 'connected': return 'text-green-500';
			case 'connecting': return 'text-yellow-500';
			case 'error': return 'text-red-500';
			default: return 'text-muted-foreground';
		}
	}

	function getStatusBg(status: MCPServerConfig['status']) {
		switch (status) {
			case 'connected': return 'bg-green-500/10';
			case 'connecting': return 'bg-yellow-500/10';
			case 'error': return 'bg-red-500/10';
			default: return 'bg-muted';
		}
	}

	function formatTime(date: Date | string) {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		}).format(new Date(date));
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-border bg-card px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold">MCP Studio</h1>
				<p class="text-sm text-muted-foreground mt-1">
					Build, test, and manage Model Context Protocol servers
				</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => mcpStore.loadServers()}
					class="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
				>
					<RefreshCw class="h-4 w-4" />
					Refresh
				</button>
				<button
					type="button"
					onclick={startCreateServer}
					class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<Plus class="h-4 w-4" />
					Add Server
				</button>
			</div>
		</div>

		<!-- View Tabs -->
		<div class="flex gap-1 mt-4">
			<button
				type="button"
				onclick={() => (viewMode = 'servers')}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors {viewMode === 'servers' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
			>
				<Server class="h-4 w-4" />
				Servers
			</button>
			<button
				type="button"
				onclick={() => (viewMode = 'playground')}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors {viewMode === 'playground' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
			>
				<Play class="h-4 w-4" />
				Playground
			</button>
			<button
				type="button"
				onclick={() => (viewMode = 'builder')}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors {viewMode === 'builder' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
			>
				<Wrench class="h-4 w-4" />
				Tool Builder
			</button>
			<button
				type="button"
				onclick={() => (viewMode = 'history')}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors {viewMode === 'history' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
			>
				<History class="h-4 w-4" />
				History
				{#if toolCalls.length > 0}
					<span class="text-xs bg-muted px-1.5 py-0.5 rounded-full">{toolCalls.length}</span>
				{/if}
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden flex">
		<!-- Server List (Left Sidebar) -->
		<div class="w-80 border-r border-border bg-card overflow-y-auto">
			<div class="p-4">
				<h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
					MCP Servers ({servers.length})
				</h2>

				{#if servers.length === 0}
					<div class="text-center py-8">
						<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
							<Plug class="h-6 w-6 text-muted-foreground" />
						</div>
						<p class="text-sm text-muted-foreground">No servers configured</p>
						<button
							type="button"
							onclick={startCreateServer}
							class="mt-3 text-sm text-primary hover:underline"
						>
							Add your first server
						</button>
					</div>
				{:else}
					<div class="space-y-2">
						{#each servers as server}
							<div class="rounded-lg border border-border overflow-hidden">
								<div class="relative group">
									<button
										type="button"
										onclick={() => toggleServerExpand(server.id)}
										class="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors {selectedServer?.id === server.id ? 'bg-primary/5' : ''}"
									>
										<div class="rounded-lg p-2 {getStatusBg(server.status)}">
											<Plug class="h-4 w-4 {getStatusColor(server.status)}" />
										</div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<p class="font-medium truncate">{server.name}</p>
												{#if server.enabled}
													<span class="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">ON</span>
												{/if}
											</div>
											<p class="text-xs text-muted-foreground truncate">
												{server.tools.length} tools · {server.transport}
											</p>
										</div>
										{#if expandedServers.has(server.id)}
											<ChevronDown class="h-4 w-4 text-muted-foreground" />
										{:else}
											<ChevronRight class="h-4 w-4 text-muted-foreground" />
										{/if}
									</button>
									<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											onclick={(e) => { e.stopPropagation(); toggleServerEnabled(server); }}
											class="p-1.5 rounded hover:bg-muted transition-colors"
											title={server.enabled ? 'Disable' : 'Enable'}
										>
											{#if server.enabled}
												<Power class="h-3.5 w-3.5 text-green-500" />
											{:else}
												<PowerOff class="h-3.5 w-3.5 text-muted-foreground" />
											{/if}
										</button>
									</div>
								</div>

								{#if expandedServers.has(server.id)}
									<div class="border-t border-border bg-muted/30">
										{#if server.tools.length === 0}
											<div class="p-3 text-center text-xs text-muted-foreground">
												No tools discovered
											</div>
										{:else}
											<div class="divide-y divide-border">
												{#each server.tools as tool}
													<button
														type="button"
														onclick={() => selectToolForTest(server, tool)}
														class="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted transition-colors text-sm"
													>
														<Zap class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
														<span class="font-mono truncate">{tool.name}</span>
													</button>
												{/each}
											</div>
										{/if}

										<div class="p-2 border-t border-border flex gap-1">
											<button
												type="button"
												onclick={() => startEditServer(server)}
												class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
											>
												<Edit3 class="h-3 w-3" />
												Edit
											</button>
											<button
												type="button"
												onclick={() => { selectedServer = server; viewMode = 'builder'; }}
												class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
											>
												<Plus class="h-3 w-3" />
												Add Tool
											</button>
											<button
												type="button"
												onclick={() => deleteServer(server.id)}
												class="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
											>
												<Trash2 class="h-3 w-3" />
											</button>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Main Content -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if isCreating || isEditing}
				<!-- Server Editor -->
				<div class="max-w-2xl">
					<div class="rounded-xl border border-border bg-card p-6">
						<div class="flex items-center justify-between mb-6">
							<h2 class="text-lg font-semibold">
								{isCreating ? 'Add MCP Server' : 'Edit Server'}
							</h2>
							<button
								type="button"
								onclick={cancelEdit}
								class="rounded-lg p-2 hover:bg-muted transition-colors"
							>
								<X class="h-4 w-4" />
							</button>
						</div>

						<div class="space-y-4">
							<div>
								<label for="server-name" class="block text-sm font-medium mb-1">Name</label>
								<input
									id="server-name"
									type="text"
									bind:value={editForm.name}
									placeholder="My MCP Server"
									class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>

							<div>
								<label for="server-desc" class="block text-sm font-medium mb-1">Description</label>
								<input
									id="server-desc"
									type="text"
									bind:value={editForm.description}
									placeholder="What does this server do?"
									class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>

							<div>
								<label for="server-transport" class="block text-sm font-medium mb-1">Transport</label>
								<select
									id="server-transport"
									bind:value={editForm.transport}
									class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="stdio">Standard I/O (stdio)</option>
									<option value="sse">Server-Sent Events (SSE)</option>
									<option value="http">HTTP</option>
								</select>
							</div>

							{#if editForm.transport === 'stdio'}
								<div>
									<label for="server-command" class="block text-sm font-medium mb-1">Command</label>
									<input
										id="server-command"
										type="text"
										bind:value={editForm.command}
										placeholder="npx"
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>

								<div>
									<label for="server-args" class="block text-sm font-medium mb-1">Arguments</label>
									<input
										id="server-args"
										type="text"
										bind:value={editForm.args}
										placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									<p class="text-xs text-muted-foreground mt-1">Space-separated arguments</p>
								</div>
							{:else}
								<div>
									<label for="server-url" class="block text-sm font-medium mb-1">URL</label>
									<input
										id="server-url"
										type="text"
										bind:value={editForm.url}
										placeholder="http://localhost:3000/mcp"
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
							{/if}

							<div>
								<label for="server-env" class="block text-sm font-medium mb-1">Environment Variables</label>
								<textarea
									id="server-env"
									bind:value={editForm.env}
									placeholder="API_KEY=your_key_here&#10;ANOTHER_VAR=value"
									rows="3"
									class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
								></textarea>
								<p class="text-xs text-muted-foreground mt-1">One per line: KEY=value</p>
							</div>

							<div class="flex justify-end gap-3 pt-4">
								<button
									type="button"
									onclick={cancelEdit}
									class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
								>
									Cancel
								</button>
								<button
									type="button"
									onclick={saveServer}
									disabled={!editForm.name}
									class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
								>
									{isCreating ? 'Add Server' : 'Save Changes'}
								</button>
							</div>
						</div>
					</div>
				</div>
			{:else if viewMode === 'servers'}
				<!-- Servers Overview -->
				<div class="space-y-6">
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each servers as server}
							<div class="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors">
								<div class="p-4">
									<div class="flex items-start justify-between">
										<div class="flex items-center gap-3">
											<div class="rounded-lg p-2.5 {getStatusBg(server.status)}">
												<Plug class="h-5 w-5 {getStatusColor(server.status)}" />
											</div>
											<div>
												<h3 class="font-semibold">{server.name}</h3>
												<p class="text-xs text-muted-foreground">{server.transport}</p>
											</div>
										</div>
										<button
											type="button"
											onclick={() => toggleServerEnabled(server)}
											class="rounded-lg p-1.5 hover:bg-muted transition-colors"
										>
											{#if server.enabled}
												<Power class="h-4 w-4 text-green-500" />
											{:else}
												<PowerOff class="h-4 w-4 text-muted-foreground" />
											{/if}
										</button>
									</div>

									{#if server.description}
										<p class="text-sm text-muted-foreground mt-3 line-clamp-2">
											{server.description}
										</p>
									{/if}

									<div class="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
										<span class="flex items-center gap-1">
											<Zap class="h-3.5 w-3.5" />
											{server.tools.length} tools
										</span>
										{#if server.status === 'error' && server.lastError}
											<span class="flex items-center gap-1 text-destructive">
												<AlertCircle class="h-3.5 w-3.5" />
												Error
											</span>
										{/if}
									</div>
								</div>

								<div class="border-t border-border p-3 bg-muted/30 flex gap-2">
									<button
										type="button"
										onclick={() => startEditServer(server)}
										class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors"
									>
										<Settings class="h-3.5 w-3.5" />
										Configure
									</button>
									<button
										type="button"
										onclick={() => { selectedServer = server; viewMode = 'playground'; }}
										class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
									>
										<Play class="h-3.5 w-3.5" />
										Test
									</button>
								</div>
							</div>
						{/each}
					</div>

					<!-- Discovery Section -->
					<div class="rounded-xl border border-border bg-card p-6">
						<h2 class="font-semibold mb-2">Discover MCP Servers</h2>
						<p class="text-sm text-muted-foreground mb-4">
							Browse popular servers from the Model Context Protocol community
						</p>
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{#each [
								{ name: 'filesystem', desc: 'File system access' },
								{ name: 'memory', desc: 'Persistent memory' },
								{ name: 'brave-search', desc: 'Web search' },
								{ name: 'github', desc: 'GitHub integration' },
								{ name: 'sqlite', desc: 'SQLite database' },
								{ name: 'puppeteer', desc: 'Browser automation' },
								{ name: 'postgres', desc: 'PostgreSQL database' },
								{ name: 'slack', desc: 'Slack integration' }
							] as server}
								<button
									type="button"
									class="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/50 transition-colors"
								>
									<p class="font-mono text-sm">{server.name}</p>
									<p class="text-xs text-muted-foreground">{server.desc}</p>
								</button>
							{/each}
						</div>
					</div>
				</div>
			{:else if viewMode === 'playground'}
				<!-- Testing Playground -->
				<div class="max-w-4xl">
					{#if !selectedServer || !selectedTool}
						<div class="text-center py-12">
							<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
								<Play class="h-8 w-8 text-muted-foreground" />
							</div>
							<h3 class="font-semibold mb-2">Select a Tool to Test</h3>
							<p class="text-sm text-muted-foreground">
								Choose a tool from the server list on the left to start testing
							</p>
						</div>
					{:else}
						<div class="space-y-6">
							<!-- Tool Info -->
							<div class="rounded-xl border border-border bg-card p-6">
								<div class="flex items-start justify-between mb-4">
									<div>
										<div class="flex items-center gap-2">
											<Zap class="h-5 w-5 text-primary" />
											<h2 class="text-lg font-semibold font-mono">{selectedTool.name}</h2>
										</div>
										<p class="text-sm text-muted-foreground mt-1">{selectedTool.description}</p>
										<p class="text-xs text-muted-foreground mt-1">
											Server: {selectedServer.name}
										</p>
									</div>
									<button
										type="button"
										onclick={() => copyToClipboard(JSON.stringify(generateMCPToolSchema(selectedTool), null, 2))}
										class="rounded-lg p-2 hover:bg-muted transition-colors"
										title="Copy schema"
									>
										<Copy class="h-4 w-4" />
									</button>
								</div>

								<!-- Input Form -->
								<div class="space-y-4">
									<h3 class="text-sm font-medium">Arguments</h3>

									{#each Object.entries(selectedTool.inputSchema.properties) as [key, prop]}
										<div>
											<label for="arg-{key}" class="flex items-center gap-2 text-sm font-medium mb-1">
												<span class="font-mono">{key}</span>
												<span class="text-xs text-muted-foreground">({prop.type})</span>
												{#if selectedTool.inputSchema.required?.includes(key)}
													<span class="text-xs text-destructive">*</span>
												{/if}
											</label>
											{#if prop.enum}
												<select
													id="arg-{key}"
													bind:value={testToolArgs[key]}
													class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
												>
													<option value="">Select...</option>
													{#each prop.enum as option}
														<option value={option}>{option}</option>
													{/each}
												</select>
											{:else if prop.type === 'boolean'}
												<select
													id="arg-{key}"
													bind:value={testToolArgs[key]}
													class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
												>
													<option value="">Select...</option>
													<option value="true">true</option>
													<option value="false">false</option>
												</select>
											{:else if prop.type === 'array' || prop.type === 'object'}
												<textarea
													id="arg-{key}"
													bind:value={testToolArgs[key]}
													placeholder={prop.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
													rows="2"
													class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
												></textarea>
											{:else}
												<input
													id="arg-{key}"
													type={prop.type === 'number' ? 'number' : 'text'}
													bind:value={testToolArgs[key]}
													placeholder={prop.description || ''}
													class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
												/>
											{/if}
											{#if prop.description}
												<p class="text-xs text-muted-foreground mt-1">{prop.description}</p>
											{/if}
										</div>
									{/each}

									<button
										type="button"
										onclick={executeTest}
										disabled={isExecuting}
										class="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
									>
										{#if isExecuting}
											<RefreshCw class="h-4 w-4 animate-spin" />
											Executing...
										{:else}
											<Play class="h-4 w-4" />
											Execute Tool
										{/if}
									</button>
								</div>
							</div>

							<!-- Result -->
							{#if testResult}
								<div class="rounded-xl border border-border bg-card overflow-hidden">
									<div class="flex items-center justify-between border-b border-border px-4 py-3 {testResult.success ? 'bg-green-500/10' : 'bg-red-500/10'}">
										<div class="flex items-center gap-2">
											{#if testResult.success}
												<CheckCircle class="h-4 w-4 text-green-500" />
												<span class="font-medium text-green-500">Success</span>
											{:else}
												<AlertCircle class="h-4 w-4 text-destructive" />
												<span class="font-medium text-destructive">Error</span>
											{/if}
										</div>
										{#if testResult.latencyMs}
											<span class="text-xs text-muted-foreground flex items-center gap-1">
												<Clock class="h-3 w-3" />
												{testResult.latencyMs}ms
											</span>
										{/if}
									</div>
									<div class="p-4">
										<pre class="text-sm font-mono overflow-x-auto whitespace-pre-wrap bg-muted p-4 rounded-lg">{JSON.stringify(testResult.success ? testResult.result : testResult.error, null, 2)}</pre>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else if viewMode === 'builder'}
				<!-- Tool Builder -->
				<div class="max-w-3xl">
					{#if !selectedServer}
						<div class="text-center py-12">
							<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
								<Wrench class="h-8 w-8 text-muted-foreground" />
							</div>
							<h3 class="font-semibold mb-2">Select a Server First</h3>
							<p class="text-sm text-muted-foreground">
								Choose a server from the list to add or edit tools
							</p>
						</div>
					{:else if isToolCreating || isToolEditing}
						<!-- Tool Editor -->
						<div class="rounded-xl border border-border bg-card p-6">
							<div class="flex items-center justify-between mb-6">
								<h2 class="text-lg font-semibold">
									{isToolCreating ? 'Create Tool' : 'Edit Tool'}
								</h2>
								<button
									type="button"
									onclick={cancelToolEdit}
									class="rounded-lg p-2 hover:bg-muted transition-colors"
								>
									<X class="h-4 w-4" />
								</button>
							</div>

							<div class="space-y-4">
								<div>
									<label for="tool-name" class="block text-sm font-medium mb-1">Tool Name</label>
									<input
										id="tool-name"
										type="text"
										bind:value={toolForm.name}
										placeholder="my_tool_name"
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>

								<div>
									<label for="tool-desc" class="block text-sm font-medium mb-1">Description</label>
									<textarea
										id="tool-desc"
										bind:value={toolForm.description}
										placeholder="What does this tool do?"
										rows="2"
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
									></textarea>
								</div>

								<div>
									<div class="flex items-center justify-between mb-2">
										<span class="block text-sm font-medium">Parameters</span>
										<button
											type="button"
											onclick={addToolProperty}
											class="text-xs text-primary hover:underline flex items-center gap-1"
										>
											<Plus class="h-3 w-3" />
											Add Parameter
										</button>
									</div>

									<div class="space-y-3">
										{#each toolForm.properties as prop, index}
											<div class="rounded-lg border border-border p-3 bg-muted/30">
												<div class="grid grid-cols-2 gap-3 mb-3">
													<div>
														<label for="prop-name-{index}" class="text-xs font-medium mb-1 block">Name</label>
														<input
															id="prop-name-{index}"
															type="text"
															bind:value={prop.name}
															placeholder="param_name"
															class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
														/>
													</div>
													<div>
														<label for="prop-type-{index}" class="text-xs font-medium mb-1 block">Type</label>
														<select
															id="prop-type-{index}"
															bind:value={prop.type}
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
												<div class="mb-3">
													<label for="prop-desc-{index}" class="text-xs font-medium mb-1 block">Description</label>
													<input
														id="prop-desc-{index}"
														type="text"
														bind:value={prop.description}
														placeholder="What is this parameter for?"
														class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
													/>
												</div>
												<div class="flex items-center justify-between">
													<label class="flex items-center gap-2 text-sm">
														<input
															type="checkbox"
															bind:checked={prop.required}
															class="rounded border-border"
														/>
														Required
													</label>
													<button
														type="button"
														onclick={() => removeToolProperty(index)}
														class="text-xs text-destructive hover:underline"
													>
														Remove
													</button>
												</div>
											</div>
										{/each}
									</div>
								</div>

								<div class="flex justify-end gap-3 pt-4">
									<button
										type="button"
										onclick={cancelToolEdit}
										class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
									>
										Cancel
									</button>
									<button
										type="button"
										onclick={saveTool}
										disabled={!toolForm.name || !toolForm.description}
										class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
									>
										{isToolCreating ? 'Create Tool' : 'Save Changes'}
									</button>
								</div>
							</div>
						</div>
					{:else}
						<!-- Server Tools List -->
						<div class="rounded-xl border border-border bg-card overflow-hidden">
							<div class="flex items-center justify-between border-b border-border p-4">
								<div>
									<h2 class="font-semibold">{selectedServer.name}</h2>
									<p class="text-sm text-muted-foreground">{selectedServer.tools.length} tools defined</p>
								</div>
								<button
									type="button"
									onclick={startCreateTool}
									class="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
								>
									<Plus class="h-4 w-4" />
									New Tool
								</button>
							</div>

							{#if selectedServer.tools.length === 0}
								<div class="p-8 text-center">
									<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
										<Zap class="h-6 w-6 text-muted-foreground" />
									</div>
									<p class="text-sm text-muted-foreground mb-3">No tools yet</p>
									<button
										type="button"
										onclick={startCreateTool}
										class="text-sm text-primary hover:underline"
									>
										Create your first tool
									</button>
								</div>
							{:else}
								<div class="divide-y divide-border">
									{#each selectedServer.tools as tool}
										<div class="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
											<div class="flex items-center gap-3">
												<Zap class="h-4 w-4 text-muted-foreground" />
												<div>
													<p class="font-mono text-sm">{tool.name}</p>
													<p class="text-xs text-muted-foreground">{tool.description}</p>
												</div>
											</div>
											<div class="flex items-center gap-1">
												<button
													type="button"
													onclick={() => selectToolForTest(selectedServer, tool)}
													class="rounded-lg p-1.5 hover:bg-muted transition-colors"
													title="Test"
												>
													<Play class="h-4 w-4" />
												</button>
												<button
													type="button"
													onclick={() => startEditTool(tool)}
													class="rounded-lg p-1.5 hover:bg-muted transition-colors"
													title="Edit"
												>
													<Edit3 class="h-4 w-4" />
												</button>
												<button
													type="button"
													onclick={() => mcpStore.deleteToolFromServer(selectedServer.id, tool.name)}
													class="rounded-lg p-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
													title="Delete"
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- JSON Schema Preview -->
						{#if selectedServer.tools.length > 0}
							<div class="mt-6 rounded-xl border border-border bg-card overflow-hidden">
								<div class="flex items-center justify-between border-b border-border px-4 py-3">
									<div class="flex items-center gap-2">
										<FileJson class="h-4 w-4 text-muted-foreground" />
										<span class="font-medium text-sm">MCP Tool Schema</span>
									</div>
									<button
										type="button"
										onclick={() => copyToClipboard(JSON.stringify(selectedServer.tools.map(generateMCPToolSchema), null, 2))}
										class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										<Copy class="h-3 w-3" />
										Copy
									</button>
								</div>
								<pre class="p-4 text-xs font-mono overflow-x-auto max-h-64 bg-muted/30">{JSON.stringify(selectedServer.tools.map(generateMCPToolSchema), null, 2)}</pre>
							</div>
						{/if}
					{/if}
				</div>
			{:else if viewMode === 'history'}
				<!-- Call History -->
				<div class="max-w-4xl">
					<div class="rounded-xl border border-border bg-card overflow-hidden">
						<div class="flex items-center justify-between border-b border-border p-4">
							<h2 class="font-semibold">Tool Call History</h2>
							{#if toolCalls.length > 0}
								<button
									type="button"
									onclick={() => mcpStore.clearToolCalls()}
									class="text-xs text-muted-foreground hover:text-destructive transition-colors"
								>
									Clear History
								</button>
							{/if}
						</div>

						{#if toolCalls.length === 0}
							<div class="p-8 text-center">
								<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
									<History class="h-6 w-6 text-muted-foreground" />
								</div>
								<p class="text-sm text-muted-foreground">No tool calls yet</p>
								<p class="text-xs text-muted-foreground mt-1">Execute tools in the playground to see history</p>
							</div>
						{:else}
							<div class="divide-y divide-border">
								{#each toolCalls as call}
									<div class="p-4">
										<div class="flex items-start justify-between mb-2">
											<div class="flex items-center gap-2">
												{#if call.success}
													<CheckCircle class="h-4 w-4 text-green-500" />
												{:else}
													<AlertCircle class="h-4 w-4 text-destructive" />
												{/if}
												<span class="font-mono text-sm">{call.toolName}</span>
											</div>
											<div class="flex items-center gap-3 text-xs text-muted-foreground">
												<span>{call.latencyMs}ms</span>
												<span>{formatTime(call.timestamp)}</span>
											</div>
										</div>
										<div class="grid grid-cols-2 gap-4 mt-3">
											<div>
												<p class="text-xs text-muted-foreground mb-1">Arguments</p>
												<pre class="text-xs font-mono p-2 rounded bg-muted overflow-x-auto">{JSON.stringify(call.arguments, null, 2)}</pre>
											</div>
											<div>
												<p class="text-xs text-muted-foreground mb-1">Result</p>
												<pre class="text-xs font-mono p-2 rounded bg-muted overflow-x-auto">{JSON.stringify(call.success ? call.result : call.error, null, 2)}</pre>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
