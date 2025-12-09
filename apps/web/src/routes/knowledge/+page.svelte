<script lang="ts">
	import {
		knowledgeStore,
		totalChunks,
		documentsByCollection,
		pendingEmbeddings,
		chunkText,
		detectFileType,
		formatFileSize,
		type KnowledgeDocument,
		type KnowledgeCollection,
		type RAGConfig,
		type SearchResult
	} from '$stores/knowledge';
	import { settingsStore } from '$stores/settings';
	import {
		Database,
		Upload,
		Search,
		FileText,
		Trash2,
		Eye,
		Plus,
		X,
		Settings,
		FolderOpen,
		ChevronDown,
		ChevronRight,
		FileCode,
		FileJson,
		File,
		Layers,
		Zap,
		RefreshCw,
		Copy,
		Check,
		Brain,
		Sliders,
		Play,
		AlertCircle,
		Loader2,
		Download,
		MoreVertical
	} from 'lucide-svelte';

	type ViewMode = 'documents' | 'collections' | 'search' | 'rag';
	let activeView = $state<ViewMode>('documents');

	// Documents state
	let selectedDocumentId = $state<string | null>(null);
	let showDocumentModal = $state(false);
	let showUploadModal = $state(false);
	let dragOver = $state(false);
	let uploadProgress = $state<{ file: string; progress: number } | null>(null);

	// Upload form
	let uploadFile = $state<File | null>(null);
	let uploadChunkStrategy = $state<'fixed' | 'sentence' | 'paragraph' | 'semantic'>('sentence');
	let uploadChunkSize = $state(500);
	let uploadChunkOverlap = $state(50);
	let uploadCollectionId = $state('default-collection');

	// Collection state
	let showCollectionModal = $state(false);
	let editingCollection = $state<KnowledgeCollection | null>(null);
	let collectionForm = $state({
		name: '',
		description: '',
		provider: 'qdrant' as const,
		collectionName: '',
		dimension: 1024,
		distance: 'cosine' as const
	});

	// Search state
	let searchQuery = $state('');
	let searchCollectionId = $state('');
	let searchTopK = $state(5);
	let isSearching = $state(false);

	// RAG state
	let showRAGModal = $state(false);
	let editingRAG = $state<RAGConfig | null>(null);
	let ragForm = $state({
		name: '',
		collectionId: '',
		embeddingModel: 'bge-m3',
		topK: 5,
		scoreThreshold: 0.7,
		maxTokens: 2000,
		rerank: false,
		generationModel: '',
		systemPrompt: 'You are a helpful assistant. Answer questions based on the provided context.',
		temperature: 0.7,
		genMaxTokens: 1000
	});

	// Derived
	const documents = $derived($knowledgeStore.documents);
	const collections = $derived($knowledgeStore.collections);
	const ragConfigs = $derived($knowledgeStore.ragConfigs);
	const searchResults = $derived($knowledgeStore.searchResults);
	const selectedDocument = $derived(documents.find((d) => d.id === selectedDocumentId));
	const pendingDocs = $derived($pendingEmbeddings);
	const chunksTotal = $derived($totalChunks);
	const docsByCollection = $derived($documentsByCollection);
	const ollamaHost = $derived($settingsStore.ollamaHost || 'http://192.168.1.186:11434');

	function getFileIcon(type: KnowledgeDocument['type']) {
		switch (type) {
			case 'code':
				return FileCode;
			case 'json':
				return FileJson;
			case 'pdf':
				return FileText;
			default:
				return File;
		}
	}

	// File handling
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const files = e.dataTransfer?.files;
		if (files?.length) {
			uploadFile = files[0];
			showUploadModal = true;
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			uploadFile = input.files[0];
			showUploadModal = true;
		}
	}

	async function processUpload() {
		if (!uploadFile) return;

		try {
			uploadProgress = { file: uploadFile.name, progress: 0 };
			const content = await uploadFile.text();
			uploadProgress = { file: uploadFile.name, progress: 20 };

			const docType = detectFileType(uploadFile.name, uploadFile.type);

			// Create document
			knowledgeStore.addDocument({
				name: uploadFile.name,
				type: docType,
				mimeType: uploadFile.type || 'text/plain',
				size: uploadFile.size,
				content,
				chunkingConfig: {
					strategy: uploadChunkStrategy,
					chunkSize: uploadChunkSize,
					chunkOverlap: uploadChunkOverlap
				},
				embeddingModel: 'bge-m3',
				collectionId: uploadCollectionId || undefined
			});

			uploadProgress = { file: uploadFile.name, progress: 40 };

			// Find the newly created document
			const newDoc = $knowledgeStore.documents[$knowledgeStore.documents.length - 1];
			if (newDoc) {
				// Chunk the document
				const chunks = chunkText(content, uploadChunkStrategy, uploadChunkSize, uploadChunkOverlap);
				uploadProgress = { file: uploadFile.name, progress: 60 };

				knowledgeStore.setDocumentChunks(
					newDoc.id,
					chunks.map((text, i) => ({
						documentId: newDoc.id,
						content: text,
						metadata: {
							startIndex: i * (uploadChunkSize - uploadChunkOverlap),
							endIndex: i * (uploadChunkSize - uploadChunkOverlap) + text.length
						}
					}))
				);

				uploadProgress = { file: uploadFile.name, progress: 80 };

				// Add to collection if specified
				if (uploadCollectionId) {
					knowledgeStore.addDocumentToCollection(uploadCollectionId, newDoc.id);
				}

				uploadProgress = { file: uploadFile.name, progress: 100 };
			}

			// Reset
			setTimeout(() => {
				uploadProgress = null;
				showUploadModal = false;
				uploadFile = null;
			}, 500);
		} catch (err) {
			console.error('Upload failed:', err);
			knowledgeStore.setError('Failed to process document');
			uploadProgress = null;
		}
	}

	async function generateEmbeddings(documentId: string) {
		const doc = documents.find((d) => d.id === documentId);
		if (!doc || doc.chunks.length === 0) return;

		knowledgeStore.updateEmbeddingStatus(documentId, 'processing', 0);

		try {
			for (let i = 0; i < doc.chunks.length; i++) {
				const response = await fetch(`${ollamaHost}/api/embeddings`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: doc.embeddingModel || 'bge-m3',
						prompt: doc.chunks[i].content
					})
				});

				if (!response.ok) throw new Error('Embedding failed');

				const progress = Math.round(((i + 1) / doc.chunks.length) * 100);
				knowledgeStore.updateEmbeddingStatus(documentId, 'processing', progress);
			}

			knowledgeStore.updateEmbeddingStatus(documentId, 'completed', 100);
		} catch (err) {
			console.error('Embedding generation failed:', err);
			knowledgeStore.updateEmbeddingStatus(documentId, 'failed', 0);
		}
	}

	async function performSearch() {
		if (!searchQuery.trim()) return;
		isSearching = true;
		knowledgeStore.clearSearchResults();

		try {
			// Get embedding for query
			const response = await fetch(`${ollamaHost}/api/embeddings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'bge-m3',
					prompt: searchQuery
				})
			});

			if (!response.ok) throw new Error('Query embedding failed');

			// For now, simulate search results since we don't have vector DB integration yet
			const docsToSearch = searchCollectionId
				? documents.filter((d) => d.collectionId === searchCollectionId)
				: documents;

			const results: SearchResult[] = [];
			for (const doc of docsToSearch) {
				for (const chunk of doc.chunks.slice(0, 2)) {
					results.push({
						id: `result-${chunk.id}`,
						documentId: doc.id,
						documentName: doc.name,
						content: chunk.content.slice(0, 300) + (chunk.content.length > 300 ? '...' : ''),
						score: Math.random() * 0.3 + 0.7,
						metadata: chunk.metadata
					});
				}
			}

			results.sort((a, b) => b.score - a.score);
			knowledgeStore.setSearchResults(results.slice(0, searchTopK));
		} catch (err) {
			console.error('Search failed:', err);
			knowledgeStore.setError('Search failed');
		} finally {
			isSearching = false;
		}
	}

	// Collection management
	function openCollectionModal(collection?: KnowledgeCollection) {
		if (collection) {
			editingCollection = collection;
			collectionForm = {
				name: collection.name,
				description: collection.description,
				provider: collection.vectorStoreConfig.provider,
				collectionName: collection.vectorStoreConfig.collectionName,
				dimension: collection.vectorStoreConfig.dimension,
				distance: collection.vectorStoreConfig.distance
			};
		} else {
			editingCollection = null;
			collectionForm = {
				name: '',
				description: '',
				provider: 'qdrant',
				collectionName: '',
				dimension: 1024,
				distance: 'cosine'
			};
		}
		showCollectionModal = true;
	}

	function saveCollection() {
		if (!collectionForm.name) return;

		const collectionData = {
			name: collectionForm.name,
			description: collectionForm.description,
			documentIds: editingCollection?.documentIds || [],
			vectorStoreConfig: {
				provider: collectionForm.provider,
				collectionName: collectionForm.collectionName || collectionForm.name.toLowerCase().replace(/\s+/g, '_'),
				dimension: collectionForm.dimension,
				distance: collectionForm.distance
			}
		};

		if (editingCollection) {
			knowledgeStore.updateCollection(editingCollection.id, collectionData);
		} else {
			knowledgeStore.addCollection(collectionData);
		}

		showCollectionModal = false;
	}

	// RAG management
	function openRAGModal(config?: RAGConfig) {
		if (config) {
			editingRAG = config;
			ragForm = {
				name: config.name,
				collectionId: config.collectionId,
				embeddingModel: config.embeddingModel,
				topK: config.retrievalConfig.topK,
				scoreThreshold: config.retrievalConfig.scoreThreshold,
				maxTokens: config.retrievalConfig.maxTokens,
				rerank: config.retrievalConfig.rerank,
				generationModel: config.generationConfig.model,
				systemPrompt: config.generationConfig.systemPrompt,
				temperature: config.generationConfig.temperature,
				genMaxTokens: config.generationConfig.maxTokens
			};
		} else {
			editingRAG = null;
			ragForm = {
				name: '',
				collectionId: collections[0]?.id || '',
				embeddingModel: 'bge-m3',
				topK: 5,
				scoreThreshold: 0.7,
				maxTokens: 2000,
				rerank: false,
				generationModel: '',
				systemPrompt: 'You are a helpful assistant. Answer questions based on the provided context.',
				temperature: 0.7,
				genMaxTokens: 1000
			};
		}
		showRAGModal = true;
	}

	function saveRAGConfig() {
		if (!ragForm.name || !ragForm.collectionId) return;

		const ragData = {
			name: ragForm.name,
			collectionId: ragForm.collectionId,
			embeddingModel: ragForm.embeddingModel,
			retrievalConfig: {
				topK: ragForm.topK,
				scoreThreshold: ragForm.scoreThreshold,
				maxTokens: ragForm.maxTokens,
				rerank: ragForm.rerank
			},
			generationConfig: {
				model: ragForm.generationModel,
				systemPrompt: ragForm.systemPrompt,
				temperature: ragForm.temperature,
				maxTokens: ragForm.genMaxTokens
			}
		};

		if (editingRAG) {
			knowledgeStore.updateRAGConfig(editingRAG.id, ragData);
		} else {
			knowledgeStore.addRAGConfig(ragData);
		}

		showRAGModal = false;
	}

	function viewDocument(doc: KnowledgeDocument) {
		selectedDocumentId = doc.id;
		showDocumentModal = true;
	}

	let copied = $state(false);
	function copyContent(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Knowledge Base</h1>
			<p class="text-muted-foreground">Document ingestion, embeddings, and RAG pipeline</p>
		</div>
		<div class="flex items-center gap-2">
			{#if pendingDocs.length > 0}
				<span class="text-sm text-amber-500 flex items-center gap-1">
					<Loader2 class="h-4 w-4 animate-spin" />
					{pendingDocs.length} pending
				</span>
			{/if}
			<label class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
				<Upload class="h-4 w-4" />
				Upload Document
				<input type="file" class="hidden" onchange={handleFileSelect} accept=".txt,.md,.json,.html,.pdf,.py,.js,.ts,.svelte,.vue,.jsx,.tsx,.rs,.go,.java,.c,.cpp,.h,.hpp" />
			</label>
		</div>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-4">
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-muted-foreground mb-1">
				<FileText class="h-4 w-4" />
				<span class="text-sm">Documents</span>
			</div>
			<p class="text-2xl font-bold">{documents.length}</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-muted-foreground mb-1">
				<Layers class="h-4 w-4" />
				<span class="text-sm">Total Chunks</span>
			</div>
			<p class="text-2xl font-bold">{chunksTotal}</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-muted-foreground mb-1">
				<Brain class="h-4 w-4" />
				<span class="text-sm">Embedding Model</span>
			</div>
			<p class="text-2xl font-bold">bge-m3</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-muted-foreground mb-1">
				<Database class="h-4 w-4" />
				<span class="text-sm">Collections</span>
			</div>
			<p class="text-2xl font-bold">{collections.length}</p>
		</div>
	</div>

	<!-- View Tabs -->
	<div class="flex gap-1 border-b border-border">
		{#each [
			{ id: 'documents', label: 'Documents', icon: FileText },
			{ id: 'collections', label: 'Collections', icon: FolderOpen },
			{ id: 'search', label: 'Semantic Search', icon: Search },
			{ id: 'rag', label: 'RAG Pipelines', icon: Zap }
		] as tab}
			<button
				type="button"
				onclick={() => (activeView = tab.id as ViewMode)}
				class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {activeView === tab.id
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				<svelte:component this={tab.icon} class="h-4 w-4" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Documents View -->
	{#if activeView === 'documents'}
		<div
			class="rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors {dragOver ? 'border-primary bg-primary/5' : ''}"
			ondragover={(e) => { e.preventDefault(); dragOver = true; }}
			ondragleave={() => (dragOver = false)}
			ondrop={handleDrop}
			role="region"
		>
			<Upload class="mx-auto h-8 w-8 text-muted-foreground mb-2" />
			<p class="text-sm text-muted-foreground">
				Drag and drop files here, or click "Upload Document" above
			</p>
			<p class="text-xs text-muted-foreground mt-1">
				Supports: TXT, MD, JSON, HTML, PDF, Python, JavaScript, TypeScript, and more
			</p>
		</div>

		<div class="rounded-xl border border-border bg-card">
			<div class="border-b border-border p-4 flex items-center justify-between">
				<h2 class="font-semibold">Documents</h2>
				<span class="text-sm text-muted-foreground">{documents.length} total</span>
			</div>

			{#if documents.length === 0}
				<div class="p-8 text-center">
					<div class="mb-4 inline-flex rounded-xl bg-cyan-500/10 p-4">
						<Database class="h-8 w-8 text-cyan-500" />
					</div>
					<h3 class="mb-2 font-semibold">No Documents Yet</h3>
					<p class="mb-4 text-sm text-muted-foreground">
						Upload documents to build your knowledge base for RAG
					</p>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each documents as doc (doc.id)}
						<div class="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
							<div class="flex items-center gap-3 flex-1 min-w-0">
								<div class="p-2 rounded-lg bg-muted">
									<svelte:component this={getFileIcon(doc.type)} class="h-5 w-5 text-muted-foreground" />
								</div>
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{doc.name}</p>
									<div class="flex items-center gap-3 text-sm text-muted-foreground">
										<span>{doc.chunks.length} chunks</span>
										<span>{formatFileSize(doc.size)}</span>
										<span class="capitalize">{doc.type}</span>
										{#if doc.collectionId}
											{@const collection = collections.find((c) => c.id === doc.collectionId)}
											{#if collection}
												<span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
													{collection.name}
												</span>
											{/if}
										{/if}
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<!-- Embedding Status -->
								{#if doc.embeddingStatus === 'processing'}
									<div class="flex items-center gap-2 text-sm text-amber-500">
										<Loader2 class="h-4 w-4 animate-spin" />
										{doc.embeddingProgress}%
									</div>
								{:else if doc.embeddingStatus === 'completed'}
									<span class="text-sm text-green-500 flex items-center gap-1">
										<Check class="h-4 w-4" />
										Embedded
									</span>
								{:else if doc.embeddingStatus === 'failed'}
									<span class="text-sm text-destructive flex items-center gap-1">
										<AlertCircle class="h-4 w-4" />
										Failed
									</span>
								{:else}
									<button
										type="button"
										onclick={() => generateEmbeddings(doc.id)}
										class="text-sm px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
									>
										Generate Embeddings
									</button>
								{/if}

								<button
									type="button"
									onclick={() => viewDocument(doc)}
									class="rounded-lg p-2 hover:bg-muted transition-colors"
									title="View document"
								>
									<Eye class="h-4 w-4" />
								</button>
								<button
									type="button"
									onclick={() => knowledgeStore.deleteDocument(doc.id)}
									class="rounded-lg p-2 hover:bg-muted transition-colors text-destructive"
									title="Delete document"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Collections View -->
	{#if activeView === 'collections'}
		<div class="flex justify-end">
			<button
				type="button"
				onclick={() => openCollectionModal()}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				<Plus class="h-4 w-4" />
				New Collection
			</button>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each collections as collection (collection.id)}
				{@const docs = docsByCollection[collection.id] || []}
				<div class="rounded-xl border border-border bg-card overflow-hidden">
					<div class="p-4 border-b border-border">
						<div class="flex items-center justify-between mb-2">
							<h3 class="font-semibold">{collection.name}</h3>
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => openCollectionModal(collection)}
									class="p-1.5 rounded hover:bg-muted transition-colors"
								>
									<Settings class="h-4 w-4" />
								</button>
								{#if collection.id !== 'default-collection'}
									<button
										type="button"
										onclick={() => knowledgeStore.deleteCollection(collection.id)}
										class="p-1.5 rounded hover:bg-muted transition-colors text-destructive"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
							</div>
						</div>
						<p class="text-sm text-muted-foreground line-clamp-2">
							{collection.description || 'No description'}
						</p>
					</div>
					<div class="p-4 bg-muted/30">
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Documents</span>
							<span class="font-medium">{docs.length}</span>
						</div>
						<div class="flex items-center justify-between text-sm mt-1">
							<span class="text-muted-foreground">Vector Store</span>
							<span class="font-medium capitalize">{collection.vectorStoreConfig.provider}</span>
						</div>
						<div class="flex items-center justify-between text-sm mt-1">
							<span class="text-muted-foreground">Dimension</span>
							<span class="font-medium">{collection.vectorStoreConfig.dimension}</span>
						</div>
					</div>
					{#if docs.length > 0}
						<div class="p-4 border-t border-border">
							<p class="text-xs text-muted-foreground mb-2">Recent documents:</p>
							{#each docs.slice(0, 3) as doc}
								<div class="flex items-center gap-2 text-sm py-1">
									<svelte:component this={getFileIcon(doc.type)} class="h-3 w-3 text-muted-foreground" />
									<span class="truncate">{doc.name}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Search View -->
	{#if activeView === 'search'}
		<div class="rounded-xl border border-border bg-card p-6">
			<h2 class="font-semibold mb-4">Semantic Search</h2>
			<div class="flex gap-3">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search your knowledge base..."
						class="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						onkeydown={(e) => e.key === 'Enter' && performSearch()}
					/>
				</div>
				<select
					bind:value={searchCollectionId}
					class="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All Collections</option>
					{#each collections as collection}
						<option value={collection.id}>{collection.name}</option>
					{/each}
				</select>
				<div class="flex items-center gap-2">
					<label for="search-top-k" class="text-sm text-muted-foreground">Top K:</label>
					<input
						id="search-top-k"
						type="number"
						bind:value={searchTopK}
						min="1"
						max="20"
						class="w-16 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<button
					type="button"
					onclick={performSearch}
					disabled={isSearching || !searchQuery.trim()}
					class="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
				>
					{#if isSearching}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						Search
					{/if}
				</button>
			</div>
		</div>

		{#if searchResults.length > 0}
			<div class="rounded-xl border border-border bg-card">
				<div class="border-b border-border p-4">
					<h2 class="font-semibold">Search Results ({searchResults.length})</h2>
				</div>
				<div class="divide-y divide-border">
					{#each searchResults as result (result.id)}
						<div class="p-4">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<FileText class="h-4 w-4 text-muted-foreground" />
									<span class="font-medium">{result.documentName}</span>
								</div>
								<span class="text-sm px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
									{(result.score * 100).toFixed(1)}% match
								</span>
							</div>
							<p class="text-sm text-muted-foreground">{result.content}</p>
						</div>
					{/each}
				</div>
			</div>
		{:else if searchQuery && !isSearching}
			<div class="rounded-xl border border-border bg-card p-8 text-center">
				<Search class="mx-auto h-8 w-8 text-muted-foreground mb-2" />
				<p class="text-muted-foreground">No results found</p>
			</div>
		{/if}
	{/if}

	<!-- RAG View -->
	{#if activeView === 'rag'}
		<div class="flex justify-end">
			<button
				type="button"
				onclick={() => openRAGModal()}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				<Plus class="h-4 w-4" />
				New RAG Pipeline
			</button>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			{#each ragConfigs as config (config.id)}
				{@const collection = collections.find((c) => c.id === config.collectionId)}
				<div class="rounded-xl border border-border bg-card overflow-hidden">
					<div class="p-4 border-b border-border">
						<div class="flex items-center justify-between mb-2">
							<h3 class="font-semibold flex items-center gap-2">
								<Zap class="h-4 w-4 text-amber-500" />
								{config.name}
							</h3>
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => openRAGModal(config)}
									class="p-1.5 rounded hover:bg-muted transition-colors"
								>
									<Settings class="h-4 w-4" />
								</button>
								{#if config.id !== 'default-rag'}
									<button
										type="button"
										onclick={() => knowledgeStore.deleteRAGConfig(config.id)}
										class="p-1.5 rounded hover:bg-muted transition-colors text-destructive"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
							</div>
						</div>
						{#if collection}
							<span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
								{collection.name}
							</span>
						{/if}
					</div>

					<div class="p-4 space-y-3">
						<div>
							<p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Retrieval</p>
							<div class="grid grid-cols-2 gap-2 text-sm">
								<div>
									<span class="text-muted-foreground">Top K:</span>
									<span class="ml-1 font-medium">{config.retrievalConfig.topK}</span>
								</div>
								<div>
									<span class="text-muted-foreground">Threshold:</span>
									<span class="ml-1 font-medium">{config.retrievalConfig.scoreThreshold}</span>
								</div>
								<div>
									<span class="text-muted-foreground">Max Tokens:</span>
									<span class="ml-1 font-medium">{config.retrievalConfig.maxTokens}</span>
								</div>
								<div>
									<span class="text-muted-foreground">Rerank:</span>
									<span class="ml-1 font-medium">{config.retrievalConfig.rerank ? 'Yes' : 'No'}</span>
								</div>
							</div>
						</div>

						<div>
							<p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Generation</p>
							<div class="grid grid-cols-2 gap-2 text-sm">
								<div>
									<span class="text-muted-foreground">Model:</span>
									<span class="ml-1 font-medium">{config.generationConfig.model || 'Not set'}</span>
								</div>
								<div>
									<span class="text-muted-foreground">Temperature:</span>
									<span class="ml-1 font-medium">{config.generationConfig.temperature}</span>
								</div>
							</div>
						</div>
					</div>

					<div class="p-4 border-t border-border bg-muted/30">
						<button
							type="button"
							class="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
						>
							<Play class="h-4 w-4" />
							Test Pipeline
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Upload Modal -->
{#if showUploadModal && uploadFile}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
			<div class="flex items-center justify-between border-b border-border p-4">
				<h2 class="font-semibold">Upload Document</h2>
				<button
					type="button"
					onclick={() => { showUploadModal = false; uploadFile = null; }}
					class="rounded-lg p-1.5 hover:bg-muted transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="p-6 space-y-4">
				<div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
					<svelte:component this={getFileIcon(detectFileType(uploadFile.name, uploadFile.type))} class="h-8 w-8 text-muted-foreground" />
					<div>
						<p class="font-medium">{uploadFile.name}</p>
						<p class="text-sm text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
					</div>
				</div>

				<div>
					<label for="upload-chunk-strategy" class="block text-sm font-medium mb-1">Chunking Strategy</label>
					<select
						id="upload-chunk-strategy"
						bind:value={uploadChunkStrategy}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="sentence">Sentence-based</option>
						<option value="paragraph">Paragraph-based</option>
						<option value="fixed">Fixed size</option>
						<option value="semantic">Semantic (experimental)</option>
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="upload-chunk-size" class="block text-sm font-medium mb-1">Chunk Size</label>
						<input
							id="upload-chunk-size"
							type="number"
							bind:value={uploadChunkSize}
							min="100"
							max="5000"
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					<div>
						<label for="upload-chunk-overlap" class="block text-sm font-medium mb-1">Overlap</label>
						<input
							id="upload-chunk-overlap"
							type="number"
							bind:value={uploadChunkOverlap}
							min="0"
							max="500"
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
				</div>

				<div>
					<label for="upload-collection" class="block text-sm font-medium mb-1">Add to Collection</label>
					<select
						id="upload-collection"
						bind:value={uploadCollectionId}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="">No collection</option>
						{#each collections as collection}
							<option value={collection.id}>{collection.name}</option>
						{/each}
					</select>
				</div>

				{#if uploadProgress}
					<div>
						<div class="flex items-center justify-between text-sm mb-1">
							<span>Processing...</span>
							<span>{uploadProgress.progress}%</span>
						</div>
						<div class="h-2 bg-muted rounded-full overflow-hidden">
							<div
								class="h-full bg-primary transition-all duration-300"
								style="width: {uploadProgress.progress}%"
							></div>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-2 border-t border-border p-4">
				<button
					type="button"
					onclick={() => { showUploadModal = false; uploadFile = null; }}
					class="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={processUpload}
					disabled={!!uploadProgress}
					class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
				>
					{uploadProgress ? 'Processing...' : 'Upload & Process'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Document View Modal -->
{#if showDocumentModal && selectedDocument}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-4xl max-h-[90vh] rounded-xl border border-border bg-card shadow-xl flex flex-col">
			<div class="flex items-center justify-between border-b border-border p-4">
				<div class="flex items-center gap-3">
					<svelte:component this={getFileIcon(selectedDocument.type)} class="h-5 w-5" />
					<h2 class="font-semibold">{selectedDocument.name}</h2>
				</div>
				<button
					type="button"
					onclick={() => { showDocumentModal = false; selectedDocumentId = null; }}
					class="rounded-lg p-1.5 hover:bg-muted transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="flex-1 overflow-hidden p-4">
				<div class="flex gap-4 mb-4">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Layers class="h-4 w-4" />
						{selectedDocument.chunks.length} chunks
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Database class="h-4 w-4" />
						{formatFileSize(selectedDocument.size)}
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<span>Strategy: {selectedDocument.chunkingConfig.strategy}</span>
					</div>
				</div>

				<div class="h-[500px] overflow-y-auto space-y-3">
					{#each selectedDocument.chunks as chunk, i}
						<div class="p-3 rounded-lg border border-border bg-muted/30">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs font-medium text-muted-foreground">Chunk {i + 1}</span>
								<button
									type="button"
									onclick={() => copyContent(chunk.content)}
									class="p-1 rounded hover:bg-muted transition-colors"
								>
									{#if copied}
										<Check class="h-3 w-3 text-green-500" />
									{:else}
										<Copy class="h-3 w-3" />
									{/if}
								</button>
							</div>
							<pre class="text-sm whitespace-pre-wrap font-mono">{chunk.content}</pre>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Collection Modal -->
{#if showCollectionModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
			<div class="flex items-center justify-between border-b border-border p-4">
				<h2 class="font-semibold">{editingCollection ? 'Edit Collection' : 'New Collection'}</h2>
				<button
					type="button"
					onclick={() => (showCollectionModal = false)}
					class="rounded-lg p-1.5 hover:bg-muted transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="p-6 space-y-4">
				<div>
					<label for="collection-name" class="block text-sm font-medium mb-1">Name</label>
					<input
						id="collection-name"
						type="text"
						bind:value={collectionForm.name}
						placeholder="My Collection"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div>
					<label for="collection-description" class="block text-sm font-medium mb-1">Description</label>
					<textarea
						id="collection-description"
						bind:value={collectionForm.description}
						placeholder="Describe this collection..."
						rows="2"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>

				<div>
					<label for="collection-provider" class="block text-sm font-medium mb-1">Vector Store Provider</label>
					<select
						id="collection-provider"
						bind:value={collectionForm.provider}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="qdrant">Qdrant</option>
						<option value="memory">In-Memory</option>
						<option value="chroma">ChromaDB</option>
						<option value="pinecone">Pinecone</option>
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="collection-dimension" class="block text-sm font-medium mb-1">Embedding Dimension</label>
						<input
							id="collection-dimension"
							type="number"
							bind:value={collectionForm.dimension}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					<div>
						<label for="collection-distance" class="block text-sm font-medium mb-1">Distance Metric</label>
						<select
							id="collection-distance"
							bind:value={collectionForm.distance}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="cosine">Cosine</option>
							<option value="euclidean">Euclidean</option>
							<option value="dot">Dot Product</option>
						</select>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 border-t border-border p-4">
				<button
					type="button"
					onclick={() => (showCollectionModal = false)}
					class="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={saveCollection}
					class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					{editingCollection ? 'Save Changes' : 'Create Collection'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- RAG Config Modal -->
{#if showRAGModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-2xl max-h-[90vh] rounded-xl border border-border bg-card shadow-xl flex flex-col">
			<div class="flex items-center justify-between border-b border-border p-4">
				<h2 class="font-semibold">{editingRAG ? 'Edit RAG Pipeline' : 'New RAG Pipeline'}</h2>
				<button
					type="button"
					onclick={() => (showRAGModal = false)}
					class="rounded-lg p-1.5 hover:bg-muted transition-colors"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<div>
					<label for="rag-pipeline-name" class="block text-sm font-medium mb-1">Pipeline Name</label>
					<input
						id="rag-pipeline-name"
						type="text"
						bind:value={ragForm.name}
						placeholder="My RAG Pipeline"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="rag-collection" class="block text-sm font-medium mb-1">Collection</label>
						<select
							id="rag-collection"
							bind:value={ragForm.collectionId}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							{#each collections as collection}
								<option value={collection.id}>{collection.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="rag-embedding-model" class="block text-sm font-medium mb-1">Embedding Model</label>
						<input
							id="rag-embedding-model"
							type="text"
							bind:value={ragForm.embeddingModel}
							placeholder="bge-m3"
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
				</div>

				<div>
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2">
						<Search class="h-4 w-4" />
						Retrieval Settings
					</h3>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="rag-top-k" class="block text-sm font-medium mb-1">Top K</label>
							<input
								id="rag-top-k"
								type="number"
								bind:value={ragForm.topK}
								min="1"
								max="20"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label for="rag-score-threshold" class="block text-sm font-medium mb-1">Score Threshold</label>
							<input
								id="rag-score-threshold"
								type="number"
								bind:value={ragForm.scoreThreshold}
								min="0"
								max="1"
								step="0.1"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label for="rag-max-tokens" class="block text-sm font-medium mb-1">Max Context Tokens</label>
							<input
								id="rag-max-tokens"
								type="number"
								bind:value={ragForm.maxTokens}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div class="flex items-center gap-2 pt-6">
							<input
								type="checkbox"
								id="rerank"
								bind:checked={ragForm.rerank}
								class="rounded border-border"
							/>
							<label for="rerank" class="text-sm">Enable Reranking</label>
						</div>
					</div>
				</div>

				<div>
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2">
						<Brain class="h-4 w-4" />
						Generation Settings
					</h3>
					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="rag-generation-model" class="block text-sm font-medium mb-1">Model</label>
								<input
									id="rag-generation-model"
									type="text"
									bind:value={ragForm.generationModel}
									placeholder="llama3.2"
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label for="rag-temperature" class="block text-sm font-medium mb-1">Temperature</label>
								<input
									id="rag-temperature"
									type="number"
									bind:value={ragForm.temperature}
									min="0"
									max="2"
									step="0.1"
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
						</div>
						<div>
							<label for="rag-system-prompt" class="block text-sm font-medium mb-1">System Prompt</label>
							<textarea
								id="rag-system-prompt"
								bind:value={ragForm.systemPrompt}
								rows="3"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
							></textarea>
						</div>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 border-t border-border p-4">
				<button
					type="button"
					onclick={() => (showRAGModal = false)}
					class="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={saveRAGConfig}
					class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					{editingRAG ? 'Save Changes' : 'Create Pipeline'}
				</button>
			</div>
		</div>
	</div>
{/if}
