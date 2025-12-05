<script lang="ts">
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/shadcn/components/ui/tabs';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/shadcn/components/ui/card';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import { Separator } from '$lib/shadcn/components/ui/separator';
  import { Key, Lock, CheckCircle2, AlertTriangle, FileKey, ShieldCheck, Info } from '@lucide/svelte';
  import type { HealthStatus } from '$lib/types';

  interface Props {
    health: HealthStatus;
  }

  let { health }: Props = $props();

  // Determine initial tab based on current config
  let activeTab = $state('secret');
  if (health.authMethod === 'certificate') {
    activeTab = 'certificate';
  }

  // Determine initial source based on current config
  let activeSource = $state('local');
  if (health.authSource === 'keyvault') {
    activeSource = 'keyvault';
  } else if (health.authSource === 'local') {
    activeSource = 'local';
  }

  // Reactive checks for each method
  const status = $derived({
    secret: {
      local: {
        configured: health.checks.clientSecret,
        active: health.authMethod === 'secret' && health.authSource === 'local',
        precedence: 4 // Lowest
      },
      keyvault: {
        configured: health.checks.keyVaultSecret,
        active: health.authMethod === 'secret' && health.authSource === 'keyvault',
        precedence: 3
      }
    },
    certificate: {
      local: {
        configured: health.checks.localCert,
        active: health.authMethod === 'certificate' && health.authSource === 'local',
        precedence: 2
      },
      keyvault: {
        configured: health.checks.keyVault,
        active: health.authMethod === 'certificate' && health.authSource === 'keyvault',
        precedence: 1 // Highest
      }
    }
  });

  function setSource(source: 'local' | 'keyvault') {
    activeSource = source;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium">Credentials</h3>
      <p class="text-sm text-muted-foreground">
        Configure how the application authenticates with Microsoft Entra ID.
      </p>
    </div>
    
    <!-- Active Method Badge -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-muted-foreground">Active:</span>
      {#if health.authMethod === 'certificate'}
        <Badge variant="default" class="bg-emerald-600 hover:bg-emerald-700 gap-1.5 pl-1.5">
          <Key class="h-3.5 w-3.5" />
          Certificate ({health.authSource === 'keyvault' ? 'Key Vault' : 'Local'})
        </Badge>
      {:else if health.authMethod === 'secret'}
        <Badge variant="default" class="bg-blue-600 hover:bg-blue-700 gap-1.5 pl-1.5">
          <Lock class="h-3.5 w-3.5" />
          Client Secret ({health.authSource === 'keyvault' ? 'Key Vault' : 'Local'})
        </Badge>
      {:else}
        <Badge variant="destructive" class="gap-1.5 pl-1.5">
          <AlertTriangle class="h-3.5 w-3.5" />
          Not Configured
        </Badge>
      {/if}
    </div>
  </div>

  <Tabs value={activeTab} onValueChange={(v: string) => activeTab = v} class="w-full">
    <TabsList class="grid w-full grid-cols-2">
      <TabsTrigger value="secret" class="gap-2">
        <Lock class="h-4 w-4" />
        Client Secret
      </TabsTrigger>
      <TabsTrigger value="certificate" class="gap-2">
        <Key class="h-4 w-4" />
        Certificate
      </TabsTrigger>
    </TabsList>

    <!-- CLIENT SECRET CONTENT -->
    <TabsContent value="secret" class="space-y-4 mt-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Local Secret Option -->
        <button 
          class={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:bg-accent ${activeSource === 'local' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
          onclick={() => setSource('local')}
        >
          <div class="flex w-full items-center justify-between">
            <span class="font-semibold flex items-center gap-2">
              <FileKey class="h-4 w-4" />
              Environment Variable
            </span>
            {#if status.secret.local.configured}
              <CheckCircle2 class="h-4 w-4 text-emerald-500" />
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">
            Store the secret directly in your .env file. Simplest for local development.
          </p>
          {#if status.secret.local.active}
            <Badge variant="secondary" class="mt-2 text-[10px] h-5">Currently Active</Badge>
          {/if}
        </button>

        <!-- Key Vault Secret Option -->
        <button 
          class={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:bg-accent ${activeSource === 'keyvault' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
          onclick={() => setSource('keyvault')}
        >
          <div class="flex w-full items-center justify-between">
            <span class="font-semibold flex items-center gap-2">
              <ShieldCheck class="h-4 w-4" />
              Azure Key Vault
            </span>
            {#if status.secret.keyvault.configured}
              <CheckCircle2 class="h-4 w-4 text-emerald-500" />
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">
            Fetch the secret securely from Key Vault. Best for centralized management.
          </p>
          {#if status.secret.keyvault.active}
            <Badge variant="secondary" class="mt-2 text-[10px] h-5">Currently Active</Badge>
          {/if}
        </button>
      </div>

      <!-- Guidance Panel for Secret -->
      <Card class="bg-muted/30">
        <CardHeader class="pb-3">
          <CardTitle class="text-base flex items-center gap-2">
            {#if activeSource === 'local'}
              Configuration: Local Client Secret
            {:else}
              Configuration: Key Vault Client Secret
            {/if}
          </CardTitle>
          <CardDescription>
            {#if activeSource === 'local'}
              Add the client secret to your environment variables.
            {:else}
              Configure the application to fetch the secret from Azure Key Vault.
            {/if}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Env Vars -->
          <div class="space-y-2">
            <p class="text-sm font-medium">Required Environment Variables (.env)</p>
            <div class="rounded-md bg-muted p-3 font-mono text-xs space-y-1">
              {#if activeSource === 'local'}
                <div class="flex items-center gap-2">
                  <span class="text-blue-500">CLIENT_SECRET</span>=your_secret_value
                  {#if status.secret.local.configured}
                    <CheckCircle2 class="h-3 w-3 text-emerald-500 ml-auto" />
                  {/if}
                </div>
              {:else}
                <div class="flex items-center gap-2">
                  <span class="text-blue-500">AZURE_KEYVAULT_URI</span>=https://your-vault.vault.azure.net/
                  {#if health.checks.keyVault || health.checks.keyVaultSecret}
                    <CheckCircle2 class="h-3 w-3 text-emerald-500 ml-auto" />
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-blue-500">AZURE_KEYVAULT_SECRET_NAME</span>=your-secret-name
                  {#if status.secret.keyvault.configured}
                    <CheckCircle2 class="h-3 w-3 text-emerald-500 ml-auto" />
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          <!-- Prerequisites (Key Vault only) -->
          {#if activeSource === 'keyvault'}
            <Separator />
            <div class="space-y-2">
              <p class="text-sm font-medium">Prerequisites</p>
              <ul class="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                <li>
                  <strong>Authentication:</strong> Uses <a href="https://learn.microsoft.com/en-us/dotnet/azure/sdk/authentication/credential-chains?tabs=dac#defaultazurecredential-overview" target="_blank" rel="noreferrer" class="text-primary hover:underline">DefaultAzureCredential</a>. 
                  Log in via <a href="https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account" target="_blank" rel="noreferrer" class="text-primary hover:underline">VS Code Azure Account</a> or <a href="https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli" target="_blank" rel="noreferrer" class="text-primary hover:underline">Azure CLI</a> (<code>az login</code>).
                </li>
                <li>
                  <strong>RBAC:</strong> Assign <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide?tabs=azure-cli#azure-built-in-roles-for-key-vault-data-plane-operations" target="_blank" rel="noreferrer" class="text-primary hover:underline">Key Vault Secrets User</a> role to your identity.
                </li>
              </ul>
            </div>
          {/if}

          <!-- Status Alert -->
          {#if activeSource === 'keyvault' && status.secret.keyvault.configured}
             <div class="rounded-md border bg-background p-3">
               <div class="flex items-center gap-2 mb-2">
                 <span class="text-xs font-medium">Connection Status</span>
                 {#if health.keyVault?.status === 'connected'}
                   <Badge variant="outline" class="text-emerald-600 border-emerald-500/30">Connected</Badge>
                 {:else}
                   <Badge variant="outline" class="text-red-600 border-red-500/30">Error</Badge>
                 {/if}
               </div>
               {#if health.keyVault?.error}
                 <p class="text-xs text-red-500">{health.keyVault.error}</p>
               {:else if health.keyVault?.status === 'connected'}
                 <p class="text-xs text-muted-foreground">Successfully connected to Key Vault and verified secret existence.</p>
               {/if}
             </div>
          {/if}
        </CardContent>
      </Card>
    </TabsContent>

    <!-- CERTIFICATE CONTENT -->
    <TabsContent value="certificate" class="space-y-4 mt-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Local Cert Option -->
        <button 
          class={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:bg-accent ${activeSource === 'local' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
          onclick={() => setSource('local')}
        >
          <div class="flex w-full items-center justify-between">
            <span class="font-semibold flex items-center gap-2">
              <FileKey class="h-4 w-4" />
              Local File
            </span>
            {#if status.certificate.local.configured}
              <CheckCircle2 class="h-4 w-4 text-emerald-500" />
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">
            Load a .pem or .pfx file from your local disk. Good for local testing with certs.
          </p>
          {#if status.certificate.local.active}
            <Badge variant="secondary" class="mt-2 text-[10px] h-5">Currently Active</Badge>
          {/if}
        </button>

        <!-- Key Vault Cert Option -->
        <button 
          class={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:bg-accent ${activeSource === 'keyvault' ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}
          onclick={() => setSource('keyvault')}
        >
          <div class="flex w-full items-center justify-between">
            <span class="font-semibold flex items-center gap-2">
              <ShieldCheck class="h-4 w-4" />
              Azure Key Vault
            </span>
            {#if status.certificate.keyvault.configured}
              <CheckCircle2 class="h-4 w-4 text-emerald-500" />
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">
            Fetch certificate from Key Vault. Recommended for production.
          </p>
          {#if status.certificate.keyvault.active}
            <Badge variant="secondary" class="mt-2 text-[10px] h-5">Currently Active</Badge>
          {/if}
        </button>
      </div>

      <!-- Guidance Panel for Certificate -->
      <Card class="bg-muted/30">
        <CardHeader class="pb-3">
          <CardTitle class="text-base flex items-center gap-2">
            {#if activeSource === 'local'}
              Configuration: Local Certificate File
            {:else}
              Configuration: Key Vault Certificate
            {/if}
          </CardTitle>
          <CardDescription>
            {#if activeSource === 'local'}
              Point the application to a local certificate file.
            {:else}
              Configure the application to fetch the certificate from Azure Key Vault.
            {/if}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Env Vars -->
          <div class="space-y-2">
            <p class="text-sm font-medium">Required Environment Variables (.env)</p>
            <div class="rounded-md bg-muted p-3 font-mono text-xs space-y-1">
              {#if activeSource === 'local'}
                <div class="flex items-center gap-2">
                  <span class="text-blue-500">CERTIFICATE_PATH</span>=/absolute/path/to/cert.pem
                  {#if status.certificate.local.configured}
                    <CheckCircle2 class="h-3 w-3 text-emerald-500 ml-auto" />
                  {/if}
                </div>
              {:else}
                <div class="flex items-center gap-2">
                  <span class="text-blue-500">AZURE_KEYVAULT_URI</span>=https://your-vault.vault.azure.net/
                  {#if health.checks.keyVault || health.checks.keyVaultSecret}
                    <CheckCircle2 class="h-3 w-3 text-emerald-500 ml-auto" />
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-blue-500">AZURE_KEYVAULT_CERT_NAME</span>=your-cert-name
                  {#if status.certificate.keyvault.configured}
                    <CheckCircle2 class="h-3 w-3 text-emerald-500 ml-auto" />
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          <!-- Prerequisites -->
          <Separator />
          <div class="space-y-2">
            <p class="text-sm font-medium">Prerequisites</p>
            <ul class="text-xs text-muted-foreground space-y-2 list-disc pl-4">
              <li>
                <strong>App Registration:</strong> Upload the public key (.cer/.pem) to <a href="https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials" target="_blank" rel="noreferrer" class="text-primary hover:underline">Entra App Registration</a>.
              </li>
              {#if activeSource === 'keyvault'}
                <li>
                  <strong>Authentication:</strong> Uses <a href="https://learn.microsoft.com/en-us/dotnet/azure/sdk/authentication/credential-chains?tabs=dac#defaultazurecredential-overview" target="_blank" rel="noreferrer" class="text-primary hover:underline">DefaultAzureCredential</a>.
                </li>
                <li>
                  <strong>RBAC:</strong> Assign <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide?tabs=azure-cli#azure-built-in-roles-for-key-vault-data-plane-operations" target="_blank" rel="noreferrer" class="text-primary hover:underline">Key Vault Administrator</a> (simplest) or <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide?tabs=azure-cli#azure-built-in-roles-for-key-vault-data-plane-operations" target="_blank" rel="noreferrer" class="text-primary hover:underline">Certificate User</a> + <a href="https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide?tabs=azure-cli#azure-built-in-roles-for-key-vault-data-plane-operations" target="_blank" rel="noreferrer" class="text-primary hover:underline">Secrets User</a>.
                </li>
                <li>
                  <strong>Need a certificate?</strong> <a href="https://learn.microsoft.com/en-us/azure/key-vault/certificates/quick-create-portal" target="_blank" rel="noreferrer" class="text-primary hover:underline">Create self-signed in Key Vault</a>.
                </li>
              {:else}
                <li>
                  <strong>Format:</strong> Supports PEM (with private key) or PFX.
                </li>
              {/if}
            </ul>
          </div>

          <!-- Status Alert -->
          {#if activeSource === 'keyvault' && status.certificate.keyvault.configured}
             <div class="rounded-md border bg-background p-3">
               <div class="flex items-center gap-2 mb-2">
                 <span class="text-xs font-medium">Connection Status</span>
                 {#if health.keyVault?.status === 'connected'}
                   <Badge variant="outline" class="text-emerald-600 border-emerald-500/30">Connected</Badge>
                 {:else}
                   <Badge variant="outline" class="text-red-600 border-red-500/30">Error</Badge>
                 {/if}
               </div>
               {#if health.keyVault?.error}
                 <p class="text-xs text-red-500">{health.keyVault.error}</p>
               {:else if health.keyVault?.status === 'connected'}
                 <p class="text-xs text-muted-foreground">Successfully connected to Key Vault and retrieved certificate.</p>
               {/if}
             </div>
          {:else if activeSource === 'local' && status.certificate.local.configured}
             <div class="rounded-md border bg-background p-3">
               <div class="flex items-center gap-2 mb-2">
                 <span class="text-xs font-medium">File Status</span>
                 {#if health.localCert?.status === 'loaded'}
                   <Badge variant="outline" class="text-emerald-600 border-emerald-500/30">Loaded</Badge>
                 {:else}
                   <Badge variant="outline" class="text-red-600 border-red-500/30">Error</Badge>
                 {/if}
               </div>
               {#if health.localCert?.error}
                 <p class="text-xs text-red-500">{health.localCert.error}</p>
               {:else if health.localCert?.status === 'loaded'}
                 <p class="text-xs text-muted-foreground">Successfully loaded certificate file.</p>
               {/if}
             </div>
          {/if}
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
