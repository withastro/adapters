import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import fastGlob from 'fast-glob';
import stripAnsi from 'strip-ansi';
import { check } from './node_modules/astro/dist/cli/check/index.js';
import build from './node_modules/astro/dist/core/build/index.js';
import { RESOLVED_SPLIT_MODULE_ID } from './node_modules/astro/dist/core/build/plugins/plugin-ssr.js';
import { getVirtualModulePageNameFromPath } from './node_modules/astro/dist/core/build/plugins/util.js';
import { makeSplitEntryPointFileName } from './node_modules/astro/dist/core/build/static-build.js';
import { mergeConfig, resolveConfig } from './node_modules/astro/dist/core/config/index.js';
import { dev, preview } from './node_modules/astro/dist/core/index.js';
import { nodeLogDestination } from './node_modules/astro/dist/core/logger/node.js';
import sync from './node_modules/astro/dist/core/sync/index.js';

// Disable telemetry when running tests
process.env.ASTRO_TELEMETRY_DISABLED = true;

/**
 * @typedef {import('./node_modules/astro/dist/core/dev/dev').DevServer} DevServer
 * @typedef {import('./node_modules/astro/dist/@types/astro').AstroInlineConfig & { root?: string | URL }} AstroInlineConfig
 * @typedef {import('./node_modules/astro/dist/core/preview/index').PreviewServer} PreviewServer
 * @typedef {import('./node_modules/astro/dist/core/app/index').App} App
 * @typedef {import('./node_modules/astro/dist/cli/check/index').AstroChecker} AstroChecker
 * @typedef {import('./node_modules/astro/dist/cli/check/index').CheckPayload} CheckPayload
 *
 *
 * @typedef {Object} Fixture
 * @property {typeof build} build
 * @property {(url: string) => string} resolveUrl
 * @property {(path: string) => Promise<boolean>} pathExists
 * @property {(url: string, opts: Parameters<typeof fetch>[1]) => Promise<Response>} fetch
 * @property {(path: string) => Promise<string>} readFile
 * @property {(path: string, updater: (content: string) => string) => Promise<void>} writeFile
 * @property {(path: string) => Promise<string[]>} readdir
 * @property {(pattern: string) => Promise<string[]>} glob
 * @property {typeof dev} startDevServer
 * @property {typeof preview} preview
 * @property {() => Promise<void>} clean
 * @property {() => Promise<App>} loadTestAdapterApp
 * @property {() => Promise<void>} onNextChange
 * @property {typeof check} check
 * @property {typeof sync} sync
 *
 * This function returns an instance of the Check
 *
 *
 * When used in a test suite:
 * ```js
 * let fixture = await loadFixture({
 *   root: './fixtures/astro-check-watch/',
 * });
 * ```
 * `opts` will override the options passed to the `AstroChecker`
 *
 * ```js
 * let { check, stop, watch } = fixture.check({
 *   flags: { watch: true },
 * });
 * ```
 */

/** @type {import('./node_modules/astro/dist/core/logger/core').LogOptions} */
export const defaultLogging = {
	dest: nodeLogDestination,
	level: 'error',
};

/** @type {import('./node_modules/astro/dist/core/logger/core').LogOptions} */
export const silentLogging = {
	dest: nodeLogDestination,
	level: 'silent',
};

/**
 * Load Astro fixture
 * @param {AstroInlineConfig} inlineConfig Astro config partial (note: must specify `root`)
 * @returns {Promise<Fixture>} The fixture. Has the following properties:
 *   .config     - Returns the final config. Will be automatically passed to the methods below:
 *
 *   Build
 *   .build()          - Async. Builds into current folder (will erase previous build)
 *   .readFile(path)   - Async. Read a file from the build.
 *
 *   Dev
 *   .startDevServer() - Async. Starts a dev server at an available port. Be sure to call devServer.stop() before test exit.
 *   .fetch(url)       - Async. Returns a URL from the preview server (must have called .preview() before)
 *
 *   Preview
 *   .preview()        - Async. Starts a preview server. Note this can’t be running in same fixture as .dev() as they share ports. Also, you must call `server.close()` before test exit
 *
 *   Clean-up
 *   .clean()          - Async. Removes the project’s dist folder.
 */
export async function loadFixture(inlineConfig) {
	if (!inlineConfig?.root) throw new Error("Must provide { root: './fixtures/...' }");

	// Silent by default during tests to not pollute the console output
	inlineConfig.logLevel = 'silent';

	let root = inlineConfig.root;
	// Handle URL, should already be absolute so just convert to path
	if (typeof root !== 'string') {
		root = fileURLToPath(root);
	}
	// Handle "file:///C:/Users/fred", convert to "C:/Users/fred"
	else if (root.startsWith('file://')) {
		root = fileURLToPath(new URL(root));
	}
	// Handle "./fixtures/...", convert to absolute path
	else if (!path.isAbsolute(root)) {
		throw new Error("Must provide { root: '.../fixtures/...' } with an absolute path");
	}
	// biome-ignore lint/style/noParameterAssign: safe?
	inlineConfig = { ...inlineConfig, root };
	// Load the config.
	const { astroConfig: config } = await resolveConfig(inlineConfig, 'dev');

	const resolveUrl = (url) =>
		`http://${config.server.host || 'localhost'}:${config.server.port}${url.replace(/^\/?/, '/')}`;

	// A map of files that have been edited.
	const fileEdits = new Map();

	const resetAllFiles = () => {
		for (const [, reset] of fileEdits) {
			reset();
		}
		fileEdits.clear();
	};

	const onNextChange = () =>
		devServer
			? new Promise((resolve) => devServer.watcher.once('change', resolve))
			: Promise.reject(new Error('No dev server running'));

	// After each test, reset each of the edits to their original contents.
	if (typeof afterEach === 'function') {
		afterEach(resetAllFiles);
	}
	// Also do it on process exit, just in case.
	process.on('exit', resetAllFiles);

	const fixtureId = new Date().valueOf();
	let devServer;

	return {
		build: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'production';
			return build(mergeConfig(inlineConfig, extraInlineConfig), {
				teardownCompiler: false,
			});
		},
		sync: async (extraInlineConfig, opts) => {
			return sync(mergeConfig(inlineConfig, extraInlineConfig), opts);
		},
		check: async (opts) => {
			return await check(opts);
		},
		startDevServer: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'development';
			devServer = await dev(mergeConfig(inlineConfig, extraInlineConfig));
			config.server.host = parseAddressToHost(devServer.address.address); // update host
			config.server.port = devServer.address.port; // update port
			return devServer;
		},
		config,
		resolveUrl,
		fetch: async (url, init) => {
			const resolvedUrl = resolveUrl(url);
			try {
				return await fetch(resolvedUrl, init);
			} catch (err) {
				// node fetch throws a vague error when it fails, so we log the url here to easily debug it
				if (err.message?.includes('fetch failed')) {
					console.error(`[astro test] failed to fetch ${resolvedUrl}`);
					console.error(err);
				}
				throw err;
			}
		},
		preview: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'production';
			const previewServer = await preview(mergeConfig(inlineConfig, extraInlineConfig));
			config.server.host = parseAddressToHost(previewServer.host); // update host
			config.server.port = previewServer.port; // update port
			return previewServer;
		},
		pathExists: (p) => fs.existsSync(new URL(p.replace(/^\//, ''), config.outDir)),
		readFile: (filePath, encoding) =>
			fs.promises.readFile(
				new URL(filePath.replace(/^\//, ''), config.outDir),
				encoding === undefined ? 'utf8' : encoding
			),
		readdir: (fp) => fs.promises.readdir(new URL(fp.replace(/^\//, ''), config.outDir)),
		glob: (p) =>
			fastGlob(p, {
				cwd: fileURLToPath(config.outDir),
			}),
		clean: async () => {
			await fs.promises.rm(config.outDir, {
				maxRetries: 10,
				recursive: true,
				force: true,
			});
		},
		loadTestAdapterApp: async (streaming) => {
			const url = new URL(`./server/entry.mjs?id=${fixtureId}`, config.outDir);
			const { createApp, manifest } = await import(url);
			const app = createApp(streaming);
			app.manifest = manifest;
			return app;
		},
		loadEntryPoint: async (pagePath, routes, streaming) => {
			const virtualModule = getVirtualModulePageNameFromPath(RESOLVED_SPLIT_MODULE_ID, pagePath);
			const filePath = makeSplitEntryPointFileName(virtualModule, routes);
			const url = new URL(`./server/${filePath}?id=${fixtureId}`, config.outDir);
			const { createApp, manifest } = await import(url);
			const app = createApp(streaming);
			app.manifest = manifest;
			return app;
		},
		editFile: async (filePath, newContentsOrCallback) => {
			const fileUrl = new URL(filePath.replace(/^\//, ''), config.root);
			const contents = await fs.promises.readFile(fileUrl, 'utf-8');
			const reset = () => {
				fs.writeFileSync(fileUrl, contents);
			};
			// Only save this reset if not already in the map, in case multiple edits happen
			// to the same file.
			if (!fileEdits.has(fileUrl.toString())) {
				fileEdits.set(fileUrl.toString(), reset);
			}
			const newContents =
				typeof newContentsOrCallback === 'function'
					? newContentsOrCallback(contents)
					: newContentsOrCallback;
			const nextChange = onNextChange();
			await fs.promises.writeFile(fileUrl, newContents);
			await nextChange;
			return reset;
		},
		resetAllFiles,
	};
}

/**
 * @param {string} [address]
 */
function parseAddressToHost(address) {
	if (address?.startsWith('::')) {
		return `[${address}]`;
	}
	return address;
}

const cliPath = fileURLToPath(new URL('./node_modules/astro/astro.js', import.meta.url));

/** Returns a process running the Astro CLI. */
export function cli(/** @type {string[]} */ ...args) {
	const spawned = execa('node', [cliPath, ...args], {
		env: { ASTRO_TELEMETRY_DISABLED: true },
	});

	spawned.stdout.setEncoding('utf8');

	return spawned;
}

export async function parseCliDevStart(proc) {
	let stdout = '';
	let stderr = '';

	for await (const chunk of proc.stdout) {
		stdout += chunk;
		if (chunk.includes('Local')) break;
	}
	if (!stdout) {
		for await (const chunk of proc.stderr) {
			stderr += chunk;
			break;
		}
	}

	proc.kill();
	stdout = stripAnsi(stdout);
	stderr = stripAnsi(stderr);

	if (stderr) {
		throw new Error(stderr);
	}

	const messages = stdout
		.split('\n')
		.filter((ln) => !!ln.trim())
		.map((ln) => ln.replace(/[🚀┃]/gu, '').replace(/\s+/g, ' ').trim());

	return { messages };
}

export async function cliServerLogSetup(flags = [], cmd = 'dev') {
	const proc = cli(cmd, ...flags);

	const { messages } = await parseCliDevStart(proc);

	const local = messages.find((msg) => msg.includes('Local'))?.replace(/Local\s*/g, '');
	const network = messages.find((msg) => msg.includes('Network'))?.replace(/Network\s*/g, '');

	return { local, network };
}

export const isLinux = os.platform() === 'linux';
export const isMacOS = os.platform() === 'darwin';
export const isWindows = os.platform() === 'win32';

export function fixLineEndings(str) {
	return str.replace(/\r\n/g, '\n');
}

export async function* streamAsyncIterator(stream) {
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}
