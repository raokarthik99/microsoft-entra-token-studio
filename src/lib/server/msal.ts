import * as msal from '@azure/msal-node';
import { env } from '$env/dynamic/private';

// Auth State Management
interface AuthState {
  scopes: string[];
  createdAt: number;
}

export const authStates = new Map<string, AuthState>();
const STATE_TTL_MS = 10 * 60 * 1000;

// Cleanup interval
setInterval(() => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [key, value] of authStates.entries()) {
    if (value.createdAt < cutoff) {
      authStates.delete(key);
    }
  }
}, STATE_TTL_MS);

// Config + status helpers
export const configChecks = {
  tenantId: Boolean(env.TENANT_ID),
  clientId: Boolean(env.CLIENT_ID),
  clientSecret: Boolean(env.CLIENT_SECRET),
  redirectUri: Boolean(env.REDIRECT_URI),
};

export const missingEnvKeys = (): string[] => {
  const missing: string[] = [];
  if (!env.TENANT_ID) missing.push('TENANT_ID');
  if (!env.CLIENT_ID) missing.push('CLIENT_ID');
  if (!env.CLIENT_SECRET) missing.push('CLIENT_SECRET');
  return missing;
};

// MSAL Configuration
const config =
  configChecks.clientId && configChecks.clientSecret
    ? {
        auth: {
          clientId: env.CLIENT_ID as string,
          authority: `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`,
          clientSecret: env.CLIENT_SECRET as string,
        },

        system: {
          loggerOptions: {
            loggerCallback(_loglevel: msal.LogLevel, message: string) {
              const quiet = ['acquireTokenByCode', 'acquireTokenByClientCredential'];
              if (!quiet.some((q) => message.includes(q))) {
                console.log(message);
              }
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Info,
          },
        },
      }
    : null;

export const clientApp = config ? new msal.ConfidentialClientApplication(config) : null;

// Helpers
export const parseScopes = (input: any): string[] =>
  (input || '')
    .split(/[ ,]+/)
    .map((scope: string) => scope.trim())
    .filter(Boolean);

export const asResourceScope = (resource: string) => {
  const cleaned = resource.replace(/\/+$/, '');
  return cleaned.toLowerCase().endsWith('/.default') ? cleaned : `${cleaned}/.default`;
};

export const getRedirectUri = (origin: string) => {
  return env.REDIRECT_URI || `${origin}/auth/callback`;
};
