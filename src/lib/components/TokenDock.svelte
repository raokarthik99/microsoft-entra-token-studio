<script lang="ts">
  import { goto } from '$app/navigation';
  import TokenStatusBadge from '$lib/components/TokenStatusBadge.svelte';
  import TokenFullScreenView from '$lib/components/TokenFullScreenView.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import { historyState } from '$lib/states/history.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import { tokenDockState } from '$lib/states/token-dock.svelte';
  import { appRegistry } from '$lib/states/app-registry.svelte';
  import { reissue } from '$lib/services/token-reissue';
  import { parseJwt, getTokenStatus } from '$lib/utils';
  import { time } from '$lib/stores/time';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/shadcn/components/ui/button';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import * as Tooltip from '$lib/shadcn/components/ui/tooltip';
  import {
    Link2,
    Maximize2,
    ChevronDown,
    Copy,
    Eye,
    EyeOff,
    Loader2,
    AlertTriangle,
    Play,
    Star,
    StarOff,
    Pin,
    PinOff
  } from '@lucide/svelte';
  import type { FavoriteItem, HistoryItem } from '$lib/types';

  let tokenVisible = $state(true);
  let isExpanded = $state(false);
  let userCollapsed = $state(false);
  let copied = $state(false);
  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);
  let pinMode = $state(false);

  const activeToken = $derived(tokenDockState.token);
  const tokenData = $derived(activeToken?.tokenData ?? null);
  const hasToken = $derived(Boolean(tokenData?.accessToken));
  const decodedClaims = $derived(tokenData?.accessToken ? parseJwt(tokenData.accessToken) : null);
  const scopeList = $derived.by(() => {
    if (!tokenData) return [];
    if (tokenData.scopes?.length) return tokenData.scopes;
    if (tokenData.scope) return tokenData.scope.split(' ').filter(Boolean);
    return [];
  });
  const scopeCount = $derived(scopeList.length);
  const currentStatus = $derived(tokenData?.expiresOn ? getTokenStatus(new Date(tokenData.expiresOn), $time) : null);
  const headerLabel = $derived(activeToken?.type ?? 'Token');
  const statusText = $derived.by(() => {
    if (tokenDockState.status === 'loading') return 'Issuing token...';
    if (tokenDockState.status === 'error') return 'Issue failed';
    if (hasToken) return activeToken?.target || 'Token ready';
    return 'Not issued yet';
  });
  const marqueeActive = $derived(Boolean(statusText) && statusText.length > 42);
  const favoriteTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );
  const currentFavorited = $derived(
    activeToken
      ? favoritesState.isFavorited(activeToken.type, activeToken.target)
      : false
  );
  const currentPinned = $derived(
    activeToken ? favoritesState.isPinnedTarget(activeToken.type, activeToken.target) : false
  );
  const shouldShow = $derived(tokenDockState.status !== 'idle' || hasToken);

  $effect(() => {
    if (tokenDockState.status === 'loading' || tokenDockState.status === 'error') {
      isExpanded = true;
      userCollapsed = false;
    } else if (hasToken && !isExpanded && !userCollapsed) {
      isExpanded = true;
    }
  });

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
    isPinned?: boolean;
    pinnedAt?: number | null;
  };

  function startFavorite() {
    if (!activeToken) return;
    favoriteDraft = activeToken;
    pinMode = false;
    favoriteOpen = true;
  }

  async function saveFavorite(payload: FavoriteFormValue) {
    if (!favoriteDraft) return;
    try {
      const extras: Partial<FavoriteItem> = {
        ...payload,
        isPinned: pinMode || payload.isPinned,
        pinnedAt: pinMode ? Date.now() : payload.pinnedAt
      };
      await favoritesState.addFromHistory(favoriteDraft, extras);
      await favoritesState.load();
      toast.success(pinMode ? 'Pinned and added to favorites' : 'Added to favorites');
    } catch (err) {
      console.error('Failed to add favorite', err);
      toast.error('Could not add to favorites');
    } finally {
      favoriteDraft = null;
      favoriteOpen = false;
      pinMode = false;
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

  async function pinActive() {
    if (!activeToken) return;
    const match = favoritesState.findMatch(activeToken.type, activeToken.target);
    if (match) {
      const result = await favoritesState.pin(match.id);
      if (!result.success && result.reason === 'limit') {
        toast.error('You can pin up to five favorites. Unpin one to add this.');
        return;
      }
      toast.success('Pinned to navigation');
      return;
    }

    if (favoritesState.pinnedCount >= 5) {
      toast.error('You can pin up to five favorites. Unpin one to add this.');
      return;
    }

    pinMode = true;
    favoriteDraft = activeToken;
    favoriteOpen = true;
  }

  async function unpinActive() {
    if (!activeToken) return;
    const match = favoritesState.items.find(
      (fav) => fav.type === activeToken.type && fav.target === activeToken.target
    );
    if (!match) return;
    await favoritesState.unpin(match.id);
    toast.success('Unpinned');
  }

  async function copyToken() {
    if (!tokenData?.accessToken) return;
    try {
      await navigator.clipboard.writeText(tokenData.accessToken);
      copied = true;
      toast.success('Copied to clipboard');
      setTimeout(() => (copied = false), 1800);
    } catch (err) {
      console.error('Failed to copy token', err);
      toast.error('Failed to copy token');
    }
  }

  async function jumpToOutput() {
    if (typeof document !== 'undefined') {
      const outputEl = document.getElementById('output');
      if (outputEl) {
        outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        (outputEl as HTMLElement).focus({ preventScroll: true });
        return;
      }
    }
    await goto('/#output');
  }

  async function reissueCurrent() {
    if (!activeToken) return;
    
    await reissue({
      type: activeToken.type,
      target: activeToken.target,
      appId: activeToken.appId
    });
  }

  async function startGenerating() {
    await goto('/?cta=start-generating');
  }

  function toggleVisibility() {
    tokenVisible = !tokenVisible;
  }

  function openFullScreen() {
    tokenDockState.openFullScreen();
    isExpanded = true;
  }

  function toggleExpanded() {
    const next = !isExpanded;
    isExpanded = next;
    userCollapsed = !next;
  }
</script>

<style>
  @keyframes token-dock-marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .marquee-track {
    display: inline-flex;
    gap: 2rem;
    min-width: 200%;
    animation: token-dock-marquee 14s linear infinite;
  }

  .marquee-mask {
    mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
  }
</style>

{#if shouldShow}
  <div class="pointer-events-none fixed inset-x-3 bottom-3 z-50 md:inset-auto md:bottom-6 md:right-6 md:w-[420px]">
    <div class="pointer-events-auto overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div class="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div class="flex flex-1 items-center gap-2 min-w-0">
          <Badge variant="secondary" class="gap-1 text-[11px] shrink-0">{headerLabel}</Badge>
          <div class={`flex-1 min-w-0 text-xs text-muted-foreground ${marqueeActive ? 'marquee-mask' : ''}`} title={statusText}>
            {#if marqueeActive}
              <div class="marquee-track">
                <span class="shrink-0">{statusText}</span>
                <span class="shrink-0" aria-hidden="true">{statusText}</span>
              </div>
            {:else}
              <span class="truncate">{statusText}</span>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" class="h-8 w-8" onclick={jumpToOutput} title="Jump to full output">
            <Link2 class="h-4 w-4 -rotate-45" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            onclick={openFullScreen}
            title="Maximize view"
            disabled={!hasToken}
          >
            <Maximize2 class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            onclick={toggleExpanded}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse floating token output' : 'Expand floating token output'}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown class={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {#if isExpanded}
        <div class="space-y-3 px-4 py-3">
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {#if activeToken?.appName}
              <Tooltip.Root delayDuration={0}>
                <Tooltip.Trigger>
                  <div class="flex items-center gap-1.5 rounded-full border px-2 py-1 bg-muted/50">
                    <div
                      class="w-2 h-2 rounded-full shrink-0"
                      style="background-color: {activeToken.appColor || '#10b981'}"
                    ></div>
                    <span class="text-[11px] text-foreground truncate max-w-[88px]">
                      {activeToken.appName}
                    </span>
                  </div>
                </Tooltip.Trigger>
                {#if activeToken.appId}
                  <Tooltip.Content>
                    <div class="flex flex-col gap-1 text-[11px]">
                      <span class="font-semibold">{activeToken.appName}</span>
                      <span class="font-mono text-muted-foreground">{activeToken.appId}</span>
                    </div>
                  </Tooltip.Content>
                {/if}
              </Tooltip.Root>
            {/if}
            {#if hasToken && tokenData?.expiresOn}
              <TokenStatusBadge expiresOn={tokenData.expiresOn} class="px-2 py-1 font-normal" />
            {:else if tokenDockState.status === 'error'}
              <Badge variant="outline" class="px-2 py-1 font-normal">Issue failed</Badge>
            {/if}
          </div>

          <div class="rounded-lg border bg-muted/20 p-3">
            {#if tokenDockState.status === 'error'}
              <div class="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle class="h-4 w-4 shrink-0" />
                <span class="line-clamp-3 break-all leading-relaxed">{tokenDockState.error || 'Token issue failed.'}</span>
              </div>
            {:else if tokenDockState.status === 'loading'}
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="h-4 w-4 animate-spin" />
                <span>Issuing token...</span>
              </div>
            {:else if hasToken && tokenVisible}
              <div class="line-clamp-4 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/90">
                {tokenData?.accessToken}
              </div>
            {:else if hasToken && !tokenVisible}
              <div class="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>Token hidden.</span>
                <Button size="sm" variant="ghost" class="gap-1 px-2" onclick={() => (tokenVisible = true)} title="Show token">
                  <Eye class="h-4 w-4" />
                  Show
                </Button>
              </div>
            {:else}
              <div class="space-y-2 text-sm text-muted-foreground">
                <p class="leading-relaxed">Issue an app or user token and it will stay docked here for quick copy.</p>
                <Button size="sm" variant="default" class="gap-2" onclick={startGenerating}>
                  <Play class="h-4 w-4" />
                  Start generating
                </Button>
              </div>
            {/if}
          </div>

          {#if hasToken}
            <div class="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                class="gap-2"
                onclick={copyToken}
                disabled={!hasToken}
                title="Copy access token"
              >
                <Copy class="h-4 w-4" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant={currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'default' : 'ghost'}
                class={`gap-2 ${currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'shadow-[0_0_15px_-3px_oklch(var(--primary)/0.6)] hover:shadow-[0_0_20px_-3px_oklch(var(--primary)/0.7)] transition-all' : ''}`}
                onclick={reissueCurrent}
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
                variant={currentPinned ? 'secondary' : 'ghost'}
                class="gap-2"
                onclick={() => (currentPinned ? unpinActive() : pinActive())}
                disabled={!activeToken}
                title={currentPinned ? 'Unpin from navigation' : 'Pin for instant access'}
              >
                {#if currentPinned}
                  <PinOff class="h-4 w-4" />
                  Unpin
                {:else}
                  <Pin class="h-4 w-4" />
                  Pin
                {/if}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="gap-2"
                onclick={toggleVisibility}
                title={tokenVisible ? 'Hide token' : 'Show token'}
              >
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

  {#if tokenDockState.isFullScreen && hasToken && tokenData}
    <TokenFullScreenView
      result={tokenData}
      decodedClaims={decodedClaims}
      onClose={() => tokenDockState.closeFullScreen()}
    />
  {/if}

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
      pinMode = false;
    }}
  />
{/if}
