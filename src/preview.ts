import type { CreatePreviewServer } from 'astro';
import http from 'http';
import { fileURLToPath } from 'url';
import { createServer } from './http-server.js';
import type { createExports } from './server';

const preview: CreatePreviewServer = async function ({
	client,
	serverEntrypoint,
	host,
	port,
	base,
}) {
	type ServerModule = ReturnType<typeof createExports>;
	type MaybeServerModule = Partial<ServerModule>;
	let ssrHandler: ServerModule['handler'];
	try {
		process.env.ASTRO_NODE_AUTOSTART = 'disabled';
		const ssrModule: MaybeServerModule = await import(serverEntrypoint.toString());
		if (typeof ssrModule.handler === 'function') {
			ssrHandler = ssrModule.handler;
		} else {
			throw new Error(
				`The server entrypoint doesn't have a handler. Are you sure this is the right file?`
			);
		}
	} catch (_err) {
		throw new Error(
			`The server entrypoint ${fileURLToPath} does not exist. Have you ran a build yet?`
		);
	}

	const handler: http.RequestListener = (req, res) => {
		ssrHandler(req, res, (ssrErr: any) => {
			if (ssrErr) {
				res.writeHead(500);
				res.end(ssrErr.toString());
			} else {
				res.writeHead(404);
				res.end();
			}
		});
	};

	const baseWithoutTrailingSlash: string = base.endsWith('/')
		? base.slice(0, base.length - 1)
		: base;
	function removeBase(pathname: string): string {
		if (pathname.startsWith(base)) {
			return pathname.slice(baseWithoutTrailingSlash.length);
		}
		return pathname;
	}

	const server = createServer(
		{
			client,
			port,
			host,
			removeBase,
		},
		handler
	);

	// eslint-disable-next-line no-console
	console.log(`Preview server listening on http://${host}:${port}`);

	return server;
};

export { preview as default };
