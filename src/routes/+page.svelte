<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import type { HistoryItem, TokenData } from '$lib/types';
  import { parseJwt } from '$lib/utils';

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

<div class="app-container">
  <header class="app-header">
    <div class="brand">
      <h1>Entra Token Client</h1>
      <div style="display:flex; align-items:center; gap:1rem;">
        <p class="subtitle">Generate & Inspect Tokens</p>
        {#if clientId}
          <span class="badge-outline">Client ID: {clientId}</span>
        {/if}
      </div>
    </div>
    <button class="btn-secondary btn-sm" title="Reset forms and clear results" onclick={resetAll}>
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
      Reset All
    </button>
  </header>

  <main class="dashboard-grid">
    <!-- Left Column: Controls -->
    <div class="controls-column">
      <!-- Tabs -->
      <div class="tab-group">
        <button class="tab-btn {activeTab === 'app-token' ? 'active' : ''}" onclick={() => switchTab('app-token')}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
          App Token
        </button>
        <button class="tab-btn {activeTab === 'user-token' ? 'active' : ''}" onclick={() => switchTab('user-token')}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          User Token
        </button>
      </div>

      <!-- App Token Form -->
      {#if activeTab === 'app-token'}
        <section class="card form-panel active">
          <div class="panel-header">
            <h2>App Token (S2S)</h2>
            <span class="badge">Client Credentials</span>
          </div>
          <p class="panel-desc">Generate a token for a daemon app or service using client credentials.</p>
          <form onsubmit={(e) => { e.preventDefault(); handleAppSubmit(); }}>
            <div class="form-group">
              <label for="resource">Resource URL</label>
              <input type="text" id="resource" bind:value={resource} placeholder="https://graph.microsoft.com" required>
            </div>
            <button type="submit" class="btn-primary" disabled={loading}>
              {#if loading}
                <span class="loader"></span> Processing...
              {:else}
                <span>Get App Token</span>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              {/if}
            </button>
          </form>
        </section>
      {/if}

      <!-- User Token Form -->
      {#if activeTab === 'user-token'}
        <section class="card form-panel active">
          <div class="panel-header">
            <h2>User Token (Auth Code)</h2>
            <span class="badge">Auth Code Flow</span>
          </div>
          <p class="panel-desc">Sign in as a user to generate a token with delegated permissions.</p>
          <form onsubmit={(e) => { e.preventDefault(); handleUserSubmit(); }}>
            <div class="form-group">
              <label for="scopes">Scopes</label>
              <input type="text" id="scopes" bind:value={scopes} placeholder="User.Read Mail.Read" required>
            </div>
            <button type="submit" class="btn-primary" disabled={loading}>
              {#if loading}
                <span class="loader"></span> Redirecting...
              {:else}
                <span>Sign In & Get Token</span>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
              {/if}
            </button>
          </form>
        </section>
      {/if}
    </div>

    <!-- Right Column: History -->
    <div class="history-column">
      <section class="card history-panel">
        <div class="panel-header">
          <h3>Recent Requests</h3>
          <button class="icon-btn-sm" title="Clear History" onclick={clearHistory}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
        <ul class="history-list">
          {#if history.length === 0}
            <li style="color: var(--text-muted); text-align: center; padding: 1rem; font-size: 0.85rem;">No recent history</li>
          {:else}
            {#each history as item}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <li class="history-item" onclick={() => restoreHistoryItem(item)}>
                <div class="history-meta">
                  <span>{item.type}</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="history-target" title={item.target}>{item.target}</div>
              </li>
            {/each}
          {/if}
        </ul>
      </section>
    </div>
  </main>

  <!-- Collapsible Result Section -->
  <div class="result-container {isResultCollapsed ? 'collapsed' : ''} {isResultMinimized ? 'minimized' : ''}">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="result-header" onclick={() => isResultMinimized = !isResultMinimized}>
      <div class="header-left">
        <button class="icon-btn" title="Toggle Result">
          <svg class="chevron-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <h3>Token Result</h3>
      </div>
      <button class="icon-btn" title="Close" onclick={(e) => { e.stopPropagation(); isResultCollapsed = true; }}>
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
    
    <div class="result-content">
      {#if error}
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error); color: var(--error); padding: 1rem; border-radius: 0.5rem;">
          <strong>Error:</strong> {error}
        </div>
      {:else if result}
        <div class="token-display">
          <div class="token-box">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <h3 style="font-size:0.9rem; color:var(--text-muted);">Access Token</h3>
              <button class="icon-btn-sm" onclick={() => copyToClipboard(result?.accessToken || '')} title="Copy">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
            </div>
            <pre class="token-content">{result.accessToken}</pre>
          </div>
          
          {#if decodedClaims}
            <div class="token-box">
              <h3 style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0.5rem;">Decoded Claims</h3>
              <div class="claims-grid" style="max-height:200px; overflow-y:auto;">
                {#each Object.entries(decodedClaims) as [k, v]}
                  <div class="claim-key">{k}</div>
                  <div class="claim-value">{typeof v === 'object' ? JSON.stringify(v) : v}</div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
