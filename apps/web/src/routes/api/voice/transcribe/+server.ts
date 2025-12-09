import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Voice transcription endpoint - integrates with voice-mode MCP or Whisper
const VOICE_MCP_HOST = process.env.VOICE_MCP_HOST || 'http://localhost:8765';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const formData = await request.formData();
		const audioFile = formData.get('audio') as File;

		if (!audioFile) {
			throw error(400, 'Audio file is required');
		}

		// Try voice-mode MCP with Whisper
		try {
			const mcpFormData = new FormData();
			mcpFormData.append('audio', audioFile);

			const response = await fetch(`${VOICE_MCP_HOST}/transcribe`, {
				method: 'POST',
				body: mcpFormData
			});

			if (response.ok) {
				const data = await response.json();
				return json({
					text: data.text || data.transcription,
					confidence: data.confidence,
					success: true
				});
			}
		} catch (mcpError) {
			console.warn('Voice MCP transcription unavailable');
		}

		// Fallback: indicate client should use browser speech recognition
		return json({
			useBrowserSTT: true,
			error: 'Server transcription unavailable, use browser speech recognition'
		});
	} catch (e) {
		console.error('Voice transcribe error:', e);
		if ((e as any).status) throw e;
		throw error(503, 'Transcription service unavailable');
	}
};
