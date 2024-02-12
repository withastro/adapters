---
'@astrojs/netlify': patch
---

Fixes an issue where enabling `edgeMiddleware` failed to bundle a dependency (`cssesc`) introduced in Astro 4.2.5.
