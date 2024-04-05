import type { OutputBundle } from 'rollup';
import type { Plugin } from 'vite';

export class UnusedChunkAnalyzer {
	private unusedChunks?: string[];

	public getPlugin(): Plugin {
		return {
			name: 'unused-chunk-analyzer',
			generateBundle: (_, bundle) => {
				this.processBundle(bundle);
			},
		};
	}

	private processBundle(bundle: OutputBundle) {
		const chunkNamesToFiles = new Map<string, string>();

		const entryChunks: string[] = [];
		const chunkToDependencies = new Map<string, string[]>();

		for (const chunk of Object.values(bundle)) {
			if (chunk.type !== 'chunk') continue;

			chunkNamesToFiles.set(chunk.name, chunk.fileName);
			chunkToDependencies.set(chunk.fileName, [...chunk.imports, ...chunk.dynamicImports]);

			if (chunk.isEntry) {
				// Entry chunks should always be kept around since they are to be imported by the runtime
				entryChunks.push(chunk.fileName);
			}
		}

		const chunkDecisions = new Map<string, boolean>();

		for (const entry of entryChunks) {
			// Keep all entry chunks
			chunkDecisions.set(entry, true);
		}

		for (const chunk of ['prerender', 'prerender@_@astro']) {
			// Exclude prerender chunks from the server bundle
			const fileName = chunkNamesToFiles.get(chunk);
			if (fileName) {
				chunkDecisions.set(fileName, false);
			}
		}

		const chunksToWalk = [...entryChunks];

		for (let chunk = chunksToWalk.pop(); chunk; chunk = chunksToWalk.pop()) {
			for (const dep of chunkToDependencies.get(chunk) ?? []) {
				if (chunkDecisions.has(dep)) continue;

				chunkDecisions.set(dep, true);
				chunksToWalk.push(dep);
			}
		}

		this.unusedChunks = Array.from(chunkToDependencies.keys()).filter(
			(chunk) => !chunkDecisions.get(chunk)
		);
	}

	public getUnusedChunks(): string[] {
		return this.unusedChunks ?? [];
	}
}
