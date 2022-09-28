import { polyfill } from '@astrojs/webapi';
import type { SSRManifest } from 'astro';
import { NodeApp } from 'astro/app/node';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Readable } from 'stream';

polyfill(globalThis, {
	exclude: 'window document',
});

export function createExports(manifest: SSRManifest) {
	const app = new NodeApp(manifest);
	return {
		async handler(req: IncomingMessage, res: ServerResponse, next?: (err?: unknown) => void) {
			try {
				const route = app.match(req);

				if (route) {
					try {
						const response = await app.render(req);
						await writeWebResponse(app, res, response);
					} catch (err: unknown) {
						if (next) {
							next(err);
						} else {
							throw err;
						}
					}
				} else if (next) {
					return next();
				}
			} catch (err: unknown) {
				if (!res.headersSent) {
					res.writeHead(500, `Server error`);
					res.end();
				}
			}
		},
	};
}

async function writeWebResponse(app: NodeApp, res: ServerResponse, webResponse: Response) {
	const { status, headers, body } = webResponse;

	if (app.setCookieHeaders) {
		const setCookieHeaders: Array<string> = Array.from(app.setCookieHeaders(webResponse));
		if (setCookieHeaders.length) {
			res.setHeader('Set-Cookie', setCookieHeaders);
		}
	}

	res.writeHead(status, Object.fromEntries(headers.entries()));
	if (body) {
		for await (const chunk of body as unknown as Readable) {
			res.write(chunk);
		}
	}
	res.end();
}
