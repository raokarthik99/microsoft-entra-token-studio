/**
 * App Token Handler
 * 
 * Acquires app tokens (client credentials flow) using Azure Key Vault credentials.
 * Mirrors the logic in src/lib/server/app-token-service.ts
 */

import * as msal from '@azure/msal-node';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { CertificateClient } from '@azure/keyvault-certificates';
import { CryptographyClient, KnownSignatureAlgorithms } from '@azure/keyvault-keys';
import crypto from 'crypto';

export interface KeyVaultConfig {
  uri: string;
  credentialType: 'certificate' | 'secret';
  certName?: string;
  secretName?: string;
}

export interface TokenAppConfig {
  clientId: string;
  tenantId: string;
  keyVault: KeyVaultConfig;
}

export interface AppTokenParams {
  config: TokenAppConfig;
  scopes: string[];
}

interface MsalClientState {
  app: msal.ConfidentialClientApplication;
  useCertificate: boolean;
}

// Per-app MSAL client caching
const msalClients = new Map<string, MsalClientState>();

// Certificate metadata cache with CryptographyClient
interface CertMetadata {
  thumbprint: string;
  x5c: string;
  keyId: string;
  cryptoClient: CryptographyClient; // Cached client for signing operations
}

interface CachedCertMetadata {
  value: CertMetadata;
  expiresAt: number;
}

// Cache TTL: 15 minutes (in milliseconds)
// Error-based cache invalidation provides safety for access revocation scenarios
const CACHE_TTL_MS = 15 * 60 * 1000;

const certMetadataCache = new Map<string, CachedCertMetadata>();

// Singleton DefaultAzureCredential - reused across all Key Vault operations
let sharedCredential: DefaultAzureCredential | null = null;

function getSharedCredential(): DefaultAzureCredential {
  if (!sharedCredential) {
    sharedCredential = new DefaultAzureCredential();
  }
  return sharedCredential;
}

function getCacheKey(vaultUri: string, certName: string): string {
  return `${vaultUri.toLowerCase()}:${certName.toLowerCase()}`;
}

function isCacheValid(cached: CachedCertMetadata | undefined): cached is CachedCertMetadata {
  return cached !== undefined && Date.now() < cached.expiresAt;
}

function getMsalCacheKey(config: TokenAppConfig): string {
  const credentialName = config.keyVault.credentialType === 'certificate' 
    ? config.keyVault.certName 
    : config.keyVault.secretName;
  return `${config.tenantId}:${config.clientId}:${config.keyVault.credentialType}:${credentialName}`.toLowerCase();
}

function base64UrlEncode(data: string | Buffer): string {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getCertificateMetadata(config: KeyVaultConfig): Promise<CertMetadata> {
  if (!config.uri || !config.certName) {
    throw new Error('Key Vault URI and certificate name are required');
  }

  const cacheKey = getCacheKey(config.uri, config.certName);
  const cached = certMetadataCache.get(cacheKey);

  // Return cached value if valid and not expired
  if (isCacheValid(cached)) {
    return cached.value;
  }

  // Clear expired entry
  if (cached) {
    certMetadataCache.delete(cacheKey);
  }

  try {
    const credential = getSharedCredential();
    const certClient = new CertificateClient(config.uri, credential);
    const certificate = await certClient.getCertificate(config.certName);

    if (!certificate.properties.x509Thumbprint) {
      throw new Error(`Certificate '${config.certName}' does not have a valid thumbprint`);
    }
    if (!certificate.cer) {
      throw new Error(`Certificate '${config.certName}' public key not accessible`);
    }
    if (!certificate.keyId) {
      throw new Error(`Certificate '${config.certName}' does not have an associated key`);
    }

    // Create CryptographyClient tied to this certificate's lifecycle
    const cryptoClient = new CryptographyClient(certificate.keyId, credential);

    const metadata: CertMetadata = {
      thumbprint: Buffer.from(certificate.properties.x509Thumbprint).toString('hex').toUpperCase(),
      x5c: Buffer.from(certificate.cer).toString('base64'),
      keyId: certificate.keyId,
      cryptoClient,
    };

    // Cache successful result with TTL
    certMetadataCache.set(cacheKey, {
      value: metadata,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return metadata;
  } catch (err: any) {
    // Never cache errors - clear any stale entry and throw
    certMetadataCache.delete(cacheKey);
    throw err;
  }
}

async function signJwtWithKeyVault(
  config: KeyVaultConfig,
  clientId: string,
  tenantId: string
): Promise<string> {
  const metadata = await getCertificateMetadata(config);
  
  const x5t = base64UrlEncode(Buffer.from(metadata.thumbprint, 'hex'));
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    x5t,
    x5c: [metadata.x5c],
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    iss: clientId,
    sub: clientId,
    jti: crypto.randomUUID(),
    nbf: now,
    exp: now + 300,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Hash the signing input (RS256 = RSA-SHA256)
  const hash = crypto.createHash('sha256').update(signingInput).digest();

  // Sign using cached CryptographyClient (created with metadata)
  const signResult = await metadata.cryptoClient.sign(KnownSignatureAlgorithms.RS256, hash);
  
  if (!signResult.result) {
    throw new Error('Key Vault signing operation returned no result');
  }

  const signatureB64 = base64UrlEncode(Buffer.from(signResult.result));
  return `${signingInput}.${signatureB64}`;
}

async function fetchSecretFromKeyVault(config: KeyVaultConfig): Promise<string> {
  if (!config.uri || !config.secretName) {
    throw new Error('Key Vault URI and secret name are required');
  }

  const credential = getSharedCredential();
  const secretClient = new SecretClient(config.uri, credential);
  const secret = await secretClient.getSecret(config.secretName);

  if (!secret.value) {
    throw new Error(`Secret '${config.secretName}' value is empty`);
  }

  return secret.value;
}

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

    const app = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        authority,
        clientAssertion: async () => {
          return await signJwtWithKeyVault(keyVault, clientId, tenantId);
        },
      },
    });

    const state: MsalClientState = { app, useCertificate: true };
    msalClients.set(cacheKey, state);
    return state;
  }

  // Secret-based authentication
  if (!keyVault.secretName) {
    throw new Error('Secret name is required for secret authentication');
  }

  const clientSecret = await fetchSecretFromKeyVault(keyVault);
  
  const app = new msal.ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      authority,
      clientSecret,
    },
  });

  const state: MsalClientState = { app, useCertificate: false };
  msalClients.set(cacheKey, state);
  return state;
}

export async function handleAppToken(params: unknown): Promise<msal.AuthenticationResult> {
  const { config, scopes } = params as AppTokenParams;
  
  // Validate config
  if (!config?.clientId || !config?.tenantId || !config?.keyVault?.uri) {
    throw new Error('Invalid configuration: clientId, tenantId, and keyVault.uri are required');
  }

  const msalState = await initializeMsalClient(config);
  
  const result = await msalState.app.acquireTokenByClientCredential({
    scopes,
  });
  
  if (!result) {
    throw new Error('Failed to acquire token - no result returned');
  }

  return result;
}
