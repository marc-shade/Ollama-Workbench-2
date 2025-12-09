<script lang="ts">
	import { page } from '$app/stores';
	import { chatStore } from '$stores/chat';
	import {
		MessageSquare,
		Hammer,
		Search,
		Wrench,
		Plug,
		FileText,
		Database,
		Settings,
		Plus,
		ChevronLeft,
		ChevronRight,
		Box,
		BookMarked,
		Terminal,
		Brain,
		Activity,
		FolderKanban,
		GitBranch,
		FlaskConical,
		GitCompare,
		Lightbulb
	} from 'lucide-svelte';

	let collapsed = $state(false);

	const navItems = [
		{ href: '/chat', icon: MessageSquare, label: 'Chat Studio' },
		{ href: '/projects', icon: FolderKanban, label: 'Projects' },
		{ href: '/planning', icon: Lightbulb, label: 'AI Planning' },
		{ href: '/repos', icon: GitBranch, label: 'Repositories' },
		{ href: '/brainstorm', icon: Brain, label: 'Brainstorm' },
		{ href: '/build', icon: Hammer, label: 'Build Center' },
		{ href: '/models', icon: Box, label: 'Models' },
		{ href: '/models/tests', icon: FlaskConical, label: 'Model Tests' },
		{ href: '/compare', icon: GitCompare, label: 'Compare' },
		{ href: '/tools', icon: Wrench, label: 'Tools Debugger' },
		{ href: '/mcp', icon: Plug, label: 'MCP Studio' },
		{ href: '/prompts', icon: FileText, label: 'Prompt Lab' },
		{ href: '/knowledge', icon: Database, label: 'Knowledge Base' },
		{ href: '/research', icon: BookMarked, label: 'Research Lab' },
		{ href: '/sandbox', icon: Terminal, label: 'Code Sandbox' },
		{ href: '/monitoring', icon: Activity, label: 'Monitoring' },
		{ href: '/settings', icon: Settings, label: 'Settings' }
	];

	function isActive(href: string) {
		return $page.url.pathname.startsWith(href);
	}

	function newChat() {
		chatStore.createConversation('llama3.2');
	}
</script>

<aside
	class="flex flex-col border-r border-border bg-card transition-all duration-200 {collapsed
		? 'w-16'
		: 'w-64'}"
>
	<!-- Logo -->
	<div class="flex h-14 items-center justify-between border-b border-border px-4">
		{#if !collapsed}
			<div class="flex items-center gap-2">
				<div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center p-1">
					<svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6 text-primary-foreground">
						<!-- Llama head with tall ears -->
						<path d="M7 1C6.2 1 5.5 1.8 5.5 3L6 6L5 7C4 8 3.5 9.5 3.5 11C3.5 13.5 4.5 15.5 6 17L6.5 22H8.5L9 17.5C10 18 11 18.5 12 18.5C13 18.5 14 18 15 17.5L15.5 22H17.5L18 17C19.5 15.5 20.5 13.5 20.5 11C20.5 9.5 20 8 19 7L18 6L18.5 3C18.5 1.8 17.8 1 17 1C16 1 15.2 2 15 3L14.5 5C13.5 5.5 12.5 6 12 6C11.5 6 10.5 5.5 9.5 5L9 3C8.8 2 8 1 7 1Z"/>
						<!-- Eyes -->
						<circle cx="9" cy="11" r="1.3" fill="hsl(var(--primary))"/>
						<circle cx="15" cy="11" r="1.3" fill="hsl(var(--primary))"/>
						<!-- Snout -->
						<ellipse cx="12" cy="15" rx="2" ry="1.2" fill="hsl(var(--primary))" opacity="0.3"/>
					</svg>
				</div>
				<span class="font-semibold text-sm">Workbench</span>
			</div>
		{:else}
			<div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center p-1">
				<svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6 text-primary-foreground">
					<path d="M7 1C6.2 1 5.5 1.8 5.5 3L6 6L5 7C4 8 3.5 9.5 3.5 11C3.5 13.5 4.5 15.5 6 17L6.5 22H8.5L9 17.5C10 18 11 18.5 12 18.5C13 18.5 14 18 15 17.5L15.5 22H17.5L18 17C19.5 15.5 20.5 13.5 20.5 11C20.5 9.5 20 8 19 7L18 6L18.5 3C18.5 1.8 17.8 1 17 1C16 1 15.2 2 15 3L14.5 5C13.5 5.5 12.5 6 12 6C11.5 6 10.5 5.5 9.5 5L9 3C8.8 2 8 1 7 1Z"/>
					<circle cx="9" cy="11" r="1.3" fill="hsl(var(--primary))"/>
					<circle cx="15" cy="11" r="1.3" fill="hsl(var(--primary))"/>
					<ellipse cx="12" cy="15" rx="2" ry="1.2" fill="hsl(var(--primary))" opacity="0.3"/>
				</svg>
			</div>
		{/if}
		<button
			onclick={() => (collapsed = !collapsed)}
			class="rounded-md p-1.5 hover:bg-muted transition-colors"
		>
			{#if collapsed}
				<ChevronRight class="h-4 w-4" />
			{:else}
				<ChevronLeft class="h-4 w-4" />
			{/if}
		</button>
	</div>

	<!-- New Chat Button -->
	<div class="p-3">
		<button
			onclick={newChat}
			class="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
		>
			<Plus class="h-4 w-4" />
			{#if !collapsed}
				<span>New Chat</span>
			{/if}
		</button>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 space-y-1 px-3">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive(
					item.href
				)
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<item.icon class="h-4 w-4 flex-shrink-0" />
				{#if !collapsed}
					<span>{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Recent Chats (when expanded) -->
	{#if !collapsed}
		<div class="border-t border-border p-3">
			<h3 class="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
				Recent Chats
			</h3>
			<div class="space-y-1 max-h-48 overflow-y-auto">
				{#each $chatStore.conversations.slice(0, 5) as conv}
					<button
						onclick={() => chatStore.setActive(conv.id)}
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors {$chatStore.activeConversationId ===
						conv.id
							? 'bg-muted'
							: 'hover:bg-muted/50'}"
					>
						<MessageSquare class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
						<span class="truncate">{conv.title}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</aside>
