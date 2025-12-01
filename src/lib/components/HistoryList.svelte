<script lang="ts">
  import type { HistoryItem } from '$lib/types';
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Play, Copy, Trash2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let { items, limit, onRestore, onDelete } = $props<{ 
    items: HistoryItem[], 
    limit?: number,
    onRestore: (item: HistoryItem) => void,
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
</script>

<div class="space-y-2">
  {#if displayItems.length === 0}
    <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      <p>No history yet</p>
    </div>
  {:else}
    <ul class="divide-y rounded-lg border bg-card">
      {#each displayItems as item}
        <li class="flex flex-col gap-2 p-4 transition hover:bg-muted/40 group first:rounded-t-lg last:rounded-b-lg">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center gap-2">
                <Badge variant={item.type === 'App Token' ? 'secondary' : 'outline'} class="text-xs font-normal">
                  {item.type}
                </Badge>
                <span class="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <p class="font-mono text-sm text-foreground break-all line-clamp-2" title={item.target}>
                {item.target}
              </p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => copyTarget(item.target)} title="Copy value">
                <Copy class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 gap-2" onclick={() => onRestore(item)}>
                <Play class="h-4 w-4" />
                <span class="hidden sm:inline">Use again</span>
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
