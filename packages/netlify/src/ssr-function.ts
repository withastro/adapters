import type { Context } from '@netlify/functions';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { applyPolyfills } from 'astro/app/node';

applyPolyfills();

// biome-ignore lint/complexity/noBannedTypes: safe to use in this case
export type Args = {};

const clientAddressSymbol = Symbol.for('astro.clientAddress');

export const createExports = (manifest: SSRManifest, _args: Args) => {
	const app = new App(manifest);

	function createHandler(integrationConfig: { cacheOnDemandPages: boolean }) {
		return async function handler(request: Request, context: Context) {
			const routeData = app.match(request);
			Reflect.set(request, clientAddressSymbol, context.ip);

			let locals: Record<string, unknown> = {};

			const astroLocalsHeader = request.headers.get('x-astro-locals');
			if (astroLocalsHeader) {
				locals = JSON.parse(astroLocalsHeader);
			}

			locals.netlify = { context };

			const response = await app.render(request, routeData, locals);

			if (app.setCookieHeaders) {
				for (const setCookieHeader of app.setCookieHeaders(response)) {
					response.headers.append('Set-Cookie', setCookieHeader);
				}
			}

			if (integrationConfig.cacheOnDemandPages) {
				// any user-provided Cache-Control headers take precedence
				const hasCacheControl = [
					'Cache-Control',
					'CDN-Cache-Control',
					'Netlify-CDN-Cache-Control',
				].some((header) => response.headers.has(header));

				if (!hasCacheControl) {
					// caches this page for up to a year
					response.headers.append('CDN-Cache-Control', 'public, max-age=31536000, must-revalidate');
				}
			}

			return response;
		};
	}

	return { default: createHandler };
};
