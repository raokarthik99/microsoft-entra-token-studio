import { DefaultAzureCredential } from '@azure/identity';
import { CertificateClient } from '@azure/keyvault-certificates';
import { CryptographyClient, KnownSignatureAlgorithms } from '@azure/keyvault-keys';
import { SecretClient } from '@azure/keyvault-secrets';
import crypto from 'crypto';
import type { KeyVaultConfig } from '$lib/types';

export interface KeyVaultValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    thumbprint?: string;
    secretLength?: number;
  };
}

/**
 * Validate that a Key Vault configuration is accessible.
 * This tests connectivity and permissions without caching.
 */
export async function validateKeyVaultConfig(config: KeyVaultConfig): Promise<KeyVaultValidationResult> {
  if (!config.uri) {
    return { valid: false, error: 'Key Vault URI is required' };
  }

  try {
    const url = new URL(config.uri);
    if (!url.protocol.startsWith('https')) {
      return { valid: false, error: 'Key Vault URI must start with https://' };
    }
    if (!url.hostname.endsWith('.vault.azure.net')) {
      return { valid: false, error: 'Key Vault URI must end with .vault.azure.net' };
    }
  } catch {
    return { valid: false, error: 'Invalid Key Vault URI format' };
  }

  if (config.credentialType === 'certificate' && !config.certName) {
    return { valid: false, error: 'Certificate name is required for certificate credential type' };
  }

  if (config.credentialType === 'secret' && !config.secretName) {
    return { valid: false, error: 'Secret name is required for secret credential type' };
  }

  try {
    const credential = new DefaultAzureCredential();

    if (config.credentialType === 'certificate') {
      return await validateCertificate(config.uri, config.certName!, credential);
    } else {
      return await validateSecret(config.uri, config.secretName!, credential);
    }
  } catch (err: any) {
    return {
      valid: false,
      error: formatAzureError(err),
    };
  }
}

async function validateCertificate(
  vaultUri: string,
  certName: string,
  credential: DefaultAzureCredential
): Promise<KeyVaultValidationResult> {
  const certClient = new CertificateClient(vaultUri, credential);
  
  try {
    const certificate = await certClient.getCertificate(certName);
    
    if (!certificate.properties.x509Thumbprint) {
      return { valid: false, error: 'Certificate does not have a valid thumbprint' };
    }

    // Verify we can sign with the private key (requires Crypto User role, not Secrets User)
    if (certificate.keyId) {
      const cryptoClient = new CryptographyClient(certificate.keyId, credential);
      const testData = crypto.createHash('sha256').update('validation-test').digest();
      try {
        await cryptoClient.sign(KnownSignatureAlgorithms.RS256, testData);
      } catch (signErr: any) {
        // Specific error for crypto access issues
        if (signErr.code === 'Forbidden' || signErr.statusCode === 403) {
          return { valid: false, error: 'Cannot sign with certificate private key. Ensure you have Key Vault Crypto User role.' };
        }
        return { valid: false, error: formatAzureError(signErr) };
      }
    } else {
      return { valid: false, error: 'Certificate does not have an associated key for signing' };
    }

    const thumbprint = Buffer.from(certificate.properties.x509Thumbprint).toString('hex').toUpperCase();
    
    return {
      valid: true,
      details: { thumbprint: thumbprint.substring(0, 16) + '...' },
    };
  } catch (err: any) {
    return { valid: false, error: formatAzureError(err) };
  }
}

async function validateSecret(
  vaultUri: string,
  secretName: string,
  credential: DefaultAzureCredential
): Promise<KeyVaultValidationResult> {
  const secretClient = new SecretClient(vaultUri, credential);
  
  try {
    const secret = await secretClient.getSecret(secretName);
    
    if (!secret.value) {
      return { valid: false, error: 'Secret value is empty' };
    }

    return {
      valid: true,
      details: { secretLength: secret.value.length },
    };
  } catch (err: any) {
    return { valid: false, error: formatAzureError(err) };
  }
}

function formatAzureError(err: any): string {
  const message = err.message || '';
  
  // Handle specific cryptic Azure SDK errors
  if (message.includes('isAxiosError is not a function')) {
    return 'Connection failed. Please check the Key Vault URI and your network connection.';
  }

  if (err.code === 'SecretNotFound' || err.code === 'CertificateNotFound' || err.statusCode === 404) {
    return 'Resource not found in Key Vault. Verify the name is correct.';
  }
  if (err.code === 'Forbidden' || err.statusCode === 403) {
    return 'Access denied. Ensure you have the required Key Vault permissions (Secrets/Certificates User role).';
  }
  if (err.code === 'CredentialUnavailableError') {
    return 'Azure credentials not available. Run "az login" or configure managed identity.';
  }
  
  return message || 'Failed to access Key Vault';
}
