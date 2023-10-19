import { createRedirectsFromAstroRoutes } from '@astrojs/underscore-redirects';
import fs from 'node:fs';
import type { AstroConfig, RouteData } from 'astro';

export interface Args {
	builders: boolean;
	binaryMediaTypes?: string[];
	edgeMiddleware: boolean;
	functionPerRoute: boolean;
	runtime: 'v1' | 'v2';
}

export const clientAddressSymbol = Symbol.for('astro.clientAddress');
export const ASTRO_LOCALS_HEADER = 'x-astro-locals';

export async function createRedirects(
	config: AstroConfig,
	routeToDynamicTargetMap: Map<RouteData, string>,
	dir: URL
) {
	const _redirectsURL = new URL('./_redirects', dir);

	const _redirects = createRedirectsFromAstroRoutes({
		config,
		routeToDynamicTargetMap,
		dir,
	});
	const content = _redirects.print();

	// Always use appendFile() because the redirects file could already exist,
	// e.g. due to a `/public/_redirects` file that got copied to the output dir.
	// If the file does not exist yet, appendFile() automatically creates it.
	await fs.promises.appendFile(_redirectsURL, content, 'utf-8');
}
