#!/usr/bin/env node
export default async function run() {
	const [cmd, ...args] = process.argv.slice(2);
	switch (cmd) {
		case 'test': {
			const { default: test } = await import('./cmd/test.js');
			await test(...args);
			break;
		}
	}
}

run();
