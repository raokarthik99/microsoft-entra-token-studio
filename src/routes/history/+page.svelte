<script lang="ts">
  import type { HistoryItem } from '$lib/types';
  import { historyState } from '$lib/states/history.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import { appRegistry } from '$lib/states/app-registry.svelte';
  import type { FavoriteItem } from '$lib/types';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Trash2, History } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { clientStorage, CLIENT_STORAGE_KEYS } from '$lib/services/client-storage';
  import ConfirmDialog from "$lib/components/confirm-dialog.svelte";

  const lastUpdated = $derived(historyState.items[0]?.timestamp ? new Date(historyState.items[0].timestamp).toLocaleString() : null);
  const favoriteTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );

  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);
  let pinMode = $state(false);

  // Confirmation state
  let confirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmDescription = $state("");
  let confirmAction = $state<() => Promise<void>>(async () => {});

  function openConfirm(title: string, desc: string, action: () => Promise<void>) {
    confirmTitle = title;
    confirmDescription = desc;
    confirmAction = action;
    confirmOpen = true;
  }

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
    isPinned?: boolean;
    pinnedAt?: number | null;
  };

  async function restoreHistoryItem(item: HistoryItem) {
    // Auto-switch to the app that was used for this token
    if (item.appId && appRegistry.getById(item.appId)) {
      await appRegistry.setActive(item.appId);
    }
    
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
      // Auto-switch to the app that was used for this token
      if (item.appId && appRegistry.getById(item.appId)) {
        await appRegistry.setActive(item.appId);
      }
      await clientStorage.set(CLIENT_STORAGE_KEYS.pendingTokenLoad, item);
      window.location.href = '/';
    }
  }

  async function deleteHistoryItem(item: HistoryItem) {
    openConfirm("Delete history item?", "This action cannot be undone.", async () => {
      await historyState.delete(item);
    });
  }

  async function deleteHistoryItems(items: HistoryItem[]) {
    openConfirm(`Delete ${items.length} items?`, "This action cannot be undone.", async () => {
      await historyState.deleteMany(items);
    });
  }

  async function handleClearAll() {
    openConfirm("Delete all history?", "This action cannot be undone.", async () => {
      await historyState.clear();
    });
  }

  function isFavorited(item: HistoryItem) {
    return favoritesState.items.some((fav) => fav.type === item.type && fav.target === item.target);
  }

  function isPinned(item: HistoryItem) {
    const match = favoritesState.items.find((fav) => fav.type === item.type && fav.target === item.target);
    return Boolean(match?.isPinned);
  }

  function addFavorite(item: HistoryItem) {
    favoriteDraft = item;
    pinMode = false;
    favoriteOpen = true;
  }

  async function saveFavoriteFromHistory(payload: FavoriteFormValue) {
    if (!favoriteDraft) return;
    try {
      const extras: Partial<FavoriteItem> = {
        ...payload,
        isPinned: pinMode || payload.isPinned,
        pinnedAt: pinMode ? Date.now() : payload.pinnedAt
      };
      await favoritesState.addFromHistory(favoriteDraft, extras);
      await favoritesState.load();
      toast.success(pinMode ? "Pinned and added to favorites" : "Added to favorites");
    } catch (err) {
      console.error("Failed to add favorite", err);
      toast.error("Could not add to favorites");
    } finally {
      favoriteDraft = null;
      favoriteOpen = false;
      pinMode = false;
    }
  }

  async function removeFavorite(item: HistoryItem) {
    const match = favoritesState.items.find((fav) => fav.type === item.type && fav.target === item.target);
    if (!match) return;
    await favoritesState.delete(match);
    toast.success("Removed from favorites");
  }

  async function pinHistoryItem(item: HistoryItem) {
    const match = favoritesState.findMatch(item.type, item.target);
    if (match) {
      const result = await favoritesState.pin(match.id);
      if (!result.success && result.reason === 'limit') {
        toast.error('You can pin up to five favorites. Unpin one to add this.');
        return;
      }
      toast.success('Pinned to navigation');
      return;
    }

    if (favoritesState.pinnedCount >= 5) {
      toast.error('You can pin up to five favorites. Unpin one to add this.');
      return;
    }

    pinMode = true;
    favoriteDraft = item;
    favoriteOpen = true;
  }

  async function unpinHistoryItem(item: HistoryItem) {
    const match = favoritesState.findMatch(item.type, item.target);
    if (!match) return;
    await favoritesState.unpin(match.id);
    toast.success('Unpinned');
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
      <Button variant="destructive" size="sm" onclick={handleClearAll} disabled={historyState.items.length === 0} class="gap-2">
        <Trash2 class="h-4 w-4" />
        Delete All
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
        onPin={pinHistoryItem}
        onUnpin={unpinHistoryItem}
        isPinned={isPinned}
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
    pinMode = false;
  }}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title={confirmTitle}
  description={confirmDescription}
  onConfirm={confirmAction}
/>
