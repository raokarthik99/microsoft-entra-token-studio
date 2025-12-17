/**
 * Key Vault JWT Signer
 * 
 * Signs client assertion JWTs using Azure Key Vault CryptographyClient.
 * The private key NEVER leaves Key Vault - only the signature is returned.
 * 
 * Supports SN+I (Subject Name + Issuer) authentication by including x5c claim.
 */
import crypto from 'crypto';
import { DefaultAzureCredential } from '@azure/identity';
import { CertificateClient } from '@azure/keyvault-certificates';
import { CryptographyClient, KnownSignatureAlgorithms } from '@azure/keyvault-keys';
import type { KeyVaultConfig } from '$lib/types';

// Cache for certificate metadata (thumbprint, x5c, keyId)
interface CertMetadata {
  thumbprint: string;
  x5c: string;       // Base64-encoded DER certificate
  keyId: string;     // Key Vault key URL for signing
}

const certMetadataCache = new Map<string, { value: CertMetadata | null; error: string | null }>();

/**
 * Generate cache key for certificate metadata
 */
function getCacheKey(vaultUri: string, certName: string): string {
  return `${vaultUri.toLowerCase()}:${certName.toLowerCase()}`;
}

/**
 * Get certificate metadata from Key Vault (thumbprint, x5c, keyId).
 * Does NOT access the private key - only public certificate metadata.
 */
async function getCertificateMetadata(config: KeyVaultConfig): Promise<CertMetadata> {
  if (!config.uri || !config.certName) {
    throw new Error('Key Vault URI and certificate name are required');
  }

  const cacheKey = getCacheKey(config.uri, config.certName);
  const cached = certMetadataCache.get(cacheKey);
  
  if (cached) {
    if (cached.error) throw new Error(cached.error);
    if (cached.value) return cached.value;
  }

  try {
    const credential = new DefaultAzureCredential();
    const certClient = new CertificateClient(config.uri, credential);
    
    // Get certificate (public info only - no private key access needed)
    const certificate = await certClient.getCertificate(config.certName);

    if (!certificate.properties.x509Thumbprint) {
      const error = `Certificate '${config.certName}' does not have a valid thumbprint`;
      certMetadataCache.set(cacheKey, { value: null, error });
      throw new Error(error);
    }

    if (!certificate.cer) {
      const error = `Certificate '${config.certName}' public key not accessible`;
      certMetadataCache.set(cacheKey, { value: null, error });
      throw new Error(error);
    }

    if (!certificate.keyId) {
      const error = `Certificate '${config.certName}' does not have an associated key`;
      certMetadataCache.set(cacheKey, { value: null, error });
      throw new Error(error);
    }

    // Thumbprint: SHA-1 hex of DER certificate (for x5t claim)
    const thumbprint = Buffer.from(certificate.properties.x509Thumbprint).toString('hex').toUpperCase();
    
    // x5c: Base64-encoded DER certificate (for certificate chain in JWT header)
    const x5c = Buffer.from(certificate.cer).toString('base64');

    const metadata: CertMetadata = {
      thumbprint,
      x5c,
      keyId: certificate.keyId,
    };

    certMetadataCache.set(cacheKey, { value: metadata, error: null });
    return metadata;
  } catch (err: any) {
    const message = formatError(err, config.certName);
    certMetadataCache.set(cacheKey, { value: null, error: message });
    throw new Error(message);
  }
}

/**
 * Base64URL encode (JWT-safe encoding)
 */
function base64UrlEncode(data: string | Buffer): string {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign a client assertion JWT using Key Vault.
 * The private key never leaves Key Vault - only the signature is returned.
 * 
 * @param config - Key Vault configuration with certificate name
 * @param clientId - Azure AD application (client) ID
 * @param tenantId - Azure AD tenant ID
 * @returns Signed JWT string for use as clientAssertion
 */
export async function signJwtWithKeyVault(
  config: KeyVaultConfig,
  clientId: string,
  tenantId: string
): Promise<string> {
  // Get certificate metadata (cached)
  const metadata = await getCertificateMetadata(config);
  
  // JWT Header with x5c for SN+I authentication
  // x5t is the thumbprint (SHA-1) in base64url format
  const x5t = base64UrlEncode(Buffer.from(metadata.thumbprint, 'hex'));
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    x5t,                    // Thumbprint for key identification
    x5c: [metadata.x5c],    // Certificate chain for SN+I validation
  };

  // JWT Payload (client assertion claims)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    iss: clientId,
    sub: clientId,
    jti: crypto.randomUUID(),
    nbf: now,
    exp: now + 300,  // 5 minute expiry
  };

  // Encode header and payload
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Hash the signing input (RS256 = RSA-SHA256)
  const hash = crypto.createHash('sha256').update(signingInput).digest();

  // Sign using Key Vault CryptographyClient
  // The private key NEVER leaves Key Vault - only the signature is returned
  const credential = new DefaultAzureCredential();
  const cryptoClient = new CryptographyClient(metadata.keyId, credential);
  
  const signResult = await cryptoClient.sign(KnownSignatureAlgorithms.RS256, hash);
  
  if (!signResult.result) {
    throw new Error('Key Vault signing operation returned no result');
  }

  // Encode signature and assemble complete JWT
  const signatureB64 = base64UrlEncode(Buffer.from(signResult.result));
  
  return `${signingInput}.${signatureB64}`;
}

/**
 * Clear cached certificate metadata (for testing or forced refresh)
 */
export function clearSignerCache(): void {
  certMetadataCache.clear();
}

/**
 * Clear cached metadata for a specific certificate
 */
export function clearSignerCacheForConfig(config: KeyVaultConfig): void {
  if (config.certName) {
    certMetadataCache.delete(getCacheKey(config.uri, config.certName));
  }
}

/**
 * Format Azure SDK errors into user-friendly messages
 */
function formatError(err: any, certName: string): string {
  if (err.code === 'CertificateNotFound' || err.statusCode === 404) {
    return `Certificate '${certName}' not found in Key Vault`;
  }
  if (err.code === 'Forbidden' || err.statusCode === 403) {
    return `Access denied to Key Vault. For certificate signing, ensure you have 'Key Vault Crypto User' and 'Key Vault Certificates User' roles.`;
  }
  if (err.code === 'CredentialUnavailableError') {
    return 'Azure credentials not available. Run "az login" in your terminal.';
  }
  return err.message || `Failed to access certificate '${certName}' in Key Vault`;
}
