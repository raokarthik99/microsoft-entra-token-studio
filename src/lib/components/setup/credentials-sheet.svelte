<script lang="ts">
  import * as Sheet from '$lib/shadcn/components/ui/sheet';
  import * as Tabs from '$lib/shadcn/components/ui/tabs';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import { Button } from '$lib/shadcn/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { Key, Lock, CheckCircle2, AlertTriangle, FileKey, ShieldCheck, ExternalLink, Copy, Info, Shield, Zap, Terminal } from '@lucide/svelte';
  import type { HealthStatus } from '$lib/types';

  interface Props {
    health: HealthStatus;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  let { health, open, onOpenChange }: Props = $props();

  // Determine initial tab based on current config
  let activeTab = $state('secret');
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

  // Reactive checks for each method
  const status = $derived({
    secret: {
      local: {
        configured: health.checks.clientSecret,
        active: health.authMethod === 'secret' && health.authSource === 'local',
      },
      keyvault: {
        configured: health.checks.keyVaultSecret,
        active: health.authMethod === 'secret' && health.authSource === 'keyvault',
      }
    },
    certificate: {
      local: {
        configured: health.checks.localCert,
        active: health.authMethod === 'certificate' && health.authSource === 'local',
      },
      keyvault: {
        configured: health.checks.keyVault,
        active: health.authMethod === 'certificate' && health.authSource === 'keyvault',
      }
    }
  });

  const isConfigured = $derived(health.authMethod !== 'none' && health.authMethod !== undefined);

  function setSource(source: 'local' | 'keyvault') {
    activeSource = source;
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
</script>

<Sheet.Root bind:open onOpenChange={onOpenChange}>
  <Sheet.Content side="right" class="sm:max-w-2xl w-[92vw] h-full p-0">
    <div class="flex h-full flex-col overflow-hidden">
      <Sheet.Header class="space-y-3 p-6 pb-4 border-b border-border/60">
        <div class="space-y-1">
          <Sheet.Title class="text-xl font-semibold tracking-tight">Configure credentials</Sheet.Title>
          <Sheet.Description class="text-sm leading-relaxed text-muted-foreground">
            Choose how the app authenticates with Microsoft Entra ID to issue <strong>app tokens</strong> (client credentials flow).
            Credentials are used server-side only and never exposed to the browser.
          </Sheet.Description>
        </div>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto space-y-5 px-6 py-4">
      <!-- Active Path Card -->
      <div class="rounded-xl border {isConfigured ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent' : 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent'} p-4 transition-all">
        <div class="flex items-center gap-4">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl {isConfigured ? 'bg-emerald-500/10' : 'bg-amber-500/10'} transition-colors">
            {#if health.authMethod === 'certificate'}
              <Key class="h-5 w-5 text-emerald-500" />
            {:else if health.authMethod === 'secret'}
              <Lock class="h-5 w-5 text-emerald-500" />
            {:else}
              <AlertTriangle class="h-5 w-5 text-amber-500" />
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Active Path</p>
              {#if isConfigured}
                <Badge variant="secondary" class="h-5 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
              {:else}
                <Badge variant="outline" class="h-5 text-[10px] text-amber-600 border-amber-500/30">Not configured</Badge>
              {/if}
            </div>
            <p class="text-base font-semibold text-foreground mt-0.5">
              {#if health.authMethod === 'certificate'}
                Certificate · {health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}
              {:else if health.authMethod === 'secret'}
                Secret · {health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}
              {:else}
                Choose a method below
              {/if}
            </p>
          </div>
          <Badge variant="outline" class="h-6 text-[10px] shrink-0">Server-side only</Badge>
        </div>
      </div>

      <!-- How It Works -->
      <div class="rounded-lg border border-dashed bg-muted/20 p-3.5 space-y-3">
        <div class="flex items-center gap-2">
          <Info class="h-4 w-4 text-muted-foreground" />
          <p class="text-xs font-medium text-foreground/80">How credential resolution works</p>
        </div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          The app checks for credentials at startup in priority order. The <strong>first valid configuration found</strong> is used.
          Key Vault options require <code class="bg-muted px-1 rounded text-[10px]">DefaultAzureCredential</code> access (via Azure CLI or managed identity).
        </p>
        <div class="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <Badge variant="outline" class="h-5 text-[9px]">1</Badge>
          <span>Key Vault Cert</span>
          <span class="text-muted-foreground/50">→</span>
          <Badge variant="outline" class="h-5 text-[9px]">2</Badge>
          <span>Local Cert</span>
          <span class="text-muted-foreground/50">→</span>
          <Badge variant="outline" class="h-5 text-[9px]">3</Badge>
          <span>Key Vault Secret</span>
          <span class="text-muted-foreground/50">→</span>
          <Badge variant="outline" class="h-5 text-[9px]">4</Badge>
          <span>Local Secret</span>
        </div>
      </div>

      <!-- Tabs -->
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
        <Tabs.Content value="secret" class="mt-5 space-y-4 animate-in fade-in-50 duration-200">
          <!-- Method Description -->
          <div class="flex items-start gap-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
            <Zap class="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div class="space-y-1">
              <p class="text-xs font-medium text-foreground">Quick setup for development</p>
              <p class="text-[11px] text-muted-foreground leading-relaxed">
                Client secrets are the fastest way to get started. Create one in the Azure portal and paste it into your <code class="bg-muted px-1 rounded">.env</code> file.
                Secrets have expiration dates and need periodic rotation.
              </p>
            </div>
          </div>

          <!-- Step 1: Source Selection -->
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">1</div>
              <div>
                <p class="text-sm font-medium text-foreground">Where is the secret stored?</p>
                <p class="text-xs text-muted-foreground">Pick the source used when issuing app tokens.</p>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <!-- Local Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'local'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'local'
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-muted/30'}"
                onclick={() => setSource('local')}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg {activeSource === 'local' ? 'bg-primary/10' : 'bg-muted'}">
                      <FileKey class="h-4 w-4 {activeSource === 'local' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <p class="text-sm font-medium">.env variable</p>
                      <p class="text-xs text-muted-foreground">Fast local setup</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.secret.local.active}
                      <Badge variant="secondary" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                    {/if}
                    {#if status.secret.local.configured}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                {#if activeSource === 'local'}
                  <p class="mt-3 text-[10px] text-muted-foreground">Best for: Local development, quick prototypes</p>
                  <div class="absolute -bottom-px left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-primary"></div>
                {/if}
              </button>

              <!-- Key Vault Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'keyvault'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'keyvault'
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-muted/30'}"
                onclick={() => setSource('keyvault')}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg {activeSource === 'keyvault' ? 'bg-primary/10' : 'bg-muted'}">
                      <ShieldCheck class="h-4 w-4 {activeSource === 'keyvault' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <p class="text-sm font-medium">Azure Key Vault</p>
                        <Badge variant="outline" class="h-4 text-[8px] px-1 border-emerald-500/30 text-emerald-600">Best</Badge>
                      </div>
                      <p class="text-xs text-muted-foreground">Secure for production</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.secret.keyvault.active}
                      <Badge variant="secondary" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                    {/if}
                    {#if status.secret.keyvault.configured}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                {#if activeSource === 'keyvault'}
                  <p class="mt-3 text-[10px] text-muted-foreground">Best for: Shared/team environments, production</p>
                  <div class="absolute -bottom-px left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-primary"></div>
                {/if}
              </button>
            </div>
          </div>

          <!-- Step 2: Environment Values -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">2</div>
                <div>
                  <p class="text-sm font-medium text-foreground">Add to your .env file</p>
                  <p class="text-xs text-muted-foreground">
                    {#if activeSource === 'local'}
                      Paste the secret value from Azure portal.
                    {:else}
                      Reference your Key Vault and secret name.
                    {/if}
                  </p>
                </div>
              </div>
              {#if activeSource === 'keyvault' && status.secret.keyvault.configured}
                <Badge variant="outline" class="h-5 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">✓ Configured</Badge>
              {:else if activeSource === 'local' && status.secret.local.configured}
                <Badge variant="outline" class="h-5 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">✓ Configured</Badge>
              {/if}
            </div>

            <div class="group relative rounded-lg border bg-muted/30 overflow-hidden">
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

            {#if activeSource === 'local'}
              <!-- Local secret help -->
              <div class="rounded-lg border border-dashed bg-background/50 p-3 space-y-2">
                <p class="text-xs font-medium text-foreground/80">Where to find your secret</p>
                <ol class="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps" target="_blank" rel="noreferrer" class="text-primary hover:underline">App Registrations</a> in Azure portal</li>
                  <li>Select your app → <strong>Certificates & secrets</strong></li>
                  <li>Click <strong>New client secret</strong>, set an expiration, and copy the value</li>
                </ol>
                <p class="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle class="h-3 w-3" />
                  You can only copy the secret immediately after creation. If lost, create a new one.
                </p>
              </div>
            {:else}
              <!-- Key Vault prerequisites -->
              <div class="rounded-lg border border-dashed bg-background/50 p-3 space-y-3">
                <p class="text-xs font-medium text-foreground/80">Prerequisites for Key Vault access</p>
                <p class="text-[11px] text-muted-foreground leading-relaxed">
                  The app uses <code class="bg-muted px-1 rounded">DefaultAzureCredential</code> to authenticate with Key Vault.
                  Locally, this means you must be signed in via Azure CLI. In production, use a managed identity.
                </p>
                <ul class="text-xs text-muted-foreground space-y-1.5">
                  <li class="flex items-start gap-2">
                    <Terminal class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                    <div>
                      <a href="https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli" target="_blank" rel="noreferrer" class="text-primary hover:underline inline-flex items-center gap-1">
                        Sign in via Azure CLI <ExternalLink class="h-3 w-3" />
                      </a>
                      <p class="text-[10px] text-muted-foreground/70 mt-0.5">Run <code class="bg-muted px-1 rounded">az login</code> in your terminal</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-2">
                    <Shield class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                    <div>
                      <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide" target="_blank" rel="noreferrer" class="text-primary hover:underline inline-flex items-center gap-1">
                        Assign Key Vault Secrets User role <ExternalLink class="h-3 w-3" />
                      </a>
                      <p class="text-[10px] text-muted-foreground/70 mt-0.5">Grant your user/identity read access to secrets</p>
                    </div>
                  </li>
                </ul>
              </div>
            {/if}
          </div>
        </Tabs.Content>

        <!-- CERTIFICATE -->
        <Tabs.Content value="certificate" class="mt-5 space-y-4 animate-in fade-in-50 duration-200">
          <!-- Method Description -->
          <div class="flex items-start gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
            <Shield class="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div class="space-y-1">
              <p class="text-xs font-medium text-foreground">More secure, recommended for production</p>
              <p class="text-[11px] text-muted-foreground leading-relaxed">
                Certificates are cryptographically stronger than secrets. The private key never leaves your environment.
                No expiration rotation needed if properly managed in Key Vault.
              </p>
            </div>
          </div>

          <!-- Step 1: Source Selection -->
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">1</div>
              <div>
                <p class="text-sm font-medium text-foreground">Choose certificate source</p>
                <p class="text-xs text-muted-foreground">Use Key Vault for production; local files are great for dev.</p>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <!-- Local Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'local'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'local'
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-muted/30'}"
                onclick={() => setSource('local')}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg {activeSource === 'local' ? 'bg-primary/10' : 'bg-muted'}">
                      <FileKey class="h-4 w-4 {activeSource === 'local' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <p class="text-sm font-medium">Local file</p>
                      <p class="text-xs text-muted-foreground">.pem or .pfx from disk</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.certificate.local.active}
                      <Badge variant="secondary" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                    {/if}
                    {#if status.certificate.local.configured}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                {#if activeSource === 'local'}
                  <p class="mt-3 text-[10px] text-muted-foreground">Best for: Local development, CI/CD with secret files</p>
                  <div class="absolute -bottom-px left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-primary"></div>
                {/if}
              </button>

              <!-- Key Vault Option -->
              <button
                type="button"
                aria-pressed={activeSource === 'keyvault'}
                class="group relative flex flex-col rounded-xl border-2 bg-card/50 p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 {activeSource === 'keyvault'
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-transparent hover:border-border hover:bg-muted/30'}"
                onclick={() => setSource('keyvault')}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg {activeSource === 'keyvault' ? 'bg-primary/10' : 'bg-muted'}">
                      <ShieldCheck class="h-4 w-4 {activeSource === 'keyvault' ? 'text-primary' : 'text-muted-foreground'}" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <p class="text-sm font-medium">Azure Key Vault</p>
                        <Badge variant="outline" class="h-4 text-[8px] px-1 border-emerald-500/30 text-emerald-600">Best</Badge>
                      </div>
                      <p class="text-xs text-muted-foreground">Secure for production</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    {#if status.certificate.keyvault.active}
                      <Badge variant="secondary" class="h-5 text-[9px] bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                    {/if}
                    {#if status.certificate.keyvault.configured}
                      <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                    {/if}
                  </div>
                </div>
                {#if activeSource === 'keyvault'}
                  <p class="mt-3 text-[10px] text-muted-foreground">Best for: Production, private key stays in Key Vault</p>
                  <div class="absolute -bottom-px left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-primary"></div>
                {/if}
              </button>
            </div>
          </div>

          <!-- Step 2: Environment Values -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">2</div>
                <div>
                  <p class="text-sm font-medium text-foreground">Add to your .env file</p>
                  <p class="text-xs text-muted-foreground">
                    {#if activeSource === 'local'}
                      Point to your certificate file (with private key).
                    {:else}
                      Reference your Key Vault and certificate name.
                    {/if}
                  </p>
                </div>
              </div>
              {#if activeSource === 'keyvault' && status.certificate.keyvault.configured}
                <Badge variant="outline" class="h-5 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">✓ Configured</Badge>
              {:else if activeSource === 'local' && status.certificate.local.configured}
                <Badge variant="outline" class="h-5 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">✓ Configured</Badge>
              {/if}
            </div>

            <div class="group relative rounded-lg border bg-muted/30 overflow-hidden">
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

            <!-- Step 3: Upload public key -->
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">3</div>
                <div>
                  <p class="text-sm font-medium text-foreground">Upload public key to Entra</p>
                  <p class="text-xs text-muted-foreground">Required so Microsoft can verify your certificate.</p>
                </div>
              </div>

              <div class="rounded-lg border border-dashed bg-background/50 p-3 space-y-2">
                <ol class="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to your <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps" target="_blank" rel="noreferrer" class="text-primary hover:underline">App Registration</a> → <strong>Certificates & secrets</strong></li>
                  <li>Click <strong>Upload certificate</strong> and select your <code class="bg-muted px-1 rounded text-[10px]">.cer</code> or <code class="bg-muted px-1 rounded text-[10px]">.pem</code> (public key only)</li>
                  <li>The thumbprint will appear after upload</li>
                </ol>
                <a href="https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  Learn more <ExternalLink class="h-3 w-3" />
                </a>
              </div>
            </div>

            {#if activeSource === 'keyvault'}
              <!-- Key Vault prerequisites -->
              <div class="rounded-lg border border-dashed bg-background/50 p-3 space-y-3">
                <p class="text-xs font-medium text-foreground/80">Prerequisites for Key Vault access</p>
                <p class="text-[11px] text-muted-foreground leading-relaxed">
                  The app downloads both the certificate and private key from Key Vault at runtime.
                  Your identity needs permission to read certificate secrets (not just certificates).
                </p>
                <ul class="text-xs text-muted-foreground space-y-1.5">
                  <li class="flex items-start gap-2">
                    <Terminal class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                    <div>
                      <a href="https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli" target="_blank" rel="noreferrer" class="text-primary hover:underline inline-flex items-center gap-1">
                        Sign in via Azure CLI <ExternalLink class="h-3 w-3" />
                      </a>
                      <p class="text-[10px] text-muted-foreground/70 mt-0.5">Run <code class="bg-muted px-1 rounded">az login</code> in your terminal</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-2">
                    <Shield class="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                    <div>
                      <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide" target="_blank" rel="noreferrer" class="text-primary hover:underline inline-flex items-center gap-1">
                        Assign Key Vault Secrets User role <ExternalLink class="h-3 w-3" />
                      </a>
                      <p class="text-[10px] text-muted-foreground/70 mt-0.5">Required to read the private key from Key Vault certificates</p>
                    </div>
                  </li>
                </ul>
              </div>
            {:else}
              <!-- Local cert help -->
              <div class="rounded-lg border border-dashed bg-background/50 p-3 space-y-2">
                <p class="text-xs font-medium text-foreground/80">Certificate file format</p>
                <p class="text-[11px] text-muted-foreground leading-relaxed">
                  The file must contain <strong>both</strong> the certificate and private key.
                  PEM format is recommended. If using PFX, ensure it's not password-protected.
                </p>
                <p class="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle class="h-3 w-3" />
                  Never commit certificate files to source control.
                </p>
              </div>
            {/if}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>

      <!-- Footer -->
      <Sheet.Footer class="mt-0 border-t border-border/60 p-4 pt-3">
        <div class="flex items-center justify-between w-full gap-3">
          <a
            href="https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow"
            target="_blank"
            rel="noreferrer"
            class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            Learn more about credentials <ExternalLink class="h-3 w-3" />
          </a>
          <Button size="default" onclick={() => onOpenChange(false)} class="px-8">
            Done
          </Button>
        </div>
      </Sheet.Footer>
    </div>
  </Sheet.Content>
</Sheet.Root>
