<script lang="ts">
  import * as Tooltip from '$lib/shadcn/components/ui/tooltip';
  import { checkTruncation } from '$lib/utils/truncation';
  import type { Snippet } from 'svelte';

  interface Props {
    /** The content to wrap and potentially show tooltip for */
    children: Snippet<[{ props: Record<string, unknown> }]>;
    /** The tooltip content to show when truncated */
    tooltipContent: Snippet;
    /** Which side to show the tooltip */
    side?: 'top' | 'right' | 'bottom' | 'left';
    /** Additional class for the tooltip content */
    contentClass?: string;
    /** Delay before showing tooltip in ms */
    delayDuration?: number;
  }

  let {
    children,
    tooltipContent,
    side = 'top',
    contentClass = 'max-w-sm',
    delayDuration = 300,
  }: Props = $props();

  let containerRef = $state<HTMLElement | null>(null);
  let isTruncated = $state(false);

  /**
   * Check if any truncated element within the container has overflow.
   */
  function checkForTruncation() {
    if (!containerRef) return;
    
    // Find all elements with 'truncate' class
    const truncatedElements = containerRef.querySelectorAll('.truncate');
    let hasOverflow = false;
    
    truncatedElements.forEach((el) => {
      if (el instanceof HTMLElement && checkTruncation(el)) {
        hasOverflow = true;
      }
    });
    
    isTruncated = hasOverflow;
  }

  // Re-check on mount and whenever the container changes
  $effect(() => {
    if (containerRef) {
      // Initial check after layout
      requestAnimationFrame(checkForTruncation);
      
      // Watch for size changes
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(checkForTruncation);
      });
      resizeObserver.observe(containerRef);
      
      // Watch for content changes via mutation observer
      const mutationObserver = new MutationObserver(() => {
        requestAnimationFrame(checkForTruncation);
      });
      mutationObserver.observe(containerRef, { childList: true, subtree: true, characterData: true });
      
      return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      };
    }
  });
</script>

{#if isTruncated}
  <Tooltip.Root {delayDuration}>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <div bind:this={containerRef} {...props} class="w-full">
          {@render children({ props: {} })}
        </div>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content {side} class={contentClass}>
      {@render tooltipContent()}
    </Tooltip.Content>
  </Tooltip.Root>
{:else}
  <div bind:this={containerRef} class="w-full">
    {@render children({ props: {} })}
  </div>
{/if}
