import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { App } from 'astro/app';
import type { Options } from './types.js';

const isSubresourceRegex = /.+\.[a-z]+$/i;

export function createStaticHandler(app: App, options: Options) {
	const client = resolveClientDir(options);

	return async (req: Request, ssr: () => Promise<Response>): Promise<Response> => {
		const url = new URL(req.url);
		let pathname = url.pathname;

		const { trailingSlash = 'ignore' } = options;
		const hasSlash = pathname.endsWith('/');

		switch (trailingSlash) {
			case 'never':
				if (pathname !== '/' && hasSlash) {
					return new Response(null, {
						status: 301,
						headers: { Location: pathname.slice(0, -1) + url.search },
					});
				}
				break;
			case 'always':
				if (!hasSlash && !isSubresourceRegex.test(pathname)) {
					return new Response(null, {
						status: 301,
						headers: { Location: `${pathname}/${url.search}` },
					});
				}
				break;
			case 'ignore':
				if (hasSlash) {
					pathname += 'index.html';
				}
				break;
		}

		const filePath = join(client, pathname);

		try {
			const file = Bun.file(filePath);
			if (await file.exists()) {
				const response = new Response(file);

				if (pathname.startsWith(`/${options.assets}/`)) {
					response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
				}

				return response;
			}
		} catch (err) {
			console.error(`Error serving static file: ${filePath}`, err);
		}

		return ssr();
	};
}

function resolveClientDir(options: Options): string {
	const clientURLRaw = new URL(options.client);
	const serverURLRaw = new URL(options.server);
	const rel = relative(fileURLToPath(serverURLRaw), fileURLToPath(clientURLRaw));

	const serverFolder = basename(options.server);
	let serverEntryFolderURL = dirname(import.meta.url);
	while (!serverEntryFolderURL.endsWith(serverFolder)) {
		serverEntryFolderURL = dirname(serverEntryFolderURL);
	}

	const serverEntryURL = `${serverEntryFolderURL}/entry.mjs`;
	const clientURL = new URL(appendForwardSlash(rel), serverEntryURL);
	return fileURLToPath(clientURL);
}

function appendForwardSlash(pth: string): string {
	return pth.endsWith('/') ? pth : `${pth}/`;
}
