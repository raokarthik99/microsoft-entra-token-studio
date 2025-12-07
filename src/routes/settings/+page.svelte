<script lang="ts">
  import * as Card from "$lib/shadcn/components/ui/card";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Trash2, LogOut, User, ShieldAlert } from "@lucide/svelte";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { toast } from "svelte-sonner";

  import { auth, authServiceStore } from '$lib/stores/auth';
import { identityPreference } from '$lib/states/identity.svelte';
import { appRegistry } from '$lib/states/app-registry.svelte';
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/shadcn/components/ui/avatar";
  import { clientStorage } from '$lib/services/client-storage';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import { historyState } from '$lib/states/history.svelte';
  import { dataExportService } from '$lib/services/data-export';
  import type { ImportPreview } from '$lib/types';
  import { Loader2, Download, Upload, FileJson, Clock3, Star } from "@lucide/svelte";
  import ConfirmDialog from "$lib/components/confirm-dialog.svelte";
  import { Cloud, LayoutGrid, Settings2, AlertTriangle } from "@lucide/svelte";

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // Import/Export State
  let isExporting = $state(false);
  let isImporting = $state(false);

  let importPreview = $state<ImportPreview | null>(null);

  // Export confirmation state
  let exportConfirmOpen = $state(false);
  let exportAck1 = $state(false); // Tokens are sensitive
  let exportAck2 = $state(false); // Delete after import
  let exportAck3 = $state(false); // Never share tokens

  const canExport = $derived(exportAck1 && exportAck2 && exportAck3);

  function resetExportAcknowledgments() {
    exportAck1 = false;
    exportAck2 = false;
    exportAck3 = false;
  }

  // Confirmation state
  let confirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmDescription = $state("");
  let confirmAction = $state<() => Promise<void>>(async () => {});

  // Delete all data state with detailed preview
  let deleteDataConfirmOpen = $state(false);
  
  // Derive counts for the delete confirmation
  const deletePreviewCounts = $derived({
    historyCount: historyState.items.length,
    favoritesCount: favoritesState.items.length,
    pinnedCount: favoritesState.items.filter(f => f.isPinned).length,
    appsCount: appRegistry.apps.length,
    activeAppName: appRegistry.activeApp?.name ?? null,
    isAuthenticated: $auth.isAuthenticated,
    userName: $auth.user?.username ?? null
  });

  const hasAnyData = $derived(
    deletePreviewCounts.historyCount > 0 ||
    deletePreviewCounts.favoritesCount > 0 ||
    deletePreviewCounts.appsCount > 0 ||
    deletePreviewCounts.isAuthenticated
  );

  function handleExport() {
    // Reset acknowledgments and open the confirmation dialog
    resetExportAcknowledgments();
    exportConfirmOpen = true;
  }

  async function performExport() {
    isExporting = true;
    try {
      const data = await dataExportService.exportAllData();
      dataExportService.downloadAsJson(data);
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      isExporting = false;
    }
  }

  function resetFileInput() {
    const input = document.getElementById('import-file') as HTMLInputElement;
    if (input) input.value = '';
  }

  async function handleFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // simplistic size check for UX (just warn in console for now, logic is robust)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Large file detected. This may take a moment.');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      importPreview = dataExportService.parseImportFile(content);
      
      if (!importPreview.isValid) {
        toast.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!importPreview) return;
    
    isImporting = true;
    const input = document.getElementById('import-file') as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      isImporting = false;
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await dataExportService.importData(content);
        
        // Reload all states
        historyState.items = []; // It will auto-reload on mount often, but good to clear
        favoritesState.items = [];
        await identityPreference.reset(); // or reload preferences

        toast.success('Data imported successfully');
        
        // Reload page to ensure all stores/services pick up fresh data
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        toast.error('Failed to import data');
        isImporting = false;
      }
    };
    reader.readAsText(file);
  }

  async function clearAllData() {
    deleteDataConfirmOpen = true;
  }

  async function handleDeleteAllConfirm() {
    // Clear MSAL cached accounts (sign out)
    const service = $authServiceStore;
    if (service) {
      service.clearCachedAccounts();
    }
    auth.reset();

    // Clear app storage
    await clientStorage.clearAll();
    historyState.items = [];
    favoritesState.items = [];
    await identityPreference.reset();
    await appRegistry.clear();
    window.location.reload();
  }

  function clearCachedIdentity() {
    confirmTitle = 'Clear cached identity?';
    confirmDescription = 'This will sign you out and clear cached identity. You will need to sign in again.';
    confirmAction = async () => {
      const service = $authServiceStore;
      if (service) {
        service.clearCachedAccounts();
        toast.success('Cached identity cleared');
      }
    };
    confirmOpen = true;
  }

  async function handleIdentityPreferenceChange(value: string) {
    await identityPreference.setMode(value as 'use_last' | 'always_ask');
    toast.success('Identity preference saved');
  }

  const identityPreferenceLabel = $derived(
    identityPreference.mode === 'use_last' ? 'Always use last account' : 'Ask me each time'
  );

  // Get the app used for sign-in
  const signedInApp = $derived(
    $auth.signedInAppId ? appRegistry.getById($auth.signedInAppId) : null
  );
</script>

<svelte:head>
  <title>Settings | Entra Token Client</title>
</svelte:head>

<div class="space-y-10">

  <div class="grid gap-6 lg:grid-cols-2">
    <Card.Root class="border bg-card/70 lg:col-span-2">
      <Card.Header class="pb-2">
        <Card.Title>Profile</Card.Title>
        <Card.Description>Your authenticated session details.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        {#if $auth.isAuthenticated}
          <div class="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
            <Avatar class="h-16 w-16 border border-border/50">
              <AvatarImage src={$auth.photoUrl || ""} alt={$auth.user?.name} />
              <AvatarFallback class="bg-primary/10 text-xl text-primary font-medium">
                {getInitials($auth.user?.name || 'User')}
              </AvatarFallback>
            </Avatar>
            <div class="space-y-1.5">
              <h3 class="text-lg font-semibold">{$auth.user?.name}</h3>
              <p class="text-sm text-muted-foreground">{$auth.user?.username}</p>
              <div class="flex flex-col gap-1 text-xs text-muted-foreground">
                <span class="font-mono">Tenant ID: {$auth.user?.tenantId}</span>
                <span class="font-mono">Object ID: {$auth.user?.localAccountId}</span>
                {#if signedInApp}
                  <div class="flex items-center gap-1.5 pt-0.5">
                    <span class="h-2 w-2 rounded-full" style="background-color: {signedInApp.color}"></span>
                    <span>
                      Signed in via:
                      <span class="font-medium text-foreground">{signedInApp.name}</span>
                      <span class="font-mono text-xs text-muted-foreground">({signedInApp.clientId})</span>
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {:else}
          <div class="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User class="h-8 w-8 text-muted-foreground" />
            </div>
            <div class="space-y-1">
              <h3 class="text-lg font-semibold text-muted-foreground">Not signed in</h3>
              <p class="text-sm text-muted-foreground">Sign in via the header or when issuing user tokens.</p>
            </div>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root class="border bg-card/70 lg:col-span-2">
      <Card.Header class="pb-2">
        <Card.Title>Identity & Authentication</Card.Title>
        <Card.Description>Control how the app handles sign-in for user tokens.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div class="space-y-1">
            <Label>Identity behavior</Label>
            <p class="text-sm text-muted-foreground">Choose how the app selects identity when issuing user tokens.</p>
          </div>
          <Select.Root type="single" value={identityPreference.mode} onValueChange={handleIdentityPreferenceChange}>
            <Select.Trigger class="w-[200px]">
              {identityPreferenceLabel}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="use_last">Always use last account</Select.Item>
              <Select.Item value="always_ask">Ask me each time</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        {#if $auth.isAuthenticated}
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div class="space-y-1">
              <Label>Clear cached identity</Label>
              <p class="text-sm text-muted-foreground">Sign out and remove cached account from this browser.</p>
            </div>
            <Button variant="outline" onclick={clearCachedIdentity} class="gap-2">
              <LogOut class="h-4 w-4" />
              Clear identity
            </Button>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root class="border bg-card/70">
      <Card.Header class="pb-2">
        <Card.Title>Appearance</Card.Title>
        <Card.Description>Choose the theme that matches your environment.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div class="space-y-1">
            <Label>Theme</Label>
            <p class="text-sm text-muted-foreground">Apply light, dark, or follow system preference.</p>
          </div>
          <Select.Root type="single" value={userPrefersMode.current} onValueChange={(v) => setMode(v as "light" | "dark" | "system")}>
            <Select.Trigger class="w-[180px]">
              {userPrefersMode.current === "light" ? "Light" : userPrefersMode.current === "dark" ? "Dark" : "System"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="light">Light</Select.Item>
              <Select.Item value="dark">Dark</Select.Item>
              <Select.Item value="system">System</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      </Card.Content>
    </Card.Root>



    <Card.Root class="border bg-card/70 lg:col-span-2">
      <Card.Header class="pb-2">
        <Card.Title>Data management</Card.Title>
        <Card.Description>Manage your local data.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Import/Export Section -->
        <div class="rounded-xl border bg-muted/30 p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="space-y-1">
              <Label>Import / Export</Label>
              <p class="text-sm text-muted-foreground">Backup your history, favorites, and preferences, or restore from a file.</p>
            </div>
          </div>
          
          <div class="flex flex-wrap gap-4">
            <Button variant="outline" class="gap-2" onclick={handleExport} disabled={isExporting}>
              {#if isExporting}
                <Loader2 class="h-4 w-4 animate-spin" />
                Exporting...
              {:else}
                <Download class="h-4 w-4" />
                Export data
              {/if}
            </Button>
            
            <div class="relative">
              <input 
                type="file" 
                id="import-file" 
                accept=".json" 
                class="absolute inset-0 cursor-pointer opacity-0"
                onchange={handleFileSelect}
                disabled={isImporting}
              />
              <Button variant="outline" class="gap-2" disabled={isImporting}>
                {#if isImporting}
                  <Loader2 class="h-4 w-4 animate-spin" />
                  Importing...
                {:else}
                  <Upload class="h-4 w-4" />
                  Import data
                {/if}
              </Button>
            </div>
          </div>

          {#if importPreview}
            <div class="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2">
              <div class="flex items-start gap-3">
                <div class="rounded-full bg-primary/10 p-2 text-primary">
                  <FileJson class="h-5 w-5" />
                </div>
                <div class="space-y-1 flex-1">
                  <h4 class="font-medium text-foreground">Ready to import</h4>
                  <p class="text-xs text-muted-foreground">
                    Backup from {new Date(importPreview.exportedAt).toLocaleDateString()} at {new Date(importPreview.exportedAt).toLocaleTimeString()}
                  </p>
                  
                  <div class="mt-3 flex gap-4 text-sm">
                    <div class="flex items-center gap-1.5">
                      <Clock3 class="h-3.5 w-3.5 text-muted-foreground" />
                      <span class="font-medium">{importPreview.counts.token_history || 0}</span> History
                    </div>
                    <div class="flex items-center gap-1.5">
                      <Star class="h-3.5 w-3.5 text-muted-foreground" />
                      <span class="font-medium">{importPreview.counts.token_favorites || 0}</span> Favorites
                    </div>
                  </div>

                  {#if importPreview.errors?.length}
                    <div class="mt-2 text-xs text-destructive">
                      Error: {importPreview.errors.join(', ')}
                    </div>
                  {/if}

                  <div class="mt-4 flex items-center gap-3">
                    <Button size="sm" onclick={confirmImport} disabled={isImporting}>
                      {#if isImporting}
                        <Loader2 class="h-3.5 w-3.5 animate-spin mr-2" />
                        Restoring...
                      {:else}
                        Replace current data
                      {/if}
                    </Button>
                    <Button variant="ghost" size="sm" onclick={() => { importPreview = null; resetFileInput(); }} disabled={isImporting}>
                      Cancel
                    </Button>
                  </div>
                  <p class="mt-2 text-[10px] text-muted-foreground">
                    <span class="font-medium text-destructive">Warning:</span> This will delete all current data and replace it with the backup.
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
          <div class="space-y-1">
            <Label>Delete data</Label>
            <p class="text-sm text-muted-foreground">Remove history, saved preferences, and sign out from this browser.</p>
          </div>
          <Button variant="destructive" onclick={clearAllData} class="gap-2">
            <Trash2 class="h-4 w-4" />
            Delete All
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
  
  <ConfirmDialog
    bind:open={confirmOpen}
    title={confirmTitle}
    description={confirmDescription}
    onConfirm={confirmAction}
  />
  
  <!-- Delete All Data Confirmation with Detailed Preview -->
  <ConfirmDialog
    bind:open={deleteDataConfirmOpen}
    title="Delete all data?"
    confirmText="Delete All"
    onConfirm={handleDeleteAllConfirm}
  >
    {#snippet descriptionContent()}
      <div class="space-y-4">
        <p>This will permanently delete all local data and sign you out of this browser.</p>
        
        {#if hasAnyData}
          <div class="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-3">
            <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium text-xs uppercase tracking-wide">
              <AlertTriangle class="h-3.5 w-3.5" />
              The following will be removed
            </div>
            <ul class="space-y-2 text-sm">
              {#if deletePreviewCounts.historyCount > 0}
                <li class="flex items-center gap-2">
                  <Clock3 class="h-4 w-4 text-muted-foreground" />
                  <span>
                    <span class="font-medium">{deletePreviewCounts.historyCount}</span>
                    history {deletePreviewCounts.historyCount === 1 ? 'entry' : 'entries'}
                  </span>
                </li>
              {/if}
              {#if deletePreviewCounts.favoritesCount > 0}
                <li class="flex items-center gap-2">
                  <Star class="h-4 w-4 text-muted-foreground" />
                  <span>
                    <span class="font-medium">{deletePreviewCounts.favoritesCount}</span>
                    {deletePreviewCounts.favoritesCount === 1 ? 'favorite' : 'favorites'}
                    {#if deletePreviewCounts.pinnedCount > 0}
                      <span class="text-muted-foreground">({deletePreviewCounts.pinnedCount} pinned)</span>
                    {/if}
                  </span>
                </li>
              {/if}
              {#if deletePreviewCounts.appsCount > 0}
                <li class="flex items-center gap-2">
                  <Cloud class="h-4 w-4 text-muted-foreground" />
                  <span>
                    <span class="font-medium">{deletePreviewCounts.appsCount}</span>
                    connected client {deletePreviewCounts.appsCount === 1 ? 'app' : 'apps'}
                  </span>
                </li>
              {/if}
              {#if deletePreviewCounts.isAuthenticated}
                <li class="flex items-center gap-2">
                  <User class="h-4 w-4 text-muted-foreground" />
                  <span>
                    Signed-in session
                    {#if deletePreviewCounts.userName}
                      <span class="text-muted-foreground">({deletePreviewCounts.userName})</span>
                    {/if}
                  </span>
                </li>
              {/if}
            </ul>
            <div class="pt-1 border-t border-amber-500/20">
              <p class="text-xs text-muted-foreground flex items-center gap-1.5">
                <Settings2 class="h-3 w-3" />
                Theme preferences and other settings will also be reset
              </p>
            </div>
          </div>
        {:else}
          <div class="rounded-md border bg-muted/30 p-3">
            <p class="text-sm text-muted-foreground">No data to delete. This will reset preferences and sign you out.</p>
          </div>
        {/if}
        
        <p class="text-xs text-muted-foreground">This action cannot be undone.</p>
      </div>
    {/snippet}
  </ConfirmDialog>

  <!-- Export Data Security Acknowledgment Dialog -->
  <ConfirmDialog
    bind:open={exportConfirmOpen}
    title="Security Notice: Export Data"
    confirmText={isExporting ? 'Exporting...' : 'Export Data'}
    destructive={false}
    onConfirm={performExport}
    confirmDisabled={!canExport}
  >
    {#snippet descriptionContent()}
      <div class="space-y-4">
        <div class="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <div class="flex items-start gap-2">
            <ShieldAlert class="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p class="text-sm text-amber-600 dark:text-amber-400">
              The exported file will contain sensitive tokens. Please read and acknowledge the following before proceeding.
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={exportAck1}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I understand the exported file contains <strong>sensitive access tokens</strong>. Even though they are short-lived, they can still be used to access resources until they expire.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={exportAck2}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I will <strong>delete the exported file immediately</strong> after importing it into a new device or browser.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={exportAck3}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I will <strong>never share this file</strong> with others. Tokens are personal to my identity and should not be shared, even with trusted developers.
            </span>
          </label>
        </div>

        {#if !canExport}
          <p class="text-xs text-muted-foreground">
            Please acknowledge all items above to proceed with the export.
          </p>
        {/if}
      </div>
    {/snippet}
  </ConfirmDialog>
</div>
