<script lang="ts">
	import { chatStore, type Message } from '$stores/chat';
	import { settingsStore } from '$stores/settings';
	import {
		User,
		Bot,
		Copy,
		Check,
		RotateCcw,
		GitBranch,
		ThumbsUp,
		ThumbsDown,
		Volume2,
		VolumeX,
		Trash2,
		MoreHorizontal
	} from 'lucide-svelte';

	interface Props {
		message: Message;
		onBranch?: (messageId: string) => void;
		onRegenerate?: (messageId: string) => void;
		onDelete?: (messageId: string) => void;
	}

	let { message, onBranch, onRegenerate, onDelete }: Props = $props();

	let copied = $state(false);
	let showMenu = $state(false);
	let isPlaying = $state(false);
	let audio: HTMLAudioElement | null = null;

	function copyContent() {
		navigator.clipboard.writeText(message.content);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function handleBranch() {
		onBranch?.(message.id);
		showMenu = false;
	}

	function handleRegenerate() {
		onRegenerate?.(message.id);
		showMenu = false;
	}

	function handleDelete() {
		if (confirm('Delete this message?')) {
			onDelete?.(message.id);
		}
		showMenu = false;
	}

	function handleReaction(reaction: 'like' | 'dislike') {
		const newReaction = message.reaction === reaction ? null : reaction;
		chatStore.reactToMessage(message.id, newReaction);
	}

	async function playTTS() {
		if (isPlaying && audio) {
			audio.pause();
			audio.currentTime = 0;
			isPlaying = false;
			return;
		}

		try {
			// Use Edge TTS via voice-mode MCP
			const response = await fetch('/api/voice/speak', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: message.content,
					voice: $chatStore.voiceSettings.voice,
					rate: `+${($chatStore.voiceSettings.speed - 1) * 100}%`
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data.audioUrl) {
					audio = new Audio(data.audioUrl);
					audio.onended = () => {
						isPlaying = false;
					};
					audio.play();
					isPlaying = true;
				}
			}
		} catch (error) {
			console.error('TTS playback failed:', error);
			// Fallback to browser speech synthesis
			if ('speechSynthesis' in window) {
				const utterance = new SpeechSynthesisUtterance(message.content);
				utterance.rate = $chatStore.voiceSettings.speed;
				utterance.onend = () => {
					isPlaying = false;
				};
				speechSynthesis.speak(utterance);
				isPlaying = true;
			}
		}
	}

	function formatTime(date: Date) {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}
</script>

<div class="group flex gap-4 message-enter {message.role === 'user' ? 'flex-row-reverse' : ''}">
	<!-- Avatar -->
	<div
		class="flex-shrink-0 rounded-full p-2 {message.role === 'user'
			? 'bg-primary text-primary-foreground'
			: 'bg-muted text-muted-foreground'}"
	>
		{#if message.role === 'user'}
			<User class="h-4 w-4" />
		{:else}
			<Bot class="h-4 w-4" />
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 space-y-2 {message.role === 'user' ? 'text-right' : ''}">
		<!-- Header -->
		<div class="flex items-center gap-2 {message.role === 'user' ? 'justify-end' : ''}">
			<span class="text-sm font-medium">
				{message.role === 'user' ? 'You' : 'Assistant'}
			</span>
			{#if message.model}
				<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
					{message.model}
				</span>
			{/if}
			{#if message.transcribedFrom === 'voice'}
				<span class="rounded bg-purple-500/20 px-1.5 py-0.5 text-xs text-purple-400">
					Voice
				</span>
			{/if}
			{#if message.branchPoint}
				<span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400 flex items-center gap-1">
					<GitBranch class="h-3 w-3" />
					Branch Point
				</span>
			{/if}
			{#if $settingsStore.showTimestamps}
				<span class="text-xs text-muted-foreground">
					{formatTime(message.timestamp)}
				</span>
			{/if}
		</div>

		<!-- Message Content -->
		<div
			class="prose prose-sm dark:prose-invert max-w-none rounded-xl px-4 py-3 {message.role === 'user'
				? 'bg-primary text-primary-foreground prose-p:text-primary-foreground ml-12'
				: 'bg-muted mr-12'}"
		>
			{#if message.isStreaming && !message.content}
				<!-- Typing indicator -->
				<div class="flex items-center gap-1">
					<span class="typing-dot h-2 w-2 rounded-full bg-current opacity-60"></span>
					<span class="typing-dot h-2 w-2 rounded-full bg-current opacity-60"></span>
					<span class="typing-dot h-2 w-2 rounded-full bg-current opacity-60"></span>
				</div>
			{:else}
				<!-- Render markdown content -->
				{@html renderMarkdown(message.content)}
			{/if}
		</div>

		<!-- Tool Calls -->
		{#if message.toolCalls && message.toolCalls.length > 0}
			<div class="space-y-2">
				{#each message.toolCalls as toolCall}
					<div class="rounded-lg border border-border bg-muted/50 p-3 text-left">
						<div class="flex items-center gap-2 text-sm font-medium">
							<span class="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
								Tool Call
							</span>
							<span>{toolCall.name}</span>
						</div>
						{#if toolCall.result}
							<pre class="mt-2 overflow-x-auto text-xs">{JSON.stringify(toolCall.result, null, 2)}</pre>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Actions -->
		{#if !message.isStreaming}
			<div
				class="flex items-center gap-1 {message.role === 'user' ? 'justify-end' : ''} opacity-0 transition-opacity group-hover:opacity-100"
			>
				<!-- Copy -->
				<button
					onclick={copyContent}
					class="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					title="Copy"
					aria-label={copied ? 'Copied to clipboard' : 'Copy message content'}
				>
					{#if copied}
						<Check class="h-4 w-4 text-green-500" aria-hidden="true" />
					{:else}
						<Copy class="h-4 w-4" aria-hidden="true" />
					{/if}
				</button>

				<!-- TTS Playback (assistant only) -->
				{#if message.role === 'assistant'}
					<button
						onclick={playTTS}
						class="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors {isPlaying ? 'text-primary' : ''}"
						title={isPlaying ? 'Stop' : 'Listen'}
						aria-label={isPlaying ? 'Stop audio playback' : 'Listen to message'}
						aria-pressed={isPlaying}
					>
						{#if isPlaying}
							<VolumeX class="h-4 w-4" aria-hidden="true" />
						{:else}
							<Volume2 class="h-4 w-4" aria-hidden="true" />
						{/if}
					</button>
				{/if}

				<!-- Reactions (assistant only) -->
				{#if message.role === 'assistant'}
					<button
						onclick={() => handleReaction('like')}
						class="rounded p-1.5 transition-colors {message.reaction === 'like'
							? 'text-green-500 bg-green-500/10'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						title="Good response"
						aria-label={message.reaction === 'like' ? 'Remove positive reaction' : 'Mark as good response'}
						aria-pressed={message.reaction === 'like'}
					>
						<ThumbsUp class="h-4 w-4" aria-hidden="true" />
					</button>
					<button
						onclick={() => handleReaction('dislike')}
						class="rounded p-1.5 transition-colors {message.reaction === 'dislike'
							? 'text-red-500 bg-red-500/10'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						title="Bad response"
						aria-label={message.reaction === 'dislike' ? 'Remove negative reaction' : 'Mark as bad response'}
						aria-pressed={message.reaction === 'dislike'}
					>
						<ThumbsDown class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}

				<!-- Branch from here -->
				<button
					onclick={handleBranch}
					class="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					title="Create branch from here"
					aria-label="Create conversation branch from this message"
				>
					<GitBranch class="h-4 w-4" aria-hidden="true" />
				</button>

				<!-- Regenerate (assistant only) -->
				{#if message.role === 'assistant'}
					<button
						onclick={handleRegenerate}
						class="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						title="Regenerate"
						aria-label="Regenerate this response"
					>
						<RotateCcw class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}

				<!-- More actions dropdown -->
				<div class="relative">
					<button
						onclick={() => (showMenu = !showMenu)}
						class="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						title="More actions"
						aria-label="More actions"
						aria-expanded={showMenu}
						aria-haspopup="menu"
					>
						<MoreHorizontal class="h-4 w-4" aria-hidden="true" />
					</button>

					{#if showMenu}
						<div
							class="absolute z-10 mt-1 w-36 rounded-lg border border-border bg-card shadow-lg {message.role === 'user' ? 'right-0' : 'left-0'}"
							role="menu"
							aria-label="Message actions"
						>
							<button
								onclick={handleDelete}
								class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-muted transition-colors rounded-lg"
								role="menuitem"
								aria-label="Delete this message"
							>
								<Trash2 class="h-4 w-4" aria-hidden="true" />
								Delete
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Click outside to close menu -->
{#if showMenu}
	<button
		class="fixed inset-0 z-0"
		onclick={() => (showMenu = false)}
		aria-label="Close menu"
	></button>
{/if}

<script module lang="ts">
	// HTML escaping to prevent XSS attacks
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// Simple markdown rendering with XSS protection
	function renderMarkdown(content: string): string {
		if (!content) return '';

		// First, escape HTML to prevent XSS
		let escaped = escapeHtml(content);

		// Extract and preserve code blocks (temporarily replace with placeholders)
		const codeBlocks: string[] = [];
		escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
			const idx = codeBlocks.length;
			// Code is already escaped, just wrap it
			codeBlocks.push(`<pre><code class="language-${lang || ''}">${code}</code></pre>`);
			return `__CODE_BLOCK_${idx}__`;
		});

		// Extract inline code
		const inlineCode: string[] = [];
		escaped = escaped.replace(/`([^`]+)`/g, (_, code) => {
			const idx = inlineCode.length;
			inlineCode.push(`<code>${code}</code>`);
			return `__INLINE_CODE_${idx}__`;
		});

		// Apply safe markdown transformations
		escaped = escaped
			// Bold
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			// Italic
			.replace(/\*([^*]+)\*/g, '<em>$1</em>')
			// Links - validate URL scheme to prevent javascript: XSS
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
				// Only allow http, https, and mailto URLs
				const safeUrl = /^(https?:|mailto:)/i.test(url) ? url : '#';
				return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
			})
			// Line breaks
			.replace(/\n/g, '<br>');

		// Restore code blocks and inline code
		codeBlocks.forEach((block, idx) => {
			escaped = escaped.replace(`__CODE_BLOCK_${idx}__`, block);
		});
		inlineCode.forEach((code, idx) => {
			escaped = escaped.replace(`__INLINE_CODE_${idx}__`, code);
		});

		return escaped;
	}
</script>

<style>
	.typing-dot {
		animation: typingBounce 1.4s infinite ease-in-out both;
	}

	.typing-dot:nth-child(1) {
		animation-delay: -0.32s;
	}

	.typing-dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes typingBounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}
</style>
