<script lang="ts">
  import type { HistoryItem } from "$lib/types";
  import { buttonVariants } from "$lib/shadcn/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { Copy, Play, Eye, Trash2, MoreHorizontal } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let {
    item,
    statusLabel,
    onRestore,
    onLoad,
    onDelete,
    showDelete = false,
    compact = false
  } = $props<{
    item: HistoryItem;
    statusLabel: string;
    onRestore: (item: HistoryItem) => void;
    onLoad?: (item: HistoryItem) => void;
    onDelete?: (item: HistoryItem) => void;
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
  <DropdownMenu.Content class="w-48" align="end">
    <DropdownMenu.Label>Actions</DropdownMenu.Label>
    <DropdownMenu.Separator />

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

    {#if item.tokenData && onLoad}
      <DropdownMenu.Item onclick={() => onLoad(item)}>
        <Eye class="mr-2 h-4 w-4" />
        <span>Load details</span>
      </DropdownMenu.Item>
    {/if}

    <DropdownMenu.Item onclick={() => onRestore(item)} class={urgent ? "text-primary focus:text-primary" : ""}>
      <Play class="mr-2 h-4 w-4" />
      <span>{urgent ? "Reissue (expiring)" : "Reissue token"}</span>
    </DropdownMenu.Item>

    {#if showDelete && onDelete}
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={() => onDelete(item)} class="text-destructive focus:text-destructive">
        <Trash2 class="mr-2 h-4 w-4" />
        <span>Delete</span>
      </DropdownMenu.Item>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
