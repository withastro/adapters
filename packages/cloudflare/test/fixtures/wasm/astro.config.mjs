import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
		wasmModuleImports: true
	}),
	output: 'hybrid'
});
