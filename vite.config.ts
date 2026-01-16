import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Don't auto-open browser when running in Tauri mode
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		// Pre-bundle heavy deps to avoid repeated bundling on cold starts
		include: [
			'@azure/msal-browser',
			'@azure/identity',
			'jwt-decode',
			'idb-keyval',
			'mode-watcher'
		]
	},
	server: {
		open: !isTauri,
		warmup: {
			// Pre-transform common entry points for faster initial load
			clientFiles: [
				'./src/routes/+layout.svelte',
				'./src/routes/+page.svelte',
				'./src/routes/apps/+page.svelte'
			]
		}
	},
	preview: {
		open: !isTauri
	}
});
