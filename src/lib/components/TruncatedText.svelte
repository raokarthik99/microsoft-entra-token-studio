<script lang="ts">
  import * as Tooltip from '$lib/shadcn/components/ui/tooltip';
  import { watchTruncation } from '$lib/utils/truncation';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLElement> {
    /** The text content to display and potentially show in tooltip */
    text: string;
    /** Optional custom tooltip content - if not provided, uses `text` */
    tooltipContent?: Snippet;
    /** Which side to show the tooltip */
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
    /** Additional class for the tooltip content */
    tooltipClass?: string;
    /** Delay before showing tooltip in ms */
    delayDuration?: number;
    /** HTML tag to render */
    as?: 'span' | 'p' | 'div';
  }

  let {
    text,
    tooltipContent,
    tooltipSide = 'top',
    tooltipClass = 'max-w-sm',
    delayDuration = 300,
    as = 'span',
    class: className = '',
    ...restProps
  }: Props = $props();

  let isTruncated = $state(false);
</script>

{#if isTruncated}
  <Tooltip.Root {delayDuration}>
    <Tooltip.Trigger class="block w-full text-left">
      <svelte:element
        this={as}
        use:watchTruncation={(truncated) => { isTruncated = truncated; }}
        class="{className} truncate block"
        {...restProps}
      >
        {text}
      </svelte:element>
    </Tooltip.Trigger>
    <Tooltip.Content side={tooltipSide} class={tooltipClass}>
      {#if tooltipContent}
        {@render tooltipContent()}
      {:else}
        <p class="break-all">{text}</p>
      {/if}
    </Tooltip.Content>
  </Tooltip.Root>
{:else}
  <svelte:element
    this={as}
    use:watchTruncation={(truncated) => { isTruncated = truncated; }}
    class="{className} truncate block"
    {...restProps}
  >
    {text}
  </svelte:element>
{/if}
