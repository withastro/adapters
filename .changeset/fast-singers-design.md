---
'@astrojs/vercel': minor
---

Deprecates the entrypoints `@astrojs/vercel/serverless` and `@astrojs/vercel/static`.  These will continue to work but are no longer documented and will be removed in a future version. We recommend updating to the `@astrojs/vercel` entrypoint as soon as you are able:

```diff
-import vercel from "@astrojs/vercel/static"
+import vercel from "@astrojs/vercel"
```


```diff
-import vercel from "@astrojs/vercel/serverless"
+import vercel from "@astrojs/vercel"
```
