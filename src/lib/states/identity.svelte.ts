import { CLIENT_STORAGE_KEYS, clientStorage } from '$lib/services/client-storage';
import type { IdentityPreference, IdentityPreferenceMode } from '$lib/types';

const defaultPreference: IdentityPreference = {
  mode: 'use_last',
  setAt: Date.now(),
};

/**
 * Svelte 5 runes-based state for identity preference.
 * Controls whether the app uses the last signed-in identity silently
 * or prompts for identity selection each time.
 */
class IdentityPreferenceState {
  preference = $state<IdentityPreference>(defaultPreference);
  ready = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      void this.load();
    }
  }

  get mode(): IdentityPreferenceMode {
    return this.preference.mode;
  }

  get shouldAskEveryTime(): boolean {
    return this.preference.mode === 'always_ask';
  }

  async load() {
    const stored = await clientStorage.get<IdentityPreference>(CLIENT_STORAGE_KEYS.identityPreference, defaultPreference);
    this.preference = stored ?? defaultPreference;
    this.ready = true;
  }

  async setMode(mode: IdentityPreferenceMode) {
    this.preference = {
      mode,
      setAt: Date.now(),
    };
    await clientStorage.set(CLIENT_STORAGE_KEYS.identityPreference, this.preference);
  }

  async reset() {
    this.preference = { ...defaultPreference, setAt: Date.now() };
    await clientStorage.set(CLIENT_STORAGE_KEYS.identityPreference, this.preference);
  }
}

export const identityPreference = new IdentityPreferenceState();
