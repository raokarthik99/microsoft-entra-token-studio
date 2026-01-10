import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAzureApps } from '$lib/server/azure-cli';

export const GET: RequestHandler = async ({ url }) => {
  const search = url.searchParams.get('search') || undefined;
  const result = await listAzureApps(search);
  return json(result, { status: result.success ? 200 : 200 });
};
