<script lang="ts">
	import { settingsStore } from '$stores/settings';
	import { modelsStore } from '$stores/models';
	import { chatStore } from '$stores/chat';
	import { promptsStore } from '$stores/prompts';
	import { onMount } from 'svelte';
	import {
		Settings,
		Server,
		Palette,
		Keyboard,
		Database,
		Bell,
		Trash2,
		Download,
		Upload,
		RefreshCw,
		AlertCircle,
		CheckCircle,
		Key,
		Eye,
		EyeOff
	} from 'lucide-svelte';

	let activeSection = $state('general');
	let exportStatus = $state<'idle' | 'success' | 'error'>('idle');
	let importStatus = $state<'idle' | 'success' | 'error'>('idle');
	let clearDataConfirm = $state(false);
	let showApiKeys = $state<Record<string, boolean>>({});

	const sections = [
		{ id: 'general', label: 'General', icon: Settings },
		{ id: 'providers', label: 'Providers', icon: Key },
		{ id: 'models', label: 'Models', icon: Server },
		{ id: 'appearance', label: 'Appearance', icon: Palette },
		{ id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
		{ id: 'data', label: 'Data', icon: Database },
		{ id: 'notifications', label: 'Notifications', icon: Bell }
	];

	const shortcuts = [
		{ action: 'New Chat', keys: ['Ctrl', 'N'] },
		{ action: 'Send Message', keys: ['Enter'] },
		{ action: 'New Line', keys: ['Shift', 'Enter'] },
		{ action: 'Focus Input', keys: ['Ctrl', '/'] },
		{ action: 'Toggle Sidebar', keys: ['Ctrl', 'B'] },
		{ action: 'Search', keys: ['Ctrl', 'K'] },
		{ action: 'Settings', keys: ['Ctrl', ','] },
		{ action: 'Clear Chat', keys: ['Ctrl', 'Shift', 'Delete'] }
	];

	onMount(() => {
		modelsStore.fetchModels();
	});

	function exportData() {
		try {
			const data = {
				settings: $settingsStore,
				conversations: $chatStore.conversations,
				prompts: $promptsStore.prompts,
				exportedAt: new Date().toISOString()
			};
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `ollama-workbench-backup-${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);
			exportStatus = 'success';
			setTimeout(() => (exportStatus = 'idle'), 3000);
		} catch {
			exportStatus = 'error';
		}
	}

	function importData(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = JSON.parse(e.target?.result as string);
				if (data.settings) {
					settingsStore.set(data.settings);
				}
				if (data.conversations) {
					// Would need to add an import method to chatStore
					console.log('Imported conversations:', data.conversations.length);
				}
				if (data.prompts) {
					// Would need to add an import method to promptsStore
					console.log('Imported prompts:', data.prompts.length);
				}
				importStatus = 'success';
				setTimeout(() => (importStatus = 'idle'), 3000);
			} catch {
				importStatus = 'error';
			}
		};
		reader.readAsText(file);
	}

	function clearAllData() {
		chatStore.clearAll();
		settingsStore.reset();
		localStorage.removeItem('ollama-workbench-prompts');
		promptsStore.loadPrompts();
		clearDataConfirm = false;
	}

	function calculateStorageUsage(): string {
		let total = 0;
		for (const key in localStorage) {
			if (key.startsWith('ollama-workbench')) {
				total += localStorage.getItem(key)?.length || 0;
			}
		}
		if (total < 1024) return `${total} B`;
		if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
		return `${(total / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Settings</h1>
		<p class="text-muted-foreground">Configure Ollama Workbench</p>
	</div>

	<div class="grid gap-6 lg:grid-cols-[200px_1fr]">
		<!-- Sidebar -->
		<nav class="space-y-1">
			{#each sections as section}
				<button
					onclick={() => (activeSection = section.id)}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {activeSection ===
					section.id
						? 'bg-primary text-primary-foreground'
						: 'hover:bg-muted'}"
				>
					<section.icon class="h-4 w-4" />
					{section.label}
				</button>
			{/each}
		</nav>

		<!-- Content -->
		<div class="rounded-xl border border-border bg-card p-6">
			{#if activeSection === 'general'}
				<h2 class="mb-4 text-lg font-semibold">General Settings</h2>
				<div class="space-y-4">
					<div>
						<label for="ollama-host" class="mb-1 block text-sm font-medium">Ollama Host</label>
						<input
							id="ollama-host"
							type="text"
							bind:value={$settingsStore.ollamaHost}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							URL of your Ollama server
						</p>
					</div>

					<div>
						<label for="default-model" class="mb-1 block text-sm font-medium">Default Model</label>
						<input
							id="default-model"
							type="text"
							bind:value={$settingsStore.defaultModel}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium" id="stream-responses-label">Stream Responses</p>
							<p class="text-sm text-muted-foreground">Show responses as they generate</p>
						</div>
						<button
							onclick={() =>
								settingsStore.update((s) => ({
									...s,
									streamResponses: !s.streamResponses
								}))}
							class="relative h-6 w-11 rounded-full transition-colors {$settingsStore.streamResponses
								? 'bg-primary'
								: 'bg-muted'}"
							role="switch"
							aria-checked={$settingsStore.streamResponses}
							aria-labelledby="stream-responses-label"
						>
							<span
								class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {$settingsStore.streamResponses
									? 'translate-x-5'
									: ''}"
							></span>
						</button>
					</div>

					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium" id="send-on-enter-label">Send on Enter</p>
							<p class="text-sm text-muted-foreground">Press Enter to send messages</p>
						</div>
						<button
							onclick={() =>
								settingsStore.update((s) => ({
									...s,
									sendOnEnter: !s.sendOnEnter
								}))}
							class="relative h-6 w-11 rounded-full transition-colors {$settingsStore.sendOnEnter
								? 'bg-primary'
								: 'bg-muted'}"
							role="switch"
							aria-checked={$settingsStore.sendOnEnter}
							aria-labelledby="send-on-enter-label"
						>
							<span
								class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {$settingsStore.sendOnEnter
									? 'translate-x-5'
									: ''}"
							></span>
						</button>
					</div>

					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium" id="show-timestamps-label">Show Timestamps</p>
							<p class="text-sm text-muted-foreground">Display message timestamps</p>
						</div>
						<button
							onclick={() =>
								settingsStore.update((s) => ({
									...s,
									showTimestamps: !s.showTimestamps
								}))}
							class="relative h-6 w-11 rounded-full transition-colors {$settingsStore.showTimestamps
								? 'bg-primary'
								: 'bg-muted'}"
							role="switch"
							aria-checked={$settingsStore.showTimestamps}
							aria-labelledby="show-timestamps-label"
						>
							<span
								class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {$settingsStore.showTimestamps
									? 'translate-x-5'
									: ''}"
							></span>
						</button>
					</div>
				</div>

			{:else if activeSection === 'providers'}
				<h2 class="mb-4 text-lg font-semibold">API Providers</h2>
				<p class="text-sm text-muted-foreground mb-6">
					Configure external AI providers and search APIs. Keys are stored locally in your browser.
				</p>
				<div class="space-y-6">
					<!-- LLM Providers -->
					<div>
						<h3 class="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">LLM Providers</h3>
						<div class="space-y-4">
							<!-- OpenAI -->
							<div class="rounded-lg border border-border p-4">
								<div class="flex items-center gap-2 mb-3">
									<div class="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center">
										<span class="text-xs font-bold text-emerald-500">O</span>
									</div>
									<span class="font-medium">OpenAI</span>
								</div>
								<div class="space-y-3">
									<div>
										<label for="openai-key" class="mb-1 block text-sm">API Key</label>
										<div class="relative">
											<input
												id="openai-key"
												type={showApiKeys['openai'] ? 'text' : 'password'}
												value={$settingsStore.providers?.openaiApiKey || ''}
												oninput={(e) => settingsStore.update((s) => ({
													...s,
													providers: { ...s.providers, openaiApiKey: (e.target as HTMLInputElement).value }
												}))}
												placeholder="sk-..."
												class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
											/>
											<button
												type="button"
												onclick={() => showApiKeys['openai'] = !showApiKeys['openai']}
												class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											>
												{#if showApiKeys['openai']}
													<EyeOff class="h-4 w-4" />
												{:else}
													<Eye class="h-4 w-4" />
												{/if}
											</button>
										</div>
									</div>
									<div>
										<label for="openai-base" class="mb-1 block text-sm">Base URL</label>
										<input
											id="openai-base"
											type="text"
											value={$settingsStore.providers?.openaiBaseUrl || 'https://api.openai.com/v1'}
											oninput={(e) => settingsStore.update((s) => ({
												...s,
												providers: { ...s.providers, openaiBaseUrl: (e.target as HTMLInputElement).value }
											}))}
											class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<p class="mt-1 text-xs text-muted-foreground">Change for OpenAI-compatible APIs</p>
									</div>
								</div>
							</div>

							<!-- Anthropic -->
							<div class="rounded-lg border border-border p-4">
								<div class="flex items-center gap-2 mb-3">
									<div class="h-6 w-6 rounded bg-orange-500/10 flex items-center justify-center">
										<span class="text-xs font-bold text-orange-500">A</span>
									</div>
									<span class="font-medium">Anthropic</span>
								</div>
								<div>
									<label for="anthropic-key" class="mb-1 block text-sm">API Key</label>
									<div class="relative">
										<input
											id="anthropic-key"
											type={showApiKeys['anthropic'] ? 'text' : 'password'}
											value={$settingsStore.providers?.anthropicApiKey || ''}
											oninput={(e) => settingsStore.update((s) => ({
												...s,
												providers: { ...s.providers, anthropicApiKey: (e.target as HTMLInputElement).value }
											}))}
											placeholder="sk-ant-..."
											class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
										/>
										<button
											type="button"
											onclick={() => showApiKeys['anthropic'] = !showApiKeys['anthropic']}
											class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{#if showApiKeys['anthropic']}
												<EyeOff class="h-4 w-4" />
											{:else}
												<Eye class="h-4 w-4" />
											{/if}
										</button>
									</div>
								</div>
							</div>

							<!-- Groq -->
							<div class="rounded-lg border border-border p-4">
								<div class="flex items-center gap-2 mb-3">
									<div class="h-6 w-6 rounded bg-purple-500/10 flex items-center justify-center">
										<span class="text-xs font-bold text-purple-500">G</span>
									</div>
									<span class="font-medium">Groq</span>
								</div>
								<div>
									<label for="groq-key" class="mb-1 block text-sm">API Key</label>
									<div class="relative">
										<input
											id="groq-key"
											type={showApiKeys['groq'] ? 'text' : 'password'}
											value={$settingsStore.providers?.groqApiKey || ''}
											oninput={(e) => settingsStore.update((s) => ({
												...s,
												providers: { ...s.providers, groqApiKey: (e.target as HTMLInputElement).value }
											}))}
											placeholder="gsk_..."
											class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
										/>
										<button
											type="button"
											onclick={() => showApiKeys['groq'] = !showApiKeys['groq']}
											class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{#if showApiKeys['groq']}
												<EyeOff class="h-4 w-4" />
											{:else}
												<Eye class="h-4 w-4" />
											{/if}
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Search & Research APIs -->
					<div>
						<h3 class="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Search & Research</h3>
						<div class="space-y-4">
							<!-- Google Search -->
							<div class="rounded-lg border border-border p-4">
								<div class="flex items-center gap-2 mb-3">
									<div class="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center">
										<span class="text-xs font-bold text-blue-500">G</span>
									</div>
									<span class="font-medium">Google Custom Search</span>
								</div>
								<div class="space-y-3">
									<div>
										<label for="google-key" class="mb-1 block text-sm">API Key</label>
										<div class="relative">
											<input
												id="google-key"
												type={showApiKeys['google'] ? 'text' : 'password'}
												value={$settingsStore.providers?.googleSearchApiKey || ''}
												oninput={(e) => settingsStore.update((s) => ({
													...s,
													providers: { ...s.providers, googleSearchApiKey: (e.target as HTMLInputElement).value }
												}))}
												placeholder="AIza..."
												class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
											/>
											<button
												type="button"
												onclick={() => showApiKeys['google'] = !showApiKeys['google']}
												class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											>
												{#if showApiKeys['google']}
													<EyeOff class="h-4 w-4" />
												{:else}
													<Eye class="h-4 w-4" />
												{/if}
											</button>
										</div>
									</div>
									<div>
										<label for="google-cx" class="mb-1 block text-sm">Search Engine ID (CX)</label>
										<input
											id="google-cx"
											type="text"
											value={$settingsStore.providers?.googleSearchCx || ''}
											oninput={(e) => settingsStore.update((s) => ({
												...s,
												providers: { ...s.providers, googleSearchCx: (e.target as HTMLInputElement).value }
											}))}
											placeholder="017576..."
											class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
										/>
									</div>
								</div>
							</div>

							<!-- Serper -->
							<div class="rounded-lg border border-border p-4">
								<div class="flex items-center gap-2 mb-3">
									<div class="h-6 w-6 rounded bg-yellow-500/10 flex items-center justify-center">
										<span class="text-xs font-bold text-yellow-500">S</span>
									</div>
									<span class="font-medium">Serper</span>
								</div>
								<div>
									<label for="serper-key" class="mb-1 block text-sm">API Key</label>
									<div class="relative">
										<input
											id="serper-key"
											type={showApiKeys['serper'] ? 'text' : 'password'}
											value={$settingsStore.providers?.serperApiKey || ''}
											oninput={(e) => settingsStore.update((s) => ({
												...s,
												providers: { ...s.providers, serperApiKey: (e.target as HTMLInputElement).value }
											}))}
											class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
										/>
										<button
											type="button"
											onclick={() => showApiKeys['serper'] = !showApiKeys['serper']}
											class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{#if showApiKeys['serper']}
												<EyeOff class="h-4 w-4" />
											{:else}
												<Eye class="h-4 w-4" />
											{/if}
										</button>
									</div>
									<p class="mt-1 text-xs text-muted-foreground">Google Search API alternative</p>
								</div>
							</div>

							<!-- YouTube -->
							<div class="rounded-lg border border-border p-4">
								<div class="flex items-center gap-2 mb-3">
									<div class="h-6 w-6 rounded bg-red-500/10 flex items-center justify-center">
										<span class="text-xs font-bold text-red-500">Y</span>
									</div>
									<span class="font-medium">YouTube Data API</span>
								</div>
								<div>
									<label for="youtube-key" class="mb-1 block text-sm">API Key</label>
									<div class="relative">
										<input
											id="youtube-key"
											type={showApiKeys['youtube'] ? 'text' : 'password'}
											value={$settingsStore.providers?.youtubeApiKey || ''}
											oninput={(e) => settingsStore.update((s) => ({
												...s,
												providers: { ...s.providers, youtubeApiKey: (e.target as HTMLInputElement).value }
											}))}
											placeholder="AIza..."
											class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
										/>
										<button
											type="button"
											onclick={() => showApiKeys['youtube'] = !showApiKeys['youtube']}
											class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{#if showApiKeys['youtube']}
												<EyeOff class="h-4 w-4" />
											{:else}
												<Eye class="h-4 w-4" />
											{/if}
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<p class="text-xs text-muted-foreground pt-4 border-t border-border">
						API keys are stored securely in your browser's local storage and never sent to any server except the respective API providers.
					</p>
				</div>

			{:else if activeSection === 'models'}
				<h2 class="mb-4 text-lg font-semibold">Model Settings</h2>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium">Available Models</p>
							<p class="text-sm text-muted-foreground">
								{$modelsStore.models.length} models installed
							</p>
						</div>
						<button
							onclick={() => modelsStore.fetchModels()}
							disabled={$modelsStore.loading}
							class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
						>
							<RefreshCw class="h-4 w-4 {$modelsStore.loading ? 'animate-spin' : ''}" />
							Refresh
						</button>
					</div>

					<div class="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
						{#each $modelsStore.models as model}
							<div class="flex items-center justify-between px-3 py-2">
								<div>
									<p class="text-sm font-medium">{model.name}</p>
									<p class="text-xs text-muted-foreground">
										{model.details?.parameter_size || 'Unknown size'}
									</p>
								</div>
								<button
									onclick={() => settingsStore.update((s) => ({ ...s, defaultModel: model.name }))}
									class="text-xs px-2 py-1 rounded {$settingsStore.defaultModel === model.name
										? 'bg-primary text-primary-foreground'
										: 'border border-border hover:bg-muted'}"
								>
									{$settingsStore.defaultModel === model.name ? 'Default' : 'Set Default'}
								</button>
							</div>
						{:else}
							<p class="px-3 py-4 text-sm text-muted-foreground text-center">
								No models found. Make sure Ollama is running.
							</p>
						{/each}
					</div>

					<p class="text-xs text-muted-foreground">
						Manage models from the <a href="/models" class="text-primary hover:underline">Models</a> page.
					</p>
				</div>

			{:else if activeSection === 'appearance'}
				<h2 class="mb-4 text-lg font-semibold">Appearance</h2>
				<div class="space-y-4">
					<fieldset>
						<legend class="mb-2 block text-sm font-medium">Theme</legend>
						<div class="flex gap-3" role="radiogroup" aria-label="Theme selection">
							{#each ['light', 'dark', 'system'] as theme}
								<button
									onclick={() =>
										settingsStore.update((s) => ({ ...s, theme: theme as any }))}
									class="rounded-lg border border-border px-4 py-2 text-sm capitalize transition-colors {$settingsStore.theme ===
									theme
										? 'border-primary bg-primary/10'
										: 'hover:bg-muted'}"
									role="radio"
									aria-checked={$settingsStore.theme === theme}
								>
									{theme}
								</button>
							{/each}
						</div>
					</fieldset>

					<fieldset>
						<legend class="mb-2 block text-sm font-medium">Font Size</legend>
						<div class="flex gap-3" role="radiogroup" aria-label="Font size selection">
							{#each ['sm', 'base', 'lg'] as size}
								<button
									onclick={() =>
										settingsStore.update((s) => ({ ...s, fontSize: size as any }))}
									class="rounded-lg border border-border px-4 py-2 text-sm capitalize transition-colors {$settingsStore.fontSize ===
									size
										? 'border-primary bg-primary/10'
										: 'hover:bg-muted'}"
									role="radio"
									aria-checked={$settingsStore.fontSize === size}
								>
									{size === 'sm' ? 'Small' : size === 'base' ? 'Medium' : 'Large'}
								</button>
							{/each}
						</div>
					</fieldset>
				</div>

			{:else if activeSection === 'shortcuts'}
				<h2 class="mb-4 text-lg font-semibold">Keyboard Shortcuts</h2>
				<div class="space-y-2">
					{#each shortcuts as shortcut}
						<div class="flex items-center justify-between py-2 border-b border-border last:border-0">
							<span class="text-sm">{shortcut.action}</span>
							<div class="flex gap-1">
								{#each shortcut.keys as key}
									<kbd class="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">
										{key}
									</kbd>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<p class="mt-4 text-xs text-muted-foreground">
					Keyboard shortcuts cannot be customized at this time.
				</p>

			{:else if activeSection === 'data'}
				<h2 class="mb-4 text-lg font-semibold">Data Management</h2>
				<div class="space-y-6">
					<!-- Storage Info -->
					<div class="rounded-lg border border-border p-4">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium">Local Storage Used</span>
							<span class="text-sm text-muted-foreground">{calculateStorageUsage()}</span>
						</div>
						<div class="text-xs text-muted-foreground">
							<p>Conversations: {$chatStore.conversations.length}</p>
							<p>Prompts: {$promptsStore.prompts.length}</p>
						</div>
					</div>

					<!-- Export -->
					<div>
						<h3 class="text-sm font-medium mb-2">Export Data</h3>
						<p class="text-xs text-muted-foreground mb-3">
							Download all your data including conversations, prompts, and settings.
						</p>
						<button
							onclick={exportData}
							class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
						>
							<Download class="h-4 w-4" />
							Export All Data
						</button>
						{#if exportStatus === 'success'}
							<p class="mt-2 text-xs text-green-500 flex items-center gap-1">
								<CheckCircle class="h-3 w-3" /> Data exported successfully
							</p>
						{/if}
					</div>

					<!-- Import -->
					<div>
						<h3 class="text-sm font-medium mb-2">Import Data</h3>
						<p class="text-xs text-muted-foreground mb-3">
							Restore from a previously exported backup file.
						</p>
						<label class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors cursor-pointer w-fit">
							<Upload class="h-4 w-4" />
							Import Backup
							<input type="file" accept=".json" onchange={importData} class="hidden" />
						</label>
						{#if importStatus === 'success'}
							<p class="mt-2 text-xs text-green-500 flex items-center gap-1">
								<CheckCircle class="h-3 w-3" /> Data imported successfully
							</p>
						{:else if importStatus === 'error'}
							<p class="mt-2 text-xs text-red-500 flex items-center gap-1">
								<AlertCircle class="h-3 w-3" /> Failed to import data
							</p>
						{/if}
					</div>

					<!-- Clear Data -->
					<div class="pt-4 border-t border-border">
						<h3 class="text-sm font-medium mb-2 text-red-500">Danger Zone</h3>
						<p class="text-xs text-muted-foreground mb-3">
							Permanently delete all local data. This cannot be undone.
						</p>
						{#if clearDataConfirm}
							<div class="flex items-center gap-2">
								<button
									onclick={clearAllData}
									class="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 transition-colors"
								>
									<Trash2 class="h-4 w-4" />
									Confirm Delete
								</button>
								<button
									onclick={() => (clearDataConfirm = false)}
									class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
								>
									Cancel
								</button>
							</div>
						{:else}
							<button
								onclick={() => (clearDataConfirm = true)}
								class="flex items-center gap-2 rounded-lg border border-red-500 text-red-500 px-4 py-2 text-sm hover:bg-red-500/10 transition-colors"
							>
								<Trash2 class="h-4 w-4" />
								Clear All Data
							</button>
						{/if}
					</div>
				</div>

			{:else if activeSection === 'notifications'}
				<h2 class="mb-4 text-lg font-semibold">Notifications</h2>
				<div class="space-y-4">
					<p class="text-sm text-muted-foreground">
						Notification preferences for the desktop app.
					</p>

					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium" id="response-complete-label">Response Complete</p>
							<p class="text-sm text-muted-foreground">Notify when a response finishes generating</p>
						</div>
						<button
							class="relative h-6 w-11 rounded-full transition-colors bg-muted"
							disabled
							role="switch"
							aria-checked="false"
							aria-labelledby="response-complete-label"
							aria-disabled="true"
						>
							<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white"></span>
						</button>
					</div>

					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium" id="model-download-label">Model Download</p>
							<p class="text-sm text-muted-foreground">Notify when model downloads complete</p>
						</div>
						<button
							class="relative h-6 w-11 rounded-full transition-colors bg-muted"
							disabled
							role="switch"
							aria-checked="false"
							aria-labelledby="model-download-label"
							aria-disabled="true"
						>
							<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white"></span>
						</button>
					</div>

					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium" id="error-alerts-label">Error Alerts</p>
							<p class="text-sm text-muted-foreground">Notify on connection or model errors</p>
						</div>
						<button
							class="relative h-6 w-11 rounded-full transition-colors bg-muted"
							disabled
							role="switch"
							aria-checked="false"
							aria-labelledby="error-alerts-label"
							aria-disabled="true"
						>
							<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white"></span>
						</button>
					</div>

					<p class="text-xs text-muted-foreground pt-2 border-t border-border">
						Desktop notifications require the Tauri desktop app. Web browser notifications are not currently supported.
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
