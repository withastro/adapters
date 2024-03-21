import type { AstroAdapter, AstroFeatureMap } from 'astro';

export function getAdapter({
	functionPerRoute,
}: {
	functionPerRoute: boolean;
}): AstroAdapter {
	const astroFeatures: AstroFeatureMap = {
		hybridOutput: 'stable',
		staticOutput: 'unsupported',
		serverOutput: 'stable',
		assets: {
			supportKind: 'stable',
			isSharpCompatible: false,
			isSquooshCompatible: false,
		},
	};

	return {
		name: '@astrojs/cloudflare',
		serverEntrypoint: '@astrojs/cloudflare/entrypoints/server.advanced.js',
		exports: ['default'],
		supportedAstroFeatures: astroFeatures,
	};
}
