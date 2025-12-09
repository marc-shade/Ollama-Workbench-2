<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FolderKanban,
		Plus,
		MoreVertical,
		CheckCircle2,
		Circle,
		Clock,
		AlertCircle,
		Trash2,
		Edit,
		Download,
		ChevronRight,
		ListTodo,
		Search,
		Filter,
		X,
		Tag
	} from 'lucide-svelte';

	interface Task {
		id: string;
		title: string;
		description: string;
		status: 'todo' | 'in_progress' | 'done' | 'blocked';
		priority: 'low' | 'medium' | 'high' | 'critical';
		dependencies: string[];
		assignee: string | null;
		due_date: string | null;
		created_at: string;
		updated_at: string;
		completed_at: string | null;
	}

	interface Project {
		id: string;
		name: string;
		description: string;
		status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
		tasks: Task[];
		knowledge_ids: string[];
		conversation_ids: string[];
		tags: string[];
		created_at: string;
		updated_at: string;
	}

	let projects = $state<Project[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string | null>(null);

	// Modal states
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showTaskModal = $state(false);
	let selectedProject = $state<Project | null>(null);

	// Form states
	let newProjectName = $state('');
	let newProjectDescription = $state('');
	let newProjectTags = $state('');

	let newTaskTitle = $state('');
	let newTaskDescription = $state('');
	let newTaskPriority = $state<'low' | 'medium' | 'high' | 'critical'>('medium');

	async function fetchProjects() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (statusFilter) params.set('status', statusFilter);

			const res = await fetch(`/api/projects?${params}`);
			if (res.ok) {
				projects = await res.json();
			}
		} catch (err) {
			console.error('Failed to fetch projects:', err);
		}
		loading = false;
	}

	async function createProject() {
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newProjectName,
					description: newProjectDescription,
					tags: newProjectTags.split(',').map(t => t.trim()).filter(Boolean)
				})
			});

			if (res.ok) {
				showCreateModal = false;
				newProjectName = '';
				newProjectDescription = '';
				newProjectTags = '';
				fetchProjects();
			}
		} catch (err) {
			console.error('Failed to create project:', err);
		}
	}

	async function updateProject() {
		if (!selectedProject) return;

		try {
			const res = await fetch(`/api/projects/${selectedProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newProjectName,
					description: newProjectDescription,
					tags: newProjectTags.split(',').map(t => t.trim()).filter(Boolean)
				})
			});

			if (res.ok) {
				showEditModal = false;
				selectedProject = null;
				fetchProjects();
			}
		} catch (err) {
			console.error('Failed to update project:', err);
		}
	}

	async function deleteProject(id: string) {
		if (!confirm('Delete this project and all its tasks?')) return;

		try {
			const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
			if (res.ok) {
				fetchProjects();
			}
		} catch (err) {
			console.error('Failed to delete project:', err);
		}
	}

	async function updateProjectStatus(id: string, status: Project['status']) {
		try {
			await fetch(`/api/projects/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			fetchProjects();
		} catch (err) {
			console.error('Failed to update project status:', err);
		}
	}

	async function createTask() {
		if (!selectedProject) return;

		try {
			const res = await fetch(`/api/projects/${selectedProject.id}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: newTaskTitle,
					description: newTaskDescription,
					priority: newTaskPriority
				})
			});

			if (res.ok) {
				showTaskModal = false;
				newTaskTitle = '';
				newTaskDescription = '';
				newTaskPriority = 'medium';
				fetchProjects();
			}
		} catch (err) {
			console.error('Failed to create task:', err);
		}
	}

	async function updateTaskStatus(projectId: string, taskId: string, status: Task['status']) {
		try {
			await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			fetchProjects();
		} catch (err) {
			console.error('Failed to update task:', err);
		}
	}

	async function deleteTask(projectId: string, taskId: string) {
		try {
			await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
			fetchProjects();
		} catch (err) {
			console.error('Failed to delete task:', err);
		}
	}

	async function exportProject(project: Project) {
		try {
			const res = await fetch(`/api/projects/${project.id}/export`);
			if (res.ok) {
				const data = await res.json();
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `project-${project.name.toLowerCase().replace(/\s+/g, '-')}.json`;
				a.click();
				URL.revokeObjectURL(url);
			}
		} catch (err) {
			console.error('Failed to export project:', err);
		}
	}

	function openEditModal(project: Project) {
		selectedProject = project;
		newProjectName = project.name;
		newProjectDescription = project.description;
		newProjectTags = project.tags.join(', ');
		showEditModal = true;
	}

	function openTaskModal(project: Project) {
		selectedProject = project;
		showTaskModal = true;
	}

	function getStatusIcon(status: Task['status']) {
		switch (status) {
			case 'done': return CheckCircle2;
			case 'in_progress': return Clock;
			case 'blocked': return AlertCircle;
			default: return Circle;
		}
	}

	function getStatusColor(status: Project['status']) {
		switch (status) {
			case 'active': return 'text-green-500';
			case 'planning': return 'text-blue-500';
			case 'paused': return 'text-yellow-500';
			case 'completed': return 'text-purple-500';
			case 'archived': return 'text-muted-foreground';
		}
	}

	function getPriorityColor(priority: Task['priority']) {
		switch (priority) {
			case 'critical': return 'bg-red-500/10 text-red-500';
			case 'high': return 'bg-orange-500/10 text-orange-500';
			case 'medium': return 'bg-yellow-500/10 text-yellow-500';
			case 'low': return 'bg-green-500/10 text-green-500';
		}
	}

	function getCompletionPercentage(tasks: Task[]): number {
		if (tasks.length === 0) return 0;
		const done = tasks.filter(t => t.status === 'done').length;
		return Math.round((done / tasks.length) * 100);
	}

	const filteredProjects = $derived(
		projects.filter(p =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.description.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	onMount(fetchProjects);
</script>

<div class="mx-auto max-w-6xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<FolderKanban class="h-6 w-6" />
				Projects
			</h1>
			<p class="text-muted-foreground">Organize your work into projects with tasks and resources</p>
		</div>
		<button
			onclick={() => showCreateModal = true}
			class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
		>
			<Plus class="h-4 w-4" />
			New Project
		</button>
	</div>

	<!-- Search and Filter -->
	<div class="flex items-center gap-4">
		<div class="relative flex-1">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search projects..."
				class="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			/>
		</div>
		<div class="flex items-center gap-2">
			<Filter class="h-4 w-4 text-muted-foreground" />
			<select
				bind:value={statusFilter}
				onchange={fetchProjects}
				class="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			>
				<option value={null}>All Status</option>
				<option value="planning">Planning</option>
				<option value="active">Active</option>
				<option value="paused">Paused</option>
				<option value="completed">Completed</option>
				<option value="archived">Archived</option>
			</select>
		</div>
	</div>

	<!-- Projects Grid -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
		</div>
	{:else if filteredProjects.length === 0}
		<div class="text-center py-12 rounded-xl border border-dashed border-border">
			<FolderKanban class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 class="text-lg font-semibold mb-2">No projects yet</h3>
			<p class="text-muted-foreground mb-4">Create your first project to start organizing your work</p>
			<button
				onclick={() => showCreateModal = true}
				class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				<Plus class="h-4 w-4" />
				Create Project
			</button>
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredProjects as project}
				<div class="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
					<div class="flex items-start justify-between mb-3">
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold truncate">{project.name}</h3>
							<p class="text-sm text-muted-foreground line-clamp-2">{project.description || 'No description'}</p>
						</div>
						<div class="relative group">
							<button class="p-1 rounded hover:bg-muted">
								<MoreVertical class="h-4 w-4 text-muted-foreground" />
							</button>
							<div class="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-popover shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
								<button
									onclick={() => openEditModal(project)}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
								>
									<Edit class="h-4 w-4" />
									Edit
								</button>
								<button
									onclick={() => exportProject(project)}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
								>
									<Download class="h-4 w-4" />
									Export
								</button>
								<button
									onclick={() => deleteProject(project.id)}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-muted"
								>
									<Trash2 class="h-4 w-4" />
									Delete
								</button>
							</div>
						</div>
					</div>

					<!-- Status -->
					<div class="flex items-center gap-2 mb-3">
						<select
							value={project.status}
							onchange={(e) => updateProjectStatus(project.id, (e.target as HTMLSelectElement).value as Project['status'])}
							class="text-xs rounded border border-border bg-background px-2 py-1 {getStatusColor(project.status)}"
						>
							<option value="planning">Planning</option>
							<option value="active">Active</option>
							<option value="paused">Paused</option>
							<option value="completed">Completed</option>
							<option value="archived">Archived</option>
						</select>
						{#if project.tags.length > 0}
							<div class="flex items-center gap-1 overflow-hidden">
								{#each project.tags.slice(0, 2) as tag}
									<span class="text-xs px-1.5 py-0.5 rounded bg-muted truncate">{tag}</span>
								{/each}
								{#if project.tags.length > 2}
									<span class="text-xs text-muted-foreground">+{project.tags.length - 2}</span>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Progress -->
					<div class="mb-3">
						<div class="flex items-center justify-between text-xs mb-1">
							<span class="text-muted-foreground">{project.tasks.length} tasks</span>
							<span class="font-medium">{getCompletionPercentage(project.tasks)}%</span>
						</div>
						<div class="h-1.5 rounded-full bg-muted overflow-hidden">
							<div
								class="h-full bg-primary transition-all"
								style="width: {getCompletionPercentage(project.tasks)}%"
							></div>
						</div>
					</div>

					<!-- Tasks Preview -->
					{#if project.tasks.length > 0}
						<div class="space-y-1 mb-3">
							{#each project.tasks.slice(0, 3) as task}
								<div class="flex items-center gap-2 text-sm">
									<button
										onclick={() => updateTaskStatus(project.id, task.id, task.status === 'done' ? 'todo' : 'done')}
										class="text-muted-foreground hover:text-foreground"
									>
										<svelte:component this={getStatusIcon(task.status)} class="h-4 w-4 {task.status === 'done' ? 'text-green-500' : task.status === 'blocked' ? 'text-red-500' : ''}" />
									</button>
									<span class="truncate {task.status === 'done' ? 'line-through text-muted-foreground' : ''}">{task.title}</span>
									<span class="ml-auto text-xs px-1.5 py-0.5 rounded {getPriorityColor(task.priority)}">{task.priority}</span>
								</div>
							{/each}
							{#if project.tasks.length > 3}
								<p class="text-xs text-muted-foreground">+{project.tasks.length - 3} more tasks</p>
							{/if}
						</div>
					{/if}

					<!-- Add Task -->
					<button
						onclick={() => openTaskModal(project)}
						class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
					>
						<Plus class="h-4 w-4" />
						Add Task
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Project Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => showCreateModal = false}>
		<div class="w-full max-w-md rounded-xl bg-card p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold">New Project</h2>
				<button onclick={() => showCreateModal = false} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="project-name" class="block text-sm font-medium mb-1">Name</label>
					<input
						id="project-name"
						type="text"
						bind:value={newProjectName}
						placeholder="My Project"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label for="project-desc" class="block text-sm font-medium mb-1">Description</label>
					<textarea
						id="project-desc"
						bind:value={newProjectDescription}
						placeholder="What is this project about?"
						rows="3"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>
				<div>
					<label for="project-tags" class="block text-sm font-medium mb-1">Tags</label>
					<input
						id="project-tags"
						type="text"
						bind:value={newProjectTags}
						placeholder="tag1, tag2, tag3"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
				</div>
			</div>
			<div class="flex justify-end gap-2 mt-6">
				<button
					onclick={() => showCreateModal = false}
					class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={createProject}
					disabled={!newProjectName.trim()}
					class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
				>
					Create Project
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Project Modal -->
{#if showEditModal && selectedProject}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => showEditModal = false}>
		<div class="w-full max-w-md rounded-xl bg-card p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold">Edit Project</h2>
				<button onclick={() => showEditModal = false} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="edit-name" class="block text-sm font-medium mb-1">Name</label>
					<input
						id="edit-name"
						type="text"
						bind:value={newProjectName}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label for="edit-desc" class="block text-sm font-medium mb-1">Description</label>
					<textarea
						id="edit-desc"
						bind:value={newProjectDescription}
						rows="3"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>
				<div>
					<label for="edit-tags" class="block text-sm font-medium mb-1">Tags</label>
					<input
						id="edit-tags"
						type="text"
						bind:value={newProjectTags}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
			</div>
			<div class="flex justify-end gap-2 mt-6">
				<button
					onclick={() => showEditModal = false}
					class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={updateProject}
					class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Add Task Modal -->
{#if showTaskModal && selectedProject}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => showTaskModal = false}>
		<div class="w-full max-w-md rounded-xl bg-card p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold">Add Task to {selectedProject.name}</h2>
				<button onclick={() => showTaskModal = false} class="text-muted-foreground hover:text-foreground">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="task-title" class="block text-sm font-medium mb-1">Title</label>
					<input
						id="task-title"
						type="text"
						bind:value={newTaskTitle}
						placeholder="What needs to be done?"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label for="task-desc" class="block text-sm font-medium mb-1">Description</label>
					<textarea
						id="task-desc"
						bind:value={newTaskDescription}
						placeholder="Additional details..."
						rows="2"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>
				<div>
					<label for="task-priority" class="block text-sm font-medium mb-1">Priority</label>
					<select
						id="task-priority"
						bind:value={newTaskPriority}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="critical">Critical</option>
					</select>
				</div>
			</div>
			<div class="flex justify-end gap-2 mt-6">
				<button
					onclick={() => showTaskModal = false}
					class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={createTask}
					disabled={!newTaskTitle.trim()}
					class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
				>
					Add Task
				</button>
			</div>
		</div>
	</div>
{/if}
