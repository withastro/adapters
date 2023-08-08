import type { SSRManifest } from 'astro';
import { NodeApp, applyPolyfills } from 'astro/app/node';
import middleware from './nodeMiddleware.js';
import startServer from './standalone.js';
import type { Options } from './types';

applyPolyfills();
export function createExports(manifest: SSRManifest, options: Options) {
	const app = new NodeApp(manifest);
	return {
		handler: middleware(app, options.mode),
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
