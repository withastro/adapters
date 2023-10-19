import type { AstroAdapter, AstroConfig, AstroIntegration, RouteData } from 'astro';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEdgeMiddleware } from './middleware.js';
import { createRedirects, type Args } from './shared.js';

export const NETLIFY_EDGE_MIDDLEWARE_FILE = 'netlify-edge-middleware';

export function getAdapter(args: Args): AstroAdapter {
	return {
		name: '@astrojs/netlify/functions',
		serverEntrypoint: args.runtime === 'v2' ? '@astrojs/netlify/server-v2.js' : '@astrojs/netlify/server-v1.js',
		exports: args.runtime === 'v2' ? ['default'] : ['handler'],
		args,
		adapterFeatures: {
			functionPerRoute: args.functionPerRoute,
			edgeMiddleware: args.edgeMiddleware,
		},
		supportedAstroFeatures: {
			hybridOutput: 'stable',
			staticOutput: 'stable',
			serverOutput: 'stable',
			assets: {
				supportKind: 'stable',
				isSharpCompatible: true,
				isSquooshCompatible: true,
			},
		},
	};
}

interface NetlifyFunctionsOptions {
	dist?: URL;
	builders?: boolean;
	binaryMediaTypes?: string[];
	edgeMiddleware?: boolean;
	functionPerRoute?: boolean;
	runtime?: 'v1' | 'v2';
}

function netlifyFunctions({
	dist,
	binaryMediaTypes,
	builders = false,
	functionPerRoute = false,
	edgeMiddleware = false,
	runtime = 'v1'
}: NetlifyFunctionsOptions = {}): AstroIntegration {

	if (runtime === 'v2' && builders) {
		throw new Error("Builder functions are not compatible with Netlify's Runtime V2. Please either disable builders or switch back to V1.")
	}

	let _config: AstroConfig;
	let _entryPoints: Map<RouteData, URL>;
	let ssrEntryFile: string;
	let _middlewareEntryPoint: URL;
	return {
		name: '@astrojs/netlify',
		hooks: {
			'astro:config:setup' ({ config, updateConfig }) {
				const outDir = dist ?? new URL('./dist/', config.root);
				updateConfig({
					outDir,
					build: {
						redirects: false,
						client: outDir,
						server: new URL('./.netlify/functions-internal/', config.root),
					},
				});
			},
			'astro:build:ssr' ({ entryPoints, middlewareEntryPoint }) {
				if (middlewareEntryPoint) {
					_middlewareEntryPoint = middlewareEntryPoint;
				}
				_entryPoints = entryPoints;
			},
			'astro:config:done' ({ config, setAdapter, logger }) {
				setAdapter(
					getAdapter({
						binaryMediaTypes,
						builders,
						functionPerRoute,
						edgeMiddleware,
						runtime
					})
				);
				_config = config;
				ssrEntryFile = config.build.serverEntry.replace(/\.m?js/, '');

				if (config.output === 'static') {
					logger.warn('`output: "server"` or `output: "hybrid"` is required to use this adapter.');
					logger.warn('Otherwise, this adapter is not required to deploy a static site to Netlify.');
				}
			},
			async 'astro:build:done' ({ routes, dir }) {
				const functionsConfig = {
					version: 1,
					config: {
						nodeModuleFormat: 'esm',
					},
				};
				const functionsConfigPath = join(fileURLToPath(_config.build.server), 'entry.json');
				await writeFile(functionsConfigPath, JSON.stringify(functionsConfig));

				const type = builders ? 'builders' : 'functions';
				const kind = type ?? 'functions';

				if (_entryPoints.size) {
					const routeToDynamicTargetMap = new Map();
					for (const [route, entryFile] of _entryPoints) {
						const wholeFileUrl = fileURLToPath(entryFile);

						const extension = extname(wholeFileUrl);
						const relative = wholeFileUrl
							.replace(fileURLToPath(_config.build.server), '')
							.replace(extension, '')
							.replaceAll('\\', '/');
						const dynamicTarget = `/.netlify/${kind}/${relative}`;

						routeToDynamicTargetMap.set(route, dynamicTarget);
					}
					await createRedirects(_config, routeToDynamicTargetMap, dir);
				} else {
					const dynamicTarget = `/.netlify/${kind}/${ssrEntryFile}`;
					const map: [RouteData, string][] = routes.map((route) => {
						return [route, dynamicTarget];
					});
					const routeToDynamicTargetMap = new Map(Array.from(map));

					await createRedirects(_config, routeToDynamicTargetMap, dir);
				}
				if (_middlewareEntryPoint) {
					const outPath = fileURLToPath(new URL('./.netlify/edge-functions/', _config.root));
					const netlifyEdgeMiddlewareHandlerPath = new URL(
						NETLIFY_EDGE_MIDDLEWARE_FILE,
						_config.srcDir
					);
					await generateEdgeMiddleware(
						_middlewareEntryPoint,
						outPath,
						netlifyEdgeMiddlewareHandlerPath
					);
				}
			},
		},
	};
}

export { netlifyFunctions as default, netlifyFunctions };
