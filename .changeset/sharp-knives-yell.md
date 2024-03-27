---
'@astrojs/cloudflare': major
---

Updates and prepares the adapter to be more flexibile, stable and composable for the future.

## Migration Guide

We are commited to provide a smooth migration path for our users. This guide will help you to migrate your existing projects to the latest version of the adapter. _(Additionally we commit to provide at least 4 weeks of limited maintanance support for the previous version 9 of the adapter. To allow users to migrate their projects in this time frame.)_

### Adapter's `mode` option & Cloudflare Functions

The `mode` option has been removed from the adapter. The adapter now defaults to the previous `advanced` mode and this is the only official supported option moving forward. To migrate your existing projects, you need to do the following.

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

If you are using `mode: 'directory'`, **but** you have custom Cloudflare functions in the `/function` folder, you will need to manually migrate them [Astro Server Endpoints (API Routes)](https://docs.astro.build/en/guides/endpoints/#server-endpoints-api-routes). If you need to access Cloudflare Bindings, you can use `ctx.locals`, for further reference, please checke the [Adapters Documentation on Cloudflare Runtime Usage](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#usage).

### Adapter's `functionPerRoute` option

The `functionPerRoute` option has been removed from the adapter. The adapter now defaults to the previous `false` value. If you are using `functionPerRoute: true` in your `astro.config.mjs` file, you can safely remove it.

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

The adapter uses a new option `platformProxy` to enable local runtime support, when using `astro dev`. The old option `runtime` has been removed. To migrate your existing projects, you need to do the following.

If you are already using a `wrangler.toml` file, you can safely switch.

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

If you define your bindings in the `astro.config.mjs` file, you need to migrate to use a `wrangler.toml` file. You can find more information on how to do this in the [Cloudflare docs about wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases).

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

### Routes

The adapter removed the option `routes.strategy`, the option `routes.include` & `routes.exclude` changed their name and type.

If you are using `routes.strategy`, you can remove it. You might observe a different `dist/_routes.json` file, but it should not affect the behaviour.

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

If you are using `routes.include` or `routes.exclude`, you can migrate them to work with v10 of the adapter.

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

In the old version of the adapter we used to expose all the environment variables to `process.env`. This is no longer the case, as it was unsafe. If you need to use environment variables, you need to use either `Astro.locals.runtime.env` or `context.locals.runtime.env`. There is no way to access the environment variables directly from `process.env` or in the global scope. If you need to access the environment variables in global scope, you should refactor your code to pass the environment variables as arguments to your function or file.
If you rely on any third library that uses `process.env`, please open an issue and we can investigate what the best way to handle this is.
