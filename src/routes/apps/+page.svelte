<script lang="ts">
  import { appRegistry, type CascadeDeleteResult } from "$lib/states/app-registry.svelte";
  import { historyState } from "$lib/states/history.svelte";
  import { favoritesState } from "$lib/states/favorites.svelte";
  import AppsTable from "$lib/components/apps-table.svelte";
  import AppFormDialog from "$lib/components/app-form-dialog.svelte";
  import { toast } from "svelte-sonner";
  import ConfirmDialog from "$lib/components/confirm-dialog.svelte";
  import type { AppConfig } from "$lib/types";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import entraIconUrl from "$lib/assets/microsoft-entra-color-icon.svg";
  import {
    Cloud,
    Plus,
    Shield,
    KeyRound,
    ArrowRight,
    Sparkles,
    Trash2,
    History,
    Star,
    Pin,
    AlertTriangle
  } from "@lucide/svelte";

  let dialogOpen = $state(false);
  let editingApp = $state<AppConfig | null>(null);

  // Confirmation state with structured cascade info
  let confirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmAction = $state<() => Promise<void>>(async () => {});
  let confirmBaseMessage = $state("");
  let cascadeInfo = $state<{
    historyCount: number;
    favoritesCount: number;
    pinnedCount: number;
  } | null>(null);

  interface CascadePreview {
    historyCount: number;
    favoritesCount: number;
    pinnedCount: number;
  }

  function getCascadePreview(appIds: string[]): CascadePreview {
    const appIdSet = new Set(appIds);
    const historyCount = historyState.items.filter(item => item.appId && appIdSet.has(item.appId)).length;
    const favoritesCount = favoritesState.items.filter(item => item.appId && appIdSet.has(item.appId)).length;
    const pinnedCount = favoritesState.items.filter(item => item.appId && appIdSet.has(item.appId) && item.isPinned).length;
    return { historyCount, favoritesCount, pinnedCount };
  }

  function openConfirmWithCascade(
    title: string, 
    baseMessage: string, 
    appIds: string[],
    action: () => Promise<void>
  ) {
    confirmTitle = title;
    confirmBaseMessage = baseMessage;
    cascadeInfo = getCascadePreview(appIds);
    confirmAction = action;
    confirmOpen = true;
  }

  const apps = $derived(appRegistry.apps);
  const activeAppId = $derived(appRegistry.activeAppId);
  const activeApp = $derived(appRegistry.activeApp);
  const hasApps = $derived(appRegistry.hasApps);
  const hasCascadeData = $derived(
    cascadeInfo && (cascadeInfo.historyCount > 0 || cascadeInfo.favoritesCount > 0)
  );

  function handleAdd() {
    editingApp = null;
    dialogOpen = true;
  }

  function handleEdit(app: AppConfig) {
    editingApp = app;
    dialogOpen = true;
  }

  async function handleSwitch(app: AppConfig) {
    try {
      await appRegistry.setActive(app.id);
      toast.success(`Switched to ${app.name}`);
    } catch (error) {
      toast.error('Failed to switch app');
    }
  }

  /**
   * Format cascade delete result for toast message.
   */
  function formatCascadeResult(result: CascadeDeleteResult): string {
    const parts: string[] = [];
    if (result.historyDeleted > 0) {
      parts.push(`${result.historyDeleted} history`);
    }
    if (result.favoritesDeleted > 0) {
      parts.push(`${result.favoritesDeleted} favorites`);
    }
    if (result.tokenCleared) {
      parts.push('live token');
    }
    
    if (parts.length === 0) return '';
    return ` — cleared ${parts.join(', ')}`;
  }

  async function handleDelete(app: AppConfig) {
    openConfirmWithCascade(
      `Delete "${app.name}"?`,
      "This app will be permanently removed.",
      [app.id],
      async () => {
        try {
          const result = await appRegistry.remove(app.id);
          toast.success(`Deleted ${app.name}${formatCascadeResult(result)}`);
        } catch (error) {
          toast.error('Failed to delete app');
        }
      }
    );
  }

  async function handleDeleteMany(selectedApps: AppConfig[]) {
    if (!selectedApps.length) return;

    const label = selectedApps.length === 1 ? "app" : "apps";
    const appIds = selectedApps.map((app) => app.id);
    
    openConfirmWithCascade(
      `Delete ${selectedApps.length} ${label}?`,
      `${selectedApps.length === 1 ? 'This app' : 'These apps'} will be permanently removed.`,
      appIds,
      async () => {
        try {
          const result = await appRegistry.removeMany(appIds);
          toast.success(`Deleted ${selectedApps.length} ${label}${formatCascadeResult(result)}`);
        } catch (error) {
          toast.error('Failed to delete apps');
        }
      }
    );
  }

  async function handleClearAll() {
    if (!apps.length) return;

    const allAppIds = apps.map(app => app.id);
    
    openConfirmWithCascade(
      'Delete all apps?',
      'All configured apps will be permanently removed.',
      allAppIds,
      async () => {
        try {
          const result = await appRegistry.clear();
          toast.success(`Deleted all apps${formatCascadeResult(result)}`);
        } catch (error) {
          console.error('Failed to clear apps', error);
          toast.error('Failed to clear apps');
        }
      }
    );
  }

  function handleDialogClose(open: boolean) {
    dialogOpen = open;
    if (!open) {
      editingApp = null;
    }
  }
</script>

<svelte:head>
  <title>Apps | Entra Token Studio</title>
</svelte:head>

  <AppFormDialog 
  bind:open={dialogOpen} 
  onOpenChange={handleDialogClose}
  editingApp={editingApp}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title={confirmTitle}
  onConfirm={confirmAction}
>
  {#snippet descriptionContent()}
    <div class="space-y-3">
      <p>{confirmBaseMessage}</p>
      
      {#if hasCascadeData}
        <div class="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium text-xs uppercase tracking-wide">
            <AlertTriangle class="h-3.5 w-3.5" />
            Connected data will also be removed
          </div>
          <ul class="space-y-1.5 text-sm">
            {#if cascadeInfo && cascadeInfo.historyCount > 0}
              <li class="flex items-center gap-2">
                <History class="h-4 w-4 text-muted-foreground" />
                <span>{cascadeInfo.historyCount} history {cascadeInfo.historyCount === 1 ? 'entry' : 'entries'}</span>
              </li>
            {/if}
            {#if cascadeInfo && cascadeInfo.favoritesCount > 0}
              <li class="flex items-center gap-2">
                <Star class="h-4 w-4 text-muted-foreground" />
                <span>
                  {cascadeInfo.favoritesCount} {cascadeInfo.favoritesCount === 1 ? 'favorite' : 'favorites'}
                  {#if cascadeInfo.pinnedCount > 0}
                    <span class="inline-flex items-center gap-1 ml-1 text-muted-foreground">
                      <Pin class="h-3 w-3" />
                      {cascadeInfo.pinnedCount} pinned
                    </span>
                  {/if}
                </span>
              </li>
            {/if}
          </ul>
        </div>
      {/if}
      
      <p class="text-xs text-muted-foreground">This action cannot be undone.</p>
    </div>
  {/snippet}
</ConfirmDialog>

<div class="flex flex-1 flex-col h-full">
  <div class="flex-1 space-y-4 p-4 pt-6 md:p-8">
    {#if !hasApps}
      <!-- Onboarding Experience for First-Time Users -->
      <div class="mx-auto max-w-2xl space-y-8 py-4">
        <div class="text-center space-y-4">
          <div class="flex justify-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted p-3">
              <img src={entraIconUrl} alt="Microsoft Entra logo" class="h-14 w-14" />
            </div>
          </div>
          <div>
            <h1 class="text-2xl font-bold">Welcome to Microsoft Entra Token Studio</h1>
            <p class="text-muted-foreground mt-2">
              Your secure workbench for Microsoft Entra tokens.
            </p>
          </div>
        </div>

        <!-- First-time User Flow -->
        <div class="rounded-xl border bg-card p-6 shadow-sm">
          <div class="space-y-6">
            <!-- What you'll need -->
            <div>
              <h2 class="text-lg font-semibold mb-3">What you'll need</h2>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                    <Shield class="h-4 w-4 text-blue-500" />
                  </div>
                  <div class="space-y-0.5">
                    <p class="font-medium text-sm">Entra App Registration</p>
                    <p class="text-xs text-muted-foreground">
                      Tenant ID and Client ID from your Entra app. See the
                      <a class="text-primary hover:underline" href="https://learn.microsoft.com/entra/identity-platform/quickstart-register-app" target="_blank" rel="noreferrer">registration quickstart</a>.
                    </p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
                    <Cloud class="h-4 w-4 text-emerald-500" />
                  </div>
                  <div class="space-y-0.5">
                    <p class="font-medium text-sm">Azure Key Vault</p>
                    <div class="text-xs text-muted-foreground space-y-1">
                      <p>Store your client secret or certificate here.</p>
                      <p>
                        Ensure you have RBAC roles such as
                        <span class="font-medium">Key Vault Secrets User</span> or <span class="font-medium">Key Vault Certificates User</span> (or higher). See role guidance in the
                        <a class="text-primary hover:underline" href="https://learn.microsoft.com/azure/key-vault/general/rbac-guide" target="_blank" rel="noreferrer">RBAC guide</a>
                        and the
                        <a class="text-primary hover:underline" href="https://learn.microsoft.com/azure/key-vault/general/rbac-migrate#built-in-roles" target="_blank" rel="noreferrer">built-in roles list</a>.
                      </p>
                      <p>
                        If you use legacy access policies, make sure secrets/certificates permissions are granted. More details in
                        <a class="text-primary hover:underline" href="https://learn.microsoft.com/azure/key-vault/general/secure-your-key-vault#access-policies" target="_blank" rel="noreferrer">Access policies</a>
                        and the broader
                        <a class="text-primary hover:underline" href="https://learn.microsoft.com/azure/key-vault/general/overview" target="_blank" rel="noreferrer">Key Vault docs</a>.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 shrink-0">
                    <KeyRound class="h-4 w-4 text-violet-500" />
                  </div>
                  <div class="space-y-0.5">
                    <p class="font-medium text-sm">Azure identity access</p>
                    <div class="text-xs text-muted-foreground space-y-1">
                      <p>
                        We use
                        <a class="text-primary hover:underline" href="https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential" target="_blank" rel="noreferrer">DefaultAzureCredential</a>,
                        so the app picks up whoever is signed in.
                      </p>
                      <p>
                        Sign in with Azure CLI (<code class="text-[10px] bg-muted px-1 rounded">az login</code>) or VS Code's Azure sign-in, then ensure that identity has read access to secrets/certificates in your Key Vault (via RBAC or access policies).
                      </p>
                      <p>
                        More help:
                        <a class="text-primary hover:underline" href="https://learn.microsoft.com/cli/azure/authenticate-azure-cli" target="_blank" rel="noreferrer">CLI authentication</a>
                        and
                        <a class="text-primary hover:underline" href="https://code.visualstudio.com/docs/azure/extensions#_azure-sign-in" target="_blank" rel="noreferrer">VS Code Azure sign-in</a>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <!-- Why Key Vault Only -->
            <div class="rounded-lg bg-muted/50 p-4 space-y-2">
              <div class="flex items-center gap-2">
                <Shield class="h-4 w-4 text-primary" />
                <span class="text-sm font-medium">Security-first design</span>
              </div>
              <p class="text-xs text-muted-foreground">
                Credentials are stored in Azure Key Vault—never on your local machine. 
                This provides enterprise-grade security with built-in audit logging.
              </p>
            </div>

            <!-- CTA -->
            <Button class="w-full gap-2" size="lg" onclick={handleAdd}>
              <Plus class="h-4 w-4" />
              Add Your First App
            </Button>
          </div>
        </div>
      </div>
    {:else}
      <!-- Header (when apps exist) -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Cloud class="h-5 w-5 text-primary" />
            </div>
            Apps
          </h1>
          <p class="text-muted-foreground mt-1">
            Manage your client applications for generating tokens to access other apps and resources.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            class="gap-2"
            onclick={handleClearAll}
            disabled={apps.length === 0}
          >
            <Trash2 class="h-4 w-4" />
            Delete All
          </Button>
        </div>
      </div>

      <!-- Playground Guidance Banner -->
      <a 
        href="/" 
        class="group flex items-center gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
      >
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-105">
          <Sparkles class="h-6 w-6 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-foreground">Ready to generate tokens!</h3>
            <Badge variant="secondary" class="text-[10px]">Next step</Badge>
          </div>
          <p class="text-sm text-muted-foreground mt-0.5">
            Head to the Playground to issue user tokens (delegated) or app tokens (daemon) using your configured apps.
          </p>
        </div>
        <div class="flex items-center gap-2 text-sm font-medium text-primary shrink-0">
          <span class="hidden sm:inline">Go to Playground</span>
          <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </a>

      <!-- Apps Table -->
      <div class="flex-1">
        <AppsTable
          apps={apps}
          activeAppId={activeAppId}
          onAdd={handleAdd}
          onSwitch={handleSwitch}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeleteMany={handleDeleteMany}
        />
      </div>
    {/if}
  </div>
</div>
