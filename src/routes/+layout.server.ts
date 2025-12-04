import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ url }) => {
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

