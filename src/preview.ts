import { fileURLToPath } from 'node:url';
import { AstroError } from 'astro/errors';
import { logListeningOn } from './log-listening-on.js';
import { createServer } from './standalone.js';
import type { CreatePreviewServer } from 'astro';
import type { createExports } from './server.js';

type ServerModule = ReturnType<typeof createExports>;
type MaybeServerModule = Partial<ServerModule>;

const createPreviewServer: CreatePreviewServer = async function (preview) {
	let ssrHandler: ServerModule['handler'];
	let options: ServerModule['options'];
	try {
		process.env.ASTRO_NODE_AUTOSTART = 'disabled';
		const ssrModule: MaybeServerModule = await import(preview.serverEntrypoint.toString());
		if (typeof ssrModule.handler === 'function') {
			ssrHandler = ssrModule.handler;
			options = ssrModule.options!;
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
		} else {
			throw err;
		}
	}
	const host = preview.host ?? 'localhost';
	const port = preview.port ?? 4321;
	const server = createServer(ssrHandler, host, port);

	// If user specified custom headers append a listener
	// to the server to add those headers to response
	if (preview.headers) {
		server.server.addListener('request', (_, res) => {
			if (res.statusCode === 200) {
				for (const [name, value] of Object.entries(preview.headers ?? {})) {
					if (value) res.setHeader(name, value);
				}
			}
		});
	}

	logListeningOn(preview.logger, server.server, options);
	await new Promise<void>((resolve, reject) => {
		server.server.once('listening', resolve);
		server.server.once('error', reject);
		server.server.listen(port, host);
	});
	return server;
};

export { createPreviewServer as default };
