<script lang="ts">
	import { goto } from '$app/navigation';
	import { chatStore } from '$stores/chat';
	import { modelsStore } from '$stores/models';
	import { connectionStore, isConnected } from '$stores/connection';
	import { onMount } from 'svelte';
	import {
		MessageSquare,
		Hammer,
		Wrench,
		Plug,
		FileText,
		Database,
		ArrowRight,
		Zap,
		Shield,
		Code
	} from 'lucide-svelte';

	onMount(() => {
		modelsStore.fetchModels();
	});

	const features = [
		{
			icon: MessageSquare,
			title: 'Chat Studio',
			description: 'Multi-model conversations with streaming responses',
			href: '/chat',
			color: 'bg-blue-500/10 text-blue-500'
		},
		{
			icon: Hammer,
			title: 'Build Center',
			description: 'Visual multi-agent workflow builder',
			href: '/build',
			color: 'bg-orange-500/10 text-orange-500'
		},
		{
			icon: Wrench,
			title: 'Tools Debugger',
			description: 'Function call tracing and validation',
			href: '/tools',
			color: 'bg-green-500/10 text-green-500'
		},
		{
			icon: Plug,
			title: 'MCP Studio',
			description: 'Build and test MCP servers',
			href: '/mcp',
			color: 'bg-purple-500/10 text-purple-500'
		},
		{
			icon: FileText,
			title: 'Prompt Lab',
			description: 'Version-controlled prompt engineering',
			href: '/prompts',
			color: 'bg-pink-500/10 text-pink-500'
		},
		{
			icon: Database,
			title: 'Knowledge Base',
			description: 'RAG pipeline and document management',
			href: '/knowledge',
			color: 'bg-cyan-500/10 text-cyan-500'
		}
	];

	function startChat() {
		const id = chatStore.createConversation($modelsStore.models[0]?.name || 'llama3.2');
		goto('/chat');
	}
</script>

<div class="mx-auto max-w-6xl space-y-12">
	<!-- Hero Section -->
	<div class="text-center space-y-4">
		<div class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary">
			<Zap class="h-4 w-4" />
			<span>The Developer's Local LLM IDE</span>
		</div>
		<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
			Ollama Workbench <span class="text-primary">2.0</span>
		</h1>
		<p class="mx-auto max-w-2xl text-lg text-muted-foreground">
			Build, test, and debug AI applications locally. Multi-agent workflows,
			MCP development, and prompt engineering - all in one place.
		</p>

		<!-- Quick Start -->
		<div class="flex items-center justify-center gap-4 pt-4">
			<button
				onclick={startChat}
				disabled={!$isConnected}
				class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Start Chatting
				<ArrowRight class="h-4 w-4" />
			</button>
			<a
				href="/settings"
				class="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
			>
				Configure
			</a>
		</div>
	</div>

	<!-- Status Cards -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-green-500/10 p-2">
					<Shield class="h-5 w-5 text-green-500" />
				</div>
				<div>
					<p class="text-sm font-medium">Connection</p>
					<p class="text-xs text-muted-foreground">
						{$isConnected ? 'All systems operational' : 'Check Ollama server'}
					</p>
				</div>
			</div>
		</div>
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-blue-500/10 p-2">
					<Code class="h-5 w-5 text-blue-500" />
				</div>
				<div>
					<p class="text-sm font-medium">Models</p>
					<p class="text-xs text-muted-foreground">
						{$modelsStore.models.length} available
					</p>
				</div>
			</div>
		</div>
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-purple-500/10 p-2">
					<MessageSquare class="h-5 w-5 text-purple-500" />
				</div>
				<div>
					<p class="text-sm font-medium">Conversations</p>
					<p class="text-xs text-muted-foreground">
						{$chatStore.conversations.length} active
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Features Grid -->
	<div>
		<h2 class="mb-6 text-xl font-semibold">Get Started</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<a
					href={feature.href}
					class="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
				>
					<div class="mb-4 inline-flex rounded-lg p-2 {feature.color}">
						<feature.icon class="h-5 w-5" />
					</div>
					<h3 class="mb-1 font-semibold group-hover:text-primary transition-colors">
						{feature.title}
					</h3>
					<p class="text-sm text-muted-foreground">{feature.description}</p>
				</a>
			{/each}
		</div>
	</div>

	<!-- Quick Tips -->
	<div class="rounded-xl border border-border bg-muted/50 p-6">
		<h3 class="mb-4 font-semibold">Quick Tips</h3>
		<ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
			<li class="flex items-start gap-2">
				<span class="text-primary">1.</span>
				<span>Ensure Ollama is running locally or configure a remote server</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-primary">2.</span>
				<span>Pull models with <code class="rounded bg-muted px-1">ollama pull llama3.2</code></span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-primary">3.</span>
				<span>Use the Tools Debugger to test function calling</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-primary">4.</span>
				<span>Create workflows in Build Center for multi-agent tasks</span>
			</li>
		</ul>
	</div>
</div>
