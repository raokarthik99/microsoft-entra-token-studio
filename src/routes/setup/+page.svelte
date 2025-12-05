<script lang="ts">
  import { onMount } from 'svelte';
  import type { HealthStatus } from '$lib/types';
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { toast } from "svelte-sonner";
  import {
    Copy,
    ArrowRight,
    ExternalLink,
    Loader2,
    RefreshCw,
    Key,
    Lock,
    Settings2
  } from "@lucide/svelte";
  import SetupStep from "$lib/components/setup/setup-step.svelte";
  import SetupProgress from "$lib/components/setup/setup-progress.svelte";
  import CredentialsSheet from "$lib/components/setup/credentials-sheet.svelte";

  let health = $state<HealthStatus | null>(null);
  let healthLoading = $state(false);
  let credentialsOpen = $state(false);

  // Derived status for each step
  const stepStatuses = $derived({
    identity: (health?.checks?.tenantId && health?.checks?.clientId ? 'complete' : 'pending') as 'pending' | 'complete' | 'error',
    credentials: (health?.authMethod !== 'none' ? 'complete' : 'pending') as 'pending' | 'complete' | 'error',
    redirect: (health?.redirectUri ? 'complete' : 'pending') as 'pending' | 'complete' | 'error',
  });

  type StepStatus = 'pending' | 'complete' | 'error';
  
  const steps = $derived<Array<{ status: StepStatus }>>([
    { status: stepStatuses.identity },
    { status: stepStatuses.credentials },
    { status: stepStatuses.redirect },
  ]);

  const allComplete = $derived(steps.every(s => s.status === 'complete'));

  const resolvedRedirectUri = $derived(
    health?.redirectUri ||
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback')
  );

  const appRedirectLink = $derived(
    health?.clientId
      ? `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/${health.clientId}`
      : 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
  );

  const credentialLabel = $derived(() => {
    if (!health) return 'Not configured';
    if (health.authMethod === 'certificate') {
      return `Certificate · ${health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}`;
    }
    if (health.authMethod === 'secret') {
      return `Secret · ${health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}`;
    }
    return 'Not configured';
  });

  onMount(() => {
    refreshHealth();
  });

  async function refreshHealth() {
    healthLoading = true;
    try {
      const res = await fetch('/api/health');
      const data: HealthStatus = await res.json();
      health = data;
    } catch (err) {
      console.error('Failed to fetch config', err);
      toast.error('Unable to load setup status');
    } finally {
      healthLoading = false;
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error('Copy failed');
    }
  }
</script>

<svelte:head>
  <title>Setup | Entra Token Client</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-8">
  <!-- Header -->
  <div class="space-y-2">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Settings2 class="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 class="text-xl font-semibold">Setup</h1>
        <p class="text-sm text-muted-foreground">Configure your app to issue tokens</p>
      </div>
    </div>
  </div>

  <!-- Progress Bar -->
  {#if health}
    <SetupProgress {steps} />
  {:else}
    <div class="h-10 flex items-center justify-center">
      <Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  {/if}

  <!-- Steps -->
  <div class="space-y-4">
    <!-- Step 1: App Identity -->
    <SetupStep 
      step={1} 
      title="App Identity" 
      status={stepStatuses.identity}
      description={health?.clientId ? `Client: ${health.clientId.slice(0, 8)}...` : 'Configure tenant and client'}
      collapsible
      defaultOpen={stepStatuses.identity === 'pending'}
    >
      <div class="space-y-4">
        <!-- Tenant ID -->
        <div class="space-y-1.5">
          <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tenant ID</span>
          <div class="flex gap-2">
            <code class="flex-1 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground/90">
              {health?.tenant || 'Not set'}
            </code>
            <Button variant="ghost" size="icon" class="shrink-0 h-9 w-9" onclick={() => copyToClipboard(health?.tenant || '')} disabled={!health?.tenant} title="Copy">
              <Copy class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <!-- Client ID -->
        <div class="space-y-1.5">
          <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Client ID</span>
          <div class="flex gap-2">
            <code class="flex-1 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground/90">
              {health?.clientId || 'Not set'}
            </code>
            <Button variant="ghost" size="icon" class="shrink-0 h-9 w-9" onclick={() => copyToClipboard(health?.clientId || '')} disabled={!health?.clientId} title="Copy">
              <Copy class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          Set <code class="bg-muted px-1 rounded text-[10px]">TENANT_ID</code> and <code class="bg-muted px-1 rounded text-[10px]">CLIENT_ID</code> in your <code class="bg-muted px-1 rounded text-[10px]">.env</code> file.
        </p>
      </div>
    </SetupStep>

    <!-- Step 2: Credentials -->
    <SetupStep 
      step={2} 
      title="Credentials" 
      status={stepStatuses.credentials}
      description={credentialLabel()}
      collapsible
      defaultOpen={stepStatuses.credentials === 'pending'}
    >
      <div class="space-y-4">
        <!-- Current Method Display -->
        <div class="flex flex-col gap-3 rounded-xl border bg-gradient-to-br from-muted/60 via-muted/30 to-transparent p-3.5 sm:p-4">
          <div class="flex items-start justify-between gap-3 sm:gap-4">
            <div class="flex items-start gap-3 sm:gap-4">
              {#if health?.authMethod === 'certificate'}
                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Key class="h-5 w-5 text-emerald-500" />
                </div>
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active path</span>
                    <Badge variant="secondary" class="h-5 text-[10px] bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-semibold text-foreground">Certificate · {health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}</p>
                    <Badge variant="outline" class="h-5 text-[10px] border-muted-foreground/40 text-muted-foreground">Server-side only</Badge>
                  </div>
                  <p class="text-xs text-muted-foreground">{health.authSource === 'keyvault' ? 'Azure Key Vault' : 'Local certificate file'}</p>
                </div>
              {:else if health?.authMethod === 'secret'}
                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                  <Lock class="h-5 w-5 text-blue-500" />
                </div>
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active path</span>
                    <Badge variant="secondary" class="h-5 text-[10px] bg-blue-500/10 text-blue-600 border-0">Active</Badge>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-semibold text-foreground">Secret · {health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}</p>
                    <Badge variant="outline" class="h-5 text-[10px] border-muted-foreground/40 text-muted-foreground">Server-side only</Badge>
                  </div>
                  <p class="text-xs text-muted-foreground">{health?.authSource === 'keyvault' ? 'Azure Key Vault' : 'Environment variable'}</p>
                </div>
              {:else}
                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-muted ring-1 ring-border">
                  <Lock class="h-5 w-5 text-muted-foreground" />
                </div>
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active path</span>
                    <Badge variant="outline" class="h-5 text-[10px]">Pending</Badge>
                  </div>
                  <p class="text-sm font-semibold text-foreground">Choose a credential path</p>
                  <p class="text-xs text-muted-foreground">Select secret or certificate to continue</p>
                </div>
              {/if}
            </div>
            <Button
              variant={health?.authMethod ? 'outline' : 'default'}
              size="sm"
              onclick={() => credentialsOpen = true}
              class="shrink-0 gap-1.5 self-start sm:self-center"
            >
              Configure
            </Button>
          </div>
        </div>

        <!-- Connection Status -->
        {#if health?.authSource === 'keyvault' && health?.keyVault}
          <div class="flex items-center gap-2 text-xs">
            {#if health.keyVault.status === 'connected'}
              <Badge variant="outline" class="text-emerald-600 border-emerald-500/30">Connected</Badge>
              <span class="text-muted-foreground">Key Vault is accessible</span>
            {:else}
              <Badge variant="outline" class="text-red-600 border-red-500/30">Error</Badge>
              <span class="text-red-500">{health.keyVault.error || 'Connection failed'}</span>
            {/if}
          </div>
        {/if}
      </div>
    </SetupStep>

    <!-- Step 3: Redirect URI -->
    <SetupStep 
      step={3} 
      title="Redirect URI" 
      status={stepStatuses.redirect}
      description="For user token flows"
      collapsible
      defaultOpen={stepStatuses.redirect === 'pending'}
    >
      <div class="space-y-4">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Callback URL</span>
            <a 
              href={appRedirectLink} 
              target="_blank" 
              rel="noreferrer" 
              class="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              Add to App Registration <ExternalLink class="h-2.5 w-2.5" />
            </a>
          </div>
          <div class="flex gap-2">
            <code class="flex-1 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground/90 break-all">
              {resolvedRedirectUri}
            </code>
            <Button variant="ghost" size="icon" class="shrink-0 h-9 w-9" onclick={() => copyToClipboard(resolvedRedirectUri)} title="Copy">
              <Copy class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          This must exactly match the redirect URI in your Entra app registration. Add it as a <strong>Single-page application</strong> platform.
        </p>
      </div>
    </SetupStep>
  </div>

  <!-- Actions -->
  <div class="flex items-center justify-between pt-4">
    <Button variant="outline" onclick={refreshHealth} disabled={healthLoading} class="gap-2">
      {#if healthLoading}
        <Loader2 class="h-4 w-4 animate-spin" />
      {:else}
        <RefreshCw class="h-4 w-4" />
      {/if}
      Refresh
    </Button>

    <Button href="/" disabled={!allComplete} class="gap-2">
      {#if allComplete}
        Go to Playground
      {:else}
        Complete setup to continue
      {/if}
      <ArrowRight class="h-4 w-4" />
    </Button>
  </div>
</div>

<!-- Credentials Sheet -->
{#if health}
  <CredentialsSheet {health} open={credentialsOpen} onOpenChange={(v) => credentialsOpen = v} />
{/if}
