import type { AstroConfig, AstroIntegration, RouteData } from 'astro';

import { createReadStream } from 'node:fs';
import { appendFile, rename, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import {
	appendForwardSlash,
	prependForwardSlash,
	removeLeadingForwardSlash,
} from '@astrojs/internal-helpers/path';
import { createRedirectsFromAstroRoutes } from '@astrojs/underscore-redirects';
import { AstroError } from 'astro/errors';
import { getPlatformProxy } from 'wrangler';
import { createRoutesFile, getParts } from './utils/generate-routes-json.js';
import { setImageConfig } from './utils/image-config.js';
import { wasmModuleLoader } from './utils/wasm-module-loader.js';

export type { Runtime } from './entrypoints/server.advanced.js';

export type Options = {
	/** Options for handling images. */
	imageService?: 'passthrough' | 'cloudflare' | 'compile';
	/** Configuration for `_routes.json` generation. A _routes.json file controls when your Function is invoked. This file will include three different properties:
	 *
	 * - version: Defines the version of the schema. Currently there is only one version of the schema (version 1), however, we may add more in the future and aim to be backwards compatible.
	 * - include: Defines routes that will be invoked by Functions. Accepts wildcard behavior.
	 * - exclude: Defines routes that will not be invoked by Functions. Accepts wildcard behavior. `exclude` always take priority over `include`.
	 *
	 * Wildcards match any number of path segments (slashes). For example, `/users/*` will match everything after the `/users/` path.
	 *
	 */
	routes?: {
		/** Extend `_routes.json` */
		extend: {
			/** Paths which should be routed to the SSR function */
			include?: {
				/** Generally this is in pathname format, but does support wildcards, e.g. `/users`, `/products/*` */
				pattern: string;
			}[];
			/** Paths which should be routed as static assets */
			exclude?: {
				/** Generally this is in pathname format, but does support wildcards, e.g. `/static`, `/assets/*`, `/images/avatar.jpg` */
				pattern: string;
			}[];
		};
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
	/** Enable WebAssembly support */
	wasmModuleImports?: boolean;
};

export default function createIntegration(args?: Options): AstroIntegration {
	let _config: AstroConfig;

	return {
		name: '@astrojs/cloudflare',
		hooks: {
			'astro:config:setup': ({ command, config, updateConfig, logger }) => {
				updateConfig({
					build: {
						client: new URL(
							`.${prependForwardSlash(appendForwardSlash(config.base))}`,
							config.outDir
						),
						server: new URL('./_worker.js/', config.outDir),
						serverEntry: 'index.js',
						redirects: false,
					},
					vite: {
						// load .wasm files as WebAssembly modules
						plugins: [
							wasmModuleLoader({
								disabled: !args?.wasmModuleImports,
							}),
						],
					},
					image: setImageConfig(args?.imageService ?? 'DEFAULT', config.image, command, logger),
				});
			},
			'astro:config:done': ({ setAdapter, config }) => {
				_config = config;

				if (config.output === 'static') {
					throw new AstroError(
						'[@astrojs/cloudflare] `output: "server"` or `output: "hybrid"` is required to use this adapter. Otherwise, this adapter is not necessary to deploy a static site to Cloudflare.'
					);
				}

				setAdapter({
					name: '@astrojs/cloudflare',
					serverEntrypoint: '@astrojs/cloudflare/entrypoints/server.advanced.js',
					exports: ['default'],
					adapterFeatures: {
						functionPerRoute: false,
						edgeMiddleware: false,
					},
					supportedAstroFeatures: {
						serverOutput: 'stable',
						hybridOutput: 'stable',
						staticOutput: 'unsupported',
						i18nDomains: 'experimental',
						assets: {
							supportKind: 'stable',
							isSharpCompatible: false,
							isSquooshCompatible: false,
						},
					},
				});
			},
			'astro:server:setup': async ({ server }) => {
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
						{
							find: 'solid-js/web',
							replacement: 'solid-js/web/dist/server',
						},
						{
							find: 'solid-js',
							replacement: 'solid-js/dist/server',
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
					vite.ssr.noExternal = true;
					vite.ssr.external = _config.vite.ssr?.external ?? [];

					vite.build ||= {};
					vite.build.rollupOptions ||= {};
					vite.build.rollupOptions.output ||= {};
					// @ts-expect-error
					vite.build.rollupOptions.output.banner ||=
						'globalThis.process ??= {}; globalThis.process.env ??= {};';

					vite.build.rollupOptions.external = _config.vite.build?.rollupOptions?.external ?? [];

					// Cloudflare env is only available per request. This isn't feasible for code that access env vars
					// in a global way, so we shim their access as `process.env.*`. This is not the recommended way for users to access environment variables. But we'll add this for compatibility for chosen variables. Mainly to support `@astrojs/db`
					vite.define = {
						'process.env': 'process.env',
						...vite.define,
					};
				}
			},
			'astro:build:done': async ({ pages, routes, dir, logger }) => {
				const PLATFORM_FILES = ['_headers', '_redirects', '_routes.json'];
				if (_config.base !== '/') {
					for (const file of PLATFORM_FILES) {
						try {
							await rename(new URL(file, _config.build.client), new URL(file, _config.outDir));
						} catch (e) {
							logger.error(
								`There was an error moving ${file} to the root of the output directory.`
							);
						}
					}
				}

				let redirectsExists = false;
				try {
					const redirectsStat = await stat(new URL('./_redirects', _config.outDir));
					if (redirectsStat.isFile()) {
						redirectsExists = true;
					}
				} catch (error) {
					redirectsExists = false;
				}

				const redirects: RouteData['segments'][] = [];
				if (redirectsExists) {
					const rl = createInterface({
						input: createReadStream(new URL('./_redirects', _config.outDir)),
						crlfDelay: Number.POSITIVE_INFINITY,
					});

					for await (const line of rl) {
						const parts = line.split(' ');
						if (parts.length >= 2) {
							const p = removeLeadingForwardSlash(parts[0])
								.split('/')
								.filter(Boolean)
								.map((s: string) => {
									const syntax = s
										.replace(/\/:.*?(?=\/|$)/g, '/*')
										// remove query params as they are not supported by cloudflare
										.replace(/\?.*$/, '');
									return getParts(syntax);
								});
							redirects.push(p);
						}
					}
				}

				let routesExists = false;
				try {
					const routesStat = await stat(new URL('./_routes.json', _config.outDir));
					if (routesStat.isFile()) {
						routesExists = true;
					}
				} catch (error) {
					routesExists = false;
				}

				if (!routesExists) {
					await createRoutesFile(
						_config,
						logger,
						routes,
						pages,
						redirects,
						args?.routes?.extend?.include,
						args?.routes?.extend?.exclude
					);
				}

				const redirectRoutes: [RouteData, string][] = [];
				for (const route of routes) {
					if (route.type === 'redirect') redirectRoutes.push([route, '']);
				}

				const trueRedirects = createRedirectsFromAstroRoutes({
					config: _config,
					routeToDynamicTargetMap: new Map(Array.from(redirectRoutes)),
					dir,
				});

				if (!trueRedirects.empty()) {
					try {
						await appendFile(new URL('./_redirects', _config.outDir), trueRedirects.print());
					} catch (error) {
						logger.error('Failed to write _redirects file');
					}
				}
			},
		},
	};
}
