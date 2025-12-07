<script lang="ts">
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { MoreHorizontal, Play, Pencil, Trash2, Check } from "@lucide/svelte";
  import type { AppConfig } from "$lib/types";

  let {
    app,
    isActive = false,
    onSwitch,
    onEdit,
    onDelete
  } = $props<{
    app: AppConfig;
    isActive?: boolean;
    onSwitch?: (app: AppConfig) => void;
    onEdit?: (app: AppConfig) => void;
    onDelete?: (app: AppConfig) => void;
  }>();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <Button variant="ghost" size="icon" class="h-8 w-8">
      <MoreHorizontal class="h-4 w-4" />
      <span class="sr-only">Open menu</span>
    </Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-[160px]">
    {#if onSwitch && !isActive}
      <DropdownMenu.Item onclick={() => onSwitch(app)} class="gap-2">
        <Play class="h-4 w-4" />
        Switch to app
      </DropdownMenu.Item>
    {:else if isActive}
      <DropdownMenu.Item disabled class="gap-2 text-emerald-600 dark:text-emerald-400 font-medium data-[disabled]:opacity-100">
        <Check class="h-4 w-4" />
        Active
      </DropdownMenu.Item>
    {/if}
    {#if onEdit}
      <DropdownMenu.Item onclick={() => onEdit(app)} class="gap-2">
        <Pencil class="h-4 w-4" />
        Edit
      </DropdownMenu.Item>
    {/if}
    {#if onDelete}
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={() => onDelete(app)} class="gap-2 text-destructive focus:text-destructive">
        <Trash2 class="h-4 w-4" />
        Delete
      </DropdownMenu.Item>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
