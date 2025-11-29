import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
  acquireAppTokenWithConfig, 
  validateTokenAppConfig, 
  asResourceScope,
  type TokenAppConfig 
} from '$lib/server/app-token-service';

interface AppTokenRequest {
  appConfig: TokenAppConfig;
  resource: string;
}

/**
 * POST /api/token/app
 * Acquires an app token (client credentials flow) using the provided app configuration.
 * 
 * Request body:
 * - appConfig: { clientId, tenantId, keyVault: { uri, credentialType, certName?, secretName? } }
 * - resource: Target resource URL (e.g., "https://graph.microsoft.com")
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: AppTokenRequest;
  
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { appConfig, resource } = body;

  // Validate resource
  if (!resource?.trim()) {
    return json({ 
      error: 'Provide a resource, e.g. https://graph.microsoft.com',
      code: 'missing_resource'
    }, { status: 400 });
  }

  // Validate app configuration
  const validation = validateTokenAppConfig(appConfig);
  if (!validation.valid) {
    return json({
      error: 'Invalid app configuration',
      code: 'invalid_config',
      details: validation.errors,
      setupRequired: true,
      hint: 'Configure an app with valid clientId, tenantId, and Key Vault settings.',
    }, { status: 400 });
  }

  const scope = asResourceScope(resource);
  const authMethod = appConfig.keyVault.credentialType;

  try {
    const token = await acquireAppTokenWithConfig(appConfig, [scope]);
    
    return json({
      scope,
      tokenType: token.tokenType,
      expiresOn: token.expiresOn ? token.expiresOn.toISOString() : undefined,
      accessToken: token.accessToken,
      authMethod,
      authSource: 'keyvault',
    });
  } catch (err: any) {
    console.error('Failed to acquire app token', err);
    const message = err.errorMessage || err.message || 'Unknown error';
    const code = err.errorCode || 'token_acquisition_failed';
    
    // Provide more helpful error messages based on auth method
    let details = message;
    if (authMethod === 'certificate' && message.includes('certificate')) {
      details = `Certificate authentication error: ${message}. Check Key Vault configuration and permissions.`;
    }
    
    return json(
      {
        error: 'Failed to acquire app token',
        details,
        code,
        authMethod,
        authSource: 'keyvault',
      },
      { status: 500 },
    );
  }
};
