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

function normalizeHomeAccountId(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeUsername(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function isSameTauriIdentity(
  a: { homeAccountId?: string | null; username?: string | null },
  b: { homeAccountId?: string | null; username?: string | null },
): boolean {
  const aHome = normalizeHomeAccountId(a.homeAccountId);
  const bHome = normalizeHomeAccountId(b.homeAccountId);
  if (aHome && bHome) return aHome === bHome;

  const aUsername = normalizeUsername(a.username);
  const bUsername = normalizeUsername(b.username);
  return Boolean(aUsername && bUsername && aUsername === bUsername);
}

function isBlobLike(value: unknown): value is Blob {
  if (!value) return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;

  const candidate = value as any;
  return (
    typeof candidate === 'object' &&
    typeof candidate.arrayBuffer === 'function' &&
    typeof candidate.slice === 'function' &&
    typeof candidate.type === 'string'
  );
}

const tauriUserStore = writable<TauriUser | null>(null);
const tauriUserRevisionStore = writable(0);

function bumpTauriUserRevision(): void {
  tauriUserRevisionStore.update((value) => value + 1);
}

type TauriAppContext = Pick<AppConfig, 'id' | 'clientId' | 'tenantId'>;

interface StoredTauriUserPhoto {
  blob: Blob;
  setAt: number;
}

interface StoredTauriUserSession {
  clientId: string;
  tenantId: string;
  user: TauriUser;
  setAt: number;
  photo?: StoredTauriUserPhoto;
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

function isSameUser(a: TauriUser, b: TauriUser): boolean {
  return isSameTauriIdentity(a, b);
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
  const existing = sessions[app.id];
  const preservePhoto =
    existing &&
    existing.clientId === app.clientId &&
    existing.tenantId === app.tenantId &&
    Boolean(existing.photo) &&
    isSameUser(existing.user, user);

  sessions[app.id] = {
    clientId: app.clientId,
    tenantId: app.tenantId,
    user,
    setAt: Date.now(),
    ...(preservePhoto && existing.photo ? { photo: existing.photo } : {}),
  };
  await saveSessions(sessions);
}

export async function restoreTauriUserPhotoForApp(app: TauriAppContext | null): Promise<Blob | null> {
  if (!app) return null;

  const sessions = await loadSessions();
  const session = sessions[app.id];
  if (!session) return null;

  // If the app was edited (client/tenant changed), treat the old session as stale.
  if (session.clientId !== app.clientId || session.tenantId !== app.tenantId) {
    delete sessions[app.id];
    await saveSessions(sessions);
    return null;
  }

  return isBlobLike(session.photo?.blob) ? session.photo!.blob : null;
}

export async function persistTauriUserPhotoForApp(app: TauriAppContext, blob: Blob | null): Promise<void> {
  const sessions = await loadSessions();
  const existing = sessions[app.id];
  const currentUser = get(tauriUserStore);

  const user = currentUser ?? existing?.user;
  if (!user) return;

  const existingIsValid =
    existing &&
    existing.clientId === app.clientId &&
    existing.tenantId === app.tenantId &&
    isSameUser(existing.user, user);

  const next: StoredTauriUserSession = {
    clientId: app.clientId,
    tenantId: app.tenantId,
    user,
    setAt: Date.now(),
    ...(existingIsValid && existing.photo ? { photo: existing.photo } : {}),
  };

  if (blob) {
    next.photo = { blob, setAt: Date.now() };
  } else {
    delete next.photo;
  }

  sessions[app.id] = next;
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
