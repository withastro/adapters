import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import type { AstroConfig } from 'astro';
import type { PluginOption } from 'vite';

export interface CloudflareModulePluginExtra {
	afterBuildCompleted(config: AstroConfig): Promise<void>;
}
/**
 * Enables support for various non-standard extensions in module imports within cloudflare workers.
 *
 * See https://developers.cloudflare.com/workers/wrangler/bundling/ for reference
 *
 * This adds supports for imports in the following formats:
 * - .wasm?module
 * - .bin
 *
 * Loads '*.wasm?module' imports as WebAssembly modules, which is the only way to load WASM in cloudflare workers.
 * Current proposal for WASM modules: https://github.com/WebAssembly/esm-integration/tree/main/proposals/esm-integration
 * Cloudflare worker WASM from javascript support: https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/
 * @param bin - if true, will load '.bin' imports as Uint8Arrays, otherwise will throw errors when encountered to clarify that it must be enabled
 * @param wasm - if true, will load '.wasm?module' imports as Uint8Arrays, otherwise will throw errors when encountered to clarify that it must be enabled
 * @returns Vite plugin to load WASM tagged with '?module' as a WASM modules
 */
export function cloudflareModuleLoader(
	enabled: Record<ImportType, boolean>
): PluginOption & CloudflareModulePluginExtra {
	const enabledAdapters = cloudflareImportAdapters.filter((x) => enabled[x.extension]);
	let isDev = false;
	const MAGIC_STRING = '__CLOUDFLARE_ASSET__';
	const replacements: Replacement[] = [];

	return {
		name: 'vite:wasm-module-loader',
		enforce: 'pre',
		configResolved(config) {
			isDev = config.command === 'serve';
		},
		config(_, __) {
			// let vite know that file format and the magic import string is intentional, and will be handled in this plugin
			return {
				assetsInclude: enabledAdapters.map((x) => `**/*.${x.qualifiedExtension}`),
				build: {
					rollupOptions: {
						// mark the wasm files as external so that they are not bundled and instead are loaded from the files
						external: enabledAdapters.map(
							(x) => new RegExp(`^${MAGIC_STRING}.+\\.${x.extension}.mjs$`, 'i')
						),
					},
				},
			};
		},

		async load(id, _) {
			const suffix = id.split('.').at(-1);
			const importAdapter = cloudflareImportAdapters.find((x) => x.qualifiedExtension === suffix);
			if (!importAdapter) {
				return;
			}
			const suffixType: ImportType = importAdapter.extension;
			const adapterEnabled = enabled[suffixType];
			if (!adapterEnabled) {
				throw new Error(
					`Cloudflare module loading is experimental. The ${suffix} module cannot be loaded unless you add \`wasmModuleImports: true\` to your astro config.`
				);
			}

			const filePath = id.replace(/\?module$/, '');

			const data = await fs.readFile(filePath);
			const base64 = data.toString('base64');

			const inlineModule = importAdapter.asNodeModule(data);

			if (isDev) {
				// no need to wire up the assets in dev mode, just rewrite
				return inlineModule;
			}
			// just some shared ID
			const hash = hashString(base64);
			// emit the wasm binary as an asset file, to be picked up later by the esbuild bundle for the worker.
			// give it a shared deterministic name to make things easy for esbuild to switch on later
			const assetName = `${path.basename(filePath).split('.')[0]}.${hash}.${
				importAdapter.extension
			}`;
			this.emitFile({
				type: 'asset',
				// emit the data explicitly as an esset with `fileName` rather than `name` so that
				// vite doesn't give it a random hash-id in its name--We need to be able to easily rewrite from
				// the .mjs loader and the actual wasm asset later in the ESbuild for the worker
				fileName: assetName,
				source: data,
			});

			// however, by default, the SSG generator cannot import the .wasm as a module, so embed as a base64 string
			const chunkId = this.emitFile({
				type: 'prebuilt-chunk',
				fileName: `${assetName}.mjs`,
				code: inlineModule,
			});

			return `import module from "${MAGIC_STRING}${chunkId}.${importAdapter.extension}.mjs";export default module;`;
		},

		// output original wasm file relative to the chunk now that chunking has been achieved
		renderChunk(code, chunk, _) {
			if (isDev) return;

			if (!code.includes(MAGIC_STRING)) return;

			// SSR will need the .mjs suffix removed from the import before this works in cloudflare, but this is done as a final step
			// so as to support prerendering from nodejs runtime
			let replaced = code;
			for (const loader of enabledAdapters) {
				replaced = replaced.replaceAll(
					new RegExp(`${MAGIC_STRING}([A-Za-z\\d]+)\\.${loader.extension}\\.mjs`, 'g'),
					(s, assetId) => {
						const fileName = this.getFileName(assetId);
						const relativePath = path
							.relative(path.dirname(chunk.fileName), fileName)
							.replaceAll('\\', '/'); // fix windows paths for import

						// record this replacement for later, to adjust it to import the unbundled asset
						replacements.push({
							cloudflareImport: relativePath.replace(/\.mjs$/, ''),
							nodejsImport: relativePath,
						});
						return `./${relativePath}`;
					}
				);
			}
			if (replaced.includes(MAGIC_STRING)) {
				console.error('failed to replace', replaced);
			}

			return { code: replaced };
		},

		/**
		 * Once prerendering is complete, restore the imports in the _worker.js to cloudflare compatible ones, removing the .mjs suffix.
		 * Walks the complete _worker.js/ directory and reads all files.
		 */
		async afterBuildCompleted(config: AstroConfig) {
			async function doReplacement(dir: string) {
				const files = await fs.readdir(dir, { withFileTypes: true });
				for (const entry of files) {
					if (entry.isDirectory()) {
						await doReplacement(path.join(dir, entry.name));
					} else if (entry.isFile() && entry.name.endsWith('.mjs')) {
						const filepath = path.join(dir, entry.name);
						let contents = await fs.readFile(filepath, 'utf-8');
						for (const replacement of replacements) {
							contents = contents.replaceAll(
								replacement.nodejsImport,
								replacement.cloudflareImport
							);
						}
						await fs.writeFile(filepath, contents, 'utf-8');
					}
				}
			}

			await doReplacement(url.fileURLToPath(new URL('_worker.js', config.outDir)));
		},
	};
}

export type ImportType = 'wasm' | 'bin';

interface Replacement {
	// desired import for cloudflare
	cloudflareImport: string;
	// nodejs import that simulates a wasm/bin module
	nodejsImport: string;
}

interface ModuleImportAdapter {
	extension: ImportType;
	qualifiedExtension: string;
	asNodeModule(fileContents: Buffer): string;
}

const wasmImportAdapter: ModuleImportAdapter = {
	extension: 'wasm',
	qualifiedExtension: 'wasm?module',
	asNodeModule(fileContents: Buffer) {
		const base64 = fileContents.toString('base64');
		return `const wasmModule = new WebAssembly.Module(Uint8Array.from(atob("${base64}"), c => c.charCodeAt(0)));export default wasmModule;`;
	},
};

const binImportAdapter: ModuleImportAdapter = {
	extension: 'bin',
	qualifiedExtension: 'bin',
	asNodeModule(fileContents: Buffer) {
		const base64 = fileContents.toString('base64');
		return `const binModule = Uint8Array.from(atob("${base64}"), c => c.charCodeAt(0)).buffer;export default binModule;`;
	},
};

const cloudflareImportAdapters = [binImportAdapter, wasmImportAdapter];

/**
 * Returns a deterministic 32 bit hash code from a string
 */
function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash &= hash; // Convert to 32bit integer
	}
	return new Uint32Array([hash])[0].toString(36);
}
