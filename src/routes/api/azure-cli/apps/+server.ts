import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAzureApps } from '$lib/server/azure-cli';

export const GET: RequestHandler = async ({ url }) => {
  const search = url.searchParams.get('search') || undefined;
  const appId = url.searchParams.get('appId') || undefined;
  const displayName = url.searchParams.get('displayName') || undefined;
  const identifierUri = url.searchParams.get('identifierUri') || undefined;
  const filter = url.searchParams.get('filter') || undefined;
  const showMine = url.searchParams.get('showMine');
  const all = url.searchParams.get('all');
  const parseFlag = (value: string | null) => value === 'true' || value === '1';

  const result = await listAzureApps({
    search,
    appId,
    displayName,
    identifierUri,
    filter,
    showMine: parseFlag(showMine),
    all: parseFlag(all),
  });
  return json(result, { status: result.success ? 200 : 200 });
};
