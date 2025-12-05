import { json } from '@sveltejs/kit';
import { acquireAppToken, asResourceScope, missingEnvKeys, getAuthMethod } from '$lib/server/msal';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const resource = url.searchParams.get('resource')?.trim();
  
  if (!resource) {
    return json({ error: 'Provide a resource, e.g. https://graph.microsoft.com' }, { status: 400 });
  }

  const missing = missingEnvKeys();
  if (missing.length) {
    return json(
      {
        error: 'Configuration incomplete',
        code: 'missing_env',
        missing,
        setupRequired: true,
        hint: 'Set TENANT_ID, CLIENT_ID, and either CLIENT_SECRET or AZURE_KEYVAULT_URI+AZURE_KEYVAULT_CERT_NAME, then restart the dev server.',
      },
      { status: 500 },
    );
  }

  const scope = asResourceScope(resource);
  const authResolution = getAuthMethod(cookies);

  try {
    const token = await acquireAppToken([scope], cookies);
    if (!token) {
      throw new Error('Failed to acquire token');
    }
    return json({
      scope,
      tokenType: token.tokenType,
      expiresOn: token.expiresOn ? token.expiresOn.toISOString() : undefined,
      accessToken: token.accessToken,
      authMethod: authResolution.method,
      authSource: authResolution.source,
    });
  } catch (err: any) {
    console.error('Failed to acquire app token', err);
    const message = err.errorMessage || err.message || 'Unknown error';
    const code = err.errorCode || 'token_acquisition_failed';
    
    // Provide more helpful error messages based on auth method
    let details = message;
    if (authResolution.method === 'certificate' && message.includes('certificate')) {
      details = `Certificate authentication error: ${message}. Check Key Vault configuration and permissions.`;
    }
    
    return json(
      {
        error: 'Failed to acquire app token',
        details,
        code,
        authMethod: authResolution.method,
        authSource: authResolution.source,
      },
      { status: 500 },
    );
  }
};
