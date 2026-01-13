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

// Cache TTL: 5 minutes (in milliseconds)
// Short enough to pick up PIM access changes, long enough to reduce Key Vault calls
const CACHE_TTL_MS = 5 * 60 * 1000;

// Per-config caching for secrets (only successful values, with TTL)
interface CachedSecret {
  value: string;
  expiresAt: number;
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

    if (!secret.value) {
      // Don't cache empty value errors - let the next request retry
      throw new Error(`Secret '${config.secretName}' value is empty`);
    }

    // Cache successful result with TTL
    secretCache.set(cacheKey, {
      value: secret.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return secret.value;
  } catch (err: any) {
    // Never cache errors - clear any stale entry and throw
    secretCache.delete(cacheKey);
    throw new Error(formatError(err, config.secretName));
  }
}

/**
 * Format Azure SDK errors into user-friendly messages
 */
function formatError(err: any, resourceName: string): string {
  if (err.code === "SecretNotFound" || err.statusCode === 404) {
    return `Secret '${resourceName}' not found in Key Vault`;
  }
  if (err.code === "Forbidden" || err.statusCode === 403) {
    return `Access denied to Key Vault. Ensure you have the 'Key Vault Secrets User' role.`;
  }
  if (err.code === "CredentialUnavailableError") {
    return 'Azure credentials not available. Run "az login" in your terminal.';
  }
  if (err.message?.includes("isAxiosError is not a function")) {
    return "Connection failed. Check Key Vault URI and network connection";
  }
  return err.message || `Failed to fetch secret from Key Vault`;
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
