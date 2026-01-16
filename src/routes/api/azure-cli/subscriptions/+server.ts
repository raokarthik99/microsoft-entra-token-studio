import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAzureSubscriptions } from '$lib/server/azure-cli';

export const GET: RequestHandler = async () => {
  const result = await listAzureSubscriptions();
  return json(result, { status: result.success ? 200 : 200 });
};
