---
'@astrojs/vercel': minor
---

The entrypoints `@astrojs/vercel/serverless` and `@astrojs/vercel/static` are deprecated. Use the `@astrojs/vercel` entrypoint 

```diff
-import vercel from "@astrojs/vercel/static"
+import vercel from "@astrojs/vercel"
```


```diff
-import vercel from "@astrojs/vercel/serverless"
+import vercel from "@astrojs/vercel"
```
