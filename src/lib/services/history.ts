import { get, set, del } from 'idb-keyval';
import type { HistoryItem } from '$lib/types';

const HISTORY_KEY = 'token_history';

export const historyService = {
  async getHistory(): Promise<HistoryItem[]> {
    try {
      if (typeof window === 'undefined') return [];
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

  async deleteHistoryItems(timestamps: number[]): Promise<HistoryItem[]> {
    if (typeof window === 'undefined') return [];
    try {
      const timestampSet = new Set(timestamps);
      const currentHistory = (await get<HistoryItem[]>(HISTORY_KEY)) || [];
      const newHistory = currentHistory.filter((item) => !timestampSet.has(item.timestamp));
      await set(HISTORY_KEY, newHistory);
      return newHistory;
    } catch (error) {
      console.error('Failed to delete history items', error);
      return [];
    }
  },

  /**
   * Delete all history items associated with specific app IDs.
   * Used for cascade deletion when apps are removed.
   * @returns Object with updated history list and count of deleted items
   */
  async deleteHistoryByAppIds(appIds: string[]): Promise<{ items: HistoryItem[]; deletedCount: number }> {
    if (typeof window === 'undefined') return { items: [], deletedCount: 0 };
    if (appIds.length === 0) return { items: await this.getHistory(), deletedCount: 0 };
    
    try {
      const appIdSet = new Set(appIds);
      const currentHistory = (await get<HistoryItem[]>(HISTORY_KEY)) || [];
      const newHistory = currentHistory.filter((item) => !item.appId || !appIdSet.has(item.appId));
      const deletedCount = currentHistory.length - newHistory.length;
      
      if (deletedCount > 0) {
        await set(HISTORY_KEY, newHistory);
      }
      
      return { items: newHistory, deletedCount };
    } catch (error) {
      console.error('Failed to delete history by app IDs', error);
      return { items: [], deletedCount: 0 };
    }
  }
};
