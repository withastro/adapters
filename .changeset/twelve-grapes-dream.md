---
'@astrojs/cloudflare': patch
---

Fixes a regression which caused the adapter to falsely return an empty 404 response, caused by an upstream change https://github.com/withastro/astro/pull/7754.
