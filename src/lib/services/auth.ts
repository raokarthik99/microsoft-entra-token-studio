import {
  PublicClientApplication,
  type AccountInfo,
  type RedirectRequest,
  type SilentRequest,
  type PopupRequest,
  type Configuration,
  LogLevel,
  InteractionRequiredAuthError,
  BrowserAuthError,
} from '@azure/msal-browser';
import { auth } from '$lib/stores/auth';
import type { AppConfig } from '$lib/types';

export interface GetTokenOptions {
  /** Force interactive authentication even if cached token exists */
  forceInteraction?: boolean;
  /** Prompt type for interactive flows */
  prompt?: 'select_account' | 'login' | 'consent';
}

export class AuthService {
  private msalInstance: PublicClientApplication | null = null;
  private isInitialized = false;
  private config: AppConfig;
  /** The app ID this service was initialized for */
  private appId: string;

  constructor(config: AppConfig) {
    this.config = config;
    this.appId = config.id;
  }

  /**
   * Get the app ID this service was initialized for.
   */
  getAppId(): string {
    return this.appId;
  }

  async initialize() {
    if (this.isInitialized) return;

    const msalConfig: Configuration = {
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        redirectUri: this.config.redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
      system: {
        loggerOptions: {
          loggerCallback: () => {
            // Logging disabled
          },
        },
      },
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
    await this.msalInstance.initialize();

    // Handle redirect promise (for redirect-based flows)
    try {
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        // User just completed a redirect-based sign-in
        this.handleResponse(response.account);
      } else {
        // Check if there's an active account from a previous session
        // Note: We only restore if there's an active account set, NOT from cached accounts
        // This respects user sign-out - cached accounts don't mean user wants to be signed in
        const activeAccount = this.msalInstance.getActiveAccount();
        if (activeAccount) {
          this.handleResponse(activeAccount);
        } else {
          auth.setUser(null);
        }
      }
    } catch (error: any) {
      auth.setError(error.message || 'Failed to initialize authentication');
    }

    this.isInitialized = true;
  }

  /**
   * Get the currently active account, if any.
   */
  getActiveAccount(): AccountInfo | null {
    return this.msalInstance?.getActiveAccount() ?? null;
  }

  /**
   * Get all cached accounts.
   */
  getAllAccounts(): AccountInfo[] {
    return this.msalInstance?.getAllAccounts() ?? [];
  }

  /**
   * Standard login via redirect.
   */
  async login() {
    if (!this.msalInstance) return;

    const loginRequest: RedirectRequest = {
      scopes: ['openid', 'profile', 'offline_access', 'User.Read']
    };

    try {
      await this.msalInstance.loginRedirect(loginRequest);
    } catch (err) {
      auth.setError('Login failed');
    }
  }

  /**
   * Login with a specific prompt type via popup.
   * Useful for "Switch account" functionality.
   */
  async loginWithPrompt(prompt: 'select_account' | 'login' | 'consent' = 'select_account'): Promise<AccountInfo | null> {
    if (!this.msalInstance) throw new Error('MSAL not initialized');

    const loginRequest: PopupRequest = {
      scopes: ['openid', 'profile', 'offline_access', 'User.Read'],
      prompt,
    };

    try {
      const response = await this.msalInstance.loginPopup(loginRequest);
      if (response.account) {
        this.handleResponse(response.account);
        return response.account;
      }
      return null;
    } catch (error) {
      if (error instanceof BrowserAuthError && error.errorCode === 'user_cancelled') {
        // User cancelled the popup, don't treat as error
        return null;
      }
      throw error;
    }
  }

  async logout(configToClear: AppConfig = this.config) {
    if (!this.msalInstance) return;

    try {
      // Clear the active account
      this.msalInstance.setActiveAccount(null);

      // Clear all MSAL-related data from local storage
      // MSAL stores tokens with keys prefixed by the client ID
      const localKeysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('msal.') || key.includes(configToClear.clientId))) {
          localKeysToRemove.push(key);
        }
      }
      localKeysToRemove.forEach(key => localStorage.removeItem(key));

      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('msal.') || key.includes(configToClear.clientId))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      
      // Clear local auth state
      auth.reset();
    } catch (err) {
      // Even if something fails, ensure local state is cleared
      auth.reset();
    }
  }

  /**
   * Clear cached accounts without full logout.
   * Useful for "Switch account" when user wants to use a different identity.
   */
  clearCachedAccounts() {
    if (!this.msalInstance) return;
    
    // Clear active account
    this.msalInstance.setActiveAccount(null);
    
    // Clear all MSAL-related data from storage
    const localKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('msal.') || key.includes(this.config.clientId))) {
        localKeysToRemove.push(key);
      }
    }
    localKeysToRemove.forEach(key => localStorage.removeItem(key));

    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('msal.') || key.includes(this.config.clientId))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    auth.setUser(null);
  }

  /**
   * Acquire a token for the given scopes.
   * @param scopes - Array of scopes to request
   * @param options - Optional settings for token acquisition
   */
  async getToken(scopes: string[], options: GetTokenOptions = {}): Promise<import('@azure/msal-browser').AuthenticationResult> {
    if (!this.msalInstance) throw new Error('MSAL not initialized');

    const account = this.msalInstance.getActiveAccount();
    
    // If no account and not forcing interaction, we need to sign in first
    if (!account) {
      if (options.forceInteraction !== false) {
        // Attempt interactive login first
        const newAccount = await this.loginWithPrompt(options.prompt ?? 'select_account');
        if (!newAccount) {
          throw new Error('Sign-in was cancelled');
        }
        // Recursively call getToken with the new account
        return this.getToken(scopes, { ...options, forceInteraction: false });
      }
      throw new Error('No active account');
    }

    // If forcing interaction, go straight to popup
    if (options.forceInteraction) {
      const request: PopupRequest = {
        scopes,
        account,
        prompt: options.prompt ?? 'select_account',
      };
      
      try {
        const response = await this.msalInstance.acquireTokenPopup(request);
        if (response.account) {
          this.handleResponse(response.account);
        }
        return response;
      } catch (error) {
        if (error instanceof BrowserAuthError && error.errorCode === 'user_cancelled') {
          throw new Error('Sign-in was cancelled');
        }
        throw error;
      }
    }

    // Standard flow: try silent first (with forceRefresh to get fresh token), fall back to popup/redirect
    const request: SilentRequest = {
      scopes,
      account,
      forceRefresh: true, // Always get a fresh token from the server
    };

    try {
      const response = await this.msalInstance.acquireTokenSilent(request);
      return response;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return this.msalInstance.acquireTokenPopup(request);
      }
      throw error;
    }
  }

  private handleResponse(account: AccountInfo | null) {
    if (account) {
      this.msalInstance?.setActiveAccount(account);
      // Pass the app ID so auth store knows which app the user signed in with
      auth.setUser(account, this.appId);
    } else {
      auth.setUser(null);
    }
  }

  /**
   * Reinitialize the service with a new app configuration.
   * This clears existing tokens for the old app and sets up for the new app.
   * @param newConfig - The new app configuration to use
   */
  async reinitialize(newConfig: AppConfig): Promise<void> {
    const previousConfig = this.config;
    const sameCredentials =
      previousConfig.clientId === newConfig.clientId &&
      previousConfig.tenantId === newConfig.tenantId &&
      previousConfig.redirectUri === newConfig.redirectUri;

    // Always update metadata so the auth store tracks the correct app ID
    this.config = newConfig;
    this.appId = newConfig.id;

    // If the credentials are identical, keep the existing MSAL instance to avoid
    // multiple PCA instances warning and extra reauth.
    if (sameCredentials && this.msalInstance) {
      const active = this.msalInstance.getActiveAccount();
      this.handleResponse(active ?? null);
      return;
    }

    // Credentials changed—clear tokens for the prior config and reinitialize cleanly.
    await this.logout(previousConfig);
    this.isInitialized = false;
    this.msalInstance = null;
    await this.initialize();
  }

  async getProfilePhoto(): Promise<string | null> {
    try {
      const token = await this.getToken(['User.Read']);
      if (!token) return null;

      const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });

      if (!response.ok) return null;

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      return null;
    }
  }
}
