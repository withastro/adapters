import type { AstroConfig, RouteData, RoutePart } from 'astro';

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import glob from 'tiny-glob';
import { removeLeadingForwardSlash, removeTrailingForwardSlash } from './assets.js';

function prependForwardSlash(path: string) {
	return path[0] === '/' ? path : `/${path}`;
}

export const getParts = (part: string) => {
	const result: RoutePart[] = [];
	part.split(/\[(.+?\(.+?\)|.+?)\]/).map((str, i) => {
		if (!str) return;
		const dynamic = i % 2 === 1;

		const [, content] = dynamic ? /([^(]+)$/.exec(str) || [null, null] : [null, str];

		if (!content || (dynamic && !/^(?:\.\.\.)?[\w$]+$/.test(content))) {
			throw new Error('Parameter name must match /^[a-zA-Z0-9_$]+$/');
		}

		result.push({
			content,
			dynamic,
			spread: dynamic && /^\.{3}.+$/.test(content),
		});
	});

	return result;
};

const segmentsToCfSyntax = (segments: RouteData['segments'], _config: AstroConfig) => {
	const pathSegments = [];
	if (removeLeadingForwardSlash(removeTrailingForwardSlash(_config.base)).length > 0) {
		pathSegments.push(removeLeadingForwardSlash(removeTrailingForwardSlash(_config.base)));
	}
	for (const segment of segments.flat()) {
		if (segment.dynamic) pathSegments.push('*');
		else pathSegments.push(segment.content);
	}
	return pathSegments;
};

class TrieNode {
	children: Map<string, TrieNode> = new Map();
	isEndOfPath = false;
	hasWildcardChild = false;
}

class PathTrie {
	root: TrieNode;

	constructor() {
		this.root = new TrieNode();
	}

	insert(path: string[]) {
		let node = this.root;
		for (const segment of path) {
			if (segment === '*') {
				node.hasWildcardChild = true;
				break;
			}
			if (!node.children.has(segment)) {
				node.children.set(segment, new TrieNode());
			}

			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			node = node.children.get(segment)!;
		}

		node.isEndOfPath = true;
	}

	private dfs(node: TrieNode, path: string[], allPaths: string[][]): void {
		if (node.hasWildcardChild) {
			allPaths.push([...path, '*']);
			return;
		}

		if (node.isEndOfPath) {
			allPaths.push([...path]);
		}

		for (const [segment, childNode] of node.children) {
			this.dfs(childNode, [...path, segment], allPaths);
		}
	}

	getAllPaths(): string[][] {
		const allPaths: string[][] = [];
		this.dfs(this.root, [], allPaths);
		return allPaths;
	}
}

export default async function (
	_config: AstroConfig,
	routes: RouteData[],
	pages: {
		pathname: string;
	}[],
	redirects: RoutePart[][][],
	includeExtends:
		| {
				pattern: string;
		  }[]
		| undefined,
	excludeExtends:
		| {
				pattern: string;
		  }[]
		| undefined
) {
	const includePaths: string[][] = [];
	const excludePaths: string[][] = [];

	let hasPrerendered404 = false;
	for (const route of routes) {
		const convertedPath = segmentsToCfSyntax(route.segments, _config);
		if (route.pathname === '/404' && route.prerender === true) hasPrerendered404 = true;

		if (route.type === 'page') if (route.prerender === false) includePaths.push(convertedPath);

		if (route.type === 'endpoint')
			if (route.prerender === false) includePaths.push(convertedPath);
			else excludePaths.push(convertedPath);

		if (route.type === 'redirect') excludePaths.push(convertedPath);
	}

	for (const page of pages) {
		const pageSegments = removeLeadingForwardSlash(page.pathname)
			.split(posix.sep)
			.filter(Boolean)
			.map((s) => {
				return getParts(s);
			});
		excludePaths.push(segmentsToCfSyntax(pageSegments, _config));
	}

	if (existsSync(fileURLToPath(_config.publicDir))) {
		const staticFiles = await glob(`${fileURLToPath(_config.publicDir)}/**/*`, {
			cwd: fileURLToPath(_config.publicDir),
			filesOnly: true,
			dot: true,
		});
		for (const staticFile of staticFiles) {
			if (['_headers', '_redirects', '_routes.json'].includes(staticFile)) continue;
			const staticPath = staticFile;

			const segments = removeLeadingForwardSlash(staticPath)
				.split(posix.sep)
				.filter(Boolean)
				.map((s: string) => {
					return getParts(s);
				});
			excludePaths.push(segmentsToCfSyntax(segments, _config));
		}
	}

	const assetsPath = segmentsToCfSyntax(
		[
			[{ content: _config.build.assets, dynamic: false, spread: false }],
			[{ content: '', dynamic: true, spread: false }],
		],
		_config
	);
	excludePaths.push(assetsPath);

	const pagefindPath = segmentsToCfSyntax(
		[
			[{ content: 'pagefind', dynamic: false, spread: false }],
			[{ content: '', dynamic: true, spread: false }],
		],
		_config
	);
	excludePaths.push(pagefindPath);

	for (const redirect of redirects) {
		excludePaths.push(segmentsToCfSyntax(redirect, _config));
	}

	const includeTrie = new PathTrie();
	for (const includePath of includePaths) {
		includeTrie.insert(includePath);
	}
	const deduplicatedIncludePaths = includeTrie.getAllPaths();

	const excludeTrie = new PathTrie();
	for (const excludePath of excludePaths) {
		excludeTrie.insert(excludePath);
	}
	const deduplicatedExcludePaths = excludeTrie.getAllPaths();

	if (
		!hasPrerendered404 ||
		deduplicatedIncludePaths.length > 100 ||
		deduplicatedIncludePaths.length > deduplicatedExcludePaths.length
	) {
		try {
			await writeFile(
				new URL('./_routes.json', _config.outDir),
				JSON.stringify(
					{
						version: 1,
						include: ['/*'].concat(includeExtends?.map((entry) => entry.pattern) ?? []),
						exclude: deduplicatedExcludePaths
							.map((path) => `${prependForwardSlash(path.join('/'))}`)
							.slice(0, 99)
							.concat(excludeExtends?.map((entry) => entry.pattern) ?? []),
					},
					null,
					2
				),
				'utf-8'
			);
		} catch (error) {
			// TODO
		}
	} else if (deduplicatedIncludePaths.length < deduplicatedExcludePaths.length) {
		try {
			await writeFile(
				new URL('./_routes.json', _config.outDir),
				JSON.stringify(
					{
						version: 1,
						include: deduplicatedIncludePaths
							.map((path) => `${prependForwardSlash(path.join('/'))}`)
							.concat(includeExtends?.map((entry) => entry.pattern) ?? []),
						exclude: ([] as string[]).concat(excludeExtends?.map((entry) => entry.pattern) ?? []),
					},
					null,
					2
				),
				'utf-8'
			);
		} catch (error) {
			// TODO
		}
	} else {
		try {
			await writeFile(
				new URL('./_routes.json', _config.outDir),
				JSON.stringify(
					{
						version: 1,
						include: ['/*'].concat(includeExtends?.map((entry) => entry.pattern) ?? []),
						exclude: deduplicatedExcludePaths
							.map((path) => `${prependForwardSlash(path.join('/'))}`)
							.slice(0, 99)
							.concat(excludeExtends?.map((entry) => entry.pattern) ?? []),
					},
					null,
					2
				),
				'utf-8'
			);
		} catch (error) {
			// TODO
		}
	}
}
