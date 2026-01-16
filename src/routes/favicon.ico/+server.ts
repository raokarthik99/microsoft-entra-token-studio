import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};

export const HEAD: RequestHandler = GET;
