<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { HistoryItem, TokenData, FavoriteItem } from '$lib/types';
  import { parseJwt } from '$lib/utils';
  import { historyState } from '$lib/states/history.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import DecodedClaims from '$lib/components/DecodedClaims.svelte';
  import TokenFullScreenView from '$lib/components/TokenFullScreenView.svelte';
  import TokenStatusBadge from '$lib/components/TokenStatusBadge.svelte';
  import { getTokenStatus } from '$lib/utils';
  import { time } from '$lib/stores/time';
  import { toast } from "svelte-sonner";

  
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Label } from "$lib/shadcn/components/ui/label";
  import * as Card from "$lib/shadcn/components/ui/card";
  import * as Tabs from "$lib/shadcn/components/ui/tabs";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  
  import { 
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
    EyeOff,
    ExternalLink,
    Maximize2,
    Home,
    Star,
    StarOff
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

  let activeTab = $state('user-token');
  let resource = $state('https://graph.microsoft.com');
  let scopes = $state('User.Read');
  // history state is now managed by historyState
  let result = $state<TokenData | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let clientId = $state<string | null>(null);
  let health = $state<HealthStatus | null>(null);
  let healthLoading = $state(false);
  let copied = $state(false);
  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);

  let tokenVisible = $state(true);
  let hasAutoScrolled = $state(false);
  let floatingExpanded = $state(false);
  let isFullScreen = $state(false);
  let tokenSectionEl = $state<HTMLElement | null>(null);
  let tokenSectionInView = $state(true);


  let decodedClaims = $derived(result ? parseJwt(result.accessToken) : null);
  const historyCount = $derived(historyState.items.length);
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

  const hasResult = $derived(Boolean(result));
  const statusLabel = $derived(error ? 'Error' : hasResult ? 'Issued' : 'Waiting');
  const statusTone: 'secondary' | 'outline' | 'destructive' = $derived(error ? 'destructive' : hasResult ? 'secondary' : 'outline');
  const lastRun = $derived(historyState.items[0] ?? null);
  const activeFlowLabel = $derived(activeTab === 'app-token' ? 'App token' : 'User token');
  const showResultScopes = $derived(resultKind !== 'App Token' && resultScopes.length > 0);
  const currentStatus = $derived(result?.expiresOn ? getTokenStatus(new Date(result.expiresOn), $time) : null);
  const scopeCount = $derived(resultScopes.length);
  const claimEntries = $derived(decodedClaims ? Object.entries(decodedClaims) : []);
  const hasToken = $derived(Boolean(result?.accessToken));
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

  $effect(() => {
    if (typeof window === 'undefined') return;
    if (!tokenSectionEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        tokenSectionInView = entry?.isIntersecting ?? false;
      },
      { threshold: 0.3 }
    );

    observer.observe(tokenSectionEl);

    return () => observer.disconnect();
  });

  $effect(() => {
    if (!hasResult) {
      floatingExpanded = false;
      return;
    }

    floatingExpanded = !tokenSectionInView;
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

    // historyState.load() is called in constructor, but we can call it again if needed, or rely on it being singleton
    checkUrlForToken();
    refreshHealth();

    const autorun = urlParams.get('autorun');
    if (autorun === 'true') {
      if (activeTab === 'app-token') {
        handleAppSubmit();
      } else {
        handleUserSubmit();
      }
    }

    const pendingLoad = localStorage.getItem('pending_token_load');
    if (pendingLoad) {
      try {
        const item = JSON.parse(pendingLoad);
        loadHistoryItem(item);
        localStorage.removeItem('pending_token_load');
      } catch (e) {
        console.error('Failed to load pending token', e);
      }
    }
  });

  // Removed loadHistory function

  async function addToHistory(item: HistoryItem) {
    await historyState.add(item);
  }

  // Removed clearHistory function - use historyState.clear()

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

  async function checkUrlForToken() {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      try {
        const tokenBase64 = hash.split('token=')[1];
        const tokenJson = atob(tokenBase64);
        const tokenData = JSON.parse(tokenJson);
        
        activeTab = 'user-token';
        localStorage.setItem('active_tab', 'user-token');
        
        result = tokenData;
        await addToHistory({ type: 'User Token', target: (tokenData.scopes || []).join(' '), timestamp: Date.now(), tokenData: JSON.parse(JSON.stringify(result!)) });
        
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
        await addToHistory({ type: 'App Token', target: resource, timestamp: Date.now(), tokenData: JSON.parse(JSON.stringify(result!)) });
        toast.success("App token acquired successfully");
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to fetch token';
        error = errorMsg;
        toast.error(errorMsg);
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  import { authServiceStore } from '$lib/stores/auth';

  // ... (existing imports)

  async function handleUserSubmit() {
    if (!scopes) return;
    localStorage.setItem('last_scopes', scopes);
    localStorage.setItem('active_tab', 'user-token');
    loading = true;
    error = null;
    result = null;

    try {
      const service = $authServiceStore;
      if (!service) throw new Error('Auth service not initialized');
      
      const scopeArray = scopes.split(/[ ,]+/).filter(Boolean);
      const tokenResponse = await service.getToken(scopeArray);
      
      result = {
        accessToken: tokenResponse.accessToken,
        tokenType: tokenResponse.tokenType,
        expiresOn: tokenResponse.expiresOn?.toISOString(),
        scopes: tokenResponse.scopes,
      };
      
      await addToHistory({ type: 'User Token', target: scopes, timestamp: Date.now(), tokenData: JSON.parse(JSON.stringify(result!)) });
      toast.success("User token acquired successfully");
    } catch (err: any) {
      console.error('Token acquisition failed', err);
      const message = err?.message ?? 'Failed to acquire token';
      error = message;
      toast.error(message);
    } finally {
      loading = false;
    }
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
      toast.success("Copied to clipboard");
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error("Failed to copy to clipboard");
    }
  }

  function switchTab(tab: string) {
    activeTab = tab;
    localStorage.setItem('active_tab', tab);
  }

  async function restoreHistoryItem(item: HistoryItem) {
    if (item.type === 'App Token') {
      switchTab('app-token');
      resource = item.target;
      await tick();
      handleAppSubmit();
    } else {
      switchTab('user-token');
      scopes = item.target;
      await tick();
      handleUserSubmit();
    }
  }

  async function loadHistoryItem(item: HistoryItem) {
    if (item.tokenData) {
      result = item.tokenData;
      if (item.type === 'App Token') {
        activeTab = 'app-token';
        resource = item.target;
      } else {
        activeTab = 'user-token';
        scopes = item.target;
      }
      // Scroll to output
      await tick();
      const outputEl = document.getElementById('output');
      if (outputEl) {
        outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  const favoriteTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
  };

  function isFavorited(item: HistoryItem) {
    return favoritesState.items.some((fav) => fav.type === item.type && fav.target === item.target);
  }

  function startFavoriteFromHistory(item: HistoryItem) {
    favoriteDraft = item;
    favoriteOpen = true;
  }

  async function saveFavoriteFromHistory(payload: FavoriteFormValue) {
    if (!favoriteDraft) return;
    try {
      await favoritesState.addFromHistory(favoriteDraft, payload);
      await favoritesState.load();
      toast.success('Added to favorites');
    } catch (err) {
      console.error('Failed to add favorite', err);
      toast.error('Could not add to favorites');
    } finally {
      favoriteDraft = null;
      favoriteOpen = false;
    }
  }

  async function removeFavoriteFromHistory(item: HistoryItem) {
    const match = favoritesState.items.find((fav) => fav.type === item.type && fav.target === item.target);
    if (!match) return;
    await favoritesState.delete(match);
    toast.success('Removed from favorites');
  }

  const currentFavoriteSeed: HistoryItem | null = $derived((() => {
    const latest = historyState.items[0];
    if (!latest || !latest.tokenData) return null;
    return latest;
  })());

  const currentFavorited = $derived(currentFavoriteSeed ? isFavorited(currentFavoriteSeed) : false);

  function startFavoriteFromCurrent() {
    if (!currentFavoriteSeed) return;
    favoriteDraft = currentFavoriteSeed;
    favoriteOpen = true;
  }

  async function deleteHistoryItem(item: HistoryItem) {
    await historyState.delete(item);
  }

  function applyResourcePreset(value: string) {
    resource = value;
  }

  function applyScopePreset(value: string) {
    scopes = value;
  }



  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleString();
  }

  function scrollToOutput() {
    const outputEl = document.getElementById('output');
    if (outputEl) {
      outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function scrollToFlows() {
    const flowsEl = document.getElementById('flows');
    if (flowsEl) {
      flowsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function refreshCurrent() {
    if (activeTab === 'app-token') {
      handleAppSubmit();
    } else {
      handleUserSubmit();
    }
  }
</script>

<svelte:head>
  <title>Playground | Entra Token Client</title>
</svelte:head>

<div class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Home class="h-5 w-5" />
      </div>
      <div>
        <p class="text-lg font-semibold leading-tight">Playground</p>
        <p class="text-sm text-muted-foreground">Generate and inspect tokens with live status updates.</p>
      </div>
    </div>
  </div>

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
                Must exactly match the value in Entra (case-sensitive). <strong>Ensure this is added as a "Single-page application" platform.</strong>
              </p>
            </div>

            <div class="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 p-3">
              <Info class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div class="space-y-1">
                <p class="text-xs font-medium text-foreground">Changing the application</p>
                <p class="text-xs text-muted-foreground">
                  To switch apps, update <code class="font-mono text-[10px]">CLIENT_ID</code> and <code class="font-mono text-[10px]">CLIENT_SECRET</code> in your <code class="font-mono text-[10px]">.env</code> file. To change the redirect URI, set <code class="font-mono text-[10px]">REDIRECT_URI</code>. Restart the server to apply.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Status & Checklist -->
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
                    <p class="text-xs text-muted-foreground">Start generating first; the decoded output will populate below.</p>
      </div>
      <Tabs.Root id="flows" value={activeTab} onValueChange={(v) => switchTab(v)} class="w-full">
        <Tabs.List class="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1">
          <Tabs.Trigger value="user-token" class="gap-2 rounded-full">
            <User class="h-4 w-4" />
            User token
          </Tabs.Trigger>
          <Tabs.Trigger value="app-token" class="gap-2 rounded-full">
            <ShieldHalf class="h-4 w-4" />
            App token
          </Tabs.Trigger>
        </Tabs.List>

        <div class="mt-4 space-y-4">
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
                      <p class="text-[10px] text-muted-foreground">
                        Tip: You can request multiple scopes by separating them with spaces or commas.
                      </p>
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
                    Consent is handled by Microsoft Identity. A popup may appear if permission is needed.
                  </div>
                  <Button type="submit" class="w-full gap-2" disabled={loading}>
                    {#if loading}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Acquiring token...
                    {:else}
                      <Play class="h-4 w-4" />
                      <span>Issue token</span>
                    {/if}
                  </Button>
                </form>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>

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
                      <Label for="resource">Resource</Label>
                      <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">/.default will be applied</span>
                    </div>
                    <Input type="text" id="resource" bind:value={resource} placeholder="https://graph.microsoft.com or api://client-id" required />
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
                      <Play class="h-4 w-4" />
                      <span>Issue token</span>
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
              
              {#if hasResult}
                <div class="flex flex-wrap items-center gap-2">
                  <Button 
                    size="sm" 
                    variant={currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'default' : 'ghost'} 
                    class={`h-8 gap-2 ${currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'shadow-[0_0_15px_-3px_oklch(var(--primary)/0.6)] hover:shadow-[0_0_20px_-3px_oklch(var(--primary)/0.7)] transition-all' : ''}`}
                    onclick={refreshCurrent} 
                    disabled={loading || !hasResult}
                    title="Reissue this token"
                  >
                    <Play class="h-3.5 w-3.5" />
                    Reissue
                  </Button>

                  <Separator orientation="vertical" class="h-4" />
                  <Button size="sm" variant="outline" class="h-8 gap-2" onclick={() => isFullScreen = true} title="Open in full screen view">
                    <Maximize2 class="h-3.5 w-3.5" />
                    Expanded View
                  </Button>
                  <Button
                    size="sm"
                    variant={currentFavorited ? "secondary" : "ghost"}
                    class="h-8 gap-2"
                    onclick={() => (currentFavorited ? removeFavoriteFromHistory(currentFavoriteSeed!) : startFavoriteFromCurrent())}
                    disabled={!currentFavoriteSeed}
                    title={currentFavorited ? "Remove Favorite" : "Favorite"}
                  >
                    {#if currentFavorited}
                      <StarOff class="h-3.5 w-3.5" />
                      Remove Favorite
                    {:else}
                      <Star class="h-3.5 w-3.5" />
                      Favorite
                    {/if}
                  </Button>
                </div>
              {/if}
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
                {#if showResultScopes}
                  <Badge variant="outline" class="px-2 py-0.5 text-xs font-normal text-muted-foreground">{scopeCount} {scopeCount === 1 ? 'scope' : 'scopes'}</Badge>
                {/if}
                {#if audienceClaim}
                  <Badge variant="outline" class="max-w-[200px] truncate px-2 py-0.5 text-xs font-normal text-muted-foreground" title={audienceClaim}>Aud: {audienceClaim}</Badge>
                {/if}
                {#if result?.expiresOn}
                  <TokenStatusBadge expiresOn={result.expiresOn} class="px-2 py-0.5 text-xs font-normal" />
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
                    <Button size="sm" variant="ghost" class="h-9 px-3 hover:bg-destructive/20" onclick={() => copyToClipboard(error || '')} title="Copy error message">
                      <Copy class="h-4 w-4" />
                      Copy error
                    </Button>
                    <Button size="sm" variant="secondary" onclick={resetAll} title="Clear inputs and try again">Clear inputs</Button>
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
                    {#if result?.expiresOn}
                      {new Date(result.expiresOn).toLocaleString()}
                    {:else}
                      Unknown
                    {/if}
                  </div>
                  <div class="mt-1">
                    {#if result?.expiresOn}
                      <TokenStatusBadge expiresOn={result.expiresOn} textOnly showIcon={false} class="text-xs text-muted-foreground" />
                    {:else}
                      <p class="text-xs text-muted-foreground">Lifetime not provided</p>
                    {/if}
                  </div>
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
                <div
                  class="space-y-2 rounded-xl border bg-muted/15 p-4"
                  bind:this={tokenSectionEl}
                >
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">Access token</p>
                      <p class="text-xs text-muted-foreground">Raw token is kept client-side for inspection and copy.</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button variant="ghost" size="sm" class="gap-2" onclick={() => tokenVisible = !tokenVisible} title={tokenVisible ? 'Hide token' : 'Show token'}>
                        {#if tokenVisible}
                          <EyeOff class="h-4 w-4" />
                          Hide
                        {:else}
                          <Eye class="h-4 w-4" />
                          Show
                        {/if}
                      </Button>
                      <Button variant="secondary" size="sm" class="gap-2" onclick={() => copyToClipboard(result?.accessToken || '')} title="Copy access token">
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
                  <div class="rounded-xl border bg-muted/10 p-4">
                    <DecodedClaims claims={decodedClaims} />
                  </div>
                {/if}
              </div>


            {:else}
              <div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/10 py-16 text-center">
                <div class="mb-4 rounded-full bg-primary/10 p-3">
                  <ShieldCheck class="h-6 w-6 text-primary" />
                </div>
                <h3 class="text-lg font-semibold text-foreground">Ready to issue tokens</h3>
                <p class="mt-2 max-w-sm text-sm text-muted-foreground">
                  Use the App token or User token forms above, then return here to see the raw token and decoded claims.
                </p>
                <Button variant="default" class="gap-2" onclick={scrollToFlows}>
                  <Play class="h-4 w-4" />
                  Start generating
                </Button>
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
            <Button variant="ghost" size="sm" href="/history" class="gap-2">
              View all
              <ArrowRight class="h-4 w-4" />
            </Button>
          </div>
        </Card.Header>
        <Card.Content class="p-0">
          <div class="px-3 md:px-4">
            <HistoryList 
              items={historyState.items} 
              limit={5} 
              onRestore={restoreHistoryItem} 
              onLoad={loadHistoryItem}
              onFavorite={startFavoriteFromHistory}
              onUnfavorite={removeFavoriteFromHistory}
              isFavorited={isFavorited}
              enableToolbar={false}
              enableSorting={false}
              compact={true}
              showFooter={false}
              emptyCtaHref="/"
              emptyCtaLabel="Start generating"
            />
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<FavoriteFormSheet
  bind:open={favoriteOpen}
  mode="create"
  title="Save to favorites"
  favorite={favoriteDraft
    ? {
        id: 'draft',
        type: favoriteDraft.type,
        target: favoriteDraft.target,
        timestamp: favoriteDraft.timestamp,
        tokenData: favoriteDraft.tokenData,
        createdAt: favoriteDraft.timestamp,
        useCount: 1
      }
    : undefined}
  existingTags={favoriteTags}
  onSave={saveFavoriteFromHistory}
  onClose={() => {
    favoriteOpen = false;
    favoriteDraft = null;
  }}
/>



<div class="pointer-events-none fixed inset-x-3 bottom-3 z-50 md:inset-auto md:bottom-6 md:right-6 md:w-[420px]">
  <div class="pointer-events-auto overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90">
    <div class="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">

      <div class="flex items-center gap-2">
        <Badge variant="secondary" class="gap-1 text-[11px]">Token output</Badge>
        <span class="text-xs text-muted-foreground truncate">
          {#if hasResult}
            {resultKind || activeFlowLabel}
          {:else if error}
            Error
          {:else if loading}
            Issuing...
          {:else}
            Not issued yet
          {/if}
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" class="h-8 w-8" onclick={scrollToOutput} title="Jump to full output">
          <Link2 class="h-4 w-4 -rotate-45" />
        </Button>
        {#if hasResult}
          <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => isFullScreen = true} title="Maximize view">
            <Maximize2 class="h-4 w-4" />
          </Button>
        {/if}
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          onclick={() => floatingExpanded = !floatingExpanded}
          aria-expanded={floatingExpanded}
          aria-label={floatingExpanded ? 'Collapse floating token output' : 'Expand floating token output'}
          title={floatingExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown class={`h-4 w-4 transition-transform ${floatingExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </div>
    </div>

    {#if floatingExpanded}
      <div class="space-y-3 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" class="px-2 py-1 font-normal">
            {#if hasResult}
              {resultKind || 'Token'}
            {:else if error}
              Error
            {:else}
              Awaiting token
            {/if}
          </Badge>
          {#if hasResult && result?.expiresOn}
            <TokenStatusBadge expiresOn={result.expiresOn} class="px-2 py-1 font-normal" />
          {/if}
          {#if showResultScopes}
            <Badge variant="outline" class="px-2 py-1 font-normal">{scopeCount} {scopeCount === 1 ? 'scope' : 'scopes'}</Badge>
          {/if}
        </div>

        <div class="rounded-lg border bg-muted/20 p-3">
          {#if hasResult && tokenVisible}
            <div class="line-clamp-4 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/90">
              {result?.accessToken}
            </div>
          {:else if hasResult && !tokenVisible}
            <div class="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>Token hidden.</span>
              <Button size="sm" variant="ghost" class="gap-1 px-2" onclick={() => tokenVisible = true} title="Show token">
                <Eye class="h-4 w-4" />
                Show
              </Button>
            </div>
          {:else if error}
            <div class="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle class="h-4 w-4 shrink-0" />
              <span class="line-clamp-3 break-all leading-relaxed">{error}</span>
            </div>
          {:else if loading}
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 class="h-4 w-4 animate-spin" />
              <span>Issuing token...</span>
            </div>
          {:else}
            <div class="space-y-2 text-sm text-muted-foreground">
              <p class="leading-relaxed">Issue an app or user token and it will stay docked here for quick copy.</p>
              <Button size="sm" variant="default" class="gap-2" onclick={scrollToFlows}>
                <Play class="h-4 w-4" />
                Start generating
              </Button>
            </div>
          {/if}
        </div>

          {#if hasResult}
            <div class="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" class="gap-2" onclick={() => copyToClipboard(result?.accessToken || '')} disabled={!hasToken} title="Copy access token">
                <Copy class="h-4 w-4" />
                {copied ? 'Copied' : 'Copy token'}
            </Button>
              <Button 
                size="sm" 
                variant={currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'default' : 'ghost'} 
                class={`gap-2 ${currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'shadow-[0_0_15px_-3px_oklch(var(--primary)/0.6)] hover:shadow-[0_0_20px_-3px_oklch(var(--primary)/0.7)] transition-all' : ''}`}
                onclick={refreshCurrent}
                title="Reissue this token"
              >
                <Play class="h-4 w-4" />
                Reissue
              </Button>
              <Button
                size="sm"
                variant={currentFavorited ? "secondary" : "ghost"}
                class="gap-2"
                onclick={() => (currentFavorited ? removeFavoriteFromHistory(currentFavoriteSeed!) : startFavoriteFromCurrent())}
                disabled={!currentFavoriteSeed}
                title={currentFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                {#if currentFavorited}
                  <StarOff class="h-4 w-4" />
                  Remove Favorite
                {:else}
                  <Star class="h-4 w-4" />
                  Favorite
                {/if}
              </Button>
              <Button size="sm" variant="ghost" class="gap-2" onclick={() => tokenVisible = !tokenVisible} title={tokenVisible ? 'Hide token' : 'Show token'}>
                {#if tokenVisible}
                  <EyeOff class="h-4 w-4" />
                  Hide
              {:else}
                <Eye class="h-4 w-4" />
                Show
              {/if}
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if isFullScreen && hasResult}
  <TokenFullScreenView 
    {result} 
    {decodedClaims} 
    onClose={() => isFullScreen = false} 
  />
{/if}
