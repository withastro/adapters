import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { astroCli } from './_test-utils.js';

const root = new URL('./fixtures/assets-compile-time/', import.meta.url);

describe('AssetsCompileTime', () => {
	it('has correct image service', async () => {
		await astroCli(fileURLToPath(root), 'build');

		const outFileToCheck = readFileSync(fileURLToPath(new URL('dist/_worker.js', root)), 'utf-8');
		expect(outFileToCheck).to.not.include('sharp')
	});
});
