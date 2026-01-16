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
  createdAt: number;  // Timestamp for TTL-based invalidation
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

// Structured error for Key Vault operations
export interface KeyVaultErrorData {
  code: string;
  message: string;
  action: string;
  actionUrl?: string;
  actionLabel?: string;
  detail?: string;
  severity: 'error' | 'warning';
  context?: {
    vaultUri?: string;
    resourceName?: string;
    expiryDate?: string;
    daysUntilExpiry?: number;
  };
}

class KeyVaultError extends Error {
  readonly code: string;
  readonly action: string;
  readonly actionUrl?: string;
  readonly actionLabel?: string;
  readonly detail?: string;
  readonly severity: 'error' | 'warning';
  readonly context?: KeyVaultErrorData['context'];

  constructor(data: KeyVaultErrorData) {
    super(data.message);
    this.name = 'KeyVaultError';
    this.code = data.code;
    this.action = data.action;
    this.actionUrl = data.actionUrl;
    this.actionLabel = data.actionLabel;
    this.detail = data.detail;
    this.severity = data.severity;
    this.context = data.context;
  }

  toJSON(): KeyVaultErrorData {
    return {
      code: this.code,
      message: this.message,
      action: this.action,
      actionUrl: this.actionUrl,
      actionLabel: this.actionLabel,
      detail: this.detail,
      severity: this.severity,
      context: this.context,
    };
  }
}

// Expiry warning threshold (7 days)
const EXPIRY_WARNING_DAYS = 7;

function daysUntil(date: Date): number {
  const diffMs = date.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

function getKeyVaultPortalUrl(vaultUri?: string): string | undefined {
  if (!vaultUri) return undefined;
  return `https://portal.azure.com/#view/Microsoft_Azure_KeyVault/VaultMenuBlade/~/overview/vaultUri/${encodeURIComponent(vaultUri)}`;
}

function getCertificatePortalUrl(vaultUri?: string, certName?: string): string | undefined {
  if (!vaultUri || !certName) return undefined;
  return `https://portal.azure.com/#view/Microsoft_Azure_KeyVault/CertificateMenuBlade/~/overview/vaultUri/${encodeURIComponent(vaultUri)}/certificateName/${encodeURIComponent(certName)}`;
}

function getSecretPortalUrl(vaultUri?: string, secretName?: string): string | undefined {
  if (!vaultUri || !secretName) return undefined;
  return `https://portal.azure.com/#view/Microsoft_Azure_KeyVault/SecretMenuBlade/~/overview/vaultUri/${encodeURIComponent(vaultUri)}/secretName/${encodeURIComponent(secretName)}`;
}

function createStructuredError(
  err: any,
  resourceType: 'certificate' | 'secret',
  resourceName: string,
  vaultUri?: string
): KeyVaultError {
  // Access denied (403)
  if (err?.code === 'Forbidden' || err?.statusCode === 403) {
    const roles = resourceType === 'certificate'
      ? "'Key Vault Crypto User' and 'Key Vault Certificates User'"
      : "'Key Vault Secrets User'";
    return new KeyVaultError({
      code: 'ACCESS_DENIED',
      message: `Access denied to Key Vault ${resourceType} '${resourceName}'.`,
      action: `Verify you have the ${roles} role(s) assigned. If using PIM, ensure your elevated access is active.`,
      actionUrl: getKeyVaultPortalUrl(vaultUri),
      actionLabel: 'Open Key Vault in Azure Portal',
      detail: `HTTP 403 Forbidden. Your Azure identity does not have permission to access this ${resourceType}.`,
      severity: 'error',
      context: { vaultUri, resourceName },
    });
  }
  
  // Not found (404)
  if (err?.code === 'CertificateNotFound' || err?.code === 'SecretNotFound' || err?.statusCode === 404) {
    return new KeyVaultError({
      code: resourceType === 'certificate' ? 'CERT_NOT_FOUND' : 'SECRET_NOT_FOUND',
      message: `${resourceType === 'certificate' ? 'Certificate' : 'Secret'} '${resourceName}' not found in Key Vault.`,
      action: `Verify the ${resourceType} name is correct and exists in the Key Vault. Check for typos.`,
      actionUrl: getKeyVaultPortalUrl(vaultUri),
      actionLabel: 'Open Key Vault in Azure Portal',
      detail: `HTTP 404 Not Found. The ${resourceType} may have been deleted or renamed.`,
      severity: 'error',
      context: { vaultUri, resourceName },
    });
  }
  
  // Credential unavailable
  if (err?.code === 'CredentialUnavailableError' || err?.name === 'CredentialUnavailableError') {
    return new KeyVaultError({
      code: 'CREDENTIAL_UNAVAILABLE',
      message: 'Azure credentials not available.',
      action: 'Run "az login" in your terminal to authenticate with Azure CLI.',
      actionUrl: 'https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli',
      actionLabel: 'Learn about Azure CLI login',
      detail: 'DefaultAzureCredential could not find valid credentials.',
      severity: 'error',
    });
  }
  
  // Network error
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') {
    return new KeyVaultError({
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to Key Vault.',
      action: 'Check your network connection. If the Key Vault uses Private Endpoints, ensure your network can reach it.',
      actionUrl: getKeyVaultPortalUrl(vaultUri),
      actionLabel: 'Check Key Vault Network Settings',
      detail: err?.message || 'Network connection failed.',
      severity: 'error',
      context: { vaultUri },
    });
  }
  
  // Generic error
  return new KeyVaultError({
    code: 'UNKNOWN',
    message: err?.message || `Failed to access ${resourceType} '${resourceName}' in Key Vault.`,
    action: 'Check the technical details below. Verify Key Vault configuration and your Azure identity permissions.',
    actionUrl: getKeyVaultPortalUrl(vaultUri),
    actionLabel: 'Open Key Vault in Azure Portal',
    detail: JSON.stringify({ code: err?.code, statusCode: err?.statusCode, message: err?.message }, null, 2),
    severity: 'error',
    context: { vaultUri, resourceName },
  });
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

    // Check certificate expiry
    const expiresOn = certificate.properties.expiresOn;
    if (expiresOn) {
      if (isExpired(expiresOn)) {
        throw new KeyVaultError({
          code: 'CERT_EXPIRED',
          message: `Certificate '${config.certName}' expired on ${expiresOn.toLocaleDateString()}.`,
          action: 'Rotate the certificate in Key Vault and update your Entra app registration.',
          actionUrl: getCertificatePortalUrl(config.uri, config.certName),
          actionLabel: 'Open Certificate in Azure Portal',
          detail: 'The certificate has expired and cannot be used for authentication.',
          severity: 'error',
          context: { vaultUri: config.uri, resourceName: config.certName, expiryDate: expiresOn.toISOString() },
        });
      }
      const days = daysUntil(expiresOn);
      if (days <= EXPIRY_WARNING_DAYS) {
        console.warn(`[KeyVault] Certificate '${config.certName}' expires in ${days} day(s)`);
      }
    }

    if (!certificate.properties.x509Thumbprint) {
      throw new KeyVaultError({
        code: 'UNKNOWN',
        message: `Certificate '${config.certName}' does not have a valid thumbprint`,
        action: 'Verify the certificate was uploaded correctly to Key Vault.',
        severity: 'error',
        context: { vaultUri: config.uri, resourceName: config.certName },
      });
    }
    if (!certificate.cer) {
      throw new KeyVaultError({
        code: 'UNKNOWN',
        message: `Certificate '${config.certName}' public key not accessible`,
        action: 'Ensure the certificate has an associated public key.',
        severity: 'error',
        context: { vaultUri: config.uri, resourceName: config.certName },
      });
    }
    if (!certificate.keyId) {
      throw new KeyVaultError({
        code: 'UNKNOWN',
        message: `Certificate '${config.certName}' does not have an associated key`,
        action: 'Ensure the certificate was created with a key.',
        severity: 'error',
        context: { vaultUri: config.uri, resourceName: config.certName },
      });
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
    
    // If already a KeyVaultError, rethrow
    if (err instanceof KeyVaultError) {
      throw err;
    }
    
    // Convert to structured error
    throw createStructuredError(err, 'certificate', config.certName, config.uri);
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
  
  // Check if cached client is still within TTL (handles secret rotation)
  if (existing && Date.now() - existing.createdAt < CACHE_TTL_MS) {
    return existing;
  }
  
  // Clear expired client if any
  if (existing) {
    msalClients.delete(cacheKey);
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

    const state: MsalClientState = { app, useCertificate: true, createdAt: Date.now() };
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

  const state: MsalClientState = { app, useCertificate: false, createdAt: Date.now() };
  msalClients.set(cacheKey, state);
  return state;
}

export async function handleAppToken(params: unknown): Promise<msal.AuthenticationResult> {
  const { config, scopes } = params as AppTokenParams;
  
  // Validate config
  if (!config?.clientId || !config?.tenantId || !config?.keyVault?.uri) {
    throw new Error('Invalid configuration: clientId, tenantId, and keyVault.uri are required');
  }

  const cacheKey = getMsalCacheKey(config);
  const msalState = await initializeMsalClient(config);
  
  try {
    const result = await msalState.app.acquireTokenByClientCredential({
      scopes,
    });
    
    if (!result) {
      throw new Error('Failed to acquire token - no result returned');
    }

    return result;
  } catch (err: any) {
    // Invalidate client on auth errors that suggest stale credentials
    // AADSTS7000215: Invalid client secret
    // AADSTS7000222: The provided client secret keys are expired
    const errorCode = err?.errorCode || err?.error || '';
    const message = err?.message || '';
    if (
      errorCode === 'invalid_client' ||
      message.includes('AADSTS7000215') ||
      message.includes('AADSTS7000222') ||
      message.includes('invalid client secret')
    ) {
      msalClients.delete(cacheKey);
    }
    throw err;
  }
}
