import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listKeyVaultSecrets } from '$lib/server/azure-cli';

export const GET: RequestHandler = async ({ url }) => {
  const vaultName = url.searchParams.get('vaultName');
  const subscriptionId = url.searchParams.get('subscriptionId') || undefined;

  if (!vaultName) {
    return json({ success: false, error: 'vaultName is required' }, { status: 200 });
  }

  const result = await listKeyVaultSecrets(vaultName, subscriptionId);
  return json(result, { status: result.success ? 200 : 200 });
};
