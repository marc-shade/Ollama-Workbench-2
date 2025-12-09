import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// Types for teachable agents and brainstorm sessions
export interface AgentPersona {
	id: string;
	name: string;
	role: string;
	description: string;
	systemPrompt: string;
	model: string;
	temperature: number;
	color: string;
	icon: string;
	teachable: boolean;
	learnedFacts: LearnedFact[];
	createdAt: Date;
	updatedAt: Date;
}

export interface LearnedFact {
	id: string;
	content: string;
	context: string;
	confidence: number;
	source: 'user_correction' | 'explicit_teaching' | 'inferred';
	timestamp: Date;
}

export interface BrainstormMessage {
	id: string;
	agentId: string;
	content: string;
	timestamp: Date;
	isUser: boolean;
	replyTo?: string;
	reactions: Record<string, string[]>; // emoji -> agentIds
	editHistory?: string[];
}

export interface BrainstormTopic {
	id: string;
	title: string;
	description: string;
	createdAt: Date;
}

export interface BrainstormSession {
	id: string;
	title: string;
	topic: BrainstormTopic;
	participants: string[]; // Agent IDs
	messages: BrainstormMessage[];
	status: 'active' | 'paused' | 'completed';
	mode: 'round_robin' | 'free_discussion' | 'debate' | 'brainstorm' | 'critique';
	maxRounds?: number;
	currentRound: number;
	insights: string[];
	summary?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface BrainstormState {
	sessions: BrainstormSession[];
	agents: AgentPersona[];
	activeSessionId: string | null;
	isGenerating: boolean;
	speakingAgentId: string | null;
	templates: AgentTemplate[];
}

export interface AgentTemplate {
	id: string;
	name: string;
	role: string;
	description: string;
	systemPrompt: string;
	icon: string;
	color: string;
}

// Default agent templates inspired by AutoGen roles
const DEFAULT_TEMPLATES: AgentTemplate[] = [
	{
		id: 'analyst',
		name: 'Analyst',
		role: 'analyst',
		description: 'Breaks down complex problems into components and analyzes data',
		systemPrompt: `You are a skilled analyst who excels at breaking down complex problems. Your approach:
- Decompose problems into smaller, manageable parts
- Identify key variables and relationships
- Use data-driven reasoning
- Present clear, structured analysis
Be thorough but concise. Ask clarifying questions when needed.`,
		icon: 'chart',
		color: '#3B82F6'
	},
	{
		id: 'creative',
		name: 'Creative',
		role: 'creative',
		description: 'Generates innovative ideas and thinks outside the box',
		systemPrompt: `You are a creative thinker who generates innovative ideas. Your approach:
- Think beyond conventional solutions
- Make unexpected connections between concepts
- Propose bold, unconventional ideas
- Use analogies and metaphors
Don't self-censor - share even wild ideas that might spark better ones.`,
		icon: 'lightbulb',
		color: '#F59E0B'
	},
	{
		id: 'critic',
		name: 'Critic',
		role: 'critic',
		description: 'Identifies weaknesses and potential problems constructively',
		systemPrompt: `You are a constructive critic who helps strengthen ideas. Your approach:
- Identify potential flaws and risks
- Challenge assumptions respectfully
- Point out edge cases and failure modes
- Suggest improvements alongside critiques
Be rigorous but supportive - your goal is to make ideas better, not tear them down.`,
		icon: 'search',
		color: '#EF4444'
	},
	{
		id: 'synthesizer',
		name: 'Synthesizer',
		role: 'synthesizer',
		description: 'Combines ideas and finds common ground',
		systemPrompt: `You are a synthesizer who combines diverse perspectives. Your approach:
- Find common themes across different viewpoints
- Integrate complementary ideas into cohesive solutions
- Resolve apparent contradictions
- Build consensus while preserving valuable differences
Help the group converge on well-rounded solutions.`,
		icon: 'merge',
		color: '#10B981'
	},
	{
		id: 'planner',
		name: 'Planner',
		role: 'planner',
		description: 'Creates actionable plans and timelines',
		systemPrompt: `You are a strategic planner who turns ideas into action. Your approach:
- Break solutions into concrete steps
- Identify dependencies and sequencing
- Estimate effort and resources needed
- Define milestones and success criteria
Focus on practical implementation while maintaining strategic vision.`,
		icon: 'list',
		color: '#8B5CF6'
	},
	{
		id: 'expert',
		name: 'Domain Expert',
		role: 'expert',
		description: 'Provides deep technical or domain expertise',
		systemPrompt: `You are a domain expert who provides deep technical knowledge. Your approach:
- Share relevant expertise and best practices
- Reference established patterns and precedents
- Explain technical constraints and possibilities
- Provide specific, actionable guidance
Ground discussions in practical reality while remaining open to new approaches.`,
		icon: 'book',
		color: '#EC4899'
	},
	{
		id: 'facilitator',
		name: 'Facilitator',
		role: 'facilitator',
		description: 'Guides discussion and ensures productive dialogue',
		systemPrompt: `You are a facilitator who guides productive discussions. Your approach:
- Keep conversations focused and on-track
- Ensure all perspectives are heard
- Summarize key points and decisions
- Move the group toward actionable outcomes
Help the team work together effectively.`,
		icon: 'users',
		color: '#06B6D4'
	},
	{
		id: 'devils_advocate',
		name: "Devil's Advocate",
		role: 'devils_advocate',
		description: 'Challenges consensus and explores alternatives',
		systemPrompt: `You are a devil's advocate who challenges groupthink. Your approach:
- Question prevailing assumptions
- Argue for alternative viewpoints
- Explore what could go wrong
- Push back against premature consensus
Your role is to ensure the group considers all angles before deciding.`,
		icon: 'flame',
		color: '#F97316'
	}
];

// Initialize state
const initialState: BrainstormState = {
	sessions: [],
	agents: [],
	activeSessionId: null,
	isGenerating: false,
	speakingAgentId: null,
	templates: DEFAULT_TEMPLATES
};

// Load from localStorage
function loadState(): BrainstormState {
	if (!browser) return initialState;

	try {
		const saved = localStorage.getItem('brainstorm-state');
		if (saved) {
			const parsed = JSON.parse(saved);
			// Restore Date objects
			parsed.sessions = parsed.sessions.map((s: any) => ({
				...s,
				createdAt: new Date(s.createdAt),
				updatedAt: new Date(s.updatedAt),
				topic: {
					...s.topic,
					createdAt: new Date(s.topic.createdAt)
				},
				messages: s.messages.map((m: any) => ({
					...m,
					timestamp: new Date(m.timestamp)
				}))
			}));
			parsed.agents = parsed.agents.map((a: any) => ({
				...a,
				createdAt: new Date(a.createdAt),
				updatedAt: new Date(a.updatedAt),
				learnedFacts: a.learnedFacts.map((f: any) => ({
					...f,
					timestamp: new Date(f.timestamp)
				}))
			}));
			return { ...initialState, ...parsed };
		}
	} catch (e) {
		console.error('Failed to load brainstorm state:', e);
	}
	return initialState;
}

// Create store
function createBrainstormStore() {
	const { subscribe, set, update } = writable<BrainstormState>(loadState());

	// Persist to localStorage
	if (browser) {
		subscribe((state) => {
			localStorage.setItem('brainstorm-state', JSON.stringify(state));
		});
	}

	return {
		subscribe,

		// Agent management
		createAgent(template: AgentTemplate, customizations: Partial<AgentPersona> = {}): string {
			const id = crypto.randomUUID();
			const now = new Date();

			const agent: AgentPersona = {
				id,
				name: customizations.name || template.name,
				role: template.role,
				description: customizations.description || template.description,
				systemPrompt: customizations.systemPrompt || template.systemPrompt,
				model: customizations.model || 'llama3.2',
				temperature: customizations.temperature ?? 0.7,
				color: customizations.color || template.color,
				icon: template.icon,
				teachable: customizations.teachable ?? true,
				learnedFacts: [],
				createdAt: now,
				updatedAt: now
			};

			update((s) => ({
				...s,
				agents: [...s.agents, agent]
			}));

			return id;
		},

		updateAgent(agentId: string, updates: Partial<AgentPersona>) {
			update((s) => ({
				...s,
				agents: s.agents.map((a) =>
					a.id === agentId
						? { ...a, ...updates, updatedAt: new Date() }
						: a
				)
			}));
		},

		deleteAgent(agentId: string) {
			update((s) => ({
				...s,
				agents: s.agents.filter((a) => a.id !== agentId)
			}));
		},

		// Teaching agents
		teachAgent(agentId: string, fact: string, context: string, source: LearnedFact['source'] = 'explicit_teaching') {
			const factEntry: LearnedFact = {
				id: crypto.randomUUID(),
				content: fact,
				context,
				confidence: source === 'user_correction' ? 1.0 : 0.8,
				source,
				timestamp: new Date()
			};

			update((s) => ({
				...s,
				agents: s.agents.map((a) =>
					a.id === agentId
						? {
								...a,
								learnedFacts: [...a.learnedFacts, factEntry],
								updatedAt: new Date()
						  }
						: a
				)
			}));
		},

		forgetFact(agentId: string, factId: string) {
			update((s) => ({
				...s,
				agents: s.agents.map((a) =>
					a.id === agentId
						? {
								...a,
								learnedFacts: a.learnedFacts.filter((f) => f.id !== factId),
								updatedAt: new Date()
						  }
						: a
				)
			}));
		},

		// Session management
		createSession(title: string, topic: string, description: string, participantIds: string[], mode: BrainstormSession['mode'] = 'brainstorm'): string {
			const id = crypto.randomUUID();
			const now = new Date();

			const session: BrainstormSession = {
				id,
				title,
				topic: {
					id: crypto.randomUUID(),
					title: topic,
					description,
					createdAt: now
				},
				participants: participantIds,
				messages: [],
				status: 'active',
				mode,
				currentRound: 0,
				insights: [],
				createdAt: now,
				updatedAt: now
			};

			update((s) => ({
				...s,
				sessions: [...s.sessions, session],
				activeSessionId: id
			}));

			return id;
		},

		setActiveSession(sessionId: string | null) {
			update((s) => ({ ...s, activeSessionId: sessionId }));
		},

		updateSession(sessionId: string, updates: Partial<BrainstormSession>) {
			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? { ...session, ...updates, updatedAt: new Date() }
						: session
				)
			}));
		},

		deleteSession(sessionId: string) {
			update((s) => ({
				...s,
				sessions: s.sessions.filter((session) => session.id !== sessionId),
				activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId
			}));
		},

		// Message management
		addMessage(sessionId: string, agentId: string, content: string, isUser: boolean = false, replyTo?: string) {
			const message: BrainstormMessage = {
				id: crypto.randomUUID(),
				agentId,
				content,
				timestamp: new Date(),
				isUser,
				replyTo,
				reactions: {}
			};

			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? {
								...session,
								messages: [...session.messages, message],
								updatedAt: new Date()
						  }
						: session
				)
			}));

			return message.id;
		},

		editMessage(sessionId: string, messageId: string, newContent: string) {
			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? {
								...session,
								messages: session.messages.map((m) =>
									m.id === messageId
										? {
												...m,
												editHistory: [...(m.editHistory || []), m.content],
												content: newContent
										  }
										: m
								),
								updatedAt: new Date()
						  }
						: session
				)
			}));
		},

		addReaction(sessionId: string, messageId: string, emoji: string, agentId: string) {
			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? {
								...session,
								messages: session.messages.map((m) =>
									m.id === messageId
										? {
												...m,
												reactions: {
													...m.reactions,
													[emoji]: [...(m.reactions[emoji] || []), agentId]
												}
										  }
										: m
								)
						  }
						: session
				)
			}));
		},

		// Add insight discovered during session
		addInsight(sessionId: string, insight: string) {
			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? {
								...session,
								insights: [...session.insights, insight],
								updatedAt: new Date()
						  }
						: session
				)
			}));
		},

		// Generation state
		setGenerating(isGenerating: boolean, speakingAgentId: string | null = null) {
			update((s) => ({ ...s, isGenerating, speakingAgentId }));
		},

		// Advance round in round-robin mode
		advanceRound(sessionId: string) {
			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? { ...session, currentRound: session.currentRound + 1 }
						: session
				)
			}));
		},

		// Complete session with summary
		completeSession(sessionId: string, summary: string) {
			update((s) => ({
				...s,
				sessions: s.sessions.map((session) =>
					session.id === sessionId
						? { ...session, status: 'completed', summary, updatedAt: new Date() }
						: session
				)
			}));
		},

		// Build context for an agent including learned facts
		buildAgentContext(agent: AgentPersona): string {
			let context = agent.systemPrompt;

			if (agent.learnedFacts.length > 0) {
				context += '\n\n## Things I have learned:\n';
				for (const fact of agent.learnedFacts) {
					context += `- ${fact.content}`;
					if (fact.confidence < 1.0) {
						context += ` (confidence: ${Math.round(fact.confidence * 100)}%)`;
					}
					context += '\n';
				}
			}

			return context;
		},

		// Export session
		exportSession(sessionId: string): string {
			const state = get({ subscribe });
			const session = state.sessions.find((s) => s.id === sessionId);
			if (!session) return '';

			const agents = state.agents.filter((a) => session.participants.includes(a.id));
			const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

			let markdown = `# ${session.title}\n\n`;
			markdown += `**Topic:** ${session.topic.title}\n`;
			markdown += `**Description:** ${session.topic.description}\n`;
			markdown += `**Mode:** ${session.mode}\n`;
			markdown += `**Status:** ${session.status}\n`;
			markdown += `**Date:** ${session.createdAt.toLocaleDateString()}\n\n`;

			markdown += `## Participants\n\n`;
			for (const agent of agents) {
				markdown += `- **${agent.name}** (${agent.role}): ${agent.description}\n`;
			}

			markdown += `\n## Discussion\n\n`;
			for (const msg of session.messages) {
				const agent = agentMap[msg.agentId];
				const name = msg.isUser ? 'User' : agent?.name || 'Unknown';
				markdown += `### ${name}\n${msg.content}\n\n`;
			}

			if (session.insights.length > 0) {
				markdown += `## Key Insights\n\n`;
				for (const insight of session.insights) {
					markdown += `- ${insight}\n`;
				}
			}

			if (session.summary) {
				markdown += `\n## Summary\n\n${session.summary}\n`;
			}

			return markdown;
		},

		// Reset store
		reset() {
			set(initialState);
		}
	};
}

export const brainstormStore = createBrainstormStore();

// Derived stores
export const activeSession = derived(brainstormStore, ($store) =>
	$store.sessions.find((s) => s.id === $store.activeSessionId)
);

export const sessionAgents = derived(
	[brainstormStore, activeSession],
	([$store, $session]) =>
		$session
			? $store.agents.filter((a) => $session.participants.includes(a.id))
			: []
);

export const recentSessions = derived(brainstormStore, ($store) =>
	[...$store.sessions]
		.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		.slice(0, 10)
);
