/**
 * Entra Token Studio Sidecar
 * 
 * This is the Node.js sidecar process for the Tauri desktop app.
 * It handles all Azure SDK operations (Key Vault, MSAL) via JSON-RPC over stdin/stdout.
 * 
 * The sidecar is necessary because Azure SDKs (@azure/identity, @azure/keyvault-*, @azure/msal-node)
 * are JavaScript-only and have no Rust equivalents.
 */

import { createInterface } from 'readline';
import { handleAppToken } from './handlers/app-token.js';
import { handleValidateKeyVault } from './handlers/keyvault.js';
import { handleCredentialStatus } from './handlers/credential-status.js';
import { handleUserToken, clearUserTokenCache, getUserAccounts, getAuthStorageStatus } from './handlers/user-token.js';
import {
  handleListSubscriptions,
  handleListAppRegistrations,
  handleListKeyVaults,
  handleListSecrets,
  handleListCertificates,
} from './handlers/azure-cli.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcHandler = (params?: unknown) => Promise<unknown>;

function withParams<T>(handler: (params: T) => Promise<unknown>): JsonRpcHandler {
  return (params?: unknown) => handler(params as T);
}

function withOptionalParams<T>(handler: (params?: T) => Promise<unknown>): JsonRpcHandler {
  return (params?: unknown) => handler(params as T | undefined);
}

const handlers: Record<string, JsonRpcHandler> = {
  'acquire_app_token': handleAppToken,
  'acquire_user_token': handleUserToken,
  'clear_user_cache': clearUserTokenCache,
  'get_user_accounts': getUserAccounts,
  'get_auth_storage_status': () => getAuthStorageStatus(),
  'validate_keyvault': handleValidateKeyVault,
  'get_credential_status': handleCredentialStatus,
  'list_azure_subscriptions': () => handleListSubscriptions(),
  'list_azure_apps': withOptionalParams(handleListAppRegistrations),
  'list_keyvaults': withOptionalParams(handleListKeyVaults),
  'list_keyvault_secrets': withParams(handleListSecrets),
  'list_keyvault_certificates': withParams(handleListCertificates),
};

async function handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const handler = handlers[request.method];
  
  if (!handler) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: `Method not found: ${request.method}`,
      },
    };
  }

  try {
    const result = await handler(request.params);
    return {
      jsonrpc: '2.0',
      id: request.id,
      // Always include a JSON-safe result; `undefined` would be dropped by JSON.stringify,
      // which breaks clients expecting a `result` field (e.g. void methods).
      result: result === undefined ? null : result,
    };
  } catch (err) {
    const error = err as Error;
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32000,
        message: error.message || 'Internal error',
        data: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  }
}

function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (err) {
      // Invalid JSON
      const error = err as Error;
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
          data: error.message,
        },
      }));
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Signal that sidecar is ready
  console.error('[sidecar] Ready');
}

main();
