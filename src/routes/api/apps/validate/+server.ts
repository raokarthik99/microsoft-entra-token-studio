import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AppConfig } from '$lib/types';
import { validateKeyVaultConfig } from '$lib/server/keyvault-validator';

/**
 * POST /api/apps/validate
 * Validates a Key Vault configuration before saving an app.
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { keyVault } = body as { keyVault: AppConfig['keyVault'] };

    if (!keyVault) {
      return json({ valid: false, error: 'keyVault configuration is required' }, { status: 400 });
    }

    const result = await validateKeyVaultConfig(keyVault);
    
    if (!result.valid) {
      return json({ 
        valid: false, 
        error: result.error 
      }, { status: 200 }); // 200 because validation completed, just failed
    }

    return json({ 
      valid: true, 
      details: result.details 
    });
  } catch (err: any) {
    console.error('Key Vault validation error:', err);
    return json({ 
      valid: false, 
      error: err.message || 'Validation failed' 
    }, { status: 500 });
  }
};
