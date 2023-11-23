import type { Context } from '@netlify/edge-functions';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { applyPolyfills } from 'astro/app/node';

applyPolyfills();

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Args {}

const clientAddressSymbol = Symbol.for('astro.clientAddress');

export const createExports = (manifest: SSRManifest, _args: Args) => {
	const app = new App(manifest);

	async function handler(request: Request, context: Context) {
		const routeData = app.match(request);
		Reflect.set(request, clientAddressSymbol, context.ip);

		let locals: Record<string, unknown> = {};

		if (request.headers.has('x-astro-locals')) {
			locals = JSON.parse(request.headers.get('x-astro-locals')!);
		}

		locals.netlify = { context };

		const response = await app.render(request, routeData, locals);

		if (app.setCookieHeaders) {
			for (const setCookieHeader of app.setCookieHeaders(response)) {
				
				response.headers.append('Set-Cookie', setCookieHeader);
			}
		}

		return response;
	}

	return { default: handler };
};
