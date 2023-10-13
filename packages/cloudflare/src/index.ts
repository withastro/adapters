import type { AstroConfig, AstroIntegration, RouteData } from 'astro';

import { createRedirectsFromAstroRoutes } from '@astrojs/underscore-redirects';
import { AstroError } from 'astro/errors';
import esbuild from 'esbuild';
import { Miniflare } from 'miniflare';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import glob from 'tiny-glob';
import { getAdapter } from './getAdapter.js';
import { deduplicatePatterns } from './utils/deduplicatePatterns.js';
import { getCFObject } from './utils/getCFObject.js';
import {
	getD1Bindings,
	getDOBindings,
	getEnvVars,
	getKVBindings,
	getR2Bindings,
} from './utils/parser.js';
import { prependForwardSlash } from './utils/prependForwardSlash.js';
import { rewriteWasmImportPath } from './utils/rewriteWasmImportPath.js';
import { wasmModuleLoader } from './utils/wasm-module-loader.js';

export type { AdvancedRuntime } from './entrypoints/server.advanced.js';
export type { DirectoryRuntime } from './entrypoints/server.directory.js';

type Options = {
	mode?: 'directory' | 'advanced';
	functionPerRoute?: boolean;
	/** Configure automatic `routes.json` generation */
	routes?: {
		/** Strategy for generating `include` and `exclude` patterns
		 * - `auto`: Will use the strategy that generates the least amount of entries.
		 * - `include`: For each page or endpoint in your application that is not prerendered, an entry in the `include` array will be generated. For each page that is prerendered and whoose path is matched by an `include` entry, an entry in the `exclude` array will be generated.
		 * - `exclude`: One `"/*"` entry in the `include` array will be generated. For each page that is prerendered, an entry in the `exclude` array will be generated.
		 * */
		strategy?: 'auto' | 'include' | 'exclude';
		/** Additional `include` patterns */
		include?: string[];
		/** Additional `exclude` patterns */
		exclude?: string[];
	};
	/**
	 * 'off': current behaviour (wrangler is needed)
	 * 'local': use a static req.cf object, and env vars defined in wrangler.toml & .dev.vars (astro dev is enough)
	 * 'remote': use a dynamic real-live req.cf object, and env vars defined in wrangler.toml & .dev.vars (astro dev is enough)
	 */
	runtime?: 'off' | 'local' | 'remote';
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
	let _mf: Miniflare;
	let _entryPoints = new Map<RouteData, URL>();

	const SERVER_BUILD_FOLDER = '/$server_build/';

	const isModeDirectory = args?.mode === 'directory';
	const functionPerRoute = args?.functionPerRoute ?? false;
	const runtimeMode = args?.runtime ?? 'off';

	return {
		name: '@astrojs/cloudflare',
		hooks: {
			'astro:config:setup': ({ config, updateConfig }) => {
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
				});
			},
			'astro:config:done': ({ setAdapter, config }) => {
				setAdapter(getAdapter({ isModeDirectory, functionPerRoute }));
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
			'astro:server:setup': ({ server }) => {
				if (runtimeMode !== 'off') {
					server.middlewares.use(async function middleware(req, res, next) {
						try {
							const cf = await getCFObject(runtimeMode);
							const vars = await getEnvVars();
							const D1Bindings = await getD1Bindings();
							const R2Bindings = await getR2Bindings();
							const KVBindings = await getKVBindings();
							const DOBindings = await getDOBindings();
							let bindingsEnv = new Object({});

							// fix for the error "kj/filesystem-disk-unix.c++:1709: warning: PWD environment variable doesn't match current directory."
							// note: This mismatch might be primarily due to the test runner.
							const originalPWD = process.env.PWD;
							process.env.PWD = process.cwd();

							_mf = new Miniflare({
								modules: true,
								script: '',
								cache: true,
								cachePersist: true,
								cacheWarnUsage: true,
								d1Databases: D1Bindings,
								d1Persist: true,
								r2Buckets: R2Bindings,
								r2Persist: true,
								kvNamespaces: KVBindings,
								kvPersist: true,
								durableObjects: DOBindings,
								durableObjectsPersist: true,
							});
							await _mf.ready;

							for (const D1Binding of D1Bindings) {
								const db = await _mf.getD1Database(D1Binding);
								Reflect.set(bindingsEnv, D1Binding, db);
							}
							for (const R2Binding of R2Bindings) {
								const bucket = await _mf.getR2Bucket(R2Binding);
								Reflect.set(bindingsEnv, R2Binding, bucket);
							}
							for (const KVBinding of KVBindings) {
								const namespace = await _mf.getKVNamespace(KVBinding);
								Reflect.set(bindingsEnv, KVBinding, namespace);
							}
							for (const key in DOBindings) {
								if (Object.prototype.hasOwnProperty.call(DOBindings, key)) {
									const DO = await _mf.getDurableObjectNamespace(key);
									Reflect.set(bindingsEnv, key, DO);
								}
							}
							const mfCache = await _mf.getCaches();

							process.env.PWD = originalPWD;
							const clientLocalsSymbol = Symbol.for('astro.locals');
							Reflect.set(req, clientLocalsSymbol, {
								runtime: {
									env: {
										// default binding for static assets will be dynamic once we support mocking of bindings
										ASSETS: {},
										// this is just a VAR for CF to change build behavior, on dev it should be 0
										CF_PAGES: '0',
										// will be fetched from git dynamically once we support mocking of bindings
										CF_PAGES_BRANCH: 'TBA',
										// will be fetched from git dynamically once we support mocking of bindings
										CF_PAGES_COMMIT_SHA: 'TBA',
										CF_PAGES_URL: `http://${req.headers.host}`,
										...bindingsEnv,
										...vars,
									},
									cf: cf,
									waitUntil: (_promise: Promise<any>) => {
										return;
									},
									caches: mfCache,
								},
							});
							next();
						} catch {
							next();
						}
					});
				}
			},
			'astro:server:done': async ({ logger }) => {
				if (_mf) {
					logger.info('Cleaning up the Miniflare instance, and shutting down the workerd server.');
					await _mf.dispose();
				}
			},
			'astro:build:setup': ({ vite, target }) => {
				if (target === 'server') {
					vite.resolve ||= {};
					vite.resolve.alias ||= {};

					const aliases = [{ find: 'react-dom/server', replacement: 'react-dom/server.browser' }];

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
			'astro:build:ssr': ({ entryPoints }) => {
				_entryPoints = entryPoints;
			},
			'astro:build:done': async ({ pages, routes, dir }) => {
				const functionsUrl = new URL('functions/', _config.root);
				const assetsUrl = new URL(_buildConfig.assets, _buildConfig.client);

				if (isModeDirectory) {
					await fs.promises.mkdir(functionsUrl, { recursive: true });
				}

				// TODO: remove _buildConfig.split in Astro 4.0
				if (isModeDirectory && (_buildConfig.split || functionPerRoute)) {
					const entryPointsURL = [..._entryPoints.values()];
					const entryPaths = entryPointsURL.map((entry) => fileURLToPath(entry));
					const outputUrl = new URL('$astro', _buildConfig.server);
					const outputDir = fileURLToPath(outputUrl);
					//
					// Sadly, when wasmModuleImports is enabled, this needs to build esbuild for each depth of routes/entrypoints
					// independently so that relative import paths to the assets are the correct depth of '../' traversals
					// This is inefficient, so wasmModuleImports is opt-in. This could potentially be improved in the future by
					// taking advantage of the esbuild "onEnd" hook to rewrite import code per entry point relative to where the final
					// destination of the entrypoint is
					const entryPathsGroupedByDepth = !args.wasmModuleImports
						? [entryPaths]
						: entryPaths
								.reduce((sum, thisPath) => {
									const depthFromRoot = thisPath.split(sep).length;
									sum.set(depthFromRoot, (sum.get(depthFromRoot) || []).concat(thisPath));
									return sum;
								}, new Map<number, string[]>())
								.values();

					for (const pathsGroup of entryPathsGroupedByDepth) {
						// for some reason this exports to "entry.pages" on windows instead of "pages" on unix environments.
						// This deduces the name of the "pages" build directory
						const pagesDirname = relative(fileURLToPath(_buildConfig.server), pathsGroup[0]).split(
							sep
						)[0];
						const absolutePagesDirname = fileURLToPath(new URL(pagesDirname, _buildConfig.server));
						const urlWithinFunctions = new URL(
							relative(absolutePagesDirname, pathsGroup[0]),
							functionsUrl
						);
						const relativePathToAssets = relative(
							dirname(fileURLToPath(urlWithinFunctions)),
							fileURLToPath(assetsUrl)
						);
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
							entryPoints: pathsGroup,
							outbase: absolutePagesDirname,
							outdir: outputDir,
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
							plugins: !args?.wasmModuleImports
								? []
								: [rewriteWasmImportPath({ relativePathToAssets })],
						});
					}

					const outputFiles: Array<string> = await glob(`**/*`, {
						cwd: outputDir,
						filesOnly: true,
					});

					// move the files into the functions folder
					// & make sure the file names match Cloudflare syntax for routing
					for (const outputFile of outputFiles) {
						const path = outputFile.split(sep);

						const finalSegments = path.map((segment) =>
							segment
								.replace(/(\_)(\w+)(\_)/g, (_, __, prop) => {
									return `[${prop}]`;
								})
								.replace(/(\_\-\-\-)(\w+)(\_)/g, (_, __, prop) => {
									return `[[${prop}]]`;
								})
						);

						finalSegments[finalSegments.length - 1] = finalSegments[finalSegments.length - 1]
							.replace('entry.', '')
							.replace(/(.*)\.(\w+)\.(\w+)$/g, (_, fileName, __, newExt) => {
								return `${fileName}.${newExt}`;
							});

						const finalDirPath = finalSegments.slice(0, -1).join(sep);
						const finalPath = finalSegments.join(sep);

						const newDirUrl = new URL(finalDirPath, functionsUrl);
						await fs.promises.mkdir(newDirUrl, { recursive: true });

						const oldFileUrl = new URL(`$astro/${outputFile}`, outputUrl);
						const newFileUrl = new URL(finalPath, functionsUrl);
						await fs.promises.rename(oldFileUrl, newFileUrl);
					}
				} else {
					const entryPath = fileURLToPath(new URL(_buildConfig.serverEntry, _buildConfig.server));
					const entryUrl = new URL(_buildConfig.serverEntry, _config.outDir);
					const buildPath = fileURLToPath(entryUrl);
					// A URL for the final build path after renaming
					const finalBuildUrl = pathToFileURL(buildPath.replace(/\.mjs$/, '.js'));

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
						plugins: !args?.wasmModuleImports
							? []
							: [
									rewriteWasmImportPath({
										relativePathToAssets: isModeDirectory
											? relative(fileURLToPath(functionsUrl), fileURLToPath(assetsUrl))
											: relative(fileURLToPath(_buildConfig.client), fileURLToPath(assetsUrl)),
									}),
							  ],
					});

					// Rename to worker.js
					await fs.promises.rename(buildPath, finalBuildUrl);

					if (isModeDirectory) {
						const directoryUrl = new URL('[[path]].js', functionsUrl);
						await fs.promises.rename(finalBuildUrl, directoryUrl);
					}
				}

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

				// Add also the worker file so it's excluded from the _routes.json generation
				if (!isModeDirectory) {
					cloudflareSpecialFiles.push('_worker.js');
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
					const potentialFunctionRouteTypes = ['endpoint', 'page'];

					const functionEndpoints = routes
						// Certain route types, when their prerender option is set to false, run on the server as function invocations
						.filter((route) => potentialFunctionRouteTypes.includes(route.type) && !route.prerender)
						.map((route) => {
							const includePattern =
								'/' +
								route.segments
									.flat()
									.map((segment) => (segment.dynamic ? '*' : segment.content))
									.join('/');

							const regexp = new RegExp(
								'^\\/' +
									route.segments
										.flat()
										.map((segment) => (segment.dynamic ? '(.*)' : segment.content))
										.join('\\/') +
									'$'
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

					for (let page of pages) {
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
								} else {
									// convert /products/:id to /products/*
									return (
										parts[0]
											.replace(/\/:.*?(?=\/|$)/g, '/*')
											// remove query params as they are not supported by cloudflare
											.replace(/\?.*$/, '')
									);
								}
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

					const includeStrategyLength = includeStrategy
						? includeStrategy.include.length + includeStrategy.exclude.length
						: Infinity;

					const excludeStrategyLength = excludeStrategy
						? excludeStrategy.include.length + excludeStrategy.exclude.length
						: Infinity;

					const winningStrategy =
						includeStrategyLength <= excludeStrategyLength ? includeStrategy : excludeStrategy;

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
			},
		},
	};
}
