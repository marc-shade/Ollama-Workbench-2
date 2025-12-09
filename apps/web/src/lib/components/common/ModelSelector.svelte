<script lang="ts">
	import { ChevronDown, Cpu, Loader2 } from 'lucide-svelte';
	import { modelsStore } from '$stores/models';
	import { onMount } from 'svelte';

	let { value = $bindable(''), onchange = (model: string) => {} } = $props();

	let open = $state(false);
	let searchQuery = $state('');

	const filteredModels = $derived(
		$modelsStore.models.filter((m) =>
			m.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	onMount(() => {
		modelsStore.fetchModels();
	});

	function selectModel(modelName: string) {
		value = modelName;
		onchange(modelName);
		open = false;
		searchQuery = '';
	}

	function formatSize(bytes: number): string {
		const gb = bytes / (1024 * 1024 * 1024);
		return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
	}

	function getParamSize(model: any): string {
		return model.details?.parameter_size || '';
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
	>
		<div class="flex items-center gap-2">
			<Cpu class="h-4 w-4 text-muted-foreground" />
			<span class={value ? '' : 'text-muted-foreground'}>
				{value || 'Select a model...'}
			</span>
		</div>
		{#if $modelsStore.loading}
			<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
		{:else}
			<ChevronDown class="h-4 w-4 text-muted-foreground transition-transform {open ? 'rotate-180' : ''}" />
		{/if}
	</button>

	{#if open}
		<div class="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
			<!-- Search -->
			<div class="border-b border-border p-2">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search models..."
					class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<!-- Model List -->
			<div class="max-h-64 overflow-y-auto p-1">
				{#if $modelsStore.loading}
					<div class="flex items-center justify-center py-4 text-sm text-muted-foreground">
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Loading models...
					</div>
				{:else if filteredModels.length === 0}
					<div class="py-4 text-center text-sm text-muted-foreground">
						No models found
					</div>
				{:else}
					{#each filteredModels as model}
						<button
							type="button"
							onclick={() => selectModel(model.name)}
							class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors {value === model.name ? 'bg-primary/10 text-primary' : ''}"
						>
							<div class="flex flex-col">
								<span class="font-medium">{model.name}</span>
								<span class="text-xs text-muted-foreground">
									{getParamSize(model)} · {formatSize(model.size)}
								</span>
							</div>
							{#if value === model.name}
								<div class="h-2 w-2 rounded-full bg-primary"></div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>

			<!-- Refresh -->
			<div class="border-t border-border p-2">
				<button
					type="button"
					onclick={() => modelsStore.fetchModels()}
					class="w-full rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
				>
					Refresh model list
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40"
		onclick={() => (open = false)}
		aria-label="Close dropdown"
	></button>
{/if}
