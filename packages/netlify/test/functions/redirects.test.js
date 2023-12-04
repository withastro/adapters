import { fileURLToPath } from 'url';
import { expect } from 'chai';
import fs from 'fs/promises';
import { cli } from './test-utils.js';

const root = new URL('../functions/fixtures/redirects/', import.meta.url).toString();

describe('SSG - Redirects', () => {
	before(async () => {
		await cli('build', '--root', fileURLToPath(root));
	});

	it('Creates a redirects file', async () => {
		let redirects = await fs.readFile(new URL('./dist/_redirects', root), 'utf-8');
		let parts = redirects.split(/\s+/);
		expect(parts).to.deep.equal([
			'',
			'/other',
			'/',
			'301',
			'',
		]);
		expect(redirects).to.matchSnapshot();
	});

	it('Does not create .html files', async () => {
		let hasErrored = false;
		try {
			await fixture.readFile('/other/index.html');
		} catch {
			hasErrored = true;
		}
		expect(hasErrored).to.equal(true, 'this file should not exist');
	});
});
