import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRedirectsFromAstroRoutes } from '@astrojs/underscore-redirects';
import type { Context } from '@netlify/functions';
import type { AstroConfig, AstroIntegration, AstroIntegrationLogger, RouteData } from 'astro';
import { AstroError } from 'astro/errors';
import { build } from 'esbuild';
import type { Args } from './ssr-function.js';

const { version: packageVersion } = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8')
);

export interface NetlifyLocals {
	netlify: {
		context: Context;
	};
}

const isStaticRedirect = (route: RouteData) =>
	route.type === 'redirect' && (route.redirect || route.redirectRoute);

const clearDirectory = (dir: URL) => rm(dir, { recursive: true }).catch(() => {});

type RemotePattern = AstroConfig['image']['remotePatterns'][number];

/**
 * Convert a remote pattern object to a regex string
 */
export function remotePatternToRegex(
	pattern: RemotePattern,
	logger: AstroIntegrationLogger
): string | undefined {
	let { protocol, hostname, port, pathname } = pattern;

	let regexStr = '';

	if (protocol) {
		regexStr += `${protocol}://`;
	} else {
		// Default to matching any protocol
		regexStr += '[a-z]+://';
	}

	if (hostname) {
		if (hostname.startsWith('**.')) {
			// match any number of subdomains
			regexStr += '([a-z0-9]+\\.)*';
			hostname = hostname.substring(3);
		} else if (hostname.startsWith('*.')) {
			// match one subdomain
			regexStr += '([a-z0-9]+\\.)?';
			hostname = hostname.substring(2); // Remove '*.' from the beginning
		}
		// Escape dots in the hostname
		regexStr += hostname.replace(/\./g, '\\.');
	} else {
		regexStr += '[a-z0-9.-]+';
	}

	if (port) {
		regexStr += `:${port}`;
	} else {
		// Default to matching any port
		regexStr += '(:[0-9]+)?';
	}

	if (pathname) {
		if (pathname.endsWith('/**')) {
			// Match any path.
			regexStr += `(\\${pathname.replace('/**', '')}.*)`;
		}
		if (pathname.endsWith('/*')) {
			// Match one level of path
			regexStr += `(\\${pathname.replace('/*', '')}\/[^/?#]+)\/?`;
		} else {
			// Exact match
			regexStr += `(\\${pathname})`;
		}
	} else {
		// Default to matching any path
		regexStr += '(\\/[^?#]*)?';
	}
	if (!regexStr.endsWith('.*)')) {
		// Match query, but only if it's not already matched by the pathname
		regexStr += '([?][^#]*)?';
	}
	try {
		new RegExp(regexStr);
	} catch (e) {
		logger.warn(
			`Could not generate a valid regex from the remotePattern "${JSON.stringify(
				pattern
			)}". Please check the syntax.`
		);
		return undefined;
	}
	return regexStr;
}

async function writeNetlifyDeployConfig(config: AstroConfig, logger: AstroIntegrationLogger) {
	const remoteImages: Array<string> = [];
	// Domains get a simple regex match
	remoteImages.push(
		...config.image.domains.map((domain) => `https?:\/\/${domain.replaceAll('.', '\\.')}\/.*`)
	);
	// Remote patterns need to be converted to regexes
	remoteImages.push(
		...config.image.remotePatterns
			.map((pattern) => remotePatternToRegex(pattern, logger))
			.filter(Boolean as unknown as (pattern?: string) => pattern is string)
	);

	// See https://docs.netlify.com/image-cdn/create-integration/
	const deployConfigDir = new URL('.netlify/deploy/v1/', config.root);
	await mkdir(deployConfigDir, { recursive: true });
	await writeFile(
		new URL('./config.json', deployConfigDir),
		JSON.stringify({
			images: { remote_images: remoteImages },
		})
	);
}

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
	 * @default {false}
	 */
	edgeMiddleware?: boolean;

	/**
	 * If enabled, Netlify Image CDN is used for image optimization.
	 * This transforms images on-the-fly without impacting build times.
	 *
	 * If disabled, Astro's built-in image optimization is run at build-time instead.
	 *
	 * @default {true}
	 */
	imageCDN?: boolean;
}

export default function netlifyIntegration(
	integrationConfig?: NetlifyIntegrationConfig
): AstroIntegration {
	const isRunningInNetlify = Boolean(
		process.env.NETLIFY || process.env.NETLIFY_LOCAL || process.env.NETLIFY_DEV
	);

	let _config: AstroConfig;
	let outDir: URL;
	let rootDir: URL;
	let astroMiddlewareEntryPoint: URL | undefined = undefined;
	// Secret used to verify that the caller is the astro-generated edge middleware and not a third-party
	const middlewareSecret = randomUUID();

	const ssrOutputDir = () => new URL('./.netlify/functions-internal/ssr/', rootDir);
	const middlewareOutputDir = () => new URL('.netlify/edge-functions/middleware/', rootDir);

	const cleanFunctions = async () =>
		await Promise.all([clearDirectory(middlewareOutputDir()), clearDirectory(ssrOutputDir())]);

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
			await appendFile(new URL('_redirects', outDir), `\n${redirects.print()}\n`);
		}
	}

	async function writeSSRFunction(notFoundContent?: string) {
		await writeFile(
			new URL('./ssr.mjs', ssrOutputDir()),
			`
				import createSSRHandler from './entry.mjs';
				export default createSSRHandler(${JSON.stringify({
					cacheOnDemandPages: Boolean(integrationConfig?.cacheOnDemandPages),
					notFoundContent,
				})});
				export const config = { name: "Astro SSR", generator: "@astrojs/netlify@${packageVersion}", path: "/*", preferStatic: true };
			`
		);
	}

	async function writeMiddleware(entrypoint: URL) {
		await mkdir(middlewareOutputDir(), { recursive: true });
		await writeFile(
			new URL('./entry.mjs', middlewareOutputDir()),
			/* ts */ `
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
					request.headers.set("x-astro-middleware-secret", "${middlewareSecret}");
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
			mainFields: ['module', 'main'],
			outfile: fileURLToPath(new URL('./middleware.mjs', middlewareOutputDir())),
			allowOverwrite: true,
			format: 'esm',
			bundle: true,
			minify: false,
		});
	}

	function getLocalDevNetlifyContext(req: IncomingMessage): Context {
		const isHttps = req.headers['x-forwarded-proto'] === 'https';
		const parseBase64JSON = <T = unknown>(header: string): T | undefined => {
			if (typeof req.headers[header] === 'string') {
				try {
					return JSON.parse(Buffer.from(req.headers[header] as string, 'base64').toString('utf8'));
				} catch {}
			}
		};

		const context: Context = {
			account: parseBase64JSON('x-nf-account-info') ?? {
				id: 'mock-netlify-account-id',
			},
			deploy: {
				id:
					typeof req.headers['x-nf-deploy-id'] === 'string'
						? req.headers['x-nf-deploy-id']
						: 'mock-netlify-deploy-id',
			},
			site: parseBase64JSON('x-nf-site-info') ?? {
				id: 'mock-netlify-site-id',
				name: 'mock-netlify-site.netlify.app',
				url: `${isHttps ? 'https' : 'http'}://localhost:${isRunningInNetlify ? 8888 : 4321}`,
			},
			geo: parseBase64JSON('x-nf-geo') ?? {
				city: 'Mock City',
				country: { code: 'mock', name: 'Mock Country' },
				subdivision: { code: 'SD', name: 'Mock Subdivision' },

				// @ts-expect-error: these are smhw missing from the Netlify types - fix is on the way
				timezone: 'UTC',
				longitude: 0,
				latitude: 0,
			},
			ip:
				typeof req.headers['x-nf-client-connection-ip'] === 'string'
					? req.headers['x-nf-client-connection-ip']
					: req.socket.remoteAddress ?? '127.0.0.1',
			server: {
				region: 'local-dev',
			},
			requestId:
				typeof req.headers['x-nf-request-id'] === 'string'
					? req.headers['x-nf-request-id']
					: 'mock-netlify-request-id',
			get cookies(): never {
				throw new Error('Please use Astro.cookies instead.');
			},
			json: (input) => Response.json(input),
			log: console.log,
			next: () => {
				throw new Error('`context.next` is not implemented for serverless functions');
			},
			get params(): never {
				throw new Error("context.params don't contain any usable content in Astro.");
			},
			rewrite() {
				throw new Error('context.rewrite is not available in Astro.');
			},
		};

		return context;
	}

	return {
		name: '@astrojs/netlify',
		hooks: {
			'astro:config:setup': async ({ config, updateConfig }) => {
				rootDir = config.root;
				await cleanFunctions();

				outDir = new URL('./dist/', rootDir);

				const enableImageCDN = isRunningInNetlify && (integrationConfig?.imageCDN ?? true);

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
							entrypoint: enableImageCDN ? '@astrojs/netlify/image-service.js' : undefined,
						},
					},
				});
			},
			'astro:config:done': async ({ config, setAdapter, logger }) => {
				rootDir = config.root;
				_config = config;

				if (config.image?.domains?.length || config.image?.remotePatterns?.length) {
					await writeNetlifyDeployConfig(config, logger);
				}

				const edgeMiddleware = integrationConfig?.edgeMiddleware ?? false;

				setAdapter({
					name: '@astrojs/netlify',
					serverEntrypoint: '@astrojs/netlify/ssr-function.js',
					exports: ['default'],
					adapterFeatures: {
						functionPerRoute: false,
						edgeMiddleware,
					},
					args: { middlewareSecret } satisfies Args,
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
					let notFoundContent = undefined;
					try {
						notFoundContent = await readFile(new URL('./404.html', dir), 'utf8');
					} catch {}
					await writeSSRFunction(notFoundContent);
					logger.info('Generated SSR Function');
				}

				if (astroMiddlewareEntryPoint) {
					await writeMiddleware(astroMiddlewareEntryPoint);
					logger.info('Generated Middleware Edge Function');
				}
			},

			// local dev
			'astro:server:setup': async ({ server }) => {
				server.middlewares.use((req, res, next) => {
					const locals = Symbol.for('astro.locals');
					Reflect.set(req, locals, {
						...Reflect.get(req, locals),
						netlify: { context: getLocalDevNetlifyContext(req) },
					});
					next();
				});
			},
		},
	};
}
