<script lang="ts">
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/shadcn/components/ui/table";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { buttonVariants } from "$lib/shadcn/components/ui/button/button.svelte";
  import { Star, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Play, Eye, Pencil, Trash2, MoreHorizontal, Copy, Pin, PinOff } from "@lucide/svelte";
  import type { FavoriteItem } from "$lib/types";
  import TokenStatusBadge from "./TokenStatusBadge.svelte";
  import { cn, getReadableExpiry, getTokenStatus } from "$lib/utils";
  import { time } from "$lib/stores/time";
  import { toast } from "svelte-sonner";

  type StatusKey = "expired" | "expiring" | "valid" | "missing";
  type SortKey = "createdAt" | "lastUsedAt" | "name" | "useCount";

  type FavoriteRow = {
    favorite: FavoriteItem;
    expiresOn: Date | null;
    readableExpiry: string | null;
    status: ReturnType<typeof getTokenStatus> | null;
    statusKey: StatusKey;
    createdAt: Date;
    createdAgo: string;
    lastUsedAt: Date | null;
    lastUsedAgo: string | null;
  };

  let {
    items,
    onUse,
    onLoad,
    onEdit,
    onDelete,
    onDeleteMany,
    enableToolbar = true,
    enableSelection = false,
    compact = false,
    emptyCtaHref = undefined,
    emptyCtaLabel = undefined,
    emptyCtaOnClick = undefined,
    onPin = undefined
  } = $props<{
    items: FavoriteItem[];
    onUse: (item: FavoriteItem) => void;
    onLoad?: (item: FavoriteItem) => void;
    onEdit?: (item: FavoriteItem) => void;
    onDelete?: (item: FavoriteItem) => void;
    onDeleteMany?: (items: FavoriteItem[]) => void | Promise<void>;
    enableToolbar?: boolean;
    enableSelection?: boolean;
    compact?: boolean;
    emptyCtaHref?: string;
    emptyCtaLabel?: string;
    emptyCtaOnClick?: () => void;
    onPin?: (item: FavoriteItem, pin: boolean) => void;
  }>();

  let searchQuery = $state("");
  let typeFilter = $state<"all" | "app" | "user">("all");
  let statusFilter = $state<"all" | StatusKey>("all");
  let sortKey = $state<SortKey>("createdAt");
  let sortDirection = $state<"asc" | "desc">("desc");
  let tagFilter = $state<string | null>(null);
  let colorFilter = $state<string | null>(null);
  let appFilter = $state<string>("all");
  let selectedIds = $state<Set<string>>(new Set());
  let selectAllRef = $state<HTMLInputElement | null>(null);

  // Derive unique apps from items for filter dropdown
  const uniqueApps = $derived((() => {
    const appMap = new Map<string, { id: string; name: string; color?: string }>();
    for (const item of items) {
      if (item.appId && item.appName) {
        appMap.set(item.appId, { 
          id: item.appId, 
          name: item.appName, 
          color: item.appColor 
        });
      }
    }
    return Array.from(appMap.values());
  })());

  const statusOrder: Record<StatusKey, number> = {
    expired: 0,
    expiring: 1,
    valid: 2,
    missing: 3
  };

  const baseRows = $derived((() => {
    const now = $time;

    return items.map((favorite: FavoriteItem): FavoriteRow => {
      const expiresOn = favorite.tokenData?.expiresOn ? new Date(favorite.tokenData.expiresOn) : null;
      const status = expiresOn ? getTokenStatus(expiresOn, now) : null;
      const statusKey: StatusKey = status
        ? status.label === "Expired"
          ? "expired"
          : status.label === "Expiring"
            ? "expiring"
            : "valid"
        : "missing";

      const createdAt = new Date(favorite.createdAt ?? favorite.timestamp);
      const lastUsedAt = favorite.lastUsedAt ? new Date(favorite.lastUsedAt) : null;

      return {
        favorite,
        expiresOn,
        readableExpiry: expiresOn ? getReadableExpiry(expiresOn, now) : null,
        status,
        statusKey,
        createdAt,
        createdAgo: getReadableExpiry(createdAt, now),
        lastUsedAt,
        lastUsedAgo: lastUsedAt ? getReadableExpiry(lastUsedAt, now) : null
      };
    });
  })());

  const availableTags = $derived((() => {
    const normalized = items
      .flatMap((fav: FavoriteItem) => fav.tags ?? [])
      .map((tag: string) => tag.toLowerCase());
    return Array.from(new Set(normalized)).filter(Boolean) as string[];
  })());

  const availableColors = $derived<string[]>((() => {
    const colors = items
      .map((fav: FavoriteItem) => fav.color)
      .filter((color: string | undefined): color is string => Boolean(color));
    return Array.from(new Set(colors));
  })());

  const colorLabels: Record<string, string> = {
    "#0ea5e9": "Sky",
    "#22c55e": "Green",
    "#f97316": "Orange",
    "#a855f7": "Purple",
    "#ef4444": "Red",
    "#eab308": "Amber",
    "#14b8a6": "Teal",
    "#6366f1": "Indigo"
  };

  function getColorLabel(color?: string | null) {
    if (!color) return null;
    return colorLabels[color] ?? color;
  }

  const filteredRows = $derived((() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = baseRows.filter((row: FavoriteRow) => {
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "app" && row.favorite.type === "App Token") ||
        (typeFilter === "user" && row.favorite.type === "User Token");

      const matchesStatus = statusFilter === "all" || row.statusKey === statusFilter;
      const matchesApp = appFilter === "all" || row.favorite.appId === appFilter;
      const matchesTag = tagFilter
        ? (row.favorite.tags ?? []).some((tag: string) => tag.toLowerCase() === tagFilter)
        : true;
      const matchesColor = colorFilter ? row.favorite.color === colorFilter : true;

      const matchesSearch =
        !query ||
        row.favorite.target.toLowerCase().includes(query) ||
        (row.favorite.name ?? "").toLowerCase().includes(query) ||
        (row.favorite.description ?? "").toLowerCase().includes(query) ||
        (row.favorite.appName ?? "").toLowerCase().includes(query) ||
        (row.favorite.tags ?? []).some((tag: string) => tag.toLowerCase().includes(query));

      return matchesType && matchesStatus && matchesApp && matchesSearch && matchesTag && matchesColor;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aPinned = Boolean(a.favorite.isPinned);
      const bPinned = Boolean(b.favorite.isPinned);

      if (aPinned && bPinned) {
        const aPinnedAt = a.favorite.pinnedAt ?? 0;
        const bPinnedAt = b.favorite.pinnedAt ?? 0;
        if (aPinnedAt !== bPinnedAt) {
          return bPinnedAt - aPinnedAt;
        }
      }

      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }

      const direction = sortDirection === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name": {
          const aName = a.favorite.name ?? a.favorite.target;
          const bName = b.favorite.name ?? b.favorite.target;
          return aName.localeCompare(bName) * direction;
        }
        case "useCount":
          return ((a.favorite.useCount ?? 0) - (b.favorite.useCount ?? 0)) * direction;
        case "lastUsedAt": {
          const aTime = a.favorite.lastUsedAt ?? 0;
          const bTime = b.favorite.lastUsedAt ?? 0;
          return (aTime - bTime) * direction;
        }
        default: {
          const aTime = a.favorite.createdAt ?? a.favorite.timestamp;
          const bTime = b.favorite.createdAt ?? b.favorite.timestamp;
          return (aTime - bTime) * direction;
        }
      }
    });

    return sorted;
  })());

  const isFiltered = $derived(
    searchQuery.trim().length > 0 ||
      typeFilter !== "all" ||
      statusFilter !== "all" ||
      appFilter !== "all" ||
      Boolean(tagFilter) ||
      Boolean(colorFilter)
  );

  const selectedItems = $derived(
    baseRows
      .filter((row: FavoriteRow) => selectedIds.has(row.favorite.id))
      .map((row: FavoriteRow) => row.favorite)
  );

  const selectedCount = $derived(selectedItems.length);

  const allFilteredSelected = $derived(
    filteredRows.length > 0 &&
      filteredRows.every((row) => selectedIds.has(row.favorite.id))
  );

  $effect(() => {
    if (selectAllRef) {
      selectAllRef.indeterminate = selectedCount > 0 && !allFilteredSelected;
    }
  });

  $effect(() => {
    const availableIds = new Set(items.map((fav: FavoriteItem) => fav.id));
    const retained = new Set([...selectedIds].filter((id) => availableIds.has(id)));

    if (retained.size !== selectedIds.size) {
      selectedIds = retained;
    }
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = key === "name" ? "asc" : "desc";
    }
  }

  function resetFilters() {
    searchQuery = "";
    typeFilter = "all";
    statusFilter = "all";
    appFilter = "all";
    sortKey = "createdAt";
    sortDirection = "desc";
    tagFilter = null;
    colorFilter = null;
  }

  function toggleRowSelection(id: string) {
    if (!enableSelection) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }

  function toggleAllFiltered() {
    if (!enableSelection) return;
    const filteredIds = filteredRows.map((row) => row.favorite.id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);

    if (allSelected) {
      filteredIds.forEach((id) => next.delete(id));
    } else {
      filteredIds.forEach((id) => next.add(id));
    }

    selectedIds = next;
  }

  async function handleBulkDelete() {
    if (!onDeleteMany || !selectedItems.length) return;
    await onDeleteMany(selectedItems);
    selectedIds = new Set();
  }

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

  <div class="flex h-full flex-col space-y-3">
  {#if enableToolbar}
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
      <div class="flex flex-1 flex-wrap items-center gap-2">
        <div class="relative w-full min-w-[240px] max-w-sm">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, target, or tags"
            bind:value={searchQuery}
            class="pl-9"
          />
        </div>

        <div class="flex items-center gap-2">
          <Select.Root
            type="single"
            value={typeFilter}
            onValueChange={(value) => (typeFilter = value as typeof typeFilter)}
          >
            <Select.Trigger class="w-[150px]">
              {typeFilter === "all" ? "All types" : typeFilter === "app" ? "App tokens" : "User tokens"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All types</Select.Item>
              <Select.Item value="app">App tokens</Select.Item>
              <Select.Item value="user">User tokens</Select.Item>
            </Select.Content>
          </Select.Root>

          <Select.Root
            type="single"
            value={statusFilter}
            onValueChange={(value) => (statusFilter = value as typeof statusFilter)}
          >
            <Select.Trigger class="w-[170px]">
              {statusFilter === "all"
                ? "All statuses"
                : statusFilter === "expired"
                  ? "Expired"
                  : statusFilter === "expiring"
                    ? "Expiring soon"
                    : "Valid"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              <Select.Item value="valid">Valid</Select.Item>
              <Select.Item value="expiring">Expiring soon</Select.Item>
              <Select.Item value="expired">Expired</Select.Item>
            </Select.Content>
          </Select.Root>

          {#if uniqueApps.length > 0}
            <Select.Root
              type="single"
              value={appFilter}
              onValueChange={(value) => (appFilter = value)}
            >
              <Select.Trigger class="w-[150px]">
                {appFilter === "all" ? "All apps" : uniqueApps.find(a => a.id === appFilter)?.name || "App"}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All apps</Select.Item>
                {#each uniqueApps as app (app.id)}
                  <Select.Item value={app.id}>
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full shrink-0" style="background-color: {app.color || '#10b981'}"></div>
                      <span class="truncate">{app.name}</span>
                    </div>
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}

          {#if availableTags.length}
            <Select.Root
              type="single"
              value={tagFilter ?? "all"}
              onValueChange={(value) => (tagFilter = value === "all" ? null : value)}
            >
              <Select.Trigger class="w-[140px]">
                {tagFilter ? `Tag: ${tagFilter}` : "All tags"}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All tags</Select.Item>
                {#each availableTags as tag}
                  <Select.Item value={tag}>{tag}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}

          {#if availableColors.length}
            <Select.Root
              type="single"
              value={colorFilter ?? "all"}
              onValueChange={(value) => (colorFilter = value === "all" ? null : value)}
            >
              <Select.Trigger class="w-[140px]">
                {colorFilter ? `Color: ${getColorLabel(colorFilter)}` : "All colors"}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All colors</Select.Item>
                {#each availableColors as color (color)}
                  <Select.Item value={color}>
                    <span class="mr-2 inline-block h-3 w-3 rounded-full border border-border/60" style={`background-color:${color}`} aria-hidden="true"></span>
                    {getColorLabel(color)}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-2">
        {#if enableSelection && onDeleteMany && selectedCount > 0}
          <Button
            variant="destructive"
            size="sm"
            class="gap-2"
            onclick={handleBulkDelete}
          >
            <Trash2 class="h-4 w-4" />
            {`Delete ${selectedCount} selected`}
          </Button>
        {/if}
        {#if isFiltered}
          <Button variant="ghost" size="sm" class="gap-2" onclick={resetFilters} title="Reset filters">
            <Filter class="h-4 w-4" />
            Reset
          </Button>
        {/if}
        <Badge variant="outline" class="text-xs font-normal">
          {filteredRows.length} / {baseRows.length} favorites
        </Badge>
      </div>
    </div>
  {/if}

  <div class={cn("flex flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm", compact ? "p-3" : "p-4")}>
    <div class="flex-1 overflow-auto">
      <Table class="table-auto w-full">
        <TableHeader>
          <TableRow>
            {#if enableSelection}
              <TableHead class="w-[48px] pl-4">
                <div class="flex justify-center">
                  <input
                    bind:this={selectAllRef}
                    type="checkbox"
                    aria-label="Select all filtered favorites"
                    class="h-4 w-4 rounded border-input bg-background text-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    checked={allFilteredSelected}
                    onchange={toggleAllFiltered}
                    disabled={filteredRows.length === 0}
                  />
                </div>
              </TableHead>
            {/if}
            <TableHead class="w-[110px]">Type</TableHead>
            <TableHead class="w-[100px]">
              <span class="text-xs font-semibold text-muted-foreground">App</span>
            </TableHead>
            <TableHead>
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("name")}
              >
                Name / Target
                {#if sortKey === "name"}
                  {#if sortDirection === "asc"}
                    <ArrowUp class="h-3.5 w-3.5" />
                  {:else}
                    <ArrowDown class="h-3.5 w-3.5" />
                  {/if}
                {:else}
                  <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[160px]">Status</TableHead>
            <TableHead class="w-[140px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("useCount")}
              >
                Usage
                {#if sortKey === "useCount"}
                  {#if sortDirection === "asc"}
                    <ArrowUp class="h-3.5 w-3.5" />
                  {:else}
                    <ArrowDown class="h-3.5 w-3.5" />
                  {/if}
                {:else}
                  <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[160px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("lastUsedAt")}
              >
                Last used
                {#if sortKey === "lastUsedAt"}
                  {#if sortDirection === "asc"}
                    <ArrowUp class="h-3.5 w-3.5" />
                  {:else}
                    <ArrowDown class="h-3.5 w-3.5" />
                  {/if}
                {:else}
                  <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[80px] text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#if filteredRows.length === 0}
            <TableRow>
              <TableCell colspan={enableSelection ? 8 : 7} class="p-0">
                <div class={cn("flex items-center justify-center text-center text-sm text-muted-foreground border-t bg-muted/10", compact ? "min-h-[120px] px-4 py-8" : "min-h-[180px] px-6 py-10")}>
                  <div class="flex flex-col items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                      <Star class="h-4 w-4" />
                    </div>
                    <div class="space-y-1">
                      <p class="text-base text-foreground/90">
                        {items.length === 0 ? "No favorites yet." : "Nothing matches your filters."}
                      </p>
                      <p class="text-sm text-muted-foreground">
                        {items.length === 0
                          ? "Save frequent targets for quick access."
                          : "Adjust search or filters to find an entry."}
                      </p>
                      {#if items.length === 0}
                        <p class="text-xs text-muted-foreground/80 pt-1">
                          Add favorites from the token result window in the Playground, or from the actions menu of any entry in the History.
                        </p>
                      {/if}
                    </div>
                    {#if emptyCtaLabel && emptyCtaOnClick}
                      <Button size="sm" class="gap-2" onclick={emptyCtaOnClick}>
                        <Play class="h-4 w-4" />
                        {emptyCtaLabel}
                      </Button>
                    {:else if emptyCtaHref && emptyCtaLabel}
                      <Button href={emptyCtaHref} size="sm" class="gap-2">
                        <Play class="h-4 w-4" />
                        {emptyCtaLabel}
                      </Button>
                    {/if}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          {:else}
            {#each filteredRows as row (row.favorite.id)}
              <TableRow
                class={cn(
                  row.statusKey === "expired" ? "bg-destructive/5" : "",
                  row.statusKey === "expiring" ? "bg-amber-500/5" : ""
                )}
              >
                {#if enableSelection}
                  <TableCell class="align-top pl-4">
                    <div class="flex justify-center pt-1">
                      <input
                        type="checkbox"
                        aria-label={`Select favorite ${row.favorite.name ?? row.favorite.target}`}
                        class="h-4 w-4 rounded border-input bg-background text-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        checked={selectedIds.has(row.favorite.id)}
                        onchange={() => toggleRowSelection(row.favorite.id)}
                      />
                    </div>
                  </TableCell>
                {/if}
                <TableCell class="align-top">
                  <Badge
                    variant={row.favorite.type === "App Token" ? "secondary" : "outline"}
                    class="text-xs font-medium"
                  >
                    {row.favorite.type}
                  </Badge>
                </TableCell>
                <TableCell class="align-top">
                  {#if row.favorite.appName}
                    <div class="flex items-center gap-2">
                      <div 
                        class="w-2.5 h-2.5 rounded-full shrink-0" 
                        style="background-color: {row.favorite.appColor || '#10b981'}"
                      ></div>
                      <span class="text-xs text-muted-foreground truncate max-w-[80px]" title={row.favorite.appName}>
                        {row.favorite.appName}
                      </span>
                    </div>
                  {:else}
                    <span class="text-xs text-muted-foreground italic">Legacy</span>
                  {/if}
                </TableCell>
                <TableCell class="align-top">
                  <div class="space-y-1">
                    <div class="flex items-start gap-2">
                      {#if row.favorite.color}
                        <span
                          class="mt-0.5 inline-block h-2.5 w-2.5 rounded-full border border-border/60"
                          style={`background-color: ${row.favorite.color}`}
                          aria-hidden="true"
                        ></span>
                      {/if}
                      <div class="flex flex-col">
                        <p class="text-sm font-semibold leading-tight text-foreground">
                          {row.favorite.name || row.favorite.target}
                        </p>
                        {#if row.favorite.isPinned}
                          <div class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <Pin class="h-3 w-3" />
                            <span>Pinned</span>
                          </div>
                        {/if}
                        {#if row.favorite.name}
                          <p class="font-mono text-[12px] text-muted-foreground break-all">{row.favorite.target}</p>
                        {/if}
                      </div>
                    </div>
                    {#if row.favorite.tags?.length}
                      <div class="flex flex-wrap gap-1.5">
                        {#each row.favorite.tags as tag}
                          <Badge variant="outline" class="text-[11px] font-normal">{tag}</Badge>
                        {/each}
                      </div>
                    {/if}
                    {#if row.favorite.description}
                      <p class="text-xs text-muted-foreground leading-snug">{row.favorite.description}</p>
                    {/if}
                  </div>
                </TableCell>
                <TableCell class="align-top">
                  {#if row.expiresOn}
                    <TokenStatusBadge expiresOn={row.expiresOn} compact />
                    <p class="mt-1 text-[11px] text-muted-foreground">
                      {row.statusKey === "expired"
                        ? `Expired ${row.readableExpiry}`
                        : row.statusKey === "expiring"
                          ? `Expires in ${row.readableExpiry}`
                          : `Expires in ${row.readableExpiry}`}
                    </p>
                  {:else}
                    <p class="text-xs text-muted-foreground">No token data</p>
                  {/if}
                </TableCell>
                <TableCell class="align-top">
                  <div class="text-sm font-medium leading-tight">{row.favorite.useCount || 0} uses</div>
                  <div class="text-[11px] text-muted-foreground">Created {row.createdAgo}</div>
                </TableCell>
                <TableCell class="align-top">
                  <div class="text-sm font-medium leading-tight">
                    {row.lastUsedAt ? row.lastUsedAt.toLocaleString() : "Not used yet"}
                  </div>
                  <div class="text-[11px] text-muted-foreground">
                    {row.lastUsedAgo ? `Used ${row.lastUsedAgo}` : "—"}
                  </div>
                </TableCell>
                <TableCell class="align-top text-right pr-4">
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

                      <DropdownMenu.Item onclick={() => onUse(row.favorite)}>
                        <Play class="mr-2 h-4 w-4" />
                        <span>Reissue</span>
                      </DropdownMenu.Item>

                      {#if row.favorite.tokenData && onLoad}
                        <DropdownMenu.Item onclick={() => onLoad?.(row.favorite)}>
                          <Eye class="mr-2 h-4 w-4" />
                          <span>Load details</span>
                        </DropdownMenu.Item>
                      {/if}

                      {#if onEdit}
                        <DropdownMenu.Item onclick={() => onEdit?.(row.favorite)}>
                          <Pencil class="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenu.Item>
                      {/if}

                      {#if onPin}
                         {#if row.favorite.isPinned}
                            <DropdownMenu.Item onclick={() => onPin?.(row.favorite, false)}>
                              <PinOff class="mr-2 h-4 w-4" />
                              <span>Unpin</span>
                            </DropdownMenu.Item>
                         {:else}
                            <DropdownMenu.Item onclick={() => onPin?.(row.favorite, true)}>
                              <Pin class="mr-2 h-4 w-4" />
                              <span>Pin</span>
                            </DropdownMenu.Item>
                         {/if}
                      {/if}

                      <DropdownMenu.Separator />
                      <DropdownMenu.Label class="text-[11px] text-muted-foreground">Copy</DropdownMenu.Label>
                      <DropdownMenu.Item onclick={() => copyValue(row.favorite.target, "Target")}>
                        <Copy class="mr-2 h-4 w-4" />
                        <span>Copy target</span>
                      </DropdownMenu.Item>
                      {#if row.favorite.tokenData?.accessToken}
                        <DropdownMenu.Item onclick={() => copyValue(row.favorite.tokenData!.accessToken, "Token")}>
                          <Copy class="mr-2 h-4 w-4" />
                          <span>Copy token</span>
                        </DropdownMenu.Item>
                      {/if}

                      {#if onDelete}
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item onclick={() => onDelete?.(row.favorite)} class="text-destructive focus:text-destructive">
                          <Trash2 class="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenu.Item>
                      {/if}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </TableCell>
              </TableRow>
            {/each}
          {/if}
        </TableBody>
      </Table>
    </div>
  </div>
</div>
