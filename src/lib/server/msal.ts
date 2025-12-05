import * as msal from '@azure/msal-node';
import { env } from '$env/dynamic/private';
import { isKeyVaultConfigured, fetchCertificateFromKeyVault, getKeyVaultConfig, isKeyVaultSecretConfigured, fetchSecretFromKeyVault } from './keyvault';
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
export type AuthMethod = 'certificate' | 'secret' | 'none';

let authMethod: AuthMethod = 'none';
let useCertificateAuth = false;

/**
 * Get the current authentication method
 */
export function getAuthMethod(): AuthMethod {
  return authMethod;
}

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

// MSAL Configuration - will be initialized lazily
let clientApp: msal.ConfidentialClientApplication | null = null;
let clientAppInitialized = false;
let clientAppError: string | null = null;

/**
 * Initialize the MSAL client application.
 * Uses certificate auth if Key Vault is configured, otherwise falls back to client secret.
 */
async function initializeClientApp(): Promise<msal.ConfidentialClientApplication | null> {
  if (clientAppInitialized) {
    if (clientAppError) {
      throw new Error(clientAppError);
    }
    return clientApp;
  }

  try {
    if (!env.CLIENT_ID) {
      clientAppError = 'CLIENT_ID is not configured';
      clientAppInitialized = true;
      return null;
    }

    const authority = `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`;

    // Priority 1: Certificate from Key Vault
    if (isKeyVaultConfigured()) {
      console.log('[MSAL] Attempting certificate authentication from Key Vault...');
      try {
        const certCredential = await fetchCertificateFromKeyVault();
        const kvConfig = getKeyVaultConfig();
        
        const config: msal.Configuration = {
          auth: {
            clientId: env.CLIENT_ID,
            authority,
            clientCertificate: {
              thumbprint: certCredential.thumbprint,
              privateKey: certCredential.privateKey,
            },
          },
          system: {
            loggerOptions: {
              loggerCallback(_loglevel: msal.LogLevel, message: string) {
                const quiet = ['acquireTokenByCode', 'acquireTokenByClientCredential'];
                if (!quiet.some((q) => message.includes(q))) {
                  console.log(message);
                }
              },
              piiLoggingEnabled: false,
              logLevel: msal.LogLevel.Info,
            },
          },
        };

        clientApp = new msal.ConfidentialClientApplication(config);
        authMethod = 'certificate';
        useCertificateAuth = true;
        clientAppInitialized = true;
        console.log(`[MSAL] Configured with certificate from Key Vault (${kvConfig.certName})`);
        return clientApp;
      } catch (err: any) {
        clientAppError = `Key Vault certificate authentication failed: ${err.message}`;
        clientAppInitialized = true;
        console.error(`[MSAL] ${clientAppError}`);
        throw new Error(clientAppError);
      }
    }

    // Priority 2: Local Certificate File
    if (isLocalCertificateConfigured()) {
      console.log('[MSAL] Attempting local certificate authentication...');
      try {
        const certCredential = await loadLocalCertificate();
        const localCertStatus = await getLocalCertificateStatus();
        
        const config: msal.Configuration = {
          auth: {
            clientId: env.CLIENT_ID,
            authority,
            clientCertificate: {
              thumbprint: certCredential.thumbprint,
              privateKey: certCredential.privateKey,
            },
          },
          system: {
            loggerOptions: {
              loggerCallback(_loglevel: msal.LogLevel, message: string) {
                const quiet = ['acquireTokenByCode', 'acquireTokenByClientCredential'];
                if (!quiet.some((q) => message.includes(q))) {
                  console.log(message);
                }
              },
              piiLoggingEnabled: false,
              logLevel: msal.LogLevel.Info,
            },
          },
        };

        clientApp = new msal.ConfidentialClientApplication(config);
        authMethod = 'certificate';
        useCertificateAuth = true;
        clientAppInitialized = true;
        console.log(`[MSAL] Configured with local certificate (${localCertStatus.path})`);
        return clientApp;
      } catch (err: any) {
        clientAppError = `Local certificate authentication failed: ${err.message}`;
        clientAppInitialized = true;
        console.error(`[MSAL] ${clientAppError}`);
        throw new Error(clientAppError);
      }
    }

    // Priority 3: Client Secret from Key Vault
    if (isKeyVaultSecretConfigured()) {
      console.log('[MSAL] Attempting client secret authentication from Key Vault...');
      try {
        const secretValue = await fetchSecretFromKeyVault();
        const kvConfig = getKeyVaultConfig();

        const config: msal.Configuration = {
          auth: {
            clientId: env.CLIENT_ID,
            authority,
            clientSecret: secretValue,
          },
          system: {
            loggerOptions: {
              loggerCallback(_loglevel: msal.LogLevel, message: string) {
                const quiet = ['acquireTokenByCode', 'acquireTokenByClientCredential'];
                if (!quiet.some((q) => message.includes(q))) {
                  console.log(message);
                }
              },
              piiLoggingEnabled: false,
              logLevel: msal.LogLevel.Info,
            },
          },
        };

        clientApp = new msal.ConfidentialClientApplication(config);
        authMethod = 'secret';
        useCertificateAuth = false;
        clientAppInitialized = true;
        console.log(`[MSAL] Configured with client secret from Key Vault (${kvConfig.secretName})`);
        return clientApp;
      } catch (err: any) {
        clientAppError = `Key Vault secret authentication failed: ${err.message}`;
        clientAppInitialized = true;
        console.error(`[MSAL] ${clientAppError}`);
        throw new Error(clientAppError);
      }
    }

    // Priority 4: Client Secret from Environment
    if (env.CLIENT_SECRET) {
      console.log('[MSAL] Using client secret authentication from environment');
      const config: msal.Configuration = {
        auth: {
          clientId: env.CLIENT_ID,
          authority,
          clientSecret: env.CLIENT_SECRET,
        },
        system: {
          loggerOptions: {
            loggerCallback(_loglevel: msal.LogLevel, message: string) {
              const quiet = ['acquireTokenByCode', 'acquireTokenByClientCredential'];
              if (!quiet.some((q) => message.includes(q))) {
                console.log(message);
              }
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Info,
          },
        },
      };

      clientApp = new msal.ConfidentialClientApplication(config);
      authMethod = 'secret';
      useCertificateAuth = false;
      clientAppInitialized = true;
      console.log('[MSAL] Configured with client secret');
      return clientApp;
    }

    clientAppError = 'No authentication method configured. Set CLIENT_SECRET, CERTIFICATE_PATH, or configure Key Vault.';
    clientAppInitialized = true;
    return null;
  } catch (err: any) {
    clientAppError = err.message || 'Failed to initialize MSAL client';
    clientAppInitialized = true;
    throw new Error(clientAppError ?? 'Failed to initialize MSAL client');
  }
}

/**
 * Get the MSAL client application (initializes if needed)
 */
export async function getClientApp(): Promise<msal.ConfidentialClientApplication | null> {
  return initializeClientApp();
}

/**
 * Check if certificate authentication is being used
 */
export function isCertificateAuth(): boolean {
  return useCertificateAuth;
}

/**
 * Acquire token by client credential with proper sendX5C handling
 */
export async function acquireAppToken(scopes: string[]): Promise<msal.AuthenticationResult | null> {
  const app = await getClientApp();
  if (!app) {
    throw new Error('MSAL client not initialized');
  }

  const request: msal.ClientCredentialRequest = {
    scopes,
    // sendX5C is required for certificate authentication
    // It includes the X.509 certificate chain in the JWT header
    ...(useCertificateAuth && { sendX5C: true }),
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

// Legacy export for backward compatibility
// Components should migrate to getClientApp() for async initialization
export { clientApp };

