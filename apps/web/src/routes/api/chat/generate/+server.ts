import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://192.168.1.186:11434';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json();
		const { model, prompt, system, stream = false, options = {} } = body;

		if (!model) {
			throw error(400, 'Model is required');
		}

		if (!prompt) {
			throw error(400, 'Prompt is required');
		}

		const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				prompt,
				system,
				stream,
				options
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Ollama generate error:', errorText);
			throw error(response.status, `Generate request failed: ${errorText}`);
		}

		if (stream) {
			return new Response(response.body, {
				headers: {
					'Content-Type': 'application/x-ndjson',
					'Transfer-Encoding': 'chunked'
				}
			});
		}

		const data = await response.json();
		return json(data);
	} catch (e) {
		console.error('Generate API error:', e);
		if ((e as any).status) throw e;
		throw error(503, 'Generate service unavailable');
	}
};
