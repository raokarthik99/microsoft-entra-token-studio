import { favoritesService } from '$lib/services/favorites';
import type { FavoriteItem, HistoryItem } from '$lib/types';

export class FavoritesState {
    items = $state<FavoriteItem[]>([]);
    loading = $state(false);

    constructor() {
        this.load();
    }

    async load() {
        this.loading = true;
        try {
            this.items = await favoritesService.getFavorites();
        } finally {
            this.loading = false;
        }
    }

    async add(item: FavoriteItem) {
        this.items = await favoritesService.addFavorite(item);
    }

    async addFromHistory(item: HistoryItem, extras: Partial<FavoriteItem> = {}) {
        const now = Date.now();
        const favorite: FavoriteItem = {
            id: extras.id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
            type: item.type,
            target: item.target,
            timestamp: item.timestamp ?? now,
            tokenData: item.tokenData,
            // Preserve app context from history item
            appId: item.appId,
            appName: item.appName,
            appColor: item.appColor,
            // Favorites metadata
            createdAt: extras.createdAt ?? item.timestamp ?? now,
            lastUsedAt: extras.lastUsedAt ?? item.timestamp ?? now,
            useCount: extras.useCount ?? 1,
            name: extras.name,
            tags: extras.tags,
            description: extras.description,
            color: extras.color,
        };

        await this.add(favorite);
    }

    async update(id: string, updates: Partial<FavoriteItem>) {
        this.items = await favoritesService.updateFavorite(id, updates);
    }

    async delete(item: FavoriteItem) {
        if (confirm('Remove this favorite?')) {
            this.items = await favoritesService.deleteFavorite(item.id);
        }
    }

    async deleteMany(items: FavoriteItem[]) {
        if (!items.length) return;

        const message =
            items.length === 1
                ? 'Remove this favorite?'
                : `Remove ${items.length} favorites?`;

        if (confirm(message)) {
            const ids = items.map((item) => item.id);
            this.items = await favoritesService.deleteFavorites(ids);
        }
    }

    async clear() {
        if (confirm('Clear all favorites?')) {
            await favoritesService.clearFavorites();
            this.items = [];
        }
    }

    async incrementUse(id: string) {
        await favoritesService.incrementUseCount(id);
        this.items = await favoritesService.getFavorites();
    }

    isDuplicate(type: FavoriteItem['type'], target: string) {
        return this.items.some((fav) => fav.type === type && fav.target === target);
    }
}

export const favoritesState = new FavoritesState();
