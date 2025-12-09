<script lang="ts">
	import {
		researchStore,
		activeSession,
		activeSessions,
		archivedSessions,
		formatCitation,
		getSourceLabel,
		type ResearchSession,
		type Citation,
		type SourceType,
		type ResearchSource
	} from '$stores/research';
	import { modelsStore } from '$stores/models';
	import {
		Search,
		Plus,
		Trash2,
		FileText,
		Globe,
		FolderOpen,
		GraduationCap,
		BookOpen,
		ChevronRight,
		ChevronDown,
		X,
		Copy,
		Download,
		Settings,
		Sparkles,
		BookMarked,
		Loader2,
		ExternalLink,
		Archive,
		RotateCcw,
		Edit3,
		Quote,
		Layers,
		RefreshCw,
		AlertCircle
	} from 'lucide-svelte';

	// View state
	let currentView = $state<'sessions' | 'research'>('sessions');
	let showNewSessionModal = $state(false);
	let showConfigModal = $state(false);
	let showCitationModal = $state(false);
	let selectedCitation = $state<Citation | null>(null);

	// New session form
	let newSessionTitle = $state('');
	let newSessionDescription = $state('');
	let newSessionQuery = $state('');

	// Search state
	let searchQuery = $state('');
	let selectedSources = $state<SourceType[]>(['arxiv', 'web', 'semantic_scholar']);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);

	// Synthesis state
	let isSynthesizing = $state(false);
	let synthesisError = $state<string | null>(null);

	// Filter state
	let sessionFilter = $state<'all' | 'active' | 'archived'>('active');

	const store = $derived($researchStore);
	const session = $derived($activeSession);
	const models = $derived($modelsStore.models);

	const filteredSessions = $derived(() => {
		switch (sessionFilter) {
			case 'active':
				return $activeSessions;
			case 'archived':
				return $archivedSessions;
			default:
				return store.sessions;
		}
	});

	function getSourceIcon(type: SourceType) {
		switch (type) {
			case 'arxiv': return FileText;
			case 'web': return Globe;
			case 'local': return FolderOpen;
			case 'semantic_scholar': return GraduationCap;
			case 'wikipedia': return BookOpen;
			default: return Search;
		}
	}

	function createSession() {
		if (!newSessionTitle.trim()) return;

		researchStore.createSession(
			newSessionTitle.trim(),
			newSessionDescription.trim(),
			newSessionQuery.trim()
		);

		newSessionTitle = '';
		newSessionDescription = '';
		newSessionQuery = '';
		showNewSessionModal = false;
		currentView = 'research';
	}

	function selectSession(id: string) {
		researchStore.setActiveSession(id);
		currentView = 'research';
	}

	async function performSearch() {
		if (!session || !searchQuery.trim()) return;

		isSearching = true;
		searchError = null;

		try {
			// Add sources for each selected source type
			for (const sourceType of selectedSources) {
				researchStore.addSource(session.id, sourceType, searchQuery);
			}

			// Update session query
			researchStore.updateSession(session.id, { query: searchQuery });

			// Simulate search for each source (replace with real API calls)
			for (const sourceType of selectedSources) {
				const source = session.sources.find(s => s.type === sourceType && s.query === searchQuery);
				if (!source) continue;

				researchStore.updateSource(session.id, source.id, { status: 'searching' });

				try {
					const results = await searchSource(sourceType, searchQuery);
					researchStore.updateSource(session.id, source.id, {
						status: 'completed',
						results,
						searchedAt: new Date().toISOString()
					});

					// Add results as citations
					for (const result of results) {
						researchStore.addCitation(session.id, result);
					}
				} catch (err) {
					researchStore.updateSource(session.id, source.id, {
						status: 'error',
						error: err instanceof Error ? err.message : 'Search failed'
					});
				}
			}
		} catch (err) {
			searchError = err instanceof Error ? err.message : 'Search failed';
		} finally {
			isSearching = false;
		}
	}

	async function searchSource(type: SourceType, query: string): Promise<Omit<Citation, 'id' | 'addedAt'>[]> {
		// Simulate API delay
		await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

		// Mock results - in production, this would call real APIs
		const mockResults: Omit<Citation, 'id' | 'addedAt'>[] = [];
		const numResults = Math.floor(Math.random() * 5) + 3;

		for (let i = 0; i < numResults; i++) {
			mockResults.push({
				title: `${query} - Research Paper ${i + 1} from ${getSourceLabel(type)}`,
				authors: ['Author A', 'Author B', 'Author C'].slice(0, Math.floor(Math.random() * 3) + 1),
				year: 2020 + Math.floor(Math.random() * 5),
				source: type,
				url: type === 'arxiv' ? `https://arxiv.org/abs/2401.${String(i).padStart(5, '0')}` : `https://example.com/${i}`,
				arxivId: type === 'arxiv' ? `2401.${String(i).padStart(5, '0')}` : undefined,
				abstract: `This paper presents research on ${query}. We explore various aspects and provide insights into the field.`,
				snippet: `...relevant text about ${query} that matches the search criteria...`,
				relevanceScore: 0.95 - (i * 0.1)
			});
		}

		return mockResults;
	}

	async function generateSynthesis() {
		if (!session || session.citations.length === 0) return;

		isSynthesizing = true;
		synthesisError = null;

		try {
			const citationContext = session.citations
				.map((c, i) => `[${i + 1}] ${c.title} (${c.authors.join(', ')}, ${c.year})\n${c.abstract || c.snippet || ''}`)
				.join('\n\n');

			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: store.config.synthesisModel,
					messages: [
						{
							role: 'system',
							content: 'You are a research assistant. Synthesize the provided research papers into a coherent summary. Include inline citations using [n] notation.'
						},
						{
							role: 'user',
							content: `Research query: ${session.query}\n\nPapers to synthesize:\n${citationContext}\n\nProvide a comprehensive synthesis of these papers, highlighting key findings, methodologies, and conclusions.`
						}
					],
					stream: false
				})
			});

			if (!response.ok) throw new Error('Synthesis request failed');

			const data = await response.json();
			const summary = data.message?.content || data.response || '';

			researchStore.updateSynthesis(session.id, {
				summary,
				sections: [],
				generatedAt: new Date().toISOString(),
				model: store.config.synthesisModel
			});
		} catch (err) {
			synthesisError = err instanceof Error ? err.message : 'Synthesis failed';
		} finally {
			isSynthesizing = false;
		}
	}

	function exportCitations() {
		if (!session) return;

		const formatted = session.citations
			.map(c => formatCitation(c, store.config.citationStyle))
			.join('\n\n');

		const blob = new Blob([formatted], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${session.title}-citations.${store.config.citationStyle === 'bibtex' ? 'bib' : 'txt'}`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function formatDate(date: string) {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(date));
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border bg-card px-6 py-4">
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<BookMarked class="h-6 w-6 text-primary" />
				<h1 class="text-xl font-semibold">Research Lab</h1>
			</div>

			{#if session}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<ChevronRight class="h-4 w-4" />
					<span class="font-medium text-foreground">{session.title}</span>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if currentView === 'research' && session}
				<button
					type="button"
					onclick={() => { currentView = 'sessions'; researchStore.setActiveSession(null); }}
					class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
				>
					<ChevronRight class="h-4 w-4 rotate-180" />
					Back to Sessions
				</button>
			{/if}
			<button
				type="button"
				onclick={() => showConfigModal = true}
				class="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
				title="Settings"
			>
				<Settings class="h-5 w-5" />
			</button>
			<button
				type="button"
				onclick={() => showNewSessionModal = true}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				<Plus class="h-4 w-4" />
				New Research
			</button>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-hidden">
		{#if currentView === 'sessions'}
			<!-- Sessions List View -->
			<div class="h-full overflow-y-auto p-6">
				<!-- Filter Tabs -->
				<div class="mb-6 flex items-center gap-4">
					<div class="flex rounded-lg border border-border p-1">
						{#each [
							{ value: 'active', label: 'Active' },
							{ value: 'archived', label: 'Archived' },
							{ value: 'all', label: 'All' }
						] as filter}
							<button
								type="button"
								onclick={() => sessionFilter = filter.value as typeof sessionFilter}
								class="rounded-md px-4 py-1.5 text-sm transition-colors {sessionFilter === filter.value
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								{filter.label}
							</button>
						{/each}
					</div>
					<span class="text-sm text-muted-foreground">
						{filteredSessions().length} session{filteredSessions().length !== 1 ? 's' : ''}
					</span>
				</div>

				{#if filteredSessions().length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center">
						<BookMarked class="mb-4 h-16 w-16 text-muted-foreground/30" />
						<h3 class="mb-2 text-lg font-medium">No research sessions</h3>
						<p class="mb-6 text-sm text-muted-foreground">
							Start a new research session to search across multiple sources
						</p>
						<button
							type="button"
							onclick={() => showNewSessionModal = true}
							class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							<Plus class="h-4 w-4" />
							Create Research Session
						</button>
					</div>
				{:else}
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each filteredSessions() as sess (sess.id)}
							<div
								class="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
								onclick={() => selectSession(sess.id)}
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && selectSession(sess.id)}
							>
								<div class="mb-3 flex items-start justify-between">
									<div class="flex-1">
										<h3 class="font-medium line-clamp-1">{sess.title}</h3>
										<p class="mt-1 text-sm text-muted-foreground line-clamp-2">
											{sess.description || sess.query || 'No description'}
										</p>
									</div>
									<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										{#if sess.status === 'active'}
											<button
												type="button"
												onclick={(e) => { e.stopPropagation(); researchStore.archiveSession(sess.id); }}
												class="rounded p-1.5 text-muted-foreground hover:bg-muted"
												title="Archive"
											>
												<Archive class="h-4 w-4" />
											</button>
										{:else}
											<button
												type="button"
												onclick={(e) => { e.stopPropagation(); researchStore.updateSession(sess.id, { status: 'active' }); }}
												class="rounded p-1.5 text-muted-foreground hover:bg-muted"
												title="Restore"
											>
												<RotateCcw class="h-4 w-4" />
											</button>
										{/if}
										<button
											type="button"
											onclick={(e) => { e.stopPropagation(); researchStore.duplicateSession(sess.id); }}
											class="rounded p-1.5 text-muted-foreground hover:bg-muted"
											title="Duplicate"
										>
											<Copy class="h-4 w-4" />
										</button>
										<button
											type="button"
											onclick={(e) => { e.stopPropagation(); researchStore.deleteSession(sess.id); }}
											class="rounded p-1.5 text-destructive hover:bg-destructive/10"
											title="Delete"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								</div>

								<div class="flex flex-wrap gap-2 mb-3">
									{#each sess.sources.slice(0, 3) as source}
										{@const Icon = getSourceIcon(source.type)}
										<span class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
											<Icon class="h-3 w-3" />
											{getSourceLabel(source.type)}
										</span>
									{/each}
									{#if sess.sources.length > 3}
										<span class="text-xs text-muted-foreground">+{sess.sources.length - 3} more</span>
									{/if}
								</div>

								<div class="flex items-center justify-between text-xs text-muted-foreground">
									<span>{sess.citations.length} citations</span>
									<span>{formatDate(sess.updatedAt)}</span>
								</div>

								{#if sess.status === 'archived'}
									<div class="absolute top-2 right-2">
										<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
											Archived
										</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else if session}
			<!-- Research View -->
			<div class="flex h-full">
				<!-- Left Panel: Search & Sources -->
				<div class="w-96 flex-shrink-0 border-r border-border overflow-y-auto">
					<div class="p-4">
						<!-- Search Box -->
						<div class="mb-4">
							<label for="search-query" class="mb-2 block text-sm font-medium">Search Query</label>
							<div class="flex gap-2">
								<input
									id="search-query"
									type="text"
									bind:value={searchQuery}
									placeholder="Enter research topic..."
									class="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									onkeydown={(e) => e.key === 'Enter' && performSearch()}
								/>
								<button
									type="button"
									onclick={performSearch}
									disabled={isSearching || !searchQuery.trim()}
									class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
								>
									{#if isSearching}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else}
										<Search class="h-4 w-4" />
									{/if}
								</button>
							</div>
						</div>

						<!-- Source Selection -->
						<div class="mb-4">
							<span class="mb-2 block text-sm font-medium">Sources</span>
							<div class="flex flex-wrap gap-2" role="group" aria-label="Select research sources">
								{#each ['arxiv', 'web', 'semantic_scholar', 'wikipedia', 'local'] as sourceType}
									{@const Icon = getSourceIcon(sourceType as SourceType)}
									<button
										type="button"
										onclick={() => {
											if (selectedSources.includes(sourceType as SourceType)) {
												selectedSources = selectedSources.filter(s => s !== sourceType);
											} else {
												selectedSources = [...selectedSources, sourceType as SourceType];
											}
										}}
										class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors {selectedSources.includes(sourceType as SourceType)
											? 'border-primary bg-primary/10 text-primary'
											: 'border-border hover:bg-muted'}"
									>
										<Icon class="h-4 w-4" />
										{getSourceLabel(sourceType as SourceType)}
									</button>
								{/each}
							</div>
						</div>

						{#if searchError}
							<div class="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
								<AlertCircle class="h-4 w-4" />
								{searchError}
							</div>
						{/if}

						<!-- Search Results by Source -->
						{#if session.sources.length > 0}
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<h3 class="text-sm font-medium">Search Results</h3>
									<span class="text-xs text-muted-foreground">
										{session.citations.length} total results
									</span>
								</div>

								{#each session.sources as source (source.id)}
									{@const Icon = getSourceIcon(source.type)}
									<div class="rounded-lg border border-border">
										<div class="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
											<div class="flex items-center gap-2">
												<Icon class="h-4 w-4" />
												<span class="text-sm font-medium">{getSourceLabel(source.type)}</span>
											</div>
											<div class="flex items-center gap-2">
												{#if source.status === 'searching'}
													<Loader2 class="h-4 w-4 animate-spin text-primary" />
												{:else if source.status === 'completed'}
													<span class="text-xs text-muted-foreground">{source.results.length} results</span>
												{:else if source.status === 'error'}
													<span class="text-xs text-destructive">Error</span>
												{/if}
												<button
													type="button"
													onclick={() => researchStore.removeSource(session.id, source.id)}
													class="rounded p-1 text-muted-foreground hover:bg-muted"
												>
													<X class="h-3 w-3" />
												</button>
											</div>
										</div>

										{#if source.results.length > 0}
											<div class="max-h-48 overflow-y-auto">
												{#each source.results.slice(0, 5) as result}
													<div class="border-b border-border p-2 last:border-0 hover:bg-muted/50 cursor-pointer text-xs">
														<p class="font-medium line-clamp-1">{result.title}</p>
														<p class="text-muted-foreground line-clamp-1">
															{result.authors.join(', ')} ({result.year})
														</p>
													</div>
												{/each}
												{#if source.results.length > 5}
													<div class="p-2 text-center text-xs text-muted-foreground">
														+{source.results.length - 5} more results
													</div>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Center Panel: Citations & Synthesis -->
				<div class="flex-1 flex flex-col overflow-hidden">
					<!-- Tabs -->
					<div class="border-b border-border bg-card">
						<div class="flex">
							{#each [
								{ id: 'citations', label: 'Citations', icon: Quote, count: session.citations.length },
								{ id: 'synthesis', label: 'Synthesis', icon: Sparkles },
								{ id: 'notes', label: 'Notes', icon: Edit3 }
							] as tab}
								<button
									type="button"
									class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors {tab.id === 'citations'
										? 'border-primary text-primary'
										: 'border-transparent text-muted-foreground hover:text-foreground'}"
								>
									<tab.icon class="h-4 w-4" />
									{tab.label}
									{#if tab.count !== undefined}
										<span class="rounded-full bg-muted px-2 py-0.5 text-xs">{tab.count}</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<!-- Citations List -->
					<div class="flex-1 overflow-y-auto p-4">
						{#if session.citations.length === 0}
							<div class="flex flex-col items-center justify-center py-16 text-center">
								<Quote class="mb-4 h-12 w-12 text-muted-foreground/30" />
								<h3 class="mb-2 font-medium">No citations yet</h3>
								<p class="text-sm text-muted-foreground">
									Search for papers to add citations to your research
								</p>
							</div>
						{:else}
							<div class="space-y-3">
								{#each session.citations as citation (citation.id)}
									{@const Icon = getSourceIcon(citation.source)}
									<div
										class="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
										onclick={() => { selectedCitation = citation; showCitationModal = true; }}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && (selectedCitation = citation, showCitationModal = true)}
									>
										<div class="flex items-start justify-between gap-4">
											<div class="flex-1">
												<div class="flex items-center gap-2 mb-1">
													<Icon class="h-4 w-4 text-muted-foreground" />
													<span class="text-xs text-muted-foreground">{getSourceLabel(citation.source)}</span>
													<span class="text-xs text-muted-foreground">
														{Math.round(citation.relevanceScore * 100)}% relevant
													</span>
												</div>
												<h4 class="font-medium">{citation.title}</h4>
												<p class="mt-1 text-sm text-muted-foreground">
													{citation.authors.join(', ')} ({citation.year})
												</p>
												{#if citation.abstract}
													<p class="mt-2 text-sm text-muted-foreground line-clamp-2">
														{citation.abstract}
													</p>
												{/if}
											</div>
											<div class="flex items-center gap-1">
												{#if citation.url}
													<a
														href={citation.url}
														target="_blank"
														rel="noopener noreferrer"
														onclick={(e) => e.stopPropagation()}
														class="rounded p-1.5 text-muted-foreground hover:bg-muted"
													>
														<ExternalLink class="h-4 w-4" />
													</a>
												{/if}
												<button
													type="button"
													onclick={(e) => { e.stopPropagation(); copyToClipboard(formatCitation(citation, store.config.citationStyle)); }}
													class="rounded p-1.5 text-muted-foreground hover:bg-muted"
													title="Copy citation"
												>
													<Copy class="h-4 w-4" />
												</button>
												<button
													type="button"
													onclick={(e) => { e.stopPropagation(); researchStore.removeCitation(session.id, citation.id); }}
													class="rounded p-1.5 text-destructive hover:bg-destructive/10"
													title="Remove"
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Action Bar -->
					<div class="border-t border-border bg-card p-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={generateSynthesis}
									disabled={isSynthesizing || session.citations.length === 0}
									class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
								>
									{#if isSynthesizing}
										<Loader2 class="h-4 w-4 animate-spin" />
										Synthesizing...
									{:else}
										<Sparkles class="h-4 w-4" />
										Generate Synthesis
									{/if}
								</button>
								{#if synthesisError}
									<span class="text-sm text-destructive">{synthesisError}</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={exportCitations}
									disabled={session.citations.length === 0}
									class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
								>
									<Download class="h-4 w-4" />
									Export Citations
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Panel: Synthesis Preview -->
				<div class="w-96 flex-shrink-0 border-l border-border overflow-y-auto bg-muted/30">
					<div class="p-4">
						<div class="flex items-center justify-between mb-4">
							<h3 class="font-medium">Synthesis</h3>
							{#if session.synthesis.generatedAt}
								<span class="text-xs text-muted-foreground">
									{formatDate(session.synthesis.generatedAt)}
								</span>
							{/if}
						</div>

						{#if session.synthesis.summary}
							<div class="rounded-lg border border-border bg-card p-4">
								<div class="prose prose-sm max-w-none">
									<p class="whitespace-pre-wrap text-sm">{session.synthesis.summary}</p>
								</div>
								{#if session.synthesis.model}
									<p class="mt-3 text-xs text-muted-foreground">
										Generated with {session.synthesis.model}
									</p>
								{/if}
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
								<Layers class="mb-3 h-10 w-10 text-muted-foreground/30" />
								<p class="text-sm text-muted-foreground">
									No synthesis generated yet
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Add citations and click "Generate Synthesis"
								</p>
							</div>
						{/if}

						<!-- Notes Section -->
						<div class="mt-6">
							<h3 class="mb-2 font-medium">Research Notes</h3>
							<textarea
								bind:value={session.notes}
								onblur={() => researchStore.updateSession(session.id, { notes: session.notes })}
								placeholder="Add your research notes here..."
								class="min-h-[200px] w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
							></textarea>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- New Session Modal -->
{#if showNewSessionModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">New Research Session</h2>
				<button
					type="button"
					onclick={() => showNewSessionModal = false}
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="session-title" class="mb-1.5 block text-sm font-medium">Title</label>
					<input
						id="session-title"
						type="text"
						bind:value={newSessionTitle}
						placeholder="e.g., Literature review on transformer architectures"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="session-description" class="mb-1.5 block text-sm font-medium">Description</label>
					<textarea
						id="session-description"
						bind:value={newSessionDescription}
						placeholder="Brief description of your research goals..."
						rows="3"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>

				<div>
					<label for="session-initial-query" class="mb-1.5 block text-sm font-medium">Initial Query (optional)</label>
					<input
						id="session-initial-query"
						type="text"
						bind:value={newSessionQuery}
						placeholder="e.g., attention mechanisms in neural networks"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={() => showNewSessionModal = false}
					class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={createSession}
					disabled={!newSessionTitle.trim()}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					Create Session
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Config Modal -->
{#if showConfigModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Research Settings</h2>
				<button
					type="button"
					onclick={() => showConfigModal = false}
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="synthesis-model" class="mb-1.5 block text-sm font-medium">Synthesis Model</label>
					<select
						id="synthesis-model"
						bind:value={store.config.synthesisModel}
						onchange={() => researchStore.updateConfig({ synthesisModel: store.config.synthesisModel })}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{#each models as model}
							<option value={model.name}>{model.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="max-results" class="mb-1.5 block text-sm font-medium">Max Results per Source</label>
					<input
						id="max-results"
						type="number"
						min="1"
						max="50"
						bind:value={store.config.maxResultsPerSource}
						onchange={() => researchStore.updateConfig({ maxResultsPerSource: store.config.maxResultsPerSource })}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="citation-style" class="mb-1.5 block text-sm font-medium">Citation Style</label>
					<select
						id="citation-style"
						bind:value={store.config.citationStyle}
						onchange={() => researchStore.updateConfig({ citationStyle: store.config.citationStyle })}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="apa">APA</option>
						<option value="mla">MLA</option>
						<option value="chicago">Chicago</option>
						<option value="ieee">IEEE</option>
						<option value="bibtex">BibTeX</option>
					</select>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<span class="text-sm font-medium">Auto-synthesize</span>
						<p class="text-xs text-muted-foreground">Automatically generate synthesis after search</p>
					</div>
					<button
						type="button"
						onclick={() => researchStore.updateConfig({ autoSynthesize: !store.config.autoSynthesize })}
						class="relative h-6 w-11 rounded-full transition-colors {store.config.autoSynthesize ? 'bg-primary' : 'bg-muted'}"
						role="switch"
						aria-checked={store.config.autoSynthesize}
						aria-label="Auto-synthesize"
					>
						<span
							class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform {store.config.autoSynthesize ? 'translate-x-5' : ''}"
						></span>
					</button>
				</div>
			</div>

			<div class="mt-6 flex justify-end">
				<button
					type="button"
					onclick={() => showConfigModal = false}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Citation Detail Modal -->
{#if showCitationModal && selectedCitation}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl max-h-[80vh] flex flex-col">
			<div class="flex items-center justify-between border-b border-border p-4">
				{#if selectedCitation}
					{@const Icon = getSourceIcon(selectedCitation.source)}
					<div class="flex items-center gap-2">
						<Icon class="h-5 w-5 text-muted-foreground" />
						<span class="text-sm text-muted-foreground">{getSourceLabel(selectedCitation.source)}</span>
					</div>
				{/if}
				<button
					type="button"
					onclick={() => { showCitationModal = false; selectedCitation = null; }}
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<h2 class="text-xl font-semibold mb-2">{selectedCitation.title}</h2>
				<p class="text-sm text-muted-foreground mb-4">
					{selectedCitation.authors.join(', ')} ({selectedCitation.year})
				</p>

				{#if selectedCitation.abstract}
					<div class="mb-4">
						<h3 class="text-sm font-medium mb-2">Abstract</h3>
						<p class="text-sm text-muted-foreground">{selectedCitation.abstract}</p>
					</div>
				{/if}

				<div class="mb-4">
					<h3 class="text-sm font-medium mb-2">Citation</h3>
					<div class="rounded-lg bg-muted p-3 font-mono text-sm">
						{formatCitation(selectedCitation, store.config.citationStyle)}
					</div>
				</div>

				{#if selectedCitation.url || selectedCitation.doi || selectedCitation.arxivId}
					<div class="flex flex-wrap gap-2">
						{#if selectedCitation.url}
							<a
								href={selectedCitation.url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
							>
								<ExternalLink class="h-4 w-4" />
								View Source
							</a>
						{/if}
						{#if selectedCitation.arxivId}
							<a
								href={`https://arxiv.org/abs/${selectedCitation.arxivId}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
							>
								<FileText class="h-4 w-4" />
								arXiv: {selectedCitation.arxivId}
							</a>
						{/if}
					</div>
				{/if}
			</div>

			<div class="border-t border-border p-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={() => copyToClipboard(formatCitation(selectedCitation!, store.config.citationStyle))}
					class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
				>
					<Copy class="h-4 w-4" />
					Copy Citation
				</button>
				<button
					type="button"
					onclick={() => { showCitationModal = false; selectedCitation = null; }}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
