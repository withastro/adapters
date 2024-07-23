import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = (ctx) => {
	const href = ctx.url.searchParams.get('href');
	if (!href) {
		return new Response("Missing 'href' query parameter", { status: 400 });
	}

	if (!href.startsWith('/_astro')) {
		return new Response("Invalid 'href' query parameter", { status: 400 });
	}

	return fetch(new URL(href, ctx.url.origin));
};
