import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: netlify({
    includedFiles: ['files/**/*.csv', 'files/include-this.txt'],
    excludedFiles: ['files/subdirectory/not-this.csv'],
  }),
  site: `http://example.com`,
});