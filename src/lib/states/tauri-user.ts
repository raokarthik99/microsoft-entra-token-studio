/**
 * Tauri User State
 * 
 * Stores user info from sidecar authentication.
 * This is separate from msal-browser's AuthService which only works in web mode.
 */

import { writable, derived, get } from 'svelte/store';
import { CLIENT_STORAGE_KEYS, clientStorage } from '$lib/services/client-storage';
import type { AppConfig } from '$lib/types';

export interface TauriUser {
  username: string;
  name?: string;
  homeAccountId?: string;
  tenantId?: string;
  environment?: string;
  /** Azure AD object id (from Graph /me). */
  objectId?: string;
}

const tauriUserStore = writable<TauriUser | null>(null);
const tauriUserRevisionStore = writable(0);

function bumpTauriUserRevision(): void {
  tauriUserRevisionStore.update((value) => value + 1);
}

type TauriAppContext = Pick<AppConfig, 'id' | 'clientId' | 'tenantId'>;

interface StoredTauriUserSession {
  clientId: string;
  tenantId: string;
  user: TauriUser;
  setAt: number;
}

type StoredTauriUserSessions = Record<string, StoredTauriUserSession>;

let sessionsCache: StoredTauriUserSessions | null = null;
let sessionsLoadPromise: Promise<StoredTauriUserSessions> | null = null;

async function loadSessions(): Promise<StoredTauriUserSessions> {
  if (sessionsCache) return sessionsCache;
  if (sessionsLoadPromise) return sessionsLoadPromise;

  sessionsLoadPromise = (async () => {
    const stored = await clientStorage.get<StoredTauriUserSessions>(CLIENT_STORAGE_KEYS.tauriUserSessions, {});
    sessionsCache = stored ?? {};
    sessionsLoadPromise = null;
    return sessionsCache;
  })();

  return sessionsLoadPromise;
}

async function saveSessions(sessions: StoredTauriUserSessions): Promise<void> {
  sessionsCache = sessions;
  await clientStorage.set(CLIENT_STORAGE_KEYS.tauriUserSessions, sessions);
}

export async function restoreTauriUserForApp(app: TauriAppContext | null): Promise<TauriUser | null> {
  if (!app) {
    tauriUserStore.set(null);
    return null;
  }

  const sessions = await loadSessions();
  const session = sessions[app.id];

  if (!session) {
    tauriUserStore.set(null);
    return null;
  }

  // If the app was edited (client/tenant changed), treat the old session as stale.
  if (session.clientId !== app.clientId || session.tenantId !== app.tenantId) {
    delete sessions[app.id];
    await saveSessions(sessions);
    tauriUserStore.set(null);
    return null;
  }

  tauriUserStore.set(session.user);
  return session.user;
}

export async function persistTauriUserForApp(app: TauriAppContext, user: TauriUser): Promise<void> {
  const sessions = await loadSessions();
  sessions[app.id] = {
    clientId: app.clientId,
    tenantId: app.tenantId,
    user,
    setAt: Date.now(),
  };
  await saveSessions(sessions);
}

export function updateTauriUser(patch: Partial<TauriUser>, app?: TauriAppContext): void {
  const current = get(tauriUserStore);
  if (!current) return;

  const next: TauriUser = { ...current, ...patch };
  tauriUserStore.set(next);
  if (app) {
    void persistTauriUserForApp(app, next);
  }
}

export async function clearTauriUserForApp(appId: string): Promise<void> {
  const sessions = await loadSessions();
  if (!sessions[appId]) return;
  delete sessions[appId];
  await saveSessions(sessions);
}

/**
 * Set the Tauri user after successful sidecar authentication
 */
export function setTauriUser(account: {
  username?: string;
  name?: string;
  homeAccountId?: string;
  tenantId?: string;
  environment?: string;
  objectId?: string;
} | null, app?: TauriAppContext): void {
  if (!account?.username) {
    tauriUserStore.set(null);
    bumpTauriUserRevision();
    if (app) {
      void clearTauriUserForApp(app.id);
    }
    return;
  }
  
  const user: TauriUser = {
    username: account.username,
    name: account.name,
    homeAccountId: account.homeAccountId,
    tenantId: account.tenantId,
    environment: account.environment,
    objectId: account.objectId,
  };

  tauriUserStore.set(user);
  bumpTauriUserRevision();
  if (app) {
    void persistTauriUserForApp(app, user);
  }
}

/**
 * Clear the Tauri user (logout)
 */
export function clearTauriUser(appId?: string): void {
  tauriUserStore.set(null);
  bumpTauriUserRevision();
  if (appId) {
    void clearTauriUserForApp(appId);
  }
}

/**
 * Readable store for Tauri user state
 */
export const tauriUser = {
  subscribe: tauriUserStore.subscribe,
};

export const tauriUserRevision = {
  subscribe: tauriUserRevisionStore.subscribe,
};

/**
 * Derived store: is user authenticated in Tauri mode?
 */
export const isTauriAuthenticated = derived(tauriUserStore, ($user) => !!$user);
