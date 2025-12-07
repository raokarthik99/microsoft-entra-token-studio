<script lang="ts">
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/shadcn/components/ui/table";
  import { Clock3, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, Trash2, Play } from "@lucide/svelte";
  import TokenStatusBadge from "./TokenStatusBadge.svelte";
  import ColorDot from "./color-dot.svelte";
  import DataTableActions from "./history-table/data-table-actions.svelte";
  import { getReadableExpiry, getTokenStatus, cn } from "$lib/utils";
  import { time } from "$lib/stores/time";
  import type { HistoryItem } from "$lib/types";

  type StatusKey = "expired" | "expiring" | "valid" | "missing";
  type SortKey = "timestamp" | "target" | "type" | "status" | "expiresOn";
  type HistoryRow = {
    item: HistoryItem;
    typeKey: "app" | "user";
    issuedOn: Date;
    issuedAgo: string;
    expiresOn: Date | null;
    readableExpiry: string | null;
    status: ReturnType<typeof getTokenStatus> | null;
    statusKey: StatusKey;
  };

  let {
    items,
    limit,
    onRestore,
    onLoad,
    onDelete,
    onDeleteMany,
    onFavorite,
    onUnfavorite,
    isFavorited,
    onPin,
    onUnpin,
    isPinned,
    enableToolbar = true,
    enableSorting = true,
    enableSelection = false,
    compact = false,
    showFooter = true,
    emptyCtaHref = undefined,
    emptyCtaLabel = undefined,
    emptyCtaOnClick = undefined
  } = $props<{
    items: HistoryItem[];
    limit?: number;
    onRestore: (item: HistoryItem) => void;
    onLoad?: (item: HistoryItem) => void;
    onDelete?: (item: HistoryItem) => void;
    onDeleteMany?: (items: HistoryItem[]) => void | Promise<void>;
    onFavorite?: (item: HistoryItem) => void;
    onUnfavorite?: (item: HistoryItem) => void;
    isFavorited?: (item: HistoryItem) => boolean;
    onPin?: (item: HistoryItem) => void;
    onUnpin?: (item: HistoryItem) => void;
    isPinned?: (item: HistoryItem) => boolean;
    enableToolbar?: boolean;
    enableSorting?: boolean;
    enableSelection?: boolean;
    compact?: boolean;
    showFooter?: boolean;
    emptyCtaHref?: string;
    emptyCtaLabel?: string;
    emptyCtaOnClick?: () => void;
  }>();

  let searchQuery = $state("");
  let typeFilter = $state<"all" | "app" | "user">("all");
  let statusFilter = $state<"all" | StatusKey>("all");
  let appFilter = $state<string>("all");
  let sortKey = $state<SortKey>("timestamp");
  let sortDirection = $state<"asc" | "desc">("desc");
  let showFooterState = $state(showFooter);
  let selectedTimestamps = $state<Set<number>>(new Set());
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

  const baseRows = $derived((() => {
    const source: HistoryItem[] = limit ? items.slice(0, limit) : items;
    const now = $time;

    return source.map((item: HistoryItem): HistoryRow => {
      const typeKey = item.type === "App Token" ? "app" : "user";
      const issuedOn = new Date(item.timestamp);
      const expiresOn = item.tokenData?.expiresOn ? new Date(item.tokenData.expiresOn) : null;
      const status = expiresOn ? getTokenStatus(expiresOn, now) : null;
      const statusKey: StatusKey = status
        ? status.label === "Expired"
          ? "expired"
          : status.label === "Expiring"
            ? "expiring"
            : "valid"
        : "missing";

      return {
        item,
        typeKey,
        issuedOn,
        issuedAgo: getReadableExpiry(issuedOn, now),
        expiresOn,
        readableExpiry: expiresOn ? getReadableExpiry(expiresOn, now) : null,
        status,
        statusKey
      };
    });
  })());

  const statusOrder: Record<StatusKey, number> = {
    expired: 0,
    expiring: 1,
    valid: 2,
    missing: 3
  };

  const typeOrder: Record<HistoryRow["typeKey"], number> = {
    app: 0,
    user: 1
  };

  const filteredRows = $derived((() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = baseRows.filter((row) => {
      const matchesType = typeFilter === "all" || row.typeKey === typeFilter;
      const matchesStatus = statusFilter === "all" || row.statusKey === statusFilter;
      const matchesApp = appFilter === "all" || row.item.appId === appFilter;
      const matchesSearch =
        !query ||
        row.item.target.toLowerCase().includes(query) ||
        row.item.type.toLowerCase().includes(query) ||
        (row.item.appName?.toLowerCase()?.includes(query) ?? false) ||
        (row.status?.label?.toLowerCase()?.includes(query) ?? false);

      return matchesType && matchesStatus && matchesApp && matchesSearch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortKey) {
        case "target":
          return a.item.target.localeCompare(b.item.target) * direction;
        case "type":
          return (typeOrder[a.typeKey] - typeOrder[b.typeKey]) * direction;
        case "status":
          return (statusOrder[a.statusKey] - statusOrder[b.statusKey]) * direction;
        case "expiresOn": {
          if (!a.expiresOn && !b.expiresOn) return 0;
          if (!a.expiresOn) return 1;
          if (!b.expiresOn) return -1;
          return (a.expiresOn.getTime() - b.expiresOn.getTime()) * direction;
        }
        default:
          return (a.item.timestamp - b.item.timestamp) * direction;
      }
    });

    return sorted;
  })());

  $effect(() => {
    const availableTimestamps = new Set(items.map((item: HistoryItem) => item.timestamp));
    const retained = new Set([...selectedTimestamps].filter((timestamp) => availableTimestamps.has(timestamp)));

    if (retained.size !== selectedTimestamps.size) {
      selectedTimestamps = retained;
    }
  });

  const selectedItems = $derived(
    baseRows
      .filter((row) => selectedTimestamps.has(row.item.timestamp))
      .map((row) => row.item)
  );

  const selectedCount = $derived(selectedItems.length);
  const allFilteredSelected = $derived(
    filteredRows.length > 0 &&
      filteredRows.every((row) => selectedTimestamps.has(row.item.timestamp))
  );

  $effect(() => {
    if (selectAllRef) {
      selectAllRef.indeterminate = selectedCount > 0 && !allFilteredSelected;
    }
  });

  const isFiltered = $derived(
    searchQuery.trim().length > 0 || typeFilter !== "all" || statusFilter !== "all" || appFilter !== "all"
  );

  function toggleSort(key: SortKey) {
    if (!enableSorting) return;
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = key === "target" ? "asc" : "desc";
    }
  }

  function resetFilters() {
    searchQuery = "";
    typeFilter = "all";
    statusFilter = "all";
    appFilter = "all";
    sortKey = "timestamp";
    sortDirection = "desc";
  }

  function toggleRowSelection(timestamp: number) {
    if (!enableSelection) return;
    const next = new Set(selectedTimestamps);
    if (next.has(timestamp)) {
      next.delete(timestamp);
    } else {
      next.add(timestamp);
    }
    selectedTimestamps = next;
  }

  function toggleAllFiltered() {
    if (!enableSelection) return;
    const filteredTimestamps = filteredRows.map((row) => row.item.timestamp);
    const allSelected = filteredTimestamps.every((timestamp) => selectedTimestamps.has(timestamp));
    const next = new Set(selectedTimestamps);

    if (allSelected) {
      filteredTimestamps.forEach((timestamp) => next.delete(timestamp));
    } else {
      filteredTimestamps.forEach((timestamp) => next.add(timestamp));
    }

    selectedTimestamps = next;
  }

  async function handleBulkDelete() {
    if (!onDeleteMany || !selectedItems.length) return;
    await onDeleteMany(selectedItems);
    selectedTimestamps = new Set();
  }
</script>

<div class="flex h-full flex-col space-y-3">
  {#if enableToolbar}
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
      <div class="flex flex-1 flex-wrap items-center gap-2">
        <div class="relative w-full min-w-[220px] max-w-sm">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search target, scope, or status"
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
          {filteredRows.length} / {baseRows.length} {limit ? "recent" : "total"}
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
                    aria-label="Select all filtered items"
                    class="h-4 w-4 rounded border-input bg-background text-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    checked={allFilteredSelected}
                    onchange={toggleAllFiltered}
                    disabled={filteredRows.length === 0}
                  />
                </div>
              </TableHead>
            {/if}
            <TableHead class="w-[140px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("type")}
                disabled={!enableSorting}
              >
                Type
                {#if enableSorting}
                  {#if sortKey === "type"}
                    {#if sortDirection === "asc"}
                      <ArrowUp class="h-3.5 w-3.5" />
                    {:else}
                      <ArrowDown class="h-3.5 w-3.5" />
                    {/if}
                  {:else}
                    <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                  {/if}
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[120px]">
              <span class="text-xs font-semibold text-muted-foreground">App</span>
            </TableHead>
            <TableHead>
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("target")}
                disabled={!enableSorting}
              >
                Target
                {#if enableSorting}
                  {#if sortKey === "target"}
                    {#if sortDirection === "asc"}
                      <ArrowUp class="h-3.5 w-3.5" />
                    {:else}
                      <ArrowDown class="h-3.5 w-3.5" />
                    {/if}
                  {:else}
                    <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                  {/if}
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[160px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("status")}
                disabled={!enableSorting}
              >
                Status
                {#if enableSorting}
                  {#if sortKey === "status"}
                    {#if sortDirection === "asc"}
                      <ArrowUp class="h-3.5 w-3.5" />
                    {:else}
                      <ArrowDown class="h-3.5 w-3.5" />
                    {/if}
                  {:else}
                    <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                  {/if}
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[200px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("timestamp")}
                disabled={!enableSorting}
              >
                Issued
                {#if enableSorting}
                  {#if sortKey === "timestamp"}
                    {#if sortDirection === "asc"}
                      <ArrowUp class="h-3.5 w-3.5" />
                    {:else}
                      <ArrowDown class="h-3.5 w-3.5" />
                    {/if}
                  {:else}
                    <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                  {/if}
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[180px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("expiresOn")}
                disabled={!enableSorting}
              >
                Expires
                {#if enableSorting}
                  {#if sortKey === "expiresOn"}
                    {#if sortDirection === "asc"}
                      <ArrowUp class="h-3.5 w-3.5" />
                    {:else}
                      <ArrowDown class="h-3.5 w-3.5" />
                    {/if}
                  {:else}
                    <ArrowUpDown class="h-3.5 w-3.5 opacity-60" />
                  {/if}
                {/if}
              </button>
            </TableHead>
            <TableHead class="w-[140px] text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#if filteredRows.length === 0}
            <TableRow>
              <TableCell colspan={enableSelection ? 8 : 7} class="p-0">
                <div class={cn("flex items-center justify-center text-center text-sm text-muted-foreground border-t bg-muted/10", compact ? "min-h-[120px] px-4 py-8" : "min-h-[160px] px-6 py-10")}>
                  <div class="flex flex-col items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                      <Clock3 class="h-4 w-4" />
                    </div>
                    <div class="space-y-1">
                      <p class="text-base text-foreground/90">
                        {#if items.length === 0}
                          No history yet.
                        {:else}
                          Nothing matches your filters.
                        {/if}
                      </p>
                      <p class="text-sm text-muted-foreground">
                        {#if items.length === 0}
                          Generate a token to see it here.
                        {:else}
                          Adjust search or filters to find an entry.
                        {/if}
                      </p>
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
            {#each filteredRows as row (row.item.timestamp)}
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
                        aria-label={`Select ${row.item.type} targeting ${row.item.target}`}
                        class="h-4 w-4 rounded border-input bg-background text-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        checked={selectedTimestamps.has(row.item.timestamp)}
                        onchange={() => toggleRowSelection(row.item.timestamp)}
                      />
                    </div>
                  </TableCell>
                {/if}
                <TableCell class="align-top">
                  <div class="flex items-center gap-2">
                    <Badge
                      variant={row.item.type === "App Token" ? "secondary" : "outline"}
                      class="text-xs font-medium"
                    >
                      {row.item.type}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell class="align-top">
                  {#if row.item.appName}
                    <div class="flex items-center gap-2">
                      <ColorDot color={row.item.appColor || "#10b981"} size={10} />
                      <span class="text-xs text-muted-foreground truncate max-w-[80px]" title={row.item.appName}>
                        {row.item.appName}
                      </span>
                    </div>
                  {:else}
                    <span class="text-xs text-muted-foreground italic">Legacy</span>
                  {/if}
                </TableCell>
                <TableCell class="align-top">
                  <p class="font-mono text-[13px] leading-5 text-foreground/90 break-all">{row.item.target}</p>
                  {#if row.item.tokenData?.scope || row.item.tokenData?.scopes?.length}
                    <p class="mt-1 text-[11px] text-muted-foreground">
                      {(row.item.tokenData.scopes ?? [row.item.tokenData.scope]).filter(Boolean).join(", ")}
                    </p>
                  {/if}
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
                    <p class="text-xs text-muted-foreground">No expiry data</p>
                  {/if}
                </TableCell>
                <TableCell class="align-top">
                  <div class="text-sm font-medium leading-tight">{row.issuedOn.toLocaleString()}</div>
                  <div class="text-[11px] text-muted-foreground">Issued {row.issuedAgo}</div>
                </TableCell>
                <TableCell class="align-top">
                  {#if row.expiresOn}
                    <div class="text-sm font-medium leading-tight">{row.expiresOn.toLocaleString()}</div>
                    <div class="text-[11px] text-muted-foreground">
                      {row.statusKey === "expired" ? row.readableExpiry : `In ${row.readableExpiry}`}
                    </div>
                  {:else}
                    <div class="text-xs text-muted-foreground">—</div>
                  {/if}
                </TableCell>
                <TableCell class="align-top text-right pr-4">
                  <DataTableActions
                    item={row.item}
                    statusLabel={row.status?.label ?? "No expiry"}
                    onRestore={onRestore}
                    onLoad={onLoad}
                    onDelete={onDelete}
                    onFavorite={onFavorite}
                    onUnfavorite={onUnfavorite}
                    favoriteExists={isFavorited ? isFavorited(row.item) : false}
                    onPin={onPin}
                    onUnpin={onUnpin}
                    pinnedExists={isPinned ? isPinned(row.item) : false}
                    showDelete={Boolean(onDelete) && enableToolbar}
                    compact={compact}
                  />
                </TableCell>
              </TableRow>
            {/each}
          {/if}
        </TableBody>
      </Table>
    </div>
    {#if showFooterState}
      <div class={cn("flex items-center gap-2 border-t text-muted-foreground", compact ? "px-3 py-2" : "px-4 py-3")}>
        <Clock3 class="h-4 w-4" />
        <span class="text-sm">
          {filteredRows.length} / {baseRows.length} {limit ? "recent items" : "history items"}.
        </span>
      </div>
    {/if}
  </div>
</div>
