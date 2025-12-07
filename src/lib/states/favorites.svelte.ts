import { favoritesService } from '$lib/services/favorites';
import type { FavoriteItem, HistoryItem } from '$lib/types';

const MAX_PINNED = 5;

export class FavoritesState {
    items = $state<FavoriteItem[]>([]);
    loading = $state(false);

    get pinnedFavorites(): FavoriteItem[] {
        return [...this.items]
            .filter((fav) => fav.isPinned)
            .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
            .slice(0, MAX_PINNED);
    }

    get pinnedCount(): number {
        return this.items.filter((fav) => fav.isPinned).length;
    }

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
        const existing = this.findMatch(item.type, item.target);
        const isPinned = extras.isPinned ?? existing?.isPinned ?? false;
        const pinnedAt = isPinned ? extras.pinnedAt ?? existing?.pinnedAt ?? now : undefined;
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
            isPinned,
            pinnedAt
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

    findMatch(type: FavoriteItem['type'], target: string) {
        return this.items.find((fav) => fav.type === type && fav.target === target);
    }

    async pin(id: string) {
        const target = this.items.find((fav) => fav.id === id);
        if (!target) {
            return { success: false as const, reason: 'not_found' as const };
        }

        const isAlreadyPinned = Boolean(target.isPinned);
        if (!isAlreadyPinned && this.pinnedCount >= MAX_PINNED) {
            return { success: false as const, reason: 'limit' as const };
        }

        this.items = await favoritesService.updateFavorite(id, {
            isPinned: true,
            pinnedAt: Date.now()
        });

        return { success: true as const };
    }

    async unpin(id: string) {
        const target = this.items.find((fav) => fav.id === id);
        if (!target) {
            return { success: false as const, reason: 'not_found' as const };
        }

        if (!target.isPinned) {
            return { success: true as const };
        }

        this.items = await favoritesService.updateFavorite(id, {
            isPinned: false,
            pinnedAt: undefined
        });

        return { success: true as const };
    }

    async setPinned(id: string, shouldPin: boolean) {
        return shouldPin ? this.pin(id) : this.unpin(id);
    }

    async pinFromHistory(item: HistoryItem, extras: Partial<FavoriteItem> = {}) {
        const match = this.findMatch(item.type, item.target);
        if (match) {
            return this.pin(match.id);
        }

        if (this.pinnedCount >= MAX_PINNED) {
            return { success: false as const, reason: 'limit' as const };
        }

        await this.addFromHistory(item, {
            ...extras,
            isPinned: true,
            pinnedAt: extras.pinnedAt ?? Date.now()
        });
        return { success: true as const };
    }

    /**
     * Delete all favorites associated with specific app IDs.
     * Used for cascade deletion when apps are removed - no confirmation needed.
     * @returns Count of deleted items
     */
    async deleteByAppIds(appIds: string[]): Promise<number> {
        if (!appIds.length) return 0;
        const result = await favoritesService.deleteFavoritesByAppIds(appIds);
        this.items = result.items;
        return result.deletedCount;
    }
}

export const favoritesState = new FavoritesState();
