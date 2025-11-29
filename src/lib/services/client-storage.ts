import { clear, del, get, set } from 'idb-keyval';

export const CLIENT_STORAGE_KEYS = {
  lastResource: 'last_resource',
  lastScopes: 'last_scopes',
  activeTab: 'active_tab',
  pendingTokenLoad: 'pending_token_load',
  identityPreference: 'identity_preference',
  // Multi-app support
  appRegistry: 'app_registry',
  activeAppId: 'active_app_id',
  freAcknowledged: 'fre_acknowledged',
} as const;

export type ClientStorageKey = (typeof CLIENT_STORAGE_KEYS)[keyof typeof CLIENT_STORAGE_KEYS];

const isBrowser = () => typeof window !== 'undefined';

export const clientStorage = {
  async get<T>(key: ClientStorageKey, fallback: T | null = null): Promise<T | null> {
    if (!isBrowser()) return fallback;
    try {
      const value = await get<T>(key);
      return value ?? fallback;
    } catch (error) {
      console.warn(`Failed to read ${key} from IndexedDB`, error);
      return fallback;
    }
  },

  async set<T>(key: ClientStorageKey, value: T): Promise<void> {
    if (!isBrowser()) return;
    try {
      await set(key, value);
    } catch (error) {
      console.warn(`Failed to persist ${key} to IndexedDB`, error);
    }
  },

  async remove(key: ClientStorageKey): Promise<void> {
    if (!isBrowser()) return;
    try {
      await del(key);
    } catch (error) {
      console.warn(`Failed to remove ${key} from IndexedDB`, error);
    }
  },

  async clearAll(): Promise<void> {
    if (!isBrowser()) return;
    try {
      await clear();
    } catch (error) {
      console.warn('Failed to clear IndexedDB state', error);
    }
  }
};
