<script lang="ts">
  import { onMount } from 'svelte';
  import type { HistoryItem } from '$lib/types';
  import { historyService } from '$lib/services/history';
  import HistoryList from '$lib/components/HistoryList.svelte';

  import { Button } from "$lib/shadcn/components/ui/button";
  import { Trash2, Play, Copy } from "@lucide/svelte";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";

  let history = $state<HistoryItem[]>([]);
  const historyCount = $derived(history.length);
  const lastUpdated = $derived(history[0]?.timestamp ? new Date(history[0].timestamp).toLocaleString() : null);

  onMount(() => {
    loadHistory();
  });

  async function loadHistory() {
    history = await historyService.getHistory();
  }

  async function clearHistory() {
    if (confirm('Clear all history?')) {
      history = [];
      await historyService.clearHistory();
    }
  }

  function restoreHistoryItem(item: HistoryItem) {
    const params = new URLSearchParams();
    if (item.type === 'App Token') {
      params.set('tab', 'app-token');
      params.set('resource', item.target);
    } else {
      params.set('tab', 'user-token');
      params.set('scopes', item.target);
    }
    params.set('autorun', 'true');
    window.location.href = `/?${params.toString()}`;
  }

  async function copyTarget(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy value', err);
    }
  }
</script>

<svelte:head>
  <title>History | Entra Token Client</title>
</svelte:head>

<div class="flex h-[calc(100vh-12rem)] flex-col gap-6">
  <div class="flex items-center justify-end gap-4">
      {#if lastUpdated}
        <span class="text-xs text-muted-foreground">Updated {lastUpdated}</span>
      {/if}
      <Button variant="outline" size="sm" onclick={clearHistory} disabled={history.length === 0} class="gap-2">
        <Trash2 class="h-4 w-4" />
        Clear
      </Button>
  </div>

  <div class="flex-1 min-h-0 rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col">
    {#if history.length === 0}
      <div class="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
        <div class="rounded-full bg-muted p-4">
          <Trash2 class="h-8 w-8 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <h3 class="text-lg font-semibold">No history yet</h3>
          <p class="text-muted-foreground max-w-md">
            Your recent token requests will appear here. Start by generating a token on the dashboard.
          </p>
        </div>
        <Button href="/" variant="default" class="gap-2">
          <Play class="h-4 w-4" />
          Start generating
        </Button>
      </div>
    {:else}
      <ScrollArea class="flex-1 min-h-0">
        <HistoryList 
          items={history} 
          onRestore={restoreHistoryItem} 
        />
      </ScrollArea>
    {/if}
  </div>
</div>
