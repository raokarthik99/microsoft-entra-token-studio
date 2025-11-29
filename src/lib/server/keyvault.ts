/**
 * Key Vault utilities for env-var based configuration.
 * Used for health checks and legacy env-var based auth.
 * 
 * Note: Certificate authentication now uses Key Vault signing (keyvault-signer.ts).
 * This module no longer downloads private keys.
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CertificateClient } from '@azure/keyvault-certificates';
import { SecretClient } from '@azure/keyvault-secrets';
import { env } from '$env/dynamic/private';

export interface KeyVaultStatus {
  configured: boolean;
  uri: string | null;
  certName: string | null;
  secretName: string | null;
  status: 'connected' | 'error' | 'not_configured';
  error?: string;
}

/**
 * Check if Key Vault certificate auth is configured
 */
export function isKeyVaultConfigured(): boolean {
  return Boolean(env.AZURE_KEYVAULT_URI && env.AZURE_KEYVAULT_CERT_NAME);
}

/**
 * Check if Key Vault secret auth is configured
 */
export function isKeyVaultSecretConfigured(): boolean {
  return Boolean(env.AZURE_KEYVAULT_URI && env.AZURE_KEYVAULT_SECRET_NAME);
}

/**
 * Get the current Key Vault configuration status
 */
export function getKeyVaultConfig(): { uri: string | null; certName: string | null; secretName: string | null } {
  return {
    uri: env.AZURE_KEYVAULT_URI || null,
    certName: env.AZURE_KEYVAULT_CERT_NAME || null,
    secretName: env.AZURE_KEYVAULT_SECRET_NAME || null,
  };
}

/**
 * Validate Key Vault configuration completeness
 */
export function validateKeyVaultConfig(): string | null {
  if (env.AZURE_KEYVAULT_URI && !env.AZURE_KEYVAULT_CERT_NAME && !env.AZURE_KEYVAULT_SECRET_NAME) {
    return 'AZURE_KEYVAULT_URI is set but neither AZURE_KEYVAULT_CERT_NAME nor AZURE_KEYVAULT_SECRET_NAME is set.';
  }
  if (!env.AZURE_KEYVAULT_URI && (env.AZURE_KEYVAULT_CERT_NAME || env.AZURE_KEYVAULT_SECRET_NAME)) {
    return 'Key Vault resource name is set but AZURE_KEYVAULT_URI is missing.';
  }
  return null;
}

// Cached secret
let cachedSecret: string | null = null;
let cachedError: string | null = null;
let secretFetched = false;

/**
 * Verify certificate exists in Key Vault (for health checks).
 * Does NOT download the private key - only verifies the certificate is accessible.
 */
async function verifyCertificateAccess(vaultUri: string, certName: string): Promise<void> {
  const credential = new DefaultAzureCredential();
  const certClient = new CertificateClient(vaultUri, credential);
  
  try {
    const cert = await certClient.getCertificate(certName);
    if (!cert.properties.x509Thumbprint) {
      throw new Error(`Certificate '${certName}' does not have a valid thumbprint.`);
    }
  } catch (err: any) {
    if (err.code === 'CertificateNotFound' || err.statusCode === 404) {
      throw new Error(`Certificate '${certName}' not found in Key Vault.`);
    }
    if (err.code === 'Forbidden' || err.statusCode === 403) {
      throw new Error(`Access denied to Key Vault. Ensure you have 'Key Vault Certificates User' role.`);
    }
    throw err;
  }
}

/**
 * Fetch client secret from Azure Key Vault.
 * Results are cached for the lifetime of the server process.
 */
export async function fetchSecretFromKeyVault(): Promise<string> {
  // Return cached result if available
  if (secretFetched) {
    if (cachedError) {
      throw new Error(cachedError);
    }
    if (cachedSecret) {
      return cachedSecret;
    }
  }

  const vaultUri = env.AZURE_KEYVAULT_URI;
  const secretName = env.AZURE_KEYVAULT_SECRET_NAME;

  if (!vaultUri || !secretName) {
    cachedError = 'Key Vault configuration incomplete. Set AZURE_KEYVAULT_URI and AZURE_KEYVAULT_SECRET_NAME.';
    secretFetched = true;
    throw new Error(cachedError);
  }

  try {
    const credential = new DefaultAzureCredential();
    const secretClient = new SecretClient(vaultUri, credential);
    
    let secret;
    try {
      secret = await secretClient.getSecret(secretName);
    } catch (err: any) {
      if (err.code === 'SecretNotFound' || err.statusCode === 404) {
        throw new Error(`Secret '${secretName}' not found in Key Vault.`);
      }
      if (err.code === 'Forbidden' || err.statusCode === 403) {
        throw new Error(`Access denied to Key Vault secrets. Ensure you have 'Key Vault Secrets User' role.`);
      }
      throw err;
    }

    if (!secret.value) {
      throw new Error(`Secret '${secretName}' value is empty.`);
    }

    cachedSecret = secret.value;
    secretFetched = true;
    cachedError = null;
    
    return cachedSecret;
  } catch (err: any) {
    const message = err.message || 'Failed to fetch secret from Key Vault';
    cachedError = message;
    secretFetched = true;
    console.error(`[KeyVault] Error: ${message}`);
    throw new Error(message);
  }
}

/**
 * Get the current Key Vault certificate status for health checks.
 * Only verifies certificate is accessible - does NOT download private key.
 */
export async function getKeyVaultCertificateStatus(): Promise<KeyVaultStatus> {
  const config = getKeyVaultConfig();
  
  if (!env.AZURE_KEYVAULT_URI && !env.AZURE_KEYVAULT_CERT_NAME) {
    return {
      configured: false,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'not_configured',
    };
  }

  if (!env.AZURE_KEYVAULT_URI || !env.AZURE_KEYVAULT_CERT_NAME) {
    return {
      configured: false,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'error',
      error: 'Set both AZURE_KEYVAULT_URI and AZURE_KEYVAULT_CERT_NAME for certificate authentication.',
    };
  }

  try {
    await verifyCertificateAccess(env.AZURE_KEYVAULT_URI, env.AZURE_KEYVAULT_CERT_NAME);
    
    return {
      configured: true,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'connected',
    };
  } catch (err: any) {
    return {
      configured: true,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'error',
      error: err.message,
    };
  }
}

/**
 * Get the current Key Vault secret status for health checks
 */
export async function getKeyVaultSecretStatus(): Promise<KeyVaultStatus> {
  const config = getKeyVaultConfig();
  
  if (!env.AZURE_KEYVAULT_URI && !env.AZURE_KEYVAULT_SECRET_NAME) {
    return {
      configured: false,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'not_configured',
    };
  }

  if (!env.AZURE_KEYVAULT_URI || !env.AZURE_KEYVAULT_SECRET_NAME) {
    return {
      configured: false,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'error',
      error: 'Set both AZURE_KEYVAULT_URI and AZURE_KEYVAULT_SECRET_NAME for secret-based authentication.',
    };
  }

  try {
    await fetchSecretFromKeyVault();
    
    return {
      configured: true,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'connected',
    };
  } catch (err: any) {
    return {
      configured: true,
      uri: config.uri,
      certName: config.certName,
      secretName: config.secretName,
      status: 'error',
      error: err.message,
    };
  }
}

/**
 * Get the current Key Vault status for health checks (auto-detected)
 */
export async function getKeyVaultStatus(): Promise<KeyVaultStatus> {
  if (isKeyVaultConfigured()) {
    return getKeyVaultCertificateStatus();
  }

  if (isKeyVaultSecretConfigured()) {
    return getKeyVaultSecretStatus();
  }

  const config = getKeyVaultConfig();
  return {
    configured: false,
    uri: config.uri,
    certName: config.certName,
    secretName: config.secretName,
    status: 'not_configured',
  };
}

/**
 * Clear the cached secret (useful for testing or forced refresh)
 */
export function clearSecretCache(): void {
  cachedSecret = null;
  cachedError = null;
  secretFetched = false;
}
