import { writable, derived } from 'svelte/store';

export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	model?: string;
	toolCalls?: ToolCall[];
	isStreaming?: boolean;
	// Branching support
	branchPoint?: boolean; // Message where a branch was created
	branchId?: string; // Which branch this message belongs to
	parentMessageId?: string; // For tracking message hierarchy
	// Voice support
	audioUrl?: string; // TTS audio URL
	transcribedFrom?: 'voice'; // Indicates voice input origin
	// Reactions/feedback
	reaction?: 'like' | 'dislike';
	feedbackNote?: string;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
	result?: unknown;
}

export interface Branch {
	id: string;
	name: string;
	parentBranchId: string | null;
	forkMessageId: string; // The message this branch forked from
	createdAt: Date;
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	model: string;
	systemPrompt?: string;
	createdAt: Date;
	updatedAt: Date;
	// Branching support
	branches: Branch[];
	activeBranchId: string;
	// Metadata
	starred?: boolean;
	archived?: boolean;
	tags?: string[];
	tokenCount?: number;
}

export interface VoiceSettings {
	enabled: boolean;
	autoPlay: boolean; // Auto-play TTS for assistant messages
	voice: string; // TTS voice name
	speed: number;
	inputLanguage: string;
}

export interface ChatState {
	conversations: Conversation[];
	activeConversationId: string | null;
	isGenerating: boolean;
	voiceSettings: VoiceSettings;
	isRecording: boolean;
	recordingTranscript: string;
}

const STORAGE_KEY = 'ollama-workbench-chat';

function loadFromStorage(): Partial<ChatState> {
	if (typeof window === 'undefined') return {};
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const data = JSON.parse(stored);
			// Restore Date objects
			data.conversations = data.conversations?.map((c: Conversation) => ({
				...c,
				createdAt: new Date(c.createdAt),
				updatedAt: new Date(c.updatedAt),
				messages: c.messages.map((m: Message) => ({
					...m,
					timestamp: new Date(m.timestamp)
				})),
				branches: (c.branches && c.branches.length > 0)
				? c.branches.map((b: Branch) => ({
					...b,
					createdAt: new Date(b.createdAt)
				}))
				: [{ id: 'main', name: 'Main', parentBranchId: null, forkMessageId: '', createdAt: new Date() }],
			activeBranchId: c.activeBranchId || 'main'
			}));
			return data;
		}
	} catch {
		// Ignore errors
	}
	return {};
}

function saveToStorage(state: ChatState) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			conversations: state.conversations,
			voiceSettings: state.voiceSettings
		}));
	} catch {
		// Ignore quota errors
	}
}

function createChatStore() {
	const stored = loadFromStorage();
	const { subscribe, set, update } = writable<ChatState>({
		conversations: stored.conversations || [],
		activeConversationId: null,
		isGenerating: false,
		voiceSettings: stored.voiceSettings || {
			enabled: false,
			autoPlay: false,
			voice: 'en-IE-EmilyNeural',
			speed: 1.0,
			inputLanguage: 'en'
		},
		isRecording: false,
		recordingTranscript: ''
	});

	return {
		subscribe,

		// Create new conversation
		createConversation: (model: string, systemPrompt?: string) => {
			const id = crypto.randomUUID();
			const mainBranch: Branch = {
				id: 'main',
				name: 'Main',
				parentBranchId: null,
				forkMessageId: '',
				createdAt: new Date()
			};
			const conversation: Conversation = {
				id,
				title: 'New Chat',
				messages: [],
				model,
				systemPrompt,
				createdAt: new Date(),
				updatedAt: new Date(),
				branches: [mainBranch],
				activeBranchId: 'main'
			};
			update((s) => {
				const newState = {
					...s,
					conversations: [conversation, ...s.conversations],
					activeConversationId: id
				};
				saveToStorage(newState);
				return newState;
			});
			return id;
		},

		// Set active conversation
		setActive: (id: string | null) => {
			update((s) => ({ ...s, activeConversationId: id }));
		},

		// Add message to active conversation
		addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => {
			let newMessageId = '';
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conv = s.conversations[convIndex];
				const newMessage: Message = {
					...message,
					id: crypto.randomUUID(),
					timestamp: new Date(),
					branchId: conv.activeBranchId
				};
				newMessageId = newMessage.id;

				const conversations = [...s.conversations];
				const newMessages = [...conv.messages, newMessage];
				conversations[convIndex] = {
					...conv,
					messages: newMessages,
					updatedAt: new Date()
				};

				// Update title from first user message in the active branch
				// Check AFTER push: if this is the only user message in the branch
				if (message.role === 'user') {
					const branchUserMessages = newMessages.filter(
						m => m.role === 'user' && (m.branchId === conv.activeBranchId || (!m.branchId && conv.activeBranchId === 'main'))
					);
					if (branchUserMessages.length === 1) {
						conversations[convIndex].title = message.content.slice(0, 50);
					}
				}

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
			return newMessageId;
		},

		// Update message (for streaming)
		updateMessage: (messageId: string, updates: Partial<Message>) => {
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				const msgIndex = conversations[convIndex].messages.findIndex(
					(m) => m.id === messageId
				);
				if (msgIndex === -1) return s;

				conversations[convIndex].messages[msgIndex] = {
					...conversations[convIndex].messages[msgIndex],
					...updates
				};

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Delete message
		deleteMessage: (messageId: string) => {
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				conversations[convIndex].messages = conversations[convIndex].messages.filter(
					(m) => m.id !== messageId
				);
				conversations[convIndex].updatedAt = new Date();

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Branch from a specific message
		branchFrom: (messageId: string, branchName?: string) => {
			let newBranchId = '';
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conv = s.conversations[convIndex];
				const msgIndex = conv.messages.findIndex((m) => m.id === messageId);
				if (msgIndex === -1) return s;

				newBranchId = crypto.randomUUID();
				const newBranch: Branch = {
					id: newBranchId,
					name: branchName || `Branch ${conv.branches.length}`,
					parentBranchId: conv.activeBranchId,
					forkMessageId: messageId,
					createdAt: new Date()
				};

				// Mark the message as a branch point
				const conversations = [...s.conversations];
				conversations[convIndex].messages[msgIndex] = {
					...conversations[convIndex].messages[msgIndex],
					branchPoint: true
				};
				conversations[convIndex].branches = [...conv.branches, newBranch];
				conversations[convIndex].activeBranchId = newBranchId;
				conversations[convIndex].updatedAt = new Date();

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
			return newBranchId;
		},

		// Switch to a different branch
		switchBranch: (branchId: string) => {
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				const branchExists = conversations[convIndex].branches.some(b => b.id === branchId);
				if (!branchExists) return s;

				conversations[convIndex].activeBranchId = branchId;

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Rename branch
		renameBranch: (branchId: string, newName: string) => {
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				const branchIndex = conversations[convIndex].branches.findIndex(b => b.id === branchId);
				if (branchIndex === -1) return s;

				conversations[convIndex].branches[branchIndex].name = newName;

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Delete branch (and all its messages)
		deleteBranch: (branchId: string) => {
			if (branchId === 'main') return; // Can't delete main branch

			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				const conv = conversations[convIndex];

				// Remove the branch and its messages
				conversations[convIndex].branches = conv.branches.filter(b => b.id !== branchId);
				conversations[convIndex].messages = conv.messages.filter(m => m.branchId !== branchId);

				// Switch to main branch if we deleted the active one
				if (conv.activeBranchId === branchId) {
					conversations[convIndex].activeBranchId = 'main';
				}

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Add reaction to message
		reactToMessage: (messageId: string, reaction: 'like' | 'dislike' | null) => {
			update((s) => {
				const convIndex = s.conversations.findIndex(
					(c) => c.id === s.activeConversationId
				);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				const msgIndex = conversations[convIndex].messages.findIndex(
					(m) => m.id === messageId
				);
				if (msgIndex === -1) return s;

				if (reaction === null) {
					delete conversations[convIndex].messages[msgIndex].reaction;
				} else {
					conversations[convIndex].messages[msgIndex].reaction = reaction;
				}

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Delete conversation
		deleteConversation: (id: string) => {
			update((s) => {
				const newState = {
					...s,
					conversations: s.conversations.filter((c) => c.id !== id),
					activeConversationId:
						s.activeConversationId === id ? null : s.activeConversationId
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Update conversation metadata
		updateConversation: (id: string, updates: Partial<Pick<Conversation, 'title' | 'starred' | 'archived' | 'tags' | 'systemPrompt'>>) => {
			update((s) => {
				const convIndex = s.conversations.findIndex((c) => c.id === id);
				if (convIndex === -1) return s;

				const conversations = [...s.conversations];
				conversations[convIndex] = {
					...conversations[convIndex],
					...updates,
					updatedAt: new Date()
				};

				const newState = { ...s, conversations };
				saveToStorage(newState);
				return newState;
			});
		},

		// Set generating state
		setGenerating: (isGenerating: boolean) => {
			update((s) => ({ ...s, isGenerating }));
		},

		// Voice settings
		updateVoiceSettings: (settings: Partial<VoiceSettings>) => {
			update((s) => {
				const newState = {
					...s,
					voiceSettings: { ...s.voiceSettings, ...settings }
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Recording state
		setRecording: (isRecording: boolean) => {
			update((s) => ({ ...s, isRecording }));
		},

		setRecordingTranscript: (transcript: string) => {
			update((s) => ({ ...s, recordingTranscript: transcript }));
		},

		// Clear all conversations
		clearAll: () => {
			const newState: ChatState = {
				conversations: [],
				activeConversationId: null,
				isGenerating: false,
				voiceSettings: {
					enabled: false,
					autoPlay: false,
					voice: 'en-IE-EmilyNeural',
					speed: 1.0,
					inputLanguage: 'en'
				},
				isRecording: false,
				recordingTranscript: ''
			};
			set(newState);
			saveToStorage(newState);
		},

		// Duplicate conversation
		duplicateConversation: (id: string) => {
			let newId = '';
			update((s) => {
				const conv = s.conversations.find((c) => c.id === id);
				if (!conv) return s;

				newId = crypto.randomUUID();
				const duplicated: Conversation = {
					...conv,
					id: newId,
					title: `${conv.title} (copy)`,
					createdAt: new Date(),
					updatedAt: new Date(),
					messages: conv.messages.map((m) => ({
						...m,
						id: crypto.randomUUID(),
						timestamp: new Date(m.timestamp)
					})),
					branches: conv.branches.map((b) => ({
						...b,
						createdAt: new Date(b.createdAt)
					}))
				};

				const newState = {
					...s,
					conversations: [duplicated, ...s.conversations],
					activeConversationId: newId
				};
				saveToStorage(newState);
				return newState;
			});
			return newId;
		}
	};
}

export const chatStore = createChatStore();

// Derived store for active conversation
export const activeConversation = derived(chatStore, ($chat) =>
	$chat.conversations.find((c) => c.id === $chat.activeConversationId)
);

// Derived store for active branch
export const activeBranch = derived(activeConversation, ($conv) =>
	$conv?.branches.find((b) => b.id === $conv.activeBranchId) || null
);

// Derived store for active messages (filtered by branch)
export const activeMessages = derived(
	[activeConversation],
	([$conv]) => {
		if (!$conv) return [];
		const activeBranchId = $conv.activeBranchId;

		// Get messages visible in the current branch
		// This includes messages from the main branch up to the fork point,
		// plus messages in the current branch
		const branch = $conv.branches.find(b => b.id === activeBranchId);
		if (!branch) return [];

		if (activeBranchId === 'main') {
			// Main branch: show all main branch messages
			return $conv.messages.filter(m => m.branchId === 'main' || !m.branchId);
		}

		// For other branches: get the chain of messages
		const visibleMessages: Message[] = [];

		// Find the fork message index in the parent branch
		const forkMsgIndex = $conv.messages.findIndex(m => m.id === branch.forkMessageId);

		// Include all messages up to and including the fork point (from parent branch)
		if (forkMsgIndex >= 0) {
			const parentBranchId = branch.parentBranchId || 'main';
			const parentMessages = $conv.messages.filter(m =>
				(m.branchId === parentBranchId || !m.branchId)
			);

			// Get messages up to fork point
			for (const m of parentMessages) {
				visibleMessages.push(m);
				if (m.id === branch.forkMessageId) break;
			}
		}

		// Add messages from this branch
		const branchMessages = $conv.messages.filter(m => m.branchId === activeBranchId);
		visibleMessages.push(...branchMessages);

		return visibleMessages;
	}
);

// Derived store for all branches of active conversation
export const conversationBranches = derived(activeConversation, ($conv) =>
	$conv?.branches || []
);

// Derived store for starred conversations
export const starredConversations = derived(chatStore, ($chat) =>
	$chat.conversations.filter((c) => c.starred)
);

// Derived store for archived conversations
export const archivedConversations = derived(chatStore, ($chat) =>
	$chat.conversations.filter((c) => c.archived)
);

// Helper: Export conversation to JSON
export function exportToJSON(conversation: Conversation): string {
	return JSON.stringify(conversation, null, 2);
}

// Helper: Export conversation to Markdown
export function exportToMarkdown(conversation: Conversation): string {
	const lines: string[] = [
		`# ${conversation.title}`,
		'',
		`**Model:** ${conversation.model}`,
		`**Created:** ${conversation.createdAt.toLocaleString()}`,
		`**Updated:** ${conversation.updatedAt.toLocaleString()}`,
		''
	];

	if (conversation.systemPrompt) {
		lines.push('## System Prompt', '', conversation.systemPrompt, '');
	}

	lines.push('## Conversation', '');

	for (const message of conversation.messages) {
		const role = message.role === 'user' ? '**You:**' : '**Assistant:**';
		const timestamp = message.timestamp.toLocaleTimeString();

		lines.push(`### ${role} (${timestamp})`);
		lines.push('');
		lines.push(message.content);
		lines.push('');

		if (message.toolCalls && message.toolCalls.length > 0) {
			lines.push('**Tool Calls:**');
			for (const tc of message.toolCalls) {
				lines.push(`- \`${tc.name}\`: ${JSON.stringify(tc.arguments)}`);
				if (tc.result) {
					lines.push(`  Result: ${JSON.stringify(tc.result)}`);
				}
			}
			lines.push('');
		}
	}

	return lines.join('\n');
}

// Helper: Export conversation to HTML
export function exportToHTML(conversation: Conversation): string {
	const messages = conversation.messages.map(m => {
		const roleClass = m.role === 'user' ? 'user-message' : 'assistant-message';
		return `
			<div class="message ${roleClass}">
				<div class="message-header">
					<strong>${m.role === 'user' ? 'You' : 'Assistant'}</strong>
					<span class="timestamp">${m.timestamp.toLocaleTimeString()}</span>
					${m.model ? `<span class="model">${m.model}</span>` : ''}
				</div>
				<div class="message-content">${escapeHtml(m.content)}</div>
			</div>
		`;
	}).join('\n');

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>${escapeHtml(conversation.title)}</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #e0e0e0; }
		h1 { color: #fff; }
		.meta { color: #888; margin-bottom: 20px; }
		.message { margin: 15px 0; padding: 15px; border-radius: 12px; }
		.user-message { background: #3b82f6; margin-left: 40px; }
		.assistant-message { background: #2a2a2a; margin-right: 40px; }
		.message-header { display: flex; gap: 10px; margin-bottom: 8px; font-size: 14px; }
		.timestamp { color: #888; }
		.model { background: #333; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
		.message-content { white-space: pre-wrap; line-height: 1.5; }
		code { background: #333; padding: 2px 6px; border-radius: 4px; }
		pre { background: #333; padding: 15px; border-radius: 8px; overflow-x: auto; }
	</style>
</head>
<body>
	<h1>${escapeHtml(conversation.title)}</h1>
	<div class="meta">
		<p>Model: ${escapeHtml(conversation.model)}</p>
		<p>Created: ${conversation.createdAt.toLocaleString()}</p>
	</div>
	${conversation.systemPrompt ? `<div class="system-prompt"><strong>System:</strong> ${escapeHtml(conversation.systemPrompt)}</div>` : ''}
	<div class="messages">
		${messages}
	</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
