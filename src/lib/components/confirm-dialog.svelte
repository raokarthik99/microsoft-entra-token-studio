<script lang="ts">
  import * as AlertDialog from "$lib/shadcn/components/ui/alert-dialog";
  import { buttonVariants } from "$lib/shadcn/components/ui/button";
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title,
    description,
    descriptionContent,
    confirmText = "Delete",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    destructive = true
  } = $props<{
    open?: boolean;
    title: string;
    description?: string;
    descriptionContent?: Snippet;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    destructive?: boolean;
  }>();

  async function handleConfirm() {
    await onConfirm();
    open = false;
  }
  
  function handleCancel() {
    onCancel?.();
    open = false;
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{title}</AlertDialog.Title>
      {#if descriptionContent}
        <div class="text-sm text-muted-foreground">
          {@render descriptionContent()}
        </div>
      {:else if description}
        <AlertDialog.Description>{description}</AlertDialog.Description>
      {/if}
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={handleCancel}>{cancelText}</AlertDialog.Cancel>
      <AlertDialog.Action 
        onclick={handleConfirm}
        class={destructive ? buttonVariants({ variant: "destructive" }) : ""}
      >
        {confirmText}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>


