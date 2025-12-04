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

export interface HealthStatus {
    status: 'ok' | 'incomplete';
    tenant: string | null;
    clientId: string | null;
    authority: string | null;
    redirectUri: string;
    checks: {
        tenantId: boolean;
        clientId: boolean;
        clientSecret: boolean;
        redirectUri: boolean;
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
