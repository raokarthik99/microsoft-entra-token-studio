import { json } from '@sveltejs/kit';
import { getRedirectUri } from '$lib/server/msal';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = ({ url }) => {
  return json({
    status: 'ok',
    tenant: env.TENANT_ID,
    clientId: env.CLIENT_ID,
    redirectUri: getRedirectUri(url.origin),
  });
};
