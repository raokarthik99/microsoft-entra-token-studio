/**
 * Centralized token reissue service.
 * Provides consistent reissue flow that works both via navigation and when already on the playground.
 * 
 * When navigating TO the playground from another page, we use URL params + onMount.
 * When ALREADY on the playground, we use a custom event to trigger token issuance directly.
 */

import { goto } from '$app/navigation';
import { appRegistry } from '$lib/states/app-registry.svelte';
import { favoritesState } from '$lib/states/favorites.svelte';
import type { HistoryItem, FavoriteItem } from '$lib/types';

export interface ReissueContext {
  type: 'App Token' | 'User Token';
  target: string;
  appId?: string;
}

/** Custom event name for reissue requests when already on the playground */
export const REISSUE_EVENT = 'playground:reissue';

/** Type for the reissue event detail */
export interface ReissueEventDetail {
  context: ReissueContext;
}

/**
 * Check if we're currently on the playground page.
 */
function isOnPlaygroundPage(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname;
  return pathname === '/' || pathname === '';
}

/**
 * Build the URL search params for a reissue navigation.
 */
function buildReissueParams(context: ReissueContext): URLSearchParams {
  const params = new URLSearchParams();
  
  if (context.type === 'App Token') {
    params.set('tab', 'app-token');
    params.set('resource', context.target);
  } else {
    params.set('tab', 'user-token');
    params.set('scopes', context.target);
  }
  
  params.set('autorun', 'true');
  return params;
}

/**
 * Switch to the appropriate app before reissue if the app exists.
 */
async function switchToAppIfExists(appId: string | undefined): Promise<void> {
  if (appId && appRegistry.getById(appId)) {
    await appRegistry.setActive(appId);
  }
}

/**
 * Dispatch a reissue event for when we're already on the playground.
 * The playground listens for this and triggers token issuance directly.
 */
function dispatchReissueEvent(context: ReissueContext): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent<ReissueEventDetail>(REISSUE_EVENT, {
    detail: { context },
    bubbles: true,
  });
  window.dispatchEvent(event);
}

/**
 * Core reissue function. 
 * - If already on the playground, dispatches an event to trigger token issuance directly.
 * - If on another page, navigates to the playground with autorun params.
 */
export async function reissue(context: ReissueContext): Promise<void> {
  await switchToAppIfExists(context.appId);
  
  if (isOnPlaygroundPage()) {
    // Already on playground - dispatch event for direct handling
    dispatchReissueEvent(context);
  } else {
    // Navigate to playground with autorun params
    const params = buildReissueParams(context);
    await goto(`/?${params.toString()}`);
  }
}

/**
 * Reissue from a history item.
 */
export async function reissueFromHistory(item: HistoryItem): Promise<void> {
  await reissue({
    type: item.type,
    target: item.target,
    appId: item.appId
  });
}

/**
 * Reissue from a favorite item. Also increments use count.
 */
export async function reissueFromFavorite(favorite: FavoriteItem): Promise<void> {
  await switchToAppIfExists(favorite.appId);
  
  // Increment use count before triggering reissue
  await favoritesState.incrementUse(favorite.id);
  
  const context: ReissueContext = {
    type: favorite.type,
    target: favorite.target
  };
  
  if (isOnPlaygroundPage()) {
    // Already on playground - dispatch event for direct handling
    dispatchReissueEvent(context);
  } else {
    // Navigate to playground with autorun params
    const params = buildReissueParams(context);
    await goto(`/?${params.toString()}`);
  }
}

/**
 * Clear reissue-related URL parameters.
 * Should be called after the playground has consumed the params.
 */
export function clearReissueParams(): void {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  const hasReissueParams = url.searchParams.has('autorun') || 
                           url.searchParams.has('tab') ||
                           url.searchParams.has('resource') ||
                           url.searchParams.has('scopes') ||
                           url.searchParams.has('cta');
  
  if (hasReissueParams) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
