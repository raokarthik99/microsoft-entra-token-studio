<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { HistoryItem, TokenData, FavoriteItem, HealthStatus, CredentialValidationStatus } from '$lib/types';
  import { parseJwt, getTokenStatus } from '$lib/utils';
  import { historyState } from '$lib/states/history.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import { tokenDockState } from '$lib/states/token-dock.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import DecodedClaims from '$lib/components/DecodedClaims.svelte';
  import TokenStatusBadge from '$lib/components/TokenStatusBadge.svelte';
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
  import { goto } from '$app/navigation';
  
  import { 
    User,
    History,
    Copy,
    Play,
    LogIn,
    Loader2,
    ShieldCheck,
    Clock3,
    ListChecks,
    AlertTriangle,
    Info,
    ShieldHalf,
    ArrowRight,
    Eye,
    EyeOff,
    Maximize2,
    Home,
    Star,
    StarOff,
    RefreshCw
  } from "@lucide/svelte";
  import { auth, authServiceStore } from '$lib/stores/auth';

  type FlowTab = 'app-token' | 'user-token';

  let activeTab = $state<FlowTab>('user-token');
  let resource = $state('https://graph.microsoft.com');
  let scopes = $state('User.Read');
  // history state is now managed by historyState
  let result = $state<TokenData | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let clientId = $state<string | null>(null);
  let tenantId = $state<string | null>(null);
  let health = $state<HealthStatus | null>(null);
  let healthLoading = $state(false);
  let copied = $state(false);
  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);

  let tokenVisible = $state(true);
  let hasAutoScrolled = $state(false);
  let highlightTarget: 'scopes' | 'resource' | null = $state(null);
  let highlightTimeout: number | null = null;
  let switchingAccount = $state(false);

  // Derived state for active account
  const activeAccount = $derived($auth.user);


  const decodedClaims = $derived(result ? parseJwt(result.accessToken) : null);
  const resultKind = $derived(result ? (result.scopes?.length ? 'User Token' : 'App Token') : '');
  const issuedAtDate = $derived(decodedClaims?.iat ? new Date(Number((decodedClaims as any).iat) * 1000) : null);
  const audienceClaim = $derived((() => {
    if (!decodedClaims || !(decodedClaims as any).aud) return null;
    const aud = (decodedClaims as any).aud;
    return Array.isArray(aud) ? aud.join(', ') : String(aud);
  })());
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

  const hasResult = $derived(Boolean(result));
  const lastRun = $derived(historyState.items[0] ?? null);
  const showResultScopes = $derived(resultKind !== 'App Token' && resultScopes.length > 0);
  const currentStatus = $derived(result?.expiresOn ? getTokenStatus(new Date(result.expiresOn), $time) : null);
  const scopeCount = $derived(resultScopes.length);
  const configReady = $derived(health?.status === 'ok');
  const configStatusLabel = $derived(
    healthLoading ? 'Checking config' : configReady ? 'Setup complete' : 'Configuration incomplete'
  );
  const configStatusTone: 'secondary' | 'outline' = $derived(configReady ? 'secondary' : 'outline');
  const credentialValidation = $derived((() => {
    if (!health) return null;
    if (health.authMethod === 'certificate') {
      return health.validation.certificate[health.authSource === 'keyvault' ? 'keyvault' : 'local'];
    }
    if (health.authMethod === 'secret') {
      return health.validation.secret[health.authSource === 'keyvault' ? 'keyvault' : 'local'];
    }
    return null;
  })());
  const credentialStatus = $derived<CredentialValidationStatus>(credentialValidation?.status ?? 'not_configured');
  const credentialStatusLabel = $derived(
    credentialStatus === 'ready' ? 'Ready' : credentialStatus === 'issues' ? 'Issues' : 'Not set'
  );
  const credentialBadgeClass = $derived(() => {
    if (credentialStatus === 'ready') return 'h-5 text-[10px] px-2 bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
    if (credentialStatus === 'issues') return 'h-5 text-[10px] px-2 bg-amber-500/10 text-amber-700 border-amber-500/40';
    return 'h-5 text-[10px] px-2 bg-muted text-muted-foreground border-border/60';
  });
  const credentialPathLabel = $derived(() => {
    if (!health) return 'Credential not configured';
    if (health.authMethod === 'certificate') return `Certificate · ${health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}`;
    if (health.authMethod === 'secret') return `Secret · ${health.authSource === 'keyvault' ? 'Key Vault' : 'Local'}`;
    return 'Credential not configured';
  });
  const credentialErrors = $derived(credentialValidation?.errors ?? []);

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

  // Keep main result in sync with the shared dock token so both views stay consistent across navigation.
  $effect(() => {
    const dockToken = tokenDockState.token;
    if (dockToken?.tokenData) {
      result = dockToken.tokenData;
      if (dockToken.type === 'App Token') {
        activeTab = 'app-token';
        resource = dockToken.target;
      } else {
        activeTab = 'user-token';
        scopes = dockToken.target;
      }
    } else if (!dockToken && !loading) {
      result = null;
    }
  });

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const tab = tabParam === 'app-token' || tabParam === 'user-token' ? tabParam : null;
    const startGeneratingIntent = urlParams.get('cta') === 'start-generating';
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
      if (savedTab === 'app-token' || savedTab === 'user-token') activeTab = savedTab;
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

    if (startGeneratingIntent) {
      setTimeout(() => {
        scrollToFlows({ highlight: true, targetTab: tab ?? activeTab });
      }, 150);
    }

    if (tab || startGeneratingIntent || urlParams.has('resource') || urlParams.has('scopes') || urlParams.has('autorun')) {
      window.history.replaceState({}, document.title, window.location.pathname);
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
      tenantId = data.tenant;
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
        const tokenTarget = (tokenData.scopes || []).join(' ');
        const timestamp = Date.now();
        
        activeTab = 'user-token';
        localStorage.setItem('active_tab', 'user-token');
        
        result = tokenData;
        const historyItem: HistoryItem = {
          type: 'User Token',
          target: tokenTarget,
          timestamp,
          tokenData: JSON.parse(JSON.stringify(tokenData))
        };
        await addToHistory(historyItem);
        tokenDockState.setToken(historyItem);
        
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse token', e);
        error = 'Failed to parse token from URL';
        tokenDockState.setError('Failed to parse token from URL');
      }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
      error = `${urlParams.get('error')}: ${urlParams.get('error_description') || ''}`;
      tokenDockState.setError(error);
    }
  }

  async function handleAppSubmit() {
    if (!ensureSetupReady()) return;
    loading = true;
    error = null;
    result = null;
    tokenDockState.setLoading({ type: 'App Token', target: resource });
    localStorage.setItem('last_resource', resource);

    try {
      const res = await fetch(`/api/token/app?resource=${encodeURIComponent(resource)}`);
      const data = await res.json();
      
      if (res.ok) {
        result = data;
        const issuedAt = Date.now();
        const historyItem: HistoryItem = {
          type: 'App Token',
          target: resource,
          timestamp: issuedAt,
          tokenData: JSON.parse(JSON.stringify(data))
        };
        await addToHistory(historyItem);
        tokenDockState.setToken(historyItem);
        toast.success("App token acquired successfully");
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to fetch token';
        error = errorMsg;
        tokenDockState.setError(errorMsg);
        toast.error(errorMsg);
        if (data.setupRequired) {
          await goto('/setup?from=playground');
        }
      }
    } catch (err: any) {
      error = err.message;
      tokenDockState.setError(err.message);
    } finally {
      loading = false;
    }
  }

  async function handleUserSubmit(forceSwitch: boolean = false) {
    if (!ensureSetupReady()) return;
    if (!scopes) return;
    localStorage.setItem('last_scopes', scopes);
    localStorage.setItem('active_tab', 'user-token');
    loading = true;
    error = null;
    result = null;
    tokenDockState.setLoading({ type: 'User Token', target: scopes });

    try {
      const service = $authServiceStore;
      if (!service) throw new Error('Auth service not initialized');
      
      const scopeArray = scopes.split(/[ ,]+/).filter(Boolean);
      // getToken handles unauthenticated users automatically (prompts sign-in)
      // If forceSwitch is true, we force an interactive prompt to allow switching accounts
      const options = forceSwitch 
        ? { forceInteraction: true, prompt: 'select_account' as const }
        : {}; // Don't pass forceInteraction: false, let getToken decide
      const tokenResponse = await service.getToken(scopeArray, options);
      
      result = {
        accessToken: tokenResponse.accessToken,
        tokenType: tokenResponse.tokenType,
        expiresOn: tokenResponse.expiresOn?.toISOString(),
        scopes: tokenResponse.scopes,
      };
      
      const issuedAt = Date.now();
      const historyItem: HistoryItem = {
        type: 'User Token',
        target: scopes,
        timestamp: issuedAt,
        tokenData: JSON.parse(JSON.stringify(result!))
      };

      await addToHistory(historyItem);
      tokenDockState.setToken(historyItem);
      toast.success("User token acquired successfully");
    } catch (err: any) {
      console.error('Token acquisition failed', err);
      const message = err?.message ?? 'Failed to acquire token';
      // Don't show error toast for cancelled sign-in
      if (message !== 'Sign-in was cancelled') {
        error = message;
        tokenDockState.setError(message);
        toast.error(message);
      } else {
        toast.warning("Sign-in was cancelled");
        tokenDockState.clearLoading();
      }
    } finally {
      loading = false;
      switchingAccount = false;
    }
  }

  async function handleSwitchAccount() {
    switchingAccount = true;
    await handleUserSubmit(true);
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

  function switchTab(tab: FlowTab) {
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
      tokenDockState.setToken(item);
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

  function highlightRequiredInput(tab: FlowTab) {
    const targetField = tab === 'app-token' ? 'resource' : 'scopes';
    highlightTarget = targetField;

    const inputEl = document.getElementById(targetField) as HTMLInputElement | null;
    if (inputEl) {
      inputEl.focus({ preventScroll: true });
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }

    highlightTimeout = window.setTimeout(() => {
      highlightTarget = null;
    }, 1800);
  }

  function ensureSetupReady() {
    if (healthLoading) {
      toast.info('Checking Setup status... please wait');
      return false;
    }
    if (configReady) return true;
    toast.warning('Complete Setup before issuing tokens', {
      description:
        credentialStatus !== 'ready'
          ? `Credential path ${credentialPathLabel} is ${credentialStatusLabel}.`
          : 'Open Setup to add tenant, client, and credentials.',
    });
    goto('/setup?from=playground');
    return false;
  }

  async function scrollToFlows(options: { highlight?: boolean; targetTab?: FlowTab } = {}) {
    const { highlight = false, targetTab } = options;
    if (!configReady) {
      ensureSetupReady();
      return;
    }

    if (targetTab && targetTab !== activeTab) {
      switchTab(targetTab);
      await tick();
    }

    const flowsEl = document.getElementById('flows');
    if (flowsEl) {
      flowsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (highlight) {
      await tick();
      highlightRequiredInput(targetTab ?? activeTab);
    }
  }

  function refreshCurrent() {
    if (!ensureSetupReady()) return;
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

  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="text-lg font-semibold text-foreground">Issue tokens</h3>
        {#if lastRun}
          <Badge variant="outline" class="gap-2">
            <Clock3 class="h-4 w-4" />
            Last run: {formatTimestamp(lastRun.timestamp)}
          </Badge>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-3">
        {#if !configReady && !healthLoading}
          <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle class="h-3.5 w-3.5" />
            Complete Setup to issue tokens
          </span>
        {/if}
        <Badge variant={configStatusTone} class="gap-2">
          {#if healthLoading}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
          {:else if configReady}
            <ListChecks class="h-3.5 w-3.5" />
          {:else}
            <AlertTriangle class="h-3.5 w-3.5 text-amber-600" />
          {/if}
          {configStatusLabel}
        </Badge>
        <Button variant="default" size="sm" href="/setup" class="gap-2 h-8">
          Open setup
          <ArrowRight class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <div class="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tenant</span>
        <code class="font-mono text-xs text-foreground/90">{tenantId || 'Not set'}</code>
        {#if tenantId}
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            onclick={() => copyToClipboard(tenantId || '')}
            title="Copy tenant ID"
          >
            <Copy class="h-3.5 w-3.5" />
          </Button>
        {/if}
      </div>
      <div class="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Client</span>
        <code class="font-mono text-xs text-foreground/90 break-all">{clientId || 'Not set'}</code>
        {#if clientId}
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            onclick={() => copyToClipboard(clientId || '')}
            title="Copy client ID"
          >
            <Copy class="h-3.5 w-3.5" />
          </Button>
        {/if}
      </div>
    </div>
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-foreground">Choose a flow</p>
      </div>
      <Tabs.Root id="flows" value={activeTab} onValueChange={(v) => switchTab(v as FlowTab)} class="w-full">
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
                <div class="flex items-center justify-between gap-3">
                  <div class="space-y-1">
                    <Card.Title>User token</Card.Title>
                    <Card.Description>Interactive sign-in for delegated scopes.</Card.Description>
                  </div>
                  <Badge variant="secondary" class="gap-2 font-semibold text-foreground">
                    <LogIn class="h-4 w-4" />
                    Auth code flow
                  </Badge>
                </div>
              </Card.Header>
              <Card.Content class="space-y-4">
                <form onsubmit={(e) => { e.preventDefault(); handleUserSubmit(); }} class="space-y-4">
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <Label for="scopes">Scopes</Label>
                    <Input
                      type="text"
                      id="scopes"
                      bind:value={scopes}
                      placeholder="User.Read Mail.Read (space separated)"
                      required
                      class={highlightTarget === 'scopes'
                        ? 'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background bg-gradient-to-r from-amber-200/70 via-orange-100/70 to-transparent shadow-[0_0_0_10px_rgba(251,191,36,0.35),0_14px_30px_-10px_rgba(249,115,22,0.45)] animate-[pulse_1.2s_ease-in-out_0s_4]'
                        : ''}
                    />
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
                  
                  <!-- Identity Indicator -->
                  <div class="flex items-center justify-between rounded-lg border px-3 py-2.5 {activeAccount ? 'bg-background border-border' : 'bg-amber-500/10 border-amber-500/20'}">
                    {#if activeAccount}
                      <div class="flex items-center gap-2 text-sm">
                        <User class="h-4 w-4 text-muted-foreground" />
                        <span class="text-muted-foreground">Issuing as</span>
                        <span class="font-medium text-foreground">{activeAccount.username || activeAccount.name}</span>
                      </div>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus:outline-none"
                        onclick={handleSwitchAccount}
                        disabled={loading || switchingAccount}
                      >
                        <RefreshCw class={`h-3 w-3 ${switchingAccount ? 'animate-spin' : ''}`} />
                        Switch account
                      </button>
                    {:else}
                      <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <Info class="h-4 w-4" />
                        <span class="font-medium">No active session—clicking <span class="font-bold">Issue token</span> will launch sign-in</span>
                      </div>
                    {/if}
                  </div>

                  <Button type="submit" class="w-full gap-2" disabled={loading}>
                    {#if loading}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      {switchingAccount ? 'Switching account...' : 'Acquiring token...'}
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
                  <Badge variant="secondary" class="gap-2 font-semibold text-foreground">
                    <ShieldHalf class="h-4 w-4" />
                    Client credentials
                  </Badge>
                </div>
              </Card.Header>
              <Card.Content class="space-y-4">
                {#if health}
                  <div class="flex flex-col gap-1.5 rounded-lg border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex items-center gap-2">
                      <ShieldHalf class="h-4 w-4 text-muted-foreground" />
                      <span class="text-sm font-medium text-foreground">{credentialPathLabel}</span>
                      <Badge variant="outline" class={credentialBadgeClass}>{credentialStatusLabel}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={credentialStatus === 'ready' ? 'ghost' : 'secondary'}
                      class="h-8"
                      onclick={() => goto('/setup?from=playground')}
                      type="button"
                    >
                      {credentialStatus === 'ready' ? 'Change' : 'Fix in Setup'}
                    </Button>
                  </div>
                  {#if credentialStatus !== 'ready'}
                    <p class="text-[11px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle class="h-3.5 w-3.5" />
                      {credentialErrors[0] ?? 'Finish configuring credentials to issue app tokens.'}
                    </p>
                  {/if}
                {/if}
                <form onsubmit={(e) => { e.preventDefault(); handleAppSubmit(); }} class="space-y-4">
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <Label for="resource">Resource</Label>
                        <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">/.default will be applied</span>
                      </div>
                      <Input
                        type="text"
                        id="resource"
                        bind:value={resource}
                        placeholder="https://graph.microsoft.com or api://client-id"
                        required
                        class={highlightTarget === 'resource'
                          ? 'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background bg-gradient-to-r from-amber-200/70 via-orange-100/70 to-transparent shadow-[0_0_0_10px_rgba(251,191,36,0.35),0_14px_30px_-10px_rgba(249,115,22,0.45)] animate-[pulse_1.2s_ease-in-out_0s_4]'
                          : ''}
                      />
                    </div>
                    
                    <div class="space-y-1.5">
                      <Label class="text-xs text-muted-foreground">Presets</Label>
                      <div class="flex flex-wrap gap-2">
                        {#each resourcePresets as preset}
                          <button 
                            type="button" 
                            class="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onclick={() => applyResourcePreset(preset.value)}
                          >
                            {preset.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>
                  <div class="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Tokens are issued via your confidential client credentials and stay in the browser unless you copy them.
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
                    variant="secondary"
                    class="h-8 gap-2"
                    onclick={() => copyToClipboard(result?.accessToken || '')}
                    disabled={!hasResult}
                    title="Copy access token"
                  >
                    <Copy class="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-8 gap-2"
                    onclick={() => (tokenVisible = !tokenVisible)}
                    disabled={!hasResult}
                    title={tokenVisible ? 'Hide token' : 'Show token'}
                  >
                    {#if tokenVisible}
                      <EyeOff class="h-3.5 w-3.5" />
                      Hide
                    {:else}
                      <Eye class="h-3.5 w-3.5" />
                      Show
                    {/if}
                  </Button>
                  <Separator orientation="vertical" class="h-4" />
                  <Button size="sm" variant="outline" class="h-8 gap-2" onclick={() => tokenDockState.openFullScreen()} title="Open in full screen view">
                    <Maximize2 class="h-3.5 w-3.5" />
                    Full Screen
                  </Button>
                </div>
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
                {#if credentialStatus !== 'ready'}
                  <div class="rounded-lg border border-dashed bg-destructive/5 p-3 space-y-2">
                    <div class="flex items-center gap-2">
                      <ShieldHalf class="h-4 w-4 text-destructive" />
                      <span class="font-semibold">Credential status: {credentialPathLabel}</span>
                      <Badge variant="outline" class={credentialBadgeClass}>{credentialStatusLabel}</Badge>
                    </div>
                    {#if credentialErrors.length}
                      <ul class="list-disc list-inside text-destructive/90 space-y-1">
                        {#each credentialErrors as err}
                          <li>{err}</li>
                        {/each}
                      </ul>
                    {/if}
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-8 gap-2 text-destructive border-destructive/30"
                      onclick={() => goto('/setup?from=playground')}
                    >
                      Open Setup
                    </Button>
                  </div>
                {/if}
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
                      <TokenStatusBadge expiresOn={result.expiresOn} />
                    {:else}
                      <p class="text-xs text-muted-foreground">Lifetime not provided</p>
                    {/if}
                  </div>
                </div>
              {#if showResultScopes}
                <div class="rounded-lg border bg-muted/25 p-4 md:col-span-2 xl:col-span-2">
                  <div class="flex items-center justify-between">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Scopes</p>
                    <Badge variant="outline" class="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">{scopeCount}</Badge>
                  </div>
                  <ScrollArea class="mt-2 h-[110px] rounded-md border bg-background/50 px-2 py-2">
                    <div class="flex flex-wrap gap-1.5">
                      {#each resultScopes as scope}
                        <Badge variant="secondary" class="font-mono text-[11px] leading-4 break-all hover:bg-secondary/80 transition-colors" title={scope}>{scope}</Badge>
                      {/each}
                    </div>
                  </ScrollArea>
                </div>
              {/if}

              {#if audienceClaim}
                <div class="rounded-lg border bg-muted/25 p-4 md:col-span-2 xl:col-span-2">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Audience</p>
                  <div class="mt-2 flex items-start gap-2">
                    <div class="rounded-md border bg-background/50 px-3 py-2 font-mono text-xs text-foreground/90 break-all w-full">
                      {audienceClaim}
                    </div>
                    <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" onclick={() => copyToClipboard(audienceClaim)} title="Copy audience">
                      <Copy class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              {/if}
            </div>

              <div class="grid gap-4 lg:grid-cols-[1.15fr_0.9fr]">
                <div
                  class="space-y-2 rounded-xl border bg-muted/15 p-4"
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
                <h3 class="text-lg font-semibold text-foreground">Run a token flow</h3>
                <p class="mt-2 max-w-sm text-sm text-muted-foreground">
                  Use the App token or User token forms above, then return here to see the raw token and decoded claims.
                </p>
                <Button variant="default" class="gap-2" onclick={() => scrollToFlows({ highlight: true })}>
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
              emptyCtaOnClick={() => scrollToFlows({ highlight: true })}
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
