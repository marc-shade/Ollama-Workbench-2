<script lang="ts">
	import {
		GitBranch,
		FolderGit2,
		Plus,
		RefreshCw,
		Trash2,
		Search,
		File,
		Folder,
		Code,
		FileCode,
		ChevronRight,
		ChevronDown,
		ExternalLink,
		Loader2
	} from 'lucide-svelte';

	interface RepoStats {
		total_files: number;
		total_directories: number;
		total_lines: number;
		languages: Record<string, number>;
		largest_files: Array<{ path: string; size: number; language: string }>;
	}

	interface Repository {
		id: string;
		name: string;
		url?: string;
		local_path?: string;
		description: string;
		branch: string;
		last_commit?: string;
		last_commit_date?: string;
		stats?: RepoStats;
		status: string;
		error?: string;
		created_at: string;
		updated_at: string;
	}

	interface FileInfo {
		path: string;
		name: string;
		type: 'file' | 'directory';
		size: number;
		extension: string;
		language: string;
	}

	let repos = $state<Repository[]>([]);
	let selectedRepo = $state<Repository | null>(null);
	let files = $state<FileInfo[]>([]);
	let fileContent = $state<{ path: string; content: string; language: string } | null>(null);
	let searchResults = $state<Array<{ path: string; line: number; content: string; language: string }>>([]);

	let loading = $state(false);
	let showCloneModal = $state(false);
	let showLocalModal = $state(false);
	let cloneUrl = $state('');
	let cloneBranch = $state('main');
	let localPath = $state('');
	let searchQuery = $state('');
	let expandedDirs = $state<Set<string>>(new Set());

	const API_BASE = 'http://localhost:8000/api/repos';

	async function loadRepos() {
		loading = true;
		try {
			const res = await fetch(API_BASE);
			if (res.ok) {
				repos = await res.json();
			}
		} catch (e) {
			console.error('Failed to load repos:', e);
		}
		loading = false;
	}

	async function cloneRepo() {
		if (!cloneUrl) return;

		loading = true;
		try {
			const res = await fetch(`${API_BASE}/clone`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: cloneUrl, branch: cloneBranch })
			});

			if (res.ok) {
				await loadRepos();
				showCloneModal = false;
				cloneUrl = '';
				cloneBranch = 'main';
			} else {
				const error = await res.json();
				alert(error.detail || 'Failed to clone repository');
			}
		} catch (e) {
			console.error('Clone failed:', e);
			alert('Failed to clone repository');
		}
		loading = false;
	}

	async function addLocalRepo() {
		if (!localPath) return;

		loading = true;
		try {
			const res = await fetch(`${API_BASE}/local`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: localPath })
			});

			if (res.ok) {
				await loadRepos();
				showLocalModal = false;
				localPath = '';
			} else {
				const error = await res.json();
				alert(error.detail || 'Failed to add repository');
			}
		} catch (e) {
			console.error('Add local repo failed:', e);
			alert('Failed to add repository');
		}
		loading = false;
	}

	async function selectRepo(repo: Repository) {
		selectedRepo = repo;
		fileContent = null;
		searchResults = [];
		expandedDirs = new Set();
		await loadFiles(repo.id);
	}

	async function loadFiles(repoId: string, path: string = '') {
		try {
			const res = await fetch(`${API_BASE}/${repoId}/files?path=${encodeURIComponent(path)}&max_depth=1`);
			if (res.ok) {
				files = await res.json();
			}
		} catch (e) {
			console.error('Failed to load files:', e);
		}
	}

	async function loadFileContent(repoId: string, path: string) {
		try {
			const res = await fetch(`${API_BASE}/${repoId}/file?path=${encodeURIComponent(path)}`);
			if (res.ok) {
				fileContent = await res.json();
			} else {
				const error = await res.json();
				alert(error.detail || 'Failed to load file');
			}
		} catch (e) {
			console.error('Failed to load file:', e);
		}
	}

	async function searchInRepo() {
		if (!selectedRepo || !searchQuery) return;

		try {
			const res = await fetch(`${API_BASE}/${selectedRepo.id}/search?query=${encodeURIComponent(searchQuery)}`);
			if (res.ok) {
				searchResults = await res.json();
			}
		} catch (e) {
			console.error('Search failed:', e);
		}
	}

	async function analyzeRepo(repo: Repository) {
		try {
			const res = await fetch(`${API_BASE}/${repo.id}/analyze`, { method: 'POST' });
			if (res.ok) {
				await loadRepos();
			}
		} catch (e) {
			console.error('Analysis failed:', e);
		}
	}

	async function deleteRepo(repo: Repository) {
		if (!confirm(`Delete repository "${repo.name}"?`)) return;

		try {
			const res = await fetch(`${API_BASE}/${repo.id}`, { method: 'DELETE' });
			if (res.ok) {
				if (selectedRepo?.id === repo.id) {
					selectedRepo = null;
					files = [];
				}
				await loadRepos();
			}
		} catch (e) {
			console.error('Delete failed:', e);
		}
	}

	function toggleDir(path: string) {
		if (expandedDirs.has(path)) {
			expandedDirs.delete(path);
		} else {
			expandedDirs.add(path);
		}
		expandedDirs = new Set(expandedDirs);
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getLanguageColor(lang: string): string {
		const colors: Record<string, string> = {
			'Python': 'bg-blue-500',
			'JavaScript': 'bg-yellow-400',
			'TypeScript': 'bg-blue-600',
			'Svelte': 'bg-orange-500',
			'Rust': 'bg-orange-700',
			'Go': 'bg-cyan-500',
			'HTML': 'bg-red-500',
			'CSS': 'bg-purple-500',
			'JSON': 'bg-green-500'
		};
		return colors[lang] || 'bg-gray-500';
	}

	$effect(() => {
		loadRepos();
	});
</script>

<div class="flex h-full">
	<!-- Sidebar: Repository List -->
	<div class="w-80 border-r border-border flex flex-col">
		<div class="p-4 border-b border-border">
			<div class="flex items-center justify-between mb-3">
				<h1 class="text-lg font-semibold flex items-center gap-2">
					<FolderGit2 class="h-5 w-5" />
					Repository Analysis
				</h1>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => showCloneModal = true}
					class="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
				>
					<Plus class="h-4 w-4" />
					Clone
				</button>
				<button
					onclick={() => showLocalModal = true}
					class="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted"
				>
					<Folder class="h-4 w-4" />
					Local
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-2">
			{#if loading && repos.length === 0}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			{:else if repos.length === 0}
				<div class="text-center py-8 text-muted-foreground text-sm">
					<FolderGit2 class="h-12 w-12 mx-auto mb-2 opacity-50" />
					<p>No repositories</p>
					<p class="text-xs mt-1">Clone or add a local repo to get started</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each repos as repo}
						<div
							onclick={() => selectRepo(repo)}
							onkeydown={(e) => e.key === 'Enter' && selectRepo(repo)}
							role="button"
							tabindex="0"
							class="w-full text-left p-3 rounded-lg border transition-colors cursor-pointer {selectedRepo?.id === repo.id
								? 'border-primary bg-primary/5'
								: 'border-border hover:bg-muted'}"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<GitBranch class="h-4 w-4 text-muted-foreground flex-shrink-0" />
										<span class="font-medium truncate">{repo.name}</span>
									</div>
									<p class="text-xs text-muted-foreground mt-1 truncate">
										{repo.url || repo.local_path}
									</p>
									{#if repo.stats}
										<div class="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
											<span>{repo.stats.total_files} files</span>
											<span>{repo.stats.total_lines.toLocaleString()} lines</span>
										</div>
									{/if}
								</div>
								<div class="flex items-center gap-1">
									<button
										onclick={(e) => { e.stopPropagation(); analyzeRepo(repo); }}
										class="p-1 hover:bg-muted rounded"
										title="Re-analyze"
									>
										<RefreshCw class="h-3 w-3" />
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); deleteRepo(repo); }}
										class="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
										title="Delete"
									>
										<Trash2 class="h-3 w-3" />
									</button>
								</div>
							</div>
							{#if repo.status === 'cloning'}
								<div class="mt-2 flex items-center gap-2 text-xs text-blue-500">
									<Loader2 class="h-3 w-3 animate-spin" />
									Cloning...
								</div>
							{:else if repo.status === 'error'}
								<div class="mt-2 text-xs text-destructive truncate">
									{repo.error}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex flex-col">
		{#if selectedRepo}
			<!-- Repo Header -->
			<div class="p-4 border-b border-border">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-xl font-semibold">{selectedRepo.name}</h2>
						<p class="text-sm text-muted-foreground">
							{selectedRepo.branch} • {selectedRepo.last_commit?.substring(0, 7) || 'N/A'}
						</p>
					</div>
					{#if selectedRepo.url}
						<a
							href={selectedRepo.url}
							target="_blank"
							rel="noopener"
							class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
						>
							<ExternalLink class="h-4 w-4" />
							View on GitHub
						</a>
					{/if}
				</div>

				<!-- Language Stats -->
				{#if selectedRepo.stats?.languages}
					<div class="mt-4">
						<div class="flex gap-1 h-2 rounded-full overflow-hidden">
							{#each Object.entries(selectedRepo.stats.languages).sort((a, b) => b[1] - a[1]).slice(0, 5) as [lang, count]}
								{@const total = Object.values(selectedRepo.stats.languages).reduce((a, b) => a + b, 0)}
								{@const pct = (count / total) * 100}
								<div
									class="{getLanguageColor(lang)}"
									style="width: {pct}%"
									title="{lang}: {count} files ({pct.toFixed(1)}%)"
								></div>
							{/each}
						</div>
						<div class="flex flex-wrap gap-3 mt-2">
							{#each Object.entries(selectedRepo.stats.languages).sort((a, b) => b[1] - a[1]).slice(0, 5) as [lang, count]}
								<div class="flex items-center gap-1 text-xs">
									<div class="w-2 h-2 rounded-full {getLanguageColor(lang)}"></div>
									<span>{lang}</span>
									<span class="text-muted-foreground">({count})</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Search -->
				<div class="mt-4 flex gap-2">
					<div class="flex-1 relative">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search in repository..."
							bind:value={searchQuery}
							onkeydown={(e) => e.key === 'Enter' && searchInRepo()}
							class="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
					<button
						onclick={searchInRepo}
						class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
					>
						Search
					</button>
				</div>
			</div>

			<!-- Content Area -->
			<div class="flex-1 flex overflow-hidden">
				<!-- File Tree -->
				<div class="w-64 border-r border-border overflow-y-auto p-2">
					<div class="space-y-0.5">
						{#each files.filter(f => f.path.split('/').length === 1 || !f.path.includes('/')) as file}
							{#if file.type === 'directory'}
								<button
									onclick={() => toggleDir(file.path)}
									class="w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-muted rounded text-left"
								>
									{#if expandedDirs.has(file.path)}
										<ChevronDown class="h-3 w-3" />
									{:else}
										<ChevronRight class="h-3 w-3" />
									{/if}
									<Folder class="h-4 w-4 text-blue-500" />
									<span class="truncate">{file.name}</span>
								</button>
							{:else}
								<button
									onclick={() => loadFileContent(selectedRepo.id, file.path)}
									class="w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-muted rounded text-left pl-6"
								>
									<FileCode class="h-4 w-4 text-muted-foreground" />
									<span class="truncate">{file.name}</span>
								</button>
							{/if}
						{/each}
					</div>
				</div>

				<!-- File Content / Search Results -->
				<div class="flex-1 overflow-auto p-4">
					{#if searchResults.length > 0}
						<div>
							<h3 class="font-medium mb-3">Search Results ({searchResults.length})</h3>
							<div class="space-y-2">
								{#each searchResults as result}
									<button
										onclick={() => loadFileContent(selectedRepo.id, result.path)}
										class="w-full text-left p-3 bg-muted/50 rounded-lg hover:bg-muted"
									>
										<div class="flex items-center gap-2 text-sm font-medium">
											<FileCode class="h-4 w-4" />
											<span>{result.path}</span>
											<span class="text-muted-foreground">:{result.line}</span>
										</div>
										<pre class="mt-1 text-xs text-muted-foreground overflow-hidden text-ellipsis">{result.content}</pre>
									</button>
								{/each}
							</div>
						</div>
					{:else if fileContent}
						<div>
							<div class="flex items-center justify-between mb-3">
								<h3 class="font-medium flex items-center gap-2">
									<Code class="h-4 w-4" />
									{fileContent.path}
								</h3>
								<span class="text-xs text-muted-foreground">{fileContent.language}</span>
							</div>
							<pre class="p-4 bg-muted rounded-lg text-sm overflow-x-auto"><code>{fileContent.content}</code></pre>
						</div>
					{:else}
						<div class="flex items-center justify-center h-full text-muted-foreground">
							<div class="text-center">
								<File class="h-12 w-12 mx-auto mb-2 opacity-50" />
								<p>Select a file to view its contents</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="flex-1 flex items-center justify-center text-muted-foreground">
				<div class="text-center">
					<FolderGit2 class="h-16 w-16 mx-auto mb-4 opacity-50" />
					<p class="text-lg">Select a repository to explore</p>
					<p class="text-sm mt-1">Or clone a new one to get started</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Clone Modal -->
{#if showCloneModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
			<h3 class="text-lg font-semibold mb-4">Clone Repository</h3>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">Repository URL</label>
					<input
						type="text"
						placeholder="https://github.com/user/repo.git"
						bind:value={cloneUrl}
						class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Branch</label>
					<input
						type="text"
						placeholder="main"
						bind:value={cloneBranch}
						class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
			</div>
			<div class="flex justify-end gap-2 mt-6">
				<button
					onclick={() => showCloneModal = false}
					class="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
				>
					Cancel
				</button>
				<button
					onclick={cloneRepo}
					disabled={loading || !cloneUrl}
					class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
				>
					{loading ? 'Cloning...' : 'Clone'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Local Modal -->
{#if showLocalModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
			<h3 class="text-lg font-semibold mb-4">Add Local Repository</h3>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">Local Path</label>
					<input
						type="text"
						placeholder="/path/to/repository"
						bind:value={localPath}
						class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
			</div>
			<div class="flex justify-end gap-2 mt-6">
				<button
					onclick={() => showLocalModal = false}
					class="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
				>
					Cancel
				</button>
				<button
					onclick={addLocalRepo}
					disabled={loading || !localPath}
					class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
				>
					{loading ? 'Adding...' : 'Add'}
				</button>
			</div>
		</div>
	</div>
{/if}
