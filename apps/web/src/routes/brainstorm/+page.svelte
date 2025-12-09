<script lang="ts">
	import {
		brainstormStore,
		activeSession,
		sessionAgents,
		recentSessions,
		type AgentPersona,
		type BrainstormSession
	} from '$stores/brainstorm';
	import { settingsStore } from '$stores/settings';
	import {
		Brain,
		Plus,
		Play,
		Pause,
		Square,
		Users,
		MessageSquare,
		Lightbulb,
		BookOpen,
		BarChart2,
		Search,
		Flame,
		List,
		GitMerge,
		Trash2,
		Settings,
		Download,
		ChevronDown,
		Send,
		Sparkles,
		GraduationCap,
		RefreshCw,
		CheckCircle2,
		User,
		Bot
	} from 'lucide-svelte';

	// State
	let showNewSession = $state(false);
	let showAgentManager = $state(false);
	let showTeachModal = $state(false);
	let teachingAgentId = $state<string | null>(null);
	let teachInput = $state('');
	let teachContext = $state('');

	// New session form
	let newTitle = $state('');
	let newTopic = $state('');
	let newDescription = $state('');
	let selectedAgentIds = $state<string[]>([]);
	let selectedMode = $state<BrainstormSession['mode']>('brainstorm');

	// Chat input
	let userInput = $state('');
	let isGenerating = $state(false);

	// Icon mapping
	const iconMap: Record<string, any> = {
		chart: BarChart2,
		lightbulb: Lightbulb,
		search: Search,
		merge: GitMerge,
		list: List,
		book: BookOpen,
		users: Users,
		flame: Flame
	};

	function getIcon(iconName: string) {
		return iconMap[iconName] || Brain;
	}

	// Session modes
	const sessionModes = [
		{ id: 'brainstorm', label: 'Brainstorm', description: 'Free-flowing idea generation' },
		{ id: 'round_robin', label: 'Round Robin', description: 'Each agent speaks in turn' },
		{ id: 'debate', label: 'Debate', description: 'Structured argument and counter-argument' },
		{ id: 'critique', label: 'Critique', description: 'Review and improve ideas' },
		{ id: 'free_discussion', label: 'Free Discussion', description: 'Natural conversation flow' }
	];

	async function createSession() {
		if (!newTitle.trim() || !newTopic.trim() || selectedAgentIds.length === 0) return;

		brainstormStore.createSession(
			newTitle.trim(),
			newTopic.trim(),
			newDescription.trim(),
			selectedAgentIds,
			selectedMode
		);

		// Reset form
		newTitle = '';
		newTopic = '';
		newDescription = '';
		selectedAgentIds = [];
		selectedMode = 'brainstorm';
		showNewSession = false;
	}

	function createAgentFromTemplate(templateId: string) {
		const template = $brainstormStore.templates.find((t) => t.id === templateId);
		if (template) {
			brainstormStore.createAgent(template);
		}
	}

	function toggleAgentSelection(agentId: string) {
		if (selectedAgentIds.includes(agentId)) {
			selectedAgentIds = selectedAgentIds.filter((id) => id !== agentId);
		} else {
			selectedAgentIds = [...selectedAgentIds, agentId];
		}
	}

	function openTeachModal(agentId: string) {
		teachingAgentId = agentId;
		teachInput = '';
		teachContext = '';
		showTeachModal = true;
	}

	function submitTeaching() {
		if (teachingAgentId && teachInput.trim()) {
			brainstormStore.teachAgent(
				teachingAgentId,
				teachInput.trim(),
				teachContext.trim(),
				'explicit_teaching'
			);
			showTeachModal = false;
			teachingAgentId = null;
			teachInput = '';
			teachContext = '';
		}
	}

	async function sendMessage() {
		if (!userInput.trim() || !$activeSession || isGenerating) return;

		const message = userInput.trim();
		userInput = '';

		// Capture session state before async operations to prevent race conditions
		const currentSessionId = $activeSession.id;
		const currentMode = $activeSession.mode;
		const currentAgents = [...$sessionAgents];

		// Add user message
		brainstormStore.addMessage(currentSessionId, 'user', message, true);

		// Generate agent responses based on mode
		isGenerating = true;

		try {
			if (currentMode === 'round_robin') {
				// Round robin: each agent responds in order
				for (const agent of currentAgents) {
					// Check if session is still active
					if ($activeSession?.id !== currentSessionId) break;

					brainstormStore.setGenerating(true, agent.id);
					try {
						const response = await generateAgentResponseWithTimeout(agent, message, currentSessionId);
						brainstormStore.addMessage(currentSessionId, agent.id, response, false);
					} catch (err) {
						console.error(`Agent ${agent.name} failed:`, err);
						brainstormStore.addMessage(currentSessionId, agent.id, `[${agent.name} could not respond]`, false);
					}
					brainstormStore.setGenerating(false, null);
				}
				brainstormStore.advanceRound(currentSessionId);
			} else {
				// Other modes: random or weighted selection of agents to respond
				const respondingAgents = selectRespondingAgents(currentAgents, currentMode);

				for (const agent of respondingAgents) {
					// Check if session is still active
					if ($activeSession?.id !== currentSessionId) break;

					brainstormStore.setGenerating(true, agent.id);
					try {
						const response = await generateAgentResponseWithTimeout(agent, message, currentSessionId);
						brainstormStore.addMessage(currentSessionId, agent.id, response, false);
					} catch (err) {
						console.error(`Agent ${agent.name} failed:`, err);
						brainstormStore.addMessage(currentSessionId, agent.id, `[${agent.name} could not respond]`, false);
					}
					brainstormStore.setGenerating(false, null);

					// Small delay between responses
					await new Promise((r) => setTimeout(r, 500));
				}
			}
		} catch (error) {
			console.error('Failed to generate responses:', error);
		} finally {
			isGenerating = false;
			brainstormStore.setGenerating(false, null);
		}
	}

	// Wrapper with timeout to prevent hanging
	async function generateAgentResponseWithTimeout(
		agent: AgentPersona,
		userMessage: string,
		sessionId: string,
		timeoutMs: number = 30000
	): Promise<string> {
		const session = $brainstormStore.sessions.find(s => s.id === sessionId);
		if (!session) throw new Error('Session not found');

		const timeoutPromise = new Promise<string>((_, reject) =>
			setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
		);

		const responsePromise = generateAgentResponse(agent, userMessage, session);

		return Promise.race([responsePromise, timeoutPromise]);
	}

	function selectRespondingAgents(agents: AgentPersona[], mode: string): AgentPersona[] {
		// In brainstorm/free discussion, 2-3 agents respond
		// In debate, opposing viewpoints respond
		// In critique, critics respond first

		if (mode === 'critique') {
			const critics = agents.filter((a) => a.role === 'critic' || a.role === 'devils_advocate');
			const others = agents.filter((a) => !critics.includes(a));
			return [...critics.slice(0, 2), ...others.slice(0, 1)];
		}

		// Shuffle and pick 2-3 agents
		const shuffled = [...agents].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, Math.min(3, shuffled.length));
	}

	async function generateAgentResponse(
		agent: AgentPersona,
		userMessage: string,
		session: BrainstormSession
	): Promise<string> {
		// Build conversation context
		const recentMessages = session.messages.slice(-10);
		const conversationContext = recentMessages
			.map((m) => {
				const speaker = m.isUser ? 'User' : ($brainstormStore.agents.find((a) => a.id === m.agentId)?.name || 'Agent');
				return `${speaker}: ${m.content}`;
			})
			.join('\n\n');

		// Build agent's system prompt with learned facts
		const systemPrompt = brainstormStore.buildAgentContext(agent);

		// Add session context
		const fullPrompt = `${systemPrompt}

## Current Discussion
Topic: ${session.topic.title}
Description: ${session.topic.description}
Discussion Mode: ${session.mode}

## Recent Conversation
${conversationContext}

## Your Response
As ${agent.name}, respond to the discussion. Stay in character and contribute based on your role as a ${agent.role}. Be concise but insightful.`;

		try {
			const response = await fetch('/api/chat/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: agent.model,
					prompt: userMessage,
					system: fullPrompt,
					options: {
						temperature: agent.temperature
					}
				})
			});

			if (response.ok) {
				const data = await response.json();
				return data.response || data.message?.content || 'I need a moment to think about this...';
			}
		} catch (error) {
			console.error('Agent generation failed:', error);
		}

		// Fallback response
		return `As ${agent.name}, I'm thinking about "${userMessage}"... [Response generation unavailable - check API connection]`;
	}

	function exportSession() {
		if (!$activeSession) return;

		const markdown = brainstormStore.exportSession($activeSession.id);
		const blob = new Blob([markdown], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${$activeSession.title.replace(/[^a-z0-9]/gi, '_')}_brainstorm.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function addInsight() {
		if (!$activeSession) return;
		const insight = prompt('Enter a key insight from this discussion:');
		if (insight?.trim()) {
			brainstormStore.addInsight($activeSession.id, insight.trim());
		}
	}

	function completeSession() {
		if (!$activeSession) return;
		const summary = prompt('Enter a summary of this brainstorm session:');
		if (summary?.trim()) {
			brainstormStore.completeSession($activeSession.id, summary.trim());
		}
	}
</script>

<div class="flex h-full">
	<!-- Sidebar: Sessions & Agents -->
	<div class="w-80 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
		<!-- Header -->
		<div class="sticky top-0 z-10 border-b border-border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Brain class="h-5 w-5 text-primary" />
					<h1 class="font-semibold">Brainstorm</h1>
				</div>
				<button
					onclick={() => (showNewSession = true)}
					class="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 transition-colors"
					title="New Session"
				>
					<Plus class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Agent Management -->
		<div class="border-b border-border p-4">
			<button
				onclick={() => (showAgentManager = !showAgentManager)}
				class="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
			>
				<span class="flex items-center gap-2">
					<Users class="h-4 w-4" />
					Agents ({$brainstormStore.agents.length})
				</span>
				<ChevronDown class="h-4 w-4 transition-transform {showAgentManager ? 'rotate-180' : ''}" />
			</button>

			{#if showAgentManager}
				<div class="mt-3 space-y-2">
					<!-- Existing Agents -->
					{#each $brainstormStore.agents as agent}
						<div class="flex items-center gap-2 rounded-lg bg-muted p-2">
							<div
								class="h-8 w-8 rounded-full flex items-center justify-center"
								style="background-color: {agent.color}20; color: {agent.color}"
							>
								<svelte:component this={getIcon(agent.icon)} class="h-4 w-4" />
							</div>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium truncate">{agent.name}</div>
								<div class="text-xs text-muted-foreground truncate">{agent.role}</div>
							</div>
							<div class="flex items-center gap-1">
								{#if agent.teachable}
									<button
										onclick={() => openTeachModal(agent.id)}
										class="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
										title="Teach agent"
									>
										<GraduationCap class="h-3.5 w-3.5" />
									</button>
								{/if}
								<button
									onclick={() => brainstormStore.deleteAgent(agent.id)}
									class="rounded p-1 text-muted-foreground hover:bg-background hover:text-red-500"
									title="Delete agent"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					{/each}

					<!-- Add from Templates -->
					<div class="pt-2">
						<div class="text-xs font-medium text-muted-foreground mb-2">Add Agent</div>
						<div class="grid grid-cols-2 gap-1">
							{#each $brainstormStore.templates as template}
								<button
									onclick={() => createAgentFromTemplate(template.id)}
									class="flex items-center gap-1.5 rounded-lg border border-border bg-background p-2 text-xs hover:bg-muted transition-colors"
								>
									<div
										class="h-5 w-5 rounded flex items-center justify-center"
										style="background-color: {template.color}20; color: {template.color}"
									>
										<svelte:component this={getIcon(template.icon)} class="h-3 w-3" />
									</div>
									<span class="truncate">{template.name}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Recent Sessions -->
		<div class="p-4">
			<h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
				Sessions
			</h3>
			<div class="space-y-2">
				{#each $recentSessions as session}
					<button
						onclick={() => brainstormStore.setActiveSession(session.id)}
						class="w-full rounded-lg border border-border p-3 text-left transition-colors {$activeSession?.id === session.id
							? 'bg-primary/10 border-primary'
							: 'hover:bg-muted'}"
					>
						<div class="flex items-start justify-between">
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm truncate">{session.title}</div>
								<div class="text-xs text-muted-foreground truncate">{session.topic.title}</div>
							</div>
							<span
								class="text-xs px-1.5 py-0.5 rounded {session.status === 'completed'
									? 'bg-green-500/20 text-green-500'
									: session.status === 'paused'
									  ? 'bg-yellow-500/20 text-yellow-500'
									  : 'bg-blue-500/20 text-blue-500'}"
							>
								{session.status}
							</span>
						</div>
						<div class="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
							<span class="flex items-center gap-1">
								<Users class="h-3 w-3" />
								{session.participants.length}
							</span>
							<span class="flex items-center gap-1">
								<MessageSquare class="h-3 w-3" />
								{session.messages.length}
							</span>
							{#if session.insights.length > 0}
								<span class="flex items-center gap-1">
									<Lightbulb class="h-3 w-3" />
									{session.insights.length}
								</span>
							{/if}
						</div>
					</button>
				{/each}

				{#if $recentSessions.length === 0}
					<div class="text-center py-8 text-muted-foreground">
						<Brain class="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p class="text-sm">No sessions yet</p>
						<p class="text-xs mt-1">Create agents and start brainstorming!</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex flex-col min-w-0">
		{#if $activeSession}
			<!-- Session Header -->
			<div class="border-b border-border bg-card p-4">
				<div class="flex items-start justify-between">
					<div>
						<h2 class="text-lg font-semibold">{$activeSession.title}</h2>
						<p class="text-sm text-muted-foreground">{$activeSession.topic.description}</p>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs bg-muted px-2 py-1 rounded">{$activeSession.mode}</span>
						<button
							onclick={addInsight}
							class="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
							title="Add insight"
						>
							<Lightbulb class="h-4 w-4" />
						</button>
						<button
							onclick={exportSession}
							class="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
							title="Export session"
						>
							<Download class="h-4 w-4" />
						</button>
						{#if $activeSession.status === 'active'}
							<button
								onclick={completeSession}
								class="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-green-500"
								title="Complete session"
							>
								<CheckCircle2 class="h-4 w-4" />
							</button>
						{/if}
						<button
							onclick={() => brainstormStore.deleteSession($activeSession.id)}
							class="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-500"
							title="Delete session"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</div>

				<!-- Participants -->
				<div class="flex items-center gap-2 mt-3">
					<span class="text-xs text-muted-foreground">Participants:</span>
					{#each $sessionAgents as agent}
						<div
							class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
							style="background-color: {agent.color}20; color: {agent.color}"
						>
							<svelte:component this={getIcon(agent.icon)} class="h-3 w-3" />
							{agent.name}
							{#if agent.learnedFacts.length > 0}
								<span class="bg-white/20 rounded-full px-1" title="{agent.learnedFacts.length} learned facts">
									{agent.learnedFacts.length}
								</span>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Insights -->
				{#if $activeSession.insights.length > 0}
					<div class="mt-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
						<div class="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
							<Lightbulb class="h-3 w-3" />
							Key Insights
						</div>
						<ul class="text-xs text-muted-foreground space-y-1">
							{#each $activeSession.insights as insight}
								<li class="flex items-start gap-1">
									<span class="text-yellow-500">-</span>
									{insight}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<!-- Messages -->
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				{#each $activeSession.messages as message}
					{@const agent = $brainstormStore.agents.find((a) => a.id === message.agentId)}
					<div class="flex gap-3 {message.isUser ? 'flex-row-reverse' : ''}">
						<!-- Avatar -->
						<div
							class="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
							style="background-color: {message.isUser ? 'hsl(var(--primary))' : agent?.color || '#888'}; color: {message.isUser ? 'hsl(var(--primary-foreground))' : 'white'}"
						>
							{#if message.isUser}
								<User class="h-4 w-4" />
							{:else if agent}
								<svelte:component this={getIcon(agent.icon)} class="h-4 w-4" />
							{:else}
								<Bot class="h-4 w-4" />
							{/if}
						</div>

						<!-- Content -->
						<div class="flex-1 max-w-[80%] {message.isUser ? 'text-right' : ''}">
							<div class="text-xs font-medium mb-1" style="color: {message.isUser ? 'hsl(var(--primary))' : agent?.color}">
								{message.isUser ? 'You' : agent?.name || 'Agent'}
							</div>
							<div
								class="rounded-xl px-4 py-2 text-sm {message.isUser
									? 'bg-primary text-primary-foreground ml-auto'
									: 'bg-muted'}"
							>
								{message.content}
							</div>
							<div class="text-xs text-muted-foreground mt-1">
								{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</div>
						</div>
					</div>
				{/each}

				<!-- Typing indicator -->
				{#if $brainstormStore.isGenerating}
					{@const speakingAgent = $brainstormStore.agents.find((a) => a.id === $brainstormStore.speakingAgentId)}
					<div class="flex gap-3">
						<div
							class="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
							style="background-color: {speakingAgent?.color || '#888'}; color: white"
						>
							{#if speakingAgent}
								<svelte:component this={getIcon(speakingAgent.icon)} class="h-4 w-4" />
							{:else}
								<Bot class="h-4 w-4" />
							{/if}
						</div>
						<div>
							<div class="text-xs font-medium mb-1" style="color: {speakingAgent?.color}">
								{speakingAgent?.name || 'Agent'} is thinking...
							</div>
							<div class="bg-muted rounded-xl px-4 py-2">
								<div class="flex items-center gap-1">
									<span class="h-2 w-2 rounded-full bg-current opacity-60 animate-bounce" style="animation-delay: 0s"></span>
									<span class="h-2 w-2 rounded-full bg-current opacity-60 animate-bounce" style="animation-delay: 0.1s"></span>
									<span class="h-2 w-2 rounded-full bg-current opacity-60 animate-bounce" style="animation-delay: 0.2s"></span>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Summary -->
				{#if $activeSession.summary}
					<div class="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
						<div class="text-sm font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
							<CheckCircle2 class="h-4 w-4" />
							Session Summary
						</div>
						<p class="text-sm">{$activeSession.summary}</p>
					</div>
				{/if}
			</div>

			<!-- Input -->
			{#if $activeSession.status === 'active'}
				<div class="border-t border-border bg-card p-4">
					<div class="flex items-end gap-2">
						<textarea
							bind:value={userInput}
							placeholder="Share your thoughts or ask a question..."
							rows="2"
							disabled={isGenerating}
							onkeydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									sendMessage();
								}
							}}
							class="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
						></textarea>
						<button
							onclick={sendMessage}
							disabled={!userInput.trim() || isGenerating}
							class="rounded-xl bg-primary p-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{#if isGenerating}
								<RefreshCw class="h-5 w-5 animate-spin" />
							{:else}
								<Send class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Empty State -->
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center max-w-md">
					<div class="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
						<Brain class="h-8 w-8 text-primary" />
					</div>
					<h2 class="text-xl font-semibold mb-2">Multi-Agent Brainstorming</h2>
					<p class="text-muted-foreground mb-6">
						Create AI agents with distinct personalities and have them collaborate on your ideas.
						Agents can be taught new information and will remember it across sessions.
					</p>
					<div class="flex flex-col gap-3">
						{#if $brainstormStore.agents.length === 0}
							<p class="text-sm text-muted-foreground">Start by creating some agents:</p>
							<div class="flex flex-wrap justify-center gap-2">
								{#each $brainstormStore.templates.slice(0, 4) as template}
									<button
										onclick={() => createAgentFromTemplate(template.id)}
										class="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
									>
										<div
											class="h-6 w-6 rounded flex items-center justify-center"
											style="background-color: {template.color}20; color: {template.color}"
										>
											<svelte:component this={getIcon(template.icon)} class="h-3 w-3" />
										</div>
										{template.name}
									</button>
								{/each}
							</div>
						{:else}
							<button
								onclick={() => (showNewSession = true)}
								class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors mx-auto"
							>
								<Plus class="h-4 w-4" />
								Start New Session
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- New Session Modal -->
{#if showNewSession}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
		<div class="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
			<h2 class="text-lg font-semibold mb-4">New Brainstorm Session</h2>

			<div class="space-y-4">
				<div>
					<label for="session-title" class="text-sm font-medium">Session Title</label>
					<input
						id="session-title"
						type="text"
						bind:value={newTitle}
						placeholder="e.g., Product Feature Ideas"
						class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="session-topic" class="text-sm font-medium">Topic</label>
					<input
						id="session-topic"
						type="text"
						bind:value={newTopic}
						placeholder="e.g., How can we improve user onboarding?"
						class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="session-description" class="text-sm font-medium">Description</label>
					<textarea
						id="session-description"
						bind:value={newDescription}
						placeholder="Additional context for the discussion..."
						rows="2"
						class="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					></textarea>
				</div>

				<div>
					<label for="discussion-mode" class="text-sm font-medium">Discussion Mode</label>
					<select
						id="discussion-mode"
						bind:value={selectedMode}
						class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{#each sessionModes as mode}
							<option value={mode.id}>{mode.label} - {mode.description}</option>
						{/each}
					</select>
				</div>

				<div>
					<span class="text-sm font-medium">Select Participants</span>
					<div class="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto" role="group" aria-label="Select Participants">
						{#each $brainstormStore.agents as agent}
							<button
								onclick={() => toggleAgentSelection(agent.id)}
								class="flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition-colors {selectedAgentIds.includes(
									agent.id
								)
									? 'border-primary bg-primary/10'
									: 'border-border hover:bg-muted'}"
							>
								<div
									class="h-6 w-6 rounded flex items-center justify-center flex-shrink-0"
									style="background-color: {agent.color}20; color: {agent.color}"
								>
									<svelte:component this={getIcon(agent.icon)} class="h-3 w-3" />
								</div>
								<div class="min-w-0">
									<div class="font-medium truncate">{agent.name}</div>
									<div class="text-xs text-muted-foreground truncate">{agent.role}</div>
								</div>
							</button>
						{/each}
					</div>
					{#if $brainstormStore.agents.length === 0}
						<p class="text-sm text-muted-foreground mt-2">
							No agents created yet. Close this and create some agents first.
						</p>
					{/if}
				</div>
			</div>

			<div class="flex justify-end gap-3 mt-6">
				<button
					onclick={() => (showNewSession = false)}
					class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={createSession}
					disabled={!newTitle.trim() || !newTopic.trim() || selectedAgentIds.length === 0}
					class="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					Create Session
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Teach Agent Modal -->
{#if showTeachModal && teachingAgentId}
	{@const agent = $brainstormStore.agents.find((a) => a.id === teachingAgentId)}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
			<div class="flex items-center gap-3 mb-4">
				{#if agent}
					<div
						class="h-10 w-10 rounded-full flex items-center justify-center"
						style="background-color: {agent.color}20; color: {agent.color}"
					>
						<svelte:component this={getIcon(agent.icon)} class="h-5 w-5" />
					</div>
					<div>
						<h2 class="font-semibold">Teach {agent.name}</h2>
						<p class="text-sm text-muted-foreground">Add knowledge this agent should remember</p>
					</div>
				{/if}
			</div>

			<div class="space-y-4">
				<div>
					<label for="teach-input" class="text-sm font-medium">What should this agent know?</label>
					<textarea
						id="teach-input"
						bind:value={teachInput}
						placeholder="e.g., Our company values innovation over stability"
						rows="3"
						class="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					></textarea>
				</div>

				<div>
					<label for="teach-context" class="text-sm font-medium">Context (optional)</label>
					<input
						id="teach-context"
						type="text"
						bind:value={teachContext}
						placeholder="When should this apply?"
						class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				{#if agent && agent.learnedFacts.length > 0}
					<div>
						<span class="text-sm font-medium">Already learned ({agent.learnedFacts.length})</span>
						<div class="mt-2 max-h-32 overflow-y-auto space-y-1">
							{#each agent.learnedFacts as fact}
								<div class="flex items-start gap-2 rounded-lg bg-muted p-2 text-xs">
									<span class="flex-1">{fact.content}</span>
									<button
										onclick={() => brainstormStore.forgetFact(agent.id, fact.id)}
										class="text-muted-foreground hover:text-red-500"
										title="Forget this"
									>
										<Trash2 class="h-3 w-3" />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-3 mt-6">
				<button
					onclick={() => {
						showTeachModal = false;
						teachingAgentId = null;
					}}
					class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={submitTeaching}
					disabled={!teachInput.trim()}
					class="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					<GraduationCap class="h-4 w-4 inline mr-1" />
					Teach
				</button>
			</div>
		</div>
	</div>
{/if}
