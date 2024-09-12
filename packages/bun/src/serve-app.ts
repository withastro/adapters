import type { App } from 'astro/app';
import type { RequestHandler } from './types.js';

export function createAppHandler(app: App): RequestHandler {
	const logger = app.getAdapterLogger();

	return async (request) => {
		const routeData = app.match(request);

		if (routeData) {
			try {
				const response = await app.render(request, { routeData });
				return response;
			} catch (err) {
				logger.error(`Could not render ${request.url}`);
				console.error(err);
				return new Response('Internal Server Error', { status: 500 });
			}
		} else {
			return new Response('Not Found', { status: 404 });
		}
	};
}
