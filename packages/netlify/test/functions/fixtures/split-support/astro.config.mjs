import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify({
    functionPerRoute: true,
  }),
  site: `http://example.com`,
});
