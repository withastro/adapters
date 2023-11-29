---
'@astrojs/netlify': major
---

# Netlify Adapter v4 simplifies static + SSR deployments

This update is a complete overhaul of the Netlify adapter.
It simplifies the user-facing config, and resolves a number of bugs along the way.

Here's what changes:

## Middleware without configuration

In v3, [Middleware](https://docs.astro.build/en/guides/middleware/) was deployed to the SSR Function by default.
Enabling the `edgeMiddleware` option would change this behaviour to deploy it using Netlify Edge Functions instead, improving
page speed and enabling the middleware to run on prerendered sites.

In v4, this is the default setting.
If your Astro site makes use of Middleware,
it's deployed to an Edge Function where it runs super close to your users and is also applied to static sites.
You can use this to implement customization or authorization logic!

**Action Required:**
If your site is using Middleware, and you had `edgeMiddleware` enabled, nothing changes for you. You are free to remove the config field, as it is no longer necessary.
If your site is using Middleware, and you didn't have `edgeMiddleware` enabled, your Middleware will now be deployed to an Edge Function and start running on prerendered pages. Go through your prerendered pages, and check if this requires any changes to the logic in your middleware.

## Netlify Context is automatically available via Locals

In v3, you could use `netlify-edge-middleware.ts` to inject data from the Netlify context into your Astro locals.
In v4, this file is no longer needed because the Netlify context is automatically made available via `Astro.locals.netlify.context`.
You can use this context to access information about the user (like geolocation or IP address), your Netlify site (like deploy ID) or the request (like its request ID or the CDN region it's served from).

**Action Required:**
Remove the `netlify-edge-middleware.ts` or ``netlify-edge-middleware.js` file.
In your codebase, change all usage of locals injected through that file to use `Astro.locals.netlify.context` instead.

### Image CDN

v4 of this adapter integrates your Astro site with Netlify [Image CDN](https://docs.netlify.com/image-cdn/overview/).
This allows transforming images on-the-fly without impacting build times.
It's implemented using an [Astro Image Service](https://docs.astro.build/en/reference/image-service-reference/), and enabled by default.

## On-Demand Builders are no longer supported

On-Demand Builders (ODB) allows SSR-Rendered pages to be cached using a Time to Live (TTL) strategy.
ODB continues to be supported by Netlify, but has since been replaced by the much more powerful
[Fine-Grained Cache Control](https://www.netlify.com/blog/swr-and-fine-grained-cache-control).

In v3, you could deploy your SSR-Rendered Astro pages to ODBs by enabling the `builders` config option,
and then specifying the TTL on a per-page basis.
In v4, you can use the cache-control headers instead:

```diff lang="astro"
---
// src/pages/index.astro
import Layout from '../components/Layout.astro';

- if (import.meta.env.PROD) {
-   Astro.locals.runtime.setBuildersTtl(45)
- }
+ Astro.response.headers.set('CDN-Cache-Control', "public, max-age=45, must-revalidate")
---
```

**Action Required:**
Remove the `builders` config option, and replace all usage of `Astro.locals.runtime.setBuildersTtl()`
with caching headers as seen above.
See [Supported Cache Control Headers](https://docs.netlify.com/platform/caching/#supported-cache-control-headers) for more info on those.

## `functionPerRoute` was removed

In v3, the `functionPerRoute` option allowed the SSR routes to be split up into multiple Netlify Functions.
In theory, this reduced bundle sizes of each individual function, and the speed-up in code parsing should speed up cold starts.
In practice, this benefit is often nullified by the increase in number of cold starts - more handlers means fewer requests per handler, means more cold starts.

In v4, support for this deployment mode was removed.

**Action Required:**
Remove the `functionPerRoute` field from your config.

## `binaryMediaTypes` was removed

`binaryMediaTypes` was a workaround required for some Astro endpoints, because v3 deployed those as "old" Netlify Functions (now referred to as ["Lambda Compatibility Mode"](https://docs.netlify.com/functions/lambda-compatibility)).
v4 uses the new [Netlify Functions 2.0](https://www.netlify.com/blog/introducing-netlify-functions-2-0/), which simply doesn't need this workaround anymore - so we're removing it 🎉

**Action Required:**
Remove the `binaryMediaTypes` field from your config.
