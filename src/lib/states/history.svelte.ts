import { historyService } from '$lib/services/history';
import type { HistoryItem } from '$lib/types';

export class HistoryState {
    items = $state<HistoryItem[]>([]);
    loading = $state(false);

    constructor() {
        this.load();
    }

    async load() {
        this.loading = true;
        try {
            this.items = await historyService.getHistory();
        } finally {
            this.loading = false;
        }
    }

    async add(item: HistoryItem) {
        this.items = await historyService.addHistoryItem(item);
    }

    async clear() {
        if (confirm('Clear all history?')) {
            await historyService.clearHistory();
            this.items = [];
        }
    }

    async delete(item: HistoryItem) {
        if (confirm('Remove this item from history?')) {
            this.items = await historyService.deleteHistoryItem(item.timestamp);
        }
    }
}

export const historyState = new HistoryState();
