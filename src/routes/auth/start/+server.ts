import { redirect } from '@sveltejs/kit';
import { clientApp, authStates, parseScopes, getRedirectUri, missingEnvKeys } from '$lib/server/msal';
import type { RequestHandler } from './$types';
import crypto from 'crypto';

export const GET: RequestHandler = async ({ url }) => {
  const scopes = parseScopes(url.searchParams.get('scopes'));
  
  if (!scopes.length) {
    return new Response('Provide scopes via ?scopes=User.Read', { status: 400 });
  }

  const missing = missingEnvKeys();
  if (missing.length || !clientApp) {
    const search = new URLSearchParams({
      error: 'missing_config',
      error_description: `Missing ${missing.join(', ') || 'required config'}`,
    });
    throw redirect(302, `/?${search.toString()}`);
  }

  const state = crypto.randomUUID();
  authStates.set(state, { scopes, createdAt: Date.now() });

  try {
    const authUrl = await clientApp.getAuthCodeUrl({
      scopes,
      redirectUri: getRedirectUri(url.origin),
      state,
    });
    throw redirect(302, authUrl);
  } catch (err: any) {
    if (err.status === 302) throw err; // Re-throw redirect
    console.error('Failed to create auth URL', err);
    return new Response(`Failed to create auth URL: ${err.message || 'Unknown error'}`, { status: 500 });
  }
};
