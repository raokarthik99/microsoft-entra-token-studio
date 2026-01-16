import { browser } from '$app/environment';
import { isTauriMode } from '$lib/utils/runtime';
import { toast } from 'svelte-sonner';
import type { CheckOptions, DownloadEvent, Update } from '@tauri-apps/plugin-updater';

type UpdaterApi = {
	check: (options?: CheckOptions) => Promise<Update | null>;
	relaunch: () => Promise<void>;
};

let updaterApi: UpdaterApi | null = null;
let updaterApiPromise: Promise<UpdaterApi | null> | null = null;

function normalizeUpdaterError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	if (error && typeof error === 'object') {
		const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
		if (typeof message === 'string' && message.trim()) return message;
		try {
			return JSON.stringify(error);
		} catch {
			return 'Unknown error';
		}
	}
	return 'Unknown error';
}

function formatUpdaterError(message: string): string {
	const trimmed = message.trim();
	if (!trimmed) return 'Unknown error';
	if (/(^|\\b)(404|not\\s+found)(\\b|$)/i.test(trimmed)) {
		return 'Update feed not found (404). If the release is still a draft, publish it to enable updates.';
	}
	if (/timed?\\s*out|timeout|etimedout/i.test(trimmed)) {
		return 'Update check timed out. Please try again.';
	}
	if (/network|offline|fetch|connection/i.test(trimmed)) {
		return 'Network error while checking for updates.';
	}
	return trimmed;
}

async function loadUpdaterApi(): Promise<UpdaterApi | null> {
	if (!browser || !isTauriMode()) return null;
	if (updaterApi) return updaterApi;

	if (!updaterApiPromise) {
		updaterApiPromise = (async () => {
			const [{ check }, { relaunch }] = await Promise.all([
				import('@tauri-apps/plugin-updater'),
				import('@tauri-apps/plugin-process'),
			]);
			return { check, relaunch };
		})().catch((error) => {
			console.error('Failed to load updater APIs', error);
			return null;
		});
	}

	updaterApi = await updaterApiPromise;
	return updaterApi;
}

function updaterSupported(): boolean {
	return browser && isTauriMode();
}

export class UpdateStore {
	checking = $state(false);
	updateAvailable = $state(false);
	newVersion = $state('');
	downloaded = $state(false);
	downloading = $state(false);
	contentLength = $state(0);
	downloadedLength = $state(0);
	error = $state<string | null>(null);

	// Holds the update object from Tauri
	private update: Update | null = null;

	async checkForUpdates(manual = false) {
		if (this.checking || this.downloading) return;
		this.error = null;
		if (!updaterSupported()) {
			this.error = 'Update checks are only available in the desktop app.';
			if (manual) {
				toast.error(this.error);
			}
			return;
		}

		const api = await loadUpdaterApi();
		if (!api) {
			this.error = 'Updater is unavailable right now.';
			if (manual) {
				toast.error(this.error);
			}
			return;
		}

		this.checking = true;

		try {
			const update = await api.check();

			if (update) {
				this.update = update;
				this.updateAvailable = true;
				this.newVersion = update.version;
				this.downloaded = false;
				this.contentLength = 0;
				this.downloadedLength = 0;
				if (manual) {
					// toast.success(`Time to update! v${update.version} is available.`);
				}
			} else {
				this.update = null;
				this.updateAvailable = false;
				this.newVersion = '';
				this.downloaded = false;
				this.contentLength = 0;
				this.downloadedLength = 0;
				if (manual) {
					toast.success('You are on the latest version.');
				}
			}
		} catch (e) {
			console.error('Update check failed', e);
			this.error = formatUpdaterError(normalizeUpdaterError(e));
			this.update = null;
			this.updateAvailable = false;
			this.newVersion = '';
			this.downloaded = false;
			this.contentLength = 0;
			this.downloadedLength = 0;
			if (manual) {
				toast.error(`Update check failed: ${this.error}`);
			}
		} finally {
			this.checking = false;
		}
	}

	async installUpdate() {
		if (this.downloading) return;
		this.error = null;
		if (!updaterSupported()) {
			this.error = 'Updater is only available in the desktop app.';
			toast.error(this.error);
			return;
		}

		const api = await loadUpdaterApi();
		if (!api) {
			this.error = 'Updater is unavailable right now.';
			toast.error(this.error);
			return;
		}

		if (!this.update) {
			await this.checkForUpdates(true);
			if (!this.update) return;
		}

		this.downloading = true;
		this.error = null;
		this.downloaded = false;
		this.contentLength = 0;
		this.downloadedLength = 0;
		let downloaded = 0;
		let contentLength = 0;

		try {
			await this.update.downloadAndInstall((event: DownloadEvent) => {
				switch (event.event) {
					case 'Started':
						contentLength = event.data.contentLength ?? 0;
						this.contentLength = contentLength;
						// toast.info('Update download started');
						break;
					case 'Progress':
						downloaded += event.data.chunkLength ?? 0;
						this.downloadedLength = downloaded;
						break;
					case 'Finished':
						this.downloaded = true;
						if (contentLength > 0) {
							this.downloadedLength = contentLength;
						}
						// toast.success('Update downloaded. Restaring...');
						break;
				}
			});

			await api.relaunch();
		} catch (e) {
			console.error('Update install failed', e);
			this.error = formatUpdaterError(normalizeUpdaterError(e));
			toast.error(`Update failed: ${this.error}`);
		} finally {
			this.downloading = false;
		}
	}
}

// Create a singleton instance
export const updaterState = new UpdateStore();
