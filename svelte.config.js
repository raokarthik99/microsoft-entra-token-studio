import adapter from '@sveltejs/adapter-auto';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use static adapter when building for Tauri
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use static adapter for Tauri builds, auto adapter for web
		adapter: isTauri 
			? staticAdapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: true
			})
			: adapter(),
		alias: {
      		"@/*": "./src/lib/*"
    	},
	}
};

export default config;
