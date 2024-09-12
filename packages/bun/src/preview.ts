import { fileURLToPath } from 'node:url';
import type { CreatePreviewServer } from 'astro';
import { AstroError } from 'astro/errors';
import type { createExports } from './server.js';
import { createServer } from './standalone.js';

type ServerModule = ReturnType<typeof createExports>;
type MaybeServerModule = Partial<ServerModule>;

const createPreviewServer: CreatePreviewServer = async (preview) => {
	let ssrHandler: ServerModule['handler'];
	let options: ServerModule['options'];
	try {
		process.env.ASTRO_BUN_AUTOSTART = 'disabled';
		const ssrModule: MaybeServerModule = await import(preview.serverEntrypoint.toString());
		if (typeof ssrModule.handler === 'function') {
			ssrHandler = ssrModule.handler;
			if (ssrModule.options) options = ssrModule.options;
		} else {
			throw new AstroError(
				`The server entrypoint doesn't have a handler. Are you sure this is the right file?`
			);
		}
	} catch (err) {
		if ((err as any).code === 'ERR_MODULE_NOT_FOUND') {
			throw new AstroError(
				`The server entrypoint ${fileURLToPath(
					preview.serverEntrypoint
				)} does not exist. Have you ran a build yet?`
			);
		}
		throw err;
	}

	const host = preview.host ?? 'localhost';
	const port = preview.port ?? 4321;

	const server = createServer(ssrHandler, host, port);

	// If user specified custom headers append them to the response
	if (preview.headers) {
		const originalFetch = server.fetch;
		server.fetch = async (request) => {
			const response = await originalFetch(request);
			if (response.status === 200) {
				for (const [name, value] of Object.entries(preview.headers ?? {})) {
					if (value) response.headers.set(name, value.toString());
				}
			}
			return response;
		};
	}

	preview.logger.info(`Preview server listening on http://${host}:${port}`);

	return {
		host,
		port,
		server: server,
		closed() {
			return new Promise<void>((resolve) => {
				server.stop();
			});
		},
		async stop() {
			server.stop();
		},
	};
};

export { createPreviewServer as default };
