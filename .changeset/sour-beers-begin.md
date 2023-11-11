---
'@astrojs/cloudflare': major
---

Changes the way that bindings are configured for the local runtime using `astro dev`. This change is developed in cooperation with Cloudflare and aligns Astro more closely to the behavior of Wrangler.

:warning: This is a breaking change for anyone deploying to Cloudflare Pages. You need to update your astro config file to set new the bindings. Follow the updated docs for [configuring `@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-pages)
