---
'@astrojs/cloudflare': patch
---

Fixes an issue where `cloudflare:` scoped imports made the build fail. We externalize all imports with the `cloudflare:` scope by default now.
