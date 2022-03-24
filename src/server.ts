import type { SSRManifest } from 'astro';
import type { IncomingMessage, ServerResponse } from 'http';
import { NodeApp } from 'astro/app/node';
import { polyfill } from '@astrojs/webapi';

polyfill(globalThis, {
	exclude: 'window document'
});

export function createExports(manifest: SSRManifest) {
	const app = new NodeApp(manifest, new URL(import.meta.url));
	return {
		async handler(req: IncomingMessage, res: ServerResponse, next?: (err?: unknown) => void) {
			const route = app.match(req);

			if(route) {
				try {
					const response = await app.render(req);
					await writeWebResponse(res, response);
				} catch(err: unknown) {
					if(next) {
						next(err);
					} else {
						throw err;
					}
				}
			} else if(next) {
				return next();
			}
		}
	}
}

async function writeWebResponse(res: ServerResponse, webResponse: Response) {
	const { status, headers, body } = webResponse;
	res.writeHead(status, Object.fromEntries(headers.entries()));
	if (body) {
		const reader = body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				res.write(value);
			}
		}
	}
	res.end();
}
