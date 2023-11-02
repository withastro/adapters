import { expect } from 'chai';
import fs from 'fs/promises';
import { cli } from './test-utils.js';
import { fileURLToPath } from 'url';

const root = new URL('./fixtures/base/', import.meta.url).toString();

describe('Base', () => {
	before(async () => {
		await cli('build', '--root', fileURLToPath(root));
	});

	it('Path is prepended by base', async () => {
		const redir = await fs.readFile(new URL('./dist/_redirects', root), 'utf-8');
		const expr = new RegExp('/test/     /.netlify/functions/entry    200');
		expect(redir).to.match(expr);
	});
});
