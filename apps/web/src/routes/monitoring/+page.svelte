<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { settingsStore } from '$stores/settings';
	import {
		Activity,
		Server,
		Cpu,
		HardDrive,
		Clock,
		RefreshCw,
		CheckCircle,
		XCircle,
		Loader2,
		Zap,
		Database,
		Play,
		Square
	} from 'lucide-svelte';

	interface RunningModel {
		name: string;
		size: number;
		vram_size: number;
		expires_at: string;
		processor: string;
	}

	interface InstalledModel {
		name: string;
		size: number;
		modified_at: string;
		parameter_size: string;
		quantization: string;
		family: string;
	}

	interface ServerStatus {
		host: string;
		connected: boolean;
		version: string | null;
		running_models: RunningModel[];
		installed_models: InstalledModel[];
		model_count: number;
		running_count: number;
		latency_ms: number;
		error: string | null;
	}

	let status = $state<ServerStatus | null>(null);
	let loading = $state(false);
	let autoRefresh = $state(true);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let lastUpdated = $state<Date | null>(null);

	async function fetchStatus() {
		loading = true;
		try {
			const res = await fetch('/api/ollama/status');
			if (res.ok) {
				status = await res.json();
				lastUpdated = new Date();
			}
		} catch (err) {
			status = {
				host: $settingsStore.ollamaHost,
				connected: false,
				version: null,
				running_models: [],
				installed_models: [],
				model_count: 0,
				running_count: 0,
				latency_ms: 0,
				error: err instanceof Error ? err.message : 'Connection failed'
			};
		}
		loading = false;
	}

	function formatBytes(bytes: number): string {
		if (!bytes) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		return date.toLocaleString();
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	}

	function startAutoRefresh() {
		if (refreshInterval) return;
		refreshInterval = setInterval(fetchStatus, 5000);
	}

	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	onMount(() => {
		fetchStatus();
		if (autoRefresh) {
			startAutoRefresh();
		}
	});

	onDestroy(() => {
		stopAutoRefresh();
	});
</script>

<div class="mx-auto max-w-6xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<Activity class="h-6 w-6" />
				Server Monitoring
			</h1>
			<p class="text-muted-foreground">Real-time Ollama server status and metrics</p>
		</div>
		<div class="flex items-center gap-3">
			{#if lastUpdated}
				<span class="text-xs text-muted-foreground">
					Last updated: {lastUpdated.toLocaleTimeString()}
				</span>
			{/if}
			<button
				onclick={toggleAutoRefresh}
				class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors {autoRefresh ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}"
			>
				{#if autoRefresh}
					<Play class="h-4 w-4" />
					Auto-refresh ON
				{:else}
					<Square class="h-4 w-4" />
					Auto-refresh OFF
				{/if}
			</button>
			<button
				onclick={fetchStatus}
				disabled={loading}
				class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
				Refresh
			</button>
		</div>
	</div>

	{#if !status && loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else if status}
		<!-- Connection Status Card -->
		<div class="grid gap-4 md:grid-cols-4">
			<div class="rounded-xl border border-border bg-card p-4">
				<div class="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Server class="h-4 w-4" />
					Connection
				</div>
				<div class="flex items-center gap-2">
					{#if status.connected}
						<CheckCircle class="h-5 w-5 text-green-500" />
						<span class="text-lg font-semibold text-green-500">Connected</span>
					{:else}
						<XCircle class="h-5 w-5 text-red-500" />
						<span class="text-lg font-semibold text-red-500">Disconnected</span>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground mt-1 truncate" title={status.host}>
					{status.host}
				</p>
			</div>

			<div class="rounded-xl border border-border bg-card p-4">
				<div class="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Zap class="h-4 w-4" />
					Version
				</div>
				<p class="text-lg font-semibold">
					{status.version || 'Unknown'}
				</p>
				<p class="text-xs text-muted-foreground mt-1">Ollama Server</p>
			</div>

			<div class="rounded-xl border border-border bg-card p-4">
				<div class="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Clock class="h-4 w-4" />
					Latency
				</div>
				<p class="text-lg font-semibold">
					{status.latency_ms} ms
				</p>
				<p class="text-xs text-muted-foreground mt-1">Response time</p>
			</div>

			<div class="rounded-xl border border-border bg-card p-4">
				<div class="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Database class="h-4 w-4" />
					Models
				</div>
				<p class="text-lg font-semibold">
					{status.running_count} / {status.model_count}
				</p>
				<p class="text-xs text-muted-foreground mt-1">Running / Installed</p>
			</div>
		</div>

		{#if status.error}
			<div class="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
				<p class="text-sm text-red-500 font-medium">Error</p>
				<p class="text-sm text-red-400">{status.error}</p>
			</div>
		{/if}

		<!-- Running Models -->
		<div class="rounded-xl border border-border bg-card p-6">
			<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
				<Cpu class="h-5 w-5" />
				Running Models
				{#if status.running_count > 0}
					<span class="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-500">
						{status.running_count} active
					</span>
				{/if}
			</h2>
			{#if status.running_models.length > 0}
				<div class="space-y-3">
					{#each status.running_models as model}
						<div class="rounded-lg border border-border p-4 bg-background">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<div class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
									<span class="font-medium">{model.name}</span>
								</div>
								<span class="text-xs px-2 py-0.5 rounded bg-muted uppercase">
									{model.processor || 'cpu'}
								</span>
							</div>
							<div class="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
								<div>
									<p class="text-xs uppercase tracking-wide mb-1">Memory</p>
									<p class="font-mono">{formatBytes(model.size)}</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wide mb-1">VRAM</p>
									<p class="font-mono">{formatBytes(model.vram_size)}</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wide mb-1">Expires</p>
									<p class="font-mono text-xs">{formatDate(model.expires_at)}</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground text-center py-8">
					No models currently running. Start a chat to load a model.
				</p>
			{/if}
		</div>

		<!-- Installed Models -->
		<div class="rounded-xl border border-border bg-card p-6">
			<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
				<HardDrive class="h-5 w-5" />
				Installed Models
				<span class="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
					{status.model_count} total
				</span>
			</h2>
			{#if status.installed_models.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border">
								<th class="text-left py-2 px-3 font-medium">Model</th>
								<th class="text-left py-2 px-3 font-medium">Family</th>
								<th class="text-left py-2 px-3 font-medium">Parameters</th>
								<th class="text-left py-2 px-3 font-medium">Quantization</th>
								<th class="text-right py-2 px-3 font-medium">Size</th>
								<th class="text-right py-2 px-3 font-medium">Modified</th>
							</tr>
						</thead>
						<tbody>
							{#each status.installed_models as model}
								<tr class="border-b border-border/50 hover:bg-muted/50">
									<td class="py-2 px-3 font-medium">{model.name}</td>
									<td class="py-2 px-3 text-muted-foreground">{model.family || '-'}</td>
									<td class="py-2 px-3 text-muted-foreground">{model.parameter_size || '-'}</td>
									<td class="py-2 px-3">
										{#if model.quantization}
											<span class="px-1.5 py-0.5 text-xs rounded bg-muted">
												{model.quantization}
											</span>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</td>
									<td class="py-2 px-3 text-right font-mono text-muted-foreground">
										{formatBytes(model.size)}
									</td>
									<td class="py-2 px-3 text-right text-muted-foreground text-xs">
										{formatDate(model.modified_at)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground text-center py-8">
					No models installed. Go to the <a href="/models" class="text-primary hover:underline">Models</a> page to download models.
				</p>
			{/if}
		</div>
	{/if}
</div>
