<script lang="ts">
  import { goto } from "$app/navigation";
  import { favoritesState } from "$lib/states/favorites.svelte";
  import { appRegistry, APP_COLORS } from "$lib/states/app-registry.svelte";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import FavoriteFormSheet from "$lib/components/FavoriteFormSheet.svelte";
  import ConfirmDialog from "$lib/components/confirm-dialog.svelte";
  import { clientStorage, CLIENT_STORAGE_KEYS } from "$lib/services/client-storage";
  import { reissueFromFavorite } from "$lib/services/token-reissue";
  import { toast } from "svelte-sonner";
  import { Pin, PinOff, Play, Copy, Eye, Pencil, Trash2, MoreHorizontal } from "@lucide/svelte";
  import type { FavoriteItem } from "$lib/types";

  const pinned = $derived(favoritesState.pinnedFavorites);
  const existingTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );
  let editOpen = $state(false);
  let editing: FavoriteItem | null = $state(null);
  
  // Confirm dialog state
  let confirmOpen = $state(false);
  let pendingDelete: FavoriteItem | null = $state(null);

  function getAccent(fav: FavoriteItem) {
    return fav.color || fav.appColor || APP_COLORS[0];
  }

  function getLabel(fav: FavoriteItem) {
    return fav.name || fav.target;
  }

  async function unpinFavorite(fav: FavoriteItem) {
    await favoritesState.unpin(fav.id);
  }

  async function loadFavorite(fav: FavoriteItem) {
    if (!fav.tokenData) {
      await goto("/favorites");
      return;
    }
    if (fav.appId && appRegistry.getById(fav.appId)) {
      await appRegistry.setActive(fav.appId);
    }
    await clientStorage.set(CLIENT_STORAGE_KEYS.pendingTokenLoad, fav);
    await favoritesState.incrementUse(fav.id);
    await goto("/");
  }

  function openEdit(fav: FavoriteItem) {
    editing = fav;
    editOpen = true;
  }

  async function saveEdit(payload: Omit<FavoriteItem, "id" | "timestamp" | "createdAt" | "useCount"> & { useCount?: number; createdAt?: number; timestamp?: number }) {
    if (!editing) return;
    await favoritesState.update(editing.id, {
      ...payload,
      isPinned: true,
      pinnedAt: editing.pinnedAt ?? Date.now()
    });
    toast.success("Favorite updated");
    editing = null;
  }

  function requestDeleteFavorite(fav: FavoriteItem) {
    pendingDelete = fav;
    confirmOpen = true;
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await favoritesState.delete(pendingDelete);
    toast.success("Favorite removed");
    pendingDelete = null;
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch (error) {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }
</script>

<div class="space-y-2 rounded-lg border border-sidebar-border bg-sidebar px-3 py-3 shadow-sm">
  <div class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
    <Pin class="h-4 w-4 text-primary" />
    <span>Pinned tokens</span>
    <Badge variant="outline" class="ml-auto text-[11px]">{pinned.length}/5</Badge>
  </div>

  {#if pinned.length > 0}
    <div class="space-y-2">
      {#each pinned as fav (fav.id)}
        <div class="flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-2">
          <span
            class="h-2.5 w-2.5 rounded-full border border-border/60"
            style={`background-color:${getAccent(fav)}`}
            aria-hidden="true"
          ></span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold leading-tight text-foreground">{getLabel(fav)}</p>
            <p class="truncate text-[11px] text-muted-foreground">
              {fav.type === 'App Token' ? 'App' : 'User'} • {fav.target}
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-1 text-muted-foreground transition hover:text-primary"
            onclick={() => reissueFromFavorite(fav)}
            title="Reissue from pinned"
          >
            <Play class="h-4 w-4" />
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <button
                type="button"
                class="rounded-full p-1 text-muted-foreground transition hover:text-foreground"
                aria-label="More actions"
              >
                <MoreHorizontal class="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-56">
              <DropdownMenu.Label>Actions</DropdownMenu.Label>
              <DropdownMenu.Item onclick={() => reissueFromFavorite(fav)}>
                <Play class="mr-2 h-4 w-4" />
                <span>Reissue</span>
              </DropdownMenu.Item>
              {#if fav.tokenData}
                <DropdownMenu.Item onclick={() => loadFavorite(fav)}>
                  <Eye class="mr-2 h-4 w-4" />
                  <span>Load details</span>
                </DropdownMenu.Item>
              {/if}
              <DropdownMenu.Item onclick={() => openEdit(fav)}>
                <Pencil class="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Label class="text-[11px] text-muted-foreground">Copy</DropdownMenu.Label>
              <DropdownMenu.Item onclick={() => copyValue(fav.target, "Target")}>
                <Copy class="mr-2 h-4 w-4" />
                <span>Copy target</span>
              </DropdownMenu.Item>
              {#if fav.tokenData?.accessToken}
                <DropdownMenu.Item onclick={() => copyValue(fav.tokenData!.accessToken, "Token")}>
                  <Copy class="mr-2 h-4 w-4" />
                  <span>Copy token</span>
                </DropdownMenu.Item>
              {/if}
              <DropdownMenu.Separator />
              <DropdownMenu.Item onclick={() => unpinFavorite(fav)}>
                <PinOff class="mr-2 h-4 w-4" />
                <span>Unpin</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onclick={() => requestDeleteFavorite(fav)} class="text-destructive focus:text-destructive">
                <Trash2 class="mr-2 h-4 w-4" />
                <span>Delete favorite</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-background/50 px-2.5 py-2 text-[12px] text-muted-foreground">
      <Pin class="h-3.5 w-3.5" />
      <span>Pin favorites for one-click reissue</span>
    </div>
  {/if}
</div>

<FavoriteFormSheet
  bind:open={editOpen}
  mode="edit"
  title="Edit favorite"
  favorite={editing ?? undefined}
  existingTags={existingTags}
  onSave={saveEdit}
  onClose={() => {
    editOpen = false;
    editing = null;
  }}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Remove this favorite?"
  description="This action cannot be undone."
  onConfirm={confirmDelete}
  onCancel={() => { pendingDelete = null; }}
/>
