import type { DevToolbarApp } from 'astro';

const plugin: DevToolbarApp = {
	id: 'cloudflare-app',
	name: 'Cloudflare DevToolbarApp',
	icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M10.715 14.32H5.442l-.64-1.203L13.673 0l1.397.579-1.752 9.112h5.24l.648 1.192L10.719 24l-1.412-.54ZM4.091 5.448a.579.579 0 1 1 0-1.157.579.579 0 0 1 0 1.157m1.543 0a.579.579 0 1 1 0-1.157.579.579 0 0 1 0 1.157m1.544 0a.579.579 0 1 1 0-1.157.579.579 0 0 1 0 1.157m8.657-2.7h5.424l.772.771v16.975l-.772.772h-7.392l.374-.579h6.779l.432-.432V3.758l-.432-.432h-4.676l-.552 2.85h-.59l.529-2.877.108-.552ZM2.74 21.265l-.772-.772V3.518l.772-.771h7.677l-.386.579H2.98l-.432.432v16.496l.432.432h5.586l-.092.579zm1.157-1.93h3.28l-.116.58h-3.55l-.192-.193v-3.473l.578 1.158zm13.117 0 .579.58H14.7l.385-.58z"/></svg>',
	init(canvas, eventTarget) {
		const page = `
			<script>
				var loadTabs = function (element) {
					fetch('/_cloudflare_dev_toolbar_app/tabs')
						.then((res) => res.text())
						.then((html) => {
							const el = document.createRange().createContextualFragment(html);
							element.getRootNode().querySelector('#tabs').replaceChildren(el);
						});
				};
			</script>
			<div id="tabs"></div>
			<div id="target" style="overflow: auto;"></div>
		`;

		const pageEl = document.createRange().createContextualFragment(page);
		const cfWindow = document.createElement('astro-dev-toolbar-window');
		cfWindow.append(pageEl);

		canvas.appendChild(cfWindow);

		eventTarget.addEventListener('app-toggled', (event) => {
			// @ts-ignore
			if (event.detail.state === true) {
				console.log('The app is now enabled!');
				// @ts-ignore
				loadTabs(cfWindow);
			}
		});
	},
};

export default plugin;
