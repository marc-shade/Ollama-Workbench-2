import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Voice synthesis endpoint - integrates with voice-mode MCP or Edge TTS
const VOICE_MCP_HOST = process.env.VOICE_MCP_HOST || 'http://localhost:8765';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const { text, voice = 'en-IE-EmilyNeural', rate = '+0%' } = await request.json();

		if (!text) {
			throw error(400, 'Text is required');
		}

		// Try voice-mode MCP first
		try {
			const response = await fetch(`${VOICE_MCP_HOST}/speak`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, voice, rate, play_audio: false })
			});

			if (response.ok) {
				const data = await response.json();
				if (data.audio_path) {
					// Return audio file URL
					return json({
						audioUrl: `/api/voice/audio?path=${encodeURIComponent(data.audio_path)}`,
						success: true
					});
				}
			}
		} catch (mcpError) {
			console.warn('Voice MCP unavailable, falling back to browser TTS');
		}

		// Fallback: indicate client should use browser TTS
		return json({
			useBrowserTTS: true,
			text,
			voice,
			rate
		});
	} catch (e) {
		console.error('Voice speak error:', e);
		if ((e as any).status) throw e;
		throw error(503, 'Voice service unavailable');
	}
};
