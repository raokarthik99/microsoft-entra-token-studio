import express, { Request, Response } from 'express';
import * as msal from '@azure/msal-node';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const PORT = process.env.PORT || 3000;
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID || 'organizations'}`;

const missing = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET'].filter(
  (key) => !process.env[key]
);
if (missing.length) {
  console.warn(`Missing env vars: ${missing.join(', ')}. Requests will fail until set.`);
}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// In production, serve static files from dist/client
// In dev, Vite handles frontend, so this might not be hit if using proxy correctly,
// but good to have for production simulation or mixed mode.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist/client')));
}

interface AuthState {
  scopes: string[];
  createdAt: number;
}

const authStates = new Map<string, AuthState>();
const STATE_TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [key, value] of authStates.entries()) {
    if (value.createdAt < cutoff) {
      authStates.delete(key);
    }
  }
}, STATE_TTL_MS).unref();

const clientApp = new msal.ConfidentialClientApplication({
  auth: {
    clientId: CLIENT_ID!,
    authority: AUTHORITY,
    clientSecret: CLIENT_SECRET!,
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
});

const parseScopes = (input: any): string[] =>
  (input || '')
    .split(/[ ,]+/)
    .map((scope: string) => scope.trim())
    .filter(Boolean);

const asResourceScope = (resource: string) => {
  const cleaned = resource.replace(/\/+$/, '');
  return cleaned.toLowerCase().endsWith('/.default') ? cleaned : `${cleaned}/.default`;
};

app.get('/token/app', async (req: Request, res: Response): Promise<any> => {
  const resource = (req.query.resource || '').toString().trim();
  if (!resource) {
    return res.status(400).json({ error: 'Provide a resource, e.g. https://graph.microsoft.com' });
  }

  const scope = asResourceScope(resource);
  try {
    const token = await clientApp.acquireTokenByClientCredential({ scopes: [scope] });
    if (!token) {
      throw new Error('Failed to acquire token');
    }
    res.json({
      scope,
      tokenType: token.tokenType,
      expiresOn: token.expiresOn ? token.expiresOn.toISOString() : undefined,
      accessToken: token.accessToken,
    });
  } catch (err: any) {
    console.error('Failed to acquire app token', err);
    res.status(500).json({ error: 'Failed to acquire app token', details: err.message });
  }
});

app.get('/auth/start', async (req: Request, res: Response): Promise<any> => {
  const scopes = parseScopes(req.query.scopes);
  if (!scopes.length) {
    return res.status(400).send('Provide scopes via ?scopes=User.Read');
  }

  const state = crypto.randomUUID();
  authStates.set(state, { scopes, createdAt: Date.now() });

  try {
    const authUrl = await clientApp.getAuthCodeUrl({
      scopes,
      redirectUri: REDIRECT_URI,
      state,
    });
    res.redirect(authUrl);
  } catch (err: any) {
    console.error('Failed to create auth URL', err);
    res.status(500).send(`Failed to create auth URL: ${err.message}`);
  }
});

app.get('/auth/callback', async (req: Request, res: Response): Promise<any> => {
  const { code, state, error, error_description: errorDescription } = req.query as Record<string, string>;
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription)}`);
  }
  if (!code) {
    return res.redirect('/?error=missing_code');
  }
  const entry = state ? authStates.get(state) : undefined;
  if (!entry) {
    return res.redirect('/?error=invalid_state');
  }
  authStates.delete(state);

  try {
    const token = await clientApp.acquireTokenByCode({
      code,
      scopes: entry.scopes,
      redirectUri: REDIRECT_URI,
    });
    
    if (!token) {
      throw new Error('Failed to acquire token');
    }

    const tokenData = {
      scopes: entry.scopes,
      tokenType: token.tokenType,
      expiresOn: token.expiresOn ? token.expiresOn.toISOString() : undefined,
      accessToken: token.accessToken,
      idTokenClaims: token.idTokenClaims,
    };

    // Redirect back to home with token data in hash to avoid server logs/history issues
    // Using a safe base64 encoding for the JSON
    const hashPayload = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    res.redirect(`/#token=${hashPayload}`);
    
  } catch (err: any) {
    console.error('Failed to redeem auth code', err);
    res.redirect(`/?error=redemption_failed&details=${encodeURIComponent(err.message)}`);
  }
});

app.get('/health', (_: Request, res: Response) => {
  res.json({
    status: 'ok',
    tenant: TENANT_ID,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  });
});

app.listen(PORT, () => {
  console.log(`Entra token client listening on http://localhost:${PORT}`);
});
