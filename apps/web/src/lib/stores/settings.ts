import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface ProviderSettings {
	openaiApiKey: string;
	openaiBaseUrl: string;
	groqApiKey: string;
	anthropicApiKey: string;
	googleSearchApiKey: string;
	googleSearchCx: string;
	serperApiKey: string;
	youtubeApiKey: string;
}

export interface Settings {
	theme: 'light' | 'dark' | 'system';
	ollamaHost: string;
	defaultModel: string;
	streamResponses: boolean;
	fontSize: 'sm' | 'base' | 'lg';
	sendOnEnter: boolean;
	showTimestamps: boolean;
	providers: ProviderSettings;
}

const defaultProviders: ProviderSettings = {
	openaiApiKey: '',
	openaiBaseUrl: 'https://api.openai.com/v1',
	groqApiKey: '',
	anthropicApiKey: '',
	googleSearchApiKey: '',
	googleSearchCx: '',
	serperApiKey: '',
	youtubeApiKey: ''
};

const defaultSettings: Settings = {
	theme: 'dark',
	ollamaHost: 'http://localhost:11434',
	defaultModel: 'llama3.2',
	streamResponses: true,
	fontSize: 'base',
	sendOnEnter: true,
	showTimestamps: false,
	providers: defaultProviders
};

function createSettingsStore() {
	const stored = browser ? localStorage.getItem('ollama-workbench-settings') : null;
	const initial: Settings = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;

	const { subscribe, set, update } = writable<Settings>(initial);

	return {
		subscribe,
		set: (value: Settings) => {
			if (browser) {
				localStorage.setItem('ollama-workbench-settings', JSON.stringify(value));
			}
			set(value);
		},
		update: (fn: (s: Settings) => Settings) => {
			update((s) => {
				const newSettings = fn(s);
				if (browser) {
					localStorage.setItem('ollama-workbench-settings', JSON.stringify(newSettings));
				}
				return newSettings;
			});
		},
		reset: () => {
			if (browser) {
				localStorage.removeItem('ollama-workbench-settings');
			}
			set(defaultSettings);
		}
	};
}

export const settingsStore = createSettingsStore();
