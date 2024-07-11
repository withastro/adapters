---
'@astrojs/netlify': minor
---

Adds "includedFiles" and "excludedFiles" options. These allow extra files to be deployed in the SSR function bundle.

When an Astro site using `server` or `hybrid` rendering is deployed to Netlify, the generated functions trace the server dependencies and include any that may be needed in SSR. However sometimes you may want to include extra files that are not detected as dependencies, such as files that are loaded using `fs` functions. Also, you may sometimes want to specifically exclude dependencies that are bundled automatically. For example, you may have a Node module that includes a large binary.

The `includedFiles` and `excludedFiles` options allow you specify these inclusions and exclusions as an array of file paths relative to the project root. Both options support glob patterns, so you can include/exclude multiple files at once.

The paths are relative to the site root. If you are loading them using filesystem funcitons, make sure you resolve paths relative to the site root, and not relative to the cxource file. At runtime the compiled file will be in a different location, so paths that are relative to the file will not work. You should instead resolve the path using `path.resolve()` or `process.cwd()`, which will give you the site root.

```js
import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: netlify({
    includedFiles: ['files/**/*.csv', 'files/include-this.txt'],
    excludedFiles: ['files/subdirectory/not-this.csv'],
  })
});