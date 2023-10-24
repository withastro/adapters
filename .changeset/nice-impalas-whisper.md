---
'@astrojs/cloudflare': patch
---

Fixes override of a valid `astro:assets` image service configuration. Now overrides are only applied when the configuration is known to be incompatible with Cloudflare.
