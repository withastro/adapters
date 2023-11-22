import type { AstroAdapter, AstroConfig, AstroIntegration, RouteData } from 'astro';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateEdgeMiddleware } from './middleware.ts';
import { createRedirects, type Options } from './shared.ts';
import type { Connect } from 'vite';

export const NETLIFY_EDGE_MIDDLEWARE_FILE = 'netlify-edge-middleware';

export function getAdapter(options: Required<Options> & InternalOptions): AstroAdapter {
	return {
		name: options.adapterName,
		serverEntrypoint: options.functionType === 'v2' ? '@astrojs/netlify/server-v2' : '@astrojs/netlify/server-lambda',
		exports: options.functionType === 'v2' ? ['default'] : ['handler'],
		args: options,
		adapterFeatures: {
			functionPerRoute: options.functionPerRoute,
			edgeMiddleware: options.edgeMiddleware,
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

interface InternalOptions {
	adapterName: string;
	functionType: 'lambda-compatible' | 'builders' | 'v2';
	devMiddleware?: Connect.HandleFunction
	dist?: URL
}

class StacklessError extends Error { trace = undefined }

export function getIntegration({
	dist,
	adapterName,
	functionType,
	devMiddleware,
	builders = false,
	binaryMediaTypes = [],
	functionPerRoute = false,
	edgeMiddleware = false,
}: Options & InternalOptions): AstroIntegration {

	if (functionType === 'v2' && builders) {
		throw new StacklessError("Builder functions are not compatible with Netlify Functions 2.0. Please either disable builders or switch back to lambda compatible function.")
	}

	let _config: AstroConfig;
	let _entryPoints: Map<RouteData, URL>;
	let ssrEntryFile: string;
	let _middlewareEntryPoint: URL | undefined;
	return {
		name: '@astrojs/netlify',
		hooks: {
			'astro:config:setup' ({ config, updateConfig }) {
				const outDir = dist ?? config.outDir;
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
						adapterName,
						binaryMediaTypes,
						builders,
						functionPerRoute,
						edgeMiddleware,
						functionType
					})
				);
				_config = config;
				ssrEntryFile = config.build.serverEntry.replace(/\.m?js/, '');

				if (config.output === 'static') {
					logger.warn('`output: "server"` or `output: "hybrid"` is required to use this adapter.');
					logger.warn('Otherwise, this adapter is not required to deploy a static site to Netlify.');
				}
			},
			'astro:server:setup' ({ server }) {
				if (devMiddleware) server.middlewares.use(devMiddleware)
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

				const type = functionType === 'builders' ? 'builders' : 'functions';

				if (_entryPoints.size) {
					const routeToDynamicTargetMap = new Map();
					for (const [route, entryFile] of _entryPoints) {
						const wholeFileUrl = fileURLToPath(entryFile);

						// HACK: transform entry file manually so that netlify-cli can automatically detect there's a default export
						const orginalEntrypointContents = fs.readFileSync(wholeFileUrl, 'utf-8');

						const replacedEntrypointContents =
							orginalEntrypointContents
							.replace("export { _default as default, pageModule };", "export { pageModule };")
							.replace("const _default = _exports['default'];", "export default _exports['default'];");
						
						fs.writeFileSync(wholeFileUrl, replacedEntrypointContents);

						const extension = extname(wholeFileUrl);
						const relative = wholeFileUrl
							.replace(fileURLToPath(_config.build.server), '')
							.replace(extension, '')
							.replaceAll('\\', '/');
						const dynamicTarget = `/.netlify/${type}/${relative}`;

						routeToDynamicTargetMap.set(route, dynamicTarget);
					}
					await createRedirects(_config, routeToDynamicTargetMap, dir);
				} else {
					// HACK: transform entry file manually so that netlify-cli can automatically detect there's a default export
					const filePath = fileURLToPath(new URL(`./.netlify/functions-internal/${_config.build.serverEntry}`, _config.root))
					const originalEntrypointContents = fs.readFileSync(filePath, 'utf-8')
					
					const replacedEntrypointContents =
						originalEntrypointContents
						.replace("export { _default as default, pageMap };", "export { pageMap };")
						.replace("const _default = _exports['default'];", "export default _exports['default'];");
				
					fs.writeFileSync(filePath, replacedEntrypointContents);

					const dynamicTarget = `/.netlify/${type}/${ssrEntryFile}`;
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
