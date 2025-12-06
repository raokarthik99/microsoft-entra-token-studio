# Implementation Plan: Pinned Tokens in Navigation

**Branch**: `[001-pinned-tokens]` | **Date**: 2025-12-06 | **Spec**: `specs/001-pinned-tokens/spec.md`
**Input**: Feature specification from `specs/001-pinned-tokens/spec.md`

**Note**: This plan is generated from the feature spec and constitution. It focuses on extending existing favorites/history behavior and navigation UI without introducing new back-end endpoints or storage.

## Summary

Add a “Pinned tokens” experience that lets users promote up to five favorite token targets into a compact navigation surface for instant reissue. Pinning is available from token result views (including mini-dock and fullscreen inspector) and history/recent activity lists, always treating pinned entries as a thin layer on top of favorites (pin implicitly favorites first; unpin removes only the pin, not the favorite).

Implementation will extend the existing favorites state (and IndexedDB persistence) with pinned metadata, introduce a pinned area in the primary navigation that surfaces at most five entries ordered by most recently pinned, and adjust favorites list sorting so pinned favorites appear first. No new API routes or secret storage are added; all behavior is client-side and respects existing security and local-only guarantees.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5.43, SvelteKit 2.48 on Node.js 18+  
**Primary Dependencies**: SvelteKit 2, Svelte 5 runes, shadcn components, `idb-keyval` for IndexedDB persistence, existing favorites/history state modules  
**Storage**: Browser IndexedDB for favorites/history/preferences/app configs; localStorage/sessionStorage for MSAL cache; no new server-side persistence for pinned metadata  
**Testing**: `pnpm check` (SvelteKit sync + svelte-check) plus manual smoke tests across app token, user token, history, favorites, fullscreen viewer, and settings flows  
**Target Platform**: Local SvelteKit dev/preview server in modern desktop browsers on a single developer-controlled machine  
**Project Type**: Single SvelteKit web application (frontend + server routes in one project)  
**Performance Goals**: Pinned area updates and favorites list resorting feel instant for up to five pinned entries and typical favorites volumes; no noticeable layout shifts when pinning/unpinning  
**Constraints**: No logging or network transmission of tokens or credentials; pinned metadata must remain local-only and derived from existing favorites; changes must preserve first-time Apps redirect and multi-app token flows  
**Scale/Scope**: Single user per browser profile; pinned entries capped at five unique client-and-resource combinations; favorites/history volumes constrained by current UX rather than back-end limits

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Security: No flow stores or logs secrets/tokens outside IndexedDB or Azure Key Vault; server-only modules stay in `$lib/server`.
- Local-only: Plan assumes single-user, developer-controlled runtime (no hosted multi-user services or telemetry that transmits tokens/credentials).
- Stack discipline: Uses SvelteKit 2 + Svelte 5 runes + TypeScript; reuses shadcn components and `$lib` utilities.
- UX guardrails: Preserve first-time redirect to Apps, Key Vault validation before saving app configs, reliable multi-app switching, and real-time expiry status.
- Quality gates: Include `pnpm check`, `pnpm build`, and manual smoke coverage for app token issuance, user token issuance (silent + popup), decoded claims, history load/reissue/delete, favorites create/edit/bulk delete, fullscreen token view, and settings export/import (replace).

This feature operates entirely within the existing SvelteKit app and client-side favorites/history layers. Pinned metadata is stored alongside favorites in IndexedDB and never includes raw tokens or credentials. No new APIs, logging, or telemetry are introduced, and existing redirect, auth, and token-status behaviors remain intact. All gates are considered PASS; no constitution violations are expected.

## Project Structure

### Documentation (this feature)

```text
specs/001-pinned-tokens/
├── spec.md        # Feature requirements and user stories
├── plan.md        # This file (/speckit.plan output)
├── research.md    # Phase 0 decisions and design research
├── data-model.md  # Phase 1 conceptual data model
├── quickstart.md  # Phase 1 feature-focused quickstart
└── contracts/     # Phase 1 API/interaction contracts (none new for pinned)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── lib/
│   ├── components/        # Shared UI (history, favorites, token views, layout)
│   ├── states/            # Runes-based history, favorites, app registry state
│   ├── services/          # Auth, history, favorites, data export, Key Vault helpers
│   ├── stores/            # Time/auth and other Svelte stores
│   └── shadcn/            # UI primitives (buttons, sheets, popovers, etc.)
└── routes/
    ├── +page.svelte       # Playground dashboard (token flows, dock, history preview)
    ├── favorites/+page.svelte
    ├── history/+page.svelte
    ├── apps/+page.svelte
    ├── settings/+page.svelte
    └── favorites/& shared components used by pinned nav
```

**Structure Decision**: Single SvelteKit web app rooted at `src/`, with pinned tokens implemented as an extension of existing favorites/history state in `src/lib/states` and UI components in `src/lib/components` plus header/navigation layout files under `src/lib/components` and `src/routes`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | Pinned tokens operate within existing client-only favorites/history layers and SvelteKit app structure. | All requirements can be met without new services, storage, or cross-cutting complexity. |

## Implementation Phases & Core Steps

This section describes the concrete sequence of work and where to find supporting details for each step. `/speckit.tasks` will break these phases into executable tasks.

### Phase 0 — Research & Design Consolidation

1. **Confirm pinned model and constraints**  
   - Goal: Align the implementation on how pinned state is stored and limited.  
   - References:  
     - `specs/001-pinned-tokens/spec.md` — FR-004, FR-007, FR-008, FR-013; Edge Cases section.  
     - `specs/001-pinned-tokens/research.md` — Sections 1 (state), 3 (sorting/limit), 4 (relationship), 6 (persistence).  
     - `specs/001-pinned-tokens/data-model.md` — “Favorite Token Entry” and “Pinned Navigation View”.

2. **Confirm UX and entry points for pin/unpin**  
   - Goal: Decide exact UI affordances and message copy for each surface.  
   - References:  
     - `specs/001-pinned-tokens/spec.md` — User Stories 1–3; FR-001–FR-012; Success Criteria SC-001–SC-003.  
     - `specs/001-pinned-tokens/research.md` — Sections 2 (layout), 5 (empty/error/overflow).  
     - `specs/001-pinned-tokens/quickstart.md` — “Pinning Tokens”, “Using Pinned Tokens”, “Managing Pinned vs Favorites”.

### Phase 1 — State & Persistence Wiring

3. **Extend favorites domain model with pinned metadata**  
   - Goal: Add `isPinned` and `pinnedAt` (and any helper accessors) to the favorites state so pinned is a first-class flag.  
   - References:  
     - `data-model.md` — Favorite Token Entry (fields, validation, transitions).  
     - `research.md` — Sections 1 and 6 for rationale.  
     - Existing code: `src/lib/states/favorites.svelte.ts`, `src/lib/services/favorites.ts`.

4. **Derive pinned navigation view from favorites**  
   - Goal: Add derived selectors/computed values that expose an ordered list of pinned favorites (max five, newest first).  
   - References:  
     - `data-model.md` — “Pinned Navigation View (derived)”.  
     - `spec.md` — FR-004, FR-007, FR-008; Edge cases about limit and uniqueness.  
     - Existing code: wherever favorites lists are derived for `/favorites` and history surfaces.

5. **Ensure backup/restore preserves pinned flags**  
   - Goal: Confirm that existing IndexedDB export/import includes `isPinned` and `pinnedAt` and that replace semantics behave correctly.  
   - References:  
     - `data-model.md` — “Persistence & Backup/Restore”.  
     - `research.md` — Section 6.  
     - Existing code: `src/lib/services/data-export.ts`, favorites persistence in `src/lib/services/favorites.ts`.

### Phase 2 — UI Surfaces & Interaction Hooks

6. **Add pinned nav component and layout integration**  
   - Goal: Implement the compact pinned tokens surface in or near the header, consuming the derived pinned view.  
   - References:  
     - `research.md` — Section 2 (layout and placement).  
     - `quickstart.md` — “Using Pinned Tokens”.  
     - Existing code: `src/lib/components/app-header.svelte`, `src/lib/components/app-sidebar.svelte`, any shared nav components.

7. **Wire pin/unpin actions on token results & mini-dock**  
   - Goal: Expose a Pin/Unpin affordance where the user sees the latest token.  
   - References:  
     - `spec.md` — User Story 2; FR-001–FR-003, FR-006.  
     - `contracts/README.md` — “Favorites and History Actions / Pin, Unpin”.  
     - Existing code: token result panel and mini-dock components referenced from `src/routes/+page.svelte` and associated components under `src/lib/components`.

8. **Wire pin/unpin actions in fullscreen token inspector**  
   - Goal: Mirror the same Pin/Unpin affordance in the fullscreen view without forcing navigation away.  
   - References:  
     - `spec.md` — User Story 2; FR-002–FR-003, FR-006.  
     - `quickstart.md` — “Pinning Tokens” (fullscreen bullet).  
     - Existing code: `src/lib/components/TokenFullScreenView.svelte`.

9. **Wire pin/unpin actions from history/recent activity**  
   - Goal: Add Pin/Unpin to the history/recent item action menus in line with existing Favorite controls.  
   - References:  
     - `spec.md` — User Story 2; FR-001–FR-003, FR-012.  
     - `contracts/README.md` — “Favorites and History Actions / Pin”.  
     - Existing code: `src/lib/components/HistoryList.svelte` and related history item components.

10. **Update favorites list ordering and badges**  
   - Goal: Sort favorites so pinned items appear first (by `pinnedAt` desc) and visually distinguish pinned vs non-pinned favorites.  
   - References:  
     - `spec.md` — FR-007–FR-010; User Story 3; Success Criteria SC-001–SC-003.  
     - `data-model.md` — use of `pinnedAt` for ordering.  
     - Existing code: `src/lib/components/FavoritesList.svelte`, favorites sorting logic in state/services.

### Phase 3 — Polishing, Testing & Constitution Gates

11. **Edge cases: limits, deletion, and invalid favorites**  
   - Goal: Verify behaviors when the limit is reached, favorites are deleted/unfavorited, or configurations become invalid.  
   - References:  
     - `spec.md` — Edge Cases section; FR-004, FR-005, FR-013.  
     - `research.md` — Sections 3, 4, 5.  

12. **Manual quickstart and smoke tests**  
   - Goal: Walk through the pinned quickstart and overall app smoke tests under the constitution.  
   - References:  
     - `quickstart.md` — all sections.  
     - `.specify/memory/constitution.md` — “Quality Gates & Observability Hygiene”.  

13. **Update docs and screenshots as needed**  
   - Goal: Reflect the pinned tokens feature in README or UI docs once implementation stabilizes.  
   - References:  
     - `spec.md` — Success Criteria SC-002–SC-005 as guidance for what to demonstrate.  
     - `quickstart.md` — base flow that can be turned into README snippets or screenshots.
