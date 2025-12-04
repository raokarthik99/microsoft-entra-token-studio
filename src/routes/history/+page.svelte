<script lang="ts">
  import type { HistoryItem } from '$lib/types';
  import { historyState } from '$lib/states/history.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import type { FavoriteItem } from '$lib/types';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Trash2, History } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const lastUpdated = $derived(historyState.items[0]?.timestamp ? new Date(historyState.items[0].timestamp).toLocaleString() : null);
  const favoriteTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );

  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
  };

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

  function isFavorited(item: HistoryItem) {
    return favoritesState.items.some((fav) => fav.type === item.type && fav.target === item.target);
  }

  function addFavorite(item: HistoryItem) {
    favoriteDraft = item;
    favoriteOpen = true;
  }

  async function saveFavoriteFromHistory(payload: FavoriteFormValue) {
    if (!favoriteDraft) return;
    try {
      await favoritesState.addFromHistory(favoriteDraft, payload);
      await favoritesState.load();
      toast.success("Added to favorites");
    } catch (err) {
      console.error("Failed to add favorite", err);
      toast.error("Could not add to favorites");
    } finally {
      favoriteDraft = null;
      favoriteOpen = false;
    }
  }

  async function removeFavorite(item: HistoryItem) {
    const match = favoritesState.items.find((fav) => fav.type === item.type && fav.target === item.target);
    if (!match) return;
    await favoritesState.delete(match);
    toast.success("Removed from favorites");
  }
</script>

<svelte:head>
  <title>History | Entra Token Client</title>
</svelte:head>

<div class="flex h-[calc(100vh-12rem)] flex-col gap-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <History class="h-5 w-5" />
      </div>
      <div>
        <p class="text-lg font-semibold leading-tight">History</p>
        <p class="text-sm text-muted-foreground">Recall past inputs, reload tokens, and reissue quickly.</p>
      </div>
    </div>
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
        onFavorite={addFavorite}
        onUnfavorite={removeFavorite}
        isFavorited={isFavorited}
        enableSelection={true}
        enableToolbar={true}
        enableSorting={true}
        compact={false}
        showFooter={false}
        emptyCtaHref="/?cta=start-generating"
        emptyCtaLabel="Start generating"
      />
    </div>
  </div>
</div>

<FavoriteFormSheet
  bind:open={favoriteOpen}
  mode="create"
  title="Save to favorites"
  favorite={favoriteDraft
    ? {
        id: 'draft',
        type: favoriteDraft.type,
        target: favoriteDraft.target,
        timestamp: favoriteDraft.timestamp,
        tokenData: favoriteDraft.tokenData,
        createdAt: favoriteDraft.timestamp,
        useCount: 1
      }
    : undefined}
  existingTags={favoriteTags}
  onSave={saveFavoriteFromHistory}
  onClose={() => {
    favoriteOpen = false;
    favoriteDraft = null;
  }}
/>
