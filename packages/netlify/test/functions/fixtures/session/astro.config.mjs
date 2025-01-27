import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: netlify({
    edgeMiddleware: true,
    experimentalSessions: true,
  }),
  site: 'http://example.com',
});