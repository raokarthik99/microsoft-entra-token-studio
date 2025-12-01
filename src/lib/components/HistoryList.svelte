<script lang="ts">
  import type { HistoryItem } from '$lib/types';
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { RotateCcw, Copy, Trash2, Eye, Clock3 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let { items, limit, onRestore, onLoad, onDelete } = $props<{ 
    items: HistoryItem[], 
    limit?: number,
    onRestore: (item: HistoryItem) => void,
    onLoad?: (item: HistoryItem) => void,
    onDelete?: (item: HistoryItem) => void
  }>();

  let displayItems = $derived(limit ? items.slice(0, limit) : items);

  async function copyTarget(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error('Failed to copy value', err);
      toast.error("Failed to copy");
    }
  }

  function getExpiryStatus(item: HistoryItem) {
    if (!item.tokenData?.expiresOn) return null;
    const expiresOn = new Date(item.tokenData.expiresOn);
    const minutesLeft = Math.round((expiresOn.getTime() - Date.now()) / 60000);
    
    if (minutesLeft < 0) return { label: 'Expired', variant: 'destructive' as const };
    if (minutesLeft <= 5) return { label: 'Expiring', variant: 'secondary' as const };
    return { label: 'Valid', variant: 'outline' as const };
  }
</script>

<div class="space-y-2">
  {#if displayItems.length === 0}
    <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      <p>No history yet</p>
    </div>
  {:else}
    <ul class="divide-y rounded-lg border bg-card">
      {#each displayItems as item}
        {@const status = getExpiryStatus(item)}
        <li class="flex flex-col gap-2 p-4 transition hover:bg-muted/40 group first:rounded-t-lg last:rounded-b-lg">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1.5 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant={item.type === 'App Token' ? 'secondary' : 'outline'} class="text-xs font-normal">
                  {item.type}
                </Badge>
                <span class="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
                {#if status}
                  <Badge variant={status.variant} class="text-[10px] h-5 px-1.5 font-normal">
                    {status.label}
                  </Badge>
                {/if}
              </div>
              <p class="font-mono text-sm text-foreground break-all line-clamp-2" title={item.target}>
                {item.target}
              </p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => copyTarget(item.target)} title="Copy value">
                <Copy class="h-4 w-4" />
              </Button>
              
              {#if item.tokenData && onLoad}
                <Button variant="ghost" size="sm" class="h-8 gap-2" onclick={() => onLoad(item)} title="Load token details">
                  <Eye class="h-4 w-4" />
                  <span class="hidden sm:inline">Load</span>
                </Button>
              {/if}

              <Button 
                variant={status?.label === 'Expired' || status?.label === 'Expiring' ? 'secondary' : 'ghost'} 
                size="sm" 
                class="h-8 gap-2" 
                onclick={() => onRestore(item)}
                title="Refresh token"
              >
                <RotateCcw class="h-4 w-4" />
                <span class="hidden sm:inline">Refresh</span>
              </Button>

              {#if onDelete}
                <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" onclick={() => { onDelete(item); toast.success("Item removed from history"); }} title="Remove from history">
                  <Trash2 class="h-4 w-4" />
                </Button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
