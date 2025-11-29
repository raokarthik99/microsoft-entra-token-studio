/**
 * App Token Service - Acquires app tokens using client-provided configuration.
 * Replaces the env-var-based token acquisition for multi-app support.
 * 
 * Security: Certificate authentication uses Key Vault signing - the private key
 * NEVER leaves Key Vault. Only the signature is returned.
 */
import * as msal from '@azure/msal-node';
import type { KeyVaultConfig } from '$lib/types';
import { fetchSecretWithConfig } from './credential-fetcher';
import { signJwtWithKeyVault } from './keyvault-signer';

/**
 * Minimal app configuration required for token acquisition.
 * This is what the client sends - subset of full AppConfig.
 */
export interface TokenAppConfig {
  clientId: string;
  tenantId: string;
  keyVault: KeyVaultConfig;
}

interface MsalClientState {
  app: msal.ConfidentialClientApplication;
  useCertificate: boolean;
}

// Per-app MSAL client caching
const msalClients = new Map<string, MsalClientState>();

const loggerOptions = {
  loggerCallback() {},
  piiLoggingEnabled: false,
  logLevel: msal.LogLevel.Info,
};

/**
 * Generate a cache key for an MSAL client based on app configuration.
 * Key format: {tenantId}:{clientId}:{credentialType}:{resourceName}
 */
function getMsalCacheKey(config: TokenAppConfig): string {
  const { tenantId, clientId, keyVault } = config;
  const credentialName = keyVault.credentialType === 'certificate' 
    ? keyVault.certName 
    : keyVault.secretName;
  return `${tenantId}:${clientId}:${keyVault.credentialType}:${credentialName}`.toLowerCase();
}

/**
 * Initialize an MSAL ConfidentialClientApplication for the given app configuration.
 */
async function initializeMsalClient(config: TokenAppConfig): Promise<MsalClientState> {
  const cacheKey = getMsalCacheKey(config);
  const existing = msalClients.get(cacheKey);
  
  if (existing) {
    return existing;
  }

  const authority = `https://login.microsoftonline.com/${config.tenantId}`;
  const { keyVault, clientId, tenantId } = config;

  if (keyVault.credentialType === 'certificate') {
    if (!keyVault.certName) {
      throw new Error('Certificate name is required for certificate authentication');
    }

    // Use clientAssertion callback - MSAL will call this function for each token request
    // The signing happens in Key Vault - the private key NEVER leaves Key Vault
    const app = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        authority,
        clientAssertion: async () => {
          // Sign JWT using Key Vault CryptographyClient
          // This includes x5c header for SN+I (Subject Name + Issuer) authentication
          return await signJwtWithKeyVault(keyVault, clientId, tenantId);
        },
      },
      system: { loggerOptions },
    });

    const state: MsalClientState = { app, useCertificate: true };
    msalClients.set(cacheKey, state);
    return state;
  }

  // Secret-based authentication
  if (!keyVault.secretName) {
    throw new Error('Secret name is required for secret authentication');
  }

  const clientSecret = await fetchSecretWithConfig(keyVault);
  
  const app = new msal.ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      authority,
      clientSecret,
    },
    system: { loggerOptions },
  });

  const state: MsalClientState = { app, useCertificate: false };
  msalClients.set(cacheKey, state);
  return state;
}

/**
 * Acquire an app token (client credentials flow) using the provided configuration.
 * 
 * @param config - App configuration containing clientId, tenantId, and Key Vault config
 * @param scopes - Scopes to request (e.g., ['https://graph.microsoft.com/.default'])
 * @returns Token response with access token and metadata
 */
export async function acquireAppTokenWithConfig(
  config: TokenAppConfig,
  scopes: string[]
): Promise<msal.AuthenticationResult> {
  const msalState = await initializeMsalClient(config);
  
  const request: msal.ClientCredentialRequest = {
    scopes,
    // Note: sendX5C is not needed when using clientAssertion - x5c is included in JWT header
  };

  const result = await msalState.app.acquireTokenByClientCredential(request);
  
  if (!result) {
    throw new Error('Failed to acquire token - no result returned');
  }

  return result;
}

/**
 * Validate that an app configuration has all required fields for token acquisition.
 */
export function validateTokenAppConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config) {
    errors.push('App configuration is required');
    return { valid: false, errors };
  }

  if (!config.clientId?.trim()) {
    errors.push('clientId is required');
  }

  if (!config.tenantId?.trim()) {
    errors.push('tenantId is required');
  }

  if (!config.keyVault) {
    errors.push('keyVault configuration is required');
  } else {
    if (!config.keyVault.uri?.trim()) {
      errors.push('keyVault.uri is required');
    }
    
    if (!config.keyVault.credentialType) {
      errors.push('keyVault.credentialType is required');
    } else if (config.keyVault.credentialType === 'certificate') {
      if (!config.keyVault.certName?.trim()) {
        errors.push('keyVault.certName is required for certificate authentication');
      }
    } else if (config.keyVault.credentialType === 'secret') {
      if (!config.keyVault.secretName?.trim()) {
        errors.push('keyVault.secretName is required for secret authentication');
      }
    } else {
      errors.push('keyVault.credentialType must be "certificate" or "secret"');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Clear cached MSAL clients (useful for testing or forced re-initialization)
 */
export function clearMsalClientCache(): void {
  msalClients.clear();
}

/**
 * Convert a resource URL to a scope with .default suffix.
 * E.g., "https://graph.microsoft.com" -> "https://graph.microsoft.com/.default"
 */
export function asResourceScope(resource: string): string {
  const cleaned = resource.replace(/\/+$/, '');
  return cleaned.toLowerCase().endsWith('/.default') ? cleaned : `${cleaned}/.default`;
}
