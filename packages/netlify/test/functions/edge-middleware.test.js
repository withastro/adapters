import { expect } from 'chai';
import { loadFixture } from "@astrojs/test-utils"

describe('Middleware', () => {
	let fixture;

	before(async () => {
		fixture = await loadFixture({ root: new URL('./fixtures/middleware/', import.meta.url) });
		await fixture.build();
	});

	it('should successfully build the middleware', async () => {
		const contents = await fixture.readFile('../.netlify/edge-functions/middleware/middleware.mjs')
		expect(contents.includes('"Hello world"')).to.be.false;
	});
});
