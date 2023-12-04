import { fileURLToPath } from 'url';
import { expect } from 'chai';
import fs from 'fs/promises';
import { cli } from '../test-utils.js';

describe('Middleware', () => {
	it('should successfully build the middleware', async () => {
		const root = new URL('./fixtures/middleware/', import.meta.url).toString();
		await cli('build', '--root', fileURLToPath(root));
		const contents = await fs.readFile(
			new URL('./.netlify/edge-functions/middleware/middleware.mjs', root),
			'utf-8'
		);
		expect(contents.includes('"Hello world"')).to.be.false;
	});
});
