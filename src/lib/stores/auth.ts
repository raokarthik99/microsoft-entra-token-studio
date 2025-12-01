import { writable } from 'svelte/store';
import type { AccountInfo } from '@azure/msal-browser';

export interface AuthState {
  isAuthenticated: boolean;
  user: AccountInfo | null;
  loading: boolean;
  error: string | null;
  photoUrl: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
    photoUrl: null,
  });

  return {
    subscribe,
    setUser: (user: AccountInfo | null) =>
      update((state) => ({ ...state, isAuthenticated: !!user, user, loading: false, error: null })),
    setPhoto: (photoUrl: string | null) =>
      update((state) => ({ ...state, photoUrl })),
    setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
    setError: (error: string) => update((state) => ({ ...state, error, loading: false })),
    reset: () => set({ isAuthenticated: false, user: null, loading: false, error: null, photoUrl: null }),
  };
}

export const auth = createAuthStore();

export const authServiceStore = writable<any>(null); // Type as any to avoid circular dependency or import type
