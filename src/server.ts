import { NodeApp, applyPolyfills } from 'astro/app/node';
import { createStandaloneHandler } from './standalone.js';
import startServer from './standalone.js';
import createMiddleware from './middleware.js';
import type { SSRManifest } from 'astro';
import type { Options } from './types.js';

applyPolyfills();
export function createExports(manifest: SSRManifest, options: Options) {
	const app = new NodeApp(manifest);
	options.trailingSlash = manifest.trailingSlash;
	return {
		options: options,
		handler:
			options.mode === 'middleware' ? createMiddleware(app) : createStandaloneHandler(app, options),
		startServer: () => startServer(app, options),
	};
}

export function start(manifest: SSRManifest, options: Options) {
	if (options.mode !== 'standalone' || process.env.ASTRO_NODE_AUTOSTART === 'disabled') {
		return;
	}

	const app = new NodeApp(manifest);
	startServer(app, options);
}
