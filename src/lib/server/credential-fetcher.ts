/**
 * Credential fetcher for dynamic app configurations.
 * Fetches secrets from Key Vault using provided config.
 *
 * Note: Certificate authentication now uses Key Vault signing (keyvault-signer.ts)
 * instead of downloading the private key. This file only handles client secrets.
 *
 * Caching strategy:
 * - Only successful results are cached (never errors)
 * - Cache entries expire after TTL to handle credential rotation and PIM access changes
 * - On error, the cache entry is cleared so the next request retries fresh
 */
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import type { KeyVaultConfig } from "$lib/types";
import {
  KeyVaultError,
  createAccessDeniedError,
  createSecretExpiredError,
  createSecretExpiringSoonWarning,
  createNotFoundError,
  createCredentialUnavailableError,
  createNetworkError,
  createUnknownError,
  isAccessDeniedError,
  isNotFoundError,
  isCredentialUnavailableError,
  isNetworkError,
  isExpired,
  daysUntil,
  EXPIRY_WARNING_DAYS,
} from "./keyvault-errors";

// Cache TTL: 5 minutes (in milliseconds)
// Short enough to pick up PIM access changes, long enough to reduce Key Vault calls
const CACHE_TTL_MS = 5 * 60 * 1000;

// Per-config caching for secrets (only successful values, with TTL)
interface CachedSecret {
  value: string;
  expiresAt: number;
  secretExpiresOn?: Date; // Secret's own expiry date for proactive warnings
}
const secretCache = new Map<string, CachedSecret>();

/**
 * Generate a cache key for a Key Vault resource
 */
function getCacheKey(vaultUri: string, resourceName: string): string {
  return `${vaultUri.toLowerCase()}:${resourceName.toLowerCase()}`;
}

/**
 * Check if a cached entry is still valid
 */
function isCacheValid(
  cached: CachedSecret | undefined
): cached is CachedSecret {
  return cached !== undefined && Date.now() < cached.expiresAt;
}

/**
 * Fetch a client secret from Azure Key Vault using provided configuration.
 * Only successful results are cached (with TTL). Errors are never cached.
 */
export async function fetchSecretWithConfig(
  config: KeyVaultConfig
): Promise<string> {
  if (!config.uri || !config.secretName) {
    throw new Error("Key Vault URI and secret name are required");
  }

  const cacheKey = getCacheKey(config.uri, config.secretName);
  const cached = secretCache.get(cacheKey);

  // Return cached value if valid and not expired
  if (isCacheValid(cached)) {
    return cached.value;
  }

  // Clear expired entry
  if (cached) {
    secretCache.delete(cacheKey);
  }

  try {
    const credential = new DefaultAzureCredential();
    const secretClient = new SecretClient(config.uri, credential);

    const secret = await secretClient.getSecret(config.secretName);

    // Check secret expiry
    const secretExpiresOn = secret.properties.expiresOn;
    if (secretExpiresOn) {
      if (isExpired(secretExpiresOn)) {
        throw createSecretExpiredError(config.secretName, secretExpiresOn, config.uri);
      }
      const days = daysUntil(secretExpiresOn);
      if (days <= EXPIRY_WARNING_DAYS) {
        // Log warning but don't block - the secret will still work
        console.warn(
          `[KeyVault] Secret '${config.secretName}' expires in ${days} day(s)`
        );
      }
    }

    if (!secret.value) {
      // Don't cache empty value errors - let the next request retry
      throw new KeyVaultError({
        code: 'UNKNOWN',
        message: `Secret '${config.secretName}' value is empty`,
        action: 'Verify the secret has a value stored in Key Vault.',
        severity: 'error',
        context: { vaultUri: config.uri, resourceName: config.secretName },
      });
    }

    // Cache successful result with TTL
    secretCache.set(cacheKey, {
      value: secret.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
      secretExpiresOn,
    });
    return secret.value;
  } catch (err: any) {
    // Never cache errors - clear any stale entry and throw
    secretCache.delete(cacheKey);
    
    // If already a KeyVaultError, rethrow as-is
    if (err instanceof KeyVaultError) {
      throw err;
    }
    
    // Convert to structured KeyVaultError
    throw createKeyVaultErrorFromRaw(err, 'secret', config.secretName, config.uri);
  }
}

/**
 * Clear all cached secrets (useful for forced refresh or testing)
 */
export function clearCredentialCache(): void {
  secretCache.clear();
}

/**
 * Clear cached secret for a specific Key Vault config
 */
export function clearCredentialCacheForConfig(config: KeyVaultConfig): void {
  if (config.secretName) {
    secretCache.delete(getCacheKey(config.uri, config.secretName));
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
 * Get secret expiry warning if applicable
 * Returns a warning KeyVaultError if secret is expiring soon, undefined otherwise
 */
export async function getSecretExpiryWarning(
  config: KeyVaultConfig
): Promise<KeyVaultError | undefined> {
  if (!config.uri || !config.secretName) return undefined;
  
  try {
    const cacheKey = getCacheKey(config.uri, config.secretName);
    const cached = secretCache.get(cacheKey);
    
    if (isCacheValid(cached) && cached.secretExpiresOn) {
      const days = daysUntil(cached.secretExpiresOn);
      if (days <= EXPIRY_WARNING_DAYS && days > 0) {
        return createSecretExpiringSoonWarning(
          config.secretName,
          cached.secretExpiresOn,
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
