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
  import SetupStep from "$lib/components/setup/setup-step.svelte";
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
    AlertTriangle,
    CheckCheck
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
      `Disconnect "${app.name}"?`,
      "This app connection will be permanently removed.",
      [app.id],
      async () => {
        try {
          const result = await appRegistry.remove(app.id);
          toast.success(`Disconnected ${app.name}${formatCascadeResult(result)}`);
        } catch (error) {
          toast.error('Failed to disconnect app');
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
          toast.success(`Disconnected ${selectedApps.length} ${label}${formatCascadeResult(result)}`);
        } catch (error) {
          toast.error('Failed to disconnect apps');
        }
      }
    );
  }

  async function handleClearAll() {
    if (!apps.length) return;

    const allAppIds = apps.map(app => app.id);
    
    openConfirmWithCascade(
      'Disconnect all apps?',
      'All configured app connections will be permanently removed.',
      allAppIds,
      async () => {
        try {
          const result = await appRegistry.clear();
          toast.success(`Disconnected all apps${formatCascadeResult(result)}`);
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
      <div class="mx-auto max-w-3xl space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <!-- Hero Section -->
        <div class="text-center space-y-6">
          <!-- Animated Logo -->
          <div class="flex justify-center">
            <div class="relative">
              <div class="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-emerald-500/20 rounded-3xl blur-2xl animate-pulse"></div>
              <div class="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-card via-card to-muted border border-border/50 shadow-xl">
                <img src={entraIconUrl} alt="Microsoft Entra logo" class="h-14 w-14" />
              </div>
            </div>
          </div>
          
          <!-- Headline with gradient -->
          <div class="space-y-4">
            <h1 class="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
              Welcome to Entra Token Studio
            </h1>
            <p class="text-lg text-muted-foreground max-w-xl mx-auto">
              Your secure workbench for issuing, inspecting, and managing Microsoft Entra tokens
            </p>
            <div class="flex justify-center gap-2 pt-1">
              <Badge variant="secondary" class="text-xs gap-1">
                <Sparkles class="h-3 w-3" />
                For Developers
              </Badge>
              <Badge variant="outline" class="text-xs gap-1">
                <Shield class="h-3 w-3" />
                Key Vault Secured
              </Badge>
            </div>
          </div>
        </div>

        <!-- What You Can Do Section -->
        <div class="space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-center">What you can do</h2>
          <div class="grid grid-cols-2 gap-3 sm:gap-4">
            <div class="group rounded-xl border bg-card/50 p-5 transition-all hover:bg-card hover:shadow-md hover:border-blue-500/30 hover:-translate-y-0.5">
              <div class="flex items-start gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <KeyRound class="h-5 w-5 text-blue-500" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-medium text-sm">User Tokens</h3>
                  <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">Delegated flows for apps acting on behalf of users</p>
                </div>
              </div>
            </div>
            <div class="group rounded-xl border bg-card/50 p-5 transition-all hover:bg-card hover:shadow-md hover:border-violet-500/30 hover:-translate-y-0.5">
              <div class="flex items-start gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                  <Cloud class="h-5 w-5 text-violet-500" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-medium text-sm">App Tokens</h3>
                  <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">Daemon flows for services acting as themselves</p>
                </div>
              </div>
            </div>
            <div class="group rounded-xl border bg-card/50 p-5 transition-all hover:bg-card hover:shadow-md hover:border-emerald-500/30 hover:-translate-y-0.5">
              <div class="flex items-start gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <Sparkles class="h-5 w-5 text-emerald-500" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-medium text-sm">Inspect Claims</h3>
                  <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">Decode and analyze token contents in detail</p>
                </div>
              </div>
            </div>
            <div class="group rounded-xl border bg-card/50 p-5 transition-all hover:bg-card hover:shadow-md hover:border-amber-500/30 hover:-translate-y-0.5">
              <div class="flex items-start gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                  <Star class="h-5 w-5 text-amber-500" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-medium text-sm">Save Favorites</h3>
                  <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">Quick access to your common configurations</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Getting Started Prerequisites -->
        <div class="rounded-2xl border bg-gradient-to-b from-card to-card/50 p-6 shadow-sm space-y-5">
          <div class="text-center space-y-1">
            <h2 class="text-lg font-semibold">Get Started in 3 Steps</h2>
            <p class="text-sm text-muted-foreground">Here's what you need to configure your first app</p>
          </div>
          
          <div class="space-y-3">
            <!-- Step 1: App Registration -->
            <SetupStep 
              step={1} 
              title="Register an Entra Application" 
              status="pending"
              description="Get your Tenant ID and Client ID"
              collapsible={true}
              defaultOpen={false}
            >
              <div class="space-y-4 text-sm">
                <p class="text-muted-foreground">
                  Create an application registration in Azure Entra ID. This gives you the identifiers needed to request tokens.
                </p>
                
                <!-- What you'll get -->
                <div class="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p class="text-xs font-medium text-foreground">You'll need these from your app registration:</p>
                  <ul class="text-xs text-muted-foreground space-y-1.5">
                    <li class="flex items-start gap-2">
                      <CheckCheck class="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                      <span><span class="font-medium text-foreground">Tenant ID</span> — Found on the app's Overview page</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <CheckCheck class="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                      <span><span class="font-medium text-foreground">Client ID</span> — Also called Application ID, on Overview</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <CheckCheck class="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                      <span><span class="font-medium text-foreground">Redirect URI</span> — Add <code class="text-[10px] bg-muted px-1 rounded">http://localhost:5173/auth/callback</code> under Authentication</span>
                    </li>
                  </ul>
                </div>

                <!-- Tip -->
                <div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <p class="text-xs text-muted-foreground">
                    <span class="font-medium text-blue-600 dark:text-blue-400">Tip:</span> For user token flows (delegated), you'll also need to configure API permissions under "API Permissions". For app token flows (daemon), just the client credentials are needed.
                  </p>
                </div>
                
                <div class="flex flex-wrap gap-2">
                  <a 
                    href="https://learn.microsoft.com/entra/identity-platform/quickstart-register-app" 
                    target="_blank" 
                    rel="noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    <ArrowRight class="h-3 w-3" />
                    Registration Quickstart
                  </a>
                  <a 
                    href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" 
                    target="_blank" 
                    rel="noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    Open Azure Portal
                  </a>
                </div>
              </div>
            </SetupStep>

            <!-- Step 2: Key Vault -->
            <SetupStep 
              step={2} 
              title="Set Up Azure Key Vault" 
              status="pending"
              description="Securely store your client secret or certificate"
              collapsible={true}
              defaultOpen={false}
            >
              <div class="space-y-4 text-sm">
                <p class="text-muted-foreground">
                  Store your app's client credentials in Azure Key Vault. This app fetches credentials at runtime—nothing is stored locally.
                </p>
                
                <!-- Credential types -->
                <div class="grid gap-2 sm:grid-cols-2">
                  <div class="rounded-lg border bg-card/50 p-3 space-y-1">
                    <p class="text-xs font-medium text-foreground">Client Secret</p>
                    <p class="text-[11px] text-muted-foreground">Store the secret value (not the ID) as a Key Vault secret. Easier to set up.</p>
                  </div>
                  <div class="rounded-lg border bg-card/50 p-3 space-y-1">
                    <p class="text-xs font-medium text-foreground">Certificate</p>
                    <p class="text-[11px] text-muted-foreground">Upload a .pfx certificate to Key Vault. More secure, recommended for production.</p>
                  </div>
                </div>

                <!-- Required roles -->
                <div class="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p class="text-xs font-medium text-foreground">Your Azure identity needs one of these Key Vault roles:</p>
                  <ul class="text-xs text-muted-foreground space-y-1">
                    <li class="flex items-center gap-2">
                      <CheckCheck class="h-3 w-3 text-emerald-500" />
                      <span><span class="font-medium text-foreground">Key Vault Secrets User</span> — for reading client secrets</span>
                    </li>
                    <li class="flex items-center gap-2">
                      <CheckCheck class="h-3 w-3 text-emerald-500" />
                      <span><span class="font-medium text-foreground">Key Vault Certificates User</span> — for reading certificates (also needs Secrets User)</span>
                    </li>
                  </ul>
                </div>

                <!-- Note -->
                <div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p class="text-xs text-muted-foreground">
                    <span class="font-medium text-amber-600 dark:text-amber-400">Note:</span> If using legacy access policies instead of RBAC, ensure "Get" permission is granted for secrets/certificates.
                  </p>
                </div>
                
                <div class="flex flex-wrap gap-2">
                  <a 
                    href="https://learn.microsoft.com/azure/key-vault/general/rbac-guide" 
                    target="_blank" 
                    rel="noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <ArrowRight class="h-3 w-3" />
                    RBAC Guide
                  </a>
                  <a 
                    href="https://learn.microsoft.com/azure/key-vault/general/overview" 
                    target="_blank" 
                    rel="noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    Key Vault Docs
                  </a>
                </div>
              </div>
            </SetupStep>

            <!-- Step 3: Azure Identity -->
            <SetupStep 
              step={3} 
              title="Sign In to Azure" 
              status="pending"
              description="Authenticate via CLI or VS Code"
              collapsible={true}
              defaultOpen={false}
            >
              <div class="space-y-4 text-sm">
                <p class="text-muted-foreground">
                  This app runs locally and uses your Azure identity to fetch credentials from Key Vault. Sign in so the app can authenticate on your behalf.
                </p>

                <!-- Why this is needed -->
                <div class="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                  <p class="text-xs text-muted-foreground">
                    <span class="font-medium text-violet-600 dark:text-violet-400">How it works:</span> The app uses <code class="text-[10px] bg-muted px-1 rounded">DefaultAzureCredential</code> which automatically picks up your signed-in identity from CLI, VS Code, or other Azure tools.
                  </p>
                </div>
                
                <div class="grid gap-2 sm:grid-cols-2">
                  <div class="rounded-lg border bg-card/50 p-3 space-y-2">
                    <p class="text-xs font-medium text-foreground">Option 1: Azure CLI</p>
                    <code class="text-[11px] bg-muted px-2 py-1 rounded block font-mono text-muted-foreground">az login</code>
                    <p class="text-[10px] text-muted-foreground">Best for terminal users. Opens browser to authenticate.</p>
                  </div>
                  <div class="rounded-lg border bg-card/50 p-3 space-y-2">
                    <p class="text-xs font-medium text-foreground">Option 2: VS Code</p>
                    <p class="text-[11px] text-muted-foreground">Install "Azure Account" extension, then use Command Palette → "Azure: Sign In"</p>
                    <p class="text-[10px] text-muted-foreground">Convenient if you use VS Code.</p>
                  </div>
                </div>

                <!-- Verification tip -->
                <div class="rounded-lg bg-muted/50 p-3">
                  <p class="text-xs text-muted-foreground">
                    <span class="font-medium text-foreground">Verify your sign-in:</span> Run <code class="text-[10px] bg-muted px-1 rounded">az account show</code> to confirm which account is active.
                  </p>
                </div>
                
                <div class="flex flex-wrap gap-2">
                  <a 
                    href="https://learn.microsoft.com/cli/azure/authenticate-azure-cli" 
                    target="_blank" 
                    rel="noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                  >
                    <ArrowRight class="h-3 w-3" />
                    CLI Auth Guide
                  </a>
                  <a 
                    href="https://code.visualstudio.com/docs/azure/extensions#_azure-sign-in" 
                    target="_blank" 
                    rel="noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    VS Code Sign-In
                  </a>
                </div>
              </div>
            </SetupStep>
          </div>
        </div>

        <!-- Security Callout -->
        <div class="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 p-5">
          <div class="flex items-start gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Shield class="h-6 w-6 text-emerald-500" />
            </div>
            <div class="flex-1 space-y-3">
              <div>
                <h3 class="font-semibold text-foreground">Security-First Architecture</h3>
                <p class="text-sm text-muted-foreground mt-1">
                  Credentials are never stored locally — only accessed from Azure Key Vault at runtime.
                </p>
              </div>
              <div class="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCheck class="h-3.5 w-3.5" />
                  Zero local secrets
                </span>
                <span class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCheck class="h-3.5 w-3.5" />
                  Enterprise audit logging
                </span>
                <span class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCheck class="h-3.5 w-3.5" />
                  RBAC access control
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- CTA Section -->
        <div class="space-y-4">
          <Button 
            class="w-full h-14 text-base gap-3 bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300" 
            size="lg" 
            onclick={handleAdd}
          >
            <Plus class="h-5 w-5" />
            Connect Your First Client App
            <ArrowRight class="h-4 w-4 ml-1" />
          </Button>
          <p class="text-center text-xs text-muted-foreground">
            Need help? Check the 
            <a 
              href="https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow" 
              target="_blank" 
              rel="noreferrer"
              class="text-primary hover:underline"
            >
              OAuth 2.0 documentation
            </a>
            for detailed guidance.
          </p>
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
            Disconnect All
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
