import { fileURLToPath } from 'url';
import { expect } from 'chai';
import { cli } from '../test-utils.js';

const root = new URL('./fixtures/cookies/', import.meta.url).toString();

describe('Cookies', () => {
	before(async () => {
		await cli('build', '--root', fileURLToPath(root));
	});

	it('Can set multiple', async () => {
		const entryURL = new URL(
			'./fixtures/cookies/.netlify/functions-internal/ssr/ssr.mjs',
			import.meta.url
		);
		const { default: handler } = await import(entryURL);
		const resp = await handler(new Request('http://example.com/login', { method: "POST", body: '{}' }), {})
		expect(resp.status).to.equal(301);
		expect(resp.headers.get("location")).to.equal('/');
		expect(resp.headers.getSetCookie()).to.eql(['foo=foo; HttpOnly', 'bar=bar; HttpOnly']);
	});
});
