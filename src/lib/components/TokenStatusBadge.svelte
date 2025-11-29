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

  const parsedExpiresOn = $derived((() => {
    if (!expiresOn) return null;
    const parsed = expiresOn instanceof Date ? expiresOn : new Date(expiresOn);
    return isNaN(parsed.getTime()) ? null : parsed;
  })());

  const status = $derived(
    parsedExpiresOn
      ? getTokenStatus(parsedExpiresOn, $time)
      : { label: "No expiry", variant: "outline" as const, minutes: 0 }
  );

  const readable = $derived(parsedExpiresOn ? getReadableExpiry(parsedExpiresOn, $time) : null);
  const resolvedVariant = $derived(variant ?? status.variant);

  const labelText = $derived((() => {
    if (!parsedExpiresOn || !readable) return "No expiry";
    const prefix =
      status.label === "Expired"
        ? "Expired"
        : status.label === "Expiring"
          ? "Expiring in"
          : "Expires in";
    return `${prefix} ${readable}`;
  })());
</script>

{#if textOnly}
  <span class={cn("inline-flex items-center gap-1.5", className)}>
    {#if showIcon}
      <Clock class="h-3.5 w-3.5" />
    {/if}
    {#if compact}
      {status.label}
    {:else}
      {labelText}
    {/if}
  </span>
{:else}
  <Badge variant={resolvedVariant} class={cn("font-normal transition-colors", compact ? "px-1.5 h-5 text-[10px]" : "gap-1.5", className)}>
    {#if showIcon && !compact}
      <Clock class="h-3.5 w-3.5" />
    {/if}
    {#if compact}
      {status.label}
    {:else}
      {labelText}
    {/if}
  </Badge>
{/if}
