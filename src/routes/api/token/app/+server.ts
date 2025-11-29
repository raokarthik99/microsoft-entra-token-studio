import { json } from '@sveltejs/kit';
import { clientApp, asResourceScope } from '$lib/server/msal';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const resource = url.searchParams.get('resource')?.trim();
  
  if (!resource) {
    return json({ error: 'Provide a resource, e.g. https://graph.microsoft.com' }, { status: 400 });
  }

  const scope = asResourceScope(resource);
  try {
    const token = await clientApp.acquireTokenByClientCredential({ scopes: [scope] });
    if (!token) {
      throw new Error('Failed to acquire token');
    }
    return json({
      scope,
      tokenType: token.tokenType,
      expiresOn: token.expiresOn ? token.expiresOn.toISOString() : undefined,
      accessToken: token.accessToken,
    });
  } catch (err: any) {
    console.error('Failed to acquire app token', err);
    const message = err.errorMessage || err.message || 'Unknown error';
    return json({ error: 'Failed to acquire app token', details: message }, { status: 500 });
  }
};
