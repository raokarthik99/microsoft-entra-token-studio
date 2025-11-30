import { json } from '@sveltejs/kit';
import { configChecks, getRedirectUri, missingEnvKeys } from '$lib/server/msal';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = ({ url }) => {
  const redirectUri = getRedirectUri(url.origin);
  const missing = missingEnvKeys();
  const authority = `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`;

  return json({
    status: missing.length ? 'incomplete' : 'ok',
    tenant: env.TENANT_ID || null,
    clientId: env.CLIENT_ID || null,
    authority,
    redirectUri,
    checks: {
      tenantId: configChecks.tenantId,
      clientId: configChecks.clientId,
      clientSecret: configChecks.clientSecret,
      redirectUri: Boolean(env.REDIRECT_URI),
    },
    missing,
  });
};
