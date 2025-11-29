import * as msal from '@azure/msal-node';
import { env } from '$env/dynamic/private';

function requireEnv(key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

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

// MSAL Configuration
const config = {
  auth: {
    clientId: requireEnv('CLIENT_ID'),
    authority: `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`,
    clientSecret: requireEnv('CLIENT_SECRET'),
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
};

export const clientApp = new msal.ConfidentialClientApplication(config);

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
