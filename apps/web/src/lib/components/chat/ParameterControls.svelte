<script lang="ts">
	import { settingsStore } from '$stores/settings';
	import { Sliders, ChevronDown, ChevronUp, RotateCcw } from 'lucide-svelte';

	interface Props {
		temperature?: number;
		maxTokens?: number;
		topP?: number;
		topK?: number;
		repeatPenalty?: number;
		onUpdate?: (params: Record<string, number>) => void;
	}

	let {
		temperature = $bindable(0.7),
		maxTokens = $bindable(2048),
		topP = $bindable(0.9),
		topK = $bindable(40),
		repeatPenalty = $bindable(1.1),
		onUpdate
	}: Props = $props();

	let expanded = $state(false);

	const defaults = {
		temperature: 0.7,
		maxTokens: 2048,
		topP: 0.9,
		topK: 40,
		repeatPenalty: 1.1
	};

	function resetToDefaults() {
		temperature = defaults.temperature;
		maxTokens = defaults.maxTokens;
		topP = defaults.topP;
		topK = defaults.topK;
		repeatPenalty = defaults.repeatPenalty;
		notifyUpdate();
	}

	function notifyUpdate() {
		onUpdate?.({
			temperature,
			num_predict: maxTokens,
			top_p: topP,
			top_k: topK,
			repeat_penalty: repeatPenalty
		});
	}

	// Notify on any change
	$effect(() => {
		temperature;
		maxTokens;
		topP;
		topK;
		repeatPenalty;
		notifyUpdate();
	});
</script>

<div class="rounded-xl border border-border bg-card">
	<!-- Header -->
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
	>
		<div class="flex items-center gap-2">
			<Sliders class="h-4 w-4 text-muted-foreground" />
			<span class="font-medium text-sm">Parameters</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-xs text-muted-foreground">
				temp: {temperature.toFixed(1)}
			</span>
			{#if expanded}
				<ChevronUp class="h-4 w-4 text-muted-foreground" />
			{:else}
				<ChevronDown class="h-4 w-4 text-muted-foreground" />
			{/if}
		</div>
	</button>

	{#if expanded}
		<div class="border-t border-border p-4 space-y-4">
			<!-- Temperature -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="param-temperature" class="text-sm font-medium">Temperature</label>
					<span class="text-xs text-muted-foreground tabular-nums">{temperature.toFixed(2)}</span>
				</div>
				<input
					id="param-temperature"
					type="range"
					min="0"
					max="2"
					step="0.1"
					bind:value={temperature}
					class="w-full accent-primary"
				/>
				<p class="text-xs text-muted-foreground">
					Controls randomness. Lower = more focused, higher = more creative.
				</p>
			</div>

			<!-- Max Tokens -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="param-max-tokens" class="text-sm font-medium">Max Tokens</label>
					<span class="text-xs text-muted-foreground tabular-nums">{maxTokens}</span>
				</div>
				<input
					id="param-max-tokens"
					type="range"
					min="128"
					max="8192"
					step="128"
					bind:value={maxTokens}
					class="w-full accent-primary"
				/>
				<p class="text-xs text-muted-foreground">
					Maximum length of the response.
				</p>
			</div>

			<!-- Top P -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="param-top-p" class="text-sm font-medium">Top P</label>
					<span class="text-xs text-muted-foreground tabular-nums">{topP.toFixed(2)}</span>
				</div>
				<input
					id="param-top-p"
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={topP}
					class="w-full accent-primary"
				/>
				<p class="text-xs text-muted-foreground">
					Nucleus sampling. Higher = more diverse vocabulary.
				</p>
			</div>

			<!-- Top K -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="param-top-k" class="text-sm font-medium">Top K</label>
					<span class="text-xs text-muted-foreground tabular-nums">{topK}</span>
				</div>
				<input
					id="param-top-k"
					type="range"
					min="1"
					max="100"
					step="1"
					bind:value={topK}
					class="w-full accent-primary"
				/>
				<p class="text-xs text-muted-foreground">
					Limits vocabulary to top K tokens per step.
				</p>
			</div>

			<!-- Repeat Penalty -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="param-repeat-penalty" class="text-sm font-medium">Repeat Penalty</label>
					<span class="text-xs text-muted-foreground tabular-nums">{repeatPenalty.toFixed(2)}</span>
				</div>
				<input
					id="param-repeat-penalty"
					type="range"
					min="1"
					max="2"
					step="0.05"
					bind:value={repeatPenalty}
					class="w-full accent-primary"
				/>
				<p class="text-xs text-muted-foreground">
					Penalizes repeating tokens. Higher = less repetition.
				</p>
			</div>

			<!-- Reset Button -->
			<button
				type="button"
				onclick={resetToDefaults}
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
			>
				<RotateCcw class="h-4 w-4" />
				Reset to defaults
			</button>
		</div>
	{/if}
</div>
