/**
 * Runtime Detection Utilities
 * 
 * Detects whether the app is running in Tauri (desktop) or web (browser) mode.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

/**
 * Check if running in Tauri desktop environment
 */
export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Check if running in standard web browser
 */
export const IS_WEB = typeof window !== 'undefined' && !IS_TAURI;

/**
 * Check if running on server (SSR)
 */
export const IS_SERVER = typeof window === 'undefined';

/**
 * Function wrapper for IS_TAURI - useful in reactive contexts
 */
export function isTauriMode(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_METADATA__' in window);
}

/**
 * Get the appropriate redirect URI for MSAL based on runtime
 */
export function getRedirectUri(): string {
  if (IS_SERVER) {
    return 'http://localhost:5173/auth/callback';
  }
  
  if (IS_TAURI) {
    // Tauri uses a custom protocol
    return 'tauri://localhost/auth/callback';
  }
  
  // Web uses the current origin
  return `${window.location.origin}/auth/callback`;
}

/**
 * Get the base URL for API calls
 * In Tauri mode, we use IPC instead of HTTP
 */
export function getApiBaseUrl(): string {
  if (IS_SERVER) {
    return '';
  }
  
  if (IS_TAURI) {
    // In Tauri, API calls go through IPC - return empty to trigger IPC path
    return '';
  }
  
  return '';
}
