import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: netlify({
		// Pass some value to make sure it doesn't error out
    includeFiles: ['included.js'],
    edgeMiddleware: process.env.EDGE_MIDDLEWARE === 'true',
    imageCDN: process.env.DISABLE_IMAGE_CDN ? false : undefined,
  }),
  image: {
    remotePatterns: [{
      protocol: 'https',
      hostname: '*.example.org',
      pathname: '/images/*',
    }],
    domains: ['example.net', 'secret.example.edu'],
  },
  site: `http://example.com`,
});