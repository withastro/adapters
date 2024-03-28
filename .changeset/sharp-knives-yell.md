---
'@astrojs/cloudflare': major
---

Updates and prepares the adapter to be more flexibile, stable and composable for the future. Includes several breaking changes.

## Upgrade Guide

We are commited to provide a smooth upgrade path for our users. This guide will describe what has changed from v9.x to v10 to help you to migrate your existing projects to the latest version of the adapter. For complete documentation of all v10 configuration settings and usage, please see [the current, updated Cloudflare adapter documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/).

We will provide at least 4 weeks of limited maintanance support for the previous version 9 of the adapter. Please plan to upgrade your project within this time frame, using the instructions below.

### Adapter's `mode` option & Cloudflare Functions

The `mode` option has been removed from the adapter. The adapter now defaults to the previous `advanced` mode and this is the only official supported option moving forward.

If you are already using `mode: 'advanced'` in your `astro.config.mjs` file, you can safely remove it.

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
-		mode: 'advanced',
	}),
});
```

If you are using `mode: 'directory'`, and don't have any custom Cloudflare functions in the `/function` folder, you should be able to remove the `mode` option, without any issues.

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
-		mode: 'directory',
	}),
});
```

If you are using `mode: 'directory'`, **and you have custom Cloudflare functions in the `/function` folder**, you will need to manually migrate them to [Astro Server Endpoints (API Routes)](https://docs.astro.build/en/guides/endpoints/#server-endpoints-api-routes). If you need to access Cloudflare Bindings, you can use `ctx.locals`. For further reference, please check the [Adapters Documentation on Cloudflare Runtime Usage](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#usage).

### Adapter's `functionPerRoute` option

The `functionPerRoute` option has been removed from the adapter. The adapter now defaults to the previous `false` value. If you are using `functionPerRoute: true` in your `astro.config.mjs` file, you can safely remove it. This change will not break any existing projects, but you will no longer be generating a single function for each route.

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
-		functionPerRoute: true,
	}),
});
```

### Local Runtime

The adapter replaces the `runtime` options with a new set of `platformProxy` options to enable local runtime support when using `astro dev`.

If you are already using a `wrangler.toml` file, you can safely replace your existing `runtime` options with the appropriate `platformProxy` options.

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
-		runtime: {
-			mode: 'local',
-			type: 'workers',
-		},
+		platformProxy: {
+			enabled: true,
+		},
	}),
});
```

If you define your bindings in the `astro.config.mjs` file, you need to first migrate your project to use a `wrangler.toml` configuration file for defining your bindings. You can find more information on how to do this in the [Cloudflare docs about wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases). Then, replace `runtime` options with the new corresponding `platformProxy` options as above.

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
-		runtime: {
-			mode: 'local',
-			type: 'pages',
-			bindings: {
-				// ...
-			},
-		},
+		platformProxy: {
+			enabled: true,
+		},
	}),
});
```

If you have typed `locals` in your `./src/env.d.ts` file, you need to run `wrangler types` in your project and update the file.

```diff
/// <reference types="astro/client" />

- type KVNamespace = import('@cloudflare/workers-types/experimental').KVNamespace;
- type ENV = {
-   SERVER_URL: string;
-   KV_BINDING: KVNamespace;
- };

- type Runtime = import('@astrojs/cloudflare').AdvancedRuntime<ENV>;
+ type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    user: {
      name: string;
      surname: string;
    };
  }
}
```

### Routes

The `routes.strategy` option has been removed as you will no longer have the option to choose a strategy in v10 of this adpater.

If you are using `routes.strategy`, you can remove it. You might observe a different `dist/_routes.json` file, but it should not affect your project's behavior.

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
-		routes: {
-			strategy: 'include',
-		},
	}),
});
```

Additionally the `routes.include` & `routes.exclude` options have changed their name and type. If you were previously using them, move these to the new `routes.extend` property and update their types:

```diff
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	adapter: cloudflare({
		routes: {
-			include: ['/api/*'],
-			exclude: ['/fonts/*'],
+			extend: {
+				include: [{ pattern: '/api/*' }],
+				exclude: [{ pattern: '/fonts/*' }],
+			},
		},
	}),
});
```

### process.env

In the old version of the adapter we used to expose all the environment variables to `process.env`. This is no longer the case, as it was unsafe. If you need to use environment variables, you need to use either `Astro.locals.runtime.env` or `context.locals.runtime.env`. There is no way to access the environment variables directly from `process.env` or in the global scope. 

If you need to access the environment variables in global scope, you should refactor your code to pass the environment variables as arguments to your function or file.

If you rely on any third library that uses `process.env`, please open an issue and we can investigate what the best way to handle this is.

### Node.js APIs compatibility

The adapter still supports the same Node.js APIs as Cloudflare does, but you need to adapt your vite configuration and enable the Cloudflare `nodejs_compat` flag.

```diff
import {defineConfig} from "astro/config";
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  adapter: cloudflare({}),
  output: 'server',
+  vite: {
+    ssr: {
+      external: ['node:buffer'],
+    },
+  },
})
```
