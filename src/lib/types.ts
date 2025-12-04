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
