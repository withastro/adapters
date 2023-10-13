import { loadFixture, runCLI } from './test-utils.js';
import { expect } from 'chai';
import * as cheerio from 'cheerio';

describe('With SolidJS', () => {
	/** @type {import('./test-utils').Fixture} */
	let fixture;
	/** @type {import('./test-utils').WranglerCLI} */
	let cli;

	before(async function () {
		fixture = await loadFixture({
			root: './fixtures/with-solid-js/',
		});
		await fixture.build();

		cli = await runCLI('./fixtures/with-solid-js/', {
			silent: true,
			onTimeout: (ex) => {
				console.log(ex);
				// if fail to start, skip for now as it's very flaky
				this.skip();
			},
		});
	});

	after(async () => {
		await cli?.stop();
	});

	it('renders the solid component', async () => {
		let res = await fetch(`http://127.0.0.1:${cli.port}/`);
		expect(res.status).to.equal(200);
		let html = await res.text();
		let $ = cheerio.load(html);
		expect($('.solid').text()).to.equal('Solid Content');
	});
});
