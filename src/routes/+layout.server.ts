import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ url }) => {
  // If required env vars are missing, surface null so the client can redirect to Setup
  if (!env.CLIENT_ID || !env.TENANT_ID) {
    return { authConfig: null };
  }

  return {
    authConfig: {
      id: 'default',
      name: 'Default App',
      clientId: env.CLIENT_ID,
      tenantId: env.TENANT_ID,
      redirectUri: env.REDIRECT_URI || 'http://localhost:5173/auth/callback',
    },
  };
};
