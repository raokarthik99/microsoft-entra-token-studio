import type { IdentityPreference, IdentityPreferenceMode } from '$lib/types';

const STORAGE_KEY = 'identity_preference';

const defaultPreference: IdentityPreference = {
  mode: 'use_last',
  setAt: Date.now(),
};

function loadFromStorage(): IdentityPreference {
  if (typeof window === 'undefined') return defaultPreference;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load identity preference', e);
  }
  return defaultPreference;
}

function saveToStorage(preference: IdentityPreference) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch (e) {
    console.warn('Failed to save identity preference', e);
  }
}

/**
 * Svelte 5 runes-based state for identity preference.
 * Controls whether the app uses the last signed-in identity silently
 * or prompts for identity selection each time.
 */
class IdentityPreferenceState {
  preference = $state<IdentityPreference>(defaultPreference);

  constructor() {
    if (typeof window !== 'undefined') {
      this.preference = loadFromStorage();
    }
  }

  get mode(): IdentityPreferenceMode {
    return this.preference.mode;
  }

  get shouldAskEveryTime(): boolean {
    return this.preference.mode === 'always_ask';
  }

  setMode(mode: IdentityPreferenceMode) {
    this.preference = {
      mode,
      setAt: Date.now(),
    };
    saveToStorage(this.preference);
  }

  reset() {
    this.preference = { ...defaultPreference, setAt: Date.now() };
    saveToStorage(this.preference);
  }
}

export const identityPreference = new IdentityPreferenceState();
