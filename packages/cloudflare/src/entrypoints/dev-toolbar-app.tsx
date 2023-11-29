import type { DevOverlayPlugin } from 'astro';
import type { FunctionComponent } from 'preact';

import { render } from 'preact';
import { signal } from '@preact/signals';

const App: FunctionComponent = ({ children }) => {
	return (
		// @ts-ignore FIXME
		<astro-dev-toolbar-window style={{ padding: '0px', overflow: 'auto' }}>
			{children}
			{/* @ts-ignore FIXME */}
		</astro-dev-toolbar-window>
	);
};

const activeTab = signal('');
const activeView = signal('');
const hasGoBack = signal('false');
const tabs = signal([
	{
		id: 'home',
		event: 'navigateToHome',
		label: 'Home',
		icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 9q-.425 0-.712-.288T13 8V4q0-.425.288-.712T14 3h6q.425 0 .713.288T21 4v4q0 .425-.288.713T20 9h-6ZM4 13q-.425 0-.712-.288T3 12V4q0-.425.288-.712T4 3h6q.425 0 .713.288T11 4v8q0 .425-.288.713T10 13H4Zm10 8q-.425 0-.712-.288T13 20v-8q0-.425.288-.712T14 11h6q.425 0 .713.288T21 12v8q0 .425-.288.713T20 21h-6ZM4 21q-.425 0-.712-.288T3 20v-4q0-.425.288-.712T4 15h6q.425 0 .713.288T11 16v4q0 .425-.288.713T10 21H4Z"/></svg>',
	},
	{
		id: 'd1',
		event: 'navigateToD1',
		label: 'D1',
		icon: '<svg width="21.241" height="24" viewBox="0 0 65 64" xmlns="http://www.w3.org/2000/svg"><path d="m23.6 22.2 3.03 1.75v3.5L23.6 29.2l-3.03-1.75v-3.5zM20.06 49l3.54-3.54L27.14 49l-3.54 3.54zm3.54-14.7c.593.0 1.17.176 1.67.506.493.33.878.798 1.1 1.35.227.548.286 1.15.171 1.73-.116.582-.401 1.12-.821 1.54s-.954.705-1.54.821c-.582.116-1.19.0563-1.73-.171-.548-.227-1.02-.612-1.35-1.1-.33-.493-.506-1.07-.506-1.67.0-.796.316-1.56.879-2.12.563-.563 1.33-.879 2.12-.879zM10.3 11.2l6.42-4.89 1.21-.37h29l1.19.39 6.61 4.89.82 1.61v38L55 52.21l-4.83 5.11-1.46.63h-31.7l-1.37-.54-5.48-5.11-.64-1.47v-38zm3.21 25.4 4.47 4.94h.0561v4h-1.83l-2.7-3v7.39l4.26 4h30l3.7-3.91V42.3l-3.67 3.24h-18.6v-4h17.2l5.19-4.61v-7.44l-3.67 3.25h-18.7v-4h17.2l5.19-4.6v-6.92l-3.67 3.26h-31.6l-2.74-2.8v6.12l4.47 4.94h.0561v4h-1.83l-2.7-3zm32.7-26.7h-27.6l-4.07 3.11 3.4 3.48h28.4l4-3.56z"></path></svg>',
	},
]);

const Tabs = () => {
	return (
		<>
			{tabs.value.map((tab) => {
				return (
					<div
						style={{
							display: 'flex',
							padding: '6px',
							alignItems: 'center',
							gap: '8px',
							cursor: 'pointer',
							background: activeTab.value === tab.id ? '#474E5E' : 'transparent',
							borderRadius: '4px',
							transition: 'background 0.2s ease-in-out',
						}}
						onClick={() => {
							if (activeTab.value !== tab.id) {
								if (import.meta.hot) {
									import.meta.hot.send('astro-dev-toolbar:cloudflare-app:client-data-.send()', {
										msg: JSON.stringify({
											type: tab.event,
										}),
									});
								}
							}
						}}
					>
						<div
							style={{
								fill: '#CCCED8',
							}}
							dangerouslySetInnerHTML={{
								__html: tab.icon,
							}}
						/>
						<span>{tab.label}</span>
					</div>
				);
			})}
		</>
	);
};

const STRING = (value = 'UNKNOWN') => {
	return (
		<>
			<div>{value}</div>
		</>
	);
};

const Cards = (values: any) => {
	return (
		<>
			{values.map((value: any) => {
				return (
					<div
						style={{
							display: 'flex',
							width: '250px',
							padding: '32px 16px',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '8px',
							borderRadius: '8px',
							border: '1px solid #23262D',
							cursor: 'pointer',
							background: '#13151A',
							boxShadow:
								'0px 0px 0px 0px rgba(0, 0, 0, 0.10), 0px 1px 2px 0px rgba(0, 0, 0, 0.10), 0px 4px 4px 0px rgba(0, 0, 0, 0.09), 0px 10px 6px 0px rgba(0, 0, 0, 0.05), 0px 17px 7px 0px rgba(0, 0, 0, 0.01), 0px 26px 7px 0px rgba(0, 0, 0, 0.00)',
						}}
						onClick={() => {
							if (import.meta.hot) {
								import.meta.hot.send('astro-dev-toolbar:cloudflare-app:client-data-.send()', {
									msg: JSON.stringify({
										type: 'selectDatabase',
										database: value,
									}),
								});
							}
						}}
					>
						{value}
					</div>
				);
			})}
		</>
	);
};

const Table = (data: any) => {
	return (
		<>
			{/* TABLE */}
			<div
				style={{
					display: 'flex',
					flexFlow: 'column nowrap',
					backgroundColor: 'white',
					width: '100%',
					margin: '0 auto',
					borderRadius: '4px',
					border: '1px solid #DADADA',
					boxShadow: '0px 1px 4px rgba(0, 0, 0, .08)',
				}}
			>
				{/* HEADER */}
				<div
					style={{
						display: 'flex',
						flexFlow: 'row nowrap',
						width: '100%',
						borderBottom: '1px solid #dadada',
						backgroundColor: '#ececec',
						color: '#3e3e3e',
						fontWeight: 'bold',
					}}
				>
					{Object.keys(data[0]).map((key) => {
						return (
							<div
								style={{
									display: 'flex',
									flex: '1',
									fontSize: '14px',
									padding: '8px 0',
									justifyContent: 'center',
									alignItems: 'center',
								}}
							>
								{key}
							</div>
						);
					})}
				</div>
				{/* BODY */}
				{data.map((row: any) => {
					return (
						<div
							style={{
								display: 'flex',
								flexFlow: 'row nowrap',
								width: '100%',
								borderBottom: '1px solid #dadada',
								color: '#3e3e3e',
								fontWeight: 'bold',
								cursor: 'pointer',
							}}
							onClick={() => {
								if (import.meta.hot) {
									import.meta.hot.send('astro-dev-toolbar:cloudflare-app:client-data-.send()', {
										msg: JSON.stringify({
											type: activeView.value === 'tables' ? 'selectTable' : 'selectRow',
											row: row,
										}),
									});
								}
							}}
						>
							{Object.values(row).map((column) => {
								return (
									<div
										style={{
											display: 'flex',
											flex: '1',
											fontSize: '14px',
											padding: '8px 0',
											justifyContent: 'center',
											alignItems: 'center',
										}}
									>
										{/* @ts-expect-error */}
										{column}
									</div>
								);
							})}
						</div>
					);
				})}
			</div>
		</>
	);
};

const Entry = (data: any) => {
	return (
		<>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					gap: '16px',
					flex: '1 0 0',
					alignSelf: 'stretch',
				}}
			>
				{Object.entries(data).map(([key, value]) => {
					return (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'flex-start',
								gap: '8px',
								alignSelf: 'stretch',
							}}
						>
							<span>{key}</span>
							<div
								style={{
									border: '1px solid #000',
									background: '#474E5E',
									padding: '8px',
									borderRadius: '4px',
									alignSelf: 'stretch',
								}}
							>
								<span>{JSON.stringify(value)}</span>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
};

const newValue = signal('');
const Edit = (data: any) => {
	return (
		<>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					gap: '16px',
					flex: '1 0 0',
					alignSelf: 'stretch',
				}}
			>
				{Object.entries(data).map(([key, value]) => {
					return (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'flex-start',
								gap: '8px',
								alignSelf: 'stretch',
							}}
						>
							<span>{key}</span>
							<div
								style={{
									border: '1px solid #000',
									background: '#474E5E',
									padding: '8px',
									borderRadius: '4px',
									alignSelf: 'stretch',
								}}
							>
								<input
									type="text"
									value={JSON.stringify(value)}
									disabled={key === 'id'}
									onChange={(event) => {
										// @ts-ignore
										newValue.value = event.target.value;
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
};

const GoBack = () => {
	return (
		<>
			<div
				style={{
					cursor: hasGoBack.value === 'true' ? 'pointer' : 'not-allowed',
					color: hasGoBack.value === 'true' ? 'white' : 'gray',
					transition: 'background 0.2s ease-in-out',
				}}
			>
				<span
					onClick={() => {
						if (import.meta.hot) {
							import.meta.hot.send('astro-dev-toolbar:cloudflare-app:client-data-.send()', {
								msg: JSON.stringify({
									type: 'goBack',
								}),
							});
						}
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="m3.55 12l7.35 7.35q.375.375.363.875t-.388.875q-.375.375-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675T.825 12q0-.375.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388q.375.375.375.875t-.375.875L3.55 12Z"
						/>
					</svg>
					Go back
				</span>
			</div>
		</>
	);
};

const canBeEdited = signal('false');
const EditButton = () => {
	return (
		<>
			<div
				style={{
					cursor: canBeEdited.value === 'true' ? 'pointer' : 'not-allowed',
					color: canBeEdited.value === 'true' ? 'white' : 'gray',
					transition: 'background 0.2s ease-in-out',
				}}
			>
				<span
					onClick={() => {
						if (import.meta.hot) {
							import.meta.hot.send('astro-dev-toolbar:cloudflare-app:client-data-.send()', {
								msg: JSON.stringify({
									type: 'editEntry',
								}),
							});
						}
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M5 19h1.425L16.2 9.225L14.775 7.8L5 17.575V19Zm-2 2v-4.25L16.2 3.575q.3-.275.663-.425t.762-.15q.4 0 .775.15t.65.45L20.425 5q.3.275.438.65T21 6.4q0 .4-.137.763t-.438.662L7.25 21H3ZM19 6.4L17.6 5L19 6.4Zm-3.525 2.125l-.7-.725L16.2 9.225l-.725-.7Z"
						/>
					</svg>
					Edit
				</span>
			</div>
		</>
	);
};

const canBeSaved = signal('false');
const SaveButton = () => {
	return (
		<>
			<div
				style={{
					cursor: canBeSaved.value === 'true' ? 'pointer' : 'not-allowed',
					color: canBeSaved.value === 'true' ? 'white' : 'gray',
					transition: 'background 0.2s ease-in-out',
				}}
			>
				<span
					onClick={() => {
						if (import.meta.hot) {
							console.log(newValue.value);
							import.meta.hot.send('astro-dev-toolbar:cloudflare-app:client-data-.send()', {
								msg: JSON.stringify({
									type: 'saveEntry',
									row: {
										id: 1,
										name: newValue.value,
									},
								}),
							});
						}
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M15 9H5V5h10m-3 14a3 3 0 0 1-3-3a3 3 0 0 1 3-3a3 3 0 0 1 3 3a3 3 0 0 1-3 3m5-16H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7z"
						/>
					</svg>
					Save
				</span>
			</div>
		</>
	);
};
const page = signal(STRING());

const plugin: DevOverlayPlugin = {
	id: 'cloudflare-app',
	name: 'Cloudflare Plugin',
	icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M10.715 14.32H5.442l-.64-1.203L13.673 0l1.397.579l-1.752 9.112h5.24l.648 1.192L10.719 24l-1.412-.54ZM4.091 5.448a.579.579 0 1 1 0-1.157a.579.579 0 0 1 0 1.157m1.543 0a.579.579 0 1 1 0-1.157a.579.579 0 0 1 0 1.157m1.544 0a.579.579 0 1 1 0-1.157a.579.579 0 0 1 0 1.157m8.657-2.7h5.424l.772.771v16.975l-.772.772h-7.392l.374-.579h6.779l.432-.432V3.758l-.432-.432h-4.676l-.552 2.85h-.59l.529-2.877l.108-.552ZM2.74 21.265l-.772-.772V3.518l.772-.771h7.677l-.386.579H2.98l-.432.432v16.496l.432.432h5.586l-.092.579zm1.157-1.93h3.28l-.116.58h-3.55l-.192-.193v-3.473l.578 1.158zm13.117 0l.579.58H14.7l.385-.58z"/></svg>',
	init(canvas, eventTarget) {
		render(
			<App>
				<div
					style={{
						display: 'flex',
						padding: '18px',
						flexDirection: 'column',
						alignItems: 'flex-start',
						gap: '18px',
						flex: '1 0 0',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', width: '100%' }}>
						<Tabs />
					</div>
					<div style={{ height: '1px', alignSelf: 'stretch', background: '#1B1E24' }}></div>
					<div
						style={{
							display: 'flex',
							flexDirection: 'row',
							justifyContent: 'space-between',
							width: '100%',
						}}
					>
						<GoBack />
						<EditButton />
						<SaveButton />
					</div>
					<div
						style={{
							display: 'flex',
							placeContent: 'center',
							gap: '24px',
							justifyContent: 'space-evenly',
							alignItems: 'center',
							alignContent: 'center',
							flex: '1 0 0',
							alignSelf: 'stretch',
							flexWrap: 'wrap',
						}}
					>
						{page}
					</div>
				</div>
			</App>,
			canvas
		);

		eventTarget.addEventListener('plugin-toggled', (event) => {
			if (!(event instanceof CustomEvent)) return;

			if (event.detail.state === true) {
				console.log('The plugin is now enabled!');
			}
		});

		if (import.meta.hot) {
			import.meta.hot.on('astro-dev-toolbar:cloudflare-app:server-data', async (data) => {
				const receivedMessage = JSON.parse(data.msg);
				console.log('DEBUG STATE (CLIENT)', receivedMessage);
				activeTab.value = receivedMessage.context.lastTab;
				if (activeTab.value === 'home')
					switch (receivedMessage.context.lastView.home) {
						case 'dashboard':
							hasGoBack.value = 'false';
							page.value = STRING(receivedMessage.context.renderData);
							break;

						default:
							break;
					}
				else if (activeTab.value === 'd1')
					switch (receivedMessage.context.lastView.d1) {
						case 'databases':
							hasGoBack.value = 'false';
							canBeEdited.value = 'false';
							canBeSaved.value = 'false';
							page.value = Cards(receivedMessage.context.renderData);
							break;

						case 'tables':
							hasGoBack.value = 'true';
							canBeEdited.value = 'false';
							canBeSaved.value = 'false';
							activeView.value = 'tables';
							page.value = Table(receivedMessage.context.renderData);
							break;

						case 'rows':
							hasGoBack.value = 'true';
							canBeEdited.value = 'false';
							canBeSaved.value = 'false';
							activeView.value = 'rows';
							page.value = Table(receivedMessage.context.renderData);
							break;

						case 'entry':
							hasGoBack.value = 'true';
							canBeEdited.value = 'true';
							canBeSaved.value = 'false';
							activeView.value = 'entry';
							page.value = Entry(receivedMessage.context.renderData);
							break;

						case 'edit':
							hasGoBack.value = 'true';
							canBeEdited.value = 'false';
							canBeSaved.value = 'true';
							activeView.value = 'edit';
							page.value = Edit(receivedMessage.context.renderData);
							break;

						default:
							break;
					}
			});
		}
	},
};

export default plugin;
