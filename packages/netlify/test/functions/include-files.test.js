import * as assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { loadFixture } from '@astrojs/test-utils';
import * as cheerio from 'cheerio';
import glob from 'fast-glob';

describe(
	'Included vite assets files',
	() => {
		let fixture;

		const root = new URL('./fixtures/includes/', import.meta.url);
		const expectedCwd = new URL('.netlify/v1/functions/ssr/packages/netlify/', root);

		const expectedAssetsInclude = ['./*.json'];
		const excludedAssets = ['./files/exclude-asset.json'];

		before(async () => {
			process.env.VITE_ASSETS_INCLUDE = expectedAssetsInclude.join();
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('Emits vite assets files', async () => {
			for (const pattern of expectedAssetsInclude) {
				const files = glob.sync(pattern);
				for (const file of files) {
					assert.ok(
						existsSync(new URL(file, expectedCwd)),
						`Expected file ${pattern} to exist in build`
					);
				}
			}
		});

		it('Does not include vite assets files when excluded', async () => {
			for (const file of excludedAssets) {
				assert.ok(
					!existsSync(new URL(file, expectedCwd)),
					`Expected file ${file} to not exist in build`
				);
			}
		});

		after(async () => {
			process.env.VITE_ASSETS_INCLUDE = undefined;
			await fixture.clean();
		});
	},
	{
		timeout: 120000,
	}
);

describe(
	'Included files',
	() => {
		let fixture;

		const root = new URL('./fixtures/includes/', import.meta.url);
		const expectedCwd = new URL(
			'.netlify/v1/functions/ssr/packages/netlify/test/functions/fixtures/includes/',
			root
		);

		const expectedFiles = [
			'./files/include-this.txt',
			'./files/also-this.csv',
			'./files/subdirectory/and-this.csv',
		];

		before(async () => {
			process.env.INCLUDE_FILES = expectedFiles.join();
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('Emits include files', async () => {
			for (const file of expectedFiles) {
				assert.ok(existsSync(new URL(file, expectedCwd)), `Expected file ${file} to exist`);
			}
		});

		it('Can load included files correctly', async () => {
			const entryURL = new URL(
				'./fixtures/includes/.netlify/v1/functions/ssr/ssr.mjs',
				import.meta.url
			);
			const { default: handler } = await import(entryURL);
			const resp = await handler(new Request('http://example.com/?file=include-this.txt'), {});
			const html = await resp.text();
			const $ = cheerio.load(html);
			assert.equal($('h1').text(), 'hello');
		});

		it('Includes traced node modules with symlinks', async () => {
			const expected = new URL(
				'.netlify/v1/functions/ssr/node_modules/.pnpm/cowsay@1.6.0/node_modules/cowsay/cows/happy-whale.cow',
				root
			);
			assert.ok(existsSync(expected, 'Expected excluded file to exist in default build'));
		});

		after(async () => {
			process.env.INCLUDE_FILES = undefined;
			await fixture.clean();
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

		const root = new URL('./fixtures/includes/', import.meta.url);
		const expectedCwd = new URL(
			'.netlify/v1/functions/ssr/packages/netlify/test/functions/fixtures/includes/',
			root
		);

		const includeFiles = ['./files/**/*.txt'];
		const excludedTxt = ['./files/subdirectory/not-this.txt', './files/subdirectory/or-this.txt'];
		const excludeFiles = [...excludedTxt, '../../../../../../node_modules/.pnpm/cowsay@*/**'];

		before(async () => {
			process.env.INCLUDE_FILES = includeFiles.join();
			process.env.EXCLUDE_FILES = excludeFiles.join();
			fixture = await loadFixture({ root });
			await fixture.build();
		});

		it('Excludes traced node modules', async () => {
			const expected = new URL(
				'.netlify/v1/functions/ssr/node_modules/.pnpm/cowsay@1.6.0/node_modules/cowsay/cows/happy-whale.cow',
				root
			);
			assert.ok(!existsSync(expected), 'Expected excluded file to not exist in build');
		});

		it('Does not include files when excluded', async () => {
			for (const pattern of includeFiles) {
				const files = glob.sync(pattern, { ignore: excludedTxt });
				for (const file of files) {
					assert.ok(
						existsSync(new URL(file, expectedCwd)),
						`Expected file ${pattern} to exist in build`
					);
				}
			}
			for (const file of excludedTxt) {
				assert.ok(
					!existsSync(new URL(file, expectedCwd)),
					`Expected file ${file} to not exist in build`
				);
			}
		});

		after(async () => {
			process.env.INCLUDE_FILES = undefined;
			process.env.EXCLUDE_FILES = undefined;
			await fixture.clean();
		});
	},
	{
		timeout: 120000,
	}
);
