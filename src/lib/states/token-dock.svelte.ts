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
}

export const tokenDockState = new TokenDockState();
