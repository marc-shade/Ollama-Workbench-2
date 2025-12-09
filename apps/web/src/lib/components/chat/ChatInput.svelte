<script lang="ts">
	import { settingsStore } from '$stores/settings';
	import { chatStore } from '$stores/chat';
	import { Send, Paperclip, Mic, MicOff, Square, Loader2, Volume2 } from 'lucide-svelte';

	interface Props {
		onSend: (content: string, fromVoice?: boolean) => void;
		disabled?: boolean;
		placeholder?: string;
	}

	let { onSend, disabled = false, placeholder = 'Send a message...' }: Props = $props();

	let inputValue = $state('');
	let textarea: HTMLTextAreaElement;
	let isRecording = $state(false);
	let isTranscribing = $state(false);
	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let recordingDuration = $state(0);
	let recordingInterval: NodeJS.Timeout | null = null;
	let activeStream: MediaStream | null = null; // Track stream for cleanup
	let isStoppingRecording = $state(false); // Guard against double-stop

	// Web Speech API for real-time transcription (fallback)
	let recognition: SpeechRecognition | null = null;
	let interimTranscript = $state('');

	function handleSubmit() {
		if (inputValue.trim() && !disabled) {
			onSend(inputValue.trim());
			inputValue = '';
			interimTranscript = '';
			// Reset textarea height
			if (textarea) {
				textarea.style.height = 'auto';
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && $settingsStore.sendOnEnter) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function handleInput() {
		// Auto-resize textarea
		if (textarea) {
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
		}
	}

	async function startRecording() {
		// Guard: prevent double-start
		if (isRecording || isStoppingRecording) return;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			activeStream = stream; // Store for cleanup

			// Try Web Speech API for real-time transcription
			if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
				const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
				recognition = new SpeechRecognition();
				recognition.continuous = true;
				recognition.interimResults = true;
				recognition.lang = $chatStore.voiceSettings.inputLanguage || 'en-US';

				recognition.onresult = (event: any) => {
					let interim = '';
					let final = '';

					for (let i = event.resultIndex; i < event.results.length; i++) {
						const transcript = event.results[i][0].transcript;
						if (event.results[i].isFinal) {
							final += transcript;
						} else {
							interim += transcript;
						}
					}

					if (final) {
						inputValue += final + ' ';
					}
					interimTranscript = interim;
				};

				recognition.onerror = (event: any) => {
					console.error('Speech recognition error:', event.error);
				};

				recognition.start();
			}

			// Also record audio for fallback/better quality transcription
			mediaRecorder = new MediaRecorder(stream);
			audioChunks = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunks.push(e.data);
				}
			};

			mediaRecorder.onstop = async () => {
				// Stream tracks are stopped in stopRecording()
				// Only handle transcription here
				if (audioChunks.length > 0 && !inputValue.trim()) {
					await transcribeWithWhisper();
				}
			};

			mediaRecorder.start(1000); // Collect data every second
			isRecording = true;
			recordingDuration = 0;
			chatStore.setRecording(true);

			// Update duration display
			recordingInterval = setInterval(() => {
				recordingDuration++;
			}, 1000);
		} catch (error) {
			console.error('Failed to start recording:', error);
			alert('Could not access microphone. Please check permissions.');
		}
	}

	function stopRecording() {
		// Guard: prevent double-stop race condition
		if (isStoppingRecording || !isRecording) return;

		// Set state flags FIRST to prevent race conditions
		isStoppingRecording = true;
		isRecording = false;
		chatStore.setRecording(false);
		interimTranscript = '';

		// Clear interval immediately
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

		// Stop recognition
		if (recognition) {
			try {
				recognition.stop();
			} catch (e) {
				// Ignore errors from already-stopped recognition
			}
			recognition = null;
		}

		// Stop media recorder (this triggers onstop callback)
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			try {
				mediaRecorder.stop();
			} catch (e) {
				// Ignore errors from already-stopped recorder
			}
		}

		// Ensure stream tracks are stopped even if onstop doesn't fire
		if (activeStream) {
			activeStream.getTracks().forEach((track) => track.stop());
			activeStream = null;
		}

		// Reset guard after a tick to allow new recordings
		setTimeout(() => {
			isStoppingRecording = false;
		}, 100);
	}

	async function transcribeWithWhisper() {
		if (audioChunks.length === 0) return;

		isTranscribing = true;

		try {
			const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
			const formData = new FormData();
			formData.append('audio', audioBlob, 'recording.webm');

			// Try voice-mode MCP endpoint first
			const response = await fetch('/api/voice/transcribe', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const data = await response.json();
				if (data.text) {
					inputValue = data.text;
				}
			}
		} catch (error) {
			console.error('Transcription failed:', error);
			// Web Speech API result is already in inputValue
		} finally {
			isTranscribing = false;
			audioChunks = [];
		}
	}

	function toggleRecording() {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	}

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			// Stop all resources synchronously on unmount
			if (recognition) {
				try {
					recognition.stop();
				} catch (e) {
					// Ignore
				}
				recognition = null;
			}
			if (mediaRecorder && mediaRecorder.state !== 'inactive') {
				try {
					mediaRecorder.stop();
				} catch (e) {
					// Ignore
				}
			}
			if (recordingInterval) {
				clearInterval(recordingInterval);
				recordingInterval = null;
			}
			// Stop stream tracks to release microphone
			if (activeStream) {
				activeStream.getTracks().forEach((track) => track.stop());
				activeStream = null;
			}
			// Clear state
			audioChunks = [];
			isRecording = false;
			isStoppingRecording = false;
		};
	});
</script>

<div class="relative">
	<div class="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background {isRecording ? 'border-red-500 ring-2 ring-red-500/20' : ''}">
		<!-- Attachment Button -->
		<button
			type="button"
			class="flex-shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
			title="Attach file"
			aria-label="Attach file"
		>
			<Paperclip class="h-5 w-5" aria-hidden="true" />
		</button>

		<!-- Text Input -->
		<div class="flex-1 relative">
			<textarea
				bind:this={textarea}
				bind:value={inputValue}
				onkeydown={handleKeydown}
				oninput={handleInput}
				placeholder={isRecording ? 'Listening...' : placeholder}
				disabled={disabled || isTranscribing}
				rows="1"
				class="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				style="max-height: 200px;"
			></textarea>

			<!-- Interim transcript overlay -->
			{#if interimTranscript}
				<div class="absolute bottom-full left-0 right-0 mb-1 rounded-lg bg-muted/90 px-3 py-1.5 text-sm text-muted-foreground italic">
					{interimTranscript}
				</div>
			{/if}
		</div>

		<!-- Recording duration -->
		{#if isRecording}
			<div class="flex items-center gap-2 px-2 text-sm text-red-500">
				<span class="recording-indicator h-2 w-2 rounded-full bg-red-500"></span>
				<span class="font-mono">{formatDuration(recordingDuration)}</span>
			</div>
		{/if}

		<!-- Voice Button -->
		<button
			type="button"
			onclick={toggleRecording}
			disabled={disabled || isTranscribing}
			class="flex-shrink-0 rounded-lg p-2 transition-colors {isRecording
				? 'bg-red-500 text-white hover:bg-red-600'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'} disabled:opacity-50 disabled:cursor-not-allowed"
			title={isRecording ? 'Stop recording' : 'Voice input'}
			aria-label={isTranscribing ? 'Transcribing audio' : isRecording ? 'Stop recording' : 'Start voice input'}
			aria-pressed={isRecording}
		>
			{#if isTranscribing}
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			{:else if isRecording}
				<MicOff class="h-5 w-5" aria-hidden="true" />
			{:else}
				<Mic class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		<!-- TTS Toggle (for response playback) -->
		{#if $chatStore.voiceSettings.enabled}
			<button
				type="button"
				onclick={() => chatStore.updateVoiceSettings({ autoPlay: !$chatStore.voiceSettings.autoPlay })}
				class="flex-shrink-0 rounded-lg p-2 transition-colors {$chatStore.voiceSettings.autoPlay
					? 'bg-primary/20 text-primary'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				title={$chatStore.voiceSettings.autoPlay ? 'Auto-play responses: ON' : 'Auto-play responses: OFF'}
				aria-label={$chatStore.voiceSettings.autoPlay ? 'Disable auto-play responses' : 'Enable auto-play responses'}
				aria-pressed={$chatStore.voiceSettings.autoPlay}
			>
				<Volume2 class="h-5 w-5" aria-hidden="true" />
			</button>
		{/if}

		<!-- Send/Stop Button -->
		{#if disabled}
			<button
				type="button"
				class="flex-shrink-0 rounded-lg bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90 transition-colors"
				title="Stop generating"
				aria-label="Stop generating response"
			>
				<Square class="h-5 w-5" aria-hidden="true" />
			</button>
		{:else}
			<button
				type="button"
				onclick={handleSubmit}
				disabled={!inputValue.trim() || isRecording}
				class="flex-shrink-0 rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				title="Send message"
				aria-label="Send message"
			>
				<Send class="h-5 w-5" aria-hidden="true" />
			</button>
		{/if}
	</div>

	<!-- Hint Text -->
	<p class="mt-2 text-center text-xs text-muted-foreground">
		{#if isRecording}
			Click <kbd class="rounded border border-border px-1">Mic</kbd> to stop recording
		{:else if $settingsStore.sendOnEnter}
			Press <kbd class="rounded border border-border px-1">Enter</kbd> to send,
			<kbd class="rounded border border-border px-1">Shift+Enter</kbd> for new line
		{:else}
			Click send or press <kbd class="rounded border border-border px-1">Ctrl+Enter</kbd>
		{/if}
	</p>
</div>

<style>
	.recording-indicator {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
</style>
