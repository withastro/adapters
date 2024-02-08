import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { astroCli } from './_test-utils.js';

const root = new URL('./fixtures/external-image-service/', import.meta.url);

describe('ExternalImageService', () => {
	it('has correct image service', async () => {
		await astroCli(fileURLToPath(root), 'build');
		const outFileToCheck = readFileSync(fileURLToPath(new URL('dist/_worker.js', root)), 'utf-8');
		assert.equal(outFileToCheck.includes('cdn-cgi/image'), true);
	});
});
