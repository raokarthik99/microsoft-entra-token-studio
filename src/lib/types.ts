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
