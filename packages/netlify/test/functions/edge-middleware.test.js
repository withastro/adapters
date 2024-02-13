import { loadFixture } from '@astrojs/test-utils';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';

describe('Middleware', () => {
	const root = new URL('./fixtures/middleware/', import.meta.url);

	describe('edgeMiddleware: false', () => {
		let fixture;
		beforeEach(async () => {
			process.env.EDGE_MIDDLEWARE = 'false';
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('emits no edge function', async () => {
			assert.equal(fixture.pathExists('../.netlify/edge-functions/middleware/middleware.mjs'), false)
		});

		it('applies middleware to static files at build-time', async () => {
			// prerendered page has middleware applied at build time
			const prerenderedPage = await fixture.readFile('prerender/index.html');
			assert.equal(prerenderedPage.includes('<title>Middleware</title>'),true);
		});

		afterEach(() => {
			process.env.EDGE_MIDDLEWARE = undefined;
		})
	});

	describe('edgeMiddleware: true', () => {
		let fixture;
		beforeEach(async () => {
			process.env.EDGE_MIDDLEWARE = 'true';
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('emits an edge function', async () => {
			const contents = await fixture.readFile(
				'../.netlify/edge-functions/middleware/middleware.mjs'
			);
			assert.equal(contents.includes('"Hello world"'), false);
		});

		it.skip('does not apply middleware during prerendering', async () => {
			const prerenderedPage = await fixture.readFile('prerender/index.html');
			assert.equal(prerenderedPage.includes('<title></title>'),true);
		});

		afterEach(() => {
			process.env.EDGE_MIDDLEWARE = undefined;
		})
	});
});
