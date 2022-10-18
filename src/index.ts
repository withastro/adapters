import type { AstroAdapter, AstroIntegration } from 'astro';
import type { Options, UserOptions } from './types';

export function getAdapter(options: Options): AstroAdapter {
	return {
		name: '@astrojs/node',
		serverEntrypoint: '@astrojs/node/server.js',
		previewEntrypoint: '@astrojs/node/preview.js',
		exports: ['handler'],
		args: options,
	};
}

export default function createIntegration(userOptions: UserOptions): AstroIntegration {
	if (!userOptions?.mode) {
		throw new Error(`[@astrojs/node] Setting the 'mode' option is required.`);
	}

	let needsBuildConfig = false;
	let _options: Options;
	return {
		name: '@astrojs/node',
		hooks: {
			'astro:config:setup': ({ updateConfig }) => {
				updateConfig({
					vite: {
						ssr: {
							noExternal: ['@astrojs/node'],
						},
					},
				});
			},
			'astro:config:done': ({ setAdapter, config }) => {
				needsBuildConfig = !config.build?.server;
				_options = {
					...userOptions,
					client: config.build.client?.toString(),
					server: config.build.server?.toString(),
					host: config.server.host,
					port: config.server.port,
				};
				setAdapter(getAdapter(_options));

				if (config.output === 'static') {
					console.warn(`[@astrojs/node] \`output: "server"\` is required to use this adapter.`);
				}
			},
			'astro:build:start': ({ buildConfig }) => {
				// Backwards compat
				if (needsBuildConfig) {
					_options.client = buildConfig.client.toString();
					_options.server = buildConfig.server.toString();
				}
			},
		},
	};
}
