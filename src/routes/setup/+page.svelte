<script lang="ts">
  import { onMount } from 'svelte';
  import type { HealthStatus } from '$lib/types';
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { toast } from "svelte-sonner";

  import {
    Sparkles,
    ListChecks,
    Copy,
    ArrowRight,
    ExternalLink,
    AlertTriangle,
    CheckCircle2,
    Info,
    Loader2,
    RefreshCw
  } from "@lucide/svelte";

  let health = $state<HealthStatus | null>(null);
  let clientId = $state<string | null>(null);
  let healthLoading = $state(false);

  const resolvedRedirectUri = $derived(
    health?.redirectUri ||
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback')
  );

  const setupChecklist = $derived([
    {
      key: 'tenant',
      label: 'Tenant ID',
      ok: Boolean(health?.checks?.tenantId),
      helper: health?.tenant || 'Set TENANT_ID to your directory ID.',
    },
    {
      key: 'clientId',
      label: 'Client ID',
      ok: Boolean(health?.checks?.clientId),
      helper: health?.clientId || 'Set CLIENT_ID from your Entra app registration.',
    },
    {
      key: 'clientSecret',
      label: 'Client secret',
      ok: Boolean(health?.checks?.clientSecret),
      helper: health?.checks?.clientSecret ? 'Secret loaded on server' : 'Set CLIENT_SECRET and restart the dev server.',
    },
    {
      key: 'redirect',
      label: 'Redirect URI',
      ok: Boolean(health?.checks?.redirectUri || health?.redirectUri),
      helper: resolvedRedirectUri,
    },
  ]);

  const appListLink = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
  const appRedirectLink = $derived(
    clientId
      ? `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/${clientId}`
      : appListLink
  );

  const setupStatusLabel = $derived(
    health ? (health.status === 'ok' ? 'Ready' : 'Check config') : 'Checking'
  );
  const setupStatusTone: 'secondary' | 'outline' | 'destructive' = $derived(
    health?.status === 'ok' ? 'secondary' : 'outline'
  );
  const missingCount = $derived(health?.missing?.length ?? 0);
  const showTroubleshooting = $derived(Boolean(missingCount));

  onMount(() => {
    refreshHealth();
  });

  async function refreshHealth() {
    healthLoading = true;
    try {
      const res = await fetch('/api/health');
      const data: HealthStatus = await res.json();
      health = data;
      clientId = data.clientId;
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

<div class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ListChecks class="h-5 w-5" />
      </div>
      <div>
        <p class="text-lg font-semibold leading-tight">Setup</p>
        <p class="text-sm text-muted-foreground">Validate tenant and app configuration before issuing tokens.</p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Badge variant={setupStatusTone} class="gap-2">
        {#if healthLoading}
          <Loader2 class="h-3.5 w-3.5 animate-spin" />
        {:else}
          <Sparkles class="h-3.5 w-3.5" />
        {/if}
        {setupStatusLabel}
      </Badge>
      <Button variant="outline" class="gap-2" onclick={refreshHealth} disabled={healthLoading}>
        {#if healthLoading}
          <Loader2 class="h-4 w-4 animate-spin" />
          Refreshing
        {:else}
          <RefreshCw class="h-4 w-4" />
          Re-run health
        {/if}
      </Button>
      <Button variant="secondary" class="gap-2" href="/">
        Playground
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>
  </div>

  <section class="rounded-2xl border bg-card shadow-sm overflow-hidden">
    <div class="border-b bg-muted/30 px-5 py-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-primary" />
            <h3 class="font-semibold text-foreground">Configuration</h3>
          </div>
          <Separator orientation="vertical" class="h-4" />
        </div>
        <a href={appRedirectLink} target="_blank" class="flex items-center gap-1 text-xs text-primary hover:underline" rel="noreferrer">
          Open in Entra portal <ArrowRight class="h-3 w-3" />
        </a>
      </div>
    </div>

    <div class="p-5">
      <div class="grid gap-8 lg:grid-cols-2">
        <div class="space-y-5">
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">Client configuration</h4>
            <p class="text-xs text-muted-foreground">Values below are read from your server environment.</p>
          </div>

          <div class="rounded-xl border bg-muted/30 p-4 space-y-4">
            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground">Tenant ID</Label>
              <div class="flex gap-2">
                <code class="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground/90">
                  {health?.tenant || 'Not set (TENANT_ID)'}
                </code>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={() => copyToClipboard(health?.tenant || '')} disabled={!health?.tenant} title="Copy Tenant ID">
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground">Client ID</Label>
              <div class="flex gap-2">
                <code class="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground/90">
                  {clientId || 'Not set (CLIENT_ID)'}
                </code>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={() => copyToClipboard(clientId || '')} disabled={!clientId} title="Copy Client ID">
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <Label class="text-xs text-muted-foreground">Redirect URI</Label>
                <div class="flex items-center gap-3">
                  <a 
                    href="https://learn.microsoft.com/en-us/entra/identity-platform/reply-url" 
                    target="_blank" 
                    rel="noreferrer" 
                    class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:underline"
                    title="Learn about Redirect URIs"
                  >
                    Docs <ExternalLink class="h-2.5 w-2.5" />
                  </a>
                  <a 
                    href={appRedirectLink} 
                    target="_blank" 
                    rel="noreferrer" 
                    class="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    Add to App Registration <ArrowRight class="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
              <div class="flex gap-2">
                <code class="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground/90 break-all">
                  {resolvedRedirectUri}
                </code>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={() => copyToClipboard(resolvedRedirectUri)} title="Copy Redirect URI">
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
              <p class="text-[10px] text-muted-foreground">
                Must exactly match the value in Entra (case-sensitive). Ensure this is added as a "Single-page application" platform.
              </p>
            </div>

            <div class="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 p-3">
              <Info class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div class="space-y-1">
                <p class="text-xs font-medium text-foreground">Changing the application</p>
                <p class="text-xs text-muted-foreground">
                  Update <code class="font-mono text-[10px]">TENANT_ID</code>, <code class="font-mono text-[10px]">CLIENT_ID</code>, and <code class="font-mono text-[10px]">CLIENT_SECRET</code> in your <code class="font-mono text-[10px]">.env</code>. To change the redirect URI, set <code class="font-mono text-[10px]">REDIRECT_URI</code>. Restart the server to apply.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-5">
          <h4 class="text-sm font-medium text-foreground">Configuration Status</h4>
          
          <div class="space-y-2">
            {#each setupChecklist as item}
              <div class={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${item.ok ? 'bg-background/50 border-border/50' : 'bg-amber-500/5 border-amber-500/20'}`}>
                {#if item.ok}
                  <CheckCircle2 class="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                {:else}
                  <AlertTriangle class="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                {/if}
                <div class="space-y-0.5">
                  <div class="text-sm font-medium leading-none text-foreground">{item.label}</div>
                  <p class="text-xs text-muted-foreground">{item.helper}</p>
                </div>
              </div>
            {/each}
          </div>

          {#if showTroubleshooting}
            <div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div class="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-600">
                <Sparkles class="h-3.5 w-3.5" />
                <span>Suggested fixes</span>
              </div>
              <div class="space-y-2">
                {#each health?.missing || [] as missingItem}
                  <div class="flex items-start gap-2 text-xs text-muted-foreground">
                    <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500"></span>
                    <span>Set {missingItem} in your .env/.env.local and restart the dev server.</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>
