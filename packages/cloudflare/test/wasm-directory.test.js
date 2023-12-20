import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import { astroCli, wranglerCli } from './_test-utils.js';

const root = new URL('./fixtures/wasm-directory/', import.meta.url);

describe('WasmDirectoryImport', () => {
	let wrangler;
	before(async () => {
		await astroCli(fileURLToPath(root), 'build');

		wrangler = wranglerCli(fileURLToPath(root));
		await new Promise((resolve) => {
			wrangler.stdout.on('data', (data) => {
				console.log('[stdout]', data.toString());
				if (data.toString().includes('http://127.0.0.1:8788')) resolve();
			});
			wrangler.stderr.on('data', (data) => {
				console.log('[stderr]', data.toString());
			});
		});
	});

	after((done) => {
		wrangler.kill();
		setTimeout(() => {
			console.log('CLEANED');
			done();
		}, 1000);
	});

	it('can render', async () => {
		const res = await fetch(`http://127.0.0.1:8788/`);
		expect(res.status).to.equal(200);
		const json = await res.json();
		expect(json).to.deep.equal({ answer: 42 });
	});
});
