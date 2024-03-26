import type {
	CacheStorage as CLOUDFLARE_CACHESTORAGE,
	Request as CLOUDFLARE_REQUEST,
	ExecutionContext,
} from '@cloudflare/workers-types';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';

type Env = {
	ASSETS: { fetch: (req: Request | string) => Promise<Response> };
	ASTRO_STUDIO_APP_TOKEN?: string;
};

export interface AdvancedRuntime<T extends object = object> {
	runtime: {
		waitUntil: (promise: Promise<any>) => void;
		env: Env & T;
		cf: CLOUDFLARE_REQUEST['cf'];
		caches: CLOUDFLARE_CACHESTORAGE;
	};
}

export function createExports(manifest: SSRManifest) {
	const app = new App(manifest);

	const fetch = async (
		request: Request & CLOUDFLARE_REQUEST,
		env: Env,
		context: ExecutionContext
	) => {
		// TODO: remove this any cast in the future
		// REF: the type cast to any is needed because the Cloudflare Env Type is not assignable to type 'ProcessEnv'
		process.env = env as any;

		const { pathname } = new URL(request.url);

		// static assets fallback, in case default _routes.json is not used
		if (manifest.assets.has(pathname)) {
			return env.ASSETS.fetch(request.url.replace(/\.html$/, ''));
		}

		const routeData = app.match(request);
		if (!routeData) {
			// https://developers.cloudflare.com/pages/functions/api-reference/#envassetsfetch
			const asset = await env.ASSETS.fetch(
				request.url.replace(/index.html$/, '').replace(/\.html$/, '')
			);
			if (asset.status !== 404) {
				return asset;
			}
		}

		Reflect.set(
			request,
			Symbol.for('astro.clientAddress'),
			request.headers.get('cf-connecting-ip')
		);

		process.env.ASTRO_STUDIO_APP_TOKEN ??= (() => {
			if (typeof env.ASTRO_STUDIO_APP_TOKEN === 'string') {
				return env.ASTRO_STUDIO_APP_TOKEN;
			}
		})();

		const locals: AdvancedRuntime = {
			runtime: {
				waitUntil: (promise: Promise<any>) => {
					context.waitUntil(promise);
				},
				env: env,
				cf: request.cf,
				caches: caches as unknown as CLOUDFLARE_CACHESTORAGE,
			},
		};

		const response = await app.render(request, { routeData, locals });

		if (app.setCookieHeaders) {
			for (const setCookieHeader of app.setCookieHeaders(response)) {
				response.headers.append('Set-Cookie', setCookieHeader);
			}
		}

		return response;
	};

	return { default: { fetch } };
}
