<script lang="ts">
  import { onMount } from 'svelte';
  import type { HistoryItem, TokenData } from '$lib/types';
  import { parseJwt } from '$lib/utils';
  
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Label } from "$lib/shadcn/components/ui/label";
  import * as Card from "$lib/shadcn/components/ui/card";
  import * as Tabs from "$lib/shadcn/components/ui/tabs";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  
  import { 
    RotateCcw,
    User,
    History,
    ChevronDown,
    ChevronRight,
    Copy,
    Play,
    LogIn,
    Trash2,
    Loader2,
    Check,
    ShieldCheck,
    Clock3,
    ListChecks,
    AlertTriangle,
    Info,
    Sparkles,
    CheckCircle2,
    Wand2,
    Link2,
    ShieldHalf,
    Zap,
    ArrowRight,
    Eye,
    EyeOff
  } from "@lucide/svelte";

  type HealthStatus = {
    status: 'ok' | 'incomplete';
    tenant: string | null;
    clientId: string | null;
    authority: string | null;
    redirectUri: string;
    checks: {
      tenantId: boolean;
      clientId: boolean;
      clientSecret: boolean;
      redirectUri: boolean;
    };
    missing: string[];
  };

  let activeTab = $state('app-token');
  let resource = $state('https://graph.microsoft.com');
  let scopes = $state('User.Read');
  let history = $state<HistoryItem[]>([]);
  let result = $state<TokenData | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let clientId = $state<string | null>(null);
  let health = $state<HealthStatus | null>(null);
  let healthLoading = $state(false);
  let copied = $state(false);
  let historyFilter = $state<'all' | 'app' | 'user'>('all');
  let tokenVisible = $state(true);
  let hasAutoScrolled = $state(false);


  let decodedClaims = $derived(result ? parseJwt(result.accessToken) : null);
  const expiresOnDate = $derived(result?.expiresOn ? new Date(result.expiresOn) : null);
  const expiresInMinutes = $derived(expiresOnDate ? Math.max(0, Math.round((expiresOnDate.getTime() - Date.now()) / 60000)) : null);
  const historyCount = $derived(history.length);
  const resultKind = $derived(result ? (result.scopes?.length ? 'User Token' : 'App Token') : '');
  const issuedAtDate = $derived(decodedClaims?.iat ? new Date(Number((decodedClaims as any).iat) * 1000) : null);
  const audienceClaim = $derived((() => {
    if (!decodedClaims || !(decodedClaims as any).aud) return null;
    const aud = (decodedClaims as any).aud;
    return Array.isArray(aud) ? aud.join(', ') : String(aud);
  })());
  const issuerClaim = $derived(decodedClaims?.iss ? String((decodedClaims as any).iss) : null);
  const tenantClaim = $derived((() => {
    if (!decodedClaims) return null;
    return (decodedClaims as any).tid || (decodedClaims as any).tenantId || null;
  })());
  const toResourceScope = (value: string) => {
    const cleaned = value.replace(/\/+$/, '');
    return cleaned.toLowerCase().endsWith('/.default') ? cleaned : `${cleaned}/.default`;
  };
  const computedResourceScope = $derived(toResourceScope(resource));
  const resultScopes = $derived((() => {
    if (!result) return [];
    if (result.scopes?.length) return result.scopes;
    if (result.scope) return result.scope.split(' ').filter(Boolean);
    return [];
  })());

  const resourcePresets = [
    { label: 'Microsoft Graph', value: 'https://graph.microsoft.com' },
    { label: 'Azure Resource Manager', value: 'https://management.azure.com' },
    { label: 'Custom API (.default)', value: 'api://your-api/.default' },
  ];

  const scopePresets = [
    { label: 'Profile (User.Read)', value: 'User.Read' },
    { label: 'Mail + offline access', value: 'User.Read Mail.Read offline_access' },
    { label: 'Admin: Directory.Read.All', value: 'Directory.Read.All' },
    { label: 'Custom API scope', value: 'api://your-api/user.read' },
  ];
  const scopesPreview = $derived(scopes.split(/[ ,]+/).filter(Boolean));
  const filteredHistory = $derived((() => {
    if (historyFilter === 'all') return history;
    return history.filter((item) => historyFilter === 'app' ? item.type === 'App Token' : item.type === 'User Token');
  })());
  const historyPeek = $derived(filteredHistory.slice(0, 8));
  const hasResult = $derived(Boolean(result));
  const statusLabel = $derived(error ? 'Error' : hasResult ? 'Issued' : 'Waiting');
  const statusTone: 'secondary' | 'outline' | 'destructive' = $derived(error ? 'destructive' : hasResult ? 'secondary' : 'outline');
  const lastRun = $derived(history[0] ?? null);
  const activeFlowLabel = $derived(activeTab === 'app-token' ? 'App token' : 'User token');
  const showResultScopes = $derived(resultKind !== 'App Token' && resultScopes.length > 0);
  const scopeCount = $derived(resultScopes.length);
  const isExpiringSoon = $derived(expiresInMinutes !== null && expiresInMinutes <= 5);
  const expiresLabel = $derived(() => {
    if (!expiresOnDate) return 'Expiry not provided';
    const rel = readableExpiry();
    return rel ? `${expiresOnDate.toLocaleString()} · ${rel}` : expiresOnDate.toLocaleString();
  });
  const claimEntries = $derived(decodedClaims ? Object.entries(decodedClaims) : []);
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
  const setupSummary = $derived(
    healthLoading
      ? 'Checking configuration...'
      : missingCount > 0
        ? `${missingCount} ${missingCount === 1 ? 'item needs attention' : 'items need attention'}`
        : health?.status === 'ok'
          ? 'Ready to issue tokens.'
          : 'Waiting for configuration.'
  );
  const showTroubleshooting = $derived(
    Boolean(missingCount)
  );

  $effect(() => {
    if (typeof window === 'undefined') return;
    if (!loading && (hasResult || error)) {
      if (hasAutoScrolled) return;
      const outputEl = document.getElementById('output');
      if (outputEl) {
        outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        (outputEl as HTMLElement).focus({ preventScroll: true });
        hasAutoScrolled = true;
      }
    } else {
      hasAutoScrolled = false;
    }
  });

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
      activeTab = tab;
      
      if (tab === 'app-token' && urlParams.has('resource')) {
        const r = urlParams.get('resource');
        if (r) resource = r;
      } else if (tab === 'user-token' && urlParams.has('scopes')) {
        const s = urlParams.get('scopes');
        if (s) scopes = s;
      }
    } else {
      const lastResource = localStorage.getItem('last_resource');
      if (lastResource) resource = lastResource;

      const lastScopes = localStorage.getItem('last_scopes');
      if (lastScopes) scopes = lastScopes;

      const savedTab = localStorage.getItem('active_tab');
      if (savedTab) activeTab = savedTab;
    }

    if (tab) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    loadHistory();
    checkUrlForToken();
    refreshHealth();
  });

  function loadHistory() {
    const saved = localStorage.getItem('token_history');
    if (saved) {
      try {
        history = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }

  function addToHistory(item: HistoryItem) {
    history = [item, ...history].slice(0, 20);
    localStorage.setItem('token_history', JSON.stringify(history));
  }

  function clearHistory() {
    if (confirm('Clear history?')) {
      history = [];
      localStorage.removeItem('token_history');
    }
  }

  async function refreshHealth() {
    healthLoading = true;
    try {
      const res = await fetch('/api/health');
      const data: HealthStatus = await res.json();
      health = data;
      clientId = data.clientId;
    } catch (err) {
      console.error('Failed to fetch config', err);
    } finally {
      healthLoading = false;
    }
  }

  function checkUrlForToken() {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      try {
        const tokenBase64 = hash.split('token=')[1];
        const tokenJson = atob(tokenBase64);
        const tokenData = JSON.parse(tokenJson);
        
        activeTab = 'user-token';
        localStorage.setItem('active_tab', 'user-token');
        
        result = tokenData;
        addToHistory({ type: 'User Token', target: (tokenData.scopes || []).join(' '), timestamp: Date.now() });
        
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse token', e);
        error = 'Failed to parse token from URL';
      }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
      error = `${urlParams.get('error')}: ${urlParams.get('error_description') || ''}`;
    }
  }

  async function handleAppSubmit() {
    loading = true;
    error = null;
    result = null;
    localStorage.setItem('last_resource', resource);

    try {
      const res = await fetch(`/api/token/app?resource=${encodeURIComponent(resource)}`);
      const data = await res.json();
      
      if (res.ok) {
        result = data;
        addToHistory({ type: 'App Token', target: resource, timestamp: Date.now() });
      } else {
        error = data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to fetch token';
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleUserSubmit() {
    if (!scopes) return;
    localStorage.setItem('last_scopes', scopes);
    localStorage.setItem('active_tab', 'user-token');
    loading = true;
    window.location.href = `/auth/start?scopes=${encodeURIComponent(scopes)}`;
  }

  function resetAll() {
    if (confirm('Are you sure you want to clear the forms and the current result?')) {
      resource = 'https://graph.microsoft.com';
      scopes = 'User.Read';
      result = null;
      error = null;
      localStorage.removeItem('last_resource');
      localStorage.removeItem('last_scopes');
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  function switchTab(tab: string) {
    activeTab = tab;
    localStorage.setItem('active_tab', tab);
  }

  function restoreHistoryItem(item: HistoryItem) {
    if (item.type === 'App Token') {
      switchTab('app-token');
      resource = item.target;
    } else {
      switchTab('user-token');
      scopes = item.target;
    }
  }

  function applyResourcePreset(value: string) {
    resource = value;
  }

  function applyScopePreset(value: string) {
    scopes = value;
  }

  function readableExpiry() {
    if (expiresInMinutes === null) return null;
    if (expiresInMinutes <= 1) return 'expires now';
    if (expiresInMinutes < 60) return `${expiresInMinutes} min left`;
    return `${Math.round(expiresInMinutes / 60)} hr remaining`;
  }

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleString();
  }
</script>

<svelte:head>
  <title>Token Studio | Entra Token Client</title>
</svelte:head>

<div class="space-y-8">
  <section id="setup" class="rounded-2xl border bg-card shadow-sm overflow-hidden">
    <div class="border-b bg-muted/30 px-5 py-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-primary" />
            <h3 class="font-semibold text-foreground">Setup</h3>
          </div>
          <Separator orientation="vertical" class="h-4" />
          <div class="flex items-center gap-2">
            <Badge variant={setupStatusTone} class="gap-1.5 font-normal">
              <ListChecks class="h-3.5 w-3.5" />
              {setupStatusLabel}
            </Badge>
            <span class="hidden text-sm text-muted-foreground sm:inline-block">
              {setupSummary}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" class="h-8 gap-2 text-muted-foreground hover:text-foreground" onclick={() => refreshHealth()} disabled={healthLoading}>
          {#if healthLoading}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
          {:else}
            <RotateCcw class="h-3.5 w-3.5" />
          {/if}
          <span class="text-xs">Re-run checks</span>
        </Button>
      </div>
    </div>

    <div class="p-5">
      <div class="grid gap-8 lg:grid-cols-2">
        <!-- Left Column: Configuration -->
        <div class="space-y-5">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium text-foreground">Client Configuration</h4>
            <a href={appRedirectLink} target="_blank" class="flex items-center gap-1 text-xs text-primary hover:underline" rel="noreferrer">
              Open in Entra portal <ArrowRight class="h-3 w-3" />
            </a>
          </div>

          <div class="rounded-xl border bg-muted/30 p-4 space-y-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <Label class="text-xs text-muted-foreground">Client ID</Label>
                {#if !clientId}
                  <span class="text-[10px] text-destructive">* Required</span>
                {/if}
              </div>
              <div class="flex gap-2">
                <code class="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground/90">
                  {clientId || 'Not set (check .env)'}
                </code>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={() => copyToClipboard(clientId || '')} disabled={!clientId} title="Copy Client ID">
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <Label class="text-xs text-muted-foreground">Redirect URI</Label>
                <span class="text-[10px] text-muted-foreground">Must match Entra registration</span>
              </div>
              <div class="flex gap-2">
                <code class="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground/90 break-all">
                  {resolvedRedirectUri}
                </code>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={() => copyToClipboard(resolvedRedirectUri)} title="Copy Redirect URI">
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Status & Checklist -->
        <div class="space-y-5">
          <h4 class="text-sm font-medium text-foreground">Health Check</h4>
          
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
            <div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 animate-in fade-in slide-in-from-top-2">
              <div class="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-600">
                <Sparkles class="h-3.5 w-3.5" />
                <span>Suggested Fixes</span>
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

  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-lg font-semibold text-foreground">Issue tokens</h3>
      {#if lastRun}
        <Badge variant="outline" class="gap-2">
          <Clock3 class="h-4 w-4" />
          Last run: {formatTimestamp(lastRun.timestamp)}
        </Badge>
      {/if}
    </div>
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-foreground">Choose a flow</p>
        <p class="text-xs text-muted-foreground">Issue a token first; the decoded output will populate below.</p>
      </div>
      <Tabs.Root id="flows" value={activeTab} onValueChange={(v) => switchTab(v)} class="w-full">
        <Tabs.List class="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1">
          <Tabs.Trigger value="app-token" class="gap-2 rounded-full">
            <ShieldHalf class="h-4 w-4" />
            App token
          </Tabs.Trigger>
          <Tabs.Trigger value="user-token" class="gap-2 rounded-full">
            <User class="h-4 w-4" />
            User token
          </Tabs.Trigger>
        </Tabs.List>

        <div class="mt-4 space-y-4">
          <Tabs.Content value="app-token">
            <Card.Root class="border bg-card/80 shadow-sm">
              <Card.Header class="space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <Card.Title>App token</Card.Title>
                    <Card.Description>Daemon/service-to-API calls using your confidential client.</Card.Description>
                  </div>
                  <Badge variant="secondary" class="gap-2">
                    <ShieldHalf class="h-4 w-4" />
                    Client credentials
                  </Badge>
                </div>
              </Card.Header>
              <Card.Content class="space-y-4">
                <form onsubmit={(e) => { e.preventDefault(); handleAppSubmit(); }} class="space-y-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <Label for="resource">Resource URL</Label>
                      <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">/.default will be applied</span>
                    </div>
                    <Input type="text" id="resource" bind:value={resource} placeholder="https://graph.microsoft.com" required />
                    <div class="flex flex-wrap gap-2">
                      {#each resourcePresets as preset}
                        <Button type="button" size="sm" variant="secondary" class="gap-2" onclick={() => applyResourcePreset(preset.value)}>
                          <ShieldCheck class="h-3.5 w-3.5" />
                          {preset.label}
                        </Button>
                      {/each}
                    </div>
                    <div class="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Tokens are issued via your confidential client credentials and stay in the browser unless you copy them.
                    </div>
                  </div>
                  <Button type="submit" class="w-full gap-2" disabled={loading}>
                    {#if loading}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Processing...
                    {:else}
                      <span>Issue app token</span>
                      <Play class="h-4 w-4" />
                    {/if}
                  </Button>
                </form>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>

          <Tabs.Content value="user-token">
            <Card.Root class="border bg-card/80 shadow-sm">
              <Card.Header class="space-y-2">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <Card.Title>User token</Card.Title>
                      <Badge variant="secondary" class="font-normal text-muted-foreground">Auth code flow</Badge>
                    </div>
                    <Card.Description>Interactive sign-in for delegated scopes.</Card.Description>
                  </div>
                </div>
              </Card.Header>
              <Card.Content class="space-y-4">
                <form onsubmit={(e) => { e.preventDefault(); handleUserSubmit(); }} class="space-y-4">
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <Label for="scopes">Scopes</Label>
                      <Input type="text" id="scopes" bind:value={scopes} placeholder="User.Read Mail.Read (space separated)" required />
                    </div>
                    
                    <div class="space-y-1.5">
                      <Label class="text-xs text-muted-foreground">Presets</Label>
                      <div class="flex flex-wrap gap-2">
                        {#each scopePresets as preset}
                          <button 
                            type="button" 
                            class="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onclick={() => applyScopePreset(preset.value)}
                          >
                            {preset.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>
                  <div class="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Consent is handled by Microsoft Identity. You'll be redirected back here.
                  </div>
                  <Button type="submit" class="w-full gap-2" disabled={loading}>
                    {#if loading}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Redirecting...
                    {:else}
                      <span>Get user token</span>
                      <LogIn class="h-4 w-4" />
                    {/if}
                  </Button>
                </form>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>

    <div class="space-y-5">
      <div class="space-y-4" id="output" tabindex="-1">
        <Card.Root class={`border bg-card/90 ${hasResult ? 'border-primary/40 shadow-xl shadow-primary/10' : 'shadow-sm'}`}>
          <Card.Header class="space-y-4 pb-2">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1">
                <Card.Title class="text-xl">Token result</Card.Title>
                <Card.Description>Run a flow above, then review the decoded claims and raw token output.</Card.Description>
              </div>
              
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" class="h-8 gap-2" onclick={() => lastRun && restoreHistoryItem(lastRun)} disabled={!lastRun}>
                  <RotateCcw class="h-3.5 w-3.5" />
                  Replay
                </Button>
                <Button size="sm" variant="ghost" class="h-8 gap-2" onclick={resetAll}>
                  <Trash2 class="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant={statusTone} class="px-2 py-0.5 text-xs font-medium">{statusLabel}</Badge>
              {#if lastRun}
                <Badge variant="outline" class="gap-1.5 px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  <Clock3 class="h-3 w-3" />
                  {formatTimestamp(lastRun.timestamp)}
                </Badge>
              {/if}
              {#if hasResult}
                <Separator orientation="vertical" class="h-4" />
                <Badge variant="outline" class="px-2 py-0.5 text-xs font-normal text-muted-foreground">{resultKind || activeFlowLabel}</Badge>
                <Badge variant="outline" class="px-2 py-0.5 text-xs font-normal text-muted-foreground">{result?.tokenType || 'Bearer'}</Badge>
                {#if scopeCount}
                  <Badge variant="outline" class="px-2 py-0.5 text-xs font-normal text-muted-foreground">{scopeCount} scopes</Badge>
                {/if}
                {#if audienceClaim}
                  <Badge variant="outline" class="max-w-[200px] truncate px-2 py-0.5 text-xs font-normal text-muted-foreground" title={audienceClaim}>Aud: {audienceClaim}</Badge>
                {/if}
                {#if expiresOnDate}
                  <Badge variant={isExpiringSoon ? 'destructive' : 'outline'} class="px-2 py-0.5 text-xs font-normal">
                    {isExpiringSoon ? 'Expiring' : 'Expires'} {readableExpiry() || 'soon'}
                  </Badge>
                {/if}
              {/if}
            </div>
          </Card.Header>

          <Card.Content class="space-y-5 pt-2">
            {#if error}
              <div class="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2 font-semibold">
                    <AlertTriangle class="h-4 w-4" />
                    Token request failed
                  </div>
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="ghost" class="h-9 px-3 hover:bg-destructive/20" onclick={() => copyToClipboard(error || '')}>
                      <Copy class="h-4 w-4" />
                      Copy error
                    </Button>
                    <Button size="sm" variant="secondary" onclick={resetAll}>Clear inputs</Button>
                  </div>
                </div>
                <p class="text-sm leading-relaxed break-all">{error}</p>
                <div class="grid gap-2 text-xs text-destructive/80">
                  <div class="flex items-center gap-2">
                    <Info class="h-3.5 w-3.5" />
                    Verify redirect URI matches your Entra app exactly (scheme/host/port/path).
                  </div>
                  <div class="flex items-center gap-2">
                    <Info class="h-3.5 w-3.5" />
                    Confirm scopes/resources are consented for this tenant and flow type.
                  </div>
                  <div class="flex items-center gap-2">
                    <Info class="h-3.5 w-3.5" />
                    Ensure `TENANT_ID`, `CLIENT_ID`, and `CLIENT_SECRET` are present in `.env`.
                  </div>
                </div>
              </div>
            {:else if hasResult && result}
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Type</p>
                  <div class="text-sm font-semibold text-foreground">{resultKind || 'Token'}</div>
                  <p class="text-xs text-muted-foreground">{result.tokenType || 'Bearer'}</p>
                </div>
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Issued</p>
                  <div class="text-sm font-semibold text-foreground">
                    {#if issuedAtDate}
                      {issuedAtDate.toLocaleString()}
                    {:else}
                      Unknown
                    {/if}
                  </div>
                  <p class="text-xs text-muted-foreground">{issuedAtDate ? 'Derived from iat claim' : 'No iat claim'}</p>
                </div>
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Expiry</p>
                  <div class="text-sm font-semibold text-foreground">
                    {#if expiresOnDate}
                      {expiresOnDate.toLocaleString()}
                    {:else}
                      Unknown
                    {/if}
                  </div>
                  <p class="text-xs text-muted-foreground">{readableExpiry() || 'Lifetime not provided'}</p>
                </div>
              <div class="rounded-lg border bg-muted/25 p-4">
                <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Scopes / audiences</p>
                <ScrollArea class="mt-2 h-[110px] rounded-md border bg-background/50 px-2 py-2">
                  <div class="flex flex-wrap gap-1">
                    {#if showResultScopes}
                      {#each resultScopes as scope}
                        <Badge variant="outline" class="font-mono text-[11px] leading-4 break-all" title={scope}>{scope}</Badge>
                      {/each}
                    {:else if audienceClaim}
                      <Badge variant="outline" class="font-mono text-[11px] leading-4 break-all" title={audienceClaim}>{audienceClaim}</Badge>
                    {:else}
                      <span class="text-xs text-muted-foreground">No scopes returned</span>
                    {/if}
                  </div>
                </ScrollArea>
              </div>
            </div>

              <div class="grid gap-4 lg:grid-cols-[1.15fr_0.9fr]">
                <div class="space-y-2 rounded-xl border bg-muted/15 p-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">Access token</p>
                      <p class="text-xs text-muted-foreground">Raw token is kept client-side for inspection and copy.</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button variant="ghost" size="sm" class="gap-2" onclick={() => tokenVisible = !tokenVisible}>
                        {#if tokenVisible}
                          <EyeOff class="h-4 w-4" />
                          Hide
                        {:else}
                          <Eye class="h-4 w-4" />
                          Show
                        {/if}
                      </Button>
                      <Button variant="secondary" size="sm" class="gap-2" onclick={() => copyToClipboard(result?.accessToken || '')}>
                        <Copy class="h-4 w-4" />
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                  <ScrollArea class="h-[260px] rounded-lg border bg-muted/40 p-4">
                    {#if tokenVisible}
                      <pre class="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-foreground/90">{result.accessToken}</pre>
                    {:else}
                      <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Token hidden. Click “Show” to reveal.
                      </div>
                    {/if}
                  </ScrollArea>
                </div>

                {#if decodedClaims}
                  <div class="space-y-3 rounded-xl border bg-muted/10 p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold">Decoded claims</p>
                        <p class="text-xs text-muted-foreground">Key claims grouped for quick inspection.</p>
                      </div>
                      <Badge variant="outline" class="text-[11px]">{claimEntries.length} fields</Badge>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                      {#each claimEntries as [k, v]}
                        <div class="rounded-lg border bg-background/60 p-3">
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground truncate" title={k}>{k}</span>
                            {#if k === 'aud'}
                              <Badge variant="secondary" class="text-[10px]">Audience</Badge>
                            {:else if k === 'iss'}
                              <Badge variant="secondary" class="text-[10px]">Issuer</Badge>
                            {:else if k === 'scp' || k === 'roles'}
                              <Badge variant="secondary" class="text-[10px]">Permissions</Badge>
                            {/if}
                          </div>
                          <div class="mt-1 text-xs font-mono leading-relaxed text-foreground/90 break-words">
                            {#if Array.isArray(v)}
                              <div class="flex flex-wrap gap-1">
                                {#each v as item}
                                  <Badge variant="outline" class="font-mono text-[11px]">{item}</Badge>
                                {/each}
                              </div>
                            {:else if typeof v === 'object'}
                              <pre class="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">{JSON.stringify(v, null, 2)}</pre>
                            {:else}
                              {v}
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>

              <div class="rounded-xl border bg-muted/10 p-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold">Context & reuse</p>
                    <p class="text-xs text-muted-foreground">Replay with the same target or adjust inputs above.</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="ghost" class="gap-2" onclick={() => lastRun && restoreHistoryItem(lastRun)} disabled={!lastRun}>
                      <RotateCcw class="h-4 w-4" />
                      Replay
                    </Button>
                    <Button size="sm" variant="ghost" class="gap-2" href="/history">
                      <History class="h-4 w-4" />
                      History
                    </Button>
                  </div>
                </div>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <div class="rounded-lg border bg-background/50 p-3">
                    <p class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Target</p>
                    <p class="text-sm font-mono break-words text-foreground/90">{lastRun?.target || (showResultScopes ? resultScopes.join(' ') : computedResourceScope)}</p>
                  </div>
                  <div class="rounded-lg border bg-background/50 p-3">
                    <p class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Audience / tenant</p>
                    <p class="text-sm font-mono break-words text-foreground/90">{audienceClaim || 'Audience not returned'}</p>
                    <p class="text-[11px] text-muted-foreground">Tenant: {tenantClaim || 'unknown'}</p>
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 py-16 text-center">
                <div class="mb-4 rounded-full bg-primary/10 p-3">
                  <Sparkles class="h-6 w-6 text-primary" />
                </div>
                <h3 class="text-lg font-semibold text-foreground">Ready to issue tokens</h3>
                <p class="mt-2 max-w-sm text-sm text-muted-foreground">
                  Use the App token or User token forms above, then return here to see the raw token and decoded claims.
                </p>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <Card.Root class="border bg-card/70">
        <Card.Header class="pb-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <History class="h-5 w-5 text-muted-foreground" />
              <Card.Title>Recent activity</Card.Title>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="sm" href="/history" class="gap-2">
                View all
                <ArrowRight class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Clear history" onclick={clearHistory} disabled={history.length === 0}>
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant={historyFilter === 'all' ? 'secondary' : 'ghost'} onclick={() => historyFilter = 'all'}>All</Button>
            <Button size="sm" variant={historyFilter === 'app' ? 'secondary' : 'ghost'} onclick={() => historyFilter = 'app'}>App tokens</Button>
            <Button size="sm" variant={historyFilter === 'user' ? 'secondary' : 'ghost'} onclick={() => historyFilter = 'user'}>User tokens</Button>
          </div>
        </Card.Header>
        <Card.Content>
          {#if history.length === 0}
            <div class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <History class="h-6 w-6" />
              <p>No saved requests yet. Run a flow and they will appear here.</p>
              <Button href="/" size="sm" class="gap-2">
                <Play class="h-4 w-4" />
                Start from dashboard
              </Button>
            </div>
          {:else if filteredHistory.length === 0}
            <div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Nothing in this filter. Switch filters or run a new request.
            </div>
          {:else}
            <div class="relative space-y-3 border-l pl-4">
              {#each historyPeek as item}
                <div class="relative rounded-xl border bg-muted/20 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40">
                  <span class="absolute -left-[9px] top-4 h-3 w-3 rounded-full border-2 border-background bg-primary"></span>
                  <div class="flex items-start justify-between gap-2">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <Badge variant={item.type === 'App Token' ? 'secondary' : 'outline'}>{item.type}</Badge>
                        <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      <p class="font-mono text-xs text-foreground/90 line-clamp-2" title={item.target}>
                        {item.target}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onclick={() => restoreHistoryItem(item)} title="Use again">
                        <Play class="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
