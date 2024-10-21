---
'@astrojs/cloudflare': minor
---

Adds experimental support for Cloudflare Workers Assets mode. To use this, update your settings as follows:

```
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
	adapter: cloudflare({
+		experimental: {
+			cloudflare: {
+				workerAssets: true,
+			},
+		}
	}),
});
```

Note: Currently Cloudflare Workers Assets mode, does not read any of `_headers`, `_redirects`, nor `_routes.json` files.
