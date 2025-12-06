<script lang="ts">
  import * as Tooltip from '$lib/shadcn/components/ui/tooltip';
  import { Button } from '$lib/shadcn/components/ui/button';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import { Input } from '$lib/shadcn/components/ui/input';
  import { Label } from '$lib/shadcn/components/ui/label';
  import { appRegistry } from '$lib/states/app-registry.svelte';
  import type { AppConfig, KeyVaultConfig } from '$lib/types';
  import { toast } from 'svelte-sonner';
  import * as Collapsible from '$lib/shadcn/components/ui/collapsible';
  import FormSheetLayout from '$lib/components/FormSheetLayout.svelte';
  import { 
    Loader2, KeyRound, Shield, Cloud, 
    CheckCircle2, XCircle, Info, ExternalLink,
    LayoutGrid, ChevronDown
  } from '@lucide/svelte';
  import { tick } from 'svelte';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    editingApp?: AppConfig | null;
    onSave?: (app: AppConfig) => void;
  }

  let { 
    open = $bindable(false), 
    onOpenChange,
    editingApp = null,
    onSave
  }: Props = $props();

  // Form state
  let validating = $state(false);
  let error = $state<string | null>(null);

  // Form fields
  let name = $state('');
  let clientId = $state('');
  let tenantId = $state('');
  // Redirect URI is strictly derived from window.location
  let keyVaultUri = $state('');
  let credentialType = $state<'secret' | 'certificate'>('certificate');
  let secretName = $state('');
  let certName = $state('');

  // Colors for app badges
  const appColors = [
    '#10b981', // emerald
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ef4444', // red
    '#06b6d4', // cyan
  ];
  let selectedColor = $state(appColors[0]);
  let tagsInput = $state('');
  let description = $state('');
  let metaOpen = $state(false);
  let nameInput: HTMLInputElement | null = null;
  const formId = 'app-form';
  const sectionCardClass = 'rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm shadow-black/5 space-y-5';
  const redirectUri = $derived(typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback');

  const isEditing = $derived(!!editingApp);
  const dialogTitle = $derived(isEditing ? 'Edit App Connection' : 'Add App Connection');
  const submitLabel = $derived(validating ? 'Validating & Saving...' : isEditing ? 'Save Changes' : 'Validate & Save Connection');

  const isFormValid = $derived(
    name.trim() && 
    clientId.trim() && 
    tenantId.trim() && 
    keyVaultUri.trim() &&
    (credentialType === 'secret' ? secretName.trim() : certName.trim())
  );

  // Populate form when editing
  $effect(() => {
    if (editingApp) {
      name = editingApp.name;
      clientId = editingApp.clientId;
      tenantId = editingApp.tenantId;
      keyVaultUri = editingApp.keyVault.uri;
      credentialType = editingApp.keyVault.credentialType;
      secretName = editingApp.keyVault.secretName || '';
      certName = editingApp.keyVault.certName || '';
      selectedColor = editingApp.color || appColors[0];
      tagsInput = (editingApp.tags || []).join(', ');
      description = editingApp.description || '';
      error = null;
    }
  });

  // Reset form when dialog closes
  $effect(() => {
    if (!open) {
      resetForm();
    }
  });

  // Ensure focus lands on the name field when the sheet opens, so the tooltip trigger isn't focused.
  $effect(() => {
    if (open && nameInput) {
      tick().then(() => nameInput?.focus({ preventScroll: true }));
    }
  });

  function resetForm() {
    name = '';
    clientId = '';
    tenantId = '';
    keyVaultUri = '';
    credentialType = 'certificate';
    secretName = '';
    certName = '';
    selectedColor = appColors[Math.floor(Math.random() * appColors.length)];
    tagsInput = '';
    description = '';
    metaOpen = false;
    error = null;
    validating = false;
  }

  function parseTags(raw: string): string[] {
    return raw
      .split(/[, ]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  async function validateAndSave() {
    if (!isFormValid) return;
    
    validating = true;
    error = null;

    try {
      // 1. Prepare Key Vault config
      const keyVault: KeyVaultConfig = {
        uri: keyVaultUri,
        credentialType,
        ...(credentialType === 'secret' ? { secretName } : { certName }),
      };

      // 2. Validate Key Vault connection
      const response = await fetch('/api/apps/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyVault }),
      });

      const result = await response.json();
      
      if (!result.valid) {
        error = result.error || 'Failed to validate Key Vault credentials. Please check your inputs and permissions.';
        return;
      }

      const appData: AppConfig = {
        id: editingApp?.id || crypto.randomUUID(),
        name: name.trim(),
        clientId: clientId.trim(),
        tenantId: tenantId.trim(),
        redirectUri,
        keyVault,
        color: selectedColor,
        tags: parseTags(tagsInput),
        description: description.trim() || undefined,
        createdAt: editingApp?.createdAt || Date.now(),
        lastUsedAt: editingApp?.lastUsedAt,
      };

      if (isEditing && editingApp) {
        await appRegistry.update(editingApp.id, appData);
        toast.success('App configuration updated');
      } else {
        await appRegistry.add(appData);
        toast.success('Connection added successfully');
      }

      onSave?.(appData);
      open = false;
      onOpenChange?.(false);
      
    } catch (e) {
      error = e instanceof Error ? e.message : 'An unexpected error occurred';
    } finally {
      validating = false;
    }
  }

  function handleOpenChange(value: boolean) {
    if (!value && validating) return; // Prevent closing while validating
    open = value;
    onOpenChange?.(value);
  }
</script>

<FormSheetLayout
  bind:open
  onOpenChange={handleOpenChange}
  side="right"
  maxWidth="lg"
  icon={LayoutGrid}
  eyebrow={isEditing ? 'Update connection' : 'New connection'}
  title={dialogTitle}
  description="Connect an existing Microsoft Entra app registration for use in Token Studio. Credentials stay in Azure Key Vault."
  bodyClass="space-y-0 pb-6"
>
  <form id={formId} class="space-y-6" onsubmit={(e) => { e.preventDefault(); validateAndSave(); }}>
    <div class={sectionCardClass}>
      <div class="flex items-center gap-2 text-sm font-semibold">
        <LayoutGrid class="h-4 w-4 text-primary" />
        <span>App identity</span>
      </div>
      <div class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <Label for="name" class="flex items-center gap-1">
              Display Name <span class="text-destructive">*</span>
            </Label>
            <Tooltip.Root ignoreNonKeyboardFocus>
              <Tooltip.Trigger class="text-muted-foreground" aria-label="Display name help" tabindex={-1}>
                <Info class="h-4 w-4" />
              </Tooltip.Trigger>
              <Tooltip.Content align="start" side="top">
                <div class="max-w-xs text-sm">
                  Pick a friendly label shown across the app. It can match your Entra app name, but it doesn't have to—use whatever helps your team recognize it.
                </div>
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
          <Input
            id="name"
            bind:value={name}
            bind:ref={nameInput}
            placeholder="e.g. Production Graph Client"
            required
            disabled={validating}
            autocomplete="off"
          />
        </div>

        <Collapsible.Root class="rounded-lg border border-border/60 bg-muted/30 px-3 py-2" bind:open={metaOpen}>
          <Collapsible.Trigger class="group flex w-full items-center justify-between gap-2 text-sm font-medium">
            Optional metadata
            <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </Collapsible.Trigger>
          <Collapsible.Content class="space-y-4 pt-3">
            <div class="space-y-3">
              <Label class="flex items-center gap-1">
                Theme Color
              </Label>
              <div class="flex flex-wrap gap-3">
                {#each appColors as color}
                  <button
                    type="button"
                    class="h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all hover:-translate-y-0.5 hover:shadow focus:outline-none focus:ring-offset-2"
                    class:ring-primary={selectedColor === color}
                    class:ring-border={selectedColor !== color}
                    style="background-color: {color}"
                    onclick={() => selectedColor = color}
                    disabled={validating}
                    aria-label="Select color"
                  ></button>
                {/each}
              </div>
              <p class="text-[11px] text-muted-foreground">Pick an accent; it also shows in the apps list.</p>
            </div>

            <div class="space-y-2">
              <Label for="tags" class="text-xs font-medium text-muted-foreground">Tags (optional)</Label>
              <Input
                id="tags"
                placeholder="graph, prod, admin"
                bind:value={tagsInput}
                disabled={validating}
              />
              <p class="text-[11px] text-muted-foreground">Tags are searchable and filterable in the apps list.</p>
            </div>

            <div class="space-y-2">
              <Label for="description" class="text-xs font-medium text-muted-foreground">Description (optional)</Label>
              <textarea
                id="description"
                rows="3"
                class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Purpose, environment, or notes"
                bind:value={description}
                disabled={validating}
              ></textarea>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    </div>

    <div class={sectionCardClass}>
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 text-sm font-semibold">
            <Cloud class="h-4 w-4 text-blue-500" />
            <span>Entra configuration</span>
          </div>
        </div>

      <div class="grid gap-5">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-3">
            <Label for="clientId" class="flex items-center gap-1">
              Client ID <span class="text-destructive">*</span>
              <Tooltip.Root>
                <Tooltip.Trigger tabindex={-1}>
                  <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip.Trigger>
                <Tooltip.Content class="max-w-xs">
                  The Application (client) ID assigned to your app by Microsoft Entra ID.
                </Tooltip.Content>
              </Tooltip.Root>
            </Label>
            <Input
              id="clientId"
              bind:value={clientId}
              placeholder="00000000-0000..."
              class="font-mono text-sm"
              required
              disabled={validating}
              autocomplete="off"
            />
          </div>
          
          <div class="space-y-3">
            <Label for="tenantId" class="flex items-center gap-1">
              Tenant ID <span class="text-destructive">*</span>
              <Tooltip.Root>
                <Tooltip.Trigger tabindex={-1}>
                  <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip.Trigger>
                <Tooltip.Content class="max-w-xs">
                  The Directory (tenant) ID where this application is registered.
                </Tooltip.Content>
              </Tooltip.Root>
            </Label>
            <Input
              id="tenantId"
              bind:value={tenantId}
              placeholder="00000000-0000..."
              class="font-mono text-sm"
              required
              disabled={validating}
              autocomplete="off"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label class="flex items-center gap-1">
            Redirect URI
            <Tooltip.Root>
              <Tooltip.Trigger tabindex={-1}>
                <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip.Trigger>
              <Tooltip.Content class="max-w-sm">
                <p class="font-semibold mb-1">Required configuration</p>
                <p>Add this URI under the <strong>Single-page application</strong> platform in Azure Portal (not Web).</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Label>
          <div class="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <span class="font-mono text-sm text-muted-foreground break-all">{redirectUri}</span>
            {#if typeof window !== 'undefined'}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
                onclick={() => {
                  navigator.clipboard.writeText(redirectUri);
                  toast.success('Redirect URI copied to clipboard');
                }}
              >
                Copy
              </Button>
            {/if}
          </div>
          <p class="text-[11px] text-muted-foreground">
            This URI is fixed and must match your app registration exactly. If you need another port locally, set <span class="font-mono">PORT</span> in your <span class="font-mono">.env</span> file and restart the studio server.
          </p>
        </div>

        {#if clientId}
          <div class="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
            <div class="flex items-start gap-3">
              <div class="p-1.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mt-0.5">
                <ExternalLink class="h-4 w-4" />
              </div>
              <div class="space-y-1">
                <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">Register Redirect URI</h4>
                <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Add the Redirect URI above to <b>Single-page application</b> under Authentication.
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              class="w-full bg-background border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-800 dark:hover:text-blue-200"
              onclick={() => window.open(`https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/${clientId}`, '_blank')}
            >
              Open app in Entra portal
              <ExternalLink class="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        {/if}
      </div>
    </div>

    <div class={sectionCardClass}>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-sm font-semibold">
          <KeyRound class="h-4 w-4 text-emerald-500" />
          <span>Key Vault credentials</span>
        </div>
        <Badge variant="outline" class="border-emerald-400/40 bg-emerald-500/10 text-emerald-500">Server-side only</Badge>
      </div>

      <div class="grid gap-5">
        <div class="space-y-3">
          <Label for="keyVaultUri" class="flex items-center gap-1">
            Key Vault URI <span class="text-destructive">*</span>
            <Tooltip.Root>
              <Tooltip.Trigger tabindex={-1}>
                <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip.Trigger>
              <Tooltip.Content class="max-w-xs">
                The URI of your Azure Key Vault resource.
                <br><span class="opacity-70 text-xs">Example: https://my-vault.vault.azure.net</span>
              </Tooltip.Content>
            </Tooltip.Root>
          </Label>
          <Input
            type="url"
            id="keyVaultUri"
            bind:value={keyVaultUri}
            placeholder="https://your-vault.vault.azure.net"
            required
            class="font-mono text-sm bg-background"
            disabled={validating}
          />
        </div>

        <div class="space-y-4">
          <Label>Credential Type <span class="text-destructive">*</span></Label>
          <div class="grid gap-3 md:grid-cols-2">
            <button 
              type="button"
              class={`group relative flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-all ${credentialType === 'certificate'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-border/70 hover:bg-muted/50'}`}
              onclick={() => { credentialType = 'certificate'; error = null; }}
            >
              <div class="flex items-center gap-2 font-medium text-sm">
                <Shield class="h-4 w-4 {credentialType === 'certificate' ? 'text-primary' : 'text-muted-foreground'}" />
                Certificate
              </div>
              <p class="text-xs text-muted-foreground leading-tight">Key Vault certificate (requires Secrets + Certificate User roles).</p>
              {#if credentialType === 'certificate'}
                <div class="absolute top-2 right-2 text-primary">
                  <CheckCircle2 class="h-4 w-4" />
                </div>
              {/if}
            </button>

            <button 
              type="button"
              class={`group relative flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-all ${credentialType === 'secret'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-border/70 hover:bg-muted/50'}`}
              onclick={() => { credentialType = 'secret'; error = null; }}
            >
              <div class="flex items-center gap-2 font-medium text-sm">
                <KeyRound class="h-4 w-4 {credentialType === 'secret' ? 'text-primary' : 'text-muted-foreground'}" />
                Client Secret
              </div>
              <p class="text-xs text-muted-foreground leading-tight">
                Stored as a Key Vault secret (requires Secrets User role). Fastest to validate and rotate.
              </p>
              {#if credentialType === 'secret'}
                <div class="absolute top-2 right-2 text-primary">
                  <CheckCircle2 class="h-4 w-4" />
                </div>
              {/if}
            </button>
          </div>
        </div>

        <div class="space-y-3">
          {#if credentialType === 'secret'}
            <Label for="secretName" class="flex items-center gap-1">
              Secret Name (as per Key Vault) <span class="text-destructive">*</span>
              <Tooltip.Root>
                <Tooltip.Trigger tabindex={-1}>
                  <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip.Trigger>
                <Tooltip.Content class="max-w-xs">
                  Case-sensitive name of the Key Vault secret containing your client secret value.
                </Tooltip.Content>
              </Tooltip.Root>
            </Label>
            <Input
              id="secretName"
              bind:value={secretName}
              placeholder="e.g. MyClientSecret"
              required
              class="font-mono text-sm bg-background"
              disabled={validating}
              autocomplete="off"
            />
          {:else}
            <Label for="certName" class="flex items-center gap-1">
              Certificate Name (as per Key Vault) <span class="text-destructive">*</span>
              <Tooltip.Root>
                <Tooltip.Trigger tabindex={-1}>
                  <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip.Trigger>
                <Tooltip.Content class="max-w-xs">
                  The Key Vault certificate name. Requires <b>Certificate User</b> and <b>Secrets User</b> permissions.
                </Tooltip.Content>
              </Tooltip.Root>
            </Label>
            <Input
              id="certName"
              bind:value={certName}
              placeholder="e.g. MyClientCert"
              required
              class="font-mono text-sm bg-background"
              disabled={validating}
              autocomplete="off"
            />
          {/if}
        </div>

        {#if error}
          <div class="rounded-md bg-destructive/10 p-3 flex items-start gap-3 border border-destructive/20 text-destructive text-sm" role="alert">
            <XCircle class="h-5 w-5 shrink-0 mt-0.5" />
            <div class="space-y-1">
              <p class="font-medium">Validation error</p>
              <p class="opacity-90">{error}</p>
            </div>
          </div>
        {/if}

        <div class="text-[11px] text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded border border-blue-100 dark:border-blue-900/50">
          <p class="flex items-center gap-1.5 font-medium mb-1 text-blue-700 dark:text-blue-400">
            <Info class="h-3 w-3" />
            Prerequisites
          </p>
          <p>Ensure your local environment (AZ CLI / VS Code) is signed in and has 
            <span class="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">Key Vault Secrets User</span>
            permissions on the target Key Vault.
          </p>
        </div>
      </div>
    </div>
  </form>

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-3">
      <div class="text-xs text-muted-foreground">
        {#if validating}
          Validating Key Vault access...
        {:else}
          We only store tenant/client IDs locally; secrets stay in your vault.
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={validating}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={!isFormValid || validating} class="min-w-[140px]">
          {#if validating}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            {submitLabel}
          {:else}
            Save
          {/if}
        </Button>
      </div>
    </div>
  {/snippet}
</FormSheetLayout>
