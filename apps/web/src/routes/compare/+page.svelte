<script lang="ts">
	import {
		GitCompare,
		Image,
		MessageSquare,
		Upload,
		Play,
		Loader2,
		Clock,
		Hash,
		Trash2,
		Plus,
		X
	} from 'lucide-svelte';

	interface ModelResponse {
		model: string;
		response: string;
		latency_ms: number;
		tokens: number;
		error?: string;
	}

	let mode = $state<'text' | 'vision'>('text');
	let models = $state<string[]>([]);
	let visionModels = $state<string[]>([]);
	let selectedModels = $state<string[]>([]);
	let prompt = $state('');
	let systemPrompt = $state('');
	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let responses = $state<ModelResponse[]>([]);
	let loading = $state(false);

	const API_BASE = 'http://localhost:8000';

	async function loadModels() {
		try {
			const res = await fetch(`${API_BASE}/api/ollama/tags`);
			if (res.ok) {
				const data = await res.json();
				models = data.models?.map((m: any) => m.name) || [];
			}

			// Load vision-capable models
			const visionRes = await fetch(`${API_BASE}/api/compare/vision/models`);
			if (visionRes.ok) {
				const visionData = await visionRes.json();
				visionModels = visionData.map((m: any) => m.name);
			}
		} catch (e) {
			console.error('Failed to load models:', e);
		}
	}

	function addModel(model: string) {
		if (!selectedModels.includes(model) && selectedModels.length < 5) {
			selectedModels = [...selectedModels, model];
		}
	}

	function removeModel(model: string) {
		selectedModels = selectedModels.filter(m => m !== model);
	}

	function handleImageSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			imageFile = input.files[0];

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				imagePreview = e.target?.result as string;
			};
			reader.readAsDataURL(imageFile);
		}
	}

	function clearImage() {
		imageFile = null;
		imagePreview = null;
	}

	async function runComparison() {
		if (selectedModels.length === 0 || !prompt) return;

		loading = true;
		responses = [];

		try {
			if (mode === 'vision' && imageFile) {
				// Vision comparison with file upload
				const formData = new FormData();
				formData.append('file', imageFile);
				formData.append('prompt', prompt);
				formData.append('models', selectedModels.join(','));

				const res = await fetch(`${API_BASE}/api/compare/vision/upload`, {
					method: 'POST',
					body: formData
				});

				if (res.ok) {
					const data = await res.json();
					responses = data.responses;
				}
			} else {
				// Text comparison
				const res = await fetch(`${API_BASE}/api/compare/text`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						prompt,
						system_prompt: systemPrompt || undefined,
						models: selectedModels
					})
				});

				if (res.ok) {
					const data = await res.json();
					responses = data.responses;
				}
			}
		} catch (e) {
			console.error('Comparison failed:', e);
			alert('Comparison failed');
		}

		loading = false;
	}

	function getAvailableModels(): string[] {
		if (mode === 'vision') {
			return visionModels.length > 0 ? visionModels : models;
		}
		return models;
	}

	$effect(() => {
		loadModels();
	});

	$effect(() => {
		// Clear selected models when switching modes
		selectedModels = [];
		responses = [];
	});
</script>

<div class="h-full overflow-auto">
	<div class="max-w-6xl mx-auto p-6">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<GitCompare class="h-6 w-6" />
				Model Comparison
			</h1>
			<p class="text-muted-foreground mt-1">
				Compare responses from multiple models side by side
			</p>
		</div>

		<!-- Mode Toggle -->
		<div class="flex gap-2 mb-6">
			<button
				onclick={() => mode = 'text'}
				class="flex items-center gap-2 px-4 py-2 rounded-lg {mode === 'text' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}"
			>
				<MessageSquare class="h-4 w-4" />
				Text Comparison
			</button>
			<button
				onclick={() => mode = 'vision'}
				class="flex items-center gap-2 px-4 py-2 rounded-lg {mode === 'vision' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}"
			>
				<Image class="h-4 w-4" />
				Vision Comparison
			</button>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Configuration Panel -->
			<div class="space-y-4">
				<!-- Model Selection -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Select Models (up to 5)</h3>

					<!-- Selected Models -->
					{#if selectedModels.length > 0}
						<div class="flex flex-wrap gap-2 mb-3">
							{#each selectedModels as model}
								<div class="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-sm">
									<span class="truncate max-w-32">{model.split(':')[0]}</span>
									<button onclick={() => removeModel(model)} class="hover:text-primary/70">
										<X class="h-3 w-3" />
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Model Dropdown -->
					<div class="flex gap-2">
						<select
							class="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
							onchange={(e) => { addModel((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}
						>
							<option value="">Add a model...</option>
							{#each getAvailableModels().filter(m => !selectedModels.includes(m)) as model}
								<option value={model}>{model}</option>
							{/each}
						</select>
					</div>

					{#if mode === 'vision' && visionModels.length === 0}
						<p class="text-xs text-yellow-500 mt-2">
							No vision models detected. Try llava, bakllava, or moondream.
						</p>
					{/if}
				</div>

				<!-- Vision: Image Upload -->
				{#if mode === 'vision'}
					<div class="bg-card border border-border rounded-lg p-4">
						<h3 class="font-medium mb-3">Upload Image</h3>

						{#if imagePreview}
							<div class="relative">
								<img
									src={imagePreview}
									alt="Preview"
									class="w-full rounded-lg"
								/>
								<button
									onclick={clearImage}
									class="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70"
								>
									<Trash2 class="h-4 w-4 text-white" />
								</button>
							</div>
						{:else}
							<label class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50">
								<Upload class="h-8 w-8 text-muted-foreground mb-2" />
								<span class="text-sm text-muted-foreground">Click to upload image</span>
								<input
									type="file"
									accept="image/*"
									onchange={handleImageSelect}
									class="hidden"
								/>
							</label>
						{/if}
					</div>
				{/if}

				<!-- System Prompt (Text mode only) -->
				{#if mode === 'text'}
					<div class="bg-card border border-border rounded-lg p-4">
						<h3 class="font-medium mb-3">System Prompt (Optional)</h3>
						<textarea
							bind:value={systemPrompt}
							placeholder="Enter system prompt..."
							rows="3"
							class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
						></textarea>
					</div>
				{/if}

				<!-- Prompt -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Prompt</h3>
					<textarea
						bind:value={prompt}
						placeholder={mode === 'vision' ? 'Describe this image...' : 'Enter your prompt...'}
						rows="4"
						class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
					></textarea>
				</div>

				<!-- Run Button -->
				<button
					onclick={runComparison}
					disabled={loading || selectedModels.length === 0 || !prompt || (mode === 'vision' && !imageFile)}
					class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
						Running Comparison...
					{:else}
						<Play class="h-4 w-4" />
						Compare Models
					{/if}
				</button>
			</div>

			<!-- Results Panel -->
			<div class="lg:col-span-2">
				{#if responses.length > 0}
					<div class="grid gap-4 {responses.length === 1 ? '' : responses.length === 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}">
						{#each responses as response}
							<div class="bg-card border border-border rounded-lg overflow-hidden">
								<div class="p-3 border-b border-border bg-muted/30">
									<div class="flex items-center justify-between">
										<span class="font-medium truncate">{response.model}</span>
										<div class="flex items-center gap-3 text-xs text-muted-foreground">
											<span class="flex items-center gap-1">
												<Clock class="h-3 w-3" />
												{response.latency_ms.toFixed(0)}ms
											</span>
											{#if response.tokens > 0}
												<span class="flex items-center gap-1">
													<Hash class="h-3 w-3" />
													{response.tokens} tokens
												</span>
											{/if}
										</div>
									</div>
								</div>
								<div class="p-4 max-h-96 overflow-y-auto">
									{#if response.error}
										<div class="text-red-500 text-sm">
											Error: {response.error}
										</div>
									{:else}
										<div class="prose prose-sm dark:prose-invert max-w-none">
											<p class="whitespace-pre-wrap text-sm">{response.response}</p>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Summary Stats -->
					<div class="mt-4 p-4 bg-card border border-border rounded-lg">
						<h3 class="font-medium mb-3">Comparison Summary</h3>
						<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div class="text-center">
								<div class="text-2xl font-bold">{responses.length}</div>
								<div class="text-xs text-muted-foreground">Models Compared</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold">
									{Math.min(...responses.filter(r => !r.error).map(r => r.latency_ms)).toFixed(0)}ms
								</div>
								<div class="text-xs text-muted-foreground">Fastest Response</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold">
									{(responses.filter(r => !r.error).reduce((sum, r) => sum + r.latency_ms, 0) / responses.filter(r => !r.error).length).toFixed(0)}ms
								</div>
								<div class="text-xs text-muted-foreground">Avg Response Time</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold">
									{responses.filter(r => !r.error).length}/{responses.length}
								</div>
								<div class="text-xs text-muted-foreground">Successful</div>
							</div>
						</div>
					</div>
				{:else}
					<div class="bg-card border border-border rounded-lg p-12 text-center">
						<GitCompare class="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
						<p class="text-lg text-muted-foreground">Select models and enter a prompt to compare</p>
						<p class="text-sm text-muted-foreground mt-1">
							{mode === 'vision' ? 'Upload an image and describe what you want to know' : 'Compare how different models respond to the same prompt'}
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
