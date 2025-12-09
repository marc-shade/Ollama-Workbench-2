<script lang="ts">
	import {
		promptsStore,
		categories,
		calculateMetrics,
		calculateVariantMetrics,
		type Prompt,
		type PromptVersion,
		type PromptVariant,
		type PromptMetrics
	} from '$stores/prompts';
	import { chatStore } from '$stores/chat';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		Plus,
		Search,
		Star,
		Copy,
		Trash2,
		Edit3,
		X,
		Tag,
		Clock,
		BarChart3,
		Filter,
		Send,
		ChevronDown,
		History,
		GitBranch,
		TrendingUp,
		RotateCcw,
		FlaskConical,
		CheckCircle,
		AlertCircle,
		Timer,
		Zap,
		Award,
		ChevronRight,
		MoreVertical,
		Eye
	} from 'lucide-svelte';

	let searchQuery = $state('');
	let selectedCategory = $state<string | null>(null);
	let showFavoritesOnly = $state(false);
	let editingPrompt = $state<Prompt | null>(null);
	let isCreating = $state(false);
	let deleteConfirm = $state<string | null>(null);
	let showCategoryDropdown = $state(false);

	// Detail view state
	let selectedPrompt = $state<Prompt | null>(null);
	let detailTab = $state<'edit' | 'versions' | 'variants' | 'metrics'>('edit');

	// Form state
	let formTitle = $state('');
	let formContent = $state('');
	let formCategory = $state('');
	let formTags = $state('');

	// Variant form state
	let showVariantModal = $state(false);
	let variantName = $state('');
	let variantContent = $state('');
	let variantWeight = $state(50);
	let editingVariant = $state<PromptVariant | null>(null);

	// Version preview state
	let previewVersion = $state<PromptVersion | null>(null);

	const store = $derived($promptsStore);

	const filteredPrompts = $derived(() => {
		let result = store.prompts;

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.title.toLowerCase().includes(query) ||
					p.content.toLowerCase().includes(query) ||
					p.tags.some((t) => t.toLowerCase().includes(query))
			);
		}

		if (selectedCategory) {
			result = result.filter((p) => p.category === selectedCategory);
		}

		if (showFavoritesOnly) {
			result = result.filter((p) => p.isFavorite);
		}

		return result;
	});

	onMount(() => {
		promptsStore.loadPrompts();
	});

	function startCreate() {
		isCreating = true;
		editingPrompt = null;
		selectedPrompt = null;
		formTitle = '';
		formContent = '';
		formCategory = 'General';
		formTags = '';
	}

	function startEdit(prompt: Prompt) {
		selectedPrompt = prompt;
		detailTab = 'edit';
		formTitle = prompt.title;
		formContent = prompt.content;
		formCategory = prompt.category;
		formTags = prompt.tags.join(', ');
	}

	function cancelEdit() {
		editingPrompt = null;
		isCreating = false;
		selectedPrompt = null;
	}

	function savePrompt() {
		const tags = formTags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		if (isCreating) {
			promptsStore.addPrompt({
				title: formTitle,
				content: formContent,
				category: formCategory,
				tags,
				isFavorite: false
			});
			isCreating = false;
		} else if (selectedPrompt) {
			promptsStore.updatePrompt(selectedPrompt.id, {
				title: formTitle,
				content: formContent,
				category: formCategory,
				tags
			});
			// Refresh selected prompt
			selectedPrompt = store.prompts.find((p) => p.id === selectedPrompt?.id) || null;
		}
	}

	function usePrompt(prompt: Prompt) {
		const convId = chatStore.createConversation('llama3.2', prompt.title);
		chatStore.setActive(convId);
		promptsStore.incrementUsage(prompt.id);
		goto('/chat');
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function restoreVersion(versionIndex: number) {
		if (!selectedPrompt) return;
		promptsStore.restoreVersion(selectedPrompt.id, versionIndex);
		selectedPrompt = store.prompts.find((p) => p.id === selectedPrompt?.id) || null;
		previewVersion = null;
	}

	function openVariantModal(variant?: PromptVariant) {
		if (variant) {
			editingVariant = variant;
			variantName = variant.name;
			variantContent = variant.content;
			variantWeight = variant.weight;
		} else {
			editingVariant = null;
			variantName = '';
			variantContent = selectedPrompt?.content || '';
			variantWeight = 50;
		}
		showVariantModal = true;
	}

	function saveVariant() {
		if (!selectedPrompt) return;

		if (editingVariant) {
			promptsStore.updateVariant(selectedPrompt.id, editingVariant.id, {
				name: variantName,
				content: variantContent,
				weight: variantWeight
			});
		} else {
			promptsStore.addVariant(selectedPrompt.id, variantName, variantContent, variantWeight);
		}

		showVariantModal = false;
		selectedPrompt = store.prompts.find((p) => p.id === selectedPrompt?.id) || null;
	}

	function deleteVariant(variantId: string) {
		if (!selectedPrompt) return;
		promptsStore.deleteVariant(selectedPrompt.id, variantId);
		selectedPrompt = store.prompts.find((p) => p.id === selectedPrompt?.id) || null;
	}

	function promoteVariant(variantId: string) {
		if (!selectedPrompt) return;
		promptsStore.promoteVariant(selectedPrompt.id, variantId);
		selectedPrompt = store.prompts.find((p) => p.id === selectedPrompt?.id) || null;
	}

	function getMetrics(prompt: Prompt): PromptMetrics {
		return calculateMetrics(prompt);
	}

	function formatMs(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-border bg-card px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold">Prompt Lab</h1>
				<p class="text-sm text-muted-foreground mt-1">
					Create, test, and optimize your prompts with version control and A/B testing
				</p>
			</div>
			<button
				onclick={startCreate}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				<Plus class="h-4 w-4" />
				New Prompt
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden flex">
		<!-- Sidebar Filters -->
		<div class="w-64 border-r border-border bg-card overflow-y-auto p-4 space-y-4">
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search prompts..."
					class="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<!-- Favorites Toggle -->
			<button
				onclick={() => (showFavoritesOnly = !showFavoritesOnly)}
				class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors {showFavoritesOnly
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
			>
				<Star class="h-4 w-4 {showFavoritesOnly ? 'fill-current' : ''}" />
				Favorites Only
			</button>

			<!-- Categories -->
			<div>
				<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
					Categories
				</h3>
				<div class="space-y-1">
					<button
						onclick={() => (selectedCategory = null)}
						class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors {selectedCategory === null
							? 'bg-muted'
							: 'hover:bg-muted/50'}"
					>
						<span>All</span>
						<span class="text-xs text-muted-foreground">{store.prompts.length}</span>
					</button>
					{#each $categories as category}
						<button
							onclick={() => (selectedCategory = category)}
							class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors {selectedCategory === category
								? 'bg-muted'
								: 'hover:bg-muted/50'}"
						>
							<span>{category}</span>
							<span class="text-xs text-muted-foreground">
								{store.prompts.filter((p) => p.category === category).length}
							</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Quick Stats -->
			<div class="pt-4 border-t border-border">
				<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
					Statistics
				</h3>
				<div class="space-y-2 px-3">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Total Prompts</span>
						<span class="font-medium">{store.prompts.length}</span>
					</div>
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">With A/B Tests</span>
						<span class="font-medium">{store.prompts.filter((p) => p.abTestingEnabled).length}</span>
					</div>
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Total Uses</span>
						<span class="font-medium">{store.prompts.reduce((acc, p) => acc + p.usageCount, 0)}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Main Content -->
		<div class="flex-1 overflow-hidden flex">
			<!-- Prompts List -->
			<div class="w-80 border-r border-border overflow-y-auto">
				{#if isCreating}
					<div class="p-4 border-b border-border bg-primary/5">
						<div class="flex items-center gap-2">
							<Plus class="h-4 w-4 text-primary" />
							<span class="font-medium">New Prompt</span>
						</div>
					</div>
				{/if}

				{#if filteredPrompts().length === 0}
					<div class="p-8 text-center">
						<Search class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
						<p class="text-sm text-muted-foreground">No prompts found</p>
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each filteredPrompts() as prompt (prompt.id)}
							{@const metrics = getMetrics(prompt)}
							<button
								onclick={() => startEdit(prompt)}
								class="w-full p-4 text-left hover:bg-muted/50 transition-colors {selectedPrompt?.id === prompt.id
									? 'bg-muted'
									: ''}"
							>
								<div class="flex items-start justify-between gap-2 mb-1">
									<h3 class="font-medium truncate">{prompt.title}</h3>
									{#if prompt.isFavorite}
										<Star class="h-4 w-4 flex-shrink-0 fill-yellow-500 text-yellow-500" />
									{/if}
								</div>
								<p class="text-xs text-muted-foreground line-clamp-2 mb-2">{prompt.content}</p>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<span class="px-1.5 py-0.5 rounded bg-muted">{prompt.category}</span>
									{#if prompt.abTestingEnabled}
										<span class="flex items-center gap-1 text-purple-500">
											<FlaskConical class="h-3 w-3" />
											A/B
										</span>
									{/if}
									{#if prompt.versions.length > 1}
										<span class="flex items-center gap-1">
											<History class="h-3 w-3" />
											v{prompt.versions.length}
										</span>
									{/if}
									{#if metrics.avgRating > 0}
										<span class="flex items-center gap-1">
											<Star class="h-3 w-3" />
											{metrics.avgRating.toFixed(1)}
										</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Detail Panel -->
			<div class="flex-1 overflow-y-auto">
				{#if isCreating}
					<!-- Create Form -->
					<div class="p-6">
						<div class="max-w-2xl">
							<div class="flex items-center justify-between mb-6">
								<h2 class="text-lg font-semibold">Create New Prompt</h2>
								<button onclick={cancelEdit} class="rounded-lg p-2 hover:bg-muted transition-colors">
									<X class="h-4 w-4" />
								</button>
							</div>

							<div class="space-y-4">
								<div>
									<label for="create-title" class="block text-sm font-medium mb-1">Title</label>
									<input
										id="create-title"
										type="text"
										bind:value={formTitle}
										placeholder="Enter prompt title..."
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>

								<div>
									<label for="create-content" class="block text-sm font-medium mb-1">Content</label>
									<textarea
										id="create-content"
										bind:value={formContent}
										placeholder="Enter your prompt template..."
										rows="10"
										class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
									></textarea>
									<p class="text-xs text-muted-foreground mt-1">
										Use {"{{variable}}"} syntax for dynamic placeholders
									</p>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div>
										<label for="create-category" class="block text-sm font-medium mb-1">Category</label>
										<div class="relative">
											<button
												onclick={() => (showCategoryDropdown = !showCategoryDropdown)}
												class="w-full flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											>
												<span>{formCategory || 'Select category'}</span>
												<ChevronDown class="h-4 w-4" />
											</button>
											{#if showCategoryDropdown}
												<div class="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 py-1">
													{#each ['General', 'Development', 'Writing', 'Creative', 'Analysis', 'Business'] as cat}
														<button
															onclick={() => {
																formCategory = cat;
																showCategoryDropdown = false;
															}}
															class="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors"
														>
															{cat}
														</button>
													{/each}
												</div>
											{/if}
										</div>
									</div>

									<div>
										<label for="create-tags" class="block text-sm font-medium mb-1">Tags</label>
										<input
											id="create-tags"
											type="text"
											bind:value={formTags}
											placeholder="code, review (comma separated)"
											class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
								</div>

								<div class="flex justify-end gap-3 pt-4">
									<button
										onclick={cancelEdit}
										class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
									>
										Cancel
									</button>
									<button
										onclick={savePrompt}
										disabled={!formTitle.trim() || !formContent.trim()}
										class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
									>
										Create Prompt
									</button>
								</div>
							</div>
						</div>
					</div>
				{:else if selectedPrompt}
					<!-- Detail View with Tabs -->
					<div class="h-full flex flex-col">
						<!-- Header -->
						<div class="border-b border-border p-4">
							<div class="flex items-center justify-between mb-2">
								<h2 class="text-lg font-semibold">{selectedPrompt.title}</h2>
								<div class="flex items-center gap-2">
									<button
										onclick={() => promptsStore.toggleFavorite(selectedPrompt!.id)}
										class="rounded-lg p-2 hover:bg-muted transition-colors"
									>
										<Star
											class="h-4 w-4 {selectedPrompt.isFavorite
												? 'fill-yellow-500 text-yellow-500'
												: ''}"
										/>
									</button>
									<button
										onclick={() => usePrompt(selectedPrompt!)}
										class="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
									>
										<Send class="h-4 w-4" />
										Use
									</button>
									<button
										onclick={cancelEdit}
										class="rounded-lg p-2 hover:bg-muted transition-colors"
									>
										<X class="h-4 w-4" />
									</button>
								</div>
							</div>
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<span class="px-2 py-0.5 rounded bg-muted">{selectedPrompt.category}</span>
								<span>·</span>
								<span>{selectedPrompt.usageCount} uses</span>
								<span>·</span>
								<span>Updated {formatShortDate(selectedPrompt.updatedAt)}</span>
							</div>
						</div>

						<!-- Tabs -->
						<div class="border-b border-border px-4">
							<div class="flex gap-4">
								{#each [
									{ id: 'edit', label: 'Edit', icon: Edit3 },
									{ id: 'versions', label: 'Versions', icon: History, badge: selectedPrompt.versions.length },
									{ id: 'variants', label: 'A/B Testing', icon: FlaskConical, badge: selectedPrompt.variants.length },
									{ id: 'metrics', label: 'Metrics', icon: BarChart3 }
								] as tab}
									<button
										onclick={() => (detailTab = tab.id as typeof detailTab)}
										class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm transition-colors {detailTab === tab.id
											? 'border-primary text-primary'
											: 'border-transparent text-muted-foreground hover:text-foreground'}"
									>
										<tab.icon class="h-4 w-4" />
										{tab.label}
										{#if tab.badge && tab.badge > 0}
											<span class="rounded-full bg-muted px-1.5 py-0.5 text-xs">{tab.badge}</span>
										{/if}
									</button>
								{/each}
							</div>
						</div>

						<!-- Tab Content -->
						<div class="flex-1 overflow-y-auto p-4">
							{#if detailTab === 'edit'}
								<!-- Edit Form -->
								<div class="max-w-2xl space-y-4">
									<div>
										<label for="edit-title" class="block text-sm font-medium mb-1">Title</label>
										<input
											id="edit-title"
											type="text"
											bind:value={formTitle}
											class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>

									<div>
										<label for="edit-content" class="block text-sm font-medium mb-1">Content</label>
										<textarea
											id="edit-content"
											bind:value={formContent}
											rows="12"
											class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
										></textarea>
									</div>

									<div class="grid grid-cols-2 gap-4">
										<div>
											<label for="edit-category" class="block text-sm font-medium mb-1">Category</label>
											<select
												id="edit-category"
												bind:value={formCategory}
												class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											>
												{#each ['General', 'Development', 'Writing', 'Creative', 'Analysis', 'Business'] as cat}
													<option value={cat}>{cat}</option>
												{/each}
											</select>
										</div>

										<div>
											<label for="edit-tags" class="block text-sm font-medium mb-1">Tags</label>
											<input
												id="edit-tags"
												type="text"
												bind:value={formTags}
												placeholder="comma separated"
												class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
									</div>

									<div class="flex justify-between pt-4">
										<button
											onclick={() => {
												if (confirm('Delete this prompt?')) {
													promptsStore.deletePrompt(selectedPrompt!.id);
													selectedPrompt = null;
												}
											}}
											class="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
										>
											Delete Prompt
										</button>
										<button
											onclick={savePrompt}
											disabled={!formTitle.trim() || !formContent.trim()}
											class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
										>
											Save Changes
										</button>
									</div>
								</div>
							{:else if detailTab === 'versions'}
								<!-- Version History -->
								<div class="space-y-4">
									<div class="flex items-center justify-between">
										<h3 class="font-medium">Version History</h3>
										<span class="text-sm text-muted-foreground">
											{selectedPrompt.versions.length} version{selectedPrompt.versions.length !== 1
												? 's'
												: ''}
										</span>
									</div>

									{#if previewVersion}
										<!-- Version Preview -->
										<div class="rounded-lg border border-primary bg-primary/5 p-4">
											<div class="flex items-center justify-between mb-2">
												<span class="font-medium">Previewing: {previewVersion.title}</span>
												<button
													onclick={() => (previewVersion = null)}
													class="rounded p-1 hover:bg-muted"
												>
													<X class="h-4 w-4" />
												</button>
											</div>
											<pre class="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-3">{previewVersion.content}</pre>
											<div class="flex justify-end gap-2 mt-3">
												<button
													onclick={() => (previewVersion = null)}
													class="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
												>
													Cancel
												</button>
												<button
													onclick={() => {
														const index = selectedPrompt!.versions.findIndex(
															(v) => v.id === previewVersion!.id
														);
														if (index >= 0) restoreVersion(index);
													}}
													class="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
												>
													<RotateCcw class="h-3 w-3" />
													Restore This Version
												</button>
											</div>
										</div>
									{/if}

									<div class="space-y-2">
										{#each [...selectedPrompt.versions].reverse() as version, i}
											{@const versionIndex = selectedPrompt.versions.length - 1 - i}
											<div
												class="rounded-lg border border-border p-3 {versionIndex === selectedPrompt.currentVersion
													? 'border-primary bg-primary/5'
													: ''}"
											>
												<div class="flex items-center justify-between">
													<div class="flex items-center gap-2">
														<span class="font-medium">Version {versionIndex + 1}</span>
														{#if versionIndex === selectedPrompt.currentVersion}
															<span class="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
																Current
															</span>
														{/if}
													</div>
													<div class="flex items-center gap-2">
														<span class="text-xs text-muted-foreground">
															{formatDate(version.createdAt)}
														</span>
														{#if versionIndex !== selectedPrompt.currentVersion}
															<button
																onclick={() => (previewVersion = version)}
																class="rounded p-1 hover:bg-muted"
																title="Preview"
															>
																<Eye class="h-4 w-4" />
															</button>
															<button
																onclick={() => restoreVersion(versionIndex)}
																class="rounded p-1 hover:bg-muted"
																title="Restore"
															>
																<RotateCcw class="h-4 w-4" />
															</button>
														{/if}
													</div>
												</div>
												{#if version.changeDescription}
													<p class="text-sm text-muted-foreground mt-1">{version.changeDescription}</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{:else if detailTab === 'variants'}
								<!-- A/B Testing -->
								<div class="space-y-4">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<h3 class="font-medium">A/B Testing</h3>
											<button
												onclick={() => promptsStore.toggleABTesting(selectedPrompt!.id)}
												class="relative h-6 w-11 rounded-full transition-colors {selectedPrompt.abTestingEnabled
													? 'bg-primary'
													: 'bg-muted'}"
												role="switch"
												aria-checked={selectedPrompt.abTestingEnabled}
												aria-label="A/B Testing"
											>
												<span
													class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform {selectedPrompt.abTestingEnabled
														? 'translate-x-5'
														: ''}"
												></span>
											</button>
										</div>
										<button
											onclick={() => openVariantModal()}
											class="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
										>
											<Plus class="h-4 w-4" />
											Add Variant
										</button>
									</div>

									{#if !selectedPrompt.abTestingEnabled}
										<div class="rounded-lg border border-border bg-muted/30 p-6 text-center">
											<FlaskConical class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
											<p class="text-sm text-muted-foreground">
												Enable A/B testing to compare different versions of your prompt
											</p>
										</div>
									{/if}

									<!-- Original Prompt -->
									<div class="rounded-lg border border-border p-4">
										<div class="flex items-center justify-between mb-2">
											<div class="flex items-center gap-2">
												<span class="font-medium">Original</span>
												<span class="rounded-full bg-blue-500/10 text-blue-500 px-2 py-0.5 text-xs">
													Control
												</span>
											</div>
											{#if selectedPrompt.abTestingEnabled}
												<span class="text-sm text-muted-foreground">
													{100 - selectedPrompt.variants.reduce((sum, v) => sum + v.weight, 0)}% traffic
												</span>
											{/if}
										</div>
										<pre class="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-32 overflow-y-auto">{selectedPrompt.content}</pre>
									</div>

									<!-- Variants -->
									{#each selectedPrompt.variants as variant (variant.id)}
										{@const variantMetrics = calculateVariantMetrics(variant)}
										<div class="rounded-lg border border-border p-4">
											<div class="flex items-center justify-between mb-2">
												<div class="flex items-center gap-2">
													<span class="font-medium">{variant.name}</span>
													<span class="rounded-full bg-purple-500/10 text-purple-500 px-2 py-0.5 text-xs">
														Variant
													</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="text-sm text-muted-foreground">{variant.weight}% traffic</span>
													<button
														onclick={() => openVariantModal(variant)}
														class="rounded p-1 hover:bg-muted"
													>
														<Edit3 class="h-4 w-4" />
													</button>
													<button
														onclick={() => promoteVariant(variant.id)}
														class="rounded p-1 hover:bg-muted text-green-500"
														title="Promote to main"
													>
														<Award class="h-4 w-4" />
													</button>
													<button
														onclick={() => deleteVariant(variant.id)}
														class="rounded p-1 hover:bg-muted text-red-500"
													>
														<Trash2 class="h-4 w-4" />
													</button>
												</div>
											</div>
											<pre class="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-32 overflow-y-auto">{variant.content}</pre>

											{#if variantMetrics.totalExecutions > 0}
												<div class="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
													<span>{variantMetrics.totalExecutions} executions</span>
													{#if variantMetrics.avgRating > 0}
														<span class="flex items-center gap-1">
															<Star class="h-3 w-3 text-yellow-500" />
															{variantMetrics.avgRating.toFixed(1)}
														</span>
													{/if}
													<span>{variantMetrics.successRate.toFixed(0)}% success</span>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else if detailTab === 'metrics'}
								<!-- Metrics Dashboard -->
								{@const metrics = getMetrics(selectedPrompt)}
								<div class="space-y-6">
									<!-- Summary Cards -->
									<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
										<div class="rounded-lg border border-border p-4">
											<div class="flex items-center gap-2 text-muted-foreground mb-1">
												<Zap class="h-4 w-4" />
												<span class="text-xs">Executions</span>
											</div>
											<span class="text-2xl font-bold">{metrics.totalExecutions}</span>
										</div>

										<div class="rounded-lg border border-border p-4">
											<div class="flex items-center gap-2 text-muted-foreground mb-1">
												<Star class="h-4 w-4" />
												<span class="text-xs">Avg Rating</span>
											</div>
											<span class="text-2xl font-bold">
												{metrics.avgRating > 0 ? metrics.avgRating.toFixed(1) : '-'}
											</span>
										</div>

										<div class="rounded-lg border border-border p-4">
											<div class="flex items-center gap-2 text-muted-foreground mb-1">
												<CheckCircle class="h-4 w-4" />
												<span class="text-xs">Success Rate</span>
											</div>
											<span class="text-2xl font-bold">
												{metrics.totalExecutions > 0 ? `${metrics.successRate.toFixed(0)}%` : '-'}
											</span>
										</div>

										<div class="rounded-lg border border-border p-4">
											<div class="flex items-center gap-2 text-muted-foreground mb-1">
												<Timer class="h-4 w-4" />
												<span class="text-xs">Avg Response</span>
											</div>
											<span class="text-2xl font-bold">
												{metrics.avgResponseTimeMs > 0 ? formatMs(metrics.avgResponseTimeMs) : '-'}
											</span>
										</div>
									</div>

									<!-- Token Usage -->
									<div class="rounded-lg border border-border p-4">
										<h4 class="font-medium mb-4">Token Usage</h4>
										<div class="grid grid-cols-2 gap-4">
											<div>
												<span class="text-sm text-muted-foreground">Avg Input Tokens</span>
												<p class="text-xl font-semibold">
													{metrics.avgInputTokens > 0 ? metrics.avgInputTokens.toLocaleString() : '-'}
												</p>
											</div>
											<div>
												<span class="text-sm text-muted-foreground">Avg Output Tokens</span>
												<p class="text-xl font-semibold">
													{metrics.avgOutputTokens > 0 ? metrics.avgOutputTokens.toLocaleString() : '-'}
												</p>
											</div>
										</div>
									</div>

									<!-- Recent Executions -->
									{#if selectedPrompt.executions.length > 0}
										<div class="rounded-lg border border-border p-4">
											<div class="flex items-center justify-between mb-4">
												<h4 class="font-medium">Recent Executions</h4>
												<button
													onclick={() => {
														if (confirm('Clear all execution history?')) {
															promptsStore.clearExecutionHistory(selectedPrompt!.id);
														}
													}}
													class="text-xs text-muted-foreground hover:text-foreground"
												>
													Clear History
												</button>
											</div>
											<div class="space-y-2 max-h-64 overflow-y-auto">
												{#each [...selectedPrompt.executions].reverse().slice(0, 20) as exec}
													<div class="flex items-center justify-between py-2 border-b border-border last:border-0">
														<div class="flex items-center gap-3">
															{#if exec.wasSuccessful}
																<CheckCircle class="h-4 w-4 text-green-500" />
															{:else}
																<AlertCircle class="h-4 w-4 text-red-500" />
															{/if}
															<div>
																<p class="text-sm">{exec.model}</p>
																<p class="text-xs text-muted-foreground">
																	{formatDate(exec.timestamp)}
																</p>
															</div>
														</div>
														<div class="flex items-center gap-4 text-sm text-muted-foreground">
															<span>{formatMs(exec.responseTimeMs)}</span>
															<span>{exec.inputTokens + exec.outputTokens} tokens</span>
															{#if exec.rating}
																<span class="flex items-center gap-1">
																	<Star class="h-3 w-3 text-yellow-500 fill-yellow-500" />
																	{exec.rating}
																</span>
															{/if}
														</div>
													</div>
												{/each}
											</div>
										</div>
									{:else}
										<div class="rounded-lg border border-border bg-muted/30 p-6 text-center">
											<BarChart3 class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
											<p class="text-sm text-muted-foreground">
												No execution data yet. Use this prompt to start collecting metrics.
											</p>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Empty State -->
					<div class="h-full flex items-center justify-center">
						<div class="text-center">
							<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
								<Edit3 class="h-8 w-8 text-muted-foreground" />
							</div>
							<h3 class="font-medium mb-1">Select a prompt</h3>
							<p class="text-sm text-muted-foreground">
								Choose a prompt to view or edit, or create a new one
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Variant Modal -->
{#if showVariantModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
			<div class="flex items-center justify-between border-b border-border p-4">
				<h2 class="font-semibold">{editingVariant ? 'Edit Variant' : 'Create Variant'}</h2>
				<button onclick={() => (showVariantModal = false)} class="rounded-lg p-2 hover:bg-muted">
					<X class="h-4 w-4" />
				</button>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label for="variant-name" class="block text-sm font-medium mb-1">Variant Name</label>
					<input
						id="variant-name"
						type="text"
						bind:value={variantName}
						placeholder="e.g., Shorter version, Detailed version"
						class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="variant-content" class="block text-sm font-medium mb-1">Content</label>
					<textarea
						id="variant-content"
						bind:value={variantContent}
						rows="8"
						class="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
					></textarea>
				</div>

				<div>
					<label for="variant-weight" class="block text-sm font-medium mb-1">
						Traffic Weight: {variantWeight}%
					</label>
					<input
						id="variant-weight"
						type="range"
						min="0"
						max="100"
						bind:value={variantWeight}
						class="w-full"
					/>
					<p class="text-xs text-muted-foreground mt-1">
						Percentage of traffic this variant will receive when A/B testing is enabled
					</p>
				</div>
			</div>
			<div class="flex justify-end gap-2 border-t border-border p-4">
				<button
					onclick={() => (showVariantModal = false)}
					class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					onclick={saveVariant}
					disabled={!variantName.trim() || !variantContent.trim()}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					{editingVariant ? 'Save Changes' : 'Create Variant'}
				</button>
			</div>
		</div>
	</div>
{/if}
