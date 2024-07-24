import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: netlify({
    // A long way to the root directory!
    excludedFiles: ['../../../../../../node_modules/.pnpm/cowsay@*/**'],
  }),
  site: "http://example.com",
});