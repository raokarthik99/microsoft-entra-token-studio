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

// Certificate metadata cache
interface CertMetadata {
  thumbprint: string;
  x5c: string;
  keyId: string;
}
const certMetadataCache = new Map<string, CertMetadata>();

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

  const cacheKey = `${config.uri}:${config.certName}`.toLowerCase();
  const cached = certMetadataCache.get(cacheKey);
  if (cached) return cached;

  const credential = new DefaultAzureCredential();
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

  const metadata: CertMetadata = {
    thumbprint: Buffer.from(certificate.properties.x509Thumbprint).toString('hex').toUpperCase(),
    x5c: Buffer.from(certificate.cer).toString('base64'),
    keyId: certificate.keyId,
  };

  certMetadataCache.set(cacheKey, metadata);
  return metadata;
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

  const hash = crypto.createHash('sha256').update(signingInput).digest();

  const credential = new DefaultAzureCredential();
  const cryptoClient = new CryptographyClient(metadata.keyId, credential);
  const signResult = await cryptoClient.sign(KnownSignatureAlgorithms.RS256, hash);
  
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

  const credential = new DefaultAzureCredential();
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
