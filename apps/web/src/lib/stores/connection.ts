import { writable, derived } from 'svelte/store';
import { settingsStore } from './settings';

export interface ConnectionState {
	ollamaConnected: boolean;
	apiConnected: boolean;
	lastCheck: Date | null;
	error: string | null;
}

function createConnectionStore() {
	const { subscribe, set, update } = writable<ConnectionState>({
		ollamaConnected: false,
		apiConnected: false,
		lastCheck: null,
		error: null
	});

	return {
		subscribe,
		checkConnection: async () => {
			try {
				// Check backend API
				const apiRes = await fetch('/api/health');
				const apiConnected = apiRes.ok;

				// Check Ollama (through our API proxy)
				const ollamaRes = await fetch('/api/ollama/tags');
				const ollamaConnected = ollamaRes.ok;

				update((s) => ({
					...s,
					apiConnected,
					ollamaConnected,
					lastCheck: new Date(),
					error: null
				}));
			} catch (e) {
				update((s) => ({
					...s,
					apiConnected: false,
					ollamaConnected: false,
					lastCheck: new Date(),
					error: e instanceof Error ? e.message : 'Connection failed'
				}));
			}
		},
		setError: (error: string) => update((s) => ({ ...s, error }))
	};
}

export const connectionStore = createConnectionStore();

export const isConnected = derived(
	connectionStore,
	($conn) => $conn.apiConnected && $conn.ollamaConnected
);
