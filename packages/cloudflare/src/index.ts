import type { AstroConfig, AstroIntegration, RouteData } from 'astro';

import * as fs from 'node:fs';
import * as os from 'node:os';
import { relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRedirectsFromAstroRoutes } from '@astrojs/underscore-redirects';
import { AstroError } from 'astro/errors';
import esbuild from 'esbuild';
import glob from 'tiny-glob';
import { getPlatformProxy } from 'wrangler';
import { getAdapter } from './getAdapter.js';
import { deduplicatePatterns } from './utils/deduplicatePatterns.js';
import { prepareImageConfig } from './utils/image-config.js';
import { prependForwardSlash } from './utils/prependForwardSlash.js';
import { rewriteWasmImportPath } from './utils/rewriteWasmImportPath.js';
import { patchSharpBundle } from './utils/sharpBundlePatch.js';
import { wasmModuleLoader } from './utils/wasm-module-loader.js';

export type { AdvancedRuntime } from './entrypoints/server.advanced.js';

export type Options = {
	imageService?: 'passthrough' | 'cloudflare' | 'compile';
	routes?: {
		/**
		 * @deprecated Removed in v10. You will have two options going forward, using auto generated `_route.json` file or provide your own one in `public/_routes.json`. The previous method caused confusion and inconsistencies.
		 */
		strategy?: 'auto' | 'include' | 'exclude';
		/**
		 * @deprecated Removed in v10. Use `routes.extend.include` instead.
		 */
		include?: string[];
		/**
		 * @deprecated Removed in v10. Use `routes.extend.exclude` instead.
		 */
		exclude?: string[];
	};
	/**
	 * Proxy configuration for the platform.
	 */
	platformProxy?: {
		/** Toggle the proxy. Default `undefined`, which equals to `false`. */
		enabled?: boolean;
		/** Path to the configuration file. Default `wrangler.toml`. */
		configPath?: string;
		/** Enable experimental support for JSON configuration. Default `false`. */
		experimentalJsonConfig?: boolean;
		/** Configuration persistence settings. Default '.wrangler/state/v3' */
		persist?: boolean | { path: string };
	};
	wasmModuleImports?: boolean;
};

interface BuildConfig {
	server: URL;
	client: URL;
	assets: string;
	serverEntry: string;
	split?: boolean;
}

export default function createIntegration(args?: Options): AstroIntegration {
	let _config: AstroConfig;
	let _buildConfig: BuildConfig;

	const SERVER_BUILD_FOLDER = '/$server_build/';

	return {
		name: '@astrojs/cloudflare',
		hooks: {
			'astro:config:setup': ({ command, config, updateConfig, logger }) => {
				updateConfig({
					build: {
						client: new URL(`.${config.base}`, config.outDir),
						server: new URL(`.${SERVER_BUILD_FOLDER}`, config.outDir),
						serverEntry: '_worker.mjs',
						redirects: false,
					},
					vite: {
						// load .wasm files as WebAssembly modules
						plugins: [
							wasmModuleLoader({
								disabled: !args?.wasmModuleImports,
								assetsDirectory: config.build.assets,
							}),
						],
					},
					image: prepareImageConfig(args?.imageService ?? 'DEFAULT', config.image, command, logger),
				});
			},
			'astro:config:done': ({ setAdapter, config }) => {
				setAdapter(getAdapter());
				_config = config;
				_buildConfig = config.build;

				if (_config.output === 'static') {
					throw new AstroError(
						'[@astrojs/cloudflare] `output: "server"` or `output: "hybrid"` is required to use this adapter. Otherwise, this adapter is not necessary to deploy a static site to Cloudflare.'
					);
				}

				if (_config.base === SERVER_BUILD_FOLDER) {
					throw new AstroError(
						'[@astrojs/cloudflare] `base: "${SERVER_BUILD_FOLDER}"` is not allowed. Please change your `base` config to something else.'
					);
				}
			},
			'astro:server:setup': async ({ server, logger }) => {
				if (args?.platformProxy?.enabled === true) {
					const platformProxy = await getPlatformProxy({
						configPath: args.platformProxy.configPath ?? 'wrangler.toml',
						experimentalJsonConfig: args.platformProxy.experimentalJsonConfig ?? false,
						persist: args.platformProxy.persist ?? true,
					});

					const clientLocalsSymbol = Symbol.for('astro.locals');

					server.middlewares.use(async function middleware(req, res, next) {
						Reflect.set(req, clientLocalsSymbol, {
							runtime: {
								env: platformProxy.env,
								cf: platformProxy.cf,
								caches: platformProxy.caches,
								ctx: platformProxy.ctx,
							},
						});
						next();
					});
				}
			},
			'astro:build:setup': ({ vite, target }) => {
				if (target === 'server') {
					vite.resolve ||= {};
					vite.resolve.alias ||= {};

					const aliases = [
						{
							find: 'react-dom/server',
							replacement: 'react-dom/server.browser',
						},
					];

					if (Array.isArray(vite.resolve.alias)) {
						vite.resolve.alias = [...vite.resolve.alias, ...aliases];
					} else {
						for (const alias of aliases) {
							(vite.resolve.alias as Record<string, string>)[alias.find] = alias.replacement;
						}
					}
					vite.ssr ||= {};
					vite.ssr.target = 'webworker';

					// Cloudflare env is only available per request. This isn't feasible for code that access env vars
					// in a global way, so we shim their access as `process.env.*`. We will populate `process.env` later
					// in its fetch handler.
					vite.define = {
						'process.env': 'process.env',
						...vite.define,
					};
				}
			},
			'astro:build:done': async ({ pages, routes, dir }) => {
				const assetsUrl = new URL(_buildConfig.assets, _buildConfig.client);

				const entryPath = fileURLToPath(new URL(_buildConfig.serverEntry, _buildConfig.server));
				const entryUrl = new URL(_buildConfig.serverEntry, _config.outDir);
				const buildPath = fileURLToPath(entryUrl);
				// A URL for the final build path after renaming
				const finalBuildUrl = pathToFileURL(buildPath.replace(/\.mjs$/, '.js'));

				const esbuildPlugins = [];
				if (args?.imageService === 'compile') {
					esbuildPlugins.push(patchSharpBundle());
				}

				if (args?.wasmModuleImports) {
					esbuildPlugins.push(
						rewriteWasmImportPath({
							relativePathToAssets: relative(
								fileURLToPath(_buildConfig.client),
								fileURLToPath(assetsUrl)
							),
						})
					);
				}

				await esbuild.build({
					target: 'es2022',
					platform: 'browser',
					conditions: ['workerd', 'worker', 'browser'],
					external: [
						'node:assert',
						'node:async_hooks',
						'node:buffer',
						'node:crypto',
						'node:diagnostics_channel',
						'node:events',
						'node:path',
						'node:process',
						'node:stream',
						'node:string_decoder',
						'node:util',
						'cloudflare:*',
					],
					entryPoints: [entryPath],
					outfile: buildPath,
					allowOverwrite: true,
					format: 'esm',
					bundle: true,
					minify: _config.vite?.build?.minify !== false,
					banner: {
						js: `globalThis.process = {
								argv: [],
								env: {},
							};`,
					},
					logOverride: {
						'ignored-bare-import': 'silent',
					},
					plugins: esbuildPlugins,
				});

				// Rename to worker.js
				await fs.promises.rename(buildPath, finalBuildUrl);

				// throw the server folder in the bin
				const serverUrl = new URL(_buildConfig.server);
				await fs.promises.rm(serverUrl, { recursive: true, force: true });

				// move cloudflare specific files to the root
				const cloudflareSpecialFiles = ['_headers', '_redirects', '_routes.json'];

				if (_config.base !== '/') {
					for (const file of cloudflareSpecialFiles) {
						try {
							await fs.promises.rename(
								new URL(file, _buildConfig.client),
								new URL(file, _config.outDir)
							);
						} catch (e) {
							// ignore
						}
					}
				}

				const routesExists = await fs.promises
					.stat(new URL('./_routes.json', _config.outDir))
					.then((stat) => stat.isFile())
					.catch(() => false);

				// this creates a _routes.json, in case there is none present to enable
				// cloudflare to handle static files and support _redirects configuration
				if (!routesExists) {
					/**
					 * These route types are candiates for being part of the `_routes.json` `include` array.
					 */
					let notFoundIsSSR = false;
					const potentialFunctionRouteTypes = ['endpoint', 'page'];
					const functionEndpoints = routes
						// Certain route types, when their prerender option is set to false, run on the server as function invocations
						.filter((route) => potentialFunctionRouteTypes.includes(route.type) && !route.prerender)
						.map((route) => {
							if (route.component === 'src/pages/404.astro' && route.prerender === false)
								notFoundIsSSR = true;
							const includePattern = `/${route.segments
								.flat()
								.map((segment) => (segment.dynamic ? '*' : segment.content))
								.join('/')}`;

							const regexp = new RegExp(
								`^\\/${route.segments
									.flat()
									.map((segment) => (segment.dynamic ? '(.*)' : segment.content))
									.join('\\/')}$`
							);

							return {
								includePattern,
								regexp,
							};
						});

					const staticPathList: Array<string> = (
						await glob(`${fileURLToPath(_buildConfig.client)}/**/*`, {
							cwd: fileURLToPath(_config.outDir),
							filesOnly: true,
							dot: true,
						})
					)
						.filter((file: string) => cloudflareSpecialFiles.indexOf(file) < 0)
						.map((file: string) => `/${file.replace(/\\/g, '/')}`);

					for (const page of pages) {
						let pagePath = prependForwardSlash(page.pathname);
						if (_config.base !== '/') {
							const base = _config.base.endsWith('/') ? _config.base.slice(0, -1) : _config.base;
							pagePath = `${base}${pagePath}`;
						}
						staticPathList.push(pagePath);
					}

					const redirectsExists = await fs.promises
						.stat(new URL('./_redirects', _config.outDir))
						.then((stat) => stat.isFile())
						.catch(() => false);

					// convert all redirect source paths into a list of routes
					// and add them to the static path
					if (redirectsExists) {
						const redirects = (
							await fs.promises.readFile(new URL('./_redirects', _config.outDir), 'utf-8')
						)
							.split(os.EOL)
							.map((line) => {
								const parts = line.split(' ');
								if (parts.length < 2) {
									return null;
								}
								// convert /products/:id to /products/*
								return (
									parts[0]
										.replace(/\/:.*?(?=\/|$)/g, '/*')
										// remove query params as they are not supported by cloudflare
										.replace(/\?.*$/, '')
								);
							})
							.filter(
								(line, index, arr) => line !== null && arr.indexOf(line) === index
							) as string[];

						if (redirects.length > 0) {
							staticPathList.push(...redirects);
						}
					}

					const redirectRoutes: [RouteData, string][] = routes
						.filter((r) => r.type === 'redirect')
						.map((r) => {
							return [r, ''];
						});
					const trueRedirects = createRedirectsFromAstroRoutes({
						config: _config,
						routeToDynamicTargetMap: new Map(Array.from(redirectRoutes)),
						dir,
					});
					if (!trueRedirects.empty()) {
						await fs.promises.appendFile(
							new URL('./_redirects', _config.outDir),
							trueRedirects.print()
						);
					}

					staticPathList.push(...routes.filter((r) => r.type === 'redirect').map((r) => r.route));

					const strategy = args?.routes?.strategy ?? 'auto';

					// Strategy `include`: include all function endpoints, and then exclude static paths that would be matched by an include pattern
					const includeStrategy =
						strategy === 'exclude'
							? undefined
							: {
									include: deduplicatePatterns(
										functionEndpoints
											.map((endpoint) => endpoint.includePattern)
											.concat(args?.routes?.include ?? [])
									),
									exclude: deduplicatePatterns(
										staticPathList
											.filter((file: string) =>
												functionEndpoints.some((endpoint) => endpoint.regexp.test(file))
											)
											.concat(args?.routes?.exclude ?? [])
									),
							  };

					// Cloudflare requires at least one include pattern:
					// https://developers.cloudflare.com/pages/platform/functions/routing/#limits
					// So we add a pattern that we immediately exclude again
					if (includeStrategy?.include.length === 0) {
						includeStrategy.include = ['/'];
						includeStrategy.exclude = ['/'];
					}

					// Strategy `exclude`: include everything, and then exclude all static paths
					const excludeStrategy =
						strategy === 'include'
							? undefined
							: {
									include: ['/*'],
									exclude: deduplicatePatterns(staticPathList.concat(args?.routes?.exclude ?? [])),
							  };

					switch (args?.routes?.strategy) {
						case 'include':
							await fs.promises.writeFile(
								new URL('./_routes.json', _config.outDir),
								JSON.stringify(
									{
										version: 1,
										...includeStrategy,
									},
									null,
									2
								)
							);
							break;

						case 'exclude':
							await fs.promises.writeFile(
								new URL('./_routes.json', _config.outDir),
								JSON.stringify(
									{
										version: 1,
										...excludeStrategy,
									},
									null,
									2
								)
							);
							break;

						default:
							{
								const includeStrategyLength = includeStrategy
									? includeStrategy.include.length + includeStrategy.exclude.length
									: Number.POSITIVE_INFINITY;

								const excludeStrategyLength = excludeStrategy
									? excludeStrategy.include.length + excludeStrategy.exclude.length
									: Number.POSITIVE_INFINITY;

								const winningStrategy = notFoundIsSSR
									? excludeStrategy
									: includeStrategyLength <= excludeStrategyLength
									  ? includeStrategy
									  : excludeStrategy;

								await fs.promises.writeFile(
									new URL('./_routes.json', _config.outDir),
									JSON.stringify(
										{
											version: 1,
											...winningStrategy,
										},
										null,
										2
									)
								);
							}
							break;
					}
				}
			},
		},
	};
}
