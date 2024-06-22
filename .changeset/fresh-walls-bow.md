---
'@astrojs/cloudflare': major
---

## Upgrades

### Supported Astro versions

This release drops support for Astro versions `<= 4.10.2`. The new supported and required Astro versions are `>= 4.10.3`. This allowed us to remove additional workarounds related to projects with many prerendered pages. This should fix all bundling issues, which are not caused by an upstream package. If you still observe an issue, please check current open issues or create a new one in the repository.

#### What should I do?

To upgrade an existing project, use the automated `@astrojs/upgrade` CLI tool. Alternatively, upgrade manually by running the upgrade command fro your package manager:

```
# Recommended:
npx @astrojs/upgrade

# Manual:
npm install astro@latest
pnpm upgrade astro --latest
yarn upgrade astro --latest
```

## Changes

### `astro:env`

This release adds experimental support for `astro:env`, which helps to streamline the usage of enviroment variables for Astro projects. You can read more about it in [Astro Docs](https://docs.astro.build/en/reference/configuration-reference/#experimentalenv). **IMPORTANT:** Cloudflare Bindings are not supported by `astro:env`, and still should be accessed by using `Astro.locals.runtime.env` or `context.locals.runtime.env`. `astro:env` supports environment variables only.

#### What should I do?

If you observe any issues, please check current open issues or create a new one in the repository.

To add enviroment variables to your project, you still need to make sure they are available in three places. You're setup might require different steps to achieve this, so we can't give you a full step-by-step guide, how to achieve the requirements, but here are some guidances to get you started:

- `process.env` during build in your node process (`astro build`)
- `wrangler.toml` for local development (`astro dev`)
- `Cloudflare Pages Dashboard` for production deployments

Add "public" enviroment variables to your `wrangler.toml`. _(If you add `pages_build_output_dir = "./dist"` to your `wrangler.toml`, these will be synced to your Cloudflare Pages Dashboard and you don't have to add them there manually)_:

```diff
# wrangler.toml
name = "test"

+[vars]
+API_URL = "https://google.de"
+PORT = 4322

# ...
```

If you also need "secret" environment variables _(e.g. API Keys, etc.)_, you add them to your `.dev.vars` file _(These won't be synced automaticcly, and you need to add them manually as encrypted variables to the Cloudflare Pages Dashboard or use `wrangler` CLI to push them)_:

```diff
# .dev.vars
+ API_SECRET=123456789
```

With your enviroment variables added to those two files and synced to the Cloudflare Pages Dashboard, you should be able to use them with `astro:env` when running `astro dev` & `astro build`, if you use Cloudflare's Build Pipeline and Cloudflare's GitHub App connection.

However if you build your project locally or inside a custom GitHub Action workflow and deploy with direct upload, you need to make sure that the environment variables are available in your build process. The simplest but not safest is to use your shell, e.g. `API_URL=https://google.de PORT=4322 API_SECRET=123456789 astro build`. For more complex setups, you might need find out the way for your specific setup to provide environment variables to the build process.

Additionally you need to define your schema inside your `astro.config.mjs` file:

```diff
import { defineConfig, envField } from "astro/config"

export default defineConfig({
+  experimental: {
+    env: {
+      schema: {
+        API_URL: envField.string({ context: "client", access: "public", optional: true }),
+        PORT: envField.number({ context: "server", access: "public", default: 4321 }),
+        API_SECRET: envField.string({ context: "server", access: "secret" }),
+      }
+    }
+  }
})
```

Finally you should be able to access your environment variables in your Astro project, according to the [Astro Docs](https://docs.astro.build/en/reference/configuration-reference/#experimentalenv), e.g. `import { API_URL } from "astro:env/client"` or `import { PORT, API_SECRET } from "astro:env/server"`.

**NOTE:** If you want to use environment variables in other files, which are not an `.astro` file or a `middleware`, you still need to make sure you don't access the variable in a global scope. We recommend to wrap your logic with a function, which you then call from your `.astro` file or `middleware` inside the request scope.

```ts
// foo.ts
import { MY_SECRET } from 'astro:env/server'

// DOESN'T WORK
const client = myLib(MY_SECRET)

// WORKS
export const bar = () => {
  const client = myLib(MY_SECRET)
  return client
}
```

### BREAKING: `imageService`

This release changes the default behavior of `imageService`. In the past the default behavior was falling back to a `noop` service, which disabled image optimization for your project, because Cloudflare doesn's support it. The new default is `compile`, which enables image optimization for prerendered pages during build, but disallows the usage of any `astro:assets` feature inside on-demand pages.

#### What should I do?

If you experience issues with the new setting, you can revert back to the old setting by setting `imageService` to `passthrough`. Furthermore if you observe any issues, please check current open issues or create a new one in the repository.

```diff
// astro.config.mjs

// ...
adapter: cloudflare({
-  imageService: 'compile',
}),
// ...
```

### BREAKING: `platformProxy`

This release enables `platformProxy` by default. While most projects shouldn't be affected, on paper this is a breaking change. 

#### What should I do?

If you experience issues with the new default, you can disable it by setting `platformProxy.enabled` to `false`. Furthermore if you observe any issues, please check current open issues or create a new one in the repository.

```diff
// astro.config.mjs

// ...
adapter: cloudflare({
-  platformProxy: {
-    enabled: true,
-  },
}),
// ...
```

### BREAKING: `passThroughOnException`

This release throws an error if you use Cloudflare's `passThroughOnException` function, because as stated in [Cloudflare docs](https://developers.cloudflare.com/pages/platform/known-issues/#pages-functions), the function doesn't work with Cloudflare Pages.

#### What should I do?

I you observe any issues, please check current open issues or create a new one in the repository.

## Deprecations

### `wasmModuleImports`

This release removes the previous deprecated `wasmModuleImports` adapter option. It was replaced with the `cloudflareModules` option, which offers flexiblility and support for more filetypes.

#### What should I do?

If you observe any issues, please check current open issues or create a new one in the repository.

```diff
// astro.config.mjs

// ...
adapter: cloudflare({
-  wasmModuleImports: true,
}),
// ...
```
