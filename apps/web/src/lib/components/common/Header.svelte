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
		ChevronDown
	} from 'lucide-svelte';

	let showModelDropdown = $state(false);

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
			class="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
		>
			<span class="font-medium">{$settingsStore.defaultModel}</span>
			<ChevronDown class="h-4 w-4 text-muted-foreground" />
		</button>

		{#if showModelDropdown}
			<div
				class="absolute left-0 top-full mt-1 w-64 rounded-lg border border-border bg-popover p-1 shadow-lg z-50"
			>
				{#if $modelsStore.loading}
					<div class="px-3 py-2 text-sm text-muted-foreground">Loading models...</div>
				{:else if $modelsStore.models.length === 0}
					<div class="px-3 py-2 text-sm text-muted-foreground">No models found</div>
				{:else}
					{#each $modelsStore.models as model}
						<button
							onclick={() => selectModel(model.name)}
							class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
						>
							<span class="font-medium">{model.name}</span>
							<span class="text-xs text-muted-foreground">
								{(model.size / 1e9).toFixed(1)}GB
							</span>
						</button>
					{/each}
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
