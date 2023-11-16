---
'@astrojs/cloudflare': patch
---

Fixes a regression which caused the adapter to falsely generate `_routes.json` for on-demand rendered 404 pages, which causes unexpected behavior in Cloudflare's SPA routing.
