import { json } from '@sveltejs/kit';
import { configChecks, getAuthMethod, getRedirectUri, missingEnvKeys } from '$lib/server/msal';
import { getKeyVaultCertificateStatus, getKeyVaultSecretStatus } from '$lib/server/keyvault';
import { getLocalCertificateStatus } from '$lib/server/certificate';
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

  const [kvCertStatus, kvSecretStatus, localCertStatus] = await Promise.all([
    getKeyVaultCertificateStatus(),
    getKeyVaultSecretStatus(),
    getLocalCertificateStatus(),
  ]);

  const validation = {
    secret: {
      local: env.CLIENT_SECRET
        ? asValidation('ready')
        : asValidation('not_configured', ['Set CLIENT_SECRET in your .env file.']),
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
      local: (() => {
        if (localCertStatus.status === 'loaded') return asValidation('ready');
        if (localCertStatus.status === 'error') {
          return asValidation('issues', localCertStatus.error ? [localCertStatus.error] : ['Failed to load certificate from CERTIFICATE_PATH.']);
        }
        return asValidation('not_configured', ['Set CERTIFICATE_PATH to a PEM/PFX file with the private key.']);
      })(),
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
      ? validation.certificate[authResolution.source === 'keyvault' ? 'keyvault' : 'local']
      : authResolution.method === 'secret'
        ? validation.secret[authResolution.source === 'keyvault' ? 'keyvault' : 'local']
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

  const localCert = localCertStatus.configured
    ? {
        path: localCertStatus.path,
        status: localCertStatus.status,
        ...(localCertStatus.error && { error: localCertStatus.error }),
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
