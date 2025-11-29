/**
 * MSAL client management for env-var based configuration.
 * Used for delegated auth flows (user tokens) and legacy env-var based app tokens.
 * 
 * Note: For dynamic app token acquisition (multi-app), use app-token-service.ts instead.
 * Certificate authentication now uses Key Vault signing via keyvault-signer.ts.
 */
import * as msal from '@azure/msal-node';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
  isKeyVaultConfigured,
  getKeyVaultConfig,
  isKeyVaultSecretConfigured,
  fetchSecretFromKeyVault
} from './keyvault';
import { signJwtWithKeyVault } from './keyvault-signer';

// Auth State Management
interface AuthState {
  scopes: string[];
  createdAt: number;
}

export const authStates = new Map<string, AuthState>();
const STATE_TTL_MS = 10 * 60 * 1000;

// Cleanup interval
setInterval(() => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [key, value] of authStates.entries()) {
    if (value.createdAt < cutoff) {
      authStates.delete(key);
    }
  }
}, STATE_TTL_MS);

// Auth method tracking
export type AuthKind = 'certificate' | 'secret' | 'none';
export type AuthSource = 'keyvault' | 'none';

export interface AuthResolution {
  method: AuthKind;
  source: AuthSource;
}

interface ClientAppState {
  app: msal.ConfidentialClientApplication | null;
  initialized: boolean;
  error: string | null;
  useCertificate: boolean;
}

const clientApps = new Map<string, ClientAppState>();
let lastResolvedAuth: AuthResolution = { method: 'none', source: 'none' };

// Config + status helpers
export const configChecks = {
  tenantId: Boolean(env.TENANT_ID),
  clientId: Boolean(env.CLIENT_ID),
  redirectUri: Boolean(env.REDIRECT_URI),
  keyVault: isKeyVaultConfigured(),
  keyVaultSecret: isKeyVaultSecretConfigured(),
};

export const missingEnvKeys = (): string[] => {
  const missing: string[] = [];
  if (!env.TENANT_ID) missing.push('TENANT_ID');
  if (!env.CLIENT_ID) missing.push('CLIENT_ID');
  
  // Require Key Vault configuration
  if (!isKeyVaultConfigured() && !isKeyVaultSecretConfigured()) {
    missing.push('AZURE_KEYVAULT_URI + CERT_NAME or SECRET_NAME');
  }
  
  return missing;
};

const loggerOptions = {
  loggerCallback() {},
  piiLoggingEnabled: false,
  logLevel: msal.LogLevel.Info,
};

const resolutionKey = (resolution: AuthResolution) => `${resolution.method}:${resolution.source}`;

export function detectAuthMethod(): AuthResolution {
  if (isKeyVaultConfigured()) {
    return { method: 'certificate', source: 'keyvault' };
  }
  if (isKeyVaultSecretConfigured()) {
    return { method: 'secret', source: 'keyvault' };
  }
  return { method: 'none', source: 'none' };
}

export function isMethodConfigured(method: AuthKind, source: AuthSource): boolean {
  if (method === 'certificate' && source === 'keyvault') return isKeyVaultConfigured();
  if (method === 'secret' && source === 'keyvault') return isKeyVaultSecretConfigured();
  return false;
}

export function getAuthMethod(cookies?: Cookies): AuthResolution {
  const pref = cookies?.get('auth_pref');
  if (pref) {
    const [method, source] = pref.split(':') as [AuthKind | undefined, AuthSource | undefined];
    const isValidMethod = method === 'certificate' || method === 'secret';
    const isValidSource = source === 'keyvault';
    if (isValidMethod && isValidSource && isMethodConfigured(method, source)) {
      return { method, source };
    }
  }

  return detectAuthMethod();
}

/**
 * Check if certificate authentication is being used
 */
export function isCertificateAuth(): boolean {
  return lastResolvedAuth.method === 'certificate';
}

/**
 * Initialize the MSAL client app for a specific resolution.
 */
async function initializeClientApp(resolution: AuthResolution): Promise<ClientAppState> {
  const key = resolutionKey(resolution);
  const existing = clientApps.get(key);

  if (existing?.initialized) {
    if (existing.error) {
      throw new Error(existing.error);
    }
    return existing;
  }

  const state: ClientAppState = existing ?? {
    app: null,
    initialized: false,
    error: null,
    useCertificate: false,
  };

  clientApps.set(key, state);

  const fail = (message: string) => {
    state.initialized = true;
    state.error = message;
    clientApps.set(key, state);
    throw new Error(message);
  };

  if (!env.CLIENT_ID) {
    return fail('CLIENT_ID is not configured');
  }

  if (resolution.method === 'none' || resolution.source === 'none') {
    return fail('No authentication method configured. Set CLIENT_SECRET or configure Key Vault.');
  }

  const authority = `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`;

  try {
    // Certificate auth via Key Vault signing - private key never leaves Key Vault
    if (resolution.method === 'certificate' && resolution.source === 'keyvault') {
      const kvConfig = getKeyVaultConfig();
      
      if (!kvConfig.uri || !kvConfig.certName) {
        return fail('Key Vault certificate configuration incomplete');
      }

      // Build KeyVaultConfig for the signer
      const keyVaultConfig = {
        uri: kvConfig.uri,
        certName: kvConfig.certName,
        credentialType: 'certificate' as const,
      };

      state.app = new msal.ConfidentialClientApplication({
        auth: {
          clientId: env.CLIENT_ID,
          authority,
          clientAssertion: async () => {
            // Sign JWT using Key Vault - private key never leaves Key Vault
            return await signJwtWithKeyVault(keyVaultConfig, env.CLIENT_ID!, env.TENANT_ID!);
          },
        },
        system: { loggerOptions },
      });
      state.useCertificate = true;
      state.initialized = true;
      state.error = null;
      clientApps.set(key, state);
      lastResolvedAuth = resolution;
      return state;
    }

    // Secret auth via Key Vault
    if (resolution.method === 'secret' && resolution.source === 'keyvault') {
      const secretValue = await fetchSecretFromKeyVault();

      state.app = new msal.ConfidentialClientApplication({
        auth: {
          clientId: env.CLIENT_ID,
          authority,
          clientSecret: secretValue,
        },
        system: { loggerOptions },
      });
      state.useCertificate = false;
      state.initialized = true;
      state.error = null;
      clientApps.set(key, state);
      lastResolvedAuth = resolution;
      return state;
    }

    return fail('No authentication method configured. Configure Key Vault with a certificate or secret.');
  } catch (err: any) {
    const message = err.message || 'Failed to initialize MSAL client';
    return fail(message);
  }
}

/**
 * Get the MSAL client app (initializes if needed)
 */
export async function getClientApp(resolution?: AuthResolution): Promise<msal.ConfidentialClientApplication | null> {
  const targetResolution = resolution ?? detectAuthMethod();
  const state = await initializeClientApp(targetResolution);
  return state.app;
}

/**
 * Acquire token by client credential
 */
export async function acquireAppToken(scopes: string[], cookies?: Cookies): Promise<msal.AuthenticationResult | null> {
  const resolution = getAuthMethod(cookies);
  const state = await initializeClientApp(resolution);
  const app = state.app;

  if (!app) {
    throw new Error(state.error ?? 'MSAL client not initialized');
  }

  // Note: sendX5C not needed when using clientAssertion - x5c is in JWT header
  const request: msal.ClientCredentialRequest = { scopes };

  return app.acquireTokenByClientCredential(request);
}

// Helpers
export const parseScopes = (input: any): string[] =>
  (input || '')
    .split(/[ ,]+/)
    .map((scope: string) => scope.trim())
    .filter(Boolean);

export const asResourceScope = (resource: string) => {
  const cleaned = resource.replace(/\/+$/, '');
  return cleaned.toLowerCase().endsWith('/.default') ? cleaned : `${cleaned}/.default`;
};

export const getRedirectUri = (origin: string) => {
  return env.REDIRECT_URI || `${origin}/auth/callback`;
};
