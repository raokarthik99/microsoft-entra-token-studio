/**
 * Key Vault JWT Signer
 *
 * Signs client assertion JWTs using Azure Key Vault CryptographyClient.
 * The private key NEVER leaves Key Vault - only the signature is returned.
 *
 * Supports SN+I (Subject Name + Issuer) authentication by including x5c claim.
 *
 * Caching strategy:
 * - Only successful certificate metadata is cached (never errors)
 * - Cache entries expire after TTL to handle PIM access changes
 * - On error, the cache entry is cleared so the next request retries fresh
 */
import crypto from "crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { CertificateClient } from "@azure/keyvault-certificates";
import {
  CryptographyClient,
  KnownSignatureAlgorithms,
} from "@azure/keyvault-keys";
import type { KeyVaultConfig } from "$lib/types";
import {
  KeyVaultError,
  createAccessDeniedError,
  createCertExpiredError,
  createCertExpiringSoonWarning,
  createNotFoundError,
  createCredentialUnavailableError,
  createNetworkError,
  createSigningFailedError,
  createUnknownError,
  isAccessDeniedError,
  isNotFoundError,
  isCredentialUnavailableError,
  isNetworkError,
  isExpired,
  daysUntil,
  EXPIRY_WARNING_DAYS,
} from "./keyvault-errors";

// Cache TTL: 15 minutes (in milliseconds)
// Error-based cache invalidation provides safety for access revocation scenarios
// while reducing Key Vault roundtrips for better performance
const CACHE_TTL_MS = 15 * 60 * 1000;

// Singleton DefaultAzureCredential - reused across all Key Vault operations
// The credential handles its own token lifecycle and refresh internally
let sharedCredential: DefaultAzureCredential | null = null;

function getSharedCredential(): DefaultAzureCredential {
  if (!sharedCredential) {
    sharedCredential = new DefaultAzureCredential();
  }
  return sharedCredential;
}

// Cache for certificate metadata (thumbprint, x5c, keyId) + CryptographyClient
interface CertMetadata {
  thumbprint: string;
  x5c: string; // Base64-encoded DER certificate
  keyId: string; // Key Vault key URL for signing
  cryptoClient: CryptographyClient; // Cached client for signing operations
  expiresOn?: Date; // Certificate expiry date for proactive warnings
}

interface CachedCertMetadata {
  value: CertMetadata;
  expiresAt: number;
}

const certMetadataCache = new Map<string, CachedCertMetadata>();

/**
 * Generate cache key for certificate metadata
 */
function getCacheKey(vaultUri: string, certName: string): string {
  return `${vaultUri.toLowerCase()}:${certName.toLowerCase()}`;
}

/**
 * Check if a cached entry is still valid
 */
function isCacheValid(
  cached: CachedCertMetadata | undefined
): cached is CachedCertMetadata {
  return cached !== undefined && Date.now() < cached.expiresAt;
}

/**
 * Get certificate metadata from Key Vault (thumbprint, x5c, keyId).
 * Does NOT access the private key - only public certificate metadata.
 * Only successful results are cached (with TTL). Errors are never cached.
 */
async function getCertificateMetadata(
  config: KeyVaultConfig
): Promise<CertMetadata> {
  if (!config.uri || !config.certName) {
    throw new Error("Key Vault URI and certificate name are required");
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

    // Get certificate (public info only - no private key access needed)
    const certificate = await certClient.getCertificate(config.certName);

    // Check certificate expiry
    const expiresOn = certificate.properties.expiresOn;
    if (expiresOn) {
      if (isExpired(expiresOn)) {
        throw createCertExpiredError(config.certName, expiresOn, config.uri);
      }
      const days = daysUntil(expiresOn);
      if (days <= EXPIRY_WARNING_DAYS) {
        // Log warning but don't block - the token will still work
        console.warn(
          `[KeyVault] Certificate '${config.certName}' expires in ${days} day(s)`
        );
      }
    }

    if (!certificate.properties.x509Thumbprint) {
      // Don't cache validation errors - let the next request retry
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
        action: 'Ensure the certificate was created with a key (not imported as cert-only).',
        severity: 'error',
        context: { vaultUri: config.uri, resourceName: config.certName },
      });
    }

    // Thumbprint: SHA-1 hex of DER certificate (for x5t claim)
    const thumbprint = Buffer.from(certificate.properties.x509Thumbprint)
      .toString("hex")
      .toUpperCase();

    // x5c: Base64-encoded DER certificate (for certificate chain in JWT header)
    const x5c = Buffer.from(certificate.cer).toString("base64");

    // Create CryptographyClient tied to this certificate's lifecycle
    const cryptoClient = new CryptographyClient(certificate.keyId, credential);

    const metadata: CertMetadata = {
      thumbprint,
      x5c,
      keyId: certificate.keyId,
      cryptoClient,
      expiresOn,
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
    
    // If already a KeyVaultError, rethrow as-is
    if (err instanceof KeyVaultError) {
      throw err;
    }
    
    // Convert to structured KeyVaultError
    throw createKeyVaultErrorFromRaw(err, 'certificate', config.certName, config.uri);
  }
}

/**
 * Base64URL encode (JWT-safe encoding)
 */
function base64UrlEncode(data: string | Buffer): string {
  const buffer = typeof data === "string" ? Buffer.from(data) : data;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
  const x5t = base64UrlEncode(Buffer.from(metadata.thumbprint, "hex"));

  const header = {
    alg: "RS256",
    typ: "JWT",
    x5t, // Thumbprint for key identification
    x5c: [metadata.x5c], // Certificate chain for SN+I validation
  };

  // JWT Payload (client assertion claims)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    iss: clientId,
    sub: clientId,
    jti: crypto.randomUUID(),
    nbf: now,
    exp: now + 300, // 5 minute expiry
  };

  // Encode header and payload
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Hash the signing input (RS256 = RSA-SHA256)
  const hash = crypto.createHash("sha256").update(signingInput).digest();

  // Sign using cached CryptographyClient (created with metadata)
  // The private key NEVER leaves Key Vault - only the signature is returned
  const signResult = await metadata.cryptoClient.sign(
    KnownSignatureAlgorithms.RS256,
    hash
  );

  if (!signResult.result) {
    throw new Error("Key Vault signing operation returned no result");
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
 * Convert raw Azure SDK errors to structured KeyVaultError
 */
function createKeyVaultErrorFromRaw(
  err: any,
  resourceType: 'certificate' | 'secret',
  resourceName: string,
  vaultUri?: string
): KeyVaultError {
  if (isAccessDeniedError(err)) {
    return createAccessDeniedError(resourceType, resourceName, vaultUri);
  }
  if (isNotFoundError(err)) {
    return createNotFoundError(resourceType, resourceName, vaultUri);
  }
  if (isCredentialUnavailableError(err)) {
    return createCredentialUnavailableError();
  }
  if (isNetworkError(err)) {
    return createNetworkError(vaultUri, err?.message);
  }
  return createUnknownError(err, resourceType, resourceName, vaultUri);
}

/**
 * Get certificate expiry warning if applicable
 * Returns a warning KeyVaultError if cert is expiring soon, undefined otherwise
 */
export async function getCertificateExpiryWarning(
  config: KeyVaultConfig
): Promise<KeyVaultError | undefined> {
  if (!config.uri || !config.certName) return undefined;
  
  try {
    const cacheKey = getCacheKey(config.uri, config.certName);
    const cached = certMetadataCache.get(cacheKey);
    
    if (isCacheValid(cached) && cached.value.expiresOn) {
      const days = daysUntil(cached.value.expiresOn);
      if (days <= EXPIRY_WARNING_DAYS && days > 0) {
        return createCertExpiringSoonWarning(
          config.certName,
          cached.value.expiresOn,
          days,
          config.uri
        );
      }
    }
  } catch {
    // Ignore errors in warning check
  }
  return undefined;
}
