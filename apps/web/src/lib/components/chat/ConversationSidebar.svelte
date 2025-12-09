<script lang="ts">
	import { chatStore, activeConversation, type Conversation } from '$stores/chat';
	import {
		MessageSquare,
		Plus,
		Trash2,
		MoreVertical,
		Search,
		Clock,
		ChevronLeft
	} from 'lucide-svelte';

	interface Props {
		collapsed?: boolean;
		onToggle?: () => void;
	}

	let { collapsed = $bindable(false), onToggle }: Props = $props();

	let searchQuery = $state('');
	let contextMenuId = $state<string | null>(null);

	const conversations = $derived($chatStore.conversations);

	const filteredConversations = $derived(
		conversations.filter((c) =>
			c.title.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	// Group conversations by date
	const groupedConversations = $derived(() => {
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		const weekAgo = new Date(today);
		weekAgo.setDate(weekAgo.getDate() - 7);

		const groups: { label: string; conversations: Conversation[] }[] = [
			{ label: 'Today', conversations: [] },
			{ label: 'Yesterday', conversations: [] },
			{ label: 'This Week', conversations: [] },
			{ label: 'Older', conversations: [] }
		];

		for (const conv of filteredConversations) {
			const date = new Date(conv.updatedAt);
			if (date.toDateString() === today.toDateString()) {
				groups[0].conversations.push(conv);
			} else if (date.toDateString() === yesterday.toDateString()) {
				groups[1].conversations.push(conv);
			} else if (date > weekAgo) {
				groups[2].conversations.push(conv);
			} else {
				groups[3].conversations.push(conv);
			}
		}

		return groups.filter((g) => g.conversations.length > 0);
	});

	function formatTime(date: Date) {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(new Date(date));
	}

	function createNewChat() {
		chatStore.setActive(null);
	}

	function deleteConversation(id: string, e: Event) {
		e.stopPropagation();
		chatStore.deleteConversation(id);
		contextMenuId = null;
	}
</script>

<div
	class="flex h-full flex-col border-r border-border bg-card transition-all duration-300 {collapsed
		? 'w-0 overflow-hidden'
		: 'w-72'}"
>
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border p-4">
		<h2 class="font-semibold">Conversations</h2>
		<button
			type="button"
			onclick={() => onToggle?.()}
			class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
			title="Collapse sidebar"
		>
			<ChevronLeft class="h-4 w-4" />
		</button>
	</div>

	<!-- New Chat Button -->
	<div class="p-3">
		<button
			type="button"
			onclick={createNewChat}
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
		>
			<Plus class="h-4 w-4" />
			New Chat
		</button>
	</div>

	<!-- Search -->
	<div class="px-3 pb-2">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search conversations..."
				class="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
		</div>
	</div>

	<!-- Conversation List -->
	<div class="flex-1 overflow-y-auto p-2">
		{#if filteredConversations.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
				<MessageSquare class="mb-2 h-8 w-8 opacity-50" />
				<p class="text-sm">No conversations yet</p>
				<p class="text-xs">Start a new chat to begin</p>
			</div>
		{:else}
			{#each groupedConversations() as group}
				<div class="mb-4">
					<div class="flex items-center gap-2 px-2 py-1.5">
						<Clock class="h-3 w-3 text-muted-foreground" />
						<span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							{group.label}
						</span>
					</div>

					{#each group.conversations as conversation (conversation.id)}
						<div class="relative group">
							<button
								type="button"
								onclick={() => chatStore.setActive(conversation.id)}
								class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors {$activeConversation?.id ===
								conversation.id
									? 'bg-primary/10 text-primary'
									: 'hover:bg-muted'}"
							>
								<MessageSquare class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
								<div class="flex-1 min-w-0">
									<p class="truncate text-sm font-medium">
										{conversation.title || 'New Chat'}
									</p>
									<p class="truncate text-xs text-muted-foreground">
										{conversation.messages.length} messages · {formatTime(conversation.updatedAt)}
									</p>
								</div>
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									contextMenuId = contextMenuId === conversation.id ? null : conversation.id;
								}}
								class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
							>
								<MoreVertical class="h-4 w-4 text-muted-foreground" />
							</button>

							<!-- Context Menu -->
							{#if contextMenuId === conversation.id}
								<div class="absolute right-2 top-full z-50 mt-1 rounded-lg border border-border bg-popover py-1 shadow-lg">
									<button
										type="button"
										onclick={(e) => deleteConversation(conversation.id, e)}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
									>
										<Trash2 class="h-4 w-4" />
										Delete
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Footer -->
	<div class="border-t border-border p-3">
		<button
			type="button"
			onclick={() => chatStore.clearAll()}
			class="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
		>
			<Trash2 class="h-3 w-3" />
			Clear all conversations
		</button>
	</div>
</div>

<!-- Click outside to close context menu -->
{#if contextMenuId}
	<button
		type="button"
		class="fixed inset-0 z-40"
		onclick={() => (contextMenuId = null)}
		aria-label="Close menu"
	></button>
{/if}
