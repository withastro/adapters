import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import createMiddleware from './middleware.js';
import { createStandaloneHandler } from './standalone.js';
import startServer from './standalone.js';
import type { Options } from './types.js';

export function createExports(manifest: SSRManifest, options: Options) {
	const app = new App(manifest);

	return {
		options: options,
		handler:
			options.mode === 'middleware' ? createMiddleware(app) : createStandaloneHandler(app, options),
		startServer: () => startServer(app, options),
	};
}

export function start(manifest: SSRManifest, options: Options) {
	if (options.mode !== 'standalone' || process.env.ASTRO_BUN_AUTOSTART === 'disabled') {
		return;
	}

	const app = new App(manifest);
	startServer(app, options);
}
