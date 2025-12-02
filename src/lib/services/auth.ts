import {
  PublicClientApplication,
  type AccountInfo,
  type RedirectRequest,
  type SilentRequest,
  type Configuration,
  LogLevel,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { auth } from '$lib/stores/auth';

export class AuthService {
  private msalInstance: PublicClientApplication | null = null;
  private isInitialized = false;

  constructor(
    private clientId: string,
    private tenantId: string,
    private redirectUri: string
  ) {}

  async initialize() {
    if (this.isInitialized) return;

    const msalConfig: Configuration = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        redirectUri: this.redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) {
              return;
            }
            switch (level) {
              case LogLevel.Error:
                console.error(message);
                return;
              case LogLevel.Info:
                // console.info(message);
                return;
              case LogLevel.Verbose:
                // console.debug(message);
                return;
              case LogLevel.Warning:
                console.warn(message);
                return;
            }
          },
        },
      },
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
    await this.msalInstance.initialize();

    // Handle redirect promise
    try {
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.handleResponse(response.account);
      } else {
        // Check if there's an active account
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          this.msalInstance.setActiveAccount(accounts[0]);
          this.handleResponse(accounts[0]);
        } else {
          auth.setUser(null);
        }
      }
    } catch (error: any) {
      console.error('MSAL initialization error:', error);
      auth.setError(error.message || 'Failed to initialize authentication');
    }

    this.isInitialized = true;
  }

  async login() {
    if (!this.msalInstance) return;

    const loginRequest: RedirectRequest = {
      scopes: ['openid', 'profile', 'offline_access', 'User.Read']
    };

    try {
      await this.msalInstance.loginRedirect(loginRequest);
    } catch (err) {
      console.error('Login failed', err);
      auth.setError('Login failed');
    }
  }

  async logout() {
    if (!this.msalInstance) return;

    try {
      await this.msalInstance.logoutRedirect({
        onRedirectNavigate: () => {
          // Return false if you would like to stop navigation after logout
          return true;
        }
      });
      auth.reset();
    } catch (err) {
      console.error('Logout failed', err);
    }
  }

  async getToken(scopes: string[]) {
    if (!this.msalInstance) throw new Error('MSAL not initialized');

    const account = this.msalInstance.getActiveAccount();
    if (!account) throw new Error('No active account');

    const request: SilentRequest = {
      scopes,
      account,
    };

    try {
      const response = await this.msalInstance.acquireTokenSilent(request);
      return response;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return this.msalInstance.acquireTokenPopup(request);
      }
      console.warn('Silent token acquisition failed', error);
      throw error;
    }
  }

  private handleResponse(account: AccountInfo | null) {
    if (account) {
      this.msalInstance?.setActiveAccount(account);
      auth.setUser(account);
    } else {
      auth.setUser(null);
    }
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
      console.error('Failed to fetch profile photo', error);
      return null;
    }
  }
}
