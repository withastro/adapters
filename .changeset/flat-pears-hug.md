---
'@astrojs/cloudflare': minor
---

Prepares for major breaking changes to adapter configuration in the upcoming v10 release.

_(Full documentation to help you migrate your project to the upgraded Cloudflare adapter will be provided with the release of v10.0.)_

**Deprecates** the following adapter configuration options (to be **removed entirely in v10**):

- **`mode`:** All projects will deploy to Cloudflare pages using [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/) (the previous default setting). This is no longer a configurable option. [Cloudflare Functions](https://developers.cloudflare.com/pages/functions/get-started/) will no longer be supported. If you were using `mode: 'directory'`, please migrate to [Astro Endpoints](https://docs.astro.build/en/guides/endpoints/).

- **`functionPerRoute`:** Discontinued due to Cloudflare's single execution context approach. You will no longer have the option to compile a separate bundle for each page.

- **`routes.strategy`:** Projects will use the auto-generated `_route.json` for route management unless you [provide your own `public/_routes.json`](/en/guides/integrations-guide/cloudflare/#custom-_routesjson). This change aims to eliminate confusion and promote consistency.

- **`routes.include`:** Will be replaced by a new `routes.extend.include` option to allow you to include additional routes.

- **`routes.exclude`:** Will be replaced by a new `routes.extend.exclude` option to allow you to exclude additional routes.

- **`runtime`:** Local runtime bindings will be configured in `wrangler.toml` at the root of your project as described in the [adapters documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-workers). You will no longer configure these directly in the adapter configuration. A new `platformProxy` setting will be introduced to enable and configure the platformProxy (local runtime) provided by wrangler. 

These changes are part of ongoing efforts to streamline functionality, improve performance, and align with best practices and platform capabilities.

We strongly recommend upgrading to v10 upon its release. To ensure a smooth migration, we commit to at least 4 weeks of additional maintenance for v9 following the release of v10. During this period, we will actively assist with migration efforts to ensure that all users can transition without major issues.
