import { entries, set, clear } from 'idb-keyval';
import type { ExportedData, ImportPreview } from '$lib/types';

const EXPORT_VERSION = 1;

export const dataExportService = {
  /**
   * exports all data from IndexedDB as a schema-agnostic JSON object
   */
  async exportAllData(): Promise<ExportedData> {
    if (typeof window === 'undefined') {
      throw new Error('Export only available in browser');
    }

    try {
      const allEntries = await entries();
      const data: Record<string, unknown> = {};
      
      for (const [key, value] of allEntries) {
        data[String(key)] = value;
      }

      return {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        data
      };
    } catch (error) {
      console.error('Failed to export data', error);
      throw error;
    }
  },

  /**
   * Triggers a browser download of the exported data
   */
  downloadAsJson(data: ExportedData) {
    if (typeof window === 'undefined') return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    a.href = url;
    a.download = `entra-token-backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Validates and previews an import file content
   */
  parseImportFile(jsonString: string): ImportPreview {
    try {
      const parsed = JSON.parse(jsonString);
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object') {
        return { counts: {}, exportedAt: '', isValid: false, errors: ['Invalid JSON format'] };
      }

      // Check envelope
      if (!parsed.data || typeof parsed.data !== 'object') {
        return { counts: {}, exportedAt: '', isValid: false, errors: ['Missing data object'] };
      }

      const counts: Record<string, number> = {};
      
      // inspect keys to guess types for preview
      for (const [key, value] of Object.entries(parsed.data)) {
        if (Array.isArray(value)) {
          counts[key] = value.length;
        } else {
          counts[key] = 1;
        }
      }

      return {
        counts,
        exportedAt: parsed.exportedAt || 'Unknown date',
        isValid: true
      };
    } catch (e) {
      return { 
        counts: {}, 
        exportedAt: '', 
        isValid: false, 
        errors: [(e as Error).message] 
      };
    }
  },

  /**
   * Replaces all current data with imported data
   */
  async importData(jsonString: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const parsed = JSON.parse(jsonString) as ExportedData;
    
    if (!parsed.data) {
      throw new Error('Invalid import data');
    }

    try {
      // Clear existing data first (Replace mode)
      await clear();

      // Restore all entries
      for (const [key, value] of Object.entries(parsed.data)) {
        await set(key, value);
      }
    } catch (error) {
      console.error('Failed to import data', error);
      throw error;
    }
  }
};
