---
'@astrojs/cloudflare': patch
---

Fixes a regression which caused the adapter to falsely return an empty 404 response, caused by a change in `app.match()` behavior, which was introduced in https://github.com/withastro/astro/pull/7754. We forget to update the Cloudflare adapter and this implements the necessary fix.
