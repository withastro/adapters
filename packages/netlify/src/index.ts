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

const isStaticRedirect = (route: RouteData) => route.type === 'redirect' && route.redirectRoute;

const clearDirectory = (dir: URL) => rm(dir, { recursive: true }).catch(() => {});

export default function netlifyIntegration(): AstroIntegration {
	let _config: AstroConfig;
	let outDir: URL;
	let rootDir: URL;
	let astroMiddlewareEntryPoint: URL | undefined = undefined;

	const ssrOutputDir = () => new URL('./.netlify/functions-internal/ssr/', rootDir);
	const middlewareOutputDir = () => new URL('.netlify/edge-functions/middleware/', rootDir);

	const cleanFunctions = async () =>
		await Promise.all([
			clearDirectory(middlewareOutputDir()),
			clearDirectory(ssrOutputDir())
		]);

	async function writeRedirects(routes: RouteData[], dir: URL) {
		const redirects = createRedirectsFromAstroRoutes({
			config: _config,
			dir,
			routeToDynamicTargetMap: new Map(
				routes
					.filter(isStaticRedirect) // all other routes are handled by SSR
					.map((route) => [route, '/.netlify/functions/ssr/']) // we don't really want any redirect to point to SSR, but we need to provide a target and this is a good fallback
			),
		});

		if (!redirects.empty()) {
			await appendFile(new URL('_redirects', outDir), '\n' + redirects.print() + '\n');
		}
	}

	async function writeSSRFunction() {
		await writeFile(
			new URL('./ssr.mjs', ssrOutputDir()),
			`
				import ssrRoute from './entry.mjs';
				export default ssrRoute;
				export const config = { name: "Astro SSR", generator: "@astrojs/netlify@${packageVersion}", path: "/*", preferStatic: true };
			`
		);
	}

	async function writeMiddleware(entrypoint: URL) {
		await mkdir(middlewareOutputDir(), { recursive: true });
		await writeFile(
			new URL('./entry.mjs', middlewareOutputDir()),
			`
						import { onRequest } from "${fileURLToPath(entrypoint)}";
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
							path: "/*", excludedPath: ["/_astro/*", "/.netlify/images/*"]
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
						edgeMiddleware: true,
					},
					supportedAstroFeatures: {
						hybridOutput: 'stable',
						staticOutput: 'stable',
						serverOutput: 'stable',
						assets: {
							supportKind: 'stable',
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

				if (_config.output !== "static") {
					await writeSSRFunction();
					logger.info('Generated SSR Function');
				}

				if (astroMiddlewareEntryPoint) {
					await writeMiddleware(astroMiddlewareEntryPoint);
					logger.info('Generated Middleware Edge Function');
				}
			},
		},
	};
}
