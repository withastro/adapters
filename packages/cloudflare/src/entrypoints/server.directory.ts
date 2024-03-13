import type { Request as CFRequest, CacheStorage, EventContext } from '@cloudflare/workers-types';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { getProcessEnvProxy, isNode } from '../util.js';

if (!isNode) {
	process.env = getProcessEnvProxy();
}
export interface DirectoryRuntime<T extends object = object> {
	runtime: {
		waitUntil: (promise: Promise<any>) => void;
		env: EventContext<unknown, string, unknown>['env'] & T;
		cf: CFRequest['cf'];
		caches: CacheStorage;
	};
}

export function createExports(manifest: SSRManifest) {
	const app = new App(manifest);

	const onRequest = async (context: EventContext<unknown, string, unknown>) => {
		const request = context.request as CFRequest & Request;
		const { env } = context;

		// TODO: remove this any cast in the future
		// REF: the type cast to any is needed because the Cloudflare Env Type is not assignable to type 'ProcessEnv'
		process.env = env as any;

		const { pathname } = new URL(request.url);
		// static assets fallback, in case default _routes.json is not used
		if (manifest.assets.has(pathname)) {
			return env.ASSETS.fetch(request);
		}

		const routeData = app.match(request);
		Reflect.set(
			request,
			Symbol.for('astro.clientAddress'),
			request.headers.get('cf-connecting-ip')
		);

		const locals: DirectoryRuntime = {
			runtime: {
				waitUntil: (promise: Promise<any>) => {
					context.waitUntil(promise);
				},
				env: context.env,
				cf: request.cf,
				caches: caches as unknown as CacheStorage,
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

	return { onRequest, manifest };
}
