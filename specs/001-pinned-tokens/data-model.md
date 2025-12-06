# Data Model: Pinned Tokens in Navigation

## Favorite Token Entry (existing, extended)

Represents a saved configuration for issuing a token to a specific target (for example, token type, client, and resource), now extended with pinned metadata.

**Identity & Uniqueness**
- Unique per combination of:
  - Tenant identifier
  - Client identifier
  - Resource / audience (e.g., Graph, custom API)
  - Token type (App token / User token)

**Key Fields (conceptual)**
- `id`: Stable identifier used within favorites/history state.
- `tenantId`: Directory/tenant identifier.
- `clientId`: Application (client) identifier.
- `resource`: Target resource/audience for the token.
- `tokenType`: Category (e.g., App token, User token).
- `name`: User-facing label for the favorite.
- `color`: Optional color for visual grouping.
- `tags`: Optional list of tags for filtering/search.
- `createdAt`: When the favorite was first created.
- `updatedAt`: When the favorite was last edited.
- `usageCount`: How many times this favorite has been used to issue a token.
- `lastUsedAt`: Timestamp of the last token issuance via this favorite.
- `isPinned`: Boolean flag indicating whether this favorite is currently pinned into the navigation.
- `pinnedAt`: Timestamp of when the favorite was most recently pinned (used for ordering in pinned area and at the top of the favorites list).

**Validation Rules**
- `clientId`, `tenantId`, `resource`, and `tokenType` must be non-empty.
- `resource` and `tokenType` combinations must respect existing favorites uniqueness rules.
- `isPinned` MUST be true for at most five distinct favorites at any given time (global cap per user profile).
- When `isPinned` is true, `pinnedAt` MUST be set; when `isPinned` is false, `pinnedAt` MUST be cleared or ignored for ordering.

**State Transitions**
- Create favorite → `isPinned = false`, `pinnedAt = null`.
- Pin favorite → `isPinned = true`, `pinnedAt = now`, subject to the five-entry limit.
- Unpin favorite → `isPinned = false`, `pinnedAt = null`.
- Delete or unfavorite favorite → favorite entry removed; any derived pinned representation is removed as well.

## Pinned Navigation View (derived)

Represents the subset of favorites that are currently pinned, sorted for display in the header/navigation area.

**Source**
- Derived from all favorites where `isPinned = true`.
- Limited to at most five entries ordered by `pinnedAt` descending.

**Key Fields (view model)**
- `favoriteId`: Reference to the underlying favorite entry.
- `label`: Display name derived from favorite `name` (with sensible fallback if missing).
- `tokenType`: Copied from the favorite for iconography.
- `resourceSummary`: Short representation of the resource/audience for quick scanning.
- `color`: Optional accent color reused from the favorite.

**Behavioral Rules**
- Reissue actions operate on the underlying favorite’s configuration.
- Unpin actions mutate `isPinned`/`pinnedAt` on the favorite and immediately remove the item from the pinned view.
- If the underlying favorite is removed or its configuration becomes invalid, the pinned view drops the corresponding entry to avoid orphaned pins.

## Persistence & Backup/Restore

- Favorite entries, including `isPinned` and `pinnedAt`, are persisted via the existing IndexedDB-based favorites persistence and participate in the JSON backup/export/import flow.
- No separate storage is introduced for pinned tokens; the pinned navigation view is recomputed from favorites on load.
- Import/restore semantics follow the existing “replace” behavior: the restored favorites set (including pinned flags) becomes the new source of truth.
