export interface HistoryItem {
    type: 'App Token' | 'User Token';
    target: string;
    timestamp: number;
    tokenData?: TokenData;
    // App context (added for multi-app support)
    appId?: string;
    appName?: string;
    appColor?: string;
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
    // App context (added for multi-app support)
    appId?: string;
    appName?: string;
    appColor?: string;

    // Favorites metadata
    id: string;
    name?: string;
    tags?: string[];
    description?: string;
    createdAt: number;
    lastUsedAt?: number;
    useCount: number;
    color?: string;
    isPinned?: boolean;
    pinnedAt?: number | null;
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
 * Key Vault configuration for an app.
 * Each app references a single Key Vault for its credentials.
 */
export interface KeyVaultConfig {
    uri: string;                           // https://my-vault.vault.azure.net
    credentialType: 'secret' | 'certificate';
    secretName?: string;                   // For client secret
    certName?: string;                     // For certificate
}

/**
 * Credential status for an app's Key Vault configuration.
 */
export type AppCredentialStatus = 'valid' | 'error' | 'unknown' | 'validating';

/**
 * Configuration for an Entra app registration with Azure Key Vault credentials.
 * Supports multi-app scenarios where users can switch between different app configurations.
 */
export interface AppConfig {
    // Identity
    id: string;                            // UUID
    name: string;                          // Display name (e.g., "Production")
    color?: string;                        // Visual tag (hex color)
    tags?: string[];                       // Optional search/filter tags
    description?: string;                  // Optional notes shown in listings
    
    // Entra App Registration
    clientId: string;
    tenantId: string;
    redirectUri: string;
    
    // Key Vault Configuration (REQUIRED for app tokens)
    keyVault: KeyVaultConfig;
    
    // Metadata
    createdAt: number;
    lastUsedAt?: number;
    
    // Credential status (runtime, not persisted)
    credentialStatus?: AppCredentialStatus;
    credentialError?: string;
}

/**
 * @deprecated Use AppConfig instead. This is kept for backwards compatibility during migration.
 */
export interface ClientConfig {
    id: string;
    name: string;
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

export interface Suggestion {
    id: string; // concise unique id
    type: 'pinned' | 'favorite' | 'history' | 'preset';
    value: string; // validation: scope or target
    label?: string; // name
    description?: string; // extra context
    metadata?: any;
    score: number; // for ranking
    highlightIndices?: [number, number][]; // [start, end] tuples for bolding
    appId?: string;
    appName?: string;
    appColor?: string;
    timestamp?: number;
    tags?: string[];
    isPinned?: boolean;
}
