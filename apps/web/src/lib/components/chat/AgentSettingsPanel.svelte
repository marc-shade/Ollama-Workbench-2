<script lang="ts">
	import {
		agentSettingsStore,
		agentTypesStore,
		metacognitiveTypesStore,
		voiceTypesStore,
		corpusStore,
		type ChatMode,
		type CoTStrategy
	} from '$stores/agentSettings';
	import {
		Settings2,
		ChevronDown,
		ChevronUp,
		Brain,
		MessageSquare,
		Code,
		Sparkles,
		BarChart3,
		Book,
		User,
		Mic2,
		Database,
		RotateCcw,
		Zap,
		Lightbulb,
		X
	} from 'lucide-svelte';

	interface Props {
		collapsed?: boolean;
	}

	let { collapsed = $bindable(true) }: Props = $props();

	let showAdvanced = $state(false);
	let showThinking = $state(false);

	const chatModes: { id: ChatMode; name: string; icon: typeof Code; description: string }[] = [
		{ id: 'general', name: 'General', icon: MessageSquare, description: 'Versatile conversation mode' },
		{ id: 'code', name: 'Code', icon: Code, description: 'Optimized for programming tasks' },
		{ id: 'creative', name: 'Creative', icon: Sparkles, description: 'Enhanced creativity and imagination' },
		{ id: 'analysis', name: 'Analysis', icon: BarChart3, description: 'Data-driven analytical approach' }
	];

	const cotStrategies: { id: CoTStrategy; name: string; description: string }[] = [
		{ id: 'none', name: 'None', description: 'Standard responses without explicit reasoning' },
		{ id: 'chain-of-thought', name: 'Chain of Thought', description: 'Step-by-step reasoning' },
		{ id: 'IAP-ss', name: 'IAP Single-Saliency', description: 'Adaptive prompting with saliency threshold' },
		{ id: 'IAP-mv', name: 'IAP Multi-Vote', description: 'Multiple prompt variations with voting' },
		{ id: 'tree-of-thought', name: 'Tree of Thought', description: 'Explore multiple reasoning branches' }
	];

	function resetAllSettings() {
		if (confirm('Reset all agent settings to defaults?')) {
			agentSettingsStore.resetToDefaults();
		}
	}
</script>

<div class="rounded-xl border border-border bg-card">
	<!-- Header -->
	<button
		type="button"
		onclick={() => (collapsed = !collapsed)}
		class="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
	>
		<div class="flex items-center gap-2">
			<Settings2 class="h-4 w-4 text-primary" />
			<span class="font-medium text-sm">Agent Settings</span>
		</div>
		<div class="flex items-center gap-2">
			{#if $agentSettingsStore.agentTypeId}
				<span class="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
					{$agentTypesStore.find(t => t.id === $agentSettingsStore.agentTypeId)?.name || 'Custom'}
				</span>
			{/if}
			{#if collapsed}
				<ChevronDown class="h-4 w-4 text-muted-foreground" />
			{:else}
				<ChevronUp class="h-4 w-4 text-muted-foreground" />
			{/if}
		</div>
	</button>

	{#if !collapsed}
		<div class="border-t border-border p-4 space-y-5">
			<!-- Chat Mode -->
			<div class="space-y-2">
				<label class="text-sm font-medium flex items-center gap-2">
					<Zap class="h-4 w-4 text-yellow-500" />
					Chat Mode
				</label>
				<div class="grid grid-cols-4 gap-2">
					{#each chatModes as mode}
						<button
							type="button"
							onclick={() => agentSettingsStore.updateSettings({ chatMode: mode.id })}
							class="flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors
								{$agentSettingsStore.chatMode === mode.id
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border hover:bg-muted'}"
							title={mode.description}
						>
							<mode.icon class="h-4 w-4" />
							{mode.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- Agent Type -->
			<div class="space-y-2">
				<label for="agent-type" class="text-sm font-medium flex items-center gap-2">
					<User class="h-4 w-4 text-blue-500" />
					Agent Type
				</label>
				<select
					id="agent-type"
					value={$agentSettingsStore.agentTypeId || ''}
					onchange={(e) => agentSettingsStore.updateSettings({
						agentTypeId: e.currentTarget.value || null
					})}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">None (Default)</option>
					<optgroup label="Built-in Agents">
						{#each $agentTypesStore.filter(t => t.isBuiltIn) as agent}
							<option value={agent.id}>{agent.name} - {agent.description}</option>
						{/each}
					</optgroup>
					{#if $agentTypesStore.some(t => !t.isBuiltIn)}
						<optgroup label="Custom Agents">
							{#each $agentTypesStore.filter(t => !t.isBuiltIn) as agent}
								<option value={agent.id}>{agent.name}</option>
							{/each}
						</optgroup>
					{/if}
				</select>
			</div>

			<!-- Metacognitive Type -->
			<div class="space-y-2">
				<label for="metacognitive-type" class="text-sm font-medium flex items-center gap-2">
					<Brain class="h-4 w-4 text-purple-500" />
					Metacognitive Type
				</label>
				<select
					id="metacognitive-type"
					value={$agentSettingsStore.metacognitiveTypeId || ''}
					onchange={(e) => agentSettingsStore.updateSettings({
						metacognitiveTypeId: e.currentTarget.value || null
					})}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">None</option>
					{#each $metacognitiveTypesStore as meta}
						<option value={meta.id}>{meta.name} - {meta.description}</option>
					{/each}
				</select>
			</div>

			<!-- Voice/Personality Type -->
			<div class="space-y-2">
				<label for="voice-type" class="text-sm font-medium flex items-center gap-2">
					<Mic2 class="h-4 w-4 text-green-500" />
					Voice / Personality
				</label>
				<select
					id="voice-type"
					value={$agentSettingsStore.voiceTypeId || ''}
					onchange={(e) => agentSettingsStore.updateSettings({
						voiceTypeId: e.currentTarget.value || null
					})}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">None (Neutral)</option>
					{#each $voiceTypesStore as voice}
						<option value={voice.id}>{voice.name} - {voice.description}</option>
					{/each}
				</select>
			</div>

			<!-- Corpus / Knowledge Base -->
			<div class="space-y-2">
				<label for="corpus" class="text-sm font-medium flex items-center gap-2">
					<Database class="h-4 w-4 text-orange-500" />
					Knowledge Base (Corpus)
				</label>
				<select
					id="corpus"
					value={$agentSettingsStore.corpusId || ''}
					onchange={(e) => agentSettingsStore.updateSettings({
						corpusId: e.currentTarget.value || null
					})}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">None</option>
					{#each $corpusStore as corpus}
						<option value={corpus.id}>{corpus.name} ({corpus.documentCount} docs)</option>
					{/each}
				</select>
				{#if $agentSettingsStore.corpusId}
					<label class="flex items-center gap-2 text-xs text-muted-foreground">
						<input
							type="checkbox"
							checked={$agentSettingsStore.enableRAG}
							onchange={(e) => agentSettingsStore.updateSettings({ enableRAG: e.currentTarget.checked })}
							class="rounded"
						/>
						Enable RAG (Retrieval Augmented Generation)
					</label>
				{/if}
			</div>

			<!-- Feature Toggles -->
			<div class="space-y-2">
				<div class="text-sm font-medium">Features</div>
				<div class="grid grid-cols-2 gap-2">
					<label class="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer hover:bg-muted transition-colors">
						<input
							type="checkbox"
							checked={$agentSettingsStore.enableStreaming}
							onchange={(e) => agentSettingsStore.updateSettings({ enableStreaming: e.currentTarget.checked })}
							class="rounded"
						/>
						Streaming
					</label>
					<label class="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer hover:bg-muted transition-colors">
						<input
							type="checkbox"
							checked={$agentSettingsStore.enableToolUse}
							onchange={(e) => agentSettingsStore.updateSettings({ enableToolUse: e.currentTarget.checked })}
							class="rounded"
						/>
						Tool Use
					</label>
					<label class="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer hover:bg-muted transition-colors">
						<input
							type="checkbox"
							checked={$agentSettingsStore.enableEpisodicMemory}
							onchange={(e) => agentSettingsStore.updateSettings({ enableEpisodicMemory: e.currentTarget.checked })}
							class="rounded"
						/>
						Episodic Memory
					</label>
					<label class="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer hover:bg-muted transition-colors
						{$agentSettingsStore.chatMode === 'code' ? '' : 'opacity-50'}">
						<input
							type="checkbox"
							checked={$agentSettingsStore.enableWorkspaceContext}
							onchange={(e) => agentSettingsStore.updateSettings({ enableWorkspaceContext: e.currentTarget.checked })}
							disabled={$agentSettingsStore.chatMode !== 'code'}
							class="rounded"
						/>
						Workspace Context
					</label>
				</div>
			</div>

			<!-- Advanced Thinking Section -->
			<div class="border border-border rounded-lg">
				<button
					type="button"
					onclick={() => (showThinking = !showThinking)}
					class="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
				>
					<div class="flex items-center gap-2">
						<Lightbulb class="h-4 w-4 text-amber-500" />
						<span class="text-sm font-medium">Advanced Thinking</span>
					</div>
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={$agentSettingsStore.enableAdvancedThinking}
							onclick={(e) => e.stopPropagation()}
							onchange={(e) => agentSettingsStore.updateSettings({ enableAdvancedThinking: e.currentTarget.checked })}
							class="rounded"
						/>
						{#if showThinking}
							<ChevronUp class="h-4 w-4 text-muted-foreground" />
						{:else}
							<ChevronDown class="h-4 w-4 text-muted-foreground" />
						{/if}
					</div>
				</button>

				{#if showThinking}
					<div class="border-t border-border p-3 space-y-4">
						<!-- CoT Strategy -->
						<div class="space-y-2">
							<label for="cot-strategy" class="text-xs font-medium">Reasoning Strategy</label>
							<select
								id="cot-strategy"
								value={$agentSettingsStore.iapSettings.strategy}
								onchange={(e) => agentSettingsStore.updateIAPSettings({
									strategy: e.currentTarget.value as CoTStrategy,
									enabled: e.currentTarget.value !== 'none'
								})}
								class="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								{#each cotStrategies as strategy}
									<option value={strategy.id}>{strategy.name}</option>
								{/each}
							</select>
							<p class="text-xs text-muted-foreground">
								{cotStrategies.find(s => s.id === $agentSettingsStore.iapSettings.strategy)?.description}
							</p>
						</div>

						<!-- IAP-ss: Saliency Threshold -->
						{#if $agentSettingsStore.iapSettings.strategy === 'IAP-ss'}
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label for="saliency-threshold" class="text-xs font-medium">Saliency Threshold</label>
									<span class="text-xs text-muted-foreground tabular-nums">
										{$agentSettingsStore.iapSettings.saliencyThreshold.toFixed(2)}
									</span>
								</div>
								<input
									id="saliency-threshold"
									type="range"
									min="0"
									max="1"
									step="0.05"
									value={$agentSettingsStore.iapSettings.saliencyThreshold}
									oninput={(e) => agentSettingsStore.updateIAPSettings({
										saliencyThreshold: parseFloat(e.currentTarget.value)
									})}
									class="w-full accent-primary"
								/>
								<p class="text-xs text-muted-foreground">
									Higher = more selective prompting, lower = broader prompting
								</p>
							</div>
						{/if}

						<!-- IAP-mv: Top Prompts Count -->
						{#if $agentSettingsStore.iapSettings.strategy === 'IAP-mv'}
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label for="top-prompts" class="text-xs font-medium">Top Prompts Count</label>
									<span class="text-xs text-muted-foreground tabular-nums">
										{$agentSettingsStore.iapSettings.topPromptsCount}
									</span>
								</div>
								<input
									id="top-prompts"
									type="range"
									min="1"
									max="9"
									step="1"
									value={$agentSettingsStore.iapSettings.topPromptsCount}
									oninput={(e) => agentSettingsStore.updateIAPSettings({
										topPromptsCount: parseInt(e.currentTarget.value)
									})}
									class="w-full accent-primary"
								/>
								<p class="text-xs text-muted-foreground">
									Number of prompt variations to generate and vote on
								</p>
							</div>
						{/if}

						<!-- Custom Thinking Steps -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium">Thinking Steps</span>
								<button
									type="button"
									onclick={() => {
										const step = prompt('Enter thinking step:');
										if (step) agentSettingsStore.addThinkingStep(step);
									}}
									class="text-xs text-primary hover:underline"
								>
									+ Add Step
								</button>
							</div>
							<div class="max-h-40 overflow-y-auto space-y-1">
								{#each $agentSettingsStore.customThinkingSteps as step, i}
									<div class="flex items-center gap-2 text-xs">
										<input
											type="checkbox"
											checked={step.enabled}
											onchange={() => agentSettingsStore.toggleThinkingStep(step.id)}
											class="rounded"
										/>
										<span class="flex-1 {step.enabled ? '' : 'line-through opacity-50'}">
											{i + 1}. {step.content}
										</span>
										<button
											type="button"
											onclick={() => agentSettingsStore.removeThinkingStep(step.id)}
											class="text-muted-foreground hover:text-red-500"
										>
											<X class="h-3 w-3" />
										</button>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Advanced Parameters Section -->
			<div class="border border-border rounded-lg">
				<button
					type="button"
					onclick={() => (showAdvanced = !showAdvanced)}
					class="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
				>
					<div class="flex items-center gap-2">
						<Settings2 class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm font-medium">Advanced Parameters</span>
					</div>
					{#if showAdvanced}
						<ChevronUp class="h-4 w-4 text-muted-foreground" />
					{:else}
						<ChevronDown class="h-4 w-4 text-muted-foreground" />
					{/if}
				</button>

				{#if showAdvanced}
					<div class="border-t border-border p-3 space-y-4">
						<!-- Temperature -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="temperature" class="text-xs font-medium">Temperature</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.temperature.toFixed(2)}
								</span>
							</div>
							<input
								id="temperature"
								type="range"
								min="0"
								max="2"
								step="0.05"
								value={$agentSettingsStore.parameters.temperature}
								oninput={(e) => agentSettingsStore.updateParameters({
									temperature: parseFloat(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
						</div>

						<!-- Max Tokens -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="max-tokens" class="text-xs font-medium">Max Tokens</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.maxTokens}
								</span>
							</div>
							<input
								id="max-tokens"
								type="range"
								min="256"
								max="16384"
								step="256"
								value={$agentSettingsStore.parameters.maxTokens}
								oninput={(e) => agentSettingsStore.updateParameters({
									maxTokens: parseInt(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
						</div>

						<!-- Context Length -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="context-length" class="text-xs font-medium">Context Length</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.contextLength}
								</span>
							</div>
							<input
								id="context-length"
								type="range"
								min="1024"
								max="32768"
								step="1024"
								value={$agentSettingsStore.parameters.contextLength}
								oninput={(e) => agentSettingsStore.updateParameters({
									contextLength: parseInt(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
						</div>

						<!-- Top P -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="top-p" class="text-xs font-medium">Top P (Nucleus)</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.topP.toFixed(2)}
								</span>
							</div>
							<input
								id="top-p"
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={$agentSettingsStore.parameters.topP}
								oninput={(e) => agentSettingsStore.updateParameters({
									topP: parseFloat(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
						</div>

						<!-- Top K -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="top-k" class="text-xs font-medium">Top K</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.topK}
								</span>
							</div>
							<input
								id="top-k"
								type="range"
								min="1"
								max="100"
								step="1"
								value={$agentSettingsStore.parameters.topK}
								oninput={(e) => agentSettingsStore.updateParameters({
									topK: parseInt(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
						</div>

						<!-- Repeat Penalty -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="repeat-penalty" class="text-xs font-medium">Repeat Penalty</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.repeatPenalty.toFixed(2)}
								</span>
							</div>
							<input
								id="repeat-penalty"
								type="range"
								min="1"
								max="2"
								step="0.05"
								value={$agentSettingsStore.parameters.repeatPenalty}
								oninput={(e) => agentSettingsStore.updateParameters({
									repeatPenalty: parseFloat(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
						</div>

						<!-- Presence Penalty -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="presence-penalty" class="text-xs font-medium">Presence Penalty</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.presencePenalty.toFixed(2)}
								</span>
							</div>
							<input
								id="presence-penalty"
								type="range"
								min="-2"
								max="2"
								step="0.1"
								value={$agentSettingsStore.parameters.presencePenalty}
								oninput={(e) => agentSettingsStore.updateParameters({
									presencePenalty: parseFloat(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
							<p class="text-xs text-muted-foreground">
								Positive = encourage new topics, Negative = stay on topic
							</p>
						</div>

						<!-- Frequency Penalty -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="frequency-penalty" class="text-xs font-medium">Frequency Penalty</label>
								<span class="text-xs text-muted-foreground tabular-nums">
									{$agentSettingsStore.parameters.frequencyPenalty.toFixed(2)}
								</span>
							</div>
							<input
								id="frequency-penalty"
								type="range"
								min="-2"
								max="2"
								step="0.1"
								value={$agentSettingsStore.parameters.frequencyPenalty}
								oninput={(e) => agentSettingsStore.updateParameters({
									frequencyPenalty: parseFloat(e.currentTarget.value)
								})}
								class="w-full accent-primary"
							/>
							<p class="text-xs text-muted-foreground">
								Positive = reduce repetition, Negative = allow repetition
							</p>
						</div>

						<!-- Seed -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label for="seed" class="text-xs font-medium">Seed (optional)</label>
								<button
									type="button"
									onclick={() => agentSettingsStore.updateParameters({ seed: undefined })}
									class="text-xs text-muted-foreground hover:text-foreground"
								>
									Clear
								</button>
							</div>
							<input
								id="seed"
								type="number"
								value={$agentSettingsStore.parameters.seed ?? ''}
								oninput={(e) => {
									const val = e.currentTarget.value;
									agentSettingsStore.updateParameters({
										seed: val ? parseInt(val) : undefined
									});
								}}
								placeholder="Random"
								class="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<!-- Reset Parameters -->
						<button
							type="button"
							onclick={() => agentSettingsStore.resetParameters()}
							class="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
						>
							<RotateCcw class="h-3 w-3" />
							Reset Parameters
						</button>
					</div>
				{/if}
			</div>

			<!-- System Prompt Override -->
			<div class="space-y-2">
				<label for="system-prompt-override" class="text-sm font-medium">
					System Prompt Override
				</label>
				<textarea
					id="system-prompt-override"
					value={$agentSettingsStore.systemPromptOverride || ''}
					onchange={(e) => agentSettingsStore.updateSettings({
						systemPromptOverride: e.currentTarget.value || null
					})}
					placeholder="Additional instructions to append to the system prompt..."
					rows="3"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
				></textarea>
			</div>

			<!-- Reset All -->
			<button
				type="button"
				onclick={resetAllSettings}
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
			>
				<RotateCcw class="h-3 w-3" />
				Reset All Settings
			</button>
		</div>
	{/if}
</div>
