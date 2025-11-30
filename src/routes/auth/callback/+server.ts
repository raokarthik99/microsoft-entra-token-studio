import { redirect } from '@sveltejs/kit';
import { clientApp, authStates, getRedirectUri, missingEnvKeys } from '$lib/server/msal';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    throw redirect(302, `/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`);
  }
  if (!code) {
    throw redirect(302, '/?error=missing_code');
  }

  const missing = missingEnvKeys();
  if (missing.length || !clientApp) {
    const search = new URLSearchParams({
      error: 'missing_config',
      error_description: `Missing ${missing.join(', ') || 'required config'}`,
    });
    throw redirect(302, `/?${search.toString()}`);
  }
  
  const entry = state ? authStates.get(state) : undefined;
  if (!entry) {
    throw redirect(302, '/?error=invalid_state');
  }
  
  if (state) {
    authStates.delete(state);
  }

  try {
    const token = await clientApp.acquireTokenByCode({
      code,
      scopes: entry.scopes,
      redirectUri: getRedirectUri(url.origin),
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

    // Redirect back to home with token data in hash
    const hashPayload = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    throw redirect(302, `/#token=${hashPayload}`);
    
  } catch (err: any) {
    if (err.status === 302) throw err;
    console.error('Failed to redeem auth code', err);
    throw redirect(302, `/?error=redemption_failed&details=${encodeURIComponent(err.message)}`);
  }
};
