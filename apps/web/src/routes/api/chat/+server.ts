import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://192.168.1.186:11434';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json();
		const { model, messages, stream = false, options = {} } = body;

		if (!model) {
			throw error(400, 'Model is required');
		}

		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Messages array is required');
		}

		const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages,
				stream,
				options
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Ollama chat error:', errorText);
			throw error(response.status, `Chat request failed: ${errorText}`);
		}

		if (stream) {
			// Return streaming response
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
		console.error('Chat API error:', e);
		if ((e as any).status) throw e;
		throw error(503, 'Chat service unavailable');
	}
};
