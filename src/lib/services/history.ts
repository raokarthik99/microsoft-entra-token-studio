import { get, set, del } from 'idb-keyval';
import type { HistoryItem } from '$lib/types';

const HISTORY_KEY = 'token_history';

export const historyService = {
  async getHistory(): Promise<HistoryItem[]> {
    try {
      // Check if we need to migrate from localStorage
      if (typeof window === 'undefined') return [];
      
      if (localStorage.getItem(HISTORY_KEY)) {
        await this.migrateFromLocalStorage();
      }
      return (await get<HistoryItem[]>(HISTORY_KEY)) || [];
    } catch (error) {
      console.error('Failed to get history from IndexedDB', error);
      return [];
    }
  },

  async addHistoryItem(item: HistoryItem): Promise<HistoryItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      const currentHistory = (await get<HistoryItem[]>(HISTORY_KEY)) || [];
      const newHistory = [item, ...currentHistory].slice(0, 50); // Increased limit since IDB can handle it
      await set(HISTORY_KEY, newHistory);
      return newHistory;
    } catch (error) {
      console.error('Failed to add history item', error);
      return [];
    }
  },

  async clearHistory(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await del(HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear history', error);
    }
  },

  async deleteHistoryItem(timestamp: number): Promise<HistoryItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      const currentHistory = (await get<HistoryItem[]>(HISTORY_KEY)) || [];
      const newHistory = currentHistory.filter(item => item.timestamp !== timestamp);
      await set(HISTORY_KEY, newHistory);
      return newHistory;
    } catch (error) {
      console.error('Failed to delete history item', error);
      return [];
    }
  },

  async migrateFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          await set(HISTORY_KEY, parsed);
        }
        localStorage.removeItem(HISTORY_KEY);
      }
    } catch (error) {
      console.error('Failed to migrate history', error);
    }
  }
};
