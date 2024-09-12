import type { App } from 'astro/app';
import { createAppHandler } from './serve-app.js';
import type { RequestHandler } from './types.js';

export default function createMiddleware(app: App): RequestHandler {
	const handler = createAppHandler(app);
	const logger = app.getAdapterLogger();

	return async (req: Request) => {
		try {
			const response = await handler(req);
			return response;
		} catch (err) {
			logger.error(`Could not render ${req.url}`);
			console.error(err);
			return new Response('Internal Server Error', { status: 500 });
		}
	};
}
