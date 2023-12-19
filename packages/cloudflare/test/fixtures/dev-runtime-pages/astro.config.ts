import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	devToolbar: {
		enabled: true,
	},
	adapter: cloudflare({
		routes: {
			strategy: 'exclude',
		},
		runtime: {
			mode: 'local',
			type: 'pages',
			bindings: {
				KV: {
					type: 'kv',
				},
				KV_PROD: {
					type: 'kv',
				},
				COOL: {
					type: 'var',
					value: 'ME',
				},
				D1: {
					type: 'd1',
				},
				D1_PROD: {
					type: 'd1',
				},
				USER_DATABASE: {
					type: 'd1',
				},
				PRODUCT_DATABASE: {
					type: 'd1',
				},
				R2: {
					type: 'r2',
				},
				R2_PROD: {
					type: 'r2',
				},
				DO: {
					type: 'durable-object',
					className: 'DO',
				},
				DO_PROD: {
					type: 'durable-object',
					className: 'DO_PROD',
				},
			},
		},
	}),
	output: 'server',
});
