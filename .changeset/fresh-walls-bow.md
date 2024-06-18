---
'@astrojs/cloudflare': major
---

## Astro support

Drops support for Astro versions `<= 4.10.2`. This allows us to remove additional workarounds and should fix all issues with bundling and prerendering. If you still observe an issue, please check current open issues or create a new one.

## Remove Deprecations

Removes deprecated `wasmModuleImports` adapter option. Use `cloudflareModules` in the future, which defaults to true.

## Breaking Changes

- Changes `platformProxy` to be enabled by default.
