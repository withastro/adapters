import type { AstroIntegration } from 'astro';
import { writeFile, rmdir, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

export default function netlifyIntegration(): AstroIntegration {
	let rootDir: URL;
	let astroMiddlewareEntryPoint: URL | undefined = undefined;

	const ssrOutputDir = () => new URL('./.netlify/functions-internal/ssr/', rootDir);
	const middlewareOutputDir = () => new URL('.netlify/edge-functions/middleware/', rootDir);

	const cleanFunctions = async () => {
		try {
			await rmdir(middlewareOutputDir());
		} catch {}
		try {
			await rmdir(ssrOutputDir());
		} catch {}
	};

	return {
		name: '@astrojs/netlify',
		hooks: {
			'astro:config:setup': async ({ config, updateConfig }) => {
				rootDir = config.root;
				await cleanFunctions();

				const outDir = new URL('./dist/', rootDir);

				// todo: put config.image.remotePatterns and config.image.domains into netlify.toml
				updateConfig({
					outDir,
					build: {
						redirects: false,
						client: outDir,
						server: ssrOutputDir(),
					},
					image: {
						service: {
							entrypoint: '@astrojs/netlify/image-service.js',
						},
					},
				});
			},
			'astro:config:done': ({ config, setAdapter }) => {
				rootDir = config.root;

				if (config.output === 'static') {
					// eslint-disable-next-line no-console
					console.warn(
						`[@astrojs/netlify] \`output: "server"\` or \`output: "hybrid"\` is required to use this adapter.`
					);
					return;
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
			'astro:build:done': async () => {
        // TODO: create redirects file
        
				// Finalizing SSR function
				await writeFile(
					new URL('./ssr.mjs', ssrOutputDir()),
					`
						import ssrRoute from './entry.mjs';
						export default ssrRoute;
						export const config = { name: "Astro SSR", generator: "@astrojs/netlify@TODO", path: "/*", preferStatic: true };
					`
				);

				if (astroMiddlewareEntryPoint) {
					await mkdir(middlewareOutputDir(), { recursive: true });
					await writeFile(
						new URL('./entry.mjs', middlewareOutputDir()),
						`
						import { onRequest } from "${fileURLToPath(astroMiddlewareEntryPoint)}";
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
							generator: "@astrojs/netlify@TODO",
							path: "/*", excludedPath: ["/_astro/*", "/.netlify/images/*"]
						};
						`
					);

					// taking over bundling, because Netlify's bundling trips over NPM modules
					await build({
						entryPoints: [fileURLToPath(new URL('./entry.mjs', middlewareOutputDir()))],
						target: 'es2022',
						platform: 'node',
						outfile: fileURLToPath(new URL('./middleware.mjs', middlewareOutputDir())),
						allowOverwrite: true,
						format: 'esm',
						bundle: true,
						minify: false,
						banner: {
							js: `
							globalThis.process = {
								argv: [],
								env: Deno.env.toObject(),
							};
							`,
						},
					});

					const edgeFunctionDirectory = new URL('./.netlify/edge-functions/', rootDir);
					const importMap = {
						imports: {
							crypto: 'node:crypto',
							buffer: 'node:buffer',
						},
					};
					await writeFile(
						new URL('import_map.json', edgeFunctionDirectory),
						JSON.stringify(importMap, null, 2)
					);

					const manifest = {
						version: 1,
						import_map: 'import_map.json',
					};
					await writeFile(
						new URL('manifest.json', edgeFunctionDirectory),
						JSON.stringify(manifest, null, 2)
					);
				}
			},
		},
	};
}
