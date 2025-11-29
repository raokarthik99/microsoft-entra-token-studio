<script lang="ts">
  import type { HistoryItem } from "$lib/types";
  import { buttonVariants } from "$lib/shadcn/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { Copy, Play, Eye, Trash2, MoreHorizontal, Star, StarOff, Pin, PinOff } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";

  let {
    item,
    statusLabel,
    onRestore,
    onLoad,
    onDelete,
    onFavorite,
    onUnfavorite,
    favoriteExists = false,
    onPin,
    onUnpin,
    pinnedExists = false,
    showDelete = false,
    compact = false
  } = $props<{
    item: HistoryItem;
    statusLabel: string;
    onRestore: (item: HistoryItem) => void;
    onLoad?: (item: HistoryItem) => void;
    onDelete?: (item: HistoryItem) => void;
    onFavorite?: (item: HistoryItem) => void;
    onUnfavorite?: (item: HistoryItem) => void;
    favoriteExists?: boolean;
    onPin?: (item: HistoryItem) => void;
    onUnpin?: (item: HistoryItem) => void;
    pinnedExists?: boolean;
    showDelete?: boolean;
    compact?: boolean;
  }>();

  const urgent = $derived(statusLabel === "Expired" || statusLabel === "Expiring");

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch (error) {
      console.error("Failed to copy value", error);
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <button
      class={buttonVariants({
        variant: "ghost",
        size: compact ? "icon-sm" : "icon"
      })}
      aria-label="Open actions"
      title="Open actions"
      type="button"
    >
      <MoreHorizontal class="h-4 w-4" />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="w-52" align="end">
    <DropdownMenu.Label>Actions</DropdownMenu.Label>

    <DropdownMenu.Item
      onclick={() => onRestore(item)}
      class={cn(
        urgent
          ? "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90 data-[highlighted]:bg-primary/90 data-[highlighted]:text-primary-foreground"
          : ""
      )}
    >
      <Play class="mr-2 h-4 w-4" />
      <span>Reissue</span>
    </DropdownMenu.Item>

    {#if item.tokenData && onLoad}
      <DropdownMenu.Item onclick={() => onLoad(item)}>
        <Eye class="mr-2 h-4 w-4" />
        <span>Load details</span>
      </DropdownMenu.Item>
    {/if}

    <DropdownMenu.Separator />

    <DropdownMenu.Label class="text-[11px] text-muted-foreground">Copy</DropdownMenu.Label>
    <DropdownMenu.Item onclick={() => copyValue(item.target, "Target")}>
      <Copy class="mr-2 h-4 w-4" />
      <span>Copy target</span>
    </DropdownMenu.Item>

    {#if item.tokenData?.accessToken}
      <DropdownMenu.Item onclick={() => copyValue(item.tokenData!.accessToken, "Token")}>
        <Copy class="mr-2 h-4 w-4" />
        <span>Copy token</span>
      </DropdownMenu.Item>
    {/if}

    {#if onFavorite}
      <DropdownMenu.Separator />
      {#if favoriteExists && onUnfavorite}
        <DropdownMenu.Item onclick={() => onUnfavorite(item)}>
          <StarOff class="mr-2 h-4 w-4" />
          <span>Remove Favorite</span>
        </DropdownMenu.Item>
      {:else}
        <DropdownMenu.Item onclick={() => onFavorite(item)}>
          <Star class="mr-2 h-4 w-4" />
          <span>Favorite</span>
        </DropdownMenu.Item>
      {/if}
    {/if}

    {#if onPin}
      <DropdownMenu.Separator />
      {#if pinnedExists && onUnpin}
        <DropdownMenu.Item onclick={() => onUnpin(item)}>
          <PinOff class="mr-2 h-4 w-4" />
          <span>Unpin</span>
        </DropdownMenu.Item>
      {:else}
        <DropdownMenu.Item onclick={() => onPin(item)}>
          <Pin class="mr-2 h-4 w-4" />
          <span>Pin</span>
        </DropdownMenu.Item>
      {/if}
    {/if}

    {#if showDelete && onDelete}
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={() => onDelete(item)} class="text-destructive focus:text-destructive">
        <Trash2 class="mr-2 h-4 w-4" />
        <span>Delete</span>
      </DropdownMenu.Item>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
