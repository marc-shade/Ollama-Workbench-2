<script lang="ts">
	import {
		FlaskConical,
		Play,
		Check,
		X,
		Loader2,
		Eye,
		Code,
		Wrench,
		MessageSquare,
		Scroll,
		Zap,
		ChevronDown,
		ChevronRight
	} from 'lucide-svelte';

	interface TestResult {
		test_name: string;
		model: string;
		passed: boolean;
		score: number;
		latency_ms: number;
		details: Record<string, any>;
		error?: string;
	}

	interface ModelCapabilities {
		model: string;
		vision?: TestResult;
		json_mode?: TestResult;
		tool_calling?: TestResult;
		context_window?: TestResult;
		streaming?: TestResult;
		system_prompt?: TestResult;
		tested_at: string;
	}

	let models = $state<string[]>([]);
	let selectedModel = $state('');
	let selectedTests = $state<string[]>(['json_mode', 'tool_calling', 'streaming', 'system_prompt']);
	let results = $state<ModelCapabilities | null>(null);
	let loading = $state(false);
	let expandedResults = $state<Set<string>>(new Set());
	let comparisonMode = $state(false);
	let comparisonModels = $state<string[]>([]);
	let comparisonResults = $state<Record<string, ModelCapabilities>>({});

	const TESTS = [
		{ id: 'vision', label: 'Vision Support', icon: Eye, description: 'Test image understanding capabilities' },
		{ id: 'json_mode', label: 'JSON Mode', icon: Code, description: 'Test structured JSON output' },
		{ id: 'tool_calling', label: 'Tool Calling', icon: Wrench, description: 'Test function/tool calling' },
		{ id: 'streaming', label: 'Streaming', icon: Zap, description: 'Test streaming response support' },
		{ id: 'system_prompt', label: 'System Prompt', icon: MessageSquare, description: 'Test system prompt adherence' },
		{ id: 'context_window', label: 'Context Window', icon: Scroll, description: 'Test context retrieval accuracy' }
	];

	const API_BASE = 'http://localhost:8000';

	async function loadModels() {
		try {
			const res = await fetch(`${API_BASE}/api/ollama/tags`);
			if (res.ok) {
				const data = await res.json();
				models = data.models?.map((m: any) => m.name) || [];
				if (models.length > 0 && !selectedModel) {
					selectedModel = models[0];
				}
			}
		} catch (e) {
			console.error('Failed to load models:', e);
		}
	}

	async function runTests() {
		if (!selectedModel || selectedTests.length === 0) return;

		loading = true;
		results = null;

		try {
			const res = await fetch(`${API_BASE}/api/model-tests/run`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: selectedModel,
					tests: selectedTests
				})
			});

			if (res.ok) {
				results = await res.json();
			} else {
				const error = await res.json();
				alert(error.detail || 'Failed to run tests');
			}
		} catch (e) {
			console.error('Test failed:', e);
			alert('Failed to run tests');
		}

		loading = false;
	}

	async function runComparison() {
		if (comparisonModels.length < 2) {
			alert('Select at least 2 models to compare');
			return;
		}

		loading = true;
		comparisonResults = {};

		try {
			const testsParam = selectedTests.join(',');
			const modelsParam = comparisonModels.join(',');

			const res = await fetch(`${API_BASE}/api/model-tests/compare?models=${modelsParam}&tests=${testsParam}`);

			if (res.ok) {
				comparisonResults = await res.json();
			}
		} catch (e) {
			console.error('Comparison failed:', e);
		}

		loading = false;
	}

	function toggleTest(testId: string) {
		if (selectedTests.includes(testId)) {
			selectedTests = selectedTests.filter(t => t !== testId);
		} else {
			selectedTests = [...selectedTests, testId];
		}
	}

	function toggleComparisonModel(model: string) {
		if (comparisonModels.includes(model)) {
			comparisonModels = comparisonModels.filter(m => m !== model);
		} else if (comparisonModels.length < 5) {
			comparisonModels = [...comparisonModels, model];
		}
	}

	function toggleExpand(testName: string) {
		if (expandedResults.has(testName)) {
			expandedResults.delete(testName);
		} else {
			expandedResults.add(testName);
		}
		expandedResults = new Set(expandedResults);
	}

	function getScoreColor(score: number): string {
		if (score >= 0.8) return 'text-green-500';
		if (score >= 0.5) return 'text-yellow-500';
		return 'text-red-500';
	}

	function getScoreBg(score: number): string {
		if (score >= 0.8) return 'bg-green-500';
		if (score >= 0.5) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	$effect(() => {
		loadModels();
	});
</script>

<div class="h-full overflow-auto">
	<div class="max-w-5xl mx-auto p-6">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<FlaskConical class="h-6 w-6" />
				Model Feature Tests
			</h1>
			<p class="text-muted-foreground mt-1">
				Test model capabilities including vision, JSON mode, tool calling, and more
			</p>
		</div>

		<!-- Mode Toggle -->
		<div class="flex gap-2 mb-6">
			<button
				onclick={() => comparisonMode = false}
				class="px-4 py-2 text-sm rounded-lg {!comparisonMode ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}"
			>
				Single Model
			</button>
			<button
				onclick={() => comparisonMode = true}
				class="px-4 py-2 text-sm rounded-lg {comparisonMode ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}"
			>
				Compare Models
			</button>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Configuration Panel -->
			<div class="lg:col-span-1 space-y-4">
				<!-- Model Selection -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">
						{comparisonMode ? 'Select Models (up to 5)' : 'Select Model'}
					</h3>

					{#if comparisonMode}
						<div class="space-y-2 max-h-48 overflow-y-auto">
							{#each models as model}
								<label class="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
									<input
										type="checkbox"
										checked={comparisonModels.includes(model)}
										onchange={() => toggleComparisonModel(model)}
										class="rounded"
									/>
									<span class="text-sm truncate">{model}</span>
								</label>
							{/each}
						</div>
						{#if comparisonModels.length > 0}
							<div class="mt-2 text-xs text-muted-foreground">
								{comparisonModels.length} selected
							</div>
						{/if}
					{:else}
						<select
							bind:value={selectedModel}
							class="w-full px-3 py-2 border border-border rounded-lg bg-background"
						>
							{#each models as model}
								<option value={model}>{model}</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Test Selection -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Select Tests</h3>
					<div class="space-y-2">
						{#each TESTS as test}
							<label class="flex items-start gap-3 p-2 hover:bg-muted rounded cursor-pointer">
								<input
									type="checkbox"
									checked={selectedTests.includes(test.id)}
									onchange={() => toggleTest(test.id)}
									class="mt-0.5 rounded"
								/>
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<test.icon class="h-4 w-4" />
										<span class="text-sm font-medium">{test.label}</span>
									</div>
									<p class="text-xs text-muted-foreground">{test.description}</p>
								</div>
							</label>
						{/each}
					</div>
				</div>

				<!-- Run Button -->
				<button
					onclick={comparisonMode ? runComparison : runTests}
					disabled={loading || selectedTests.length === 0 || (comparisonMode ? comparisonModels.length < 2 : !selectedModel)}
					class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
						Running Tests...
					{:else}
						<Play class="h-4 w-4" />
						{comparisonMode ? 'Run Comparison' : 'Run Tests'}
					{/if}
				</button>
			</div>

			<!-- Results Panel -->
			<div class="lg:col-span-2">
				{#if comparisonMode && Object.keys(comparisonResults).length > 0}
					<!-- Comparison Results -->
					<div class="bg-card border border-border rounded-lg overflow-hidden">
						<div class="p-4 border-b border-border">
							<h3 class="font-medium">Comparison Results</h3>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-border">
										<th class="text-left p-3">Test</th>
										{#each Object.keys(comparisonResults) as model}
											<th class="text-center p-3 truncate max-w-32">{model.split(':')[0]}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each selectedTests as testId}
										<tr class="border-b border-border">
											<td class="p-3 font-medium">{TESTS.find(t => t.id === testId)?.label}</td>
											{#each Object.entries(comparisonResults) as [model, caps]}
												{@const result = caps[testId as keyof ModelCapabilities] as TestResult}
												<td class="p-3 text-center">
													{#if result}
														<div class="flex items-center justify-center gap-1">
															{#if result.passed}
																<Check class="h-4 w-4 text-green-500" />
															{:else}
																<X class="h-4 w-4 text-red-500" />
															{/if}
															<span class="{getScoreColor(result.score)}">{(result.score * 100).toFixed(0)}%</span>
														</div>
														<div class="text-xs text-muted-foreground">{result.latency_ms.toFixed(0)}ms</div>
													{:else}
														<span class="text-muted-foreground">-</span>
													{/if}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{:else if results}
					<!-- Single Model Results -->
					<div class="bg-card border border-border rounded-lg">
						<div class="p-4 border-b border-border">
							<div class="flex items-center justify-between">
								<h3 class="font-medium">Results for {results.model}</h3>
								<span class="text-xs text-muted-foreground">
									{new Date(results.tested_at).toLocaleString()}
								</span>
							</div>
						</div>
						<div class="divide-y divide-border">
							{#each selectedTests as testId}
								{@const result = results[testId as keyof ModelCapabilities] as TestResult}
								{#if result}
									<div class="p-4">
										<button
											onclick={() => toggleExpand(testId)}
											class="w-full flex items-center justify-between"
										>
											<div class="flex items-center gap-3">
												{#if result.passed}
													<div class="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
														<Check class="h-4 w-4 text-green-500" />
													</div>
												{:else}
													<div class="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
														<X class="h-4 w-4 text-red-500" />
													</div>
												{/if}
												<div class="text-left">
													<div class="font-medium">{TESTS.find(t => t.id === testId)?.label}</div>
													<div class="text-sm text-muted-foreground">
														{result.latency_ms.toFixed(0)}ms
													</div>
												</div>
											</div>
											<div class="flex items-center gap-3">
												<div class="text-right">
													<div class="font-medium {getScoreColor(result.score)}">
														{(result.score * 100).toFixed(0)}%
													</div>
													<div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
														<div
															class="{getScoreBg(result.score)} h-full"
															style="width: {result.score * 100}%"
														></div>
													</div>
												</div>
												{#if expandedResults.has(testId)}
													<ChevronDown class="h-4 w-4" />
												{:else}
													<ChevronRight class="h-4 w-4" />
												{/if}
											</div>
										</button>

										{#if expandedResults.has(testId)}
											<div class="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
												{#if result.error}
													<div class="text-red-500 mb-2">Error: {result.error}</div>
												{/if}
												<pre class="whitespace-pre-wrap text-xs overflow-x-auto">{JSON.stringify(result.details, null, 2)}</pre>
											</div>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{:else}
					<div class="bg-card border border-border rounded-lg p-8 text-center">
						<FlaskConical class="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
						<p class="text-muted-foreground">Select tests and run to see results</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
