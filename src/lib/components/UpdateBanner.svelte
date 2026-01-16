<script lang="ts">
	import { updaterState } from '$lib/stores/updater.svelte';
	import { isTauriMode } from '$lib/utils/runtime';
	import { X } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { Button } from '$lib/shadcn/components/ui/button';

	let dismissed = $state(false);
	let lastVersion = $state('');

	$effect(() => {
		if (!updaterState.updateAvailable) {
			dismissed = false;
			lastVersion = '';
			return;
		}

		if (updaterState.newVersion && updaterState.newVersion !== lastVersion) {
			dismissed = false;
			lastVersion = updaterState.newVersion;
		}
	});

	function dismiss() {
		dismissed = true;
	}
</script>

{#if isTauriMode() && updaterState.updateAvailable && !dismissed}
	<div
		transition:slide
		role="status"
		aria-live="polite"
		class="bg-primary text-primary-foreground relative flex items-center justify-between px-4 py-2 text-sm font-medium"
	>
		<div class="flex items-center gap-2">
			<span>Entra Token Studio v{updaterState.newVersion} is available!</span>
		</div>
		<div class="flex items-center gap-2">
			<Button
				variant="secondary"
				size="sm"
				class="h-7 px-3 text-xs"
				onclick={() => updaterState.installUpdate()}
				disabled={updaterState.downloading}
			>
				{#if updaterState.downloading}
					{#if updaterState.contentLength > 0}
						Downloading... {Math.round(
							(updaterState.downloadedLength / updaterState.contentLength) * 100
						)}%
					{:else}
						Downloading...
					{/if}
				{:else}
					Update Now
				{/if}
			</Button>
			<button
				onclick={dismiss}
				class="hover:bg-primary-foreground/10 h-6 w-6 rounded-full p-0.5 transition-colors"
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	</div>
{/if}
