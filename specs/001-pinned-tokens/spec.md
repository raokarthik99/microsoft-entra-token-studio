# Feature Specification: Pinned Tokens in Navigation

**Feature Branch**: `[001-pinned-tokens]`  
**Created**: 2025-12-06  
**Status**: Draft  
**Input**: User description: "I want to create a new feature called as Pinned tokens. So tokens which are favorited can be pinned to the navbar for quicker access/reissue flow. A max of 5 entries (unique clientId-resource pair only should considered for pinned just like what we consider for favorited) is allowed for pinned. Further, Pinned should be available as an option in both the token result (and mini-dock and full screen views) along with favorite. It should be available in history/recent activity item list action menu as well along with favorite. But internally, pinned should first add to favorites and then pin to nav bar and unpin should just unpin from navbar but keep it favorited. Further, favorites list should by default sort pinned ones at top (with latest pinned being at the top most) --> maybe we can use a dedicated flag and sort on it by default and then do a secondary sort on recently added to favorite (internally pinned should be sorted by recently added itself). Use your further UI/UX judgement, knowledge, expertise to craft out an excellent spec for this feature to bring in delight, ease-of-use and wow factor to the end-user."

## Constitution Guardrails *(must remain true)*

- Local-only, single-user runtime; no hosted multi-tenant deployment or telemetry that can carry tokens/credentials.
- Secrets stay server-side (env/Key Vault); client artifacts never log or persist raw tokens outside IndexedDB history as intended by the app.
- Stack discipline: SvelteKit 2 + Svelte 5 runes + TypeScript; reuse shadcn components and `$lib` utilities; keep `$lib/server` imports out of client modules.
- UX guardrails: first-time redirect to Apps, Key Vault validation before saving app configs, reliable multi-app switching, real-time expiry status, and safe token viewers/history/favorites handling.
- Quality gates: plan for `pnpm check`, `pnpm build`, and manual smoke coverage of token issuance (app + user), decoded claims search/filter, history load/reissue/delete, favorites CRUD/bulk delete, fullscreen token view, and settings export/import with replace semantics.

## Clarifications

### Session 2025-12-06

- Q: When a pinned token's favorite is unfavorited or deleted, what happens to the pinned entry? → A: Automatically unpin and remove the pinned entry when its favorite is removed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin favorite tokens for instant reissue (Priority: P1)

As a frequent user of specific token targets,  
I want to pin my most-used favorite tokens into a compact navigation area,  
so that I can reissue them instantly without scrolling or reopening history.

**Why this priority**: This delivers an immediate productivity boost for power users who repeatedly issue the same tokens, reducing friction and time-to-token on every visit.

**Independent Test**: This story is testable by enabling pin actions on existing favorites, verifying that pins appear in the navigation area with a maximum of five unique entries, and confirming that reissuing a pinned token works end-to-end without using history or the main token forms.

**Acceptance Scenarios**:

1. **Given** a token that is already favorited, **When** the user chooses “Pin” from an available action surface, **Then** that token appears in a dedicated pinned area near the primary navigation with its label and key context (such as target name and token type).
2. **Given** five tokens already pinned, **When** the user tries to pin a sixth distinct favorite, **Then** the system clearly communicates that only five pinned entries are allowed and offers guidance to unpin or replace an existing entry.
3. **Given** a pinned token visible in the navigation, **When** the user triggers the primary action on that pinned entry, **Then** the system initiates the appropriate reissue flow with pre-filled parameters and surfaces the new token result as if reissued from history or favorites.

---

### User Story 2 - Pin from token details and history (Priority: P2)

As a user exploring tokens from different entry points,  
I want a consistent way to pin from token result views, mini-dock, fullscreen views, and history lists,  
so that I can promote any useful token to my pinned set at the moment I realize it is important.

**Why this priority**: Users often decide that a token is “important” in context (for example, after inspecting claims or seeing how often they reissue it), so the ability to pin from all relevant views reduces context switching and missed opportunities.

**Independent Test**: This story is testable by pinning and unpinning tokens from each supported surface (token result, mini-dock, fullscreen inspector, history/recent activity actions), and verifying that the pinned navigation area and favorites list update consistently.

**Acceptance Scenarios**:

1. **Given** a token displayed in the main result panel or mini-dock, **When** the user selects a “Pin” action alongside the existing “Favorite” control, **Then** the token is favorited if it is not already, and also appears in the pinned navigation area.
2. **Given** a token displayed in the fullscreen inspector, **When** the user selects “Pin” from the inspector’s action region, **Then** the token is favorited (if not already) and appears in the pinned navigation area without leaving the fullscreen view.
3. **Given** a token entry in the history or recent activity list, **When** the user selects “Pin” from its contextual actions, **Then** the token becomes both a favorite and pinned, and the pinned navigation area reflects the change within a single interaction.

---

### User Story 3 - Manage and understand pinned vs favorite tokens (Priority: P3)

As a user organizing my commonly used tokens,  
I want a clear distinction and predictable behavior between “favorite” and “pinned”,  
so that I understand how many slots I have, how items are ordered, and what happens when I unpin.

**Why this priority**: Clarity around the relationship between favorites and pinned entries prevents confusion, accidental loss of state, and surprises when tokens are removed or reordered.

**Independent Test**: This story is testable by pinning and unpinning tokens, observing the favorites list ordering, confirming that unpinning does not remove favorites, and verifying how recency and pinned status affect ordering.

**Acceptance Scenarios**:

1. **Given** a favorite token that the user pins, **When** the user later unpins it from any pin control, **Then** the token is removed from the pinned navigation area but remains in the favorites list.
2. **Given** multiple pinned tokens, **When** the user pins a new favorite, **Then** the pinned set is ordered such that the most recently pinned tokens appear first, up to the five-entry limit.
3. **Given** a favorites list containing both pinned and non-pinned entries, **When** the user views the favorites list without custom sorting, **Then** pinned favorites appear at the top (ordered by most recently pinned), followed by non-pinned favorites ordered by when they were most recently added to favorites.

### Edge Cases

- What happens when the user attempts to pin more than five distinct favorites at once (for example, via rapid repeated actions or concurrent sessions)?
- How does the system behave when multiple favorites share the same underlying client-and-resource combination (only one should be eligible as a unique pinned entry)?
- When the underlying favorite for a pinned token is unfavorited or deleted, the system automatically unpins it and removes it from the pinned area so that no orphaned pins remain.
- How does the interface respond when no tokens are pinned (for example, whether the pinned area is hidden, collapsed, or includes a gentle onboarding hint)?
- How are pinned tokens represented when there is insufficient horizontal space in the navigation (for example, overflow behavior, truncation, or summarizing into a compact control)?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The system MUST allow users to mark any eligible token as a favorite from token result views, mini-dock, fullscreen inspector, and history/recent activity lists, if not already favorited.
- **FR-002**: The system MUST allow users to pin a token into a dedicated pinned area from token result views, mini-dock, fullscreen inspector, and history/recent activity lists, using a clearly labeled action that is visually paired with the favorite control.
- **FR-003**: When a user pins a token that is not yet favorited, the system MUST first convert it into a favorite and THEN mark it as pinned, without requiring two separate user actions.
- **FR-004**: The system MUST enforce a maximum of five pinned entries, where each pinned entry corresponds to a unique client-and-resource combination, matching the uniqueness rules used for favorites.
- **FR-005**: When the pinned limit is reached and the user attempts to pin another distinct favorite, the system MUST prevent the new pin and surface a clear, non-technical explanation that only five pinned tokens are allowed, with guidance to unpin or replace an existing entry.
- **FR-006**: The system MUST provide an unpin action for each pinned entry that removes it from the pinned area while keeping it in the favorites list.
- **FR-007**: The system MUST order pinned entries by the time they were most recently pinned, with the most recently pinned entry appearing first.
- **FR-008**: The system MUST order the default favorites list view so that pinned favorites appear first (ordered by most recently pinned), followed by non-pinned favorites ordered by when they were most recently favorited.
- **FR-009**: The system MUST ensure that any reissue action triggered from a pinned entry behaves identically to reissuing from the corresponding favorite or history item, including the use of the same parameters and target.
- **FR-010**: The system MUST provide clear, discoverable visual cues that distinguish pinned favorites from non-pinned favorites in lists, without relying solely on color (for accessibility).
- **FR-011**: The system MUST avoid introducing additional modal confirmations for pin and unpin actions in the core flow, keeping the experience fast while making reversals (unpinning) easy.
- **FR-012**: The system MUST keep pinned and favorite metadata consistent across all screens that reference them, so that changes in one place (for example, unpin from navigation) are immediately reflected in history actions and lists.
- **FR-013**: The system MUST automatically unpin and remove a pinned entry whenever its underlying favorite is unfavorited or deleted, ensuring the pinned area never references non-existent favorites.

### Key Entities *(include if feature involves data)*

- **Favorite Token Entry**: Represents a saved configuration for issuing a token to a specific target (for example, a combination of token type, client, and resource), including descriptive labels and any user-defined tags or colors.
- **Pinned Token Entry**: Represents a favorite token that has been promoted into the pinned navigation area. It references a single favorite token entry, includes a timestamp for when it was most recently pinned, and is constrained to at most five unique client-and-resource combinations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability test, at least 90% of participants who frequently reissue the same tokens complete a reissue from a pinned entry in under 10 seconds from landing on the main screen.
- **SC-002**: At least 80% of users in qualitative feedback report that they understand the difference between “favorite” and “pinned” after using the feature, without needing separate documentation.
- **SC-003**: At least 90% of pin and unpin interactions behave as expected in manual testing, with changes reflected consistently in the pinned navigation area, favorites list, and history actions.
- **SC-004**: No more than 1% of sessions in internal testing exhibit confusion or errors related to the five-entry limit (for example, testers are surprised by why an item does not pin) after the limit messaging is applied.
- **SC-005**: During manual exploratory testing, no defects are found where pinning or unpinning leads to loss of a favorite, incorrect reissue behavior, or disappearance of an expected entry from favorites or history.

## Assumptions

- Pinned entries are primarily intended for individual users who frequently work with a small set of recurring targets; there is no requirement for sharing pinned sets across users or devices.
- The pinned navigation area can adapt its layout (for example, collapsing or scrolling) on smaller screens without changing the core behavior of how many tokens can be pinned or how they are ordered.
- The rules for what constitutes a unique client-and-resource combination remain aligned with the existing favorites logic, and changes to that logic in the future will apply consistently to both favorites and pinned entries.
