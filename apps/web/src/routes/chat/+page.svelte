<script lang="ts">
	import {
		chatStore,
		activeConversation,
		activeMessages,
		conversationBranches,
		activeBranch,
		exportToJSON,
		exportToMarkdown,
		exportToHTML,
		type Message
	} from '$stores/chat';
	import { settingsStore } from '$stores/settings';
	import {
		agentSettingsStore,
		computedSystemPrompt,
		ollamaOptions,
		selectedAgentType,
		selectedMetacognitiveType,
		selectedVoiceType
	} from '$stores/agentSettings';
	import { onMount, tick } from 'svelte';
	import ChatInput from '$components/chat/ChatInput.svelte';
	import ChatMessage from '$components/chat/ChatMessage.svelte';
	import ChatWelcome from '$components/chat/ChatWelcome.svelte';
	import ConversationSidebar from '$components/chat/ConversationSidebar.svelte';
	import AgentSettingsPanel from '$components/chat/AgentSettingsPanel.svelte';
	import {
		PanelLeftClose,
		PanelLeft,
		Settings2,
		GitBranch,
		ChevronDown,
		Download,
		FileJson,
		FileText,
		FileCode,
		Volume2,
		VolumeX,
		Mic,
		Settings,
		X,
		Plus,
		Trash2,
		Edit2,
		Sliders
	} from 'lucide-svelte';

	let messagesContainer: HTMLDivElement;
	let sidebarCollapsed = $state(false);
	let showAgentSettings = $state(false);
	let showBranchMenu = $state(false);
	let showExportMenu = $state(false);
	let showVoiceSettings = $state(false);
	let editingBranchId = $state<string | null>(null);
	let editingBranchName = $state('');
	let abortController: AbortController | null = null;

	// Cleanup on component unmount
	$effect(() => {
		return () => {
			abortController?.abort();
		};
	});

	// Auto-scroll to bottom on new messages
	$effect(() => {
		if ($activeMessages.length > 0) {
			tick().then(() => {
				messagesContainer?.scrollTo({
					top: messagesContainer.scrollHeight,
					behavior: 'smooth'
				});
			});
		}
	});

	async function sendMessage(content: string, fromVoice?: boolean) {
		if (!content.trim() || $chatStore.isGenerating) return;

		// Prevent duplicate requests
		if (abortController) {
			console.warn('Request already in progress');
			return;
		}

		// Create conversation if none active
		if (!$activeConversation) {
			chatStore.createConversation($settingsStore.defaultModel, $computedSystemPrompt || undefined);
		}

		// Add user message
		chatStore.addMessage({
			role: 'user',
			content,
			transcribedFrom: fromVoice ? 'voice' : undefined
		});

		// Add placeholder assistant message
		const assistantMsgId = chatStore.addMessage({
			role: 'assistant',
			content: '',
			model: $settingsStore.defaultModel,
			isStreaming: true
		});

		chatStore.setGenerating(true);
		abortController = new AbortController();
		let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

		// Build messages array with system prompt
		const messages = [];

		// Add computed system prompt if we have agent settings configured
		const systemPrompt = $computedSystemPrompt;
		if (systemPrompt) {
			messages.push({ role: 'system', content: systemPrompt });
		}

		// Add conversation messages (excluding streaming placeholder)
		messages.push(
			...$activeMessages
				.filter((m) => m.id !== assistantMsgId)
				.map((m) => ({
					role: m.role,
					content: m.content
				}))
		);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: abortController.signal,
				body: JSON.stringify({
					model: $settingsStore.defaultModel,
					messages,
					stream: $agentSettingsStore.enableStreaming,
					options: $ollamaOptions,
					// Pass additional settings for backend processing
					agentSettings: {
						chatMode: $agentSettingsStore.chatMode,
						agentType: $selectedAgentType?.name || null,
						metacognitiveType: $selectedMetacognitiveType?.name || null,
						voiceType: $selectedVoiceType?.name || null,
						enableToolUse: $agentSettingsStore.enableToolUse,
						enableRAG: $agentSettingsStore.enableRAG,
						corpusId: $agentSettingsStore.corpusId,
						iapSettings: $agentSettingsStore.iapSettings
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				// Handle FastAPI validation errors (detail is array) or simple errors
				let errorDetail: string;
				if (Array.isArray(errorData.detail)) {
					errorDetail = errorData.detail.map((e: { msg?: string }) => e.msg || 'Validation error').join('; ');
				} else {
					errorDetail = errorData.detail || `Chat request failed (${response.status})`;
				}
				throw new Error(errorDetail);
			}

			if ($agentSettingsStore.enableStreaming) {
				// Stream response
				reader = response.body?.getReader() ?? null;
				if (!reader) throw new Error('No response body');

				const decoder = new TextDecoder();
				let fullContent = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const chunk = decoder.decode(value);
						const lines = chunk.split('\n').filter(Boolean);

						for (const line of lines) {
							try {
								const data = JSON.parse(line);
								if (data.message?.content) {
									fullContent += data.message.content;
									chatStore.updateMessage(assistantMsgId, {
										content: fullContent
									});
								}
							} catch {
								// Ignore parse errors for partial JSON
							}
						}
					}
				} catch (streamError) {
					// Handle stream interruption
					if (streamError instanceof Error && streamError.name !== 'AbortError') {
						console.error('Stream interrupted:', streamError);
						if (fullContent) {
							fullContent += '\n\n[Connection interrupted. Response may be incomplete.]';
						}
					}
					throw streamError;
				} finally {
					// Always release the reader lock
					reader?.releaseLock();
				}

				chatStore.updateMessage(assistantMsgId, { isStreaming: false });

				// Auto-play TTS if enabled
				if ($chatStore.voiceSettings.enabled && $chatStore.voiceSettings.autoPlay && fullContent) {
					playTTS(fullContent);
				}
			} else {
				// Non-streaming response
				const data = await response.json();
				const content = data.message?.content || '';
				chatStore.updateMessage(assistantMsgId, {
					content,
					isStreaming: false
				});

				// Auto-play TTS if enabled
				if ($chatStore.voiceSettings.enabled && $chatStore.voiceSettings.autoPlay && content) {
					playTTS(content);
				}
			}
		} catch (error) {
			// Handle abort gracefully
			if (error instanceof Error && error.name === 'AbortError') {
				console.log('Request cancelled');
				chatStore.updateMessage(assistantMsgId, {
					content: '[Request cancelled]',
					isStreaming: false
				});
				return;
			}

			console.error('Chat error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			chatStore.updateMessage(assistantMsgId, {
				content: `Error: ${errorMessage}`,
				isStreaming: false
			});
		} finally {
			chatStore.setGenerating(false);
			abortController = null;
		}
	}

	async function playTTS(text: string) {
		try {
			const response = await fetch('/api/voice/speak', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text,
					voice: $chatStore.voiceSettings.voice,
					rate: `+${($chatStore.voiceSettings.speed - 1) * 100}%`
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data.audioUrl) {
					const audio = new Audio(data.audioUrl);
					audio.play();
					return;
				}
				// Handle fallback response from server
				if (data.useBrowserTTS) {
					useBrowserSpeech(text);
					return;
				}
			}
			// If response not ok, fallback to browser TTS
			useBrowserSpeech(text);
		} catch (error) {
			console.error('TTS failed:', error);
			useBrowserSpeech(text);
		}
	}

	function useBrowserSpeech(text: string) {
		if ('speechSynthesis' in window) {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = $chatStore.voiceSettings.speed;
			speechSynthesis.speak(utterance);
		}
	}

	function handleBranch(messageId: string) {
		const branchName = prompt('Enter branch name:', `Branch ${$conversationBranches.length}`);
		if (branchName) {
			chatStore.branchFrom(messageId, branchName);
		}
	}

	function handleDelete(messageId: string) {
		chatStore.deleteMessage(messageId);
	}

	function handleRegenerate(messageId: string) {
		// Find the message before this one to get context
		const msgIndex = $activeMessages.findIndex((m) => m.id === messageId);
		if (msgIndex <= 0) return;

		// Delete the current assistant message
		chatStore.deleteMessage(messageId);

		// Resend the last user message
		const lastUserMsg = $activeMessages.slice(0, msgIndex).reverse().find((m) => m.role === 'user');
		if (lastUserMsg) {
			// The sendMessage will add a new assistant message
			sendMessage(lastUserMsg.content);
		}
	}

	function switchToBranch(branchId: string) {
		chatStore.switchBranch(branchId);
		showBranchMenu = false;
	}

	function startEditBranch(branchId: string, name: string) {
		editingBranchId = branchId;
		editingBranchName = name;
	}

	function saveBranchName() {
		if (editingBranchId && editingBranchName.trim()) {
			chatStore.renameBranch(editingBranchId, editingBranchName.trim());
		}
		editingBranchId = null;
		editingBranchName = '';
	}

	function deleteBranch(branchId: string) {
		if (branchId === 'main') return;
		if (confirm('Delete this branch and all its messages?')) {
			chatStore.deleteBranch(branchId);
		}
	}

	function exportConversation(format: 'json' | 'markdown' | 'html') {
		if (!$activeConversation) return;

		let content: string;
		let filename: string;
		let mimeType: string;

		const title = $activeConversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

		switch (format) {
			case 'json':
				content = exportToJSON($activeConversation);
				filename = `${title}.json`;
				mimeType = 'application/json';
				break;
			case 'markdown':
				content = exportToMarkdown($activeConversation);
				filename = `${title}.md`;
				mimeType = 'text/markdown';
				break;
			case 'html':
				content = exportToHTML($activeConversation);
				filename = `${title}.html`;
				mimeType = 'text/html';
				break;
		}

		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		showExportMenu = false;
	}

	function toggleVoice() {
		chatStore.updateVoiceSettings({ enabled: !$chatStore.voiceSettings.enabled });
	}
</script>

<div class="flex h-full">
	<!-- Conversation Sidebar -->
	<ConversationSidebar
		bind:collapsed={sidebarCollapsed}
		onToggle={() => (sidebarCollapsed = !sidebarCollapsed)}
	/>

	<!-- Collapsed Sidebar Toggle -->
	{#if sidebarCollapsed}
		<button
			type="button"
			onclick={() => (sidebarCollapsed = false)}
			class="flex h-full w-10 items-center justify-center border-r border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
			title="Show conversations"
		>
			<PanelLeft class="h-4 w-4" />
		</button>
	{/if}

	<!-- Main Chat Area -->
	<div class="flex flex-1 flex-col">
		<!-- Chat Header (when conversation active) -->
		{#if $activeConversation}
			<div class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
				<div class="flex items-center gap-3">
					<!-- Branch Selector -->
					{#if $conversationBranches.length > 1}
						<div class="relative">
							<button
								onclick={() => (showBranchMenu = !showBranchMenu)}
								class="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
							>
								<GitBranch class="h-4 w-4 text-blue-500" />
								<span>{$activeBranch?.name || 'Main'}</span>
								<ChevronDown class="h-4 w-4 text-muted-foreground" />
							</button>

							{#if showBranchMenu}
								<div class="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg">
									<div class="p-2">
										<div class="mb-2 px-2 text-xs font-medium text-muted-foreground uppercase">
											Branches ({$conversationBranches.length})
										</div>
										{#each $conversationBranches as branch}
											<div class="flex items-center gap-2 rounded-lg hover:bg-muted">
												{#if editingBranchId === branch.id}
													<input
														type="text"
														bind:value={editingBranchName}
														onkeydown={(e) => e.key === 'Enter' && saveBranchName()}
														onblur={saveBranchName}
														class="flex-1 rounded bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
													/>
												{:else}
													<button
														onclick={() => switchToBranch(branch.id)}
														class="flex flex-1 items-center gap-2 px-2 py-1.5 text-sm text-left {$activeBranch?.id === branch.id
															? 'text-primary font-medium'
															: ''}"
													>
														<GitBranch class="h-3 w-3" />
														{branch.name}
														{#if branch.id === 'main'}
															<span class="text-xs text-muted-foreground">(default)</span>
														{/if}
													</button>
													<button
														onclick={() => startEditBranch(branch.id, branch.name)}
														class="p-1 text-muted-foreground hover:text-foreground"
														title="Rename"
													>
														<Edit2 class="h-3 w-3" />
													</button>
													{#if branch.id !== 'main'}
														<button
															onclick={() => deleteBranch(branch.id)}
															class="p-1 text-muted-foreground hover:text-red-500"
															title="Delete branch"
														>
															<Trash2 class="h-3 w-3" />
														</button>
													{/if}
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<span class="text-sm text-muted-foreground">
						{$activeMessages.length} messages
					</span>
				</div>

				<div class="flex items-center gap-2">
					<!-- Voice Toggle -->
					<button
						onclick={toggleVoice}
						class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors {$chatStore.voiceSettings.enabled
							? 'bg-primary/20 text-primary'
							: 'text-muted-foreground hover:bg-muted'}"
						title={$chatStore.voiceSettings.enabled ? 'Voice mode ON' : 'Voice mode OFF'}
					>
						{#if $chatStore.voiceSettings.enabled}
							<Volume2 class="h-4 w-4" />
						{:else}
							<VolumeX class="h-4 w-4" />
						{/if}
						Voice
					</button>

					<!-- Voice Settings -->
					{#if $chatStore.voiceSettings.enabled}
						<button
							onclick={() => (showVoiceSettings = !showVoiceSettings)}
							class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
							title="Voice settings"
						>
							<Settings class="h-4 w-4" />
						</button>
					{/if}

					<!-- Export Dropdown -->
					<div class="relative">
						<button
							onclick={() => (showExportMenu = !showExportMenu)}
							class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
							title="Export conversation"
						>
							<Download class="h-4 w-4" />
							Export
						</button>

						{#if showExportMenu}
							<div class="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg">
								<button
									onclick={() => exportConversation('json')}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors rounded-t-lg"
								>
									<FileJson class="h-4 w-4 text-yellow-500" />
									Export as JSON
								</button>
								<button
									onclick={() => exportConversation('markdown')}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
								>
									<FileText class="h-4 w-4 text-blue-500" />
									Export as Markdown
								</button>
								<button
									onclick={() => exportConversation('html')}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors rounded-b-lg"
								>
									<FileCode class="h-4 w-4 text-purple-500" />
									Export as HTML
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Voice Settings Panel -->
		{#if showVoiceSettings}
			<div class="border-b border-border bg-card/50 p-4">
				<div class="mx-auto max-w-3xl">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-medium">Voice Settings</h3>
						<button
							onclick={() => (showVoiceSettings = false)}
							class="text-muted-foreground hover:text-foreground"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
					<div class="grid grid-cols-3 gap-4">
						<div>
							<label for="voice-select" class="block text-xs text-muted-foreground mb-1">Voice</label>
							<select
								id="voice-select"
								value={$chatStore.voiceSettings.voice}
								onchange={(e) => chatStore.updateVoiceSettings({ voice: e.currentTarget.value })}
								class="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="en-IE-EmilyNeural">Emily (Irish)</option>
								<option value="en-US-JennyNeural">Jenny (US)</option>
								<option value="en-US-GuyNeural">Guy (US)</option>
								<option value="en-GB-SoniaNeural">Sonia (British)</option>
								<option value="en-AU-NatashaNeural">Natasha (Australian)</option>
							</select>
						</div>
						<div>
							<label for="voice-speed" class="block text-xs text-muted-foreground mb-1">Speed: {$chatStore.voiceSettings.speed}x</label>
							<input
								id="voice-speed"
								type="range"
								min="0.5"
								max="2"
								step="0.1"
								value={$chatStore.voiceSettings.speed}
								oninput={(e) =>
									chatStore.updateVoiceSettings({ speed: parseFloat(e.currentTarget.value) })}
								class="w-full"
							/>
						</div>
						<div>
							<label for="voice-language" class="block text-xs text-muted-foreground mb-1">Input Language</label>
							<select
								id="voice-language"
								value={$chatStore.voiceSettings.inputLanguage}
								onchange={(e) =>
									chatStore.updateVoiceSettings({ inputLanguage: e.currentTarget.value })}
								class="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="en-US">English (US)</option>
								<option value="en-GB">English (UK)</option>
								<option value="es-ES">Spanish</option>
								<option value="fr-FR">French</option>
								<option value="de-DE">German</option>
							</select>
						</div>
					</div>
					<div class="mt-3">
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={$chatStore.voiceSettings.autoPlay}
								onchange={(e) =>
									chatStore.updateVoiceSettings({ autoPlay: e.currentTarget.checked })}
								class="rounded"
							/>
							Auto-play assistant responses
						</label>
					</div>
				</div>
			</div>
		{/if}

		<!-- Messages Area -->
		<div
			bind:this={messagesContainer}
			class="flex-1 overflow-y-auto px-4 py-6"
		>
			{#if $activeMessages.length === 0}
				<ChatWelcome />
			{:else}
				<div class="mx-auto max-w-3xl space-y-6">
					{#each $activeMessages as message (message.id)}
						<ChatMessage
							{message}
							onBranch={handleBranch}
							onRegenerate={handleRegenerate}
							onDelete={handleDelete}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="border-t border-border bg-card p-4">
			<div class="mx-auto max-w-3xl space-y-3">
				<!-- Agent Settings Toggle -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						{#if $selectedAgentType}
							<span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
								{$selectedAgentType.name}
							</span>
						{/if}
						{#if $selectedMetacognitiveType}
							<span class="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
								{$selectedMetacognitiveType.name}
							</span>
						{/if}
						{#if $selectedVoiceType}
							<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
								{$selectedVoiceType.name}
							</span>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => (showAgentSettings = !showAgentSettings)}
						class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors {showAgentSettings
							? 'bg-muted text-foreground'
							: ''}"
					>
						<Sliders class="h-3.5 w-3.5" />
						Agent Settings
					</button>
				</div>

				<!-- Agent Settings Panel (collapsible) -->
				{#if showAgentSettings}
					<AgentSettingsPanel collapsed={false} />
				{/if}

				<ChatInput
					onSend={sendMessage}
					disabled={$chatStore.isGenerating}
					placeholder={$chatStore.isGenerating
						? 'Generating...'
						: $selectedAgentType
							? `Chat with ${$selectedAgentType.name}...`
							: 'Send a message...'}
				/>
			</div>
		</div>
	</div>
</div>

<!-- Click outside handlers for dropdowns -->
{#if showBranchMenu || showExportMenu}
	<button
		class="fixed inset-0 z-10"
		onclick={() => {
			showBranchMenu = false;
			showExportMenu = false;
		}}
		aria-label="Close menus"
	></button>
{/if}
