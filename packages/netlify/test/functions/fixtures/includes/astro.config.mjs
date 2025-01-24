import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    assetsInclude: process.env.VITE_ASSETS_INCLUDE?.split(',') || [],
  },
  output: 'server',
  adapter: netlify({
    includeFiles: process.env.INCLUDE_FILES?.split(',') || [],
    excludeFiles: process.env.EXCLUDE_FILES?.split(',') || [],
  }),
  site: "http://example.com",
});