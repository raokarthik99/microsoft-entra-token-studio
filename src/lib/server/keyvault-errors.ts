/**
 * Key Vault Error Types
 *
 * Structured error types for Key Vault operations that provide
 * user-friendly messages, actionable guidance, and Azure Portal deep links.
 */

/**
 * Error codes for Key Vault operations
 */
export type KeyVaultErrorCode =
  | 'ACCESS_DENIED'
  | 'CERT_EXPIRED'
  | 'CERT_EXPIRING_SOON'
  | 'SECRET_EXPIRED'
  | 'SECRET_EXPIRING_SOON'
  | 'CERT_NOT_FOUND'
  | 'SECRET_NOT_FOUND'
  | 'CREDENTIAL_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'SIGNING_FAILED'
  | 'UNKNOWN';

/**
 * Severity levels for Key Vault errors
 */
export type KeyVaultErrorSeverity = 'error' | 'warning';

/**
 * Additional context for Key Vault errors
 */
export interface KeyVaultErrorContext {
  vaultUri?: string;
  resourceName?: string;
  expiryDate?: Date;
  daysUntilExpiry?: number;
}

/**
 * Structured error for Key Vault operations
 */
export class KeyVaultError extends Error {
  readonly code: KeyVaultErrorCode;
  readonly action: string;
  readonly actionUrl?: string;
  readonly actionLabel?: string;
  readonly detail?: string;
  readonly severity: KeyVaultErrorSeverity;
  readonly context?: KeyVaultErrorContext;

  constructor(options: {
    code: KeyVaultErrorCode;
    message: string;
    action: string;
    actionUrl?: string;
    actionLabel?: string;
    detail?: string;
    severity?: KeyVaultErrorSeverity;
    context?: KeyVaultErrorContext;
  }) {
    super(options.message);
    this.name = 'KeyVaultError';
    this.code = options.code;
    this.action = options.action;
    this.actionUrl = options.actionUrl;
    this.actionLabel = options.actionLabel;
    this.detail = options.detail;
    this.severity = options.severity ?? 'error';
    this.context = options.context;
  }

  /**
   * Serialize error for API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      action: this.action,
      actionUrl: this.actionUrl,
      actionLabel: this.actionLabel,
      detail: this.detail,
      severity: this.severity,
      context: this.context,
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Generate Azure Portal URL for Key Vault
 */
function getKeyVaultPortalUrl(vaultUri?: string): string | undefined {
  if (!vaultUri) return undefined;
  try {
    const vaultName = new URL(vaultUri).hostname.split('.')[0];
    return `https://portal.azure.com/#view/Microsoft_Azure_KeyVault/VaultMenuBlade/~/overview/vaultUri/${encodeURIComponent(vaultUri)}`;
  } catch {
    return undefined;
  }
}

/**
 * Generate Azure Portal URL for a specific certificate
 */
function getCertificatePortalUrl(vaultUri?: string, certName?: string): string | undefined {
  if (!vaultUri || !certName) return undefined;
  try {
    const vaultName = new URL(vaultUri).hostname.split('.')[0];
    return `https://portal.azure.com/#view/Microsoft_Azure_KeyVault/CertificateMenuBlade/~/overview/vaultUri/${encodeURIComponent(vaultUri)}/certificateName/${encodeURIComponent(certName)}`;
  } catch {
    return undefined;
  }
}

/**
 * Generate Azure Portal URL for a specific secret
 */
function getSecretPortalUrl(vaultUri?: string, secretName?: string): string | undefined {
  if (!vaultUri || !secretName) return undefined;
  try {
    return `https://portal.azure.com/#view/Microsoft_Azure_KeyVault/SecretMenuBlade/~/overview/vaultUri/${encodeURIComponent(vaultUri)}/secretName/${encodeURIComponent(secretName)}`;
  } catch {
    return undefined;
  }
}

/**
 * Create an "access denied" error
 */
export function createAccessDeniedError(
  resourceType: 'certificate' | 'secret',
  resourceName: string,
  vaultUri?: string
): KeyVaultError {
  const requiredRoles =
    resourceType === 'certificate'
      ? "'Key Vault Crypto User' and 'Key Vault Certificates User'"
      : "'Key Vault Secrets User'";

  return new KeyVaultError({
    code: 'ACCESS_DENIED',
    message: `Access denied to Key Vault ${resourceType} '${resourceName}'.`,
    action: `Verify you have the ${requiredRoles} role(s) assigned. If using PIM (Privileged Identity Management), ensure your elevated access is active.`,
    actionUrl: getKeyVaultPortalUrl(vaultUri),
    actionLabel: 'Open Key Vault in Azure Portal',
    detail: `HTTP 403 Forbidden. Your Azure identity does not have permission to access this ${resourceType}.`,
    severity: 'error',
    context: { vaultUri, resourceName },
  });
}

/**
 * Create a "certificate expired" error
 */
export function createCertExpiredError(
  certName: string,
  expiryDate: Date,
  vaultUri?: string
): KeyVaultError {
  return new KeyVaultError({
    code: 'CERT_EXPIRED',
    message: `Certificate '${certName}' expired on ${expiryDate.toLocaleDateString()}.`,
    action:
      'Rotate the certificate in Key Vault and update your Entra app registration with the new certificate. Consider enabling auto-rotation.',
    actionUrl: getCertificatePortalUrl(vaultUri, certName),
    actionLabel: 'Open Certificate in Azure Portal',
    detail: `The certificate has expired and cannot be used for authentication. You must upload a new certificate or rotate the existing one.`,
    severity: 'error',
    context: { vaultUri, resourceName: certName, expiryDate },
  });
}

/**
 * Create a "certificate expiring soon" warning
 */
export function createCertExpiringSoonWarning(
  certName: string,
  expiryDate: Date,
  daysUntilExpiry: number,
  vaultUri?: string
): KeyVaultError {
  return new KeyVaultError({
    code: 'CERT_EXPIRING_SOON',
    message: `Certificate '${certName}' expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} (${expiryDate.toLocaleDateString()}).`,
    action:
      'Plan to rotate this certificate soon to avoid authentication failures. Consider enabling Key Vault auto-rotation.',
    actionUrl: getCertificatePortalUrl(vaultUri, certName),
    actionLabel: 'Manage Certificate',
    severity: 'warning',
    context: { vaultUri, resourceName: certName, expiryDate, daysUntilExpiry },
  });
}

/**
 * Create a "secret expired" error
 */
export function createSecretExpiredError(
  secretName: string,
  expiryDate: Date,
  vaultUri?: string
): KeyVaultError {
  return new KeyVaultError({
    code: 'SECRET_EXPIRED',
    message: `Client secret '${secretName}' expired on ${expiryDate.toLocaleDateString()}.`,
    action:
      'Create a new client secret in your Entra app registration, store it in Key Vault, and update your application configuration.',
    actionUrl: getSecretPortalUrl(vaultUri, secretName),
    actionLabel: 'Open Secret in Azure Portal',
    detail: `The client secret has expired and cannot be used for authentication.`,
    severity: 'error',
    context: { vaultUri, resourceName: secretName, expiryDate },
  });
}

/**
 * Create a "secret expiring soon" warning
 */
export function createSecretExpiringSoonWarning(
  secretName: string,
  expiryDate: Date,
  daysUntilExpiry: number,
  vaultUri?: string
): KeyVaultError {
  return new KeyVaultError({
    code: 'SECRET_EXPIRING_SOON',
    message: `Client secret '${secretName}' expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} (${expiryDate.toLocaleDateString()}).`,
    action:
      'Plan to rotate this secret soon to avoid authentication failures.',
    actionUrl: getSecretPortalUrl(vaultUri, secretName),
    actionLabel: 'Manage Secret',
    severity: 'warning',
    context: { vaultUri, resourceName: secretName, expiryDate, daysUntilExpiry },
  });
}

/**
 * Create a "not found" error
 */
export function createNotFoundError(
  resourceType: 'certificate' | 'secret',
  resourceName: string,
  vaultUri?: string
): KeyVaultError {
  const code = resourceType === 'certificate' ? 'CERT_NOT_FOUND' : 'SECRET_NOT_FOUND';

  return new KeyVaultError({
    code,
    message: `${resourceType === 'certificate' ? 'Certificate' : 'Secret'} '${resourceName}' not found in Key Vault.`,
    action: `Verify the ${resourceType} name is correct and exists in the Key Vault. Check for typos and ensure the ${resourceType} hasn't been deleted.`,
    actionUrl: getKeyVaultPortalUrl(vaultUri),
    actionLabel: 'Open Key Vault in Azure Portal',
    detail: `HTTP 404 Not Found. The ${resourceType} may have been deleted, renamed, or never existed.`,
    severity: 'error',
    context: { vaultUri, resourceName },
  });
}

/**
 * Create a "credential unavailable" error
 */
export function createCredentialUnavailableError(): KeyVaultError {
  return new KeyVaultError({
    code: 'CREDENTIAL_UNAVAILABLE',
    message: 'Azure credentials not available.',
    action:
      'Run "az login" in your terminal to authenticate with Azure CLI, or ensure you have a valid Azure identity configured.',
    actionLabel: 'Learn about Azure Identity',
    actionUrl: 'https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli',
    detail:
      'DefaultAzureCredential could not find valid credentials. This typically means Azure CLI is not logged in or the session has expired.',
    severity: 'error',
  });
}

/**
 * Create a "network error"
 */
export function createNetworkError(vaultUri?: string, originalMessage?: string): KeyVaultError {
  return new KeyVaultError({
    code: 'NETWORK_ERROR',
    message: 'Unable to connect to Key Vault.',
    action:
      'Check your network connection. If the Key Vault uses Private Endpoints or IP firewall rules, ensure your network can reach it.',
    actionUrl: getKeyVaultPortalUrl(vaultUri),
    actionLabel: 'Check Key Vault Network Settings',
    detail: originalMessage || 'Network connection failed.',
    severity: 'error',
    context: { vaultUri },
  });
}

/**
 * Create a "signing failed" error
 */
export function createSigningFailedError(certName: string, vaultUri?: string): KeyVaultError {
  return new KeyVaultError({
    code: 'SIGNING_FAILED',
    message: `Failed to sign JWT assertion using certificate '${certName}'.`,
    action:
      "Verify the certificate's key type is RSA and you have 'Key Vault Crypto User' role for signing operations.",
    actionUrl: getCertificatePortalUrl(vaultUri, certName),
    actionLabel: 'Check Certificate',
    detail:
      'The Key Vault CryptographyClient signing operation returned no result. This may indicate a key type mismatch or insufficient permissions.',
    severity: 'error',
    context: { vaultUri, resourceName: certName },
  });
}

/**
 * Create an "unknown error" from an original error
 */
export function createUnknownError(
  err: any,
  resourceType: 'certificate' | 'secret',
  resourceName: string,
  vaultUri?: string
): KeyVaultError {
  return new KeyVaultError({
    code: 'UNKNOWN',
    message: err?.message || `Failed to access ${resourceType} '${resourceName}' in Key Vault.`,
    action:
      'Check the technical details below. If the issue persists, verify Key Vault configuration and your Azure identity permissions.',
    actionUrl: getKeyVaultPortalUrl(vaultUri),
    actionLabel: 'Open Key Vault in Azure Portal',
    detail: JSON.stringify(
      { code: err?.code, statusCode: err?.statusCode, message: err?.message },
      null,
      2
    ),
    severity: 'error',
    context: { vaultUri, resourceName },
  });
}

// ============================================================================
// Error Detection Utilities
// ============================================================================

/**
 * Check if an error is an access denied error
 */
export function isAccessDeniedError(err: any): boolean {
  return err?.code === 'Forbidden' || err?.statusCode === 403;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(err: any): boolean {
  return (
    err?.code === 'CertificateNotFound' ||
    err?.code === 'SecretNotFound' ||
    err?.statusCode === 404
  );
}

/**
 * Check if an error is a credential unavailable error
 */
export function isCredentialUnavailableError(err: any): boolean {
  return err?.code === 'CredentialUnavailableError' || err?.name === 'CredentialUnavailableError';
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(err: any): boolean {
  return (
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ETIMEDOUT' ||
    err?.message?.includes('isAxiosError is not a function') ||
    err?.message?.includes('getaddrinfo')
  );
}

/**
 * Calculate days until a date
 */
export function daysUntil(date: Date): number {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is expired
 */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Warning threshold for expiry (7 days)
 */
export const EXPIRY_WARNING_DAYS = 7;
