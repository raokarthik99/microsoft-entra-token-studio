<script lang="ts">
  import * as Sheet from "$lib/shadcn/components/ui/sheet";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import * as Tooltip from "$lib/shadcn/components/ui/tooltip";
  import { Star, Tag, Palette, Info } from "@lucide/svelte";
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
  const targetError = $derived(validateTarget(target, type));
  const canSave = $derived(!targetError && target.trim().length > 0);

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

  function validateTarget(value: string, currentType: FavoriteItem["type"]) {
    const trimmed = value.trim();
    if (!trimmed) return "Resource is required.";
    if (currentType === "User Token" && trimmed.includes("  ")) {
      return "Scopes should be space or comma separated.";
    }
    return null;
  }

  function validate(): boolean {
    if (targetError) {
      error = targetError;
      return false;
    }
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
  <Sheet.Root bind:open>
    <Sheet.Content side="right" class="w-full max-w-xl overflow-hidden">
      <Sheet.Header class="gap-0 border-b bg-muted/40">
        <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Favorites</p>
        <div class="flex items-center gap-2">
          <Star class="h-4 w-4 text-amber-400" />
          <Sheet.Title class="text-lg font-semibold leading-tight">{title}</Sheet.Title>
        </div>
        <Sheet.Description class="text-sm text-muted-foreground">
          Save frequently used targets with optional names, tags, and colors for quick access.
        </Sheet.Description>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto p-4 pb-2 space-y-4">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>Token flow</span>
            <Tooltip.Root>
              <Tooltip.Trigger class="text-muted-foreground">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
                Choose the flow that matches your target: App Token uses a resource (URL or client ID), User Token uses delegated scopes.
              </Tooltip.Content>
            </Tooltip.Root>
            <span class="text-destructive">*</span>
          </div>
        <div class="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={type === "User Token" ? "default" : "outline"}
            class="justify-center"
            onclick={() => (type = "User Token")}
          >
            User Token
          </Button>
          <Button
            type="button"
            variant={type === "App Token" ? "default" : "outline"}
            class="justify-center"
            onclick={() => (type = "App Token")}
          >
            App Token
          </Button>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Label for="target" class="text-xs font-medium text-muted-foreground flex items-center gap-1">
              {type === "App Token" ? "Resource" : "Delegated scopes"}
              <span class="text-destructive">*</span>
            </Label>
            <Tooltip.Root>
              <Tooltip.Trigger class="text-muted-foreground">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Content side="top" align="start" class="max-w-xs text-[12px] leading-snug">
                {type === "App Token"
                  ? "Resource can be an API URL, application ID URI, or client ID."
                  : "Use space or comma separated scopes (e.g., User.Read Mail.Read)."}
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
        </div>
        <Input
          id="target"
          placeholder={type === "App Token" ? "https://graph.microsoft.com or api://client-id" : "User.Read Mail.Read"}
          bind:value={target}
          aria-invalid={Boolean(targetError)}
        />
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
          <Input id="name" maxlength={100} placeholder="Graph user profile" bind:value={name} />
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
            class="pl-9"
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
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {#if error || targetError}
        <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error || targetError}
        </div>
      {/if}
      </div>

      <Sheet.Footer class="border-t bg-muted/40">
        <div class="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onclick={() => (open = false)}>Cancel</Button>
          <Button type="button" onclick={handleSave} disabled={!canSave}>
            {mode === "edit" ? "Save changes" : "Save favorite"}
          </Button>
        </div>
      </Sheet.Footer>
    </Sheet.Content>
  </Sheet.Root>
</Tooltip.Provider>
