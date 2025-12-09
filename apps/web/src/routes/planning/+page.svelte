<script lang="ts">
	import {
		Lightbulb,
		Play,
		Loader2,
		Sparkles,
		Target,
		AlertTriangle,
		CheckCircle2,
		ArrowRight,
		RefreshCw,
		ChevronDown,
		ChevronRight,
		Plus,
		Wand2
	} from 'lucide-svelte';

	interface PlanTask {
		title: string;
		description: string;
		priority: string;
		dependencies: string[];
		estimated_effort: string;
	}

	interface GeneratedPlan {
		project_name: string;
		description: string;
		tasks: PlanTask[];
		suggested_milestones: string[];
		risks: string[];
		success_criteria: string[];
	}

	let models = $state<string[]>([]);
	let selectedModel = $state('llama3.2');
	let projectDescription = $state('');
	let additionalContext = $state('');
	let existingTasks = $state<string[]>([]);
	let newTaskInput = $state('');
	let maxTasks = $state(10);
	let generatedPlan = $state<GeneratedPlan | null>(null);
	let loading = $state(false);
	let expandedSections = $state<Set<string>>(new Set(['tasks', 'milestones']));

	// Task refinement
	let selectedTask = $state<PlanTask | null>(null);
	let refinedTask = $state<any>(null);
	let refiningTask = $state(false);

	const API_BASE = 'http://localhost:8000';

	async function loadModels() {
		try {
			const res = await fetch(`${API_BASE}/api/ollama/tags`);
			if (res.ok) {
				const data = await res.json();
				models = data.models?.map((m: any) => m.name) || [];
				if (models.length > 0 && !models.includes(selectedModel)) {
					selectedModel = models[0];
				}
			}
		} catch (e) {
			console.error('Failed to load models:', e);
		}
	}

	function addExistingTask() {
		if (newTaskInput.trim() && !existingTasks.includes(newTaskInput.trim())) {
			existingTasks = [...existingTasks, newTaskInput.trim()];
			newTaskInput = '';
		}
	}

	function removeExistingTask(task: string) {
		existingTasks = existingTasks.filter(t => t !== task);
	}

	async function generatePlan() {
		if (!projectDescription.trim()) return;

		loading = true;
		generatedPlan = null;

		try {
			const res = await fetch(`${API_BASE}/api/planning/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: projectDescription,
					model: selectedModel,
					context: additionalContext || undefined,
					existing_tasks: existingTasks,
					max_tasks: maxTasks
				})
			});

			if (res.ok) {
				generatedPlan = await res.json();
			} else {
				const error = await res.json();
				alert(error.detail || 'Failed to generate plan');
			}
		} catch (e) {
			console.error('Plan generation failed:', e);
			alert('Failed to generate plan');
		}

		loading = false;
	}

	async function refineTask(task: PlanTask) {
		selectedTask = task;
		refiningTask = true;
		refinedTask = null;

		try {
			const res = await fetch(`${API_BASE}/api/planning/refine-task`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					task: task.title,
					model: selectedModel,
					context: projectDescription
				})
			});

			if (res.ok) {
				refinedTask = await res.json();
			}
		} catch (e) {
			console.error('Task refinement failed:', e);
		}

		refiningTask = false;
	}

	function toggleSection(section: string) {
		if (expandedSections.has(section)) {
			expandedSections.delete(section);
		} else {
			expandedSections.add(section);
		}
		expandedSections = new Set(expandedSections);
	}

	function getPriorityColor(priority: string): string {
		switch (priority.toLowerCase()) {
			case 'critical': return 'text-red-500 bg-red-500/10';
			case 'high': return 'text-orange-500 bg-orange-500/10';
			case 'medium': return 'text-yellow-500 bg-yellow-500/10';
			case 'low': return 'text-green-500 bg-green-500/10';
			default: return 'text-muted-foreground bg-muted';
		}
	}

	function getEffortColor(effort: string): string {
		switch (effort.toLowerCase()) {
			case 'extra-large':
			case 'large': return 'text-purple-500 bg-purple-500/10';
			case 'medium': return 'text-blue-500 bg-blue-500/10';
			case 'small': return 'text-green-500 bg-green-500/10';
			default: return 'text-muted-foreground bg-muted';
		}
	}

	$effect(() => {
		loadModels();
	});
</script>

<div class="h-full overflow-auto">
	<div class="max-w-6xl mx-auto p-6">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<Lightbulb class="h-6 w-6" />
				AI-Assisted Planning
			</h1>
			<p class="text-muted-foreground mt-1">
				Generate project plans, break down tasks, and get AI-powered suggestions
			</p>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Input Panel -->
			<div class="space-y-4">
				<!-- Model Selection -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">AI Model</h3>
					<select
						bind:value={selectedModel}
						class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
					>
						{#each models as model}
							<option value={model}>{model}</option>
						{/each}
					</select>
				</div>

				<!-- Project Description -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Project Description</h3>
					<textarea
						bind:value={projectDescription}
						placeholder="Describe your project in detail. What are you trying to build? What are the goals?"
						rows="5"
						class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
					></textarea>
				</div>

				<!-- Additional Context -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Additional Context (Optional)</h3>
					<textarea
						bind:value={additionalContext}
						placeholder="Any constraints, tech stack preferences, or specific requirements..."
						rows="3"
						class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
					></textarea>
				</div>

				<!-- Existing Tasks -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Existing Tasks (Optional)</h3>
					<p class="text-xs text-muted-foreground mb-2">Add tasks you've already identified to avoid duplicates</p>

					{#if existingTasks.length > 0}
						<div class="space-y-1 mb-3">
							{#each existingTasks as task}
								<div class="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-sm">
									<span class="truncate">{task}</span>
									<button onclick={() => removeExistingTask(task)} class="text-muted-foreground hover:text-foreground">
										&times;
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<div class="flex gap-2">
						<input
							type="text"
							bind:value={newTaskInput}
							placeholder="Add existing task..."
							class="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
							onkeydown={(e) => e.key === 'Enter' && addExistingTask()}
						/>
						<button
							onclick={addExistingTask}
							disabled={!newTaskInput.trim()}
							class="px-3 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50"
						>
							<Plus class="h-4 w-4" />
						</button>
					</div>
				</div>

				<!-- Max Tasks -->
				<div class="bg-card border border-border rounded-lg p-4">
					<h3 class="font-medium mb-3">Max Tasks to Generate</h3>
					<input
						type="range"
						bind:value={maxTasks}
						min="3"
						max="20"
						class="w-full"
					/>
					<div class="text-center text-sm text-muted-foreground mt-1">{maxTasks} tasks</div>
				</div>

				<!-- Generate Button -->
				<button
					onclick={generatePlan}
					disabled={loading || !projectDescription.trim()}
					class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
						Generating Plan...
					{:else}
						<Sparkles class="h-4 w-4" />
						Generate Plan
					{/if}
				</button>
			</div>

			<!-- Results Panel -->
			<div class="lg:col-span-2">
				{#if generatedPlan}
					<div class="space-y-4">
						<!-- Project Overview -->
						<div class="bg-card border border-border rounded-lg p-4">
							<h2 class="text-xl font-bold mb-2">{generatedPlan.project_name}</h2>
							<p class="text-muted-foreground">{generatedPlan.description}</p>
						</div>

						<!-- Tasks Section -->
						<div class="bg-card border border-border rounded-lg overflow-hidden">
							<button
								onclick={() => toggleSection('tasks')}
								class="w-full flex items-center justify-between p-4 hover:bg-muted/50"
							>
								<div class="flex items-center gap-2">
									<Target class="h-5 w-5" />
									<span class="font-medium">Tasks ({generatedPlan.tasks.length})</span>
								</div>
								{#if expandedSections.has('tasks')}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRight class="h-4 w-4" />
								{/if}
							</button>

							{#if expandedSections.has('tasks')}
								<div class="border-t border-border divide-y divide-border">
									{#each generatedPlan.tasks as task, i}
										<div class="p-4">
											<div class="flex items-start justify-between gap-4">
												<div class="flex-1">
													<div class="flex items-center gap-2 mb-1">
														<span class="text-muted-foreground text-sm">#{i + 1}</span>
														<h4 class="font-medium">{task.title}</h4>
													</div>
													<p class="text-sm text-muted-foreground mb-2">{task.description}</p>
													<div class="flex flex-wrap gap-2">
														<span class="px-2 py-0.5 rounded text-xs {getPriorityColor(task.priority)}">
															{task.priority}
														</span>
														<span class="px-2 py-0.5 rounded text-xs {getEffortColor(task.estimated_effort)}">
															{task.estimated_effort}
														</span>
														{#if task.dependencies.length > 0}
															<span class="text-xs text-muted-foreground">
																Depends on: {task.dependencies.join(', ')}
															</span>
														{/if}
													</div>
												</div>
												<button
													onclick={() => refineTask(task)}
													class="px-2 py-1 text-sm border border-border rounded hover:bg-muted flex items-center gap-1"
												>
													<Wand2 class="h-3 w-3" />
													Refine
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Milestones Section -->
						{#if generatedPlan.suggested_milestones.length > 0}
							<div class="bg-card border border-border rounded-lg overflow-hidden">
								<button
									onclick={() => toggleSection('milestones')}
									class="w-full flex items-center justify-between p-4 hover:bg-muted/50"
								>
									<div class="flex items-center gap-2">
										<CheckCircle2 class="h-5 w-5" />
										<span class="font-medium">Milestones ({generatedPlan.suggested_milestones.length})</span>
									</div>
									{#if expandedSections.has('milestones')}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</button>

								{#if expandedSections.has('milestones')}
									<div class="border-t border-border p-4">
										<ul class="space-y-2">
											{#each generatedPlan.suggested_milestones as milestone}
												<li class="flex items-center gap-2 text-sm">
													<ArrowRight class="h-4 w-4 text-primary" />
													{milestone}
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Risks Section -->
						{#if generatedPlan.risks.length > 0}
							<div class="bg-card border border-border rounded-lg overflow-hidden">
								<button
									onclick={() => toggleSection('risks')}
									class="w-full flex items-center justify-between p-4 hover:bg-muted/50"
								>
									<div class="flex items-center gap-2">
										<AlertTriangle class="h-5 w-5 text-yellow-500" />
										<span class="font-medium">Risks ({generatedPlan.risks.length})</span>
									</div>
									{#if expandedSections.has('risks')}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</button>

								{#if expandedSections.has('risks')}
									<div class="border-t border-border p-4">
										<ul class="space-y-2">
											{#each generatedPlan.risks as risk}
												<li class="flex items-start gap-2 text-sm">
													<AlertTriangle class="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
													{risk}
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Success Criteria Section -->
						{#if generatedPlan.success_criteria.length > 0}
							<div class="bg-card border border-border rounded-lg overflow-hidden">
								<button
									onclick={() => toggleSection('success')}
									class="w-full flex items-center justify-between p-4 hover:bg-muted/50"
								>
									<div class="flex items-center gap-2">
										<CheckCircle2 class="h-5 w-5 text-green-500" />
										<span class="font-medium">Success Criteria ({generatedPlan.success_criteria.length})</span>
									</div>
									{#if expandedSections.has('success')}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</button>

								{#if expandedSections.has('success')}
									<div class="border-t border-border p-4">
										<ul class="space-y-2">
											{#each generatedPlan.success_criteria as criterion}
												<li class="flex items-start gap-2 text-sm">
													<CheckCircle2 class="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
													{criterion}
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="bg-card border border-border rounded-lg p-12 text-center">
						<Lightbulb class="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
						<p class="text-lg text-muted-foreground">Describe your project to generate a plan</p>
						<p class="text-sm text-muted-foreground mt-1">
							AI will create tasks, milestones, and identify risks
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Task Refinement Modal -->
{#if selectedTask}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
			<div class="flex items-center justify-between p-4 border-b border-border">
				<h3 class="font-medium">Refine Task: {selectedTask.title}</h3>
				<button onclick={() => { selectedTask = null; refinedTask = null; }} class="text-muted-foreground hover:text-foreground">
					&times;
				</button>
			</div>

			<div class="p-4 overflow-y-auto max-h-[60vh]">
				{#if refiningTask}
					<div class="flex items-center justify-center py-8">
						<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				{:else if refinedTask}
					<div class="space-y-4">
						<div>
							<h4 class="font-medium text-sm text-muted-foreground mb-1">Refined Title</h4>
							<p class="font-medium">{refinedTask.refined_title}</p>
						</div>

						<div>
							<h4 class="font-medium text-sm text-muted-foreground mb-1">Description</h4>
							<p class="text-sm">{refinedTask.description}</p>
						</div>

						{#if refinedTask.subtasks?.length > 0}
							<div>
								<h4 class="font-medium text-sm text-muted-foreground mb-2">Subtasks</h4>
								<ul class="space-y-2">
									{#each refinedTask.subtasks as subtask}
										<li class="p-2 bg-muted/50 rounded">
											<div class="flex items-center justify-between">
												<span class="font-medium text-sm">{subtask.title}</span>
												<span class="text-xs px-2 py-0.5 rounded {getEffortColor(subtask.effort)}">{subtask.effort}</span>
											</div>
											<p class="text-xs text-muted-foreground mt-1">{subtask.description}</p>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if refinedTask.acceptance_criteria?.length > 0}
							<div>
								<h4 class="font-medium text-sm text-muted-foreground mb-2">Acceptance Criteria</h4>
								<ul class="space-y-1">
									{#each refinedTask.acceptance_criteria as criterion}
										<li class="flex items-center gap-2 text-sm">
											<CheckCircle2 class="h-3 w-3 text-green-500" />
											{criterion}
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if refinedTask.potential_blockers?.length > 0}
							<div>
								<h4 class="font-medium text-sm text-muted-foreground mb-2">Potential Blockers</h4>
								<ul class="space-y-1">
									{#each refinedTask.potential_blockers as blocker}
										<li class="flex items-center gap-2 text-sm">
											<AlertTriangle class="h-3 w-3 text-yellow-500" />
											{blocker}
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if refinedTask.suggested_approach}
							<div>
								<h4 class="font-medium text-sm text-muted-foreground mb-1">Suggested Approach</h4>
								<p class="text-sm p-2 bg-primary/5 rounded">{refinedTask.suggested_approach}</p>
							</div>
						{/if}
					</div>
				{:else}
					<p class="text-center text-muted-foreground py-8">Loading task details...</p>
				{/if}
			</div>

			<div class="flex justify-end gap-2 p-4 border-t border-border">
				<button
					onclick={() => { selectedTask = null; refinedTask = null; }}
					class="px-4 py-2 border border-border rounded-lg hover:bg-muted"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
</script>
