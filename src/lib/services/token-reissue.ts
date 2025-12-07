/**
 * Centralized token reissue service.
 * Provides consistent navigation-based reissue flow with proper URL parameter management.
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
 * Core reissue function. Navigates to the playground with autorun params.
 */
export async function reissue(context: ReissueContext): Promise<void> {
  await switchToAppIfExists(context.appId);
  const params = buildReissueParams(context);
  await goto(`/?${params.toString()}`);
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
  
  // Increment use count before navigation
  await favoritesState.incrementUse(favorite.id);
  
  const params = buildReissueParams({
    type: favorite.type,
    target: favorite.target
  });
  
  await goto(`/?${params.toString()}`);
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
