<script lang="ts">
	import { connectionStore, isConnected } from '$stores/connection';
	import { modelsStore } from '$stores/models';
	import { settingsStore } from '$stores/settings';
	import { onMount } from 'svelte';
	import {
		Circle,
		Sun,
		Moon,
		RefreshCw,
		ChevronDown,
		AlertCircle
	} from 'lucide-svelte';

	let showModelDropdown = $state(false);

	// Embedding model patterns to filter out from chat models
	const EMBEDDING_PATTERNS = ['embed', 'bge-', 'nomic-embed', 'snowflake-arctic-embed', 'mxbai-embed'];

	function isEmbeddingModel(name: string): boolean {
		const lowerName = name.toLowerCase();
		return EMBEDDING_PATTERNS.some(pattern => lowerName.includes(pattern));
	}

	// Get chat-capable models (exclude embedding models)
	const chatModels = $derived(
		$modelsStore.models.filter(m => !isEmbeddingModel(m.name))
	);

	// Check if current model exists in available models
	const modelExists = $derived(
		$modelsStore.models.some(m => m.name === $settingsStore.defaultModel)
	);

	// Auto-select first available chat model if current doesn't exist
	$effect(() => {
		if (!$modelsStore.loading && $modelsStore.models.length > 0 && !modelExists) {
			const firstChatModel = chatModels[0];
			if (firstChatModel) {
				console.log(`Auto-selecting model: ${firstChatModel.name} (previous: ${$settingsStore.defaultModel})`);
				settingsStore.update(s => ({ ...s, defaultModel: firstChatModel.name }));
			}
		}
	});

	onMount(() => {
		modelsStore.fetchModels();
	});

	function toggleTheme() {
		settingsStore.update((s) => ({
			...s,
			theme: s.theme === 'dark' ? 'light' : 'dark'
		}));
		document.documentElement.classList.toggle('dark');
	}

	function selectModel(model: string) {
		settingsStore.update((s) => ({ ...s, defaultModel: model }));
		showModelDropdown = false;
	}
</script>

<header class="flex h-14 items-center justify-between border-b border-border bg-card px-6">
	<!-- Left: Model Selector -->
	<div class="relative">
		<button
			onclick={() => (showModelDropdown = !showModelDropdown)}
			class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors {!modelExists && !$modelsStore.loading ? 'border-amber-500/50 bg-amber-500/10' : 'border-border bg-background'}"
		>
			{#if !modelExists && !$modelsStore.loading}
				<AlertCircle class="h-4 w-4 text-amber-500" />
			{/if}
			<span class="font-medium">{$settingsStore.defaultModel}</span>
			<ChevronDown class="h-4 w-4 text-muted-foreground" />
		</button>

		{#if showModelDropdown}
			<div
				class="absolute left-0 top-full mt-1 w-72 rounded-lg border border-border bg-popover p-1 shadow-lg z-50"
			>
				{#if !modelExists && !$modelsStore.loading}
					<div class="px-3 py-2 text-xs text-amber-500 bg-amber-500/10 rounded-md mb-1">
						Model "{$settingsStore.defaultModel}" not found. Select an available model.
					</div>
				{/if}
				{#if $modelsStore.loading}
					<div class="px-3 py-2 text-sm text-muted-foreground">Loading models...</div>
				{:else if chatModels.length === 0}
					<div class="px-3 py-2 text-sm text-muted-foreground">No chat models found</div>
				{:else}
					<div class="max-h-64 overflow-y-auto">
						{#each chatModels as model}
							<button
								onclick={() => selectModel(model.name)}
								class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors {$settingsStore.defaultModel === model.name ? 'bg-primary/10 text-primary' : ''}"
							>
								<span class="font-medium">{model.name}</span>
								<span class="text-xs text-muted-foreground">
									{(model.size / 1e9).toFixed(1)}GB
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Right: Status & Controls -->
	<div class="flex items-center gap-4">
		<!-- Connection Status -->
		<div class="flex items-center gap-2 text-sm">
			<Circle
				class="h-2 w-2 fill-current {$isConnected ? 'text-green-500' : 'text-red-500'}"
			/>
			<span class="text-muted-foreground">
				{$isConnected ? 'Connected' : 'Disconnected'}
			</span>
		</div>

		<!-- Refresh -->
		<button
			onclick={() => {
				connectionStore.checkConnection();
				modelsStore.fetchModels();
			}}
			class="rounded-lg p-2 hover:bg-muted transition-colors"
			title="Refresh connection"
		>
			<RefreshCw class="h-4 w-4" />
		</button>

		<!-- Theme Toggle -->
		<button
			onclick={toggleTheme}
			class="rounded-lg p-2 hover:bg-muted transition-colors"
			title="Toggle theme"
		>
			{#if $settingsStore.theme === 'dark'}
				<Sun class="h-4 w-4" />
			{:else}
				<Moon class="h-4 w-4" />
			{/if}
		</button>
	</div>
</header>

<!-- Click outside to close dropdown -->
{#if showModelDropdown}
	<button
		class="fixed inset-0 z-40"
		onclick={() => (showModelDropdown = false)}
		aria-label="Close dropdown"
	></button>
{/if}
