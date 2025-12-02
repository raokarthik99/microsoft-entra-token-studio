<script lang="ts">
  import type { HistoryItem } from '$lib/types';
  import { historyState } from '$lib/states/history.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';

  import { Button } from "$lib/shadcn/components/ui/button";
  import { Trash2 } from "@lucide/svelte";

  const lastUpdated = $derived(historyState.items[0]?.timestamp ? new Date(historyState.items[0].timestamp).toLocaleString() : null);

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

  async function loadHistoryItem(item: HistoryItem) {
    if (item.tokenData) {
      localStorage.setItem('pending_token_load', JSON.stringify(item));
      window.location.href = '/';
    }
  }

  async function deleteHistoryItem(item: HistoryItem) {
    await historyState.delete(item);
  }

  async function deleteHistoryItems(items: HistoryItem[]) {
    await historyState.deleteMany(items);
  }
</script>

<svelte:head>
  <title>History | Entra Token Client</title>
</svelte:head>

<div class="flex h-[calc(100vh-12rem)] flex-col gap-6">
  <div class="flex flex-wrap items-center justify-end gap-3">
    <div class="flex items-center gap-4">
      {#if lastUpdated}
        <span class="text-xs text-muted-foreground">Updated {lastUpdated}</span>
      {/if}
      <Button variant="outline" size="sm" onclick={() => historyState.clear()} disabled={historyState.items.length === 0} class="gap-2">
        <Trash2 class="h-4 w-4" />
        Clear All
      </Button>
    </div>
  </div>

  <div class="flex-1 min-h-0 rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col">
    <div class="flex h-full flex-col p-2 md:p-4">
      <HistoryList 
        items={historyState.items} 
        onRestore={restoreHistoryItem} 
        onLoad={loadHistoryItem}
        onDelete={deleteHistoryItem}
        onDeleteMany={deleteHistoryItems}
        enableSelection={true}
        enableToolbar={true}
        enableSorting={true}
        compact={false}
        showFooter={false}
        emptyCtaHref="/"
        emptyCtaLabel="Start generating"
      />
    </div>
  </div>
</div>
