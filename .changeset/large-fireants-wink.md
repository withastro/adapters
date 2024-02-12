---
'@astrojs/netlify': patch
---

Fixes bug where prerendered 404 pages were served as `text/plain` instead of `text/html` for hybrid/server apps, leading to browsers displaying source code instead of rendering it
