import { CLIENT_STORAGE_KEYS, clientStorage } from '$lib/services/client-storage';
import type { AppConfig } from '$lib/types';
import { historyState } from './history.svelte';
import { favoritesState } from './favorites.svelte';
import { tokenDockState } from './token-dock.svelte';

/**
 * Result of a cascade delete operation.
 */
export interface CascadeDeleteResult {
  historyDeleted: number;
  favoritesDeleted: number;
  tokenCleared: boolean;
}

/**
 * Default colors for apps without a custom color.
 */
export const APP_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
] as const;

/**
 * Svelte 5 runes-based state for app registry.
 * Manages multiple app configurations stored in IndexedDB.
 */
class AppRegistryState {
  apps = $state<AppConfig[]>([]);
  activeAppId = $state<string | null>(null);
  ready = $state(false);
  loading = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      void this.load();
    }
  }

  /**
   * Get the currently active app, if any.
   */
  get activeApp(): AppConfig | null {
    if (!this.activeAppId) return null;
    return this.apps.find(app => app.id === this.activeAppId) ?? null;
  }

  /**
   * Check if there are any apps configured.
   */
  get hasApps(): boolean {
    return this.apps.length > 0;
  }

  /**
   * Load app registry from IndexedDB.
   */
  async load() {
    this.loading = true;
    try {
      const [apps, activeId] = await Promise.all([
        clientStorage.get<AppConfig[]>(CLIENT_STORAGE_KEYS.appRegistry, []),
        clientStorage.get<string>(CLIENT_STORAGE_KEYS.activeAppId, null),
      ]);
      this.apps = apps ?? [];
      this.activeAppId = activeId;
    } catch (error) {
      // Silently ignore
    } finally {
      this.loading = false;
      this.ready = true;
    }
  }

  /**
   * Add a new app to the registry.
   */
  async add(app: AppConfig): Promise<void> {
    // Ensure unique ID
    if (this.apps.some(a => a.id === app.id)) {
      throw new Error(`App with ID ${app.id} already exists`);
    }
    
    this.apps = [...this.apps, app];
    await this.persist();
    
    // If this is the first app, set it as active
    if (this.apps.length === 1) {
      await this.setActive(app.id);
    }
  }

  /**
   * Update an existing app.
   */
  async update(id: string, updates: Partial<AppConfig>): Promise<void> {
    const index = this.apps.findIndex(a => a.id === id);
    if (index === -1) {
      throw new Error(`App with ID ${id} not found`);
    }
    
    this.apps = [
      ...this.apps.slice(0, index),
      { ...this.apps[index], ...updates },
      ...this.apps.slice(index + 1),
    ];
    await this.persist();
  }

  /**
   * Remove an app from the registry with cascade deletion.
   * Deletes all associated history, favorites, and clears token dock if needed.
   */
  async remove(id: string): Promise<CascadeDeleteResult> {
    this.apps = this.apps.filter(a => a.id !== id);
    await this.persist();
    
    // If we removed the active app, clear selection or select another
    if (this.activeAppId === id) {
      const newActiveId = this.apps.length > 0 ? this.apps[0].id : null;
      await this.setActive(newActiveId);
    }

    // Cascade delete associated data
    return this.cascadeDelete([id]);
  }

  /**
   * Remove multiple apps at once with cascade deletion.
   * Deletes all associated history, favorites, and clears token dock if needed.
   */
  async removeMany(ids: string[]): Promise<CascadeDeleteResult> {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return { historyDeleted: 0, favoritesDeleted: 0, tokenCleared: false };
    }

    const idSet = new Set(uniqueIds);
    const nextApps = this.apps.filter(app => !idSet.has(app.id));
    this.apps = nextApps;
    await this.persist();

    if (this.activeAppId && idSet.has(this.activeAppId)) {
      const newActiveId = nextApps.length > 0 ? nextApps[0].id : null;
      await this.setActive(newActiveId);
    }

    // Cascade delete associated data
    return this.cascadeDelete(uniqueIds);
  }

  /**
   * Set the active app by ID.
   */
  async setActive(id: string | null): Promise<void> {
    this.activeAppId = id;
    await clientStorage.set(CLIENT_STORAGE_KEYS.activeAppId, id);
  }

  /**
   * Get an app by ID.
   */
  getById(id: string): AppConfig | undefined {
    return this.apps.find(a => a.id === id);
  }

  /**
   * Update the last used timestamp for an app.
   */
  async markUsed(id: string): Promise<void> {
    await this.update(id, { lastUsedAt: Date.now() });
  }

  /**
   * Persist the app registry to IndexedDB.
   */
  private async persist(): Promise<void> {
    // Runes-wrapped objects aren't directly structured-cloneable; persist a plain copy.
    const payload = this.apps.map(app => ({
      ...app,
      keyVault: { ...app.keyVault },
      tags: app.tags ? [...app.tags] : undefined,
    }));
    await clientStorage.set(CLIENT_STORAGE_KEYS.appRegistry, payload);
  }

  /**
   * Clear all apps with cascade deletion.
   * Deletes all history, favorites, and clears token dock.
   */
  async clear(): Promise<CascadeDeleteResult> {
    // Get all app IDs before clearing
    const allAppIds = this.apps.map(app => app.id);
    
    this.apps = [];
    this.activeAppId = null;
    await Promise.all([
      clientStorage.set(CLIENT_STORAGE_KEYS.appRegistry, []),
      clientStorage.set(CLIENT_STORAGE_KEYS.activeAppId, null),
    ]);

    // Cascade delete associated data
    return this.cascadeDelete(allAppIds);
  }

  /**
   * Perform cascade deletion for the given app IDs.
   * Cleans up history, favorites, and token dock state.
   */
  private async cascadeDelete(appIds: string[]): Promise<CascadeDeleteResult> {
    if (appIds.length === 0) {
      return { historyDeleted: 0, favoritesDeleted: 0, tokenCleared: false };
    }

    // Run cascade deletions in parallel
    const [historyDeleted, favoritesDeleted] = await Promise.all([
      historyState.deleteByAppIds(appIds),
      favoritesState.deleteByAppIds(appIds),
    ]);

    // Clear token dock if current token was from a deleted app
    const tokenCleared = tokenDockState.clearIfAppDeleted(appIds);

    return { historyDeleted, favoritesDeleted, tokenCleared };
  }
}

export const appRegistry = new AppRegistryState();
