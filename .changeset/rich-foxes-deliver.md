---
'@astrojs/cloudflare': minor
---

Adds a new property `persistTo` which allows setting the directory for local state files when using Cloudflare runtime with `astro dev`. This is useful when you want to persist state between restarts of the dev server, for example when using KV, D1, R2 to store data.

Additionally, updates the format of the `runtime` configuration and adds a warning when the deprecated format is used. The current format is now `runtime: { mode: 'off' | 'local', persistTo: string }`. See [runtime documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#runtime) for more information.
