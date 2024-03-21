import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
		mode: 'advanced',
		functionPerRoute: true,
		wasmModuleImports: true
	}),
	output: 'server',
	vite: { build: { minify: false } }
});
