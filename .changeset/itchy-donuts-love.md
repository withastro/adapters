---
'@astrojs/netlify': minor
---

Adds `includedFiles` and `excludedFiles` configuration options. These allow extra files to be deployed in the SSR function bundle.

When an Astro site using `server` or `hybrid` rendering is deployed to Netlify, the generated functions trace the server dependencies and include any that may be needed in SSR. However, sometimes you may want to include extra files that are not detected as dependencies, such as files that are loaded using `fs` functions. Also, you may sometimes want to specifically exclude dependencies that are bundled automatically. For example, you may have a Node module that includes a large binary.

The `includedFiles` and `excludedFiles` options allow you specify these inclusions and exclusions as an array of file paths relative to the site root. Both options support glob patterns, so you can include/exclude multiple files at once.

If you are specifying files using filesystem functions, resolve the path using `path.resolve()` or `process.cwd()`, which will give you the site root. At runtime, compiled source files will be in a different location and you cannot rely on relative file paths.

```js
import netlify from '@astrojs/netlify';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: netlify({
    includedFiles: ['src/address-data/**/*.csv', 'src/include-this.txt'],
    excludedFiles: ['node_modules/chonky-module/not-this-massive-file.mp4'],
  })
});
