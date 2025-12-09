<script lang="ts">
	import { settingsStore } from '$stores/settings';
	import { Sparkles, Code, FileSearch, Lightbulb } from 'lucide-svelte';

	interface Props {
		onSuggestionClick?: (suggestion: string) => void;
	}

	let { onSuggestionClick }: Props = $props();

	const suggestions = [
		{
			icon: Code,
			title: 'Write code',
			prompt: 'Help me write a Python function to parse JSON files',
			color: 'text-blue-500'
		},
		{
			icon: FileSearch,
			title: 'Explain code',
			prompt: 'Explain how async/await works in JavaScript',
			color: 'text-green-500'
		},
		{
			icon: Lightbulb,
			title: 'Debug issue',
			prompt: 'Help me debug this error: TypeError: Cannot read property of undefined',
			color: 'text-orange-500'
		},
		{
			icon: Sparkles,
			title: 'Generate ideas',
			prompt: 'Give me 5 project ideas for learning machine learning',
			color: 'text-purple-500'
		}
	];
</script>

<div class="flex h-full flex-col items-center justify-center px-4">
	<div class="max-w-2xl text-center">
		<!-- Logo/Title -->
		<div class="mb-8">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
				<Sparkles class="h-8 w-8 text-primary" />
			</div>
			<h1 class="text-2xl font-bold">Welcome to Chat Studio</h1>
			<p class="mt-2 text-muted-foreground">
				Start a conversation with <span class="font-medium text-foreground">{$settingsStore.defaultModel}</span>
			</p>
		</div>

		<!-- Suggestions -->
		<div class="grid gap-3 sm:grid-cols-2">
			{#each suggestions as suggestion}
				<button
					onclick={() => onSuggestionClick?.(suggestion.prompt)}
					class="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
				>
					<div class="rounded-lg bg-muted p-2 {suggestion.color}">
						<suggestion.icon class="h-4 w-4" />
					</div>
					<div class="flex-1">
						<p class="font-medium group-hover:text-primary transition-colors">
							{suggestion.title}
						</p>
						<p class="text-sm text-muted-foreground line-clamp-2">
							{suggestion.prompt}
						</p>
					</div>
				</button>
			{/each}
		</div>

		<!-- Tips -->
		<div class="mt-8 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
			<p>
				<strong class="text-foreground">Tip:</strong> You can use
				<kbd class="rounded border border-border bg-background px-1">@</kbd> to mention tools,
				or <kbd class="rounded border border-border bg-background px-1">/</kbd> for commands.
			</p>
		</div>
	</div>
</div>
