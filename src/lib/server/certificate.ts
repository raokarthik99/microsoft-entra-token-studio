import { env } from '$env/dynamic/private';
import fs from 'fs/promises';
import crypto from 'crypto';

export interface LocalCertificateCredential {
  thumbprint: string;
  privateKey: string;
}

export interface LocalCertificateStatus {
  configured: boolean;
  path: string | null;
  status: 'loaded' | 'error' | 'not_configured';
  error?: string;
}

/**
 * Check if local certificate auth is configured
 */
export function isLocalCertificateConfigured(): boolean {
  return Boolean(env.CERTIFICATE_PATH);
}

// Cached credential
let cachedCredential: LocalCertificateCredential | null = null;
let cachedError: string | null = null;
let credentialFetched = false;

/**
 * Load certificate from local file system
 */
export async function loadLocalCertificate(): Promise<LocalCertificateCredential> {
  // Return cached result if available
  if (credentialFetched) {
    if (cachedError) {
      throw new Error(cachedError);
    }
    if (cachedCredential) {
      return cachedCredential;
    }
  }

  const certPath = env.CERTIFICATE_PATH;

  if (!certPath) {
    cachedError = 'CERTIFICATE_PATH is not set.';
    credentialFetched = true;
    throw new Error(cachedError);
  }

  try {
    // Read file content
    const fileContent = await fs.readFile(certPath, 'utf8');
    
    // Extract private key
    // This assumes the file contains the private key (PEM format)
    // If it's a PFX, we might need more complex parsing, but for now assuming PEM
    // which is standard for Node.js/MSAL
    const privateKey = fileContent;
    
    // Calculate thumbprint
    // For a proper thumbprint calculation we'd need to parse the X.509 cert
    // Since we don't want to add heavy crypto dependencies just for this,
    // we'll try to extract it if it's in the file comments or metadata,
    // otherwise we might need to use a library like 'crypto' to hash the DER
    
    // Simple approach: Create a hash of the certificate content
    // Note: In a real scenario, we should parse the cert to get the actual thumbprint
    // expected by Entra ID. For now, we'll try to extract the certificate part and hash it.
    
    let thumbprint = '';
    
    // Try to extract the certificate block
    const certMatch = fileContent.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    
    if (certMatch) {
      const certPem = certMatch[0];
      // Remove headers and newlines to get base64
      const certBase64 = certPem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\s/g, '');
      
      const certBuffer = Buffer.from(certBase64, 'base64');
      const hash = crypto.createHash('sha1');
      hash.update(certBuffer);
      thumbprint = hash.digest('hex').toUpperCase();
    } else {
      throw new Error('Could not find CERTIFICATE block in the file. Ensure it is a valid PEM file containing the certificate.');
    }

    cachedCredential = { thumbprint, privateKey };
    credentialFetched = true;
    cachedError = null;

    console.log(`[LocalCert] Successfully loaded certificate from '${certPath}' with thumbprint ${thumbprint.substring(0, 8)}...`);
    
    return cachedCredential;
  } catch (err: any) {
    const message = err.message || `Failed to load certificate from ${certPath}`;
    cachedError = message;
    credentialFetched = true;
    console.error(`[LocalCert] Error: ${message}`);
    throw new Error(message);
  }
}

/**
 * Get status of local certificate configuration
 */
export async function getLocalCertificateStatus(): Promise<LocalCertificateStatus> {
  if (!isLocalCertificateConfigured()) {
    return {
      configured: false,
      path: null,
      status: 'not_configured'
    };
  }

  try {
    await loadLocalCertificate();
    return {
      configured: true,
      path: env.CERTIFICATE_PATH || null,
      status: 'loaded'
    };
  } catch (err: any) {
    return {
      configured: true,
      path: env.CERTIFICATE_PATH || null,
      status: 'error',
      error: err.message
    };
  }
}

/**
 * Clear cache (for testing/reload)
 */
export function clearLocalCertificateCache(): void {
  cachedCredential = null;
  cachedError = null;
  credentialFetched = false;
}
