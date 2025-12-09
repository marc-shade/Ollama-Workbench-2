<script lang="ts">
	import { modelsStore, type Model } from '$stores/models';
	import { onMount } from 'svelte';
	import {
		Download,
		Trash2,
		RefreshCw,
		HardDrive,
		Cpu,
		Calendar,
		ChevronDown,
		ChevronRight,
		Search,
		X,
		AlertCircle,
		CheckCircle,
		Loader2
	} from 'lucide-svelte';

	let searchQuery = $state('');
	let pullModelName = $state('');
	let pullProgress = $state<number | null>(null);
	let pullStatus = $state<'idle' | 'pulling' | 'success' | 'error'>('idle');
	let pullError = $state<string | null>(null);
	let expandedModel = $state<string | null>(null);
	let deleteConfirm = $state<string | null>(null);

	const filteredModels = $derived(
		$modelsStore.models.filter((m) =>
			m.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	const totalSize = $derived(
		$modelsStore.models.reduce((acc, m) => acc + m.size, 0)
	);

	onMount(() => {
		modelsStore.fetchModels();
	});

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	async function handlePullModel() {
		if (!pullModelName.trim()) return;

		pullStatus = 'pulling';
		pullProgress = 0;
		pullError = null;

		try {
			await modelsStore.pullModel(pullModelName.trim(), (progress) => {
				pullProgress = progress;
			});
			pullStatus = 'success';
			pullModelName = '';
			await modelsStore.fetchModels();
			setTimeout(() => {
				pullStatus = 'idle';
				pullProgress = null;
			}, 3000);
		} catch (e) {
			pullStatus = 'error';
			pullError = e instanceof Error ? e.message : 'Failed to pull model';
		}
	}

	async function handleDeleteModel(name: string) {
		try {
			await modelsStore.deleteModel(name);
			await modelsStore.fetchModels();
			deleteConfirm = null;
		} catch (e) {
			console.error('Failed to delete model:', e);
		}
	}

	function toggleExpand(name: string) {
		expandedModel = expandedModel === name ? null : name;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-border bg-card px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold">Models</h1>
				<p class="text-sm text-muted-foreground mt-1">
					Manage your local Ollama models
				</p>
			</div>
			<div class="flex items-center gap-3">
				<div class="text-right">
					<p class="text-sm font-medium">{$modelsStore.models.length} models</p>
					<p class="text-xs text-muted-foreground">{formatSize(totalSize)} total</p>
				</div>
				<button
					onclick={() => modelsStore.fetchModels()}
					disabled={$modelsStore.loading}
					class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
				>
					<RefreshCw class="h-4 w-4 {$modelsStore.loading ? 'animate-spin' : ''}" />
					Refresh
				</button>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6 space-y-6">
		<!-- Pull Model Section -->
		<div class="rounded-xl border border-border bg-card p-4">
			<h2 class="font-semibold mb-3 flex items-center gap-2">
				<Download class="h-4 w-4" />
				Pull New Model
			</h2>
			<div class="flex gap-3">
				<div class="flex-1 relative">
					<input
						type="text"
						bind:value={pullModelName}
						placeholder="Enter model name (e.g., llama3.2, codellama:7b)"
						disabled={pullStatus === 'pulling'}
						class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
						onkeydown={(e) => e.key === 'Enter' && handlePullModel()}
					/>
				</div>
				<button
					onclick={handlePullModel}
					disabled={!pullModelName.trim() || pullStatus === 'pulling'}
					class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
				>
					{#if pullStatus === 'pulling'}
						<Loader2 class="h-4 w-4 animate-spin" />
						Pulling...
					{:else}
						<Download class="h-4 w-4" />
						Pull Model
					{/if}
				</button>
			</div>

			{#if pullStatus === 'pulling' && pullProgress !== null}
				<div class="mt-3">
					<div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
						<span>Downloading {pullModelName}...</span>
						<span>{pullProgress.toFixed(1)}%</span>
					</div>
					<div class="h-2 rounded-full bg-muted overflow-hidden">
						<div
							class="h-full bg-primary transition-all duration-300"
							style="width: {pullProgress}%"
						></div>
					</div>
				</div>
			{/if}

			{#if pullStatus === 'success'}
				<div class="mt-3 flex items-center gap-2 text-sm text-green-500">
					<CheckCircle class="h-4 w-4" />
					Model pulled successfully!
				</div>
			{/if}

			{#if pullStatus === 'error' && pullError}
				<div class="mt-3 flex items-center gap-2 text-sm text-red-500">
					<AlertCircle class="h-4 w-4" />
					{pullError}
				</div>
			{/if}
		</div>

		<!-- Search -->
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search models..."
				class="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			{#if searchQuery}
				<button
					onclick={() => (searchQuery = '')}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>

		<!-- Models List -->
		{#if $modelsStore.loading && $modelsStore.models.length === 0}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else if $modelsStore.error}
			<div class="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-center">
				<AlertCircle class="h-8 w-8 mx-auto mb-2 text-red-500" />
				<p class="text-sm text-red-500">{$modelsStore.error}</p>
				<button
					onclick={() => modelsStore.fetchModels()}
					class="mt-2 text-sm text-red-500 underline hover:no-underline"
				>
					Try again
				</button>
			</div>
		{:else if filteredModels.length === 0}
			<div class="rounded-xl border border-border bg-card p-8 text-center">
				<HardDrive class="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
				<h3 class="font-medium mb-1">No models found</h3>
				<p class="text-sm text-muted-foreground">
					{searchQuery ? 'Try a different search term' : 'Pull a model to get started'}
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each filteredModels as model}
					<div class="rounded-xl border border-border bg-card overflow-hidden">
						<!-- Model Header -->
						<div
							class="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
							onclick={() => toggleExpand(model.name)}
							onkeydown={(e) => e.key === 'Enter' && toggleExpand(model.name)}
							tabindex="0"
							role="button"
						>
							<div class="flex-shrink-0">
								{#if expandedModel === model.name}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
							</div>

							<div class="flex-1 min-w-0">
								<h3 class="font-medium truncate">{model.name}</h3>
								<div class="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
									<span class="flex items-center gap-1">
										<HardDrive class="h-3 w-3" />
										{formatSize(model.size)}
									</span>
									<span class="flex items-center gap-1">
										<Calendar class="h-3 w-3" />
										{formatDate(model.modified_at)}
									</span>
									{#if model.details?.parameter_size}
										<span class="flex items-center gap-1">
											<Cpu class="h-3 w-3" />
											{model.details.parameter_size}
										</span>
									{/if}
								</div>
							</div>

							<div class="flex items-center gap-2">
								{#if deleteConfirm === model.name}
									<span class="text-xs text-red-500 mr-2">Delete?</span>
									<button
										onclick={(e) => { e.stopPropagation(); handleDeleteModel(model.name); }}
										class="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors"
									>
										Confirm
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); deleteConfirm = null; }}
										class="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
									>
										Cancel
									</button>
								{:else}
									<button
										onclick={(e) => { e.stopPropagation(); deleteConfirm = model.name; }}
										class="rounded-lg border border-border p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-colors"
										title="Delete model"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedModel === model.name && model.details}
							<div class="border-t border-border px-4 py-3 bg-muted/30">
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
									{#if model.details.family}
										<div>
											<p class="text-xs text-muted-foreground">Family</p>
											<p class="text-sm font-medium">{model.details.family}</p>
										</div>
									{/if}
									{#if model.details.parameter_size}
										<div>
											<p class="text-xs text-muted-foreground">Parameters</p>
											<p class="text-sm font-medium">{model.details.parameter_size}</p>
										</div>
									{/if}
									{#if model.details.quantization_level}
										<div>
											<p class="text-xs text-muted-foreground">Quantization</p>
											<p class="text-sm font-medium">{model.details.quantization_level}</p>
										</div>
									{/if}
									{#if model.details.format}
										<div>
											<p class="text-xs text-muted-foreground">Format</p>
											<p class="text-sm font-medium">{model.details.format}</p>
										</div>
									{/if}
								</div>
								{#if model.digest}
									<div class="mt-3 pt-3 border-t border-border">
										<p class="text-xs text-muted-foreground">Digest</p>
										<p class="text-xs font-mono text-muted-foreground truncate">{model.digest}</p>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
