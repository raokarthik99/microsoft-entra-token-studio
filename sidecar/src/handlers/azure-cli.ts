/**
 * Azure CLI Discovery Handler
 *
 * Discovers Azure apps, subscriptions, and Key Vault resources via Azure CLI.
 * Requires `az login` to be completed on the host machine.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AZ_TIMEOUT_MS = 30_000;
const AZ_MAX_BUFFER = 10 * 1024 * 1024;

// On Windows, Azure CLI is installed as az.cmd which requires shell: true
const IS_WINDOWS = process.platform === 'win32';

export interface AzureCliResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AzureAppFilters {
  search?: string;
  appId?: string;
  displayName?: string;
  identifierUri?: string;
  filter?: string;
  showMine?: boolean;
  all?: boolean;
}

function formatAzureCliError(err: unknown): string {
  const error = err as NodeJS.ErrnoException & { stderr?: string };
  const message = error.message || '';

  if (error.code === 'ENOENT' || message.includes('not found')) {
    return 'Azure CLI not installed. Install from https://aka.ms/installazurecli';
  }
  if (message.includes('az login') || message.includes('login to access')) {
    return 'Azure CLI not logged in. Run "az login" first.';
  }
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return 'Azure CLI request timed out. Check your network connection.';
  }

  return error.stderr?.trim() || message || 'Azure CLI request failed';
}

async function runAzJson<T>(args: string[]): Promise<AzureCliResult<T>> {
  try {
    // On Windows, Azure CLI is installed as az.cmd which requires cmd.exe to execute
    const command = IS_WINDOWS ? 'cmd.exe' : 'az';
    const commandArgs = IS_WINDOWS ? ['/c', 'az', ...args] : args;

    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      timeout: AZ_TIMEOUT_MS,
      maxBuffer: AZ_MAX_BUFFER,
    });

    if (stderr && !stdout) {
      return { success: false, error: stderr.trim() };
    }

    const data = JSON.parse(stdout) as T;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: formatAzureCliError(err) };
  }
}

function escapeOdataValue(value: string): string {
  return value.replace(/'/g, "''");
}

export async function handleListSubscriptions(): Promise<AzureCliResult<unknown>> {
  return runAzJson([
    'account',
    'list',
    '--query',
    '[].{id:id,name:name,tenantId:tenantId,isDefault:isDefault,state:state}',
    '-o',
    'json',
  ]);
}

export async function handleListAppRegistrations(
  params?: AzureAppFilters
): Promise<AzureCliResult<unknown>> {
  const args = ['ad', 'app', 'list'];
  const appId = params?.appId?.trim();
  if (appId) {
    args.push('--app-id', appId);
  }
  const displayName = params?.displayName?.trim();
  if (displayName) {
    args.push('--display-name', displayName);
  }
  const identifierUri = params?.identifierUri?.trim();
  if (identifierUri) {
    args.push('--identifier-uri', identifierUri);
  }
  const filter = params?.filter?.trim();
  const search = params?.search?.trim();
  if (filter) {
    args.push('--filter', filter);
  } else if (search) {
    const safe = escapeOdataValue(search);
    args.push('--filter', `startswith(displayName,'${safe}')`);
  }
  if (params?.showMine) {
    args.push('--show-mine');
  }
  if (params?.all) {
    args.push('--all');
  }
  args.push('--query', '[].{appId:appId,displayName:displayName}');
  args.push('-o', 'json');
  return runAzJson(args);
}

export async function handleListKeyVaults(params?: { subscriptionId?: string }): Promise<AzureCliResult<unknown>> {
  const args = [
    'keyvault',
    'list',
    '--query',
    '[].{name:name,uri:properties.vaultUri,location:location,resourceGroup:resourceGroup}',
    '-o',
    'json',
  ];
  if (params?.subscriptionId) {
    args.push('--subscription', params.subscriptionId);
  }
  return runAzJson(args);
}

export async function handleListSecrets(params: { vaultName?: string; subscriptionId?: string }): Promise<AzureCliResult<unknown>> {
  if (!params?.vaultName) {
    return { success: false, error: 'vaultName is required' };
  }
  const args = [
    'keyvault',
    'secret',
    'list',
    '--vault-name',
    params.vaultName,
    '--query',
    '[].{name:name,enabled:attributes.enabled,expires:attributes.expires}',
    '-o',
    'json',
  ];
  if (params.subscriptionId) {
    args.push('--subscription', params.subscriptionId);
  }
  return runAzJson(args);
}

export async function handleListCertificates(params: { vaultName?: string; subscriptionId?: string }): Promise<AzureCliResult<unknown>> {
  if (!params?.vaultName) {
    return { success: false, error: 'vaultName is required' };
  }
  const args = [
    'keyvault',
    'certificate',
    'list',
    '--vault-name',
    params.vaultName,
    '--query',
    '[].{name:name,enabled:attributes.enabled,expires:attributes.expires}',
    '-o',
    'json',
  ];
  if (params.subscriptionId) {
    args.push('--subscription', params.subscriptionId);
  }
  return runAzJson(args);
}
