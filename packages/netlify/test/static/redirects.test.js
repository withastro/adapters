import { expect } from 'chai';

import { cli } from '../test-utils.js';
import { fileURLToPath } from 'node:url';
import * as fs from "node:fs/promises"

const root = new URL('./fixtures/redirects/', import.meta.url).toString();

describe('SSG - Redirects', () => {
	before(async () => {
		await cli('build', '--root', fileURLToPath(root));
	});

	it('Creates a redirects file', async () => {
		const redirects = await fs.readFile(new URL('./dist/_redirects', root), 'utf-8');
		let parts = redirects.split(/\s+/);
		expect(parts).to.deep.equal([
			'/two',
			'/',
			'302',
			'/other',
			'/',
			'301',
			'/nope',
			'/',
			'301',

			'/blog/*',
			'/team/articles/*/index.html',
			'301',
			'/team/articles/*',
			'/team/articles/*/index.html',
			'200',
		]);
	});
});
