import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AZ_TIMEOUT_MS = 30_000;
const AZ_MAX_BUFFER = 10 * 1024 * 1024;
const IS_WINDOWS = process.platform === 'win32';
const WINDOWS_AZ_EXTS = ['.exe', '.cmd', '.bat', '.com'];
const CMD_QUOTE_PATTERN = /[ \t&()^|<>]/;

const COMMON_CLI_PATHS: Record<NodeJS.Platform, string[]> = {
  darwin: ['/opt/homebrew/bin', '/usr/local/bin', '/usr/local/sbin'],
  linux: ['/usr/local/bin', '/usr/bin', '/bin'],
  win32: [
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin',
    'C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin',
  ],
  aix: [],
  cygwin: [],
  freebsd: [],
  haiku: [],
  netbsd: [],
  openbsd: [],
  sunos: [],
  android: [],
};

export interface AzureCliResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AzureSubscription {
  id: string;
  name: string;
  tenantId: string;
  isDefault?: boolean;
  state?: string;
}

export interface AzureAppRegistration {
  appId: string;
  displayName: string;
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

export interface AzureKeyVault {
  name: string;
  uri: string;
  location?: string;
  resourceGroup?: string;
}

export interface AzureVaultCredential {
  name: string;
  enabled?: boolean;
  expires?: string | null;
}

function ensureCliPaths() {
  if (!IS_WINDOWS) return;
  const extraPaths = COMMON_CLI_PATHS[process.platform] ?? [];
  if (extraPaths.length === 0) return;
  const currentPath = process.env.PATH ?? '';
  const parts = currentPath.split(path.delimiter).filter(Boolean);
  const additions = extraPaths.filter((entry) => !parts.includes(entry));
  if (additions.length === 0) return;
  process.env.PATH = [...additions, ...parts].join(path.delimiter);
}

function findAzPath(): string | null {
  const searchPaths = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  if (searchPaths.length === 0) return null;
  const extensions = IS_WINDOWS ? WINDOWS_AZ_EXTS : [''];
  for (const ext of extensions) {
    for (const dir of searchPaths) {
      const candidate = IS_WINDOWS ? path.join(dir, `az${ext}`) : path.join(dir, 'az');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findCliPythonFromAz(azPath: string): string | null {
  const candidates = [
    path.resolve(path.dirname(azPath), '..', 'python.exe'),
    path.resolve(path.dirname(azPath), '..', '..', 'python.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function escapeCmdArg(value: string): string {
  let escaped = value
    .replace(/\^/g, '^^')
    .replace(/"/g, '""')
    .replace(/%/g, '^%')
    .replace(/!/g, '^!');
  if (CMD_QUOTE_PATTERN.test(escaped)) {
    escaped = `"${escaped}"`;
  }
  return escaped;
}

function buildCmdCommandLine(exe: string, args: string[]): string {
  const parts = [escapeCmdArg(exe), ...args.map(escapeCmdArg)];
  return `"${parts.join(' ')}"`;
}

function resolveAzCommand(args: string[]): { command: string; args: string[] } {
  if (!IS_WINDOWS) {
    return { command: 'az', args };
  }
  ensureCliPaths();
  const azPath = findAzPath();
  if (!azPath) {
    return { command: 'az', args };
  }
  const ext = path.extname(azPath).toLowerCase();
  if (ext === '.exe' || ext === '.com') {
    return { command: azPath, args };
  }
  if (ext === '.cmd' || ext === '.bat') {
    const pythonPath = findCliPythonFromAz(azPath);
    if (pythonPath) {
      return { command: pythonPath, args: ['-m', 'azure.cli', ...args] };
    }
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', buildCmdCommandLine(azPath, args)],
    };
  }
  return { command: azPath, args };
}

async function runAzJson<T>(args: string[]): Promise<AzureCliResult<T>> {
  try {
    const { command, args: commandArgs } = resolveAzCommand(args);
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

function escapeOdataValue(value: string): string {
  return value.replace(/'/g, "''");
}

export async function listAzureSubscriptions(): Promise<AzureCliResult<AzureSubscription[]>> {
  return runAzJson<AzureSubscription[]>([
    'account',
    'list',
    '--query',
    '[].{id:id,name:name,tenantId:tenantId,isDefault:isDefault,state:state}',
    '-o',
    'json',
  ]);
}

export async function listAzureApps(filters?: AzureAppFilters): Promise<AzureCliResult<AzureAppRegistration[]>> {
  const args = ['ad', 'app', 'list'];
  const appId = filters?.appId?.trim();
  if (appId) {
    args.push('--app-id', appId);
  }
  const displayName = filters?.displayName?.trim();
  if (displayName) {
    args.push('--display-name', displayName);
  }
  const identifierUri = filters?.identifierUri?.trim();
  if (identifierUri) {
    args.push('--identifier-uri', identifierUri);
  }
  const filter = filters?.filter?.trim();
  const search = filters?.search?.trim();
  if (filter) {
    args.push('--filter', filter);
  } else if (search) {
    const safe = escapeOdataValue(search);
    args.push('--filter', `startswith(displayName,'${safe}')`);
  }
  if (filters?.showMine) {
    args.push('--show-mine');
  }
  if (filters?.all) {
    args.push('--all');
  }
  args.push('--query', "[].{appId:appId,displayName:displayName}");
  args.push('-o', 'json');
  return runAzJson<AzureAppRegistration[]>(args);
}

export async function listKeyVaults(subscriptionId?: string): Promise<AzureCliResult<AzureKeyVault[]>> {
  const args = [
    'keyvault',
    'list',
    '--query',
    '[].{name:name,uri:properties.vaultUri,location:location,resourceGroup:resourceGroup}',
    '-o',
    'json',
  ];

  if (subscriptionId) {
    args.push('--subscription', subscriptionId);
  }

  return runAzJson<AzureKeyVault[]>(args);
}

export async function listKeyVaultSecrets(
  vaultName: string,
  subscriptionId?: string
): Promise<AzureCliResult<AzureVaultCredential[]>> {
  const args = [
    'keyvault',
    'secret',
    'list',
    '--vault-name',
    vaultName,
    '--query',
    '[].{name:name,enabled:attributes.enabled,expires:attributes.expires}',
    '-o',
    'json',
  ];

  if (subscriptionId) {
    args.push('--subscription', subscriptionId);
  }

  return runAzJson<AzureVaultCredential[]>(args);
}

export async function listKeyVaultCertificates(
  vaultName: string,
  subscriptionId?: string
): Promise<AzureCliResult<AzureVaultCredential[]>> {
  const args = [
    'keyvault',
    'certificate',
    'list',
    '--vault-name',
    vaultName,
    '--query',
    '[].{name:name,enabled:attributes.enabled,expires:attributes.expires}',
    '-o',
    'json',
  ];

  if (subscriptionId) {
    args.push('--subscription', subscriptionId);
  }

  return runAzJson<AzureVaultCredential[]>(args);
}
