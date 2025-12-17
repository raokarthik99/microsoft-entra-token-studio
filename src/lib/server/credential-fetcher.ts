/**
 * Credential fetcher for dynamic app configurations.
 * Fetches secrets from Key Vault using provided config.
 * 
 * Note: Certificate authentication now uses Key Vault signing (keyvault-signer.ts)
 * instead of downloading the private key. This file only handles client secrets.
 */
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import type { KeyVaultConfig } from '$lib/types';

// Per-config caching for secrets
const secretCache = new Map<string, { value: string; error: string | null }>();

/**
 * Generate a cache key for a Key Vault resource
 */
function getCacheKey(vaultUri: string, resourceName: string): string {
  return `${vaultUri.toLowerCase()}:${resourceName.toLowerCase()}`;
}

/**
 * Fetch a client secret from Azure Key Vault using provided configuration.
 * Results are cached per vault+secret combination.
 */
export async function fetchSecretWithConfig(config: KeyVaultConfig): Promise<string> {
  if (!config.uri || !config.secretName) {
    throw new Error('Key Vault URI and secret name are required');
  }

  const cacheKey = getCacheKey(config.uri, config.secretName);
  const cached = secretCache.get(cacheKey);
  
  if (cached) {
    if (cached.error) {
      throw new Error(cached.error);
    }
    return cached.value;
  }

  try {
    const credential = new DefaultAzureCredential();
    const secretClient = new SecretClient(config.uri, credential);
    
    const secret = await secretClient.getSecret(config.secretName);
    
    if (!secret.value) {
      const error = `Secret '${config.secretName}' value is empty`;
      secretCache.set(cacheKey, { value: '', error });
      throw new Error(error);
    }

    secretCache.set(cacheKey, { value: secret.value, error: null });
    return secret.value;
  } catch (err: any) {
    const message = formatError(err, config.secretName);
    secretCache.set(cacheKey, { value: '', error: message });
    throw new Error(message);
  }
}

/**
 * Format Azure SDK errors into user-friendly messages
 */
function formatError(err: any, resourceName: string): string {
  if (err.code === 'SecretNotFound' || err.statusCode === 404) {
    return `Secret '${resourceName}' not found in Key Vault`;
  }
  if (err.code === 'Forbidden' || err.statusCode === 403) {
    return `Access denied to Key Vault. Ensure you have the 'Key Vault Secrets User' role.`;
  }
  if (err.code === 'CredentialUnavailableError') {
    return 'Azure credentials not available. Run "az login" in your terminal.';
  }
  if (err.message?.includes('isAxiosError is not a function')) {
    return 'Connection failed. Check Key Vault URI and network connection';
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
