import { AstroError } from 'astro/errors';
import type { AstroAdapter, AstroIntegration } from 'astro';
import type { Options, UserOptions } from './types.js';

export function getAdapter(options: Options): AstroAdapter {
	return {
		name: '@astrojs/node',
		serverEntrypoint: '@astrojs/node/server.js',
		previewEntrypoint: '@astrojs/node/preview.js',
		exports: ['handler', 'startServer', 'options'],
		args: options,
		supportedAstroFeatures: {
			hybridOutput: 'stable',
			staticOutput: 'stable',
			serverOutput: 'stable',
			assets: {
				supportKind: 'stable',
				isSharpCompatible: true,
				isSquooshCompatible: true,
			},
			i18nDomains: 'experimental',
		},
	};
}

export default function createIntegration(userOptions: UserOptions): AstroIntegration {
	if (!userOptions?.mode) {
		throw new AstroError(`Setting the 'mode' option is required.`);
	}

	let _options: Options;
	return {
		name: '@astrojs/node',
		hooks: {
			'astro:config:setup': ({ updateConfig, config }) => {
				updateConfig({
					image: {
						endpoint: config.image.endpoint ?? 'astro/assets/endpoint/node',
					},
					vite: {
						ssr: {
							noExternal: ['@astrojs/node'],
						},
					},
				});
			},
			'astro:config:done': ({ setAdapter, config }) => {
				_options = {
					...userOptions,
					client: config.build.client?.toString(),
					server: config.build.server?.toString(),
					host: config.server.host,
					port: config.server.port,
					assets: config.build.assets,
				};
				setAdapter(getAdapter(_options));

				if (config.output === 'static') {
					console.warn(
						`[@astrojs/node] \`output: "server"\` or  \`output: "hybrid"\` is required to use this adapter.`
					);
				}
			},
		},
	};
}
