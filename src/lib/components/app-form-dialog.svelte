<script lang="ts">
  import * as Tooltip from '$lib/shadcn/components/ui/tooltip';
  import { Button } from '$lib/shadcn/components/ui/button';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import { Input } from '$lib/shadcn/components/ui/input';
  import { Label } from '$lib/shadcn/components/ui/label';
  import * as Select from '$lib/shadcn/components/ui/select';
  import { Combobox } from 'bits-ui';
  import { appRegistry } from '$lib/states/app-registry.svelte';
  import type { AppConfig, KeyVaultConfig } from '$lib/types';
  import { toast } from 'svelte-sonner';
  import * as Collapsible from '$lib/shadcn/components/ui/collapsible';
  import FormSheetLayout from '$lib/components/FormSheetLayout.svelte';
  import { 
    Loader2, KeyRound, Shield, Cloud, 
    CheckCircle2, Check, XCircle, Info, ExternalLink,
    LayoutGrid, ChevronDown, Globe
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

  interface AzureSubscription {
    id: string;
    name: string;
    tenantId: string;
    isDefault?: boolean;
    state?: string;
  }

  interface AzureAppRegistration {
    appId: string;
    displayName: string;
  }

  interface AzureKeyVault {
    name: string;
    uri: string;
    location?: string;
    resourceGroup?: string;
  }

  interface AzureVaultCredential {
    name: string;
    enabled?: boolean;
    expires?: string | null;
  }

  let azureSubscriptions = $state<AzureSubscription[]>([]);
  let azureApps = $state<AzureAppRegistration[]>([]);
  let azureKeyVaults = $state<AzureKeyVault[]>([]);
  let azureSecrets = $state<AzureVaultCredential[]>([]);
  let azureCertificates = $state<AzureVaultCredential[]>([]);

  let selectedSubscriptionId = $state<string | null>(null);
  let selectedVaultName = $state('');
  let appQuery = $state('');
  let vaultQuery = $state('');
  let appFilterActive = $state(false);
  let vaultFilterActive = $state(false);
  let lastAppSelection = $state('');
  let lastVaultSelection = $state('');
  let appComboboxOpen = $state(false);
  let vaultComboboxOpen = $state(false);

  let loadingSubscriptions = $state(false);
  let loadingApps = $state(false);
  let loadingKeyVaults = $state(false);
  let loadingSecrets = $state(false);
  let loadingCertificates = $state(false);
  let discoveryInitialized = $state(false);

  let subscriptionsLoaded = $state(false);
  let appsLoaded = $state(false);
  let keyVaultsLoaded = $state(false);
  let secretsLoaded = $state(false);
  let certificatesLoaded = $state(false);

  let subscriptionError = $state<string | null>(null);
  let appsError = $state<string | null>(null);
  let keyVaultsError = $state<string | null>(null);
  let secretsError = $state<string | null>(null);
  let certificatesError = $state<string | null>(null);

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
  let nameInput = $state<HTMLInputElement | null>(null);
  const formId = 'app-form';
  const sectionCardClass = 'rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm shadow-black/5 space-y-5';
  // Recommended redirect URI (port-less) - works for any localhost port (web dev server, Tauri, etc.)
  const recommendedRedirectUri = 'http://localhost/auth/callback';
  // Actual redirect URI used by MSAL (includes current port)
  const actualRedirectUri = $derived(typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback');

  const isEditing = $derived(!!editingApp);
  const dialogTitle = $derived(isEditing ? 'Edit Client App Connection' : 'Connect Client App');
  const submitLabel = $derived(validating ? 'Validating & Saving...' : isEditing ? 'Save Changes' : 'Validate & Save Connection');

  const isFormValid = $derived(
    name.trim() && 
    clientId.trim() && 
    tenantId.trim() && 
    keyVaultUri.trim() &&
    (credentialType === 'secret' ? secretName.trim() : certName.trim())
  );

  const selectedSubscription = $derived(
    azureSubscriptions.find((sub) => sub.id === selectedSubscriptionId) || null
  );
  const selectedSecret = $derived(
    azureSecrets.find((secret) => secret.name === secretName) || null
  );
  const selectedCertificate = $derived(
    azureCertificates.find((cert) => cert.name === certName) || null
  );

  const appItems = $derived(
    azureApps.map((app) => ({
      value: app.appId,
      label: `${app.displayName || 'Unnamed app'} (${formatId(app.appId)})`,
      searchable: `${app.displayName || ''} ${app.appId}`.toLowerCase(),
      app,
    }))
  );

  const appFilterQuery = $derived.by(() => {
    const query = appQuery.trim().toLowerCase();
    const selectedItem = appItems.find((item) => item.value === clientId);
    if (selectedItem && query === selectedItem.label.toLowerCase()) return '';
    return query;
  });

  const filteredAppItems = $derived.by(() => {
    if (!appFilterActive || !appFilterQuery) return appItems;
    return appItems.filter((item) => item.searchable.includes(appFilterQuery));
  });

  const vaultItems = $derived(
    azureKeyVaults.map((vault) => ({
      value: vault.uri,
      label: vault.name || vault.uri,
      searchable: `${vault.name || ''} ${vault.uri}`.toLowerCase(),
      vault,
    }))
  );

  const vaultFilterQuery = $derived.by(() => {
    const query = vaultQuery.trim().toLowerCase();
    const selectedItem = vaultItems.find((item) => item.value === keyVaultUri);
    if (selectedItem && query === selectedItem.label.toLowerCase()) return '';
    return query;
  });

  const filteredVaultItems = $derived.by(() => {
    if (!vaultFilterActive || !vaultFilterQuery) return vaultItems;
    return vaultItems.filter((item) => item.searchable.includes(vaultFilterQuery));
  });

  $effect(() => {
    if (!clientId) {
      appQuery = '';
      lastAppSelection = '';
      return;
    }
    const selectedItem = appItems.find((item) => item.value === clientId);
    const nextLabel = selectedItem?.label || clientId;
    if (clientId !== lastAppSelection || appQuery === lastAppSelection) {
      appQuery = nextLabel;
      lastAppSelection = clientId;
    }
  });

  $effect(() => {
    if (!keyVaultUri) {
      vaultQuery = '';
      lastVaultSelection = '';
      return;
    }
    const selectedItem = vaultItems.find((item) => item.value === keyVaultUri);
    const nextLabel = selectedItem?.label || keyVaultUri;
    if (keyVaultUri !== lastVaultSelection || vaultQuery === lastVaultSelection) {
      vaultQuery = nextLabel;
      lastVaultSelection = keyVaultUri;
    }
  });

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
    azureSubscriptions = [];
    azureApps = [];
    azureKeyVaults = [];
    azureSecrets = [];
    azureCertificates = [];
    selectedSubscriptionId = null;
    selectedVaultName = '';
    appQuery = '';
    vaultQuery = '';
    appFilterActive = false;
    vaultFilterActive = false;
    lastAppSelection = '';
    lastVaultSelection = '';
    appComboboxOpen = false;
    vaultComboboxOpen = false;
    loadingSubscriptions = false;
    loadingApps = false;
    loadingKeyVaults = false;
    loadingSecrets = false;
    loadingCertificates = false;
    discoveryInitialized = false;
    subscriptionsLoaded = false;
    appsLoaded = false;
    keyVaultsLoaded = false;
    secretsLoaded = false;
    certificatesLoaded = false;
    subscriptionError = null;
    appsError = null;
    keyVaultsError = null;
    secretsError = null;
    certificatesError = null;
  }

  function parseTags(raw: string): string[] {
    return raw
      .split(/[, ]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  function getVaultNameFromUri(uri: string): string | null {
    try {
      const url = new URL(uri);
      const host = url.hostname;
      if (!host.endsWith('.vault.azure.net')) return null;
      return host.split('.')[0] || null;
    } catch {
      return null;
    }
  }

  function formatId(value: string): string {
    if (value.length <= 12) return value;
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  }

  function formatExpiry(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  }

  async function refreshAzureContext() {
    subscriptionError = null;
    appsError = null;
    loadingSubscriptions = true;
    subscriptionsLoaded = false;
    appsLoaded = false;

    try {
      const { listAzureSubscriptions } = await import('$lib/services/tauri-api');
      const result = await listAzureSubscriptions();

      if (!result.success) {
        subscriptionError = result.error || 'Failed to load Azure subscriptions.';
        azureSubscriptions = [];
        subscriptionsLoaded = true;
        return;
      }

      azureSubscriptions = result.data || [];
      const tenantMatch = tenantId
        ? azureSubscriptions.find((sub) => sub.tenantId === tenantId)
        : null;
      const defaultSub = tenantMatch || azureSubscriptions.find((sub) => sub.isDefault) || azureSubscriptions[0];
      if (!selectedSubscriptionId && defaultSub?.id) {
        selectedSubscriptionId = defaultSub.id;
      }
      if (!tenantId && defaultSub?.tenantId) {
        tenantId = defaultSub.tenantId;
      }

      await refreshKeyVaults();
      subscriptionsLoaded = true;
    } finally {
      loadingSubscriptions = false;
    }
  }

  async function refreshAzureApps() {
    appsError = null;
    loadingApps = true;
    appsLoaded = false;

    try {
      const { listAzureApps } = await import('$lib/services/tauri-api');
      const result = await listAzureApps(undefined);

      if (!result.success) {
        appsError = result.error || 'Failed to load app registrations.';
        azureApps = [];
        appsLoaded = true;
        return;
      }

      azureApps = result.data || [];
      appsLoaded = true;
    } finally {
      loadingApps = false;
    }
  }

  async function refreshKeyVaults() {
    if (!selectedSubscriptionId) {
      keyVaultsLoaded = false;
      return;
    }
    keyVaultsError = null;
    loadingKeyVaults = true;
    keyVaultsLoaded = false;

    try {
      const { listKeyVaults } = await import('$lib/services/tauri-api');
      const result = await listKeyVaults(selectedSubscriptionId);

      if (!result.success) {
        keyVaultsError = result.error || 'Failed to load Key Vaults.';
        azureKeyVaults = [];
        keyVaultsLoaded = true;
        return;
      }

      azureKeyVaults = result.data || [];
      const matchedVault = azureKeyVaults.find((vault) => vault.uri === keyVaultUri);
      if (matchedVault) {
        selectedVaultName = matchedVault.name;
      } else if (!selectedVaultName && keyVaultUri) {
        const derived = getVaultNameFromUri(keyVaultUri);
        if (derived) selectedVaultName = derived;
      }
      keyVaultsLoaded = true;

      if (selectedVaultName) {
        await refreshVaultCredentials();
      }
    } finally {
      loadingKeyVaults = false;
    }
  }

  async function refreshVaultSecrets() {
    if (!selectedVaultName) return;
    secretsError = null;
    loadingSecrets = true;
    secretsLoaded = false;

    try {
      const { listKeyVaultSecrets } = await import('$lib/services/tauri-api');
      const result = await listKeyVaultSecrets(selectedVaultName, selectedSubscriptionId || undefined);

      if (!result.success) {
        secretsError = result.error || 'Failed to load Key Vault secrets.';
        azureSecrets = [];
        secretsLoaded = true;
        return;
      }

      azureSecrets = result.data || [];
      secretsLoaded = true;
    } finally {
      loadingSecrets = false;
    }
  }

  async function refreshVaultCertificates() {
    if (!selectedVaultName) return;
    certificatesError = null;
    loadingCertificates = true;
    certificatesLoaded = false;

    try {
      const { listKeyVaultCertificates } = await import('$lib/services/tauri-api');
      const result = await listKeyVaultCertificates(selectedVaultName, selectedSubscriptionId || undefined);

      if (!result.success) {
        certificatesError = result.error || 'Failed to load Key Vault certificates.';
        azureCertificates = [];
        certificatesLoaded = true;
        return;
      }

      azureCertificates = result.data || [];
      certificatesLoaded = true;
    } finally {
      loadingCertificates = false;
    }
  }

  async function refreshVaultCredentials() {
    if (credentialType === 'secret') {
      await refreshVaultSecrets();
    } else {
      await refreshVaultCertificates();
    }
  }

  function handleSubscriptionChange(value: string) {
    selectedSubscriptionId = value;
    const matched = azureSubscriptions.find((sub) => sub.id === value);
    const previousTenant = tenantId;
    if (matched?.tenantId) {
      tenantId = matched.tenantId;
    }
    if (matched?.tenantId && previousTenant && matched.tenantId !== previousTenant) {
      clientId = '';
      azureApps = [];
      appsLoaded = false;
      appsError = null;
    }
    keyVaultsError = null;
    keyVaultsLoaded = false;
    azureKeyVaults = [];
    keyVaultUri = '';
    selectedVaultName = '';
    secretName = '';
    certName = '';
    azureSecrets = [];
    azureCertificates = [];
    secretsLoaded = false;
    certificatesLoaded = false;
    secretsError = null;
    certificatesError = null;
    void refreshKeyVaults();
  }

  function handleAppSelection(value: string) {
    clientId = value;
    appFilterActive = false;
    const matched = azureApps.find((app) => app.appId === value);
    if (matched && !name.trim()) {
      name = matched.displayName || name;
    }
  }

  function handleVaultSelection(value: string) {
    keyVaultUri = value;
    vaultFilterActive = false;
    const matched = azureKeyVaults.find((vault) => vault.uri === value);
    selectedVaultName = matched?.name || '';
    secretName = '';
    certName = '';
    azureSecrets = [];
    azureCertificates = [];
    secretsLoaded = false;
    certificatesLoaded = false;
    secretsError = null;
    certificatesError = null;
    void refreshVaultCredentials();
  }

  $effect(() => {
    if (!open || discoveryInitialized) return;
    discoveryInitialized = true;
    void refreshAzureContext();
  });

  $effect(() => {
    if (!open || loadingApps || appsLoaded) return;
    void refreshAzureApps();
  });

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
      const { validateKeyVault } = await import('$lib/services/tauri-api');
      const result = await validateKeyVault(keyVault);

      if (!result.valid) {
        error = result.message || 'Failed to validate Key Vault credentials. Please check your inputs and permissions.';
        return;
      }

      const appData: AppConfig = {
        id: editingApp?.id || crypto.randomUUID(),
        name: name.trim(),
        clientId: clientId.trim(),
        tenantId: tenantId.trim(),
        redirectUri: actualRedirectUri,
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
            autocomplete="on"
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
      <div class="flex items-center gap-2 text-sm font-semibold">
        <Globe class="h-4 w-4 text-sky-500" />
        <span>Azure context</span>
      </div>
      <div class="grid gap-4">
        <div class="space-y-3">
          <Label class="flex items-center gap-1">
            Azure Subscription <span class="text-destructive">*</span>
          </Label>
          <Select.Root
            type="single"
            value={selectedSubscriptionId ?? ''}
            onValueChange={handleSubscriptionChange}
            disabled={loadingSubscriptions || validating}
          >
            <Select.Trigger class="w-full">
              {#if selectedSubscription}
                {selectedSubscription.name}
              {:else}
                Select a subscription
              {/if}
            </Select.Trigger>
            <Select.Content>
              {#if azureSubscriptions.length === 0}
                <Select.Item value="none" disabled>No subscriptions found</Select.Item>
              {:else}
                {#each azureSubscriptions as sub}
                  <Select.Item value={sub.id}>
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{sub.name}</span>
                        {#if sub.isDefault}
                          <Badge variant="secondary" class="h-5 px-2 text-[10px]">Default</Badge>
                        {/if}
                      </div>
                      <span class="text-[11px] text-muted-foreground font-mono">{formatId(sub.id)}</span>
                    </div>
                  </Select.Item>
                {/each}
              {/if}
            </Select.Content>
          </Select.Root>
          <p class="text-[11px] text-muted-foreground">
            The selected subscription sets the tenant and scope for Key Vault discovery.
          </p>
        </div>

        <div class="space-y-2">
          <Label class="flex items-center gap-1">
            Tenant ID <span class="text-destructive">*</span>
          </Label>
          <div class="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <span class="font-mono text-sm text-muted-foreground">
              {tenantId || 'Select a subscription to populate'}
            </span>
            {#if selectedSubscription?.name}
              <Badge variant="secondary" class="text-[10px] font-medium">
                {selectedSubscription.name}
              </Badge>
            {/if}
          </div>
          <p class="text-[11px] text-muted-foreground">
            Pulled from the subscription’s tenant. Changing subscriptions updates this ID for token requests and Key Vault access.
          </p>
        </div>
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
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <Label class="flex items-center gap-1">
              Client App <span class="text-destructive">*</span>
            </Label>
            <Tooltip.Root>
              <Tooltip.Trigger tabindex={-1}>
                <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip.Trigger>
              <Tooltip.Content class="max-w-xs">
                Pick an app registration discovered by Azure CLI.
              </Tooltip.Content>
            </Tooltip.Root>
          </div>

          <Combobox.Root
            type="single"
            items={filteredAppItems}
            bind:value={clientId}
            inputValue={appQuery}
            bind:open={appComboboxOpen}
            onOpenChange={(value) => {
              appComboboxOpen = value;
              if (value && !loadingApps && (!appsLoaded || appsError || azureApps.length === 0)) {
                void refreshAzureApps();
              }
            }}
            onValueChange={handleAppSelection}
            disabled={validating || loadingApps}
          >
            <div class="relative">
              <Combobox.Input>
                {#snippet child({ props })}
                  {@const inputProps = props as Record<string, unknown> & {
                    onfocus?: (event: FocusEvent) => void;
                    onpointerdown?: (event: PointerEvent) => void;
                    oninput?: (event: Event) => void;
                    class?: string;
                  }}
                  <input
                    {...inputProps}
                    class={`border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive pr-9 ${inputProps.class ?? ''}`}
                    placeholder="Select an app registration"
                    autocomplete="off"
                    onfocus={(event) => {
                      inputProps.onfocus?.(event);
                      appComboboxOpen = true;
                    }}
                    onpointerdown={(event) => {
                      inputProps.onpointerdown?.(event);
                      appComboboxOpen = true;
                    }}
                    oninput={(event) => {
                      inputProps.oninput?.(event);
                      const nextValue = (event.currentTarget as HTMLInputElement).value;
                      appQuery = nextValue;
                      appFilterActive = nextValue.trim().length > 0;
                      appComboboxOpen = true;
                    }}
                  />
                {/snippet}
              </Combobox.Input>
              <Combobox.Trigger
                class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle app registration list"
              >
                <ChevronDown class="h-4 w-4 opacity-60" />
              </Combobox.Trigger>
            </div>
            <Combobox.Portal>
              <Combobox.Content
                sideOffset={4}
                class="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2 max-h-(--bits-combobox-content-available-height) origin-(--bits-combobox-content-transform-origin) relative z-50 min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border shadow-md data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
              >
                <Combobox.ScrollUpButton class="flex cursor-default items-center justify-center py-1">
                  <ChevronDown class="h-4 w-4 rotate-180" />
                </Combobox.ScrollUpButton>
                <Combobox.Viewport class="h-(--bits-combobox-anchor-height) min-w-(--bits-combobox-anchor-width) w-full scroll-my-1 p-1">
                  {#if loadingApps}
                    <div class="px-3 py-2 text-xs text-muted-foreground">Loading app registrations...</div>
                  {:else if !appsLoaded}
                    <div class="px-3 py-2 text-xs text-muted-foreground">
                      App discovery will begin once the Azure CLI session is ready.
                    </div>
                  {:else if filteredAppItems.length === 0}
                    <div class="px-3 py-2 text-xs text-muted-foreground">
                      {#if appFilterActive}
                        No matches. Clear the filter to see all apps.
                      {:else}
                        No app registrations found.
                      {/if}
                    </div>
                  {:else}
                    {#each filteredAppItems as item}
                      <Combobox.Item
                        value={item.value}
                        label={item.label}
                        class="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground outline-hidden *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pe-8 ps-2 text-sm data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                      >
                        {#snippet children({ selected })}
                          <span class="absolute end-2 flex size-3.5 items-center justify-center">
                            {#if selected}
                              <Check class="size-4" />
                            {/if}
                          </span>
                          <div class="flex flex-col">
                            <span class="font-medium">{item.app.displayName || 'Unnamed app'}</span>
                            <span class="text-[11px] text-muted-foreground font-mono">{formatId(item.app.appId)}</span>
                          </div>
                        {/snippet}
                      </Combobox.Item>
                    {/each}
                  {/if}
                </Combobox.Viewport>
                <Combobox.ScrollDownButton class="flex cursor-default items-center justify-center py-1">
                  <ChevronDown class="h-4 w-4" />
                </Combobox.ScrollDownButton>
              </Combobox.Content>
            </Combobox.Portal>
          </Combobox.Root>
          <p class="text-[11px] text-muted-foreground">
            Apps are loaded from your Azure CLI account. Start typing to filter.
          </p>

          {#if appsError}
            <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <p class="font-medium">App listing failed</p>
              <p class="mt-1">{appsError}</p>
              <p class="mt-2 text-[11px] text-muted-foreground">
                Azure CLI uses Microsoft Graph for app discovery. If you see an access error, ask an admin for
                <span class="font-medium text-foreground">Application.Read.All</span> or
                <span class="font-medium text-foreground">Directory.Read.All</span>.
              </p>
              <p class="mt-2 text-[11px] text-muted-foreground">
                Try <code class="font-mono text-[10px] bg-muted px-1 rounded">az ad app list --all</code> to confirm access.
              </p>
            </div>
          {:else if appsLoaded && azureApps.length === 0}
            <div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <p class="font-medium">No app registrations found</p>
              <p class="mt-1">Ensure you have access to app registrations in your directory, then try again.</p>
            </div>
          {/if}
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
                <p>Add this URI under the <strong>Single-page application</strong> platform in Azure Portal. Using <code>localhost</code> without a port allows any localhost port.</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Label>
          <div class="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <span class="font-mono text-sm text-muted-foreground break-all">{recommendedRedirectUri}</span>
            {#if typeof window !== 'undefined'}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
                onclick={() => {
                  navigator.clipboard.writeText(recommendedRedirectUri);
                  toast.success('Redirect URI copied to clipboard');
                }}
              >
                Copy
              </Button>
            {/if}
          </div>
          <p class="text-[11px] text-muted-foreground">
            This port-less URI works for any localhost port (5173, 3000, etc.) and for the desktop app.
          </p>
        </div>

        {#if clientId}
          <div class="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
            <div class="flex items-start gap-3">
              <div class="p-1.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mt-0.5">
                <ExternalLink class="h-4 w-4" />
              </div>
              <div class="space-y-1">
            <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">Register redirect URI</h4>
                <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Add the Redirect URI above to <b>Single-page application</b> under Authentication.
                  <span class="block mt-1 text-blue-600/80 dark:text-blue-400/80">Requires owner or admin privileges on the app registration.</span>
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
      <div class="flex items-center gap-2 text-sm font-semibold">
        <KeyRound class="h-4 w-4 text-emerald-500" />
        <span>Key Vault credentials</span>
      </div>

      <div class="grid gap-5">
        <div class="space-y-3">
          <Label class="flex items-center gap-1">
            Key Vault <span class="text-destructive">*</span>
            <Tooltip.Root>
              <Tooltip.Trigger tabindex={-1}>
                <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip.Trigger>
              <Tooltip.Content class="max-w-xs">
                Choose a Key Vault from the selected subscription.
              </Tooltip.Content>
            </Tooltip.Root>
          </Label>
          <Combobox.Root
            type="single"
            items={filteredVaultItems}
            bind:value={keyVaultUri}
            inputValue={vaultQuery}
            bind:open={vaultComboboxOpen}
            onOpenChange={(value) => {
              vaultComboboxOpen = value;
              if (value && selectedSubscriptionId && !loadingKeyVaults && (!keyVaultsLoaded || keyVaultsError || azureKeyVaults.length === 0)) {
                void refreshKeyVaults();
              }
            }}
            onValueChange={handleVaultSelection}
            disabled={validating || loadingKeyVaults}
          >
            <div class="relative">
              <Combobox.Input>
                {#snippet child({ props })}
                  {@const inputProps = props as Record<string, unknown> & {
                    onfocus?: (event: FocusEvent) => void;
                    onpointerdown?: (event: PointerEvent) => void;
                    oninput?: (event: Event) => void;
                    class?: string;
                  }}
                  <input
                    {...inputProps}
                    class={`border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive pr-9 ${inputProps.class ?? ''}`}
                    placeholder="Select a Key Vault"
                    autocomplete="off"
                    onfocus={(event) => {
                      inputProps.onfocus?.(event);
                      vaultComboboxOpen = true;
                    }}
                    onpointerdown={(event) => {
                      inputProps.onpointerdown?.(event);
                      vaultComboboxOpen = true;
                    }}
                    oninput={(event) => {
                      inputProps.oninput?.(event);
                      const nextValue = (event.currentTarget as HTMLInputElement).value;
                      vaultQuery = nextValue;
                      vaultFilterActive = nextValue.trim().length > 0;
                      vaultComboboxOpen = true;
                    }}
                  />
                {/snippet}
              </Combobox.Input>
              <Combobox.Trigger
                class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle Key Vault list"
              >
                <ChevronDown class="h-4 w-4 opacity-60" />
              </Combobox.Trigger>
            </div>
            <Combobox.Portal>
              <Combobox.Content
                sideOffset={4}
                class="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2 max-h-(--bits-combobox-content-available-height) origin-(--bits-combobox-content-transform-origin) relative z-50 min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border shadow-md data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
              >
                <Combobox.ScrollUpButton class="flex cursor-default items-center justify-center py-1">
                  <ChevronDown class="h-4 w-4 rotate-180" />
                </Combobox.ScrollUpButton>
                <Combobox.Viewport class="h-(--bits-combobox-anchor-height) min-w-(--bits-combobox-anchor-width) w-full scroll-my-1 p-1">
                  {#if loadingKeyVaults}
                    <div class="px-3 py-2 text-xs text-muted-foreground">Loading Key Vaults...</div>
                  {:else if !selectedSubscriptionId}
                    <div class="px-3 py-2 text-xs text-muted-foreground">
                      Select a subscription in Azure context to discover vaults.
                    </div>
                  {:else if filteredVaultItems.length === 0}
                    <div class="px-3 py-2 text-xs text-muted-foreground">
                      {#if vaultFilterActive}
                        No matches. Clear the filter to see all vaults.
                      {:else}
                        No Key Vaults found.
                      {/if}
                    </div>
                  {:else}
                    {#each filteredVaultItems as item}
                      <Combobox.Item
                        value={item.value}
                        label={item.label}
                        class="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground outline-hidden *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pe-8 ps-2 text-sm data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                      >
                        {#snippet children({ selected })}
                          <span class="absolute end-2 flex size-3.5 items-center justify-center">
                            {#if selected}
                              <Check class="size-4" />
                            {/if}
                          </span>
                          <div class="flex flex-col">
                            <span class="font-medium">{item.vault.name || 'Key Vault'}</span>
                            <span class="text-[11px] text-muted-foreground font-mono">{item.vault.uri}</span>
                          </div>
                        {/snippet}
                      </Combobox.Item>
                    {/each}
                  {/if}
                </Combobox.Viewport>
                <Combobox.ScrollDownButton class="flex cursor-default items-center justify-center py-1">
                  <ChevronDown class="h-4 w-4" />
                </Combobox.ScrollDownButton>
              </Combobox.Content>
            </Combobox.Portal>
          </Combobox.Root>
          <p class="text-[11px] text-muted-foreground">
            {#if selectedSubscription}
              Showing Key Vaults in {selectedSubscription.name}.
            {:else}
              Select a subscription in Azure context to discover vaults.
            {/if}
          </p>
        </div>

        {#if keyVaultsError}
          <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <p class="font-medium">Key Vault discovery failed</p>
            <p class="mt-1">{keyVaultsError}</p>
            <p class="mt-2 text-[11px] text-muted-foreground">
              Confirm you can run <code class="font-mono text-[10px] bg-muted px-1 rounded">az keyvault list</code> and that your account has access to this subscription.
            </p>
          </div>
        {:else if keyVaultsLoaded && azureKeyVaults.length === 0 && selectedSubscriptionId}
          <div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <p class="font-medium">No Key Vaults found</p>
            <p class="mt-1">Create a Key Vault in this subscription or request access, then reopen the list.</p>
          </div>
        {/if}

        <div class="space-y-4">
          <Label>Credential Type <span class="text-destructive">*</span></Label>
          <div class="grid gap-3 md:grid-cols-2">
            <button 
              type="button"
              class={`group relative flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-all ${credentialType === 'certificate'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-border/70 hover:bg-muted/50'}`}
              onclick={() => {
                credentialType = 'certificate';
                error = null;
                if (selectedVaultName) {
                  void refreshVaultCredentials();
                }
              }}
            >
              <div class="flex items-center gap-2 font-medium text-sm">
                <Shield class="h-4 w-4 {credentialType === 'certificate' ? 'text-primary' : 'text-muted-foreground'}" />
                Certificate
              </div>
              <p class="text-xs text-muted-foreground leading-tight">Key Vault certificate (requires Crypto User + Certificates User roles).</p>
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
              onclick={() => {
                credentialType = 'secret';
                error = null;
                if (selectedVaultName) {
                  void refreshVaultCredentials();
                }
              }}
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
            <div class="flex items-center justify-between gap-2">
              <Label class="flex items-center gap-1">
                Secret Name <span class="text-destructive">*</span>
                <Tooltip.Root>
                  <Tooltip.Trigger tabindex={-1}>
                    <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                  </Tooltip.Trigger>
                  <Tooltip.Content class="max-w-xs">
                    Choose a Key Vault secret to use as your client secret value.
                  </Tooltip.Content>
                </Tooltip.Root>
              </Label>
            </div>
            <Select.Root
              type="single"
              value={secretName}
              onOpenChange={(value) => {
                if (!value) return;
                if (!selectedVaultName || loadingSecrets) return;
                if (!secretsLoaded || secretsError || azureSecrets.length === 0) {
                  void refreshVaultSecrets();
                }
              }}
              onValueChange={(value) => (secretName = value)}
              disabled={validating || loadingSecrets || azureSecrets.length === 0}
            >
            <Select.Trigger class="w-full">
              {#if selectedSecret}
                {selectedSecret.name}
              {:else if loadingSecrets}
                Loading secrets...
              {:else if secretName}
                {secretName}
              {:else if !selectedVaultName}
                Select a Key Vault first
              {:else if azureSecrets.length === 0}
                  No secrets found
                {:else}
                  Select a secret
                {/if}
              </Select.Trigger>
              <Select.Content>
                {#each azureSecrets as secret}
                  <Select.Item value={secret.name}>
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-medium">{secret.name}</span>
                      {#if formatExpiry(secret.expires)}
                        <span class="text-[10px] text-muted-foreground">exp {formatExpiry(secret.expires)}</span>
                      {/if}
                    </div>
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>

            {#if secretsError}
              <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p class="font-medium">Secret listing failed</p>
                <p class="mt-1">{secretsError}</p>
                <p class="mt-2 text-[11px] text-muted-foreground">
                  Verify <code class="font-mono text-[10px] bg-muted px-1 rounded">az keyvault secret list --vault-name {selectedVaultName}</code> works
                  and that you have <span class="font-medium text-foreground">Key Vault Secrets User</span> access.
                </p>
              </div>
            {:else if secretsLoaded && !loadingSecrets && azureSecrets.length === 0 && selectedVaultName}
              <div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <p class="font-medium">No secrets found</p>
                <p class="mt-1">Create a secret in this vault, then reopen the list.</p>
              </div>
            {/if}
          {:else}
            <div class="flex items-center justify-between gap-2">
              <Label class="flex items-center gap-1">
                Certificate Name <span class="text-destructive">*</span>
                <Tooltip.Root>
                  <Tooltip.Trigger tabindex={-1}>
                    <Info class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                  </Tooltip.Trigger>
                  <Tooltip.Content class="max-w-xs">
                    Choose a Key Vault certificate to use for signing.
                  </Tooltip.Content>
                </Tooltip.Root>
              </Label>
            </div>
            <Select.Root
              type="single"
              value={certName}
              onOpenChange={(value) => {
                if (!value) return;
                if (!selectedVaultName || loadingCertificates) return;
                if (!certificatesLoaded || certificatesError || azureCertificates.length === 0) {
                  void refreshVaultCertificates();
                }
              }}
              onValueChange={(value) => (certName = value)}
              disabled={validating || loadingCertificates || azureCertificates.length === 0}
            >
            <Select.Trigger class="w-full">
              {#if selectedCertificate}
                {selectedCertificate.name}
              {:else if loadingCertificates}
                Loading certificates...
              {:else if certName}
                {certName}
              {:else if !selectedVaultName}
                Select a Key Vault first
              {:else if azureCertificates.length === 0}
                  No certificates found
                {:else}
                  Select a certificate
                {/if}
              </Select.Trigger>
              <Select.Content>
                {#each azureCertificates as cert}
                  <Select.Item value={cert.name}>
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-medium">{cert.name}</span>
                      {#if formatExpiry(cert.expires)}
                        <span class="text-[10px] text-muted-foreground">exp {formatExpiry(cert.expires)}</span>
                      {/if}
                    </div>
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>

            {#if certificatesError}
              <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p class="font-medium">Certificate listing failed</p>
                <p class="mt-1">{certificatesError}</p>
                <p class="mt-2 text-[11px] text-muted-foreground">
                  Verify <code class="font-mono text-[10px] bg-muted px-1 rounded">az keyvault certificate list --vault-name {selectedVaultName}</code> works
                  and that you have <span class="font-medium text-foreground">Key Vault Certificates User</span> access.
                </p>
              </div>
            {:else if certificatesLoaded && !loadingCertificates && azureCertificates.length === 0 && selectedVaultName}
              <div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <p class="font-medium">No certificates found</p>
                <p class="mt-1">Create a certificate in this vault, then reopen the list.</p>
              </div>
            {/if}
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

        <div class="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
          <div class="flex items-start gap-3">
            <div class="p-1.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mt-0.5">
              <Info class="h-4 w-4" />
            </div>
            <div class="space-y-1">
              <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">Prerequisites</h4>
              <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                Ensure your local environment (Azure CLI) is signed in and has
                {#if credentialType === 'certificate'}
                  <code class="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded mx-0.5">Key Vault Crypto User</code>
                  +
                  <code class="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded mx-0.5">Key Vault Certificates User</code>
                  roles (or <code class="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded mx-0.5">Key Vault Administrator</code>)
                {:else}
                  <code class="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded mx-0.5">Key Vault Secrets User</code>
                  role (or <code class="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded mx-0.5">Key Vault Administrator</code>)
                {/if}
                on the target Key Vault.
              </p>
            </div>
          </div>
        </div>

        <!-- Expiry Warning -->
        <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <span class="font-medium">⚠️ Credentials expire:</span> Both secrets and certificates have expiration dates. Keep Key Vault in sync with your app registration when rotating.
            <a href="https://learn.microsoft.com/en-us/azure/key-vault/certificates/overview-renew-certificate" target="_blank" rel="noreferrer" class="text-amber-800 dark:text-amber-200 underline hover:no-underline ml-1">Learn about auto-rotation →</a>
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
