# Pinned Tokens in Navigation — Research & Design Decisions

## 1. Where to store pinned state

- **Decision**: Represent pinned status as metadata on existing favorite entries rather than a separate pinned collection.
- **Rationale**: Keeps a single source of truth for each client-and-resource pair, ensures pin/unpin actions stay consistent with favorites behavior, and simplifies backup/restore via the existing IndexedDB favorites persistence.
- **Alternatives considered**:
  - Separate `PinnedState` store with its own persistence (rejected: duplicated identity rules, more complex sync/edge cases).
  - Deriving pinned status purely in memory without persistence (rejected: users expect pinned tokens to survive reloads).

## 2. Pinned navigation layout and placement

- **Decision**: Surface pinned tokens as a compact, horizontally oriented control in or near the main header/navigation, optimized for quick reissue rather than full details.
- **Rationale**: Users reach for pinned items as a starting point; placing them near the top-level navigation keeps them visible without consuming vertical space in the main content areas. A compact layout works well for the hard limit of five entries.
- **Alternatives considered**:
  - Embedding pinned items in the sidebar or history list (rejected: harder to scan and less “instant access”).
  - Displaying pinned items as a dedicated page (rejected: adds navigation friction and duplicates favorites UI).

## 3. Sorting and limit behavior

- **Decision**: Enforce a maximum of five pinned entries, ordered by `pinnedAt` descending, and treat “pinned” as a primary sort key in favorites with secondary sort by favorites recency.
- **Rationale**: A strict cap keeps the pinned area visually manageable and encourages deliberate curation. Recency-based ordering aligns with how users tend to reissue tokens and ensures new pins are immediately discoverable.
- **Alternatives considered**:
  - Allowing more than five pinned entries (rejected: clutter and layout constraints in the header).
  - Alphabetical ordering (rejected: harder to predict when the same targets are repinned frequently).

## 4. Relationship between pinned and favorites

- **Decision**: Treat pinned as a strict subset of favorites: pinning a non-favorite first favorites it; unpinning never removes the favorite; deleting/unfavoriting a favorite automatically unpins it.
- **Rationale**: This mental model is easy to explain (“pinned is just ‘top favorites’”), prevents orphaned pins, and keeps backup/restore, history actions, and favorites management aligned.
- **Alternatives considered**:
  - Allowing pinned entries to exist independently of favorites (rejected: double configuration surfaces and higher risk of desynchronization).
  - Preventing delete/unfavorite operations while an item is pinned (rejected: adds friction and forces extra steps for cleanup).

## 5. Empty, error, and overflow states

- **Decision**: Hide or visually soften the pinned area when no entries exist, with lightweight affordances (e.g., tooltip/empty-state hint) from existing favorites/history controls; treat any attempt to exceed the five-item limit as a non-destructive, clearly messaged action.
- **Rationale**: Avoids visual noise for first-time or light users while still making the feature discoverable. Limit feedback keeps the cap obvious without interrupting flow.
- **Alternatives considered**:
  - Always showing a large empty state in the header (rejected: steals space and distracts from primary flows).
  - Silently ignoring additional pin attempts beyond five (rejected: confusing and hard to diagnose).

## 6. Persistence and backup/restore behavior

- **Decision**: Persist `isPinned` and `pinnedAt` as additional fields on favorite entries so that pinned status participates in the existing IndexedDB backup/export/import flow.
- **Rationale**: Reuses the established data-export semantics (replace JSON backup) without introducing a new storage surface. Users who back up their configuration naturally retain pinned choices.
- **Alternatives considered**:
  - Storing pinned status in a separate localStorage key (rejected: split persistence and more complex restore semantics).
  - Treating pinned status as ephemeral and not preserved across sessions (rejected: undermines the feature’s value for power users).
