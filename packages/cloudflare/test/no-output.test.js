import * as assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { astroCli } from './_test-utils.js';

const root = new URL('./fixtures/no-output/', import.meta.url);

describe('MissingOutputConfig', () => {
	it('throws during the build', async () => {
		let error = undefined;
		try {
			await astroCli(fileURLToPath(root), 'build');
		} catch (err) {
			error = err;
		}
		assert.notEqual(error, undefined);
		assert.equal(error.message.includes(`output: "server"`), true);
	});
});
