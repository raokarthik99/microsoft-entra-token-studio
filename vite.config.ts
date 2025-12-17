import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Don't auto-open browser when running in Tauri mode
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		open: !isTauri
	},
	preview: {
		open: !isTauri
	}
});
