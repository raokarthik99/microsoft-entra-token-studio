<script lang="ts">
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import * as Tooltip from "$lib/shadcn/components/ui/tooltip";
  import { Star, Tag, Palette, Info } from "@lucide/svelte";
  import FormSheetLayout from "$lib/components/FormSheetLayout.svelte";
  import type { FavoriteItem } from "$lib/types";

  type EditorMode = "create" | "edit";

  let {
    open = $bindable(false),
    mode = "create" as EditorMode,
    favorite = null,
    defaultType = "User Token" as FavoriteItem["type"],
    defaultTarget = "",
    existingTags = [] as string[],
    title = mode === "edit" ? "Edit favorite" : "Add favorite",
    onSave,
    onClose
  } = $props<{
    open: boolean;
    mode?: EditorMode;
    favorite?: FavoriteItem | null;
    defaultType?: FavoriteItem["type"];
    defaultTarget?: string;
    existingTags?: string[];
    title?: string;
    onSave?: (value: Omit<FavoriteItem, "id" | "timestamp" | "createdAt" | "useCount"> & { useCount?: number; createdAt?: number; timestamp?: number }) => void | Promise<void>;
    onClose?: () => void;
  }>();

  const colorOptions = [
    "#0ea5e9",
    "#22c55e",
    "#f97316",
    "#a855f7",
    "#ef4444",
    "#eab308",
    "#14b8a6",
    "#6366f1"
  ];

  let type = $state<FavoriteItem["type"]>(favorite?.type ?? defaultType);
  let target = $state(favorite?.target ?? defaultTarget);
  let name = $state(favorite?.name ?? "");
  let tagsInput = $state((favorite?.tags ?? []).join(", "));
  let description = $state(favorite?.description ?? "");
  let color = $state(favorite?.color ?? "");
  let error = $state<string | null>(null);
  // Target is now read-only from context, no validation needed for user input
  const canSave = $derived(target.trim().length > 0);

  $effect(() => {
    if (open) {
      type = favorite?.type ?? defaultType;
      target = favorite?.target ?? defaultTarget;
      name = favorite?.name ?? "";
      tagsInput = (favorite?.tags ?? []).join(", ");
      description = favorite?.description ?? "";
      color = favorite?.color ?? "";
      error = null;
    }
  });

  $effect(() => {
    if (!open) {
      onClose?.();
    }
  });

  function parseTags(raw: string) {
    return raw
      .split(/[,\s]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }



  function validate(): boolean {
    if (name.length > 100) {
      error = "Name must be under 100 characters.";
      return false;
    }
    if (description.length > 500) {
      error = "Description must be under 500 characters.";
      return false;
    }
    error = null;
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    const payload = {
      type,
      target: target.trim(),
      name: name.trim() || undefined,
      tags: parseTags(tagsInput),
      description: description.trim() || undefined,
      color: color || undefined,
      tokenData: favorite?.tokenData,
      useCount: favorite?.useCount
    };

    await onSave?.(payload);
    open = false;
  }
</script>

<Tooltip.Provider delayDuration={200}>
  <FormSheetLayout
    bind:open
    side="right"
    maxWidth="md"
    icon={Star}
    eyebrow="Favorites"
    title={title}
    description="Save frequently used targets with names, tags, and colors for quick access."
    bodyClass="space-y-0 pb-2"
  >
    <div class="space-y-4">
      <!-- Token context (read-only) -->
      <div class="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Token context</span>
          <Tooltip.Root>
            <Tooltip.Trigger class="text-muted-foreground">
              <Info class="h-3.5 w-3.5" aria-hidden="true" />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
              These values are captured from the issued token and cannot be changed.
            </Tooltip.Content>
          </Tooltip.Root>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted-foreground">Token flow</span>
            <Badge variant="secondary" class="font-medium">{type}</Badge>
          </div>
          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">{type === "App Token" ? "Resource" : "Delegated scopes"}</span>
            <div class="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2">
              <Tag class="h-4 w-4 shrink-0 text-muted-foreground" />
              <code class="text-sm break-all">{target}</code>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Label for="name" class="text-xs font-medium text-muted-foreground">Friendly name (optional)</Label>
          <Tooltip.Root>
            <Tooltip.Trigger class="text-muted-foreground">
              <Info class="h-3.5 w-3.5" aria-hidden="true" />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
              Give this favorite a recognizable label (e.g., Graph user profile). Keeps lists readable; not used when issuing.
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
        <Input id="name" maxlength={100} placeholder="Graph user profile" bind:value={name} class="bg-transparent" />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Label for="tags" class="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Tags
            </Label>
            <Tooltip.Root>
              <Tooltip.Trigger class="text-muted-foreground">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
                Add search-friendly labels (graph, prod, readonly). Tags improve filtering and autocomplete relevance.
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
          {#if existingTags.length}
            <div class="flex flex-wrap gap-1">
              {#each existingTags.slice(0, 6) as tag}
                <Badge variant="secondary" class="text-[11px] font-normal">{tag}</Badge>
              {/each}
            </div>
          {/if}
        </div>
        <div class="relative">
          <Tag class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="tags"
            placeholder="graph, production, readonly"
            class="pl-9 bg-transparent"
            bind:value={tagsInput}
          />
        </div>
        <p class="text-[11px] text-muted-foreground">Separate with commas or spaces. Stored in lowercase.</p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Label for="description" class="text-xs font-medium text-muted-foreground">Description</Label>
          <Tooltip.Root>
            <Tooltip.Trigger class="text-muted-foreground">
              <Info class="h-3.5 w-3.5" aria-hidden="true" />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
              Optional context for collaborators or your future self (environment, purpose, caveats). Not sent with requests.
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
        <textarea
          id="description"
          rows="3"
          class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Context for this favorite"
          bind:value={description}
          maxlength="500"
        ></textarea>
      </div>

      <div class="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Palette class="h-4 w-4 text-muted-foreground" />
            <p class="text-sm font-medium">Color</p>
            <Tooltip.Root>
              <Tooltip.Trigger class="text-muted-foreground">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
                Pick an accent to visually group favorites (e.g., prod vs. dev). Purely cosmetic.
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
          {#if color}
            <span class="text-xs text-muted-foreground">{color}</span>
          {/if}
        </div>
        <div class="flex flex-wrap gap-2">
          {#each colorOptions as option}
            <button
              type="button"
              class={`h-8 w-8 rounded-full border-2 ${color === option ? "border-foreground ring-2 ring-ring" : "border-transparent"} shadow-sm`}
              style={`background-color: ${option};`}
              onclick={() => (color = color === option ? "" : option)}
              aria-label={`Choose color ${option}`}
            ></button>
          {/each}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-8 px-2 text-xs"
            onclick={() => (color = "")}
          >
            Clear
          </Button>
        </div>
      </div>

      {#if error}
        <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      {/if}
    </div>

    {#snippet footer()}
      <div class="flex w-full items-center justify-end gap-2">
        <Button type="button" variant="ghost" onclick={() => (open = false)}>Cancel</Button>
        <Button type="button" onclick={handleSave} disabled={!canSave}>
          {mode === "edit" ? "Save changes" : "Save favorite"}
        </Button>
      </div>
    {/snippet}
  </FormSheetLayout>
</Tooltip.Provider>
