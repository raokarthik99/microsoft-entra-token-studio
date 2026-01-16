/**
 * Key Vault Validation Handler
 * 
 * Validates Key Vault connectivity and credential access.
 * Mirrors the logic in src/lib/server/keyvault-validator.ts
 */

import { DefaultAzureCredential } from '@azure/identity';
import { CertificateClient } from '@azure/keyvault-certificates';
import { SecretClient } from '@azure/keyvault-secrets';

export interface KeyVaultConfig {
  uri: string;
  credentialType: 'certificate' | 'secret';
  certName?: string;
  secretName?: string;
}

export interface ValidationResult {
  valid: boolean;
  credentialType: 'certificate' | 'secret';
  message?: string;
}

export async function handleValidateKeyVault(params: unknown): Promise<ValidationResult> {
  const config = params as KeyVaultConfig;

  if (!config?.uri) {
    return { valid: false, credentialType: config?.credentialType || 'secret', message: 'Key Vault URI is required' };
  }

  const credential = new DefaultAzureCredential();

  if (config.credentialType === 'certificate') {
    if (!config.certName) {
      return { valid: false, credentialType: 'certificate', message: 'Certificate name is required' };
    }

    try {
      const certClient = new CertificateClient(config.uri, credential);
      const cert = await certClient.getCertificate(config.certName);
      
      if (!cert.properties.x509Thumbprint) {
        return { valid: false, credentialType: 'certificate', message: `Certificate '${config.certName}' does not have a valid thumbprint` };
      }

      return { valid: true, credentialType: 'certificate' };
    } catch (err) {
      const error = err as Error & { code?: string; statusCode?: number };
      
      if (error.code === 'CertificateNotFound' || error.statusCode === 404) {
        return { valid: false, credentialType: 'certificate', message: `Certificate '${config.certName}' not found in Key Vault` };
      }
      if (error.code === 'Forbidden' || error.statusCode === 403) {
        return { valid: false, credentialType: 'certificate', message: 'Access denied. Ensure you have Key Vault Certificates User role.' };
      }
      
      return { valid: false, credentialType: 'certificate', message: error.message };
    }
  }

  // Secret validation
  if (!config.secretName) {
    return { valid: false, credentialType: 'secret', message: 'Secret name is required' };
  }

  try {
    const secretClient = new SecretClient(config.uri, credential);
    const secret = await secretClient.getSecret(config.secretName);
    
    if (!secret.value) {
      return { valid: false, credentialType: 'secret', message: `Secret '${config.secretName}' value is empty` };
    }

    return { valid: true, credentialType: 'secret' };
  } catch (err) {
    const error = err as Error & { code?: string; statusCode?: number };
    
    if (error.code === 'SecretNotFound' || error.statusCode === 404) {
      return { valid: false, credentialType: 'secret', message: `Secret '${config.secretName}' not found in Key Vault` };
    }
    if (error.code === 'Forbidden' || error.statusCode === 403) {
      return { valid: false, credentialType: 'secret', message: 'Access denied. Ensure you have Key Vault Secrets User role.' };
    }
    
    return { valid: false, credentialType: 'secret', message: error.message };
  }
}
