import type { AstroConfig, AstroIntegration, RouteData } from 'astro';
import { writeFile, mkdir, appendFile, rm } from 'fs/promises';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import { createRedirectsFromAstroRoutes } from '@astrojs/underscore-redirects';
import { version as packageVersion } from '../package.json';
import type { Context } from '@netlify/functions';
import { AstroError } from 'astro/errors';

export interface NetlifyLocals {
	netlify: {
		context: Context;
	};
}

const isStaticRedirect = (route: RouteData) =>
	route.type === 'redirect' && (route.redirect || route.redirectRoute);

const clearDirectory = (dir: URL) => rm(dir, { recursive: true }).catch(() => {});

export interface NetlifyIntegrationConfig {
	/**
	 * If enabled, On-Demand-Rendered pages are cached for up to a year.
	 * This is useful for pages that are not updated often, like a blog post,
	 * but that you have too many of to pre-render at build time.
	 *
	 * You can override this behavior on a per-page basis
	 * by setting the `Cache-Control`, `CDN-Cache-Control` or `Netlify-CDN-Cache-Control` header
	 * from within the Page:
	 *
	 * ```astro
	 * // src/pages/cached-clock.astro
	 * Astro.response.headers.set('CDN-Cache-Control', "public, max-age=45, must-revalidate");
	 * ---
	 * <p>{Date.now()}</p>
	 * ```
	 */
	cacheOnDemandPages?: boolean;

	/**
	 * If disabled, Middleware is applied to prerendered pages at build-time, and to on-demand-rendered pages at runtime.
	 * Only disable when your Middleware does not need to run on prerendered pages.
	 * If you use Middleware to implement authentication, redirects or similar things, you should should likely enabled it.
	 * 
	 * If enabled, Astro Middleware is deployed as an Edge Function and applies to all routes.
	 * Caveat: Locals set in Middleware are not applied to prerendered pages, because they've been rendered at build-time and are served from the CDN.
	 * 
	 * @default disabled
	 */
	edgeMiddleware?: boolean;

	/**
	 * If enabled, on-demand-rendered/SSR pages are deployed via Netlify Edge Functions.
	 * If your rendering can happen fully on the edge, e.g. without querying from a central database,
	 * this can improve your TTFB by running closer to the user.
	 * This also changes the underlying runtime to Deno, which can break some code that relies on Node.js APIs.
	 * 
	 * @default disabled
	 */
	edgeSSR?: boolean;
}

export default function netlifyIntegration(
	integrationConfig?: NetlifyIntegrationConfig
): AstroIntegration {
	let _config: AstroConfig;
	let outDir: URL;
	let rootDir: URL;
	let astroMiddlewareEntryPoint: URL | undefined = undefined;

	const ssrOutputDir = () => new URL('./.netlify/functions-internal/ssr/', rootDir);
	const edgeSsrOutputDir = () => new URL('./.netlify/edge-functions/ssr/', rootDir);
	const middlewareOutputDir = () => new URL('.netlify/edge-functions/middleware/', rootDir);

	const cleanFunctions = async () =>
		await Promise.all([
			clearDirectory(middlewareOutputDir()),
			clearDirectory(ssrOutputDir()),
			clearDirectory(edgeSsrOutputDir()),
		]);

	async function writeRedirects(routes: RouteData[], dir: URL) {
		const fallback = _config.output === 'static' ? '/.netlify/static' : '/.netlify/functions/ssr';
		const redirects = createRedirectsFromAstroRoutes({
			config: _config,
			dir,
			routeToDynamicTargetMap: new Map(
				routes
					.filter(isStaticRedirect) // all other routes are handled by SSR
					.map((route) => {
						// this is needed to support redirects to dynamic routes
						// on static. not sure why this is needed, but it works.
						route.distURL ??= route.redirectRoute?.distURL;

						return [route, fallback];
					})
			),
		});

		if (!redirects.empty()) {
			await appendFile(new URL('_redirects', outDir), '\n' + redirects.print() + '\n');
		}
	}

	const ssrHandlerConfig = JSON.stringify({
		cacheOnDemandPages: Boolean(integrationConfig?.cacheOnDemandPages),
	});

	async function writeSSRFunction() {
		await writeFile(
			new URL('./ssr.mjs', ssrOutputDir()),
			`
			import createSSRHandler from './entry.mjs';
			export default createSSRHandler(${ssrHandlerConfig});
			export const config = {
				name: "Astro SSR",
				generator: "@astrojs/netlify@${packageVersion}",
				path: "/*",
				preferStatic: true
			};
			`
		);
	}

	async function writeSSREdgeFunction(routes: RouteData[]) {
		await mkdir(edgeSsrOutputDir(), { recursive: true });
		const staticRoutes = routes.flatMap((route) => {
			if (!route.prerender) return [];
			if (!route.pathname) return [];
			return [route.pathname, route.pathname + '/', route.pathname + '/index.html'];
		});
		const excludedPatterns = ['/.netlify/images', '/_astro/*', ...staticRoutes];
		await writeFile(
			new URL('./entry.mjs', edgeSsrOutputDir()),
			`
			import createSSRHandler from '../../functions-internal/ssr/entry.mjs';
			export default createSSRHandler(${ssrHandlerConfig});
			export const config = {
				name: "Astro SSR",
				generator: "@astrojs/netlify@${packageVersion}",
				cache: "manual",
				path: "/*",
				excludedPath: ${JSON.stringify(excludedPatterns)},
			};
			`
		);

		// taking over bundling, because Netlify bundling trips over NPM modules
		await build({
			entryPoints: [fileURLToPath(new URL('./entry.mjs', edgeSsrOutputDir()))],
			target: 'es2022',
			platform: 'neutral',
			mainFields: ['module', 'main', 'browser'],
			external: ['sharp', 'node:*'],
			outfile: fileURLToPath(new URL('./ssr.mjs', edgeSsrOutputDir())),
			allowOverwrite: true,
			format: 'esm',
			bundle: true,
			minify: false,
		});
	}

	async function writeMiddleware(entrypoint: URL) {
		await mkdir(middlewareOutputDir(), { recursive: true });
		await writeFile(
			new URL('./entry.mjs', middlewareOutputDir()),
			`
			import { onRequest } from "${fileURLToPath(entrypoint).replaceAll('\\', '/')}";
			import { createContext, trySerializeLocals } from 'astro/middleware';

			export default async (request, context) => {
				const ctx = createContext({ 
					request,
					params: {}
				});
				ctx.locals = { netlify: { context } }
				const next = () => {
					const { netlify, ...otherLocals } = ctx.locals;
					request.headers.set("x-astro-locals", trySerializeLocals(otherLocals));
					return context.next();
				};
			
				return onRequest(ctx, next);
			}

			export const config = {
				name: "Astro Middleware",
				generator: "@astrojs/netlify@${packageVersion}",
				path: "/*", excludedPath: ["/_astro/*", "/.netlify/images"]
			};
			`
		);

		// taking over bundling, because Netlify bundling trips over NPM modules
		await build({
			entryPoints: [fileURLToPath(new URL('./entry.mjs', middlewareOutputDir()))],
			target: 'es2022',
			platform: 'neutral',
			outfile: fileURLToPath(new URL('./middleware.mjs', middlewareOutputDir())),
			allowOverwrite: true,
			format: 'esm',
			bundle: true,
			minify: false,
		});
	}

	return {
		name: '@astrojs/netlify',
		hooks: {
			'astro:config:setup': async ({ config, updateConfig }) => {
				rootDir = config.root;
				await cleanFunctions();

				outDir = new URL('./dist/', rootDir);

				const isRunningInNetlify = Boolean(
					process.env.NETLIFY || process.env.NETLIFY_LOCAL || process.env.NETLIFY_DEV
				);

				updateConfig({
					outDir,
					build: {
						redirects: false,
						client: outDir,
						server: ssrOutputDir(),
					},
					vite: {
						server: {
							watch: {
								ignored: [fileURLToPath(new URL('./.netlify/**', rootDir))],
							},
						},
					},
					image: {
						service: {
							entrypoint: isRunningInNetlify ? '@astrojs/netlify/image-service.js' : undefined,
						},
					},
				});
			},
			'astro:config:done': ({ config, setAdapter }) => {
				rootDir = config.root;
				_config = config;

				if (config.image.domains.length || config.image.remotePatterns.length) {
					throw new AstroError(
						"config.image.domains and config.image.remotePatterns aren't supported by the Netlify adapter.",
						'See https://github.com/withastro/adapters/tree/main/packages/netlify#image-cdn for more.'
					);
				}

				setAdapter({
					name: '@astrojs/netlify',
					serverEntrypoint: '@astrojs/netlify/ssr-function.js',
					exports: ['default'],
					adapterFeatures: {
						functionPerRoute: false,
						edgeMiddleware: integrationConfig?.edgeMiddleware ?? true,
					},
					supportedAstroFeatures: {
						hybridOutput: 'stable',
						staticOutput: 'stable',
						serverOutput: 'stable',
						assets: {
							// keeping this as experimental at least until Netlify Image CDN is out of beta
							supportKind: 'experimental',
							// still using Netlify Image CDN instead
							isSharpCompatible: true,
							isSquooshCompatible: true,
						},
					},
				});
			},
			'astro:build:ssr': async ({ middlewareEntryPoint }) => {
				astroMiddlewareEntryPoint = middlewareEntryPoint;
			},
			'astro:build:done': async ({ routes, dir, logger }) => {
				await writeRedirects(routes, dir);
				logger.info('Emitted _redirects');

				if (_config.output !== 'static') {
					if (integrationConfig?.edgeSSR) {
						await writeSSREdgeFunction(routes);
						logger.info('Generated SSR Edge Function');
					} else {
						await writeSSRFunction();
						logger.info('Generated SSR Function');
					}
				}

				if (astroMiddlewareEntryPoint) {
					await writeMiddleware(astroMiddlewareEntryPoint);
					logger.info('Generated Middleware Edge Function');
				}
			},
		},
	};
}
