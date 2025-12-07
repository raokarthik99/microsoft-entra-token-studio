<script lang="ts">
  import * as Sheet from '$lib/shadcn/components/ui/sheet';
  import * as Tabs from '$lib/shadcn/components/ui/tabs';
  import * as Collapsible from '$lib/shadcn/components/ui/collapsible';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import { Button } from '$lib/shadcn/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { Key, Lock, CheckCircle2, AlertTriangle, FileKey, ShieldCheck, ExternalLink, Copy, Info, Shield, Zap, Terminal, ChevronDown, ChevronRight } from '@lucide/svelte';
  import type { CredentialValidationStatus, HealthStatus } from '$lib/types';

  interface Props {
    health: HealthStatus;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  let { health, open, onOpenChange }: Props = $props();

  const validationBadges: Record<CredentialValidationStatus, string> = {
    ready: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    issues: 'bg-amber-500/15 text-amber-700 border-amber-500/40',
    not_configured: 'bg-muted text-muted-foreground border-border/60',
  };
  const validationErrorClasses =
    'rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 p-2.5 text-xs text-amber-900 dark:text-amber-50 space-y-1';
  const validationErrorIconClasses =
    'h-3.5 w-3.5 mt-[1px] text-amber-800 dark:text-amber-100 shrink-0';

  const validationLabels: Record<CredentialValidationStatus, string> = {
    ready: 'Ready',
    issues: 'Issues',
    not_configured: 'Not set',
  };

  // Determine initial tab based on current config
  let activeTab = $state<'secret' | 'certificate'>('secret');
  $effect(() => {
    if (health.authMethod === 'certificate') {
      activeTab = 'certificate';
    }
  });

  // Determine initial source based on current config
  let activeSource = $state<'local' | 'keyvault'>('local');
  $effect(() => {
    if (health.authSource === 'keyvault') {
      activeSource = 'keyvault';
    }
  });

  // Collapsible states
  let howItWorksOpen = $state(false);
  let setupDetailsOpen = $state(true);

  const validation = $derived(health.validation);

  // Reactive checks for each method
  const status = $derived({
    secret: {
      local: {
        configured: validation.secret.local.status !== 'not_configured',
        active: health.authMethod === 'secret' && health.authSource === 'local',
        validation: validation.secret.local,
      },
      keyvault: {
        configured: validation.secret.keyvault.status !== 'not_configured',
        active: health.authMethod === 'secret' && health.authSource === 'keyvault',
        validation: validation.secret.keyvault,
      }
    },
    certificate: {
      local: {
        configured: validation.certificate.local.status !== 'not_configured',
        active: health.authMethod === 'certificate' && health.authSource === 'local',
        validation: validation.certificate.local,
      },
      keyvault: {
        configured: validation.certificate.keyvault.status !== 'not_configured',
        active: health.authMethod === 'certificate' && health.authSource === 'keyvault',
        validation: validation.certificate.keyvault,
      }
    }
  });

  const activePathValidation = $derived((() => {
    if (health.authMethod === 'certificate') {
      return health.validation.certificate[health.authSource === 'keyvault' ? 'keyvault' : 'local'];
    }
    if (health.authMethod === 'secret') {
      return health.validation.secret[health.authSource === 'keyvault' ? 'keyvault' : 'local'];
    }
    return null;
  })());

  const activePathStatus = $derived<CredentialValidationStatus>(activePathValidation?.status ?? 'not_configured');
  const isConfigured = $derived(activePathStatus === 'ready');
  const currentSelectionValidation = $derived(
    activeTab === 'certificate' ? validation.certificate[activeSource] : validation.secret[activeSource]
  );

  function setSource(source: 'local' | 'keyvault') {
    activeSource = source;
  }

  function validationBadgeClass(status: CredentialValidationStatus) {
    return `h-5 text-[10px] ${validationBadges[status]}`;
  }

  function validationBadgeLabel(status: CredentialValidationStatus) {
    return validationLabels[status];
  }

  async function copyEnvBlock(block: string) {
    try {
      await navigator.clipboard.writeText(block);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }

  function getSecretEnvBlock(): string {
    if (activeSource === 'local') {
      return 'CLIENT_SECRET=your_secret_value';
    }
    return 'AZURE_KEYVAULT_URI=https://your-vault.vault.azure.net\nAZURE_KEYVAULT_SECRET_NAME=your-secret-name';
  }

  function getCertEnvBlock(): string {
    if (activeSource === 'local') {
      return 'CERTIFICATE_PATH=/path/to/cert.pem';
    }
    return 'AZURE_KEYVAULT_URI=https://your-vault.vault.azure.net\nAZURE_KEYVAULT_CERT_NAME=your-cert-name';
  }

  function applyPreference(method: 'certificate' | 'secret', source: 'keyvault' | 'local') {
    document.cookie = `auth_pref=${method}:${source}; path=/; SameSite=Strict; max-age=31536000`;
    toast.success('Credential preference saved');
    onOpenChange(false);
  }

  function getActivePathLabel(): string {
    if (health.authMethod === 'certificate') {
      return `Certificate · ${health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}`;
    } else if (health.authMethod === 'secret') {
      return `Secret · ${health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}`;
    }
    return 'Not configured';
  }
</script>

<Sheet.Root open={open} onOpenChange={onOpenChange}>
  <Sheet.Content side="right" class="sm:max-w-2xl w-[92vw] h-full p-0">
    <div class="flex h-full flex-col overflow-hidden">
      <Sheet.Header class="space-y-2 p-5 pb-4 pr-14 border-b border-border/60">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1 flex-1">
            <Sheet.Title class="text-lg font-semibold tracking-tight">Configure credentials</Sheet.Title>
            <Sheet.Description class="text-sm leading-relaxed text-muted-foreground">
              How the app authenticates to issue <strong>app tokens</strong>.
            </Sheet.Description>
          </div>
          <!-- Compact Status Badge -->
          <div class={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isConfigured ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-700 border border-amber-500/30'}`}>
            {#if isConfigured}
              <CheckCircle2 class="h-3.5 w-3.5" />
            {:else}
              <AlertTriangle class="h-3.5 w-3.5" />
            {/if}
            <span>{getActivePathLabel()}</span>
          </div>
        </div>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <!-- Credential Type Tabs -->
        <Tabs.Root bind:value={activeTab} class="w-full">
          <Tabs.List class="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1">
            <Tabs.Trigger value="secret" class="gap-2 rounded-full text-sm transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Lock class="h-3.5 w-3.5" />
              Client secret
            </Tabs.Trigger>
            <Tabs.Trigger value="certificate" class="gap-2 rounded-full text-sm transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Key class="h-3.5 w-3.5" />
              Certificate
            </Tabs.Trigger>
          </Tabs.List>

          <!-- CLIENT SECRET -->
          <Tabs.Content value="secret" class="mt-3 space-y-4 animate-in fade-in-50 duration-200">
            <!-- Quick Tip Banner -->
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs">
              <Zap class="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span class="text-muted-foreground">Fastest way to get started. Secrets expire and need rotation.</span>
            </div>

            <!-- Source Selection Cards -->
            <div class="grid gap-3 sm:grid-cols-2">
              <!-- Local Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'local'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'local'
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-accent'}"
                onclick={() => setSource('local')}
              >
                <div class="flex items-start justify-between gap-2 w-full">
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg {activeSource === 'local' ? 'bg-primary/10' : 'bg-muted'}">
                      <FileKey class="h-4 w-4 {activeSource === 'local' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <p class="text-sm font-medium">.env file</p>
                      <p class="text-[11px] text-muted-foreground">Local development</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.secret.local.active}
                      <Badge variant="outline" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Active</Badge>
                    {:else}
                      <Badge variant="outline" class={validationBadgeClass(status.secret.local.validation.status)}>
                        {validationBadgeLabel(status.secret.local.validation.status)}
                      </Badge>
                    {/if}
                    {#if status.secret.local.validation.status === 'ready'}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                <p class="mt-2 text-[10px] text-foreground/60 font-mono pl-12">CLIENT_SECRET=...</p>
              </button>

              <!-- Key Vault Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'keyvault'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'keyvault'
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-accent'}"
                onclick={() => setSource('keyvault')}
              >
                <div class="flex items-start justify-between gap-2 w-full">
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg {activeSource === 'keyvault' ? 'bg-primary/10' : 'bg-muted'}">
                      <ShieldCheck class="h-4 w-4 {activeSource === 'keyvault' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <p class="text-sm font-medium">Key Vault</p>
                        <Badge variant="outline" class="h-4 text-[8px] px-1 border-emerald-500/30 text-emerald-600">Best</Badge>
                      </div>
                      <p class="text-[11px] text-muted-foreground">Production ready</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.secret.keyvault.active}
                      <Badge variant="outline" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Active</Badge>
                    {:else}
                      <Badge variant="outline" class={validationBadgeClass(status.secret.keyvault.validation.status)}>
                        {validationBadgeLabel(status.secret.keyvault.validation.status)}
                      </Badge>
                    {/if}
                    {#if status.secret.keyvault.validation.status === 'ready'}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                <p class="mt-2 text-[10px] text-foreground/60 font-mono pl-12">AZURE_KEYVAULT_URI=...</p>
              </button>
            </div>

            <!-- Setup Details Accordion -->
            <Collapsible.Root bind:open={setupDetailsOpen} class="rounded-lg border bg-muted/20">
              <Collapsible.Trigger class="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg">
                <div class="flex items-center gap-2">
                  <Terminal class="h-4 w-4 text-muted-foreground" />
                  <span>Setup instructions</span>
                  <Badge variant="outline" class={validationBadgeClass(currentSelectionValidation.status)}>
                    {currentSelectionValidation.status === 'ready' ? '✓ Ready' : validationBadgeLabel(currentSelectionValidation.status)}
                  </Badge>
                </div>
                {#if setupDetailsOpen}
                  <ChevronDown class="h-4 w-4 text-muted-foreground" />
                {:else}
                  <ChevronRight class="h-4 w-4 text-muted-foreground" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content class="px-3 pb-3 space-y-3">
                <!-- Env Block -->
                <div class="group relative rounded-lg border bg-background overflow-hidden">
                  <div class="p-2.5 font-mono text-xs space-y-1">
                    {#if activeSource === 'local'}
                      <div class="flex items-center gap-1">
                        <span class="text-blue-500">CLIENT_SECRET</span>
                        <span class="text-muted-foreground">=</span>
                        <span class="text-foreground/70">your_secret_value</span>
                      </div>
                    {:else}
                      <div class="flex items-center gap-1">
                        <span class="text-blue-500">AZURE_KEYVAULT_URI</span>
                        <span class="text-muted-foreground">=</span>
                        <span class="text-foreground/70">https://your-vault.vault.azure.net</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-blue-500">AZURE_KEYVAULT_SECRET_NAME</span>
                        <span class="text-muted-foreground">=</span>
                        <span class="text-foreground/70">your-secret-name</span>
                      </div>
                    {/if}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onclick={() => copyEnvBlock(getSecretEnvBlock())}
                    title="Copy to clipboard"
                  >
                    <Copy class="h-3.5 w-3.5" />
                  </Button>
                </div>

                <!-- Help Text -->
                {#if activeSource === 'local'}
                  <div class="text-xs text-muted-foreground space-y-1.5">
                    <p class="font-medium text-foreground/80">Where to find your secret:</p>
                    <ol class="list-decimal list-inside space-y-0.5 pl-1">
                      <li><a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps" target="_blank" rel="noreferrer" class="text-primary hover:underline">App Registrations</a> → Your app → <strong>Certificates & secrets</strong></li>
                      <li>Click <strong>New client secret</strong>, set expiration, copy value</li>
                    </ol>
                    <p class="text-[10px] text-amber-600 flex items-center gap-1 mt-2">
                      <AlertTriangle class="h-3 w-3" />
                      Copy immediately after creation—you can't view it later.
                    </p>
                  </div>
                {:else}
                  <div class="text-xs text-muted-foreground space-y-2">
                    <p class="font-medium text-foreground/80">Prerequisites:</p>
                    <ul class="space-y-1.5">
                      <li class="flex items-start gap-2">
                        <Terminal class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                        <span>Run <code class="bg-muted px-1 rounded">az login</code> (<a href="https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli" target="_blank" rel="noreferrer" class="text-primary hover:underline">Azure CLI</a>)</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <Shield class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                        <span>Assign <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide" target="_blank" rel="noreferrer" class="text-primary hover:underline">Key Vault Secrets User</a> role</span>
                      </li>
                    </ul>
                  </div>
                {/if}

                <!-- Validation Errors -->
                {#if status.secret[activeSource].validation.status !== 'ready' && status.secret[activeSource].validation.errors?.length}
                  <div class={validationErrorClasses}>
                    {#each status.secret[activeSource].validation.errors as err}
                      <div class="flex items-start gap-2">
                        <Info class={validationErrorIconClasses} />
                        <span>{err}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </Collapsible.Content>
            </Collapsible.Root>
          </Tabs.Content>

          <!-- CERTIFICATE -->
          <Tabs.Content value="certificate" class="mt-3 space-y-4 animate-in fade-in-50 duration-200">
            <!-- Quick Tip Banner -->
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
              <Shield class="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span class="text-muted-foreground">Cryptographically stronger. Private key never leaves your environment.</span>
            </div>

            <!-- Source Selection Cards -->
            <div class="grid gap-3 sm:grid-cols-2">
              <!-- Local Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'local'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'local'
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-accent'}"
                onclick={() => setSource('local')}
              >
                <div class="flex items-start justify-between gap-2 w-full">
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg {activeSource === 'local' ? 'bg-primary/10' : 'bg-muted'}">
                      <FileKey class="h-4 w-4 {activeSource === 'local' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <p class="text-sm font-medium">Local file</p>
                      <p class="text-[11px] text-muted-foreground">.pem or .pfx</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.certificate.local.active}
                      <Badge variant="outline" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Active</Badge>
                    {:else}
                      <Badge variant="outline" class={validationBadgeClass(status.certificate.local.validation.status)}>
                        {validationBadgeLabel(status.certificate.local.validation.status)}
                      </Badge>
                    {/if}
                    {#if status.certificate.local.validation.status === 'ready'}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                <p class="mt-2 text-[10px] text-foreground/60 font-mono pl-12">CERTIFICATE_PATH=...</p>
              </button>

              <!-- Key Vault Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'keyvault'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'keyvault'
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-accent'}"
                onclick={() => setSource('keyvault')}
              >
                <div class="flex items-start justify-between gap-2 w-full">
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg {activeSource === 'keyvault' ? 'bg-primary/10' : 'bg-muted'}">
                      <ShieldCheck class="h-4 w-4 {activeSource === 'keyvault' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <p class="text-sm font-medium">Key Vault</p>
                        <Badge variant="outline" class="h-4 text-[8px] px-1 border-emerald-500/30 text-emerald-600">Best</Badge>
                      </div>
                      <p class="text-[11px] text-muted-foreground">Private key stays secure</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.certificate.keyvault.active}
                      <Badge variant="outline" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Active</Badge>
                    {:else}
                      <Badge variant="outline" class={validationBadgeClass(status.certificate.keyvault.validation.status)}>
                        {validationBadgeLabel(status.certificate.keyvault.validation.status)}
                      </Badge>
                    {/if}
                    {#if status.certificate.keyvault.validation.status === 'ready'}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                <p class="mt-2 text-[10px] text-foreground/60 font-mono pl-12">AZURE_KEYVAULT_CERT_NAME=...</p>
              </button>
            </div>

            <!-- Setup Details Accordion -->
            <Collapsible.Root bind:open={setupDetailsOpen} class="rounded-lg border bg-muted/20">
              <Collapsible.Trigger class="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg">
                <div class="flex items-center gap-2">
                  <Terminal class="h-4 w-4 text-muted-foreground" />
                  <span>Setup instructions</span>
                  <Badge variant="outline" class={validationBadgeClass(currentSelectionValidation.status)}>
                    {currentSelectionValidation.status === 'ready' ? '✓ Ready' : validationBadgeLabel(currentSelectionValidation.status)}
                  </Badge>
                </div>
                {#if setupDetailsOpen}
                  <ChevronDown class="h-4 w-4 text-muted-foreground" />
                {:else}
                  <ChevronRight class="h-4 w-4 text-muted-foreground" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content class="px-3 pb-3 space-y-3">
                <!-- Env Block -->
                <div class="group relative rounded-lg border bg-background overflow-hidden">
                  <div class="p-2.5 font-mono text-xs space-y-1">
                    {#if activeSource === 'local'}
                      <div class="flex items-center gap-1">
                        <span class="text-blue-500">CERTIFICATE_PATH</span>
                        <span class="text-muted-foreground">=</span>
                        <span class="text-foreground/70">/path/to/cert.pem</span>
                      </div>
                    {:else}
                      <div class="flex items-center gap-1">
                        <span class="text-blue-500">AZURE_KEYVAULT_URI</span>
                        <span class="text-muted-foreground">=</span>
                        <span class="text-foreground/70">https://your-vault.vault.azure.net</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-blue-500">AZURE_KEYVAULT_CERT_NAME</span>
                        <span class="text-muted-foreground">=</span>
                        <span class="text-foreground/70">your-cert-name</span>
                      </div>
                    {/if}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onclick={() => copyEnvBlock(getCertEnvBlock())}
                    title="Copy to clipboard"
                  >
                    <Copy class="h-3.5 w-3.5" />
                  </Button>
                </div>

                <!-- Help Text -->
                <div class="text-xs text-muted-foreground space-y-2">
                  <p class="font-medium text-foreground/80">Upload public key to Entra:</p>
                  <ol class="list-decimal list-inside space-y-0.5 pl-1">
                    <li><a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps" target="_blank" rel="noreferrer" class="text-primary hover:underline">App Registrations</a> → Your app → <strong>Certificates & secrets</strong></li>
                    <li>Click <strong>Upload certificate</strong>, select <code class="bg-muted px-1 rounded text-[10px]">.cer</code> or <code class="bg-muted px-1 rounded text-[10px]">.pem</code></li>
                  </ol>
                </div>

                {#if activeSource === 'keyvault'}
                  <div class="text-xs text-muted-foreground space-y-2 pt-1 border-t">
                    <p class="font-medium text-foreground/80 pt-2">Key Vault prerequisites:</p>
                    <ul class="space-y-1.5">
                      <li class="flex items-start gap-2">
                        <Terminal class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                        <span>Run <code class="bg-muted px-1 rounded">az login</code> (<a href="https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli" target="_blank" rel="noreferrer" class="text-primary hover:underline">Azure CLI</a>)</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <Shield class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                        <span>Assign <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide" target="_blank" rel="noreferrer" class="text-primary hover:underline">Key Vault Secrets User</a> role (to read private key)</span>
                      </li>
                    </ul>
                  </div>
                {:else}
                  <div class="text-xs text-muted-foreground pt-1 border-t">
                    <p class="font-medium text-foreground/80 pt-2">File format:</p>
                    <p class="mt-1">Must contain both certificate and private key. PEM recommended.</p>
                    <p class="text-[10px] text-amber-600 flex items-center gap-1 mt-2">
                      <AlertTriangle class="h-3 w-3" />
                      Never commit certificate files to source control.
                    </p>
                  </div>
                {/if}

                <!-- Validation Errors -->
                {#if status.certificate[activeSource].validation.status !== 'ready' && status.certificate[activeSource].validation.errors?.length}
                  <div class={validationErrorClasses}>
                    {#each status.certificate[activeSource].validation.errors as err}
                      <div class="flex items-start gap-2">
                        <Info class={validationErrorIconClasses} />
                        <span>{err}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </Collapsible.Content>
            </Collapsible.Root>
          </Tabs.Content>
        </Tabs.Root>

        <!-- How It Works Accordion (Collapsed by Default) -->
        <Collapsible.Root bind:open={howItWorksOpen} class="rounded-lg border bg-muted/10">
          <Collapsible.Trigger class="flex w-full items-center justify-between p-3 text-sm hover:bg-muted/20 transition-colors rounded-lg">
            <div class="flex items-center gap-2">
              <Info class="h-4 w-4 text-muted-foreground" />
              <span class="text-muted-foreground">How credential resolution works</span>
            </div>
            {#if howItWorksOpen}
              <ChevronDown class="h-4 w-4 text-muted-foreground" />
            {:else}
              <ChevronRight class="h-4 w-4 text-muted-foreground" />
            {/if}
          </Collapsible.Trigger>
          <Collapsible.Content class="px-3 pb-3 space-y-2 text-xs text-muted-foreground">
            <div class="flex items-start gap-2">
              <Badge variant="secondary" class="h-5 text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">1</Badge>
              <div>
                <span class="text-foreground font-medium">Preferred path</span> – Saved in cookie, used if still valid.
              </div>
            </div>
            <div class="flex items-start gap-2">
              <Badge variant="secondary" class="h-5 text-[10px] bg-muted text-muted-foreground border-border/60 shrink-0">2</Badge>
              <div class="space-y-1">
                <span class="text-foreground font-medium">Auto-detect fallback</span>
                <div class="flex flex-wrap items-center gap-1 font-mono text-[10px]">
                  <span>KV Cert</span>
                  <span class="text-muted-foreground/60">→</span>
                  <span>Local Cert</span>
                  <span class="text-muted-foreground/60">→</span>
                  <span>KV Secret</span>
                  <span class="text-muted-foreground/60">→</span>
                  <span>Local Secret</span>
                </div>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <Badge variant="secondary" class="h-5 text-[10px] bg-muted text-muted-foreground border-border/60 shrink-0">3</Badge>
              <div>
                <span class="text-foreground font-medium">Key Vault access</span> – Requires <code class="bg-muted px-1 rounded">DefaultAzureCredential</code>.
              </div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>

      <!-- Footer -->
      <Sheet.Footer class="mt-0 border-t border-border/60 p-4">
        <div class="flex items-center justify-between w-full gap-3">
          <a
            href="https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow"
            target="_blank"
            rel="noreferrer"
            class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            Learn more <ExternalLink class="h-3 w-3" />
          </a>
          <div class="flex items-center gap-2">
            <Button
              size="default"
              onclick={() => applyPreference(activeTab === 'certificate' ? 'certificate' : 'secret', activeSource)}
            >
              Save preference
            </Button>
            <Button size="default" variant="ghost" onclick={() => onOpenChange(false)} class="px-6">
              Close
            </Button>
          </div>
        </div>
      </Sheet.Footer>
    </div>
  </Sheet.Content>
</Sheet.Root>
