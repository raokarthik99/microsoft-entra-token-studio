import { historyState } from '$lib/states/history.svelte';
import { favoritesState } from '$lib/states/favorites.svelte';
import { SCOPE_PRESETS, RESOURCE_PRESETS, GRAPH_SCOPES } from '$lib/data/scope-metadata';
import type { Suggestion, HistoryItem, FavoriteItem } from '$lib/types';

export class SuggestionsService {
    getSuggestions(
        query: string,
        flow: 'user-token' | 'app-token',
        activeAppId: string | null,
        options: { limit?: number; showAllApps?: boolean } = {}
    ): Suggestion[] {
        const { limit = 50, showAllApps = false } = options;
        const normalizedQuery = query.toLowerCase().trim();
        const seenValues = new Set<string>();
        const candidates: Suggestion[] = [];
        const now = Date.now();

        // Helper to add candidate with check
        const addCandidate = (s: Suggestion) => {
            if (seenValues.has(s.value)) return;
            seenValues.add(s.value);
            candidates.push(s);
        };

        // 1. PINNED ITEMS (from Favorites)
        // Filter by flow type first
        const pinned = favoritesState.items.filter(f => 
            f.isPinned && 
            this.matchesFlow(f, flow) && 
            this.matchesApp(f, activeAppId, showAllApps) &&
            this.matchesQuery(f.target, f.name, normalizedQuery)
        );

        for (const f of pinned) {
            addCandidate(this.mapFavoriteToSuggestion(f, 'pinned', now, normalizedQuery));
        }

        // 2. FAVORITES (Unpinned)
        const unpinnedFavorites = favoritesState.items.filter(f => 
            !f.isPinned && 
            this.matchesFlow(f, flow) && 
            this.matchesApp(f, activeAppId, showAllApps) &&
            this.matchesQuery(f.target, f.name, normalizedQuery)
        );

        for (const f of unpinnedFavorites) {
            addCandidate(this.mapFavoriteToSuggestion(f, 'favorite', now, normalizedQuery));
        }

        // 3. HISTORY
        const historyItems = historyState.items.filter(h => 
            this.matchesFlow(h, flow) && 
            this.matchesApp(h, activeAppId, showAllApps) &&
            this.matchesQuery(h.target, undefined, normalizedQuery)
        );

        for (const h of historyItems) {
            // Deduplication happens in addCandidate, favoring Pinned/Favorites if they exist with same target
            addCandidate(this.mapHistoryToSuggestion(h, now, normalizedQuery));
        }

        // 4. PRESETS (System)
        // Show if history < 3 OR if explicitly searching and matches
        // Also if query matches a preset, we show it regardless of history count? 
        // PRD says: "Auto-hide once user has >= 5 history items".
        // But if I type "Microsoft", I probably want to see "Microsoft Graph" preset even if I have history.
        // Let's implement: ALWAYS show if it matches query. If query is empty, respect the count rule.
        const historyCount = historyState.items.length;
        const showPresetsDefault = historyCount < 5;
        const hasQuery = normalizedQuery.length > 0;

        if (showPresetsDefault || hasQuery) {
            const presets = flow === 'user-token' ? SCOPE_PRESETS : RESOURCE_PRESETS;
            const matchedPresets = presets.filter(p => 
                this.matchesQuery(p.value, p.label, normalizedQuery)
            );
            
            for (const p of matchedPresets) {
                addCandidate({
                    id: `preset-${p.value}`,
                    type: 'preset',
                    value: p.value,
                    label: p.label,
                    description: p.description,
                    score: 0, // Will be recalculated
                });
            }
        }

        // 5. SCOPE METADATA (User Token only)
        // If flow is user-token, and we have query, match against known scopes
        if (flow === 'user-token' && hasQuery) {
            const matchedScopes = GRAPH_SCOPES.filter(s => 
                s.scope.toLowerCase().includes(normalizedQuery)
            );
            for (const s of matchedScopes) {
                addCandidate({
                    id: `meta-${s.scope}`,
                    type: 'preset',
                    value: s.scope,
                    label: s.scope, // The label is the scope itself
                    description: s.description,
                    metadata: { adminConsentRequired: s.adminConsentRequired },
                    score: 0
                });
            }
        }

        // 6. SCORING & SORTING
        for (const s of candidates) {
            s.score = this.computeScore(s, normalizedQuery, flow, activeAppId);
             // Add highlight indices
             s.highlightIndices = this.getHighlightIndices(s.value, s.label, normalizedQuery);
        }

        return candidates
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    private matchesFlow(item: { type: string }, flow: 'user-token' | 'app-token'): boolean {
        // Map History/Favorite type string ('User Token' | 'App Token') to flow string
        const itemFlow = item.type === 'User Token' ? 'user-token' : 'app-token';
        return itemFlow === flow;
    }

    private matchesApp(item: { appId?: string }, activeAppId: string | null, showAllApps: boolean): boolean {
        if (showAllApps) return true;
        // If item has no app, show it (legacy items). If it has app, must match.
        // Or should we strict filter? PRD: "Suggestions matching the active app's appId are ranked higher"
        // But logic says: "Filter toggle: Show all apps vs Current app only". 
        // Let's assume default is specific app match + global (no app id).
        if (!item.appId) return true; 
        return item.appId === activeAppId;
    }

    private matchesQuery(target: string, name: string | undefined, query: string): boolean {
        if (!query) return true;
        return target.toLowerCase().includes(query) || (name?.toLowerCase().includes(query) ?? false);
    }

    private computeScore(s: Suggestion, query: string, flow: 'user-token' | 'app-token', activeAppId: string | null): number {
        let score = 0;
        
        // Base weights
        if (s.type === 'pinned') score = 1000; // Pinned always top
        else if (s.type === 'favorite') score = 500;
        else if (s.type === 'history') score = 200;
        else if (s.type === 'preset') score = 100;

        // Exact match bonus
        if (s.value.toLowerCase() === query) score += 50;
        else if (s.value.toLowerCase().startsWith(query)) score += 20;

        // Recency decay (for history)
        if (s.type === 'history' && s.timestamp) {
            const hoursAgo = (Date.now() - s.timestamp) / (1000 * 60 * 60);
            // Simple decay: subtract 1 point per hour, max 100 penalty
            score -= Math.min(100, hoursAgo); 
        }

        // Usage count bonus (Favorites)
        // We don't have useCount on Suggestion type easily unless we map it. 
        // Let's pretend we mapped it or just ignore for now in this generic function.
        // Actually I can add it to 'metadata' or 'useCount' prop.
        if (s.metadata?.useCount) {
             score += Math.min(50, s.metadata.useCount * 2);
        }

        // App context match
        if (s.appId && s.appId === activeAppId) {
            score += 100; // Strong bonus for current app
        }

        // Flow specific logic
        const val = s.value.toLowerCase();
        if (flow === 'app-token') {
            if (val.includes('.default')) score += 15;
            if (val.includes(' ')) score -= 20; // Penalty for multi-scope in app token
        } else {
            if (val.includes('.default')) score -= 10;
            if (val.includes(' ')) score += 5;
        }

        return score;
    }

    private mapFavoriteToSuggestion(f: FavoriteItem, type: 'pinned' | 'favorite', now: number, query: string): Suggestion {
        return {
            id: f.id,
            type,
            value: f.target,
            label: f.name,
            description: f.description,
            appId: f.appId,
            appName: f.appName,
            appColor: f.appColor,
            timestamp: f.timestamp,
            tags: f.tags,
            isPinned: f.isPinned,
            metadata: { useCount: f.useCount },
            score: 0
        };
    }

    private mapHistoryToSuggestion(h: HistoryItem, now: number, query: string): Suggestion {
        return {
            id: `hist-${h.timestamp}`,
            type: 'history',
            value: h.target,
            appId: h.appId,
            appName: h.appName,
            appColor: h.appColor,
            timestamp: h.timestamp,
            score: 0
        };
    }

    private getHighlightIndices(value: string, label: string | undefined, query: string): [number, number][] {
        if (!query) return [];
        // Simple implementation: just highlight query in value. 
        // A robust one would handle label highlighting too.
        // Returning empty for now to separate presentation logic or keep strictly simple.
        // If we want to support highlighting, we need to return indices for the *displayed text*.
        // The display often shows "Label (Value)" or just "Value". 
        // Let's skip complex highlight logic here and let UI handle simple contains match coloring.
        return [];
    }
}

export const suggestionsService = new SuggestionsService();
