---

description: "Task list for implementing pinned tokens in navigation"
---

# Tasks: Pinned Tokens in Navigation

**Input**: Design documents from `/specs/001-pinned-tokens/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: No automated tests requested; validation is via `pnpm check`, `pnpm build`, and manual smoke tests described in the constitution and quickstart.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Constitution Alignment

- Keep runtime local-only and single-user; do not introduce hosted services or telemetry that could transmit tokens/credentials.
- Secrets stay server-side (env/Key Vault); avoid logging tokens/secrets in client or server outputs.
- Use SvelteKit 2 + Svelte 5 runes + TypeScript; reuse shadcn components and `$lib` utilities; keep `$lib/server` imports out of client code.
- Include tasks for `pnpm check`, `pnpm build`, and manual smoke coverage of app/user token flows, decoded claims filters, history load/reissue/delete, favorites CRUD/bulk delete, fullscreen token view, settings export/import (replace), and the new pinned tokens flows.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing favorites/history infrastructure and navigation layout context for the pinned tokens feature.

- [X] T001 Review existing favorites and history state implementation in `src/lib/states/favorites.svelte.ts` and `src/lib/states/history.svelte.ts` to understand current fields and flows.
- [X] T002 Review favorites and history UI components in `src/lib/components/FavoritesList.svelte` and `src/lib/components/HistoryList.svelte` to identify where pin/unpin actions will attach.
- [X] T003 Review header/navigation layout in `src/lib/components/app-header.svelte` and related layout components to choose the pinned nav placement.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core state and persistence changes that MUST be complete before any user story can be implemented.

- [X] T004 Add `isPinned` and `pinnedAt` fields to the favorites domain model and state in `src/lib/states/favorites.svelte.ts` following `specs/001-pinned-tokens/data-model.md`.
- [X] T005 Update favorites persistence in `src/lib/services/favorites.ts` to read/write `isPinned` and `pinnedAt` to IndexedDB, keeping export/import compatible with existing data.
- [X] T006 [P] Add a derived pinned favorites selector/helper in `src/lib/states/favorites.svelte.ts` that returns at most five entries ordered by `pinnedAt` descending.

**Checkpoint**: Favorites state and persistence support pinned metadata; user story work can now begin in parallel.

---

## Phase 3: User Story 1 - Pin favorite tokens for instant reissue (Priority: P1) 🎯 MVP

**Goal**: Allow users to pin favorites into a compact navigation surface and reissue tokens instantly from pinned entries.

**Independent Test**: A user can pin an existing favorite, see it in the pinned navigation area, and reissue a token from that pinned entry without using history or the main forms.

### Implementation for User Story 1

- [X] T007 [US1] Implement a `PinnedTokensNav` UI element in `src/lib/components/app-header.svelte` (or a new imported component under `src/lib/components/`) that renders the derived pinned favorites view.
- [X] T008 [US1] Wire reissue actions for pinned entries in `app-header.svelte` (or the pinned component) to call the existing reissue logic used by `FavoritesList.svelte` or `HistoryList.svelte`.
- [X] T009 [US1] Ensure the pinned nav updates reactively when `isPinned` / `pinnedAt` change in `src/lib/states/favorites.svelte.ts`, including the five-entry limit behavior.

**Checkpoint**: Pinned navigation shows up to five favorites, ordered by most recently pinned, and can reissue tokens end-to-end.

---

## Phase 4: User Story 2 - Pin from token details and history (Priority: P2)

**Goal**: Let users pin and unpin tokens from token result views, mini-dock, fullscreen inspector, and history/recent activity lists.

**Independent Test**: From any token surface (result, mini-dock, fullscreen, history), a user can pin or unpin a token and immediately see the pinned nav and favorites list reflect the change.

### Implementation for User Story 2

- [X] T010 [US2] Add Pin/Unpin actions alongside existing Favorite controls in the main token result UI component used by `src/routes/+page.svelte`, wiring them to favorites state updates in `src/lib/states/favorites.svelte.ts`.
- [X] T011 [US2] Add Pin/Unpin controls to the floating token dock in `src/lib/components/TokenDock.svelte`, reusing the same handlers and ensuring pinned nav updates.
- [X] T012 [US2] Add Pin/Unpin controls to `src/lib/components/TokenFullScreenView.svelte` so users can pin/unpin without leaving fullscreen, keeping state in sync with favorites.
- [X] T013 [US2] Extend history/recent item action menus in `src/lib/components/HistoryList.svelte` (and any row/action subcomponents) with Pin/Unpin actions that operate on the underlying favorite entry or create one if needed.

**Checkpoint**: All entry points can pin/unpin tokens, and changes are reflected consistently across pinned nav, favorites, and history.

---

## Phase 5: User Story 3 - Manage and understand pinned vs favorite tokens (Priority: P3)

**Goal**: Make the relationship between favorites and pinned tokens clear and predictable, including ordering and behavior when favorites are removed.

**Independent Test**: Users can clearly see which favorites are pinned, understand why items appear at the top of favorites, and observe predictable behavior when unpinning or deleting favorites.

### Implementation for User Story 3

- [X] T014 [US3] Update favorites ordering logic in `src/lib/components/FavoritesList.svelte` (and any supporting sort helpers) to place pinned favorites first by `pinnedAt` descending, followed by non-pinned favorites ordered by favorites recency.
- [X] T015 [US3] Add visual indicators (e.g., icon or badge) to favorites rows in `FavoritesList.svelte` to distinguish pinned favorites from non-pinned ones without relying solely on color.
- [X] T016 [US3] Ensure that deleting or unfavoriting a pinned favorite in `FavoritesList.svelte` and `HistoryList.svelte` automatically clears `isPinned` / `pinnedAt` so the pinned nav never shows orphaned entries.

**Checkpoint**: Favorites and pinned behavior is understandable and consistent, with clear ordering and automatic cleanup of pinned state.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story improvements, validation, and documentation updates.

- [X] T017 [P] Run `pnpm check` and `pnpm build` from the repository root to validate type-checking and build after pinned tokens changes.
- [ ] T018 Manually walk through the pinned tokens quickstart in `specs/001-pinned-tokens/quickstart.md`, covering pin/unpin from all surfaces and reissue from pinned entries.
- [X] T019 Update any relevant user-facing documentation or README sections that describe favorites or navigation to mention pinned tokens and their five-entry behavior (e.g., `README.md` and `/static` assets if screenshots are used).
- [X] T020 Perform a final pass over `src/lib/states/favorites.svelte.ts`, `src/lib/components/FavoritesList.svelte`, `src/lib/components/HistoryList.svelte`, and `src/lib/components/app-header.svelte` to ensure no sensitive data (tokens, secrets) is logged or exposed in new code paths.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies – can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion – BLOCKS all user stories.
- **User Stories (Phase 3–5)**: Depend on Foundational completion; can proceed in priority order (P1 → P2 → P3) or partially in parallel where files do not conflict.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2); provides the core pinned nav surface and reissue behavior.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2); depends on US1’s pinned nav only for final UX, but Pin/Unpin wiring can be developed in parallel.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2); builds on favorites ordering and pinned semantics but does not require US2’s UI wiring to exist.

### Within Each User Story

- Implement state and view model wiring before adding UI events.
- Add UI affordances and handlers before cross-surface consistency tweaks.
- Consider each story complete only when its independent test description in this file passes.

### Parallel Opportunities

- T004–T006 (Foundational state and selectors) can be split between developers as long as they coordinate on the favorites state shape.
- T007–T009 (US1) can proceed in parallel with T010–T013 (US2) after favorites state is stable, provided header and history components are edited carefully to avoid conflicts.
- T014–T016 (US3) can partially overlap with US2 once the `isPinned` / `pinnedAt` fields exist.
- T017–T020 (Polish) can largely be run in parallel after code is merged to a feature branch.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003).
2. Complete Phase 2: Foundational (T004–T006).
3. Complete Phase 3: User Story 1 (T007–T009).
4. **STOP and VALIDATE**: Verify that pinned nav shows up to five favorites, ordered correctly, and reissue works end-to-end.

### Incremental Delivery

1. Setup + Foundational → pinned metadata and selectors wired (T001–T006).
2. Add User Story 1 → functional pinned nav and reissue (T007–T009).
3. Add User Story 2 → full pin/unpin coverage on all surfaces (T010–T013).
4. Add User Story 3 → clarity and ordering refinements (T014–T016).
5. Polish → quality gates, docs, and security checks (T017–T020).

### Parallel Team Strategy

With multiple developers:

1. Complete Setup + Foundational together (T001–T006).
2. After Foundational:
   - Developer A: User Story 1 tasks (T007–T009).
   - Developer B: User Story 2 tasks (T010–T013).
   - Developer C: User Story 3 tasks (T014–T016).
3. Use Phase N tasks (T017–T020) as a shared final pass before merge.

---

## Notes

- All tasks follow the `- [ ] T### [P?] [US?] Description with file path` format.
- User story labels `[US1]`, `[US2]`, `[US3]` are used only in user story phases.
- Each user story is independently testable based on its “Independent Test” description.
