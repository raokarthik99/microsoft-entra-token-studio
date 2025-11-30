<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import type { HistoryItem, TokenData } from '$lib/types';
  import { parseJwt } from '$lib/utils';
  
  // Shadcn Components
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Label } from "$lib/shadcn/components/ui/label";
  import * as Card from "$lib/shadcn/components/ui/card";
  import * as Tabs from "$lib/shadcn/components/ui/tabs";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  
  // Icons
  import { 
    RotateCcw, 
    LayoutGrid, 
    User, 
    History, 
    ChevronDown, 
    ChevronUp, 
    X, 
    Copy, 
    Play, 
    LogIn,
    Trash2,
    Loader2,
    Check
  } from "@lucide/svelte";

  // State
  let activeTab = $state('app-token');
  let resource = $state('https://graph.microsoft.com');
  let scopes = $state('User.Read');
  let history = $state<HistoryItem[]>([]);
  let result = $state<TokenData | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let isResultCollapsed = $state(true);
  let isResultMinimized = $state(false);
  let clientId = $state<string | null>(null);
  let copied = $state(false);

  // Derived
  let decodedClaims = $derived(result ? parseJwt(result.accessToken) : null);

  onMount(() => {
    // Load saved values
    const lastResource = localStorage.getItem('last_resource');
    if (lastResource) resource = lastResource;

    const lastScopes = localStorage.getItem('last_scopes');
    if (lastScopes) scopes = lastScopes;

    const savedTab = localStorage.getItem('active_tab');
    if (savedTab) activeTab = savedTab;

    loadHistory();
    checkUrlForToken();
    fetchConfig();
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

  async function fetchConfig() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.clientId) clientId = data.clientId;
    } catch (err) {
      console.error('Failed to fetch config', err);
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
        isResultCollapsed = false;
        addToHistory({ type: 'User Token', target: (tokenData.scopes || []).join(' '), timestamp: Date.now() });
        
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse token', e);
        error = 'Failed to parse token from URL';
        isResultCollapsed = false;
      }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
      error = `${urlParams.get('error')}: ${urlParams.get('error_description') || ''}`;
      isResultCollapsed = false;
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
        isResultCollapsed = false;
        addToHistory({ type: 'App Token', target: resource, timestamp: Date.now() });
      } else {
        error = data.error || 'Failed to fetch token';
        isResultCollapsed = false;
      }
    } catch (err: any) {
      error = err.message;
      isResultCollapsed = false;
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
    if (confirm('Are you sure you want to reset forms and clear the current result?')) {
      resource = 'https://graph.microsoft.com';
      scopes = 'User.Read';
      result = null;
      error = null;
      isResultCollapsed = true;
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
</script>

<div class="min-h-screen bg-background p-4 md:p-8 font-sans">
  <div class="mx-auto max-w-6xl space-y-8">
    <!-- Header -->
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight">Entra Token Client</h1>
        <div class="flex items-center gap-3">
          <p class="text-muted-foreground">Generate & Inspect Tokens</p>
          {#if clientId}
            <Badge variant="outline" class="font-mono">Client ID: {clientId}</Badge>
          {/if}
        </div>
      </div>
      <Button variant="outline" size="sm" onclick={resetAll} class="gap-2">
        <RotateCcw class="h-4 w-4" />
        Reset All
      </Button>
    </header>

    <div class="grid gap-8 lg:grid-cols-3">
      <!-- Left Column: Controls -->
      <div class="lg:col-span-2 space-y-6">
        <Tabs.Root value={activeTab} onValueChange={(v) => switchTab(v)} class="w-full">
          <Tabs.List class="grid w-full grid-cols-2">
            <Tabs.Trigger value="app-token" class="gap-2">
              <LayoutGrid class="h-4 w-4" />
              App Token
            </Tabs.Trigger>
            <Tabs.Trigger value="user-token" class="gap-2">
              <User class="h-4 w-4" />
              User Token
            </Tabs.Trigger>
          </Tabs.List>
          
          <div class="mt-4">
            <Tabs.Content value="app-token">
              <Card.Root>
                <Card.Header>
                  <div class="flex items-center justify-between">
                    <Card.Title>App Token (S2S)</Card.Title>
                    <Badge>Client Credentials</Badge>
                  </div>
                  <Card.Description>
                    Generate a token for a daemon app or service using client credentials.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <form onsubmit={(e) => { e.preventDefault(); handleAppSubmit(); }} class="space-y-4">
                    <div class="grid w-full items-center gap-1.5">
                      <Label for="resource">Resource URL</Label>
                      <Input type="text" id="resource" bind:value={resource} placeholder="https://graph.microsoft.com" required />
                    </div>
                    <Button type="submit" class="w-full gap-2" disabled={loading}>
                      {#if loading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                        Processing...
                      {:else}
                        <span>Get App Token</span>
                        <Play class="h-4 w-4" />
                      {/if}
                    </Button>
                  </form>
                </Card.Content>
              </Card.Root>
            </Tabs.Content>

            <Tabs.Content value="user-token">
              <Card.Root>
                <Card.Header>
                  <div class="flex items-center justify-between">
                    <Card.Title>User Token (Auth Code)</Card.Title>
                    <Badge>Auth Code Flow</Badge>
                  </div>
                  <Card.Description>
                    Sign in as a user to generate a token with delegated permissions.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <form onsubmit={(e) => { e.preventDefault(); handleUserSubmit(); }} class="space-y-4">
                    <div class="grid w-full items-center gap-1.5">
                      <Label for="scopes">Scopes</Label>
                      <Input type="text" id="scopes" bind:value={scopes} placeholder="User.Read Mail.Read" required />
                    </div>
                    <Button type="submit" class="w-full gap-2" disabled={loading}>
                      {#if loading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                        Redirecting...
                      {:else}
                        <span>Sign In & Get Token</span>
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

      <!-- Right Column: History -->
      <div class="lg:col-span-1">
        <Card.Root class="h-full max-h-[500px] flex flex-col">
          <Card.Header class="pb-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <History class="h-5 w-5 text-muted-foreground" />
                <Card.Title>Recent Requests</Card.Title>
              </div>
              <Button variant="ghost" size="icon" title="Clear History" onclick={clearHistory}>
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </Card.Header>
          <Separator />
          <Card.Content class="p-0 flex-1 min-h-0">
            <ScrollArea class="h-[400px]">
              <div class="p-4">
                {#if history.length === 0}
                  <div class="text-center text-sm text-muted-foreground py-8">
                    No recent history
                  </div>
                {:else}
                  <ul class="space-y-2">
                    {#each history as item}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                      <li 
                        class="group flex flex-col gap-1 rounded-lg border p-3 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                        onclick={() => restoreHistoryItem(item)}
                      >
                        <div class="flex items-center justify-between text-xs text-muted-foreground">
                          <span class="font-medium text-foreground">{item.type}</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="truncate font-mono text-xs" title={item.target}>
                          {item.target}
                        </div>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </ScrollArea>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  </div>

  <!-- Collapsible Result Section -->
  {#if result || error}
    <div 
      class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-2xl transition-all duration-300 ease-in-out"
      class:translate-y-[calc(100%-3.5rem)]={isResultCollapsed && !isResultMinimized}
      class:translate-y-[calc(100%-0rem)]={isResultMinimized}
    >
      <!-- Header -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div 
        class="flex h-14 items-center justify-between border-b px-4 hover:bg-accent/50 cursor-pointer"
        onclick={() => isResultCollapsed = !isResultCollapsed}
      >
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" class="h-8 w-8" onclick={(e) => { e.stopPropagation(); isResultCollapsed = !isResultCollapsed; }}>
            {#if isResultCollapsed}
              <ChevronUp class="h-4 w-4" />
            {:else}
              <ChevronDown class="h-4 w-4" />
            {/if}
          </Button>
          <h3 class="font-semibold">Token Result</h3>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" class="h-8 w-8" onclick={(e) => { e.stopPropagation(); isResultCollapsed = true; result = null; error = null; }}>
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="h-[500px] overflow-auto p-4 md:p-8 bg-muted/30">
        <div class="mx-auto max-w-5xl">
          {#if error}
            <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              <strong class="font-semibold">Error:</strong> {error}
            </div>
          {:else if result}
            <div class="space-y-6">
              <Card.Root>
                <Card.Header class="pb-2">
                  <div class="flex items-center justify-between">
                    <Card.Title class="text-sm font-medium text-muted-foreground">Access Token</Card.Title>
                    <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => copyToClipboard(result?.accessToken || '')} title="Copy">
                      {#if copied}
                        <Check class="h-4 w-4 text-green-500" />
                      {:else}
                        <Copy class="h-4 w-4" />
                      {/if}
                    </Button>
                  </div>
                </Card.Header>
                <Card.Content>
                  <pre class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs break-all whitespace-pre-wrap">{result.accessToken}</pre>
                </Card.Content>
              </Card.Root>
              
              {#if decodedClaims}
                <Card.Root>
                  <Card.Header class="pb-2">
                    <Card.Title class="text-sm font-medium text-muted-foreground">Decoded Claims</Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <ScrollArea class="h-[200px] rounded-lg border bg-muted/50 p-4">
                      <div class="grid grid-cols-[1fr_2fr] gap-x-4 gap-y-2 text-xs font-mono">
                        {#each Object.entries(decodedClaims) as [k, v]}
                          <div class="font-semibold text-foreground/70 truncate" title={k}>{k}</div>
                          <div class="text-muted-foreground break-all">{typeof v === 'object' ? JSON.stringify(v) : v}</div>
                        {/each}
                      </div>
                    </ScrollArea>
                  </Card.Content>
                </Card.Root>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
