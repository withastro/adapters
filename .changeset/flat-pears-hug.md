---
'@astrojs/cloudflare': minor
---

Prepares for major breaking changes to adapter configuration in the upcoming v10 release.

_(Full documentation to help you migrate your project to the upgraded Cloudflare adapter will be provided with the release of v10.0.)_

**Deprecates** the following adapter configuration options (to be **removed entirely in v10**):

- **`mode`:** (Removed in v10) The new default is using Cloudflare's [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), after consulting with them. [Cloudflare Functions](https://developers.cloudflare.com/pages/functions/get-started/) are not supported anymore, please migrate to [Astro Endpoints](https://docs.astro.build/en/guides/endpoints/).

- **`functionPerRoute`:** (Removed in v10) Discontinued due to Cloudflare's single execution context approach. This change shouldn't have direct impact on you.

- **`routes.strategy`:** (Removed in v10) You should now utilize auto-generated `_route.json` or provide your own `public/_routes.json` for route management. This change aims to eliminate confusion and promote consistency.

- **`routes.include`:** (Removed in v10) Use `routes.extend.include` instead.

- **`routes.exclude`:** (Removed in v10) Use `routes.extend.exclude` instead.

- **`runtime`:** (Removed in v10) Requires specifying bindings in `wrangler.toml`. Use `platformProxy` instead. If you currently define your local runtime bindings in your Astro config, please move them to `wrangler.toml` as described in the [adapters documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-workers).

These changes are part of ongoing efforts to streamline functionality, improve performance, and align with best practices and platform capabilities.

We strongly recommend upgrading to v10 upon its release. To ensure a smooth migration, we commit to at least 4 weeks of additional maintenance for v9 following the release of v10. During this period, we will actively assist with migration efforts to ensure that all users can transition without major issues.
