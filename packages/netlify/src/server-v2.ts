import { App } from 'astro/app';
import { applyPolyfills } from 'astro/app/node';
import { clientAddressSymbol, ASTRO_LOCALS_HEADER, type Args } from './shared.js';
import type { Context } from '@netlify/functions';
import type { SSRManifest } from 'astro';

applyPolyfills();

export function createExports (manifest: SSRManifest, _args: Args) {
	const app = new App(manifest);

	return {
        default(request: Request, context: Context) {

            const stringifiedLocals = request.headers.get(ASTRO_LOCALS_HEADER) ?? '{}';
            const locals: Record<string, unknown> = Object.assign(JSON.parse(stringifiedLocals), { context });
            
            Reflect.set(request, clientAddressSymbol, context.ip);

            return app.render(request, undefined, locals);
        },
    };
};
