import { json } from '@sveltejs/kit';
import { getRedirectUri } from '$lib/server/msal';
import type { RequestHandler } from './$types';
import dotenv from 'dotenv';

dotenv.config();

export const GET: RequestHandler = ({ url }) => {
  return json({
    status: 'ok',
    tenant: process.env.TENANT_ID,
    clientId: process.env.CLIENT_ID,
    redirectUri: getRedirectUri(url.origin),
  });
};
