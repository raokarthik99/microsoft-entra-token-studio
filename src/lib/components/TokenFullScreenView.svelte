<script lang="ts">
  import { goto } from "$app/navigation";
  import { X, Copy, Check, FileJson, Shield, User, Eye, EyeOff, Play, Star, StarOff, Maximize2, ShieldCheck, Clock3, AlertTriangle, Info } from "@lucide/svelte";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import * as Card from "$lib/shadcn/components/ui/card";
  import * as Tooltip from "$lib/shadcn/components/ui/tooltip";
  import DecodedClaims from "./DecodedClaims.svelte";
  import { fade, fly } from "svelte/transition";
  import { toast } from "svelte-sonner";

  import TokenStatusBadge from "./TokenStatusBadge.svelte";
  import FavoriteFormSheet from "$lib/components/FavoriteFormSheet.svelte";
  import { favoritesState } from "$lib/states/favorites.svelte";
  import { tokenDockState } from "$lib/states/token-dock.svelte";
  import { appRegistry } from "$lib/states/app-registry.svelte";
  import { getTokenStatus } from "$lib/utils";
  import { time } from "$lib/stores/time";
  import type { FavoriteItem, HistoryItem } from "$lib/types";

  let { 
    result = null, 
    decodedClaims = null, 
    onClose 
  } = $props<{ 
    result: any, 
    decodedClaims: any, 
    onClose: () => void 
  }>();

  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);
  let copiedToken = $state(false);
  let showRawToken = $state(true);

  const activeToken = $derived(tokenDockState.token);
  const hasToken = $derived(Boolean(result?.accessToken));
  const favoriteTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );
  const currentFavorited = $derived(
    activeToken
      ? favoritesState.items.some((fav) => fav.type === activeToken.type && fav.target === activeToken.target)
      : false
  );

  async function copyToken() {
    if (!result?.accessToken) return;
    try {
      await navigator.clipboard.writeText(result.accessToken);
      copiedToken = true;
      toast.success("Token copied to clipboard");
      setTimeout(() => copiedToken = false, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error("Failed to copy token");
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error("Failed to copy to clipboard");
    }
  }

  async function reissueCurrent() {
    const context = activeToken ?? tokenDockState.context;
    if (!context?.type || !context?.target) return;

    // Auto-switch to the app that was used for this token
    if (activeToken?.appId && appRegistry.getById(activeToken.appId)) {
      await appRegistry.setActive(activeToken.appId);
    }

    const params = new URLSearchParams();
    if (context.type === 'App Token') {
      params.set('tab', 'app-token');
      params.set('resource', context.target);
    } else {
      params.set('tab', 'user-token');
      params.set('scopes', context.target);
    }
    params.set('autorun', 'true');

    tokenDockState.closeFullScreen();
    await goto(`/?${params.toString()}`);
  }

  function toggleVisibility() {
    showRawToken = !showRawToken;
  }

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
  };

  function startFavorite() {
    if (!activeToken) return;
    favoriteDraft = activeToken;
    favoriteOpen = true;
  }

  async function saveFavorite(payload: FavoriteFormValue) {
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

  async function removeFavorite() {
    if (!activeToken) return;
    const match = favoritesState.items.find(
      (fav) => fav.type === activeToken.type && fav.target === activeToken.target
    );
    if (!match) return;
    await favoritesState.delete(match);
    toast.success('Removed from favorites');
  }

  // Derived values
  const resultKind = $derived(result ? (result.scopes?.length ? 'User Token' : 'App Token') : 'Token');
  const currentStatus = $derived(result?.expiresOn ? getTokenStatus(new Date(result.expiresOn), $time) : null);
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
  
  const showResultScopes = $derived(resultKind !== 'App Token' && resultScopes.length > 0);
  const scopeCount = $derived(resultScopes.length);

</script>

<div class="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90" transition:fade={{ duration: 200 }}>
  <!-- Header -->
  <header class="flex flex-col gap-3 border-b bg-background/50 px-6 py-3 shadow-sm md:flex-row md:items-center md:justify-between shrink-0">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-3">
        <div>
          <h2 class="text-lg font-semibold leading-none tracking-tight">Token result</h2>
        </div>
      </div>
      
      <Separator orientation="vertical" class="h-8 hidden md:block" />
    </div>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        class="gap-2"
        onclick={copyToken}
        disabled={!hasToken}
        title="Copy access token"
      >
        {#if copiedToken}
          <Check class="h-4 w-4 text-green-500" />
          Copied
        {:else}
          <Copy class="h-4 w-4" />
          Copy
        {/if}
      </Button>
      <Button
        size="sm"
        variant={currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'default' : 'ghost'}
        class={`gap-2 ${currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'shadow-[0_0_15px_-3px_oklch(var(--primary)/0.6)] hover:shadow-[0_0_20px_-3px_oklch(var(--primary)/0.7)] transition-all' : ''}`}
        onclick={reissueCurrent}
        disabled={!activeToken}
        title="Reissue this token"
      >
        <Play class="h-4 w-4" />
        Reissue
      </Button>
      <Button
        size="sm"
        variant={currentFavorited ? 'secondary' : 'ghost'}
        class="gap-2"
        onclick={() => (currentFavorited ? removeFavorite() : startFavorite())}
        disabled={!activeToken}
        title={currentFavorited ? 'Remove from favorites' : 'Add to favorites'}
      >
        {#if currentFavorited}
          <StarOff class="h-4 w-4" />
          Remove Favorite
        {:else}
          <Star class="h-4 w-4" />
          Favorite
        {/if}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        class="gap-2"
        onclick={toggleVisibility}
        disabled={!hasToken}
        title={showRawToken ? 'Hide token' : 'Show token'}
      >
        {#if showRawToken}
          <EyeOff class="h-4 w-4" />
          Hide
        {:else}
          <Eye class="h-4 w-4" />
          Show
        {/if}
      </Button>
      <Separator orientation="vertical" class="hidden h-6 md:block" />
      <Button variant="ghost" size="icon" class="h-9 w-9" onclick={onClose} title="Exit full screen (Esc)">
        <X class="h-5 w-5" />
      </Button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="flex-1 overflow-hidden p-6">
    <div class="flex flex-col h-full gap-6">
      
      <!-- Top Section: Summary Cards -->
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 shrink-0">
        <div class="rounded-lg border bg-muted/25 p-4">
          <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Type</p>
          <div class="text-sm font-semibold text-foreground">{resultKind || 'Token'}</div>
          <p class="text-xs text-muted-foreground">{result?.tokenType || 'Bearer'}</p>
        </div>
        <div class="rounded-lg border bg-muted/25 p-4">
          <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Client App</p>
          {#if activeToken?.appName}
            <div class="flex items-center gap-2 mt-1">
              <div 
                class="w-3 h-3 rounded-full shrink-0" 
                style="background-color: {activeToken.appColor || '#10b981'}"
              ></div>
              <span class="text-sm font-semibold text-foreground">{activeToken.appName}</span>
            </div>
            <Tooltip.Root delayDuration={0}>
              <Tooltip.Trigger>
                <span class="text-xs text-muted-foreground mt-1 cursor-help inline-block">
                  {activeToken.appId ? `ID: ${activeToken.appId.slice(0, 20)}...` : 'App context preserved'}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p class="font-mono text-xs">{activeToken.appId}</p>
              </Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <div class="text-sm font-semibold text-foreground">Legacy token</div>
            <p class="text-xs text-muted-foreground">No app context available</p>
          {/if}
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
        
        <!-- Scopes / Audience (Merged into top grid for efficiency) -->
         {#if showResultScopes}
            <div class="rounded-lg border bg-muted/25 p-4">
               <div class="flex items-center justify-between">
                <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Scopes</p>
                <Badge variant="outline" class="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">{scopeCount}</Badge>
              </div>
              <ScrollArea class="mt-2 h-[42px] rounded-md border bg-background/50 px-2 py-1">
                <div class="flex flex-wrap gap-1.5">
                  {#each resultScopes as scope}
                    <Badge variant="secondary" class="font-mono text-[10px] leading-4 break-all hover:bg-secondary/80 transition-colors" title={scope}>{scope}</Badge>
                  {/each}
                </div>
              </ScrollArea>
            </div>
         {:else if audienceClaim}
            <div class="rounded-lg border bg-muted/25 p-4">
              <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Audience</p>
              <div class="mt-2 flex items-start gap-2">
                <div class="rounded-md border bg-background/50 px-3 py-1 font-mono text-xs text-foreground/90 break-all w-full truncate">
                  {audienceClaim}
                </div>
                <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" onclick={() => copyToClipboard(audienceClaim)} title="Copy audience">
                  <Copy class="h-3 w-3" />
                </Button>
              </div>
            </div>
         {:else}
            <!-- Spacer if neither scopes nor audience -->
            <div class="hidden xl:block"></div>
         {/if}
      </div>

      <!-- Bottom Section: Token & Claims -->
      <div class="grid gap-6 lg:grid-cols-2 flex-1 min-h-0">
        
        <!-- Raw Token -->
        <div class="flex flex-col overflow-hidden rounded-xl border bg-muted/15 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
            <div>
              <p class="text-sm font-semibold">Access token</p>
              <p class="text-xs text-muted-foreground">Raw token is kept client-side for inspection and copy.</p>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="sm" class="gap-2" onclick={toggleVisibility} title={showRawToken ? 'Hide token' : 'Show token'}>
                {#if showRawToken}
                  <EyeOff class="h-4 w-4" />
                  Hide
                {:else}
                  <Eye class="h-4 w-4" />
                  Show
                {/if}
              </Button>
              <Button variant="secondary" size="sm" class="gap-2" onclick={copyToken} title="Copy access token">
                <Copy class="h-4 w-4" />
                {copiedToken ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <div class="flex-1 overflow-hidden rounded-lg border bg-muted/40 relative">
             {#if showRawToken}
              <ScrollArea class="h-full w-full p-4">
                <pre class="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground/90">{result?.accessToken}</pre>
              </ScrollArea>
            {:else}
              <div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
                <EyeOff class="h-5 w-5" />
                <div class="text-center leading-relaxed">
                  Token is hidden. Use the Show action to reveal it again.
                </div>
                <Button size="sm" variant="secondary" class="gap-2" onclick={toggleVisibility}>
                  <Eye class="h-4 w-4" />
                  Show token
                </Button>
              </div>
            {/if}
          </div>
        </div>

        <!-- Decoded Claims -->
        <div class="flex flex-col overflow-hidden rounded-xl border bg-muted/10 p-4">
           <div class="mb-3 shrink-0">
             <p class="text-sm font-semibold">Decoded Claims</p>
             <p class="text-xs text-muted-foreground">JWT claims parsed from the access token.</p>
           </div>
           <div class="flex-1 overflow-hidden rounded-lg border bg-background/50">
             <!-- DecodedClaims component handles its own scrolling usually, but we want to constrain it -->
             <div class="h-full overflow-y-auto custom-scrollbar p-4">
                <DecodedClaims claims={decodedClaims} />
             </div>
           </div>
        </div>

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
    onSave={saveFavorite}
    onClose={() => {
      favoriteOpen = false;
      favoriteDraft = null;
    }}
  />
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.2);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--muted-foreground) / 0.4);
  }
</style>
