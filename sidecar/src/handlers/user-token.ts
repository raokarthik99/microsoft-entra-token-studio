/**
 * User Token Handler
 * 
 * Acquires user tokens (delegated permissions) using msal-node with system browser.
 * Uses dynamic port allocation - Microsoft recommends `http://localhost/auth/callback`
 * as the redirect URI (no port specified = any localhost port is accepted).
 */

import * as msal from '@azure/msal-node';
import http from 'http';
import type { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export interface UserTokenParams {
  clientId: string;
  tenantId: string;
  scopes: string[];
  prompt?: 'select_account' | 'login' | 'consent';
  accountHomeAccountId?: string;
  /** Only attempt silent token acquisition; do not open the browser. */
  silentOnly?: boolean;
}

export interface SerializedAccount {
  homeAccountId: string;
  environment?: string;
  tenantId?: string;
  username?: string;
  name?: string;
}

interface PcaState {
  pca: msal.PublicClientApplication;
  cacheFilePath: string;
}

// Cache of PCA instances per clientId+tenantId
const pcaCache = new Map<string, PcaState>();

function getPcaKey(clientId: string, tenantId: string): string {
  return `${clientId}:${tenantId}`.toLowerCase();
}

function getTokenCacheDir(): string {
  const envDir = process.env.ENTRA_TOKEN_STUDIO_DATA_DIR?.trim();
  if (envDir) return envDir;

  const appDirName = 'entra-token-studio';

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), appDirName);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appDirName);
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), appDirName);
}

type CacheMode = 'plain' | 'secure';

function getTokenCacheFilePath(clientId: string, tenantId: string, mode: CacheMode): string {
  const key = getPcaKey(clientId, tenantId);
  const fileId = crypto.createHash('sha256').update(key).digest('hex');
  const fileName = mode === 'secure' ? `msal-cache-${fileId}.enc.json` : `msal-cache-${fileId}.json`;
  return path.join(getTokenCacheDir(), fileName);
}

function getCacheKey(): Buffer | null {
  const raw = process.env.ENTRA_TOKEN_STUDIO_CACHE_KEY?.trim();
  if (!raw) return null;

  try {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) return null;
    return key;
  } catch {
    return null;
  }
}

type EncryptedCacheFileV1 = {
  v: 1;
  alg: 'A256GCM';
  iv: string;
  tag: string;
  data: string;
};

export interface AuthStorageStatus {
  encrypted: boolean;
  cacheDir: string;
  keySource: 'keyring' | 'file' | 'none' | 'unknown';
}

function encryptCache(plaintext: string, key: Buffer): EncryptedCacheFileV1 {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: 'A256GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decryptCache(file: EncryptedCacheFileV1, key: Buffer): string {
  const iv = Buffer.from(file.iv, 'base64');
  const tag = Buffer.from(file.tag, 'base64');
  const data = Buffer.from(file.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

function tryDecodeCacheFile(raw: string, key: Buffer | null): { serialized: string | null; shouldRewriteEncrypted: boolean; encryptedFile: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { serialized: null, shouldRewriteEncrypted: false, encryptedFile: false };
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<EncryptedCacheFileV1>;
    const looksEncrypted =
      parsed &&
      parsed.v === 1 &&
      parsed.alg === 'A256GCM' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.tag === 'string' &&
      typeof parsed.data === 'string';

    if (looksEncrypted) {
      if (!key) {
        // Key is temporarily unavailable (e.g. keychain locked/unavailable). Don't delete or overwrite the cache.
        return { serialized: null, shouldRewriteEncrypted: false, encryptedFile: true };
      }
      return { serialized: decryptCache(parsed as EncryptedCacheFileV1, key), shouldRewriteEncrypted: false, encryptedFile: true };
    }
  } catch {
    // Not JSON or not encrypted format -> treat as plaintext MSAL cache
  }

  return { serialized: raw, shouldRewriteEncrypted: Boolean(key), encryptedFile: false };
}

function createFileCachePlugin(options: {
  primaryPath: string;
  fallbackPath?: string;
  key: Buffer | null;
  encryptOnWrite: boolean;
}): msal.ICachePlugin {
  let pending: Promise<void> = Promise.resolve();
  const { primaryPath, fallbackPath, key, encryptOnWrite } = options;
  let needsRewrite = false;
  let needsFallbackCleanup = false;
  const plainFallbackToClean = encryptOnWrite ? fallbackPath : undefined;

  const runExclusive = async (task: () => Promise<void>) => {
    const previous = pending;
    let release: () => void;
    pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await task();
    } finally {
      release!();
    }
  };

  const readCacheFile = async (): Promise<string | null> => {
    try {
      const raw = await fs.readFile(primaryPath, 'utf-8');
      return raw || null;
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  };

  const readFallbackFile = async (): Promise<string | null> => {
    if (!fallbackPath) return null;
    try {
      const raw = await fs.readFile(fallbackPath, 'utf-8');
      return raw || null;
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  };

  const writeCacheFile = async (data: string): Promise<void> => {
    await fs.mkdir(path.dirname(primaryPath), { recursive: true });
    const tmpPath = `${primaryPath}.tmp`;
    await fs.writeFile(tmpPath, data, { mode: 0o600 });
    try {
      await fs.rename(tmpPath, primaryPath);
    } catch (err: any) {
      if (err?.code === 'EEXIST' || err?.code === 'EPERM') {
        await fs.rm(primaryPath, { force: true });
        await fs.rename(tmpPath, primaryPath);
        return;
      }
      throw err;
    }
  };

  return {
    beforeCacheAccess: async (cacheContext) => {
      await runExclusive(async () => {
        try {
          const primaryCache = await readCacheFile();
          const fallbackCache = primaryCache ? null : await readFallbackFile();
          const serializedCache = primaryCache ?? fallbackCache;
          if (!serializedCache) return;
          try {
            const decoded = tryDecodeCacheFile(serializedCache, key);
            if (decoded.serialized == null) return;
            cacheContext.tokenCache.deserialize(decoded.serialized);
            needsRewrite = Boolean(fallbackCache) || (encryptOnWrite && decoded.shouldRewriteEncrypted);
            if (encryptOnWrite && key && fallbackPath && primaryCache) {
              // If we successfully loaded an encrypted cache, remove any leftover plaintext fallback.
              try {
                await fs.stat(fallbackPath);
                needsFallbackCleanup = true;
              } catch (err: any) {
                if (err?.code !== 'ENOENT') throw err;
              }
            }
          } catch (err) {
            // Invalid cache, reset it
            await fs.rm(primaryPath, { force: true });
          }
        } catch (err) {
          // Failed to read cache
        }
      });
    },
    afterCacheAccess: async (cacheContext) => {
      await runExclusive(async () => {
        try {
          if (encryptOnWrite && !key) return;

          if (!cacheContext.cacheHasChanged && !needsRewrite && !needsFallbackCleanup) return;

          const shouldWrite = cacheContext.cacheHasChanged || needsRewrite;
          if (shouldWrite) {
            const serializedCache = cacheContext.tokenCache.serialize();
            const payload = encryptOnWrite && key ? JSON.stringify(encryptCache(serializedCache, key)) : serializedCache;
            await writeCacheFile(payload);
            needsRewrite = false;
          }

          if (plainFallbackToClean && (shouldWrite || needsFallbackCleanup)) {
            try {
              await fs.rm(plainFallbackToClean, { force: true });
            } catch {
              // Ignore cleanup errors
            }
            needsFallbackCleanup = false;
          }
        } catch (err) {
          // Failed to write cache
        }
      });
    },
  };
}

export async function getAuthStorageStatus(): Promise<AuthStorageStatus> {
  const rawKeySource = process.env.ENTRA_TOKEN_STUDIO_CACHE_KEY_SOURCE?.trim();
  const keySource =
    rawKeySource === 'keyring' || rawKeySource === 'file'
      ? rawKeySource
      : (getCacheKey() ? 'unknown' : 'none');
  return {
    encrypted: Boolean(getCacheKey()),
    cacheDir: getTokenCacheDir(),
    keySource,
  };
}

async function getPca(clientId: string, tenantId: string): Promise<PcaState> {
  const key = getPcaKey(clientId, tenantId);
  
  const existing = pcaCache.get(key);
  if (existing) return existing;

  const cacheKey = getCacheKey();
  const useSecureCache = Boolean(cacheKey);
  const cacheFilePath = getTokenCacheFilePath(clientId, tenantId, useSecureCache ? 'secure' : 'plain');
  const fallbackPath = getTokenCacheFilePath(clientId, tenantId, useSecureCache ? 'plain' : 'secure');
  const config: msal.Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: {
      cachePlugin: createFileCachePlugin({
        primaryPath: cacheFilePath,
        fallbackPath,
        key: cacheKey,
        encryptOnWrite: useSecureCache,
      }),
    },
  };

  const pca = new msal.PublicClientApplication(config);
  const state: PcaState = { pca, cacheFilePath };
  pcaCache.set(key, state);
  return state;
}

interface CallbackServerResult {
  server: http.Server;
  port: number;
  codePromise: Promise<string>;
}

const INTERACTIVE_BASE_SCOPES = ['openid', 'profile', 'offline_access'] as const;
const AUTH_CODE_TIMEOUT_MS = 120000;
const AUTH_CODE_TIMEOUT_MESSAGE =
  'Authentication timed out waiting for the browser to redirect. If you see AADSTS50011, add http://localhost to the app\'s Mobile/Desktop redirect URIs and try again.';

function uniqScopes(scopes: string[]): string[] {
  const seen = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (!trimmed) continue;
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
    }
  }
  return Array.from(seen);
}

function getInteractiveScopes(scopes: string[]): string[] {
  return uniqScopes([...INTERACTIVE_BASE_SCOPES, ...scopes]);
}

function isResourcePrefixedScope(scope: string): boolean {
  const trimmed = scope.trim();
  if (!trimmed) return false;
  // v2 endpoint does not allow mixing multiple resources in a single request.
  return trimmed.startsWith('api://') || trimmed.includes('://') || trimmed.includes('/');
}

function serializeAuthResult(tokenResult: msal.AuthenticationResult): msal.AuthenticationResult {
  const serialized = {
    accessToken: tokenResult.accessToken,
    tokenType: tokenResult.tokenType,
    expiresOn: tokenResult.expiresOn?.toISOString(),
    scopes: tokenResult.scopes,
    account: tokenResult.account
      ? {
          homeAccountId: tokenResult.account.homeAccountId,
          environment: tokenResult.account.environment,
          tenantId: tokenResult.account.tenantId,
          username: tokenResult.account.username,
          name: tokenResult.account.name,
        }
      : null,
  };

  return serialized as unknown as msal.AuthenticationResult;
}

/**
 * Start a temporary HTTP server on a dynamically allocated port
 * Port 0 = OS picks an available port
 */
function startCallbackServer(expectedState?: string): Promise<CallbackServerResult> {
  return new Promise((resolve, reject) => {
    let resolveCode: (code: string) => void;
    let rejectCode: (error: Error) => void;
    
    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = http.createServer((req, res) => {
      // Get the actual port from the server
      const address = server.address() as AddressInfo;
      const url = new URL(req.url || '', `http://localhost:${address.port}`);
      
      if (url.pathname === '/') {
        // Handle root path for Mobile/Desktop platform redirect
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // Branding constants
        const GITHUB_URL = 'https://github.com/raokarthik99/microsoft-entra-token-studio';
        const AUTHOR_URL = 'https://github.com/raokarthik99';
        
        // Simple Key Vault icon as inline SVG for the logo
                // Entra Token Studio Logo (Base64 PNG)
        const logoImg = '<img src="data:image/png;base64,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" class="logo" alt="Entra Token Studio" />';

        // Common styles for branded pages
        const baseStyles = `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #f1f5f9;
            padding: 20px;
          }
          .card {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 16px;
            padding: 48px;
            text-align: center;
            max-width: 420px;
            backdrop-filter: blur(10px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          .logo { width: 48px; height: 48px; color: #60a5fa; margin-bottom: 16px; border-radius: 50%; object-fit: cover; }
          .brand { font-size: 14px; font-weight: 600; color: #94a3b8; margin-bottom: 24px; }
          .icon { font-size: 56px; margin-bottom: 20px; }
          h1 { font-size: 22px; font-weight: 600; margin-bottom: 12px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
          .footer { 
            margin-top: 32px; 
            padding-top: 20px; 
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            font-size: 12px;
            color: #64748b;
          }
          .footer a { color: #60a5fa; text-decoration: none; }
          .footer a:hover { text-decoration: underline; }
          .disclaimer { margin-top: 8px; font-size: 11px; color: #475569; }
          .github-link { display: inline-flex; align-items: center; gap: 4px; }
          .github-icon { width: 14px; height: 14px; }
        `;
        
        // Common footer HTML (using concatenation to avoid nested template literal issues)
        const footerHtml = '<div class="footer">' +
          '<a href="' + GITHUB_URL + '" target="_blank" class="github-link">' +
            '<svg class="github-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>' +
            'GitHub' +
          '</a>' +
          '<div class="disclaimer">Built by <a href="' + AUTHOR_URL + '" target="_blank">@raokarthik99</a> · Not affiliated with Microsoft</div>' +
        '</div>';

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        
        if (error) {
          res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Failed | Entra Token Studio</title>
  <style>${baseStyles}
    .icon { color: #ef4444; }
    h1 { color: #fca5a5; }
  </style>
</head>
<body>
  <div class="card">
    ${logoImg}
    <div class="brand">Entra Token Studio</div>
    <div class="icon">✕</div>
    <h1>Authentication Failed</h1>
    <p>${errorDescription || error}</p>
    <p style="margin-top: 16px;">You can close this window.</p>
    ${footerHtml}
        </div>
</body>
</html>`);
          const isUserCancelled =
            error === 'access_denied' &&
            (errorDescription?.toLowerCase().includes('cancel') || errorDescription?.toLowerCase().includes('canceled'));
          rejectCode(new Error(isUserCancelled ? 'Sign-in was cancelled' : (errorDescription || error)));
        } else if (code) {
          if (expectedState && returnedState !== expectedState) {
            res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Failed | Entra Token Studio</title>
  <style>${baseStyles}
    .icon { color: #ef4444; }
    h1 { color: #fca5a5; }
  </style>
</head>
<body>
  <div class="card">
    ${logoImg}
    <div class="brand">Entra Token Studio</div>
    <div class="icon">✕</div>
    <h1>Authentication Failed</h1>
    <p>Invalid authentication response. Please try again.</p>
    <p style="margin-top: 16px;">You can close this window.</p>
    ${footerHtml}
  </div>
</body>
</html>`);
            rejectCode(new Error('Invalid authentication state'));
            setTimeout(() => server.close(), 500);
            return;
          }

          res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticated | Entra Token Studio</title>
  <style>${baseStyles}
    .icon { color: #22c55e; }
    h1 { color: #86efac; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .card { animation: fadeIn 0.3s ease-out; }
    .open-app {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .open-app:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
    }
  </style>
</head>
<body>
  <div class="card">
    ${logoImg}
    <div class="brand">Entra Token Studio</div>
    <div class="icon">✓</div>
    <h1>Authentication Successful</h1>
    <p>You're all set!</p>
    <a href="entra-token-studio://auth-complete" class="open-app" id="openApp">Open Entra Token Studio</a>
    <p style="margin-top: 16px; font-size: 13px;">Or close this window manually.</p>
    <div id="fallback" style="display: none; margin-top: 16px; padding: 12px; background: rgba(148, 163, 184, 0.1); border-radius: 8px; font-size: 13px;">
      <strong>Dev Mode:</strong> Deep link not available. Switch to the app manually — your token is ready!
    </div>
    ${footerHtml}
  </div>
  <script>
    // Try to open the app via deep link
    // In dev mode, the protocol isn't registered so this may fail
    const openApp = document.getElementById('openApp');
    const fallback = document.getElementById('fallback');
    
    setTimeout(() => {
      // Try triggering the deep link
      openApp.click();
      
      // If we're still here after 1 second, deep link didn't work (dev mode)
      setTimeout(() => {
        fallback.style.display = 'block';
      }, 1000);
    }, 500);
  </script>
</body>
</html>`);
          resolveCode(code);
        } else {
          res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error | Entra Token Studio</title>
  <style>${baseStyles}
    .icon { color: #f59e0b; }
    h1 { color: #fcd34d; }
  </style>
</head>
<body>
  <div class="card">
    ${logoImg}
    <div class="brand">Entra Token Studio</div>
    <div class="icon">⚠</div>
    <h1>Invalid Response</h1>
    <p>No authorization code was received from the server.</p>
    <p style="margin-top: 16px;">Please try again or contact support.</p>
    ${footerHtml}
  </div>
</body>
</html>`);
          rejectCode(new Error('No authorization code received'));
        }

        // Close server after handling callback
        setTimeout(() => server.close(), 500);
      }
    });

    // Listen on port 0 = OS assigns an available port
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, port: address.port, codePromise });
    });

    server.on('error', reject);
  });
}

/**
 * Acquire a user token by opening the system browser
 */
export async function handleUserToken(params: unknown): Promise<msal.AuthenticationResult> {
  const { clientId, tenantId, scopes, prompt, accountHomeAccountId, silentOnly } = params as UserTokenParams;

  if (!clientId || !tenantId || !scopes?.length) {
    throw new Error('clientId, tenantId, and scopes are required');
  }

  const { pca } = await getPca(clientId, tenantId);

  // Try silent acquisition first (from cache)
  const accounts = await pca.getTokenCache().getAllAccounts();
  
  const preferredAccount = accountHomeAccountId
    ? accounts.find((account) => account.homeAccountId === accountHomeAccountId) ?? accounts[0]
    : accounts[0];

  if (preferredAccount && !prompt) {
    try {
      const silentResult = await pca.acquireTokenSilent({
        scopes,
        account: preferredAccount,
      });
      return serializeAuthResult(silentResult);
    } catch (e) {
      if (silentOnly) {
        // Avoid interactive for background tasks like profile metadata.
        // Normalize to a stable message so callers can ignore it.
        const err = e as any;
        const errorCode = String(err?.errorCode || err?.code || '').toLowerCase();
        const message = String(err?.errorMessage || err?.message || '');
        const interactionRequired =
          err instanceof msal.InteractionRequiredAuthError ||
          errorCode.includes('interaction') ||
          errorCode.includes('login_required') ||
          message.toLowerCase().includes('interaction required');
        throw new Error(interactionRequired ? 'interaction_required' : (message || 'silent_token_failed'));
      }
      // Proceed to interactive
    }
  } else if (silentOnly) {
    throw new Error('no_cached_account');
  }

  const acquireByBrowser = async (browserScopes: string[]): Promise<msal.AuthenticationResult> => {
    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const requestState = crypto.randomBytes(16).toString('base64url');

    // Start callback server on dynamic port
    const { server, port, codePromise } = await startCallbackServer(requestState);
    // Mobile/Desktop platform uses http://localhost (no path) - this avoids matching SPA's /auth/callback
    const redirectUri = `http://localhost:${port}`;

    try {
      // Generate auth URL with PKCE
      const authUrl = await pca.getAuthCodeUrl({
        scopes: browserScopes,
        redirectUri,
        ...(prompt ? { prompt } : {}),
        codeChallenge,
        codeChallengeMethod: 'S256',
        state: requestState,
      });

      // Open system browser without shell interpolation
      const { spawn } = await import('child_process');

      const child = (() => {
        if (process.platform === 'darwin') {
          return spawn('open', [authUrl], { stdio: 'ignore', detached: true });
        }
        if (process.platform === 'win32') {
          // Escape & with ^ for cmd.exe (standard approach used by 'open' npm package)
          // This prevents cmd from interpreting & as command separator
          const escapedUrl = authUrl.replace(/&/g, '^&');
          return spawn('cmd.exe', ['/c', 'start', '', escapedUrl], { stdio: 'ignore', detached: true, windowsHide: true });
        }
        return spawn('xdg-open', [authUrl], { stdio: 'ignore', detached: true });
      })();

      child.on('error', () => { /* Failed to open browser */ });
      child.unref();

      // Wait for callback (with timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(AUTH_CODE_TIMEOUT_MESSAGE)), AUTH_CODE_TIMEOUT_MS);
      });

      const code = await Promise.race([codePromise, timeoutPromise]);

      // Exchange code for token with PKCE verifier
      const tokenResult = await pca.acquireTokenByCode({
        code,
        scopes: browserScopes,
        redirectUri,
        codeVerifier,
      });

      return serializeAuthResult(tokenResult);
    } finally {
      server.close();
    }
  };

  const requestedScopes = uniqScopes(scopes);

  // First-time sign-in parity with web: establish a baseline session (OIDC + offline_access)
  // and avoid mixing multiple resources in a single interactive request.
  if (!preferredAccount) {
    const wantsResourcePrefixedScopes = requestedScopes.some(isResourcePrefixedScope);

    if (!wantsResourcePrefixedScopes) {
      // Graph-style scopes: safe to include User.Read for profile/photo parity.
      return acquireByBrowser(getInteractiveScopes(['User.Read', ...requestedScopes]));
    }

    // Resource-prefixed scopes (e.g., Azure management, custom APIs) cannot be mixed with Graph scopes.
    // Do a lightweight baseline login first, then request the actual resource token.
    await acquireByBrowser(getInteractiveScopes(['User.Read']));

    const accountsAfterLogin = await pca.getTokenCache().getAllAccounts();
    const account =
      (accountHomeAccountId
        ? accountsAfterLogin.find((acc) => acc.homeAccountId === accountHomeAccountId) ?? accountsAfterLogin[0]
        : accountsAfterLogin[0]);
    if (!account) {
      throw new Error('No account found after sign-in');
    }

    try {
      const result = await pca.acquireTokenSilent({
        scopes: requestedScopes,
        account,
      });
      return serializeAuthResult(result);
    } catch (err: any) {
      const errorCode = String(err?.errorCode || err?.code || '').toLowerCase();
      const message = String(err?.errorMessage || err?.message || '');
      const interactionRequired =
        err instanceof msal.InteractionRequiredAuthError ||
        errorCode.includes('interaction') ||
        errorCode.includes('login_required') ||
        message.toLowerCase().includes('interaction required');

      if (!interactionRequired) throw err;
      return acquireByBrowser(getInteractiveScopes(requestedScopes));
    }
  }

  return acquireByBrowser(getInteractiveScopes(requestedScopes));
}

/**
 * Get cached accounts for a given clientId + tenantId.
 * Used by the desktop UI to restore signed-in state on app restart.
 */
export async function getUserAccounts(params: unknown): Promise<SerializedAccount[]> {
  const { clientId, tenantId } = params as { clientId: string; tenantId: string };

  if (!clientId || !tenantId) {
    throw new Error('clientId and tenantId are required');
  }

  const { pca } = await getPca(clientId, tenantId);
  const accounts = await pca.getTokenCache().getAllAccounts();

  return accounts.map((account) => ({
    homeAccountId: account.homeAccountId,
    environment: account.environment,
    tenantId: account.tenantId,
    username: account.username,
    name: account.name,
  }));
}

/**
 * Clear cached accounts for a client
 */
export async function clearUserTokenCache(params: unknown): Promise<void> {
  const { clientId, tenantId } = params as { clientId: string; tenantId: string };
  const key = getPcaKey(clientId, tenantId);
  const existing = pcaCache.get(key);
  pcaCache.delete(key);
  const candidates = [
    existing?.cacheFilePath,
    getTokenCacheFilePath(clientId, tenantId, 'plain'),
    getTokenCacheFilePath(clientId, tenantId, 'secure'),
  ].filter(Boolean) as string[];

  await Promise.all(
    Array.from(new Set(candidates)).map(async (cacheFilePath) => {
      try {
        await fs.rm(cacheFilePath, { force: true });
      } catch {
        // Ignore
      }
    }),
  );
}
