<script lang="ts">
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Clock } from "@lucide/svelte";
  import { time } from "$lib/stores/time";
  import { getTokenStatus, getReadableExpiry, cn } from "$lib/utils";

  let { 
    expiresOn, 
    variant = undefined, 
    class: className,
    showIcon = true,
    compact = false,
    textOnly = false
  } = $props<{ 
    expiresOn: string | Date | null | undefined, 
    variant?: "default" | "secondary" | "destructive" | "outline",
    class?: string,
    showIcon?: boolean,
    compact?: boolean,
    textOnly?: boolean
  }>();

  const date = new Date(expiresOn);
  const status = $derived(getTokenStatus(date, $time));
  const readable = $derived(getReadableExpiry(date, $time));
</script>

{#if textOnly}
  <span class={cn("inline-flex items-center gap-1.5", className)}>
    {#if showIcon}
      <Clock class="h-3.5 w-3.5" />
    {/if}
    {#if compact}
      {status.label}
    {:else}
      {status.label === 'Expired' ? 'Expired' : status.label === 'Expiring' ? 'Expiring in' : 'Expires in'} {readable}
    {/if}
  </span>
{:else}
  <Badge variant={status.variant} class={cn("font-normal transition-colors", compact ? "px-1.5 h-5 text-[10px]" : "gap-1.5", className)}>
    {#if showIcon && !compact}
      <Clock class="h-3.5 w-3.5" />
    {/if}
    {#if compact}
      {status.label}
    {:else}
      {status.label === 'Expired' ? 'Expired' : status.label === 'Expiring' ? 'Expiring in' : 'Expires in'} {readable}
    {/if}
  </Badge>
{/if}
