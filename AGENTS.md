# Repository Guidelines

## Context
- SvelteKit 2 app using Svelte 5 runes and TypeScript. UI is built from shadcn components plus custom layout pieces and feature-specific components.
- **App tokens**: Server-side client credentials flow via `/api/token/app`.
- **User tokens**: Client-side Authorization Code + PKCE flow via MSAL.js (`@azure/msal-browser`). Supports silent acquisition and popup fallback.
- **Authentication**: Embedded user authentication (Single-Page Application model). Users sign in to the app to access the Playground.
- **Token status tracking**: Real-time expiry monitoring with color-coded badges (expired, expiring, valid).
- **Full-screen token inspector**: Immersive token analysis view with ESC key support.
- Readiness is surfaced through `/api/health` and mirrored on the home page Setup card.
- Tokens and history live only in `IndexedDB` (via `idb-keyval`); secrets stay server-side. Avoid logging tokens or secrets in client or server code.

## Project Structure & Module Organization
- `src/routes/+page.svelte` is the Playground dashboard (setup checks, flows, decoded output, floating panel, history preview).
- **Client-side Auth**: `src/lib/services/auth.ts` (MSAL wrapper), `src/lib/stores/auth.ts` (auth state), `src/routes/auth/callback/+page.svelte` (redirect handler).
- **Server routes**: `src/routes/api/token/app/+server.ts` (confidential client tokens), `src/routes/api/health/+server.ts` (config check).
- Supporting pages: `src/routes/history/+page.svelte` (local history) and `src/routes/settings/+page.svelte` (theme, profile, data clearing).
- **History management**: `src/lib/states/history.svelte.ts` manages state via a shared `HistoryState` class (Svelte 5 runes). `src/lib/services/history.ts` handles `idb-keyval` persistence. `src/lib/components/HistoryList.svelte` is the shared UI component used across main page and history page.
- **UI Components** (`src/lib/components/`):
  - `DecodedClaims.svelte` — Searchable, filterable claims viewer with important/all toggle and per-claim copy.
  - `TokenFullScreenView.svelte` — Immersive full-screen token inspector with raw token, decoded claims, and scopes.
  - `TokenStatusBadge.svelte` — Real-time status indicators based on token expiry.
  - `HistoryList.svelte` — Shared history list with Load, Reissue, Delete, search/filter/sort, and status-aware styling.
  - `history-table/data-table-actions.svelte` — Row action menu for copy/load/reissue/delete.
  - Layout: `app-header.svelte`, `app-sidebar.svelte`, `app-footer.svelte`, `LoginScreen.svelte`, `UserMenu.svelte`.
- **State management**: Svelte 5 runes-based state in `src/lib/states/`; reactive time store in `src/lib/stores/time.ts` for real-time expiry updates.
- Shared logic/UI in `src/lib` (`shadcn/` for shadcn-svelte primitives, including table components under `components/ui/table`; `utils.ts` for JWT/expiry/status helpers, `types.ts` for TypeScript interfaces, server-only MSAL helpers in `server/msal.ts`). Keep server imports out of client modules.
- Global shell and styles: `src/app.html`, `src/app.css`; static assets live in `static/`.
- Type configuration extends SvelteKit defaults via `tsconfig.json`; use the `$lib` alias.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies (pnpm is required).
- `pnpm dev` — start the dev server with HMR on the port defined in `.env` (default 5173).
- `pnpm check` — run `svelte-kit sync` plus `svelte-check` with strict TS settings; fix these before commits.
- `pnpm build` — production build; use this to verify SSR/build stability before releasing.
- `pnpm preview` — serve the built app locally to sanity-check deployment output.

## Coding Style & Naming Conventions
- TypeScript-first with Svelte 5 runes; prefer 2-space indentation and follow existing semicolon usage.
- Components: PascalCase Svelte components in `src/lib/components` and `src/lib/shadcn`, exported via `src/lib/index.ts`. Utility functions and stores use `camelCase`.
- Keep server-only code in `src/lib/server`; do not import it into client modules to avoid bundling secrets.
- Reuse shadcn primitives and `cn` helper for class composition; avoid inline styles where utility classes exist.
- Keep flows small and focused; prefer extracting shared UI/logic into `$lib` rather than duplicating across routes.

## Testing Guidelines
- No automated tests yet; rely on `pnpm check` plus manual verification.
- Smoke test both flows from the home page, ensure decoded claims render, and confirm history entries appear and can be managed.
- **Token status badges**: Verify expired, expiring, and valid states display with correct colors and update in real-time.
- **Full-screen token view**: Test launch (via button), ESC key exit, and that all sections (raw token, scopes, decoded claims) render correctly.
- **Decoded claims**: Test search functionality, Important/All filter toggle, and per-claim copy actions.
- **History management**: Verify Load displays full token details, Reissue issues new tokens, Delete removes items, and the history toolbar search/filter/sort behave correctly.
- **Real-time updates**: Confirm token expiry status updates every minute; expired/expiring tokens show prominent reissue buttons.
- Validate readiness with `/api/health` and the Setup card once `.env` is populated (tenant/client/redirect).
- Sanity check theme and data clearing under `/settings` when touching local storage logic.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit style seen in history (`feat: ...`, `chore: ...`, `refactor: ...`). Keep subjects in the imperative and under ~70 chars.
- PRs should describe the change, list testing performed (commands + manual steps), and link related issues. Include before/after screenshots or a short clip for UI changes.
- Keep changes scoped; prefer separate PRs for refactors vs. feature work to simplify review.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and fill `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`; do not commit `.env` or real secrets.
- `REDIRECT_URI` should match the Entra registration; if omitted, the app falls back to `${origin}/auth/callback`.
- Treat access tokens as sensitive: avoid logging them.
- **App Tokens**: Keep token exchange logic server-side (see `src/lib/server/msal.ts`).
- **User Tokens**: MSAL.js handles storage (localStorage/sessionStorage). Ensure no XSS vulnerabilities as tokens are accessible to client-side scripts.
- Local history/preferences stay in the browser (IndexedDB); remind users to clear data on shared machines when changing those flows.
