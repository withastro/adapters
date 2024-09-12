import type { SSRManifest } from 'astro';

export interface UserOptions {
	mode: 'middleware' | 'standalone';
}

export interface Options extends UserOptions {
	host: string | boolean;
	port: number;
	server: string;
	client: string;
	assets: string;
	trailingSlash?: SSRManifest['trailingSlash'];
}

export type RequestHandler = (req: Request) => Response | Promise<Response>;
