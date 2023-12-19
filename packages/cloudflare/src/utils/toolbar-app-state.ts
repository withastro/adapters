import type { D1Database } from '@cloudflare/workers-types/experimental/index.js';

import { assign, fromPromise, setup } from 'xstate';
import test from './dev-toolbar-app/test.html?raw';

console.log(test);
export const machine = setup({
	types: {
		input: {} as {
			bindings: {
				D1?: (string | undefined)[];
			};
			proxyStubs: any;
		},
		context: {} as {
			bindings: {
				D1?: (string | undefined)[];
			};
			proxyStubs: any;
			lastTab?: string;
			lastView: {
				home?: string;
				d1?: string;
			};
			renderData?: any;
			selectedDatabase?: string;
			selectedTable?: string;
			selectedRow?: Record<string, unknown>;
		},
		events: {} as
			| { type: 'open' }
			| { type: 'close' }
			| { type: 'goBack' }
			| { type: 'selectRow'; row: Record<string, unknown> }
			| { type: 'selectTable'; row: { name: string } }
			| { type: 'selectDatabase'; database: string }
			| { type: 'editEntry' }
			| { type: 'saveEntry'; row: Record<string, unknown> }
			| { type: 'navigateToHome' }
			| { type: 'navigateToKV' }
			| { type: 'navigateToD1' },
	},
	actions: {},
	guards: {
		isLastTabUndefined: ({ context }) => !context.lastTab,
		isLastTabHome: ({ context }) => context.lastTab === 'home',
		isLastTabD1: ({ context }) => context.lastTab === 'd1',
		isLastTabKV: ({ context }) => context.lastTab === 'kv',
		isLastViewHomeUndefined: ({ context }) => !context.lastView.home,
		isLastViewHomeDashboard: ({ context }) => context.lastView.home === 'dashboard',
		isLastViewD1Undefined: ({ context }) => !context.lastView.d1,
		isLastViewD1Database: ({ context }) => context.lastView.d1 === 'databases',
		isLastViewD1Tables: ({ context }) => context.lastView.d1 === 'tables',
		isLastViewD1Rows: ({ context }) => context.lastView.d1 === 'rows',
	},
	actors: {
		loadDashboard: fromPromise(async () => {
			return Promise.resolve('Dashboard');
		}),
		loadDatabases: fromPromise(async ({ input }: { input: string[] }) => {
			return Promise.resolve(input);
		}),
		loadTables: fromPromise(async ({ input }: { input: { binding: D1Database } }) => {
			const tables = await input.binding
				.prepare('PRAGMA table_list')
				.run()
				.then((res) =>
					res.results.filter(
						(row) =>
							!['sqlite_temp_schema', '_cf_KV', 'sqlite_sequence', 'sqlite_schema'].includes(
								// @ts-expect-error FIXME
								row.name
							)
					)
				);
			return Promise.resolve(tables.length > 0 ? tables : [{}]);
		}),
		loadRows: fromPromise(
			async ({ input }: { input: { binding: D1Database; table: string } }) => {
				const rows = await input.binding.prepare(`SELECT * FROM ${input.table}`).run();
				return Promise.resolve(rows.results);
			}
		),
		loadEntry: fromPromise(
			async ({
				input,
			}: { input: { binding: D1Database; table: string; row: Record<string, unknown> } }) => {
				const entry = await input.binding
					.prepare(`SELECT * FROM ${input.table} WHERE id = ${input.row.id}`)
					.run();
				return Promise.resolve(entry.results[0]);
			}
		),
	},
}).createMachine({
	context: ({ input }) => ({
		lastView: {},
		bindings: input.bindings,
		proxyStubs: input.proxyStubs,
	}),
	id: 'App',
	initial: 'Inactive',
	states: {
		Inactive: {
			on: {
				open: [
					{
						target: 'Home',
						guard: 'isLastTabHome',
					},
					{
						target: 'D1',
						guard: 'isLastTabD1',
					},
					{
						target: 'Home',
						guard: 'isLastTabUndefined',
					},
					{
						target: 'KV',
						guard: 'isLastTabKV',
					},
				],
			},
		},
		Home: {
			entry: assign(({ context }) => {
				let newContext = context;
				newContext.lastTab = 'home';
				return newContext;
			}),
			initial: 'Opened',
			states: {
				Opened: {
					always: [
						{
							target: 'Loading Dashboard',
							guard: 'isLastViewHomeUndefined',
						},
						{
							target: 'Loading Dashboard',
							guard: 'isLastViewHomeDashboard',
						},
					],
				},
				'Loading Dashboard': {
					entry: assign(({ context }) => {
						let newContext = context;
						newContext.lastView.home = 'dashboard';
						return newContext;
					}),
					invoke: {
						src: 'loadDashboard',
						id: 'loadDashboard',
						onDone: [
							{
								target: 'Showing Dashboard',
								actions: assign(({ context, event }) => {
									let newContext = context;
									newContext.renderData = event.output;
									return newContext;
								}),
							},
						],
					},
				},
				'Showing Dashboard': {},
			},
			on: {
				close: {
					target: 'Inactive',
				},
				navigateToD1: {
					target: 'D1',
					reenter: true,
				},
				navigateToKV: {
					target: 'KV',
					reenter: true,
				},
			},
		},
		D1: {
			entry: assign({ lastTab: 'd1' }),
			initial: 'Opened',
			states: {
				Opened: {
					always: [
						{
							target: 'Loading Databases',
							guard: 'isLastViewD1Undefined',
						},
						{
							target: 'Loading Databases',
							guard: 'isLastViewD1Database',
						},
						{
							target: 'Loading Tables',
							guard: 'isLastViewD1Tables',
						},
						{
							target: 'Loading Rows',
							guard: 'isLastViewD1Rows',
						},
					],
				},
				'Loading Databases': {
					entry: assign(({ context }) => {
						let newContext = context;
						newContext.lastView.d1 = 'databases';
						return newContext;
					}),
					invoke: {
						src: 'loadDatabases',
						id: 'loadDatabases',
						// @ts-expect-error FIXME
						input: ({ context }) => context.bindings.D1,
						onDone: [
							{
								target: 'Showing Databases',
								actions: assign(({ context, event }) => {
									let newContext = context;
									newContext.renderData = event.output;
									return newContext;
								}),
							},
						],
					},
				},
				'Showing Databases': {
					on: {
						selectDatabase: {
							target: 'Loading Tables',
							description: 'click on database card',
							actions: assign(({ context, event }) => {
								let newContext = context;
								newContext.selectedDatabase = event.database;
								return newContext;
							}),
							reenter: true,
						},
					},
				},
				'Loading Tables': {
					entry: assign(({ context }) => {
						let newContext = context;
						newContext.lastView.d1 = 'tables';
						return newContext;
					}),
					invoke: {
						src: 'loadTables',
						id: 'loadTables',
						// @ts-expect-error FIXME
						input: ({ context }) => {
							if (context.selectedDatabase) {
								return { binding: context.proxyStubs[context.selectedDatabase] };
							}
						},
						onDone: [
							{
								target: 'Showing Tables',
								actions: assign(({ context, event }) => {
									let newContext = context;
									newContext.renderData = event.output;
									return newContext;
								}),
							},
						],
					},
				},
				'Showing Tables': {
					on: {
						goBack: {
							target: 'Loading Databases',
							description: 'click back button',
							reenter: true,
						},
						selectTable: {
							target: 'Loading Rows',
							actions: assign(({ context, event }) => {
								let newContext = context;
								newContext.selectedTable = event.row.name;
								return newContext;
							}),
							reenter: true,
						},
					},
				},
				'Loading Rows': {
					entry: assign(({ context }) => {
						let newContext = context;
						newContext.lastView.d1 = 'rows';
						return newContext;
					}),
					invoke: {
						src: 'loadRows',
						id: 'loadRows',
						// @ts-expect-error FIXME
						input: ({ context }) => {
							if (context.selectedDatabase) {
								return {
									binding: context.proxyStubs[context.selectedDatabase],
									table: context.selectedTable,
								};
							}
						},
						onDone: [
							{
								target: 'Showing Rows',
								actions: assign(({ context, event }) => {
									let newContext = context;
									newContext.renderData = event.output;
									return newContext;
								}),
							},
						],
					},
				},
				'Showing Rows': {
					on: {
						goBack: {
							target: 'Loading Tables',
							description: 'click back button',
							reenter: true,
						},
						selectRow: {
							target: 'Loading Entry',
							actions: assign(({ context, event }) => {
								let newContext = context;
								newContext.selectedRow = event.row;
								return newContext;
							}),
							reenter: true,
						},
					},
				},
				'Loading Entry': {
					entry: assign(({ context }) => {
						let newContext = context;
						newContext.lastView.d1 = 'entry';
						return newContext;
					}),
					invoke: {
						src: 'loadEntry',
						id: 'loadEntry',
						// @ts-expect-error FIXME
						input: ({ context }) => {
							if (context.selectedDatabase) {
								return {
									binding: context.proxyStubs[context.selectedDatabase],
									table: context.selectedTable,
									row: context.selectedRow,
								};
							}
						},
						onDone: [
							{
								target: 'Showing Entry',
								actions: assign(({ context, event }) => {
									let newContext = context;
									newContext.renderData = event.output;
									return newContext;
								}),
							},
						],
					},
				},
				'Showing Entry': {
					on: {
						goBack: {
							target: 'Loading Rows',
							description: 'click back button',
							reenter: true,
						},
						editEntry: {
							target: 'Editing Entry',
						},
					},
				},
				'Editing Entry': {
					entry: assign(({ context }) => {
						let newContext = context;
						newContext.lastView.d1 = 'edit';
						return newContext;
					}),
					on: {
						goBack: {
							target: 'Loading Entry',
							description: 'click back button',
							reenter: true,
						},
						saveEntry: {
							target: 'Loading Entry',
							actions: async ({ context, event }) => {
								if (context.selectedDatabase) {
									await context.proxyStubs[context.selectedDatabase]
										.prepare(
											`UPDATE ${context.selectedTable} SET name = ${event.row['name']} WHERE id = ${event.row['id']}`
										)
										.run();
								}
							},
							reenter: true,
						},
					},
				},
			},
			on: {
				close: {
					target: 'Inactive',
				},
				navigateToHome: {
					target: 'Home',
					reenter: true,
				},
				navigateToKV: {
					target: 'KV',
					reenter: true,
				},
			},
		},
		KV: {},
	},
});
