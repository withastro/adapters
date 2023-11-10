import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
	output: 'server',
	adapter: cloudflare({
		imageService: 'compile',
	}),
});

// imageService: "compile", is equivalent to:
// {
//   service: { entrypoint: 'astro/assets/services/sharp', config: {} },
//   domains: [],
//   remotePatterns: [],
//   endpoint: '@astrojs/cloudflare/image-endpoint'
// }
