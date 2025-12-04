<script lang="ts">
  import FavoritesList from '$lib/components/FavoritesList.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import type { FavoriteItem } from '$lib/types';
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Star, Trash2 } from "@lucide/svelte";
  import { onMount } from "svelte";

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
  };

  const lastUpdated = $derived((() => {
    const timestamps = favoritesState.items.map((item) =>
      Math.max(item.lastUsedAt ?? 0, item.createdAt ?? item.timestamp ?? 0)
    );
    const latest = timestamps.length ? Math.max(...timestamps) : null;
    return latest ? new Date(latest).toLocaleString() : null;
  })());

  const existingTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );

  let editOpen = $state(false);
  let editing: FavoriteItem | null = $state(null);

  onMount(() => {
    favoritesState.load();
  });

  async function handleEditSave(payload: FavoriteFormValue) {
    if (!editing) return;
    await favoritesState.update(editing.id, payload);
    editing = null;
    editOpen = false;
  }

  function startEdit(item: FavoriteItem) {
    editing = item;
    editOpen = true;
  }

  function useFavorite(item: FavoriteItem) {
    const params = new URLSearchParams();
    if (item.type === 'App Token') {
      params.set('tab', 'app-token');
      params.set('resource', item.target);
    } else {
      params.set('tab', 'user-token');
      params.set('scopes', item.target);
    }
    params.set('autorun', 'true');
    favoritesState.incrementUse(item.id);
    window.location.href = `/?${params.toString()}`;
  }

  async function loadFavorite(item: FavoriteItem) {
    if (!item.tokenData) return;
    localStorage.setItem('pending_token_load', JSON.stringify(item));
    await favoritesState.incrementUse(item.id);
    window.location.href = '/';
  }

  async function deleteFavorite(item: FavoriteItem) {
    await favoritesState.delete(item);
  }

  async function deleteFavorites(items: FavoriteItem[]) {
    await favoritesState.deleteMany(items);
  }
</script>

<svelte:head>
  <title>Favorites | Entra Token Client</title>
</svelte:head>

<div class="flex h-[calc(100vh-12rem)] flex-col gap-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
        <Star class="h-4 w-4" />
      </div>
      <div>
        <p class="text-lg font-semibold leading-tight">Favorites</p>
        <p class="text-sm text-muted-foreground">Save frequent targets for quick access.</p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      {#if lastUpdated}
        <span class="text-xs text-muted-foreground">Updated {lastUpdated}</span>
      {/if}
      <Button
        variant="outline"
        size="sm"
        class="gap-2"
        onclick={() => favoritesState.clear()}
        disabled={favoritesState.items.length === 0}
      >
        <Trash2 class="h-4 w-4" />
        Clear All
      </Button>
    </div>
  </div>

  <div class="flex-1 min-h-0 rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col">
    <div class="flex h-full flex-col p-2 md:p-4">
      <FavoritesList
        items={favoritesState.items}
        onUse={useFavorite}
        onLoad={loadFavorite}
        onEdit={startEdit}
        onDelete={deleteFavorite}
        onDeleteMany={deleteFavorites}
        enableToolbar={true}
        enableSelection={true}
        compact={false}
        emptyCtaHref="/?tab=user-token&cta=start-generating"
        emptyCtaLabel="Start generating"
      />
    </div>
  </div>

  <FavoriteFormSheet
    bind:open={editOpen}
    mode="edit"
    title="Edit favorite"
    favorite={editing ?? undefined}
    existingTags={existingTags}
    onSave={handleEditSave}
    onClose={() => {
      editOpen = false;
      editing = null;
    }}
  />
</div>
