# Contracts: Pinned Tokens in Navigation

This feature does not introduce new server-side APIs or external integrations. All behavior for pinned tokens is implemented within the existing client-side application and its local persistence.

## Interaction Surfaces (Conceptual Contracts)

### 1. Favorites and History Actions

- **Pin**
  - **Input**: A token context that is eligible to be favorited (client, resource, token type, and any additional parameters already supported by favorites).
  - **Preconditions**:
    - The token is either already favorited, or the system can create a favorite for it.
    - The global pinned cap of five entries has not been exceeded.
  - **Behavior**:
    - If not already favorited, create a favorite entry.
    - Set `isPinned = true` and `pinnedAt = now` on the favorite, subject to the five-entry limit.
  - **Postconditions**:
    - The pinned navigation view includes the favorite if the cap is not exceeded.

- **Unpin**
  - **Input**: A pinned favorite.
  - **Behavior**:
    - Set `isPinned = false` and clear or ignore `pinnedAt` for ordering.
  - **Postconditions**:
    - The favorite remains available in the favorites list but no longer appears in the pinned navigation view.

### 2. Pinned Navigation Reissue

- **Reissue from pinned**
  - **Input**: A pinned entry selected from the navigation.
  - **Behavior**:
    - Issues a new token using the same configuration as the underlying favorite (parameters, token type, and target).
  - **Postconditions**:
    - A new token result is surfaced in the main UI as if reissued from history or favorites.

## External Dependencies

- No additional HTTP endpoints, GraphQL schemas, or external services are required beyond those already used by the app for token issuance and Key Vault access.
- No new network calls are made as part of pin/unpin or pinned navigation interactions.
