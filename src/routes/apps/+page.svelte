<script lang="ts">
  import { appRegistry } from "$lib/states/app-registry.svelte";
  import AppsTable from "$lib/components/apps-table.svelte";
  import AppFormDialog from "$lib/components/app-form-dialog.svelte";
  import { toast } from "svelte-sonner";
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
    ExternalLink,
    Rocket,
    CheckCircle2
  } from "@lucide/svelte";

  let dialogOpen = $state(false);
  let editingApp = $state<AppConfig | null>(null);

  const apps = $derived(appRegistry.apps);
  const activeAppId = $derived(appRegistry.activeAppId);
  const activeApp = $derived(appRegistry.activeApp);
  const hasApps = $derived(appRegistry.hasApps);

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

  async function handleDelete(app: AppConfig) {
    // Simple confirmation via native dialog for now
    if (!confirm(`Delete "${app.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await appRegistry.remove(app.id);
      toast.success(`Deleted ${app.name}`);
    } catch (error) {
      toast.error('Failed to delete app');
    }
  }

  async function handleDeleteMany(selectedApps: AppConfig[]) {
    if (!selectedApps.length) return;

    const list = selectedApps.map((app) => `• ${app.name}`).join("\n");
    const label = selectedApps.length === 1 ? "app" : "apps";
    const confirmed = confirm(`Delete ${selectedApps.length} ${label}?\n\n${list}`);

    if (!confirmed) return;

    try {
      await appRegistry.removeMany(selectedApps.map((app) => app.id));
      toast.success(`Deleted ${selectedApps.length} ${label}`);
    } catch (error) {
      toast.error('Failed to delete apps');
    }
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

<div class="flex flex-1 flex-col h-full">
  <div class="flex-1 space-y-4 p-4 pt-6 md:p-8">
    {#if !hasApps}
      <!-- Onboarding Experience for First-Time Users -->
      <div class="mx-auto max-w-2xl space-y-8 py-4">
        <!-- Hero Section -->
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
      <div class="flex items-center justify-between">
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
      </div>

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
