import type { HistoryItem } from '$lib/types';

type TokenDockStatus = 'idle' | 'loading' | 'ready' | 'error';

export class TokenDockState {
  status = $state<TokenDockStatus>('idle');
  token = $state<HistoryItem | null>(null);
  error = $state<string | null>(null);
  context = $state<{ type?: HistoryItem['type']; target?: string } | null>(null);
  isFullScreen = $state(false);

  setLoading(context?: Partial<Pick<HistoryItem, 'type' | 'target'>>) {
    this.status = 'loading';
    this.error = null;
    this.context = context ?? this.context;
  }

  setToken(item: HistoryItem) {
    this.token = item;
    this.context = { type: item.type, target: item.target };
    this.error = null;
    this.status = 'ready';
  }

  setError(message: string) {
    this.error = message;
    this.status = 'error';
  }

  clearLoading() {
    if (this.status === 'loading') {
      this.status = this.token ? 'ready' : 'idle';
    }
  }

  setIdle() {
    this.status = this.token ? 'ready' : 'idle';
  }

  openFullScreen() {
    if (this.token?.tokenData?.accessToken) {
      this.isFullScreen = true;
    }
  }

  closeFullScreen() {
    this.isFullScreen = false;
  }

  /**
   * Clear the current token if it belongs to any of the deleted apps.
   * Used for cascade deletion when apps are removed.
   * @returns true if the token was cleared
   */
  clearIfAppDeleted(deletedAppIds: string[]): boolean {
    if (!this.token?.appId) return false;
    if (!deletedAppIds.includes(this.token.appId)) return false;
    
    this.token = null;
    this.context = null;
    this.error = null;
    this.status = 'idle';
    this.isFullScreen = false;
    return true;
  }
}

export const tokenDockState = new TokenDockState();
