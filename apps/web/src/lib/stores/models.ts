import { writable } from 'svelte/store';

export interface Model {
	name: string;
	modified_at: string;
	size: number;
	digest: string;
	details?: {
		format: string;
		family: string;
		parameter_size: string;
		quantization_level: string;
	};
}

function createModelsStore() {
	const { subscribe, set, update } = writable<{
		models: Model[];
		loading: boolean;
		error: string | null;
	}>({
		models: [],
		loading: false,
		error: null
	});

	return {
		subscribe,

		fetchModels: async () => {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				const res = await fetch('/api/ollama/tags');
				if (!res.ok) throw new Error('Failed to fetch models');
				const data = await res.json();
				update((s) => ({ ...s, models: data.models || [], loading: false }));
			} catch (e) {
				update((s) => ({
					...s,
					loading: false,
					error: e instanceof Error ? e.message : 'Unknown error'
				}));
			}
		},

		pullModel: async (name: string, onProgress?: (progress: number) => void) => {
			const res = await fetch('/api/ollama/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (!res.ok) throw new Error('Failed to start pull');

			const reader = res.body?.getReader();
			if (!reader) throw new Error('No response body');

			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n').filter(Boolean);
				for (const line of lines) {
					try {
						const data = JSON.parse(line);
						if (data.completed && data.total && onProgress) {
							onProgress((data.completed / data.total) * 100);
						}
					} catch {
						// Ignore parse errors
					}
				}
			}
		},

		deleteModel: async (name: string) => {
			const res = await fetch('/api/ollama/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw new Error('Failed to delete model');
		}
	};
}

export const modelsStore = createModelsStore();
