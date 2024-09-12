import type { PreviewServer } from 'astro';
import type { App } from 'astro/app';
import type { Server } from 'bun';
import { createAppHandler } from './serve-app.js';
import { createStaticHandler } from './serve-static.js';
import type { Options } from './types.js';

export const hostOptions = (host: Options['host']): string => {
	if (typeof host === 'boolean') {
		return host ? '0.0.0.0' : 'localhost';
	}
	return host ?? 'localhost';
};

export default function standalone(app: App, options: Options) {
	const port = process.env.PORT ? Number(process.env.PORT) : options.port ?? 8080;
	const host = process.env.HOST ?? hostOptions(options.host);
	const handler = createStandaloneHandler(app, options);
	const server = createServer(handler, host, port);

	app.getAdapterLogger().info(`Standalone Server running on ${server.url}`);

	if (process.env.ASTRO_BUN_LOGGING !== 'disabled') {
		app.getAdapterLogger().info(`Server running on http://${host}:${port}`);
	}

	const previewable = {
		host,
		port,
		closed() {
			// @TODO: check if server is closed
			return new Promise<void>(() => {});
		},
		stop: async (closeActiveConnections = true) => server.stop(closeActiveConnections),
	} satisfies PreviewServer;

	return {
		server,
		...previewable,
	};
}

export function createStandaloneHandler(
	app: App,
	options: Options
): (req: Request, server: Server) => Promise<Response> {
	const appHandler = createAppHandler(app);
	const staticHandler = createStaticHandler(app, options);

	return async (req: Request): Promise<Response> => {
		try {
			decodeURI(req.url);
		} catch (err) {
			console.error(err);
			return new Response('Bad Request', { status: 400 });
		}

		const staticResponse = await staticHandler(req, async () => appHandler(req));
		if (staticResponse instanceof Response) {
			return staticResponse;
		}

		return appHandler(req);
	};
}

export function createServer(
	handler: (req: Request, server: Server) => Response | Promise<Response>,
	host: string,
	port: number
): Server {
	return Bun.serve({
		...(process.env.SERVER_KEY_PATH && process.env.SERVER_CERT_PATH
			? {
					cert: Bun.file(process.env.SERVER_KEY_PATH),
					key: Bun.file(process.env.SERVER_CERT_PATH),
				}
			: {}),
		port: port,
		hostname: host,
		fetch: (req, server) => handler(req, server),
	});
}
