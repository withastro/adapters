import { type Handler, builder } from '@netlify/functions';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { applyPolyfills } from 'astro/app/node';
import { ASTRO_LOCALS_HEADER } from './integration-functions.js';

applyPolyfills();

export interface Args {
	builders?: boolean;
	binaryMediaTypes?: string[];
	edgeMiddleware: boolean;
	functionPerRoute: boolean;
}

function parseContentType(header?: string) {
	return header?.split(';')[0] ?? '';
}

const clientAddressSymbol = Symbol.for('astro.clientAddress');

export const createExports = (manifest: SSRManifest, args: Args) => {
	const app = new App(manifest);

	const builders = args.builders ?? false;
	const binaryMediaTypes = args.binaryMediaTypes ?? [];
	const knownBinaryMediaTypes = new Set([
		'audio/3gpp',
		'audio/3gpp2',
		'audio/aac',
		'audio/midi',
		'audio/mpeg',
		'audio/ogg',
		'audio/opus',
		'audio/wav',
		'audio/webm',
		'audio/x-midi',
		'image/avif',
		'image/bmp',
		'image/gif',
		'image/vnd.microsoft.icon',
		'image/heif',
		'image/jpeg',
		'image/png',
		'image/svg+xml',
		'image/tiff',
		'image/webp',
		'video/3gpp',
		'video/3gpp2',
		'video/mp2t',
		'video/mp4',
		'video/mpeg',
		'video/ogg',
		'video/x-msvideo',
		'video/webm',
		...binaryMediaTypes,
	]);

	const myHandler: Handler = async (event) => {
		const { httpMethod, headers, rawUrl, body: requestBody, isBase64Encoded } = event;
		const init: RequestInit = {
			method: httpMethod,
			headers: new Headers(headers as any),
		};
		// Attach the event body the request, with proper encoding.
		if (httpMethod !== 'GET' && httpMethod !== 'HEAD') {
			const encoding = isBase64Encoded ? 'base64' : 'utf-8';
			init.body =
				typeof requestBody === 'string' ? Buffer.from(requestBody, encoding) : requestBody;
		}

		const request = new Request(rawUrl, init);

		const routeData = app.match(request);
		const ip = headers['x-nf-client-connection-ip'];
		Reflect.set(request, clientAddressSymbol, ip);

		let locals: Record<string, unknown> = {};

		if (request.headers.has(ASTRO_LOCALS_HEADER)) {
			let localsAsString = request.headers.get(ASTRO_LOCALS_HEADER);
			if (localsAsString) {
				locals = JSON.parse(localsAsString);
			}
		}

		let responseTtl = undefined;

		locals.runtime = builders
			? {
					setBuildersTtl(ttl: number) {
						responseTtl = ttl;
					},
			  }
			: {};

		const response: Response = await app.render(request, routeData, locals);
		const responseHeaders = Object.fromEntries(response.headers.entries());

		const responseContentType = parseContentType(responseHeaders['content-type']);
		const responseIsBase64Encoded = knownBinaryMediaTypes.has(responseContentType);

		let responseBody: string;
		if (responseIsBase64Encoded) {
			const ab = await response.arrayBuffer();
			responseBody = Buffer.from(ab).toString('base64');
		} else {
			responseBody = await response.text();
		}

		const fnResponse: any = {
			statusCode: response.status,
			headers: responseHeaders,
			body: responseBody,
			isBase64Encoded: responseIsBase64Encoded,
			ttl: responseTtl,
		};

		const cookies = response.headers.get('set-cookie');
		if (cookies) {
			fnResponse.multiValueHeaders = {
				'set-cookie': Array.isArray(cookies) ? cookies : splitCookiesString(cookies),
			};
		}

		// Apply cookies set via Astro.cookies.set/delete
		if (app.setCookieHeaders) {
			const setCookieHeaders = Array.from(app.setCookieHeaders(response));
			fnResponse.multiValueHeaders = fnResponse.multiValueHeaders || {};
			if (!fnResponse.multiValueHeaders['set-cookie']) {
				fnResponse.multiValueHeaders['set-cookie'] = [];
			}
			fnResponse.multiValueHeaders['set-cookie'].push(...setCookieHeaders);
		}

		return fnResponse;
	};

	const handler = builders ? builder(myHandler) : myHandler;

	return { handler };
};

/*
	From: https://github.com/nfriedly/set-cookie-parser/blob/5cae030d8ef0f80eec58459e3583d43a07b984cb/lib/set-cookie.js#L144
  Set-Cookie header field-values are sometimes comma joined in one string. This splits them without choking on commas
  that are within a single set-cookie field-value, such as in the Expires portion.
  This is uncommon, but explicitly allowed - see https://tools.ietf.org/html/rfc2616#section-4.2
  Node.js does this for every header *except* set-cookie - see https://github.com/nodejs/node/blob/d5e363b77ebaf1caf67cd7528224b651c86815c1/lib/_http_incoming.js#L128
  React Native's fetch does this for *every* header, including set-cookie.
  Based on: https://github.com/google/j2objc/commit/16820fdbc8f76ca0c33472810ce0cb03d20efe25
  Credits to: https://github.com/tomball for original and https://github.com/chrusart for JavaScript implementation
*/
function splitCookiesString(cookiesString: string): string[] {
	if (Array.isArray(cookiesString)) {
		return cookiesString;
	}
	if (typeof cookiesString !== 'string') {
		return [];
	}

	let cookiesStrings = [];
	let pos = 0;
	let start;
	let ch;
	let lastComma;
	let nextStart;
	let cookiesSeparatorFound;

	function skipWhitespace() {
		while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
			pos += 1;
		}
		return pos < cookiesString.length;
	}

	function notSpecialChar() {
		ch = cookiesString.charAt(pos);

		return ch !== '=' && ch !== ';' && ch !== ',';
	}

	while (pos < cookiesString.length) {
		start = pos;
		cookiesSeparatorFound = false;

		while (skipWhitespace()) {
			ch = cookiesString.charAt(pos);
			if (ch === ',') {
				// ',' is a cookie separator if we have later first '=', not ';' or ','
				lastComma = pos;
				pos += 1;

				skipWhitespace();
				nextStart = pos;

				while (pos < cookiesString.length && notSpecialChar()) {
					pos += 1;
				}

				// currently special character
				if (pos < cookiesString.length && cookiesString.charAt(pos) === '=') {
					// we found cookies separator
					cookiesSeparatorFound = true;
					// pos is inside the next cookie, so back up and return it.
					pos = nextStart;
					cookiesStrings.push(cookiesString.substring(start, lastComma));
					start = pos;
				} else {
					// in param ',' or param separator ';',
					// we continue from that comma
					pos = lastComma + 1;
				}
			} else {
				pos += 1;
			}
		}

		if (!cookiesSeparatorFound || pos >= cookiesString.length) {
			cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
		}
	}

	return cookiesStrings;
}
