import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://192.168.1.186:11434';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const { name } = await request.json();

		if (!name) {
			throw error(400, 'Model name is required');
		}

		const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});

		if (!response.ok) {
			throw error(response.status, 'Failed to pull model');
		}

		const data = await response.json();
		return json(data);
	} catch (e) {
		console.error('Ollama pull error:', e);
		if ((e as any).status) throw e;
		throw error(503, 'Ollama service unavailable');
	}
};
