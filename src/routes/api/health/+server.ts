import { json } from '@sveltejs/kit';
import { configChecks, getAuthMethod, getRedirectUri, missingEnvKeys } from '$lib/server/msal';
import { getKeyVaultCertificateStatus, getKeyVaultSecretStatus } from '$lib/server/keyvault';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

type ValidationStatus = 'ready' | 'issues' | 'not_configured';

const asValidation = (status: ValidationStatus, errors: string[] = []) => ({
  status,
  ...(errors.length ? { errors } : {}),
});

export const GET: RequestHandler = async ({ url, cookies }) => {
  const redirectUri = getRedirectUri(url.origin);
  const missing = missingEnvKeys();
  const authority = `https://login.microsoftonline.com/${env.TENANT_ID || 'organizations'}`;
  const authResolution = getAuthMethod(cookies);

  const [kvCertStatus, kvSecretStatus] = await Promise.all([
    getKeyVaultCertificateStatus(),
    getKeyVaultSecretStatus(),
  ]);

  const validation = {
    secret: {
      keyvault: (() => {
        if (kvSecretStatus.status === 'connected') return asValidation('ready');
        if (kvSecretStatus.status === 'error') {
          return asValidation('issues', kvSecretStatus.error ? [kvSecretStatus.error] : ['Unable to read secret from Key Vault.']);
        }
        return asValidation(
          'not_configured',
          ['Set AZURE_KEYVAULT_URI and AZURE_KEYVAULT_SECRET_NAME to use a Key Vault secret.']
        );
      })(),
    },
    certificate: {
      keyvault: (() => {
        if (kvCertStatus.status === 'connected') return asValidation('ready');
        if (kvCertStatus.status === 'error') {
          return asValidation('issues', kvCertStatus.error ? [kvCertStatus.error] : ['Unable to read certificate from Key Vault.']);
        }
        return asValidation(
          'not_configured',
          ['Set AZURE_KEYVAULT_URI and AZURE_KEYVAULT_CERT_NAME to use a Key Vault certificate.']
        );
      })(),
    },
  };

  const activeValidation =
    authResolution.method === 'certificate'
      ? validation.certificate.keyvault
      : authResolution.method === 'secret'
        ? validation.secret.keyvault
        : asValidation('not_configured', ['No credential path selected.']);

  const status = missing.length === 0 && activeValidation.status === 'ready' ? 'ok' : 'incomplete';

  const keyVault =
    authResolution.source === 'keyvault'
      ? {
          uri: authResolution.method === 'certificate' ? kvCertStatus.uri : kvSecretStatus.uri,
          certName: kvCertStatus.certName,
          secretName: kvSecretStatus.secretName,
          status: authResolution.method === 'certificate' ? kvCertStatus.status : kvSecretStatus.status,
          ...(authResolution.method === 'certificate' && kvCertStatus.error ? { error: kvCertStatus.error } : {}),
          ...(authResolution.method === 'secret' && kvSecretStatus.error ? { error: kvSecretStatus.error } : {}),
        }
      : undefined;

  return json({
    status,
    tenant: env.TENANT_ID || null,
    clientId: env.CLIENT_ID || null,
    authority,
    redirectUri,
    authMethod: authResolution.method,
    authSource: authResolution.source,
    validation,
    checks: {
      tenantId: configChecks.tenantId,
      clientId: configChecks.clientId,
      keyVault: configChecks.keyVault,
      keyVaultSecret: configChecks.keyVaultSecret,
      redirectUri: Boolean(env.REDIRECT_URI),
    },
    ...(keyVault && { keyVault }),
    missing,
  });
};
