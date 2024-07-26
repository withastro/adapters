import * as assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadFixture } from '@astrojs/test-utils';
import * as cheerio from 'cheerio';

describe(
	'Included files',
	() => {
		let fixture;
		const root = new URL('./fixtures/includes/', import.meta.url);
		const expectedCwd = new URL(
			'.netlify/v1/functions/ssr/packages/netlify/test/functions/fixtures/includes/',
			root
		);

		before(async () => {
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('Includes files', async () => {
			const filesRoot = new URL('./files/', expectedCwd);
			const expectedFiles = ['include-this.txt', 'also-this.csv', 'subdirectory/and-this.csv'];

			for (const file of expectedFiles) {
				assert.ok(existsSync(new URL(file, filesRoot)), `Expected file ${file} to exist`);
			}

			const notExpectedFiles = ['subdirectory/not-this.csv', 'subdirectory/or-this.txt'];

			for (const file of notExpectedFiles) {
				assert.ok(!existsSync(new URL(file, filesRoot)), `Expected file ${file} to not exist`);
			}
		});

		it('Can load included files correctly', async () => {
			const entryURL = new URL(
				'./fixtures/includes/.netlify/v1/functions/ssr/ssr.mjs',
				import.meta.url
			);
			const { default: handler } = await import(entryURL);
			const resp = await handler(new Request('http://example.com/'), {});
			const html = await resp.text();
			const $ = cheerio.load(html);
			assert.equal($('h1').text(), 'hello');
			assert.equal($('p').text(), fileURLToPath(expectedCwd).slice(0, -1));
		});

		it('Includes traced node modules with symlinks', async () => {
			const expected = new URL(
				'.netlify/v1/functions/ssr/node_modules/.pnpm/cowsay@1.6.0/node_modules/cowsay/cows/happy-whale.cow',
				root
			);
			console.log(expected.href);
			assert.ok(existsSync(expected, 'Expected excluded file to exist in default build'));
		});
	},
	{
		timeout: 120000,
	}
);

describe(
	'Excluded files',
	() => {
		let fixture;
		const root = new URL('./fixtures/excludes/', import.meta.url);

		before(async () => {
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('Excludes traced node modules', async () => {
			const expected = new URL(
				'.netlify/v1/functions/ssr/node_modules/.pnpm/cowsay@1.6.0/node_modules/cowsay/cows/happy-whale.cow',
				root
			);
			assert.ok(!existsSync(expected, 'Expected excluded file to not exist in build'));
		});
	},
	{
		timeout: 120000,
	}
);
