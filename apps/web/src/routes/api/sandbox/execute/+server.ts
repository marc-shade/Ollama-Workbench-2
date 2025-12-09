import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Code sandbox execution endpoint
// In production, this should connect to an isolated execution environment

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { code, language, timeout = 30000 } = await request.json();

		if (!code) {
			throw error(400, 'Code is required');
		}

		if (!language) {
			throw error(400, 'Language is required');
		}

		// Security: Only allow certain languages
		const allowedLanguages = ['python', 'javascript', 'typescript', 'bash'];
		if (!allowedLanguages.includes(language.toLowerCase())) {
			throw error(400, `Unsupported language: ${language}. Allowed: ${allowedLanguages.join(', ')}`);
		}

		// TODO: Connect to actual sandbox execution service
		// For now, return a mock response indicating sandbox is not configured

		// In production, you would:
		// 1. Send code to an isolated container (e.g., Docker, Firecracker)
		// 2. Execute with resource limits
		// 3. Capture stdout/stderr
		// 4. Return results

		return json({
			success: false,
			error: 'Sandbox execution not configured. Connect to an isolated execution environment.',
			suggestion: 'Configure SANDBOX_HOST environment variable to point to your execution service.',
			language,
			codeLength: code.length
		});

	} catch (e) {
		console.error('Sandbox execute error:', e);
		if ((e as any).status) throw e;
		throw error(503, 'Sandbox service unavailable');
	}
};
