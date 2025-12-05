import { json } from '@sveltejs/kit';
import { configChecks, getRedirectUri, missingEnvKeys } from '$lib/server/msal';
import { getKeyVaultStatus, isKeyVaultConfigured, isKeyVaultSecretConfigured } from '$lib/server/keyvault';
import { getLocalCertificateStatus, isLocalCertificateConfigured } from '$lib/server/certificate';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url }) => {
  const redirectUri = getRedirectUri(url.origin);
  const missing = missingEnvKeys();
  const authority = `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`;

  // Determine auth method from configuration (not runtime state)
  // Priority: KV Cert > Local Cert > KV Secret > Secret
  let authMethod: 'certificate' | 'secret' | 'none' = 'none';
  let authSource: 'keyvault' | 'local' | 'none' = 'none';

  if (isKeyVaultConfigured()) {
    authMethod = 'certificate';
    authSource = 'keyvault';
  } else if (isLocalCertificateConfigured()) {
    authMethod = 'certificate';
    authSource = 'local';
  } else if (isKeyVaultSecretConfigured()) {
    authMethod = 'secret';
    authSource = 'keyvault';
  } else if (env.CLIENT_SECRET) {
    authMethod = 'secret';
    authSource = 'local';
  }

  // Get Key Vault status if configured (for either cert or secret)
  let keyVault = null;
  if (isKeyVaultConfigured() || isKeyVaultSecretConfigured()) {
    const kvStatus = await getKeyVaultStatus();
    keyVault = {
      uri: kvStatus.uri,
      certName: kvStatus.certName,
      secretName: kvStatus.secretName,
      status: kvStatus.status,
      ...(kvStatus.error && { error: kvStatus.error }),
    };
  }

  // Get Local Cert status if configured
  let localCert = null;
  if (isLocalCertificateConfigured()) {
    const lcStatus = await getLocalCertificateStatus();
    localCert = {
      path: lcStatus.path,
      status: lcStatus.status,
      ...(lcStatus.error && { error: lcStatus.error }),
    };
  }

  return json({
    status: missing.length ? 'incomplete' : 'ok',
    tenant: env.TENANT_ID || null,
    clientId: env.CLIENT_ID || null,
    authority,
    redirectUri,
    authMethod,
    authSource,
    checks: {
      tenantId: configChecks.tenantId,
      clientId: configChecks.clientId,
      clientSecret: configChecks.clientSecret,
      keyVault: configChecks.keyVault,
      keyVaultSecret: configChecks.keyVaultSecret,
      localCert: configChecks.localCert,
      redirectUri: Boolean(env.REDIRECT_URI),
    },
    ...(keyVault && { keyVault }),
    ...(localCert && { localCert }),
    missing,
  });
};
