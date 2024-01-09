---
'@astrojs/cloudflare': minor
---

Adds the option to only run image optimization on images during build-time. **Warning:** This mode does not work with on-demand (SSR) image optimization.

```diff
import {defineConfig} from "astro/config";
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server'
  adapter: cloudflare({
+   imageService: 'compile'
  }),
})
```
