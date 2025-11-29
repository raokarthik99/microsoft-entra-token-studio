import { writable, get } from 'svelte/store';
import type { AccountInfo } from '@azure/msal-browser';

export interface AuthState {
  isAuthenticated: boolean;
  user: AccountInfo | null;
  loading: boolean;
  error: string | null;
  photoUrl: string | null;
  /** The app ID the user signed in with - used to detect app switches */
  signedInAppId: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
    photoUrl: null,
    signedInAppId: null,
  });

  return {
    subscribe,
    setUser: (user: AccountInfo | null, appId?: string | null) =>
      update((state) => ({ 
        ...state, 
        isAuthenticated: !!user, 
        user, 
        loading: false, 
        error: null,
        // Set signedInAppId when user signs in, clear when user signs out
        signedInAppId: user ? (appId ?? state.signedInAppId) : null,
      })),
    setPhoto: (photoUrl: string | null) =>
      update((state) => ({ ...state, photoUrl })),
    setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
    setError: (error: string) => update((state) => ({ ...state, error, loading: false })),
    /** Get the current signed-in app ID */
    getSignedInAppId: () => get({ subscribe }).signedInAppId,
    reset: () => set({ isAuthenticated: false, user: null, loading: false, error: null, photoUrl: null, signedInAppId: null }),
  };
}

export const auth = createAuthStore();

export const authServiceStore = writable<any>(null); // Type as any to avoid circular dependency or import type
