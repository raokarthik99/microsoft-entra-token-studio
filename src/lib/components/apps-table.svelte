<script lang="ts">
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/shadcn/components/ui/table";
  import * as Tooltip from "$lib/shadcn/components/ui/tooltip";
  import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, Cloud, Plus, KeyRound, Shield, Tags, Trash2 } from "@lucide/svelte";
  import AppsTableActions from "./apps-table-actions.svelte";
  import ColorDot from "./color-dot.svelte";
  import { cn, getReadableExpiry } from "$lib/utils";
  import { time } from "$lib/stores/time";
  import type { AppConfig } from "$lib/types";

  type SortKey = "name" | "clientId" | "credentialType" | "lastUsedAt";
  type CredentialFilter = "all" | "secret" | "certificate";

  type AppRow = {
    app: AppConfig;
    vaultName: string;
    lastUsedLabel: string;
    lastUsedOn: Date | null;
  };

  let {
    apps,
    activeAppId,
    onAdd,
    onSwitch,
    onEdit,
    onDelete,
    onDeleteMany,
    enableToolbar = true,
    enableSorting = true,
    enableSelection = true,
    showFooter = true,
  } = $props<{
    apps: AppConfig[];
    activeAppId: string | null;
    onAdd?: () => void;
    onSwitch?: (app: AppConfig) => void;
    onEdit?: (app: AppConfig) => void;
    onDelete?: (app: AppConfig) => void;
    enableToolbar?: boolean;
    enableSorting?: boolean;
    onDeleteMany?: (apps: AppConfig[]) => void | Promise<void>;
    enableSelection?: boolean;
    showFooter?: boolean;
  }>();

  let searchQuery = $state("");
  let credentialFilter = $state<CredentialFilter>("all");
  let tagFilter = $state<"all" | string>("all");
  let sortKey = $state<SortKey>("name");
  let sortDirection = $state<"asc" | "desc">("asc");
  let selectedIds = $state<Set<string>>(new Set());
  let selectAllRef = $state<HTMLInputElement | null>(null);

  const baseRows = $derived((() => {
    const now = $time;

    return apps.map((app: AppConfig): AppRow => {
      // Extract vault name from URI
      const vaultMatch = app.keyVault.uri.match(/https:\/\/([^.]+)\.vault\.azure\.net/);
      const vaultName = vaultMatch ? vaultMatch[1] : app.keyVault.uri;
      const lastUsedOn = app.lastUsedAt ? new Date(app.lastUsedAt) : null;
      const lastUsedLabel = lastUsedOn
        ? getReadableExpiry(lastUsedOn, now)
        : "Never";

      return {
        app,
        vaultName,
        lastUsedLabel,
        lastUsedOn,
      };
    });
  })());

  const availableTags = $derived((() => {
    const set = new Set<string>();
    apps.forEach((app: AppConfig) => app.tags?.forEach((tag: string) => set.add(tag)));
    return Array.from(set).sort();
  })());

  const filteredRows = $derived((() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = baseRows.filter((row: AppRow) => {
      const matchesCredential = credentialFilter === "all" || row.app.keyVault.credentialType === credentialFilter;
      const matchesTag =
        tagFilter === "all" ||
        (row.app.tags ?? []).some((tag) => tag.toLowerCase() === tagFilter);
      const matchesSearch =
        !query ||
        row.app.name.toLowerCase().includes(query) ||
        row.app.clientId.toLowerCase().includes(query) ||
        row.app.tenantId.toLowerCase().includes(query) ||
        row.vaultName.toLowerCase().includes(query) ||
        (row.app.description?.toLowerCase().includes(query) ?? false) ||
        (row.app.tags ?? []).some((tag) => tag.toLowerCase().includes(query));

      return matchesCredential && matchesTag && matchesSearch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortKey) {
        case "name":
          return a.app.name.localeCompare(b.app.name) * direction;
        case "clientId":
          return a.app.clientId.localeCompare(b.app.clientId) * direction;
        case "credentialType":
          return a.app.keyVault.credentialType.localeCompare(b.app.keyVault.credentialType) * direction;
        case "lastUsedAt": {
          const aTime = a.app.lastUsedAt ?? 0;
          const bTime = b.app.lastUsedAt ?? 0;
          return (aTime - bTime) * direction;
        }
        default:
          return 0;
      }
    });

    return sorted;
  })());

  const isFiltered = $derived(
    searchQuery.trim().length > 0 || credentialFilter !== "all" || tagFilter !== "all"
  );

  function toggleSort(key: SortKey) {
    if (!enableSorting) return;
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = key === "lastUsedAt" ? "desc" : "asc";
    }
  }

  function resetFilters() {
    searchQuery = "";
    credentialFilter = "all";
    tagFilter = "all";
    sortKey = "name";
    sortDirection = "asc";
  }

  $effect(() => {
    const availableIds = new Set(apps.map((app: AppConfig) => app.id));
    const retained = new Set([...selectedIds].filter((id) => availableIds.has(id)));

    if (retained.size !== selectedIds.size) {
      selectedIds = retained;
    }
  });

  const selectedApps = $derived(
    baseRows
      .filter((row: AppRow) => selectedIds.has(row.app.id))
      .map((row: AppRow) => row.app)
  );

  const selectedCount = $derived(selectedApps.length);
  const allFilteredSelected = $derived(
    filteredRows.length > 0 &&
      filteredRows.every((row: AppRow) => selectedIds.has(row.app.id))
  );

  $effect(() => {
    if (selectAllRef) {
      selectAllRef.indeterminate = selectedCount > 0 && !allFilteredSelected;
    }
  });

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
    const filteredIds = filteredRows.map((row: AppRow) => row.app.id);
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
    if (!onDeleteMany || !selectedApps.length) return;
    await onDeleteMany(selectedApps);
    selectedIds = new Set();
  }
</script>

<div class="flex h-full flex-col space-y-3">
  {#if enableToolbar}
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
      <div class="flex flex-1 flex-wrap items-center gap-2">
        <div class="relative w-full min-w-[220px] max-w-sm">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, client ID, or vault"
            bind:value={searchQuery}
            class="pl-9"
          />
        </div>

        <div class="flex items-center gap-2">
          <Select.Root
            type="single"
            value={credentialFilter}
            onValueChange={(value) => (credentialFilter = value as CredentialFilter)}
          >
            <Select.Trigger class="w-[150px]">
              {credentialFilter === "all" ? "All credentials" : credentialFilter === "secret" ? "Secrets" : "Certificates"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All credentials</Select.Item>
              <Select.Item value="secret">Secrets</Select.Item>
              <Select.Item value="certificate">Certificates</Select.Item>
            </Select.Content>
          </Select.Root>

          {#if availableTags.length}
            <Select.Root
              type="single"
              value={tagFilter}
              onValueChange={(value) => (tagFilter = value as typeof tagFilter)}
            >
              <Select.Trigger class="w-[170px]">
                <div class="flex items-center gap-2">
                  <Tags class="h-4 w-4" />
                  {tagFilter === "all" ? "All tags" : `Tag: ${tagFilter}`}
                </div>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All tags</Select.Item>
                {#each availableTags as tag}
                  <Select.Item value={tag}>{tag}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-2">
        {#if enableSelection && onDeleteMany && selectedCount > 0}
          <Button
            variant="secondary"
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
          {filteredRows.length} / {baseRows.length} apps
        </Badge>
        {#if onAdd}
          <Button size="sm" class="gap-2" onclick={onAdd}>
            <Plus class="h-4 w-4" />
            Add App
          </Button>
        {/if}
      </div>
    </div>
  {/if}

  <div class="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm p-4">
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
                    aria-label="Select all filtered apps"
                    class="h-4 w-4 rounded border-input bg-background text-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    checked={allFilteredSelected}
                    onchange={toggleAllFiltered}
                    disabled={filteredRows.length === 0}
                  />
                </div>
              </TableHead>
            {/if}
            <TableHead class="w-[60px]">Color</TableHead>
            <TableHead>
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("name")}
                disabled={!enableSorting}
              >
                Name
                {#if enableSorting}
                  {#if sortKey === "name"}
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
            <TableHead class="w-[240px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("clientId")}
                disabled={!enableSorting}
              >
                Client ID
                {#if enableSorting}
                  {#if sortKey === "clientId"}
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
            <TableHead class="w-[140px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("credentialType")}
                disabled={!enableSorting}
              >
                Credential
                {#if enableSorting}
                  {#if sortKey === "credentialType"}
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
            <TableHead class="w-[200px]">Key Vault</TableHead>
            <TableHead class="w-[160px]">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                onclick={() => toggleSort("lastUsedAt")}
                disabled={!enableSorting}
              >
                Last Used
                {#if enableSorting}
                  {#if sortKey === "lastUsedAt"}
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
            <TableHead class="w-[80px] text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#if filteredRows.length === 0}
            <TableRow>
              <TableCell colspan={enableSelection ? 8 : 7} class="p-0">
                <div class="flex items-center justify-center text-center text-sm text-muted-foreground border-t bg-muted/10 min-h-[200px] px-6 py-10">
                  <div class="flex flex-col items-center gap-3">
                    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                      <Cloud class="h-5 w-5" />
                    </div>
                    <div class="space-y-1">
                      <p class="text-base text-foreground/90">
                        {#if apps.length === 0}
                          No apps configured
                        {:else}
                          No apps match your filters
                        {/if}
                      </p>
                      <p class="text-sm text-muted-foreground">
                        {#if apps.length === 0}
                          Add your first Entra app registration to start issuing tokens.
                        {:else}
                          Adjust search or filters to find an app.
                        {/if}
                      </p>
                    </div>
                    {#if apps.length === 0 && onAdd}
                      <Button size="sm" class="gap-2 mt-2" onclick={onAdd}>
                        <Plus class="h-4 w-4" />
                        Add Your First App
                      </Button>
                    {/if}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          {:else}
            {#each filteredRows as row (row.app.id)}
              {@const isActive = row.app.id === activeAppId}
              <TableRow
                class={cn(
                  isActive ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent",
                  selectedIds.has(row.app.id) ? "bg-muted/60" : "",
                  "hover:bg-muted/50"
                )}
              >
                {#if enableSelection}
                  <TableCell class="align-middle pl-4">
                    <div class="flex justify-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.app.name}`}
                        class="h-4 w-4 rounded border-input bg-background text-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        checked={selectedIds.has(row.app.id)}
                        onchange={() => toggleRowSelection(row.app.id)}
                      />
                    </div>
                  </TableCell>
                {/if}
                <TableCell class="align-middle">
                  <div class="flex items-center gap-2">
                    <ColorDot
                      color={row.app.color || "#10b981"}
                      size={12}
                      ring={isActive}
                      title={row.app.color || "App color"}
                    />
                  </div>
                </TableCell>
                <TableCell class="align-middle">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-medium leading-tight truncate" title={row.app.name}>{row.app.name}</span>
                  </div>
                  {#if row.app.description}
                    <p class="text-xs text-muted-foreground truncate max-w-[260px]">{row.app.description}</p>
                  {/if}
                  {#if row.app.tags?.length}
                    <div class="mt-1 flex items-center gap-1">
                      {#each row.app.tags.slice(0, 2) as tag}
                        <Badge variant="outline" class="text-[10px] font-medium max-w-[100px] truncate bg-primary/5 border-primary/20 text-primary" title={tag}>{tag}</Badge>
                      {/each}
                      {#if row.app.tags.length > 2}
                        {@const remaining = row.app.tags.slice(2)}
                        <Tooltip.Root>
                          <Tooltip.Trigger>
                            <Badge variant="outline" class="text-[10px] font-normal h-5 px-1.5 cursor-help">+{remaining.length}</Badge>
                          </Tooltip.Trigger>
                          <Tooltip.Content>
                            <div class="flex flex-col gap-1">
                              {#each remaining as tag}
                                <span class="text-xs">{tag}</span>
                              {/each}
                            </div>
                          </Tooltip.Content>
                        </Tooltip.Root>
                      {/if}
                    </div>
                  {/if}
                </TableCell>
                <TableCell class="align-middle">
                  <code class="font-mono text-xs text-muted-foreground truncate block" title={row.app.clientId}>{row.app.clientId}</code>
                </TableCell>
                <TableCell class="align-middle">
                  <div class="flex flex-col gap-1 items-start">
                    <Badge variant="outline" class="gap-1.5 text-xs">
                      {#if row.app.keyVault.credentialType === "certificate"}
                        <Shield class="h-3 w-3" />
                        Certificate
                      {:else}
                        <KeyRound class="h-3 w-3" />
                        Secret
                      {/if}
                    </Badge>
                    <span class="text-xs text-muted-foreground truncate max-w-[140px]" title={row.app.keyVault.secretName || row.app.keyVault.certName}>
                      {row.app.keyVault.secretName || row.app.keyVault.certName}
                    </span>
                  </div>
                </TableCell>
                <TableCell class="align-middle">
                  <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Cloud class="h-3.5 w-3.5" />
                    <span class="truncate max-w-[160px]" title={row.app.keyVault.uri}>{row.vaultName}</span>
                  </div>
                </TableCell>
                <TableCell class="align-middle">
                  {#if row.lastUsedOn}
                    <div class="text-sm font-medium leading-tight">{row.lastUsedOn.toLocaleString()}</div>
                    <div class="text-xs text-muted-foreground">Used {row.lastUsedLabel}</div>
                  {:else}
                    <span class="text-sm text-muted-foreground">Never</span>
                  {/if}
                </TableCell>
                <TableCell class="align-middle text-right pr-4">
                  <AppsTableActions
                    app={row.app}
                    isActive={isActive}
                    onSwitch={onSwitch}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            {/each}
          {/if}
        </TableBody>
      </Table>
    </div>
    {#if showFooter}
      <div class="flex items-center gap-3 border-t px-4 py-3 text-muted-foreground">
        <Cloud class="h-4 w-4" />
        <span class="text-sm">
          {filteredRows.length} / {baseRows.length} app{baseRows.length !== 1 ? 's' : ''} configured
        </span>
        {#if enableSelection && selectedCount > 0}
          <span class="text-xs text-muted-foreground">• {selectedCount} selected</span>
        {/if}
      </div>
    {/if}
  </div>
</div>
