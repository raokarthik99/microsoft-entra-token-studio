import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listKeyVaults } from '$lib/server/azure-cli';

export const GET: RequestHandler = async ({ url }) => {
  const subscriptionId = url.searchParams.get('subscriptionId') || undefined;
  const result = await listKeyVaults(subscriptionId);
  return json(result, { status: result.success ? 200 : 200 });
};
