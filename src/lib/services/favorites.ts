import { get, set, del } from 'idb-keyval';
import type { FavoriteItem } from '$lib/types';

const FAVORITES_KEY = 'token_favorites';
const MAX_FAVORITES = 100;

function cloneSerializable<T>(value: T): T | undefined {
  if (value === undefined || value === null) return value;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return undefined;
    }
  }
}

function normalizeTags(tags?: string[]) {
  if (!tags) return undefined;
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  return cleaned.length ? Array.from(new Set(cleaned)) : undefined;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function sanitizeFavorite(item: FavoriteItem): FavoriteItem {
  const now = Date.now();
  const tags = normalizeTags(item.tags);

  return {
    ...item,
    tokenData: cloneSerializable(item.tokenData),
    id: item.id || generateId(),
    timestamp: item.timestamp ?? now,
    createdAt: item.createdAt ?? now,
    lastUsedAt: item.lastUsedAt,
    useCount: item.useCount ?? 0,
    name: item.name?.trim() || undefined,
    description: item.description?.trim() || undefined,
    color: item.color?.trim() || undefined,
    tags
  };
}

function evictIfNeeded(favorites: FavoriteItem[]): FavoriteItem[] {
  if (favorites.length < MAX_FAVORITES) return favorites;

  const toRemove = [...favorites].sort((a, b) => {
    if (a.useCount !== b.useCount) return a.useCount - b.useCount;
    const aSeen = a.lastUsedAt ?? a.createdAt;
    const bSeen = b.lastUsedAt ?? b.createdAt;
    return aSeen - bSeen;
  })[0];

  return favorites.filter((fav) => fav.id !== toRemove.id);
}

export const favoritesService = {
  async getFavorites(): Promise<FavoriteItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      return (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
    } catch (error) {
      console.error('Failed to get favorites from IndexedDB', error);
      return [];
    }
  },

  async addFavorite(item: FavoriteItem): Promise<FavoriteItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      let favorites = (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
      const normalized = sanitizeFavorite(item);

      const duplicateIndex = favorites.findIndex(
        (fav) => fav.type === normalized.type && fav.target === normalized.target
      );

      if (duplicateIndex !== -1) {
        favorites[duplicateIndex] = {
          ...favorites[duplicateIndex],
          ...normalized,
          id: favorites[duplicateIndex].id
        };
      } else {
        favorites = evictIfNeeded(favorites);
        favorites.unshift(normalized);
      }

      await set(FAVORITES_KEY, favorites);
      return favorites;
    } catch (error) {
      console.error('Failed to add favorite', error);
      return [];
    }
  },

  async updateFavorite(id: string, updates: Partial<FavoriteItem>): Promise<FavoriteItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      const favorites = (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
      const idx = favorites.findIndex((fav) => fav.id === id);
      if (idx === -1) return favorites;

      const merged = sanitizeFavorite({
        ...favorites[idx],
        ...updates,
        id
      });

      favorites[idx] = merged;
      await set(FAVORITES_KEY, favorites);
      return favorites;
    } catch (error) {
      console.error('Failed to update favorite', error);
      return [];
    }
  },

  async deleteFavorite(id: string): Promise<FavoriteItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      const favorites = (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
      const next = favorites.filter((fav) => fav.id !== id);
      await set(FAVORITES_KEY, next);
      return next;
    } catch (error) {
      console.error('Failed to delete favorite', error);
      return [];
    }
  },

  async deleteFavorites(ids: string[]): Promise<FavoriteItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      const idSet = new Set(ids);
      const favorites = (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
      const next = favorites.filter((fav) => !idSet.has(fav.id));
      await set(FAVORITES_KEY, next);
      return next;
    } catch (error) {
      console.error('Failed to delete favorites', error);
      return [];
    }
  },

  async clearFavorites(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await del(FAVORITES_KEY);
    } catch (error) {
      console.error('Failed to clear favorites', error);
    }
  },

  async incrementUseCount(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const favorites = (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
      const idx = favorites.findIndex((fav) => fav.id === id);
      if (idx === -1) return;

      const now = Date.now();
      favorites[idx] = {
        ...favorites[idx],
        useCount: (favorites[idx].useCount || 0) + 1,
        lastUsedAt: now
      };

      await set(FAVORITES_KEY, favorites);
    } catch (error) {
      console.error('Failed to update favorite usage', error);
    }
  },

  async isDuplicate(type: FavoriteItem['type'], target: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const favorites = (await get<FavoriteItem[]>(FAVORITES_KEY)) || [];
      return favorites.some((fav) => fav.type === type && fav.target === target);
    } catch (error) {
      console.error('Failed to check duplicate favorite', error);
      return false;
    }
  },

  async searchFavorites(query: string): Promise<FavoriteItem[]> {
    if (typeof window === 'undefined') return [];
    const term = query.trim().toLowerCase();
    const favorites = await this.getFavorites();
    if (!term) return favorites;

    return favorites.filter((fav) => {
      const haystacks = [
        fav.name,
        fav.target,
        fav.description,
        ...(fav.tags ?? [])
      ]
        .filter(Boolean)
        .map((value) => value!.toString().toLowerCase());

      return haystacks.some((value) => value.includes(term));
    });
  }
};
