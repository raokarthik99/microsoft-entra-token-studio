export interface HistoryItem {
    type: 'App Token' | 'User Token';
    target: string;
    timestamp: number;
    tokenData?: TokenData;
}

export interface TokenData {
    accessToken: string;
    tokenType?: string;
    expiresOn?: string;
    scope?: string;
    scopes?: string[];
    idTokenClaims?: any;
}

export interface FavoriteItem {
    // Core fields shared with history items
    type: 'App Token' | 'User Token';
    target: string;
    timestamp: number;
    tokenData?: TokenData;

    // Favorites metadata
    id: string;
    name?: string;
    tags?: string[];
    description?: string;
    createdAt: number;
    lastUsedAt?: number;
    useCount: number;
    color?: string;
}

export type CredentialValidationStatus = 'ready' | 'issues' | 'not_configured';

export interface CredentialValidation {
    status: CredentialValidationStatus;
    errors?: string[];
}

export interface CredentialValidationMap {
    secret: {
        local: CredentialValidation;
        keyvault: CredentialValidation;
    };
    certificate: {
        local: CredentialValidation;
        keyvault: CredentialValidation;
    };
}

export interface HealthStatus {
    status: 'ok' | 'incomplete';
    tenant: string | null;
    clientId: string | null;
    authority: string | null;
    redirectUri: string;
    authMethod: 'certificate' | 'secret' | 'none';
    authSource: 'keyvault' | 'local' | 'none';
    validation: CredentialValidationMap;
    checks: {
        tenantId: boolean;
        clientId: boolean;
        clientSecret: boolean;
        keyVault: boolean;
        keyVaultSecret: boolean;
        localCert: boolean;
        redirectUri: boolean;
    };
    keyVault?: {
        uri: string | null;
        certName: string | null;
        secretName: string | null;
        status: 'connected' | 'error' | 'not_configured';
        error?: string;
    };
    localCert?: {
        path: string | null;
        status: 'loaded' | 'error' | 'not_configured';
        error?: string;
    };
    missing: string[];
}

/**
 * Configuration for an Entra app registration.
 * Supports future multi-app scenarios where users can switch between different app configurations.
 */
export interface ClientConfig {
    id: string;           // Unique identifier for UI purposes
    name: string;         // Display name (e.g., "Production", "Dev Tenant")
    clientId: string;
    tenantId: string;
    redirectUri: string;
}

/**
 * User's preference for identity selection when issuing user tokens.
 */
export type IdentityPreferenceMode = 'use_last' | 'always_ask';

export interface IdentityPreference {
    mode: IdentityPreferenceMode;
    setAt: number;
}

/**
 * Data export envelope for generic IndexedDB backup/restore.
 * Schema-agnostic to support future data model evolution.
 */
export interface ExportedData {
  version: number;
  exportedAt: string;
  appVersion?: string;
  data: Record<string, unknown>;
}

export interface ImportPreview {
  counts: Record<string, number>;
  exportedAt: string;
  isValid: boolean;
  errors?: string[];
}
