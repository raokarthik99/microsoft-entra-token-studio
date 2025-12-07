import { env } from '$env/dynamic/private';
import fs from 'fs/promises';
import { writeFileSync, unlinkSync } from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import forge from 'node-forge';

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

const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/;
const CERTIFICATE_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;
const PFX_BASE64_PATTERN = /^[a-z0-9+/=\r\n]+$/i;

const computeThumbprint = (certPem: string) => {
  const certBase64 = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '');

  const certBuffer = Buffer.from(certBase64, 'base64');
  const hash = crypto.createHash('sha1');
  hash.update(certBuffer);
  return hash.digest('hex').toUpperCase();
};

const decodePfxBuffer = (content: Buffer | string): Buffer => {
  if (Buffer.isBuffer(content)) {
    const text = content.toString('utf8').trim();
    if (PFX_BASE64_PATTERN.test(text)) {
      try {
        return Buffer.from(text, 'base64');
      } catch {
        // fall through
      }
    }
    return content;
  }

  return Buffer.from(content.trim(), 'base64');
};

/**
 * Convert PFX to PEM using OpenSSL CLI (handles modern AES-256-CBC encryption)
 * This is used as a fallback when node-forge fails with modern encryption.
 */
const convertPfxToPemViaOpenSSL = (pfx: Buffer, passphrase?: string): { privateKeyPem: string; certificatePem: string } => {
  const pass = passphrase ?? '';
  const tmpFile = join(tmpdir(), `cert-${crypto.randomBytes(8).toString('hex')}.pfx`);
  
  try {
    writeFileSync(tmpFile, pfx);
    
    // Extract private key (suppress stderr with 2>/dev/null)
    const keyCmd = `openssl pkcs12 -in "${tmpFile}" -nocerts -nodes -passin pass:'${pass}' 2>/dev/null`;
    const keyOutput = execSync(keyCmd, { encoding: 'utf8' });
    
    // Extract certificate
    const certCmd = `openssl pkcs12 -in "${tmpFile}" -clcerts -nokeys -passin pass:'${pass}' 2>/dev/null`;
    const certOutput = execSync(certCmd, { encoding: 'utf8' });
    
    // Extract PEM blocks from output
    const keyMatch = keyOutput.match(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/);
    const certMatch = certOutput.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    
    if (!keyMatch) {
      throw new Error('OpenSSL: No private key extracted from PFX');
    }
    if (!certMatch) {
      throw new Error('OpenSSL: No certificate extracted from PFX');
    }
    
    return { privateKeyPem: keyMatch[0], certificatePem: certMatch[0] };
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
};

const convertPfxToPem = (pfx: Buffer, passphrase?: string) => {
  // Try node-forge first (works for legacy encryption)
  try {
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase ?? '');

    let privateKeyPem: string | null = null;
    let certificatePem: string | null = null;

    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (!privateKeyPem && (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag)) {
          const key = safeBag.key;
          if (key) {
            privateKeyPem = forge.pki.privateKeyToPem(key);
          }
        }
        if (!certificatePem && safeBag.type === forge.pki.oids.certBag) {
          const cert = safeBag.cert;
          if (cert) {
            certificatePem = forge.pki.certificateToPem(cert);
          }
        }
      }
    }

    if (!privateKeyPem) {
      throw new Error('No private key found in PFX. Ensure the certificate includes the private key and any passphrase is correct.');
    }

    if (!certificatePem) {
      throw new Error('No certificate found in PFX. Ensure the PFX contains the full certificate chain.');
    }

    return { privateKeyPem, certificatePem };
  } catch (forgeError: any) {
    // If node-forge fails with MAC verification error (modern encryption), try OpenSSL
    if (forgeError.message?.includes('MAC could not be verified') || 
        forgeError.message?.includes('PKCS#12')) {
      return convertPfxToPemViaOpenSSL(pfx, passphrase);
    }
    throw forgeError;
  }
};

export const parseCertificateContent = (
  content: Buffer | string,
  source: string,
  passphrase?: string,
): { privateKey: string; certificate: string; thumbprint: string } => {
  const textContent = Buffer.isBuffer(content) ? content.toString('utf8') : content;

  if (PRIVATE_KEY_PATTERN.test(textContent)) {
    const certMatch = textContent.match(CERTIFICATE_PATTERN);

    if (!certMatch) {
      throw new Error(`${source} is missing a CERTIFICATE block. Include the certificate alongside the private key so the thumbprint can be calculated.`);
    }

    const certificate = certMatch[0];
    return {
      privateKey: textContent,
      certificate,
      thumbprint: computeThumbprint(certificate),
    };
  }

  if (CERTIFICATE_PATTERN.test(textContent)) {
    throw new Error(`${source} includes a certificate but no private key. Provide a PEM/PFX that contains the private key.`);
  }

  try {
    const pfxBuffer = decodePfxBuffer(content);
    const { privateKeyPem, certificatePem } = convertPfxToPem(pfxBuffer, passphrase);

    return {
      privateKey: privateKeyPem,
      certificate: certificatePem,
      thumbprint: computeThumbprint(certificatePem),
    };
  } catch (err: any) {
    const hint = passphrase 
      ? ' Check that CERTIFICATE_PFX_PASSPHRASE is correct.' 
      : ' If the PFX is protected, set CERTIFICATE_PFX_PASSPHRASE. Ensure OpenSSL is available for modern PKCS#12 encryption.';
    throw new Error(`Unable to parse certificate as PEM or PFX from ${source}: ${err.message || err}${hint}`);
  }
};

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
    const fileContent = await fs.readFile(certPath);
    const { privateKey, thumbprint } = parseCertificateContent(
      fileContent,
      `CERTIFICATE_PATH (${certPath})`,
      env.CERTIFICATE_PFX_PASSPHRASE,
    );

    cachedCredential = { thumbprint, privateKey };
    credentialFetched = true;
    cachedError = null;
    
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
