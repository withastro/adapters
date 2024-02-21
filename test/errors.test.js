import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as cheerio from 'cheerio';
import nodejs from '../dist/index.js';
import { loadFixture } from './test-utils.js';

describe('Errors', () => {
	let fixture;
	before(async () => {
		fixture = await loadFixture({
			root: './fixtures/errors/',
			output: 'server',
			adapter: nodejs({ mode: 'standalone' }),
		});
		await fixture.build();
	});
	let devPreview;

	before(async () => {
		devPreview = await fixture.preview();
	});
	after(async () => {
		await devPreview.stop();
	});

	it(
		'rejected promise in template',
		{ skip: true, todo: 'Review the response from the in-stream' },
		async () => {
			const res = await fixture.fetch('/in-stream');
			const html = await res.text();
			const $ = cheerio.load(html);

			assert.equal($('p').text().trim(), 'Internal server error');
		}
	);

	it(
		'generator that throws called in template',
		{ skip: true, todo: 'Review the response from the generator' },
		async () => {
			const result = ['<!DOCTYPE html><h1>Astro</h1> 1', 'Internal server error'];

			/** @type {Response} */
			const res = await fixture.fetch('/generator');
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			const chunk1 = await reader.read();
			const chunk2 = await reader.read();
			const chunk3 = await reader.read();
			assert.equal(chunk1.done, false);
			console.log(chunk1);
			console.log(chunk2);
			console.log(chunk3);
			if (chunk2.done) {
				assert.equal(decoder.decode(chunk1.value), result.join(''));
			} else if (chunk3.done) {
				assert.equal(decoder.decode(chunk1.value), result[0]);
				assert.equal(decoder.decode(chunk2.value), result[1]);
			} else {
				throw new Error('The response should take at most 2 chunks.');
			}
		}
	);
});
