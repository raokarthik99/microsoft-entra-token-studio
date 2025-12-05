import * as msal from '@azure/msal-node';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
  isKeyVaultConfigured,
  fetchCertificateFromKeyVault,
  getKeyVaultConfig,
  isKeyVaultSecretConfigured,
  fetchSecretFromKeyVault
} from './keyvault';
import { isLocalCertificateConfigured, loadLocalCertificate, getLocalCertificateStatus } from './certificate';

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
export type AuthSource = 'keyvault' | 'local' | 'none';

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
  clientSecret: Boolean(env.CLIENT_SECRET),
  redirectUri: Boolean(env.REDIRECT_URI),
  keyVault: isKeyVaultConfigured(),
  keyVaultSecret: isKeyVaultSecretConfigured(),
  localCert: isLocalCertificateConfigured(),
};

export const missingEnvKeys = (): string[] => {
  const missing: string[] = [];
  if (!env.TENANT_ID) missing.push('TENANT_ID');
  if (!env.CLIENT_ID) missing.push('CLIENT_ID');
  
  // Require at least one auth method
  if (!isKeyVaultConfigured() && !isLocalCertificateConfigured() && !isKeyVaultSecretConfigured() && !env.CLIENT_SECRET) {
    missing.push('CLIENT_SECRET or AZURE_KEYVAULT_URI+CERT/SECRET or CERTIFICATE_PATH');
  }
  
  return missing;
};

const loggerOptions = {
  loggerCallback(_loglevel: msal.LogLevel, message: string) {
    const quiet = ['acquireTokenByCode', 'acquireTokenByClientCredential'];
    if (!quiet.some((q) => message.includes(q))) {
      console.log(message);
    }
  },
  piiLoggingEnabled: false,
  logLevel: msal.LogLevel.Info,
};

const resolutionKey = (resolution: AuthResolution) => `${resolution.method}:${resolution.source}`;

export function detectAuthMethod(): AuthResolution {
  if (isKeyVaultConfigured()) {
    return { method: 'certificate', source: 'keyvault' };
  }
  if (isLocalCertificateConfigured()) {
    return { method: 'certificate', source: 'local' };
  }
  if (isKeyVaultSecretConfigured()) {
    return { method: 'secret', source: 'keyvault' };
  }
  if (env.CLIENT_SECRET) {
    return { method: 'secret', source: 'local' };
  }
  return { method: 'none', source: 'none' };
}

export function isMethodConfigured(method: AuthKind, source: AuthSource): boolean {
  if (method === 'certificate' && source === 'keyvault') return isKeyVaultConfigured();
  if (method === 'certificate' && source === 'local') return isLocalCertificateConfigured();
  if (method === 'secret' && source === 'keyvault') return isKeyVaultSecretConfigured();
  if (method === 'secret' && source === 'local') return Boolean(env.CLIENT_SECRET);
  return false;
}

export function getAuthMethod(cookies?: Cookies): AuthResolution {
  const pref = cookies?.get('auth_pref');
  if (pref) {
    const [method, source] = pref.split(':') as [AuthKind | undefined, AuthSource | undefined];
    const isValidMethod = method === 'certificate' || method === 'secret';
    const isValidSource = source === 'keyvault' || source === 'local';
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
 * Initialize the MSAL client application for a specific resolution.
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
    return fail('No authentication method configured. Set CLIENT_SECRET, CERTIFICATE_PATH, or configure Key Vault.');
  }

  const authority = `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`;

  try {
    if (resolution.method === 'certificate' && resolution.source === 'keyvault') {
      console.log('[MSAL] Attempting certificate authentication from Key Vault...');
      const certCredential = await fetchCertificateFromKeyVault();
      const kvConfig = getKeyVaultConfig();

      state.app = new msal.ConfidentialClientApplication({
        auth: {
          clientId: env.CLIENT_ID,
          authority,
          clientCertificate: {
            thumbprint: certCredential.thumbprint,
            privateKey: certCredential.privateKey,
          },
        },
        system: { loggerOptions },
      });
      state.useCertificate = true;
      state.initialized = true;
      state.error = null;
      clientApps.set(key, state);
      lastResolvedAuth = resolution;
      console.log(`[MSAL] Configured with certificate from Key Vault (${kvConfig.certName})`);
      return state;
    }

    if (resolution.method === 'certificate' && resolution.source === 'local') {
      console.log('[MSAL] Attempting local certificate authentication...');
      const certCredential = await loadLocalCertificate();
      const localCertStatus = await getLocalCertificateStatus();
      
      state.app = new msal.ConfidentialClientApplication({
        auth: {
          clientId: env.CLIENT_ID,
          authority,
          clientCertificate: {
            thumbprint: certCredential.thumbprint,
            privateKey: certCredential.privateKey,
          },
        },
        system: { loggerOptions },
      });
      state.useCertificate = true;
      state.initialized = true;
      state.error = null;
      clientApps.set(key, state);
      lastResolvedAuth = resolution;
      console.log(`[MSAL] Configured with local certificate (${localCertStatus.path})`);
      return state;
    }

    if (resolution.method === 'secret' && resolution.source === 'keyvault') {
      console.log('[MSAL] Attempting client secret authentication from Key Vault...');
      const secretValue = await fetchSecretFromKeyVault();
      const kvConfig = getKeyVaultConfig();

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
      console.log(`[MSAL] Configured with client secret from Key Vault (${kvConfig.secretName})`);
      return state;
    }

    if (resolution.method === 'secret' && resolution.source === 'local') {
      if (!env.CLIENT_SECRET) {
        return fail('CLIENT_SECRET is not configured');
      }

      console.log('[MSAL] Using client secret authentication from environment');
      state.app = new msal.ConfidentialClientApplication({
        auth: {
          clientId: env.CLIENT_ID,
          authority,
          clientSecret: env.CLIENT_SECRET,
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

    return fail('No authentication method configured. Set CLIENT_SECRET, CERTIFICATE_PATH, or configure Key Vault.');
  } catch (err: any) {
    const message = err.message || 'Failed to initialize MSAL client';
    return fail(message);
  }
}

/**
 * Get the MSAL client application (initializes if needed)
 */
export async function getClientApp(resolution?: AuthResolution): Promise<msal.ConfidentialClientApplication | null> {
  const targetResolution = resolution ?? detectAuthMethod();
  const state = await initializeClientApp(targetResolution);
  return state.app;
}

/**
 * Acquire token by client credential with proper sendX5C handling
 */
export async function acquireAppToken(scopes: string[], cookies?: Cookies): Promise<msal.AuthenticationResult | null> {
  const resolution = getAuthMethod(cookies);
  const state = await initializeClientApp(resolution);
  const app = state.app;

  if (!app) {
    throw new Error(state.error ?? 'MSAL client not initialized');
  }

  const request: msal.ClientCredentialRequest = {
    scopes,
    ...(state.useCertificate && { sendX5C: true }),
  };

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
