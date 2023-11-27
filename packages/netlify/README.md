# @astrojs/netlify

This adapter allows Astro to deploy your SSR site to [Netlify](https://www.netlify.com/).

Learn how to deploy your Astro site in our [Netlify deployment guide](https://docs.astro.build/en/guides/deploy/netlify/).

- <strong>[Why Astro Netlify](#why-astro-netlify)</strong>
- <strong>[Installation](#installation)</strong>
- <strong>[Usage](#usage)</strong>
- <strong>[Examples](#examples)</strong>
- <strong>[Troubleshooting](#troubleshooting)</strong>
- <strong>[Contributing](#contributing)</strong>
- <strong>[Changelog](#changelog)</strong>

## Why Astro Netlify

If you're using Astro as a static site builder—its behavior out of the box—you don't need an adapter.

If you wish to [use server-side rendering (SSR)](https://docs.astro.build/en/guides/server-side-rendering/), Astro requires an adapter that matches your deployment runtime.

[Netlify](https://www.netlify.com/) is a deployment platform that allows you to host your site by connecting directly to your GitHub repository. This adapter enhances the Astro build process to prepare your project for deployment through Netlify.

## Installation

Add the Netlify adapter to enable SSR in your Astro project with the following `astro add` command. This will install the adapter and make the appropriate changes to your `astro.config.mjs` file in one step.

```sh
# Using NPM
npx astro add netlify
# Using Yarn
yarn astro add netlify
# Using PNPM
pnpm astro add netlify
```

### Add dependencies manually

If you prefer to install the adapter manually instead, complete the following two steps:

1. Install the Netlify adapter to your project’s dependencies using your preferred package manager. If you’re using npm or aren’t sure, run this in the terminal:

   ```bash
     npm install @astrojs/netlify
   ```

1. Add two new lines to your `astro.config.mjs` project configuration file.

   ```diff lang="js"
     // astro.config.mjs
     import { defineConfig } from 'astro/config';
   + import netlify from '@astrojs/netlify';

     export default defineConfig({
   +   output: 'server',
   +   adapter: netlify(),
     });
   ```

### Accessing edge context from your site

Netlify Edge Functions provide a [context object](https://docs.netlify.com/edge-functions/api/#netlify-specific-context-object) including metadata about the request, such as a user’s IP, geolocation data, and cookies.

This can be accessed via the `Astro.locals.netlify.context` object:

```astro
---
const { geo: { city } } = Astro.locals.netlify.context
---
<h1>Hello there, friendly visitor from {city}!</h1>
```

If you're using TypeScript, you can get proper typings by updating your `src/env.d.ts` to use `NetlifyLocals`:

```ts
// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type NetlifyLocals = import('@astrojs/netlify').NetlifyLocals

declare namespace App {
  interface Locals extends NetlifyLocals {
    ...
  }
}
```

### Image CDN

This adapter integrates your site with [Netlify Image CDN](https://docs.netlify.com/image-cdn/), transforming images on-the-fly without impacting build times.
It's implemented using an [Astro Image Service](https://docs.astro.build/en/reference/image-service-reference/) under the hood.
Note that this adapter does not support `image.domains` and `image.remotePatterns` config properties in your Astro config - use the `remote_images` field in `netlify.toml` instead: [Netlify Image CDN - Remote Path](https://docs.netlify.com/image-cdn/overview/#remote-path).

### Static sites & Redirects

For static sites you usually don't need an adapter. However, if you use `redirects` configuration in your Astro config, the Netlify adapter can be used to translate this to the proper `_redirects` format.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify/static';

export default defineConfig({
  adapter: netlify(),

  redirects: {
    '/blog/old-post': '/blog/new-post',
  },
});
```

Once you run `astro build` there will be a `dist/_redirects` file. Netlify will use that to properly route pages in production.

> **Note**
> You can still include a `public/_redirects` file for manual redirects. Any redirects you specify in the redirects config are appended to the end of your own.

### Caching SSR Pages using Fine-Grained Cache Control

With [fine-grained cache control](https://www.netlify.com/blog/swr-and-fine-grained-cache-control/), Netlify supports
standard caching headers like `CDN-Cache-Control` or `Vary`.
This allows you to implement e.g. time to live (TTL) or [stale while revalidate (SWR)](https://docs.netlify.com/platform/caching/#stale-while-revalidate-directive) caching.
Use these to add caching to your SSR Pages:

```astro
---
// src/pages/index.astro
import Layout from '../components/Layout.astro';

Astro.response.headers.set('CDN-Cache-Control', "public, max-age=45, must-revalidate")
---

<Layout title="Astro on Netlify">
  {new Date(Date.now())}
</Layout>
```

## Usage

[Read the full deployment guide here.](https://docs.astro.build/en/guides/deploy/netlify/)

After [performing a build](https://docs.astro.build/en/guides/deploy/#building-your-site-locally) the `.netlify/` folder will contain [Netlify Functions](https://docs.netlify.com/functions/overview/) in the `.netlify/functions-internal/` and [Netlify Edge Functions](https://docs.netlify.com/edge-functions/overview/) in the `.netlify/edge-functions/` folder.

Now you can deploy. Install the [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run:

```sh
netlify deploy
```

The [Netlify Blog post on Astro](https://www.netlify.com/blog/how-to-deploy-astro/) and the [Netlify Documentation](https://docs.netlify.com/integrations/frameworks/astro/) provide more information on how to use this integration to deploy to Netlify.

## Examples

- The [Astro Netlify Edge Starter](https://github.com/sarahetter/astro-netlify-edge-starter) provides an example and a guide in the README.

- [Browse Astro Netlify projects on GitHub](https://github.com/search?q=path%3A**%2Fastro.config.mjs+%40astrojs%2Fnetlify&type=code) for more examples!

## Troubleshooting

For help, check out the `#support` channel on [Discord](https://astro.build/chat). Our friendly Support Squad members are here to help!

You can also check our [Astro Integration Documentation][astro-integration] for more on integrations.

## Contributing

This package is maintained by Astro's Core team. You're welcome to submit an issue or PR!

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of changes to this integration.

[astro-integration]: https://docs.astro.build/en/guides/integrations-guide/
