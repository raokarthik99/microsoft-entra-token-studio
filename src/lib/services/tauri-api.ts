/**
 * Tauri API Client
 * 
 * Provides runtime-aware API methods that use Tauri IPC commands
 * when in desktop mode, or HTTP fetch when in web mode.
 */

import { isTauriMode as isTauriRuntime } from '$lib/utils/runtime';
import type { KeyVaultConfig } from '$lib/types';

// Types for token responses
interface TokenResponse {
  accessToken: string;
  expiresOn?: string;
  tokenType: string;
  scope?: string;
  scopes?: string[];
  authMethod?: string;
  authSource?: string;
  account?: {
    homeAccountId?: string;
    environment?: string;
    tenantId?: string;
    username?: string;
    name?: string;
  } | null;
}

interface TokenAppConfig {
  clientId: string;
  tenantId: string;
  keyVault: KeyVaultConfig;
}

interface ValidationResult {
  valid: boolean;
  credentialType: 'certificate' | 'secret';
  message?: string;
}

interface CredentialStatus {
  available: boolean;
  message: string;
}

interface AuthStorageStatus {
  encrypted: boolean;
  cacheDir: string;
  keySource: 'keyring' | 'file' | 'none' | 'unknown';
}

interface AzureCliResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SidecarHealth {
  running: boolean;
  error: string | null;
}

interface AzureSubscription {
  id: string;
  name: string;
  tenantId: string;
  isDefault?: boolean;
  state?: string;
}

interface AzureAppRegistration {
  appId: string;
  displayName: string;
}

interface AzureKeyVault {
  name: string;
  uri: string;
  location?: string;
  resourceGroup?: string;
}

interface AzureVaultCredential {
  name: string;
  enabled?: boolean;
  expires?: string | null;
}

/**
 * Dynamically import Tauri invoke function only when in Tauri environment
 */
async function getTauriInvoke() {
  if (!isTauriRuntime()) {
    throw new Error('Not running in Tauri environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

/**
 * Acquire an app token using client credentials flow.
 * In web mode this calls `/api/token/app`; in Tauri mode this uses the sidecar.
 */
export async function acquireAppToken(
  config: TokenAppConfig,
  resource: string
): Promise<TokenResponse> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    const normalized = resource.trim().replace(/\/+$/, '');
    const scope = normalized.endsWith('/.default') ? normalized : `${normalized}/.default`;
    return invoke('acquire_app_token', { config, scopes: [scope] });
  }

  // Web mode: use HTTP API
  const response = await fetch('/api/token/app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appConfig: config,
      resource,
    }),
  });

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      // ignore
    }
    const message = payload?.details ? `${payload.error}: ${payload.details}` : payload?.error || 'Failed to acquire token';
    const error = new Error(message) as Error & { code?: string; details?: unknown; setupRequired?: boolean };
    error.code = payload?.code;
    error.details = payload?.details;
    error.setupRequired = payload?.setupRequired;
    throw error;
  }

  return response.json();
}

/**
 * Validate Key Vault connectivity and credentials
 */
export async function validateKeyVault(config: KeyVaultConfig): Promise<ValidationResult> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('validate_keyvault', { config });
  }

  // Web mode: use HTTP API
  const response = await fetch('/api/apps/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyVault: config }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    return {
      valid: false,
      credentialType: config.credentialType,
      message: result.error || 'Validation failed',
    };
  }

  return {
    valid: Boolean(result.valid),
    credentialType: config.credentialType,
    message: result.error || result.message,
  };
}

/**
 * Check if Azure credentials are available
 */
export async function getCredentialStatus(): Promise<CredentialStatus> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('get_credential_status');
  }

  // Web mode: check via health endpoint
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      return { available: true, message: 'Azure credentials available' };
    }
    return { available: false, message: 'Health check failed' };
  } catch {
    return { available: false, message: 'Unable to check credential status' };
  }
}

export async function listAzureSubscriptions(): Promise<AzureCliResult<AzureSubscription[]>> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('list_azure_subscriptions');
  }

  const response = await fetch('/api/azure-cli/subscriptions');
  return response.json();
}

/**
 * Check sidecar health status
 * Returns whether the sidecar is running and any startup error
 */
export async function checkSidecarHealth(): Promise<SidecarHealth> {
  if (!isTauriRuntime()) {
    // In web mode, there's no sidecar - return healthy
    return { running: true, error: null };
  }

  const invoke = await getTauriInvoke();
  return invoke('check_sidecar_health');
}


export async function exitApp(): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('Not running in Tauri environment');
  }
  const invoke = await getTauriInvoke();
  await invoke('exit_app');
}

export async function listAzureApps(search?: string): Promise<AzureCliResult<AzureAppRegistration[]>> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('list_azure_apps', { search });
  }

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const response = await fetch(`/api/azure-cli/apps?${params.toString()}`);
  return response.json();
}

export async function listKeyVaults(subscriptionId?: string): Promise<AzureCliResult<AzureKeyVault[]>> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('list_keyvaults', { subscriptionId });
  }

  const params = new URLSearchParams();
  if (subscriptionId) params.set('subscriptionId', subscriptionId);
  const response = await fetch(`/api/azure-cli/keyvaults?${params.toString()}`);
  return response.json();
}

export async function listKeyVaultSecrets(
  vaultName: string,
  subscriptionId?: string
): Promise<AzureCliResult<AzureVaultCredential[]>> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('list_keyvault_secrets', { vaultName, subscriptionId });
  }

  const params = new URLSearchParams({ vaultName });
  if (subscriptionId) params.set('subscriptionId', subscriptionId);
  const response = await fetch(`/api/azure-cli/keyvaults/secrets?${params.toString()}`);
  return response.json();
}

export async function listKeyVaultCertificates(
  vaultName: string,
  subscriptionId?: string
): Promise<AzureCliResult<AzureVaultCredential[]>> {
  if (isTauriRuntime()) {
    const invoke = await getTauriInvoke();
    return invoke('list_keyvault_certificates', { vaultName, subscriptionId });
  }

  const params = new URLSearchParams({ vaultName });
  if (subscriptionId) params.set('subscriptionId', subscriptionId);
  const response = await fetch(`/api/azure-cli/keyvaults/certificates?${params.toString()}`);
  return response.json();
}

/**
 * Acquire a user token (delegated permissions) in Tauri mode.
 * Opens the system browser for authentication.
 * 
 * NOTE: This only works in Tauri mode. Web mode uses msal-browser directly.
 */
export async function acquireUserToken(
  clientId: string,
  tenantId: string,
  scopes: string[],
  prompt?: 'select_account' | 'login' | 'consent',
  accountHomeAccountId?: string,
  silentOnly?: boolean
): Promise<TokenResponse> {
  if (!isTauriRuntime()) {
    throw new Error('acquireUserToken is only available in Tauri mode. Use AuthService for web.');
  }

  const invoke = await getTauriInvoke();
  return invoke('acquire_user_token', {
    clientId,
    tenantId,
    scopes,
    prompt,
    accountHomeAccountId,
    silentOnly,
  });
}

/**
 * Get cached user accounts for a given client.
 * Used to restore signed-in state on app restart.
 */
export async function getUserAccounts(
  clientId: string,
  tenantId: string,
): Promise<NonNullable<TokenResponse['account']>[]> {
  if (!isTauriRuntime()) {
    throw new Error('getUserAccounts is only available in Tauri mode.');
  }

  const invoke = await getTauriInvoke();
  return invoke('get_user_accounts', { clientId, tenantId });
}

/**
 * Clear cached user tokens/accounts for a client (logout).
 */
export async function clearUserCache(clientId: string, tenantId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  const invoke = await getTauriInvoke();
  await invoke('clear_user_cache', { clientId, tenantId });
}

export async function getAuthStorageStatus(): Promise<AuthStorageStatus> {
  if (!isTauriRuntime()) {
    throw new Error('getAuthStorageStatus is only available in Tauri mode.');
  }
  const invoke = await getTauriInvoke();
  return invoke('get_auth_storage_status');
}

/**
 * Check if running in Tauri mode (for conditional auth logic)
 */
export function isTauriMode(): boolean {
  return isTauriRuntime();
}
