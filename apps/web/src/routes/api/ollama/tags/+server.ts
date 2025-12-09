import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://192.168.1.186:11434';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const response = await fetch(`${OLLAMA_HOST}/api/tags`);

		if (!response.ok) {
			throw error(response.status, 'Failed to fetch models from Ollama');
		}

		const data = await response.json();
		return json(data);
	} catch (e) {
		console.error('Ollama tags error:', e);
		throw error(503, 'Ollama service unavailable');
	}
};
