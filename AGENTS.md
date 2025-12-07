# Repository Guidelines

## Context

- SvelteKit 2 app using Svelte 5 runes and TypeScript. UI is built from shadcn components plus custom layout pieces and feature-specific components.
- **Multi-app support**: Users can configure multiple Entra app registrations through the UI. App configs are stored in IndexedDB; credentials are stored in Azure Key Vault.
- **App tokens**: Server-side client credentials flow via `/api/token/app`. Supports both **client secrets** and **certificates from Azure Key Vault**. Certificate parsing supports both PEM and PKCS#12 formats with automatic OpenSSL fallback for modern encryption.
- **Credential paths**: App tokens can use local `.env` credentials (client secret or certificate path) for local development, or Azure Key Vault for production-ready secrets and certificates.
- **User tokens**: Client-side Authorization Code + PKCE flow via MSAL.js (`@azure/msal-browser`). Supports silent acquisition and popup fallback.
- **Authentication**: Users can explore the app without signing in. Sign-in is triggered as part of the user token flow when issuing tokens. A "Sign In" button in the header is available for manual sign-in.
- **Token status tracking**: Real-time expiry monitoring with color-coded badges (expired, expiring, valid).
- **Full-screen token inspector**: Immersive token analysis view with ESC key support.
- **Favorites system**: Save frequently used targets with names, tags, colors, and descriptions for quick access and reissue.
- **Dynamic routing**: First-time users (no apps configured) are redirected to the Apps page; returning users land on Playground.
- **Data portability**: Local backup/restore for IndexedDB data (history, favorites, preferences, app configs) via Settings import/export with validation and replace semantics.
- Tokens and history live only in `IndexedDB` (via `idb-keyval`); secrets stay in Azure Key Vault and server-side. Avoid logging tokens or secrets in client or server code.

## Project Structure & Module Organization

- `src/routes/+page.svelte` is the Playground dashboard (flows, decoded output, floating panel, history preview). Includes redirect to the Apps page if no apps are configured.
- `src/routes/apps/+page.svelte` — Apps management and onboarding page with first-app flow and credential health checks.
- **Multi-app management**: `src/lib/states/app-registry.svelte.ts` manages app configurations. `src/lib/components/app-selector.svelte`, `src/lib/components/app-form-dialog.svelte`, and `src/lib/components/apps-table.svelte` provide the UI.
- **Client-side Auth**: `src/lib/services/auth.ts` (MSAL wrapper), `src/lib/stores/auth.ts` (auth state), `src/routes/auth/callback/+page.svelte` (redirect handler).
- **Server routes**: `src/routes/api/token/app/+server.ts` (confidential client tokens), `src/routes/api/apps/validate/+server.ts` (Key Vault validation for app config), `src/routes/api/health/+server.ts` (server/env credential health and setup guidance).
- Supporting pages: `src/routes/history/+page.svelte` (local history), `src/routes/settings/+page.svelte` (theme, profile, data clearing, import/export), `src/routes/favorites/+page.svelte` (favorites management).
- **History management**: `src/lib/states/history.svelte.ts` manages state via a shared `HistoryState` class (Svelte 5 runes). `src/lib/services/history.ts` handles `idb-keyval` persistence. `src/lib/components/HistoryList.svelte` is the shared UI component.
- **Favorites management**: `src/lib/states/favorites.svelte.ts` manages favorites state via a shared `FavoritesState` class (Svelte 5 runes). `src/lib/services/favorites.ts` handles `idb-keyval` persistence with CRUD operations. `src/lib/components/FavoritesList.svelte` is the main UI component.
- **UI Components** (`src/lib/components/`):
  - `app-selector.svelte` — Header dropdown for switching between configured apps.
  - `app-management-sheet.svelte` — Slide-out panel for CRUD operations on app configurations.
  - `DecodedClaims.svelte` — Searchable, filterable claims viewer with important/all toggle and per-claim copy.
  - `TokenFullScreenView.svelte` — Immersive full-screen token inspector with raw token, decoded claims, and scopes.
  - `TokenStatusBadge.svelte` — Real-time status indicators based on token expiry.
  - `HistoryList.svelte` — Shared history list with Load, Reissue, Delete, search/filter/sort, and status-aware styling.
  - `FavoritesList.svelte` — Favorites management with advanced filtering and bulk operations.
  - `FavoriteFormSheet.svelte` — Form for creating and editing favorites.
  - Collapsible primitives: `shadcn/components/ui/collapsible/{collapsible.svelte,collapsible-content.svelte,collapsible-trigger.svelte}`.
  - Layout: `app-header.svelte`, `app-sidebar.svelte`, `app-footer.svelte`, `UserMenu.svelte`.
- **State management**: Svelte 5 runes-based state in `src/lib/states/`; reactive time store in `src/lib/stores/time.ts` for real-time expiry updates.
- **Server-side Key Vault**: `src/lib/server/keyvault.ts` for certificates and secrets, `src/lib/server/keyvault-validator.ts` for validating app configs, `src/lib/server/certificate.ts` for certificate parsing with OpenSSL fallback, and `src/lib/server/msal.ts` for confidential client token acquisition using `@azure/msal-node`.
- Shared logic/UI in `src/lib` (`shadcn/` for shadcn-svelte primitives, `utils.ts` for JWT/expiry/status helpers, `types.ts` for TypeScript interfaces, `services/data-export.ts` for IndexedDB backup/restore). Keep server imports out of client modules.
- Global shell and styles: `src/app.html`, `src/app.css`; static assets live in `static/`.
- Type configuration extends SvelteKit defaults via `tsconfig.json`; use the `$lib` alias.

## Build, Test, and Development Commands

- `pnpm install` — install dependencies (pnpm is required).
- `pnpm dev` — start the dev server with HMR on the port defined in `.env` (default 5173).
- `pnpm check` — run `svelte-kit sync` plus `svelte-check` with strict TS settings; fix these before commits.
- `pnpm check:watch` — run type checking in watch mode for rapid feedback during development.
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
- Smoke test both flows from the Playground page, ensure decoded claims render, and confirm history entries appear and can be managed.
- **Multi-app**: Test adding, editing, switching, and deleting apps. Verify Key Vault validation works (success and error states).
- **Token status badges**: Verify expired, expiring, and valid states display with correct colors and update in real-time.
- **Full-screen token view**: Test launch (via button), ESC key exit, and that all sections render correctly.
- **Decoded claims**: Test search functionality, Important/All filter toggle, and per-claim copy actions.
- **History management**: Verify Load displays full token details, Reissue issues new tokens, Delete removes items, and the history toolbar search/filter/sort behave correctly.
- **Favorites management**: Test creating, editing, and deleting favorites. Verify filtering and bulk operations work.
- **Real-time updates**: Confirm token expiry status updates every minute; expired/expiring tokens show prominent reissue buttons.
- **Dynamic routing**: Verify first-time users (no apps) are redirected to the Apps page; returning users land on Playground.
- Sanity check theme, data clearing, and import/export under `/settings`. Export should download JSON; import should preview counts and replace current data without errors.

## Commit & Pull Request Guidelines

- Follow the existing Conventional Commit style seen in history (`feat: ...`, `chore: ...`, `refactor: ...`). Keep subjects in the imperative and under ~70 chars.
- PRs should describe the change, list testing performed (commands + manual steps), and link related issues. Include before/after screenshots or a short clip for UI changes.
- Keep changes scoped; prefer separate PRs for refactors vs. feature work to simplify review.

## Security & Configuration Tips

- Copy `.env.example` to `.env` and set `PORT` and `REDIRECT_URI` for server configuration.
- **App credentials**: For production, store credentials in Azure Key Vault (secret or certificate). For local development you may use `CLIENT_SECRET` or `CERTIFICATE_PATH` in `.env`; never commit these.
- The app only stores tenant/client IDs and per-app metadata in IndexedDB; secrets and certificates stay in environment variables or Azure Key Vault.
- **Adding apps via UI**: When no apps exist, use the **Connect Client App** button in the header or open `/apps` → enter Entra details and Key Vault or local credential configuration. The app validates Key Vault access before saving.
- **Key Vault setup**: Create a Key Vault, store your client secret or certificate, and grant your identity access (Key Vault Administrator or appropriate read roles).
- **OpenSSL requirement**: Modern PKCS#12 certificates (e.g., Azure Key Vault self-signed) use AES-256-CBC encryption. OpenSSL CLI is used as a fallback when the pure-JS parser can't handle them.
- `REDIRECT_URI` should match the Entra registration; if omitted, the app falls back to `${origin}/auth/callback`.
- Do not commit `.env` or real secrets.
- Treat access tokens as sensitive: avoid logging them.
- **App Tokens**: Keep token exchange logic server-side (see `src/lib/server/keyvault.ts` and `src/lib/server/certificate.ts`).
- **User Tokens**: MSAL.js handles storage (localStorage by default). Ensure no XSS vulnerabilities as tokens are accessible to client-side scripts.
- MSAL.js cache is kept in `localStorage` for smoother reuse between navigations; logout and cache-clearing paths should wipe both localStorage and sessionStorage keys prefixed with `msal.` or the client ID.
- Local history/preferences/app configs stay in the browser (IndexedDB); remind users to clear data on shared machines.

## Active Technologies
- SvelteKit 2, Svelte 5 runes, shadcn components, `idb-keyval` for IndexedDB persistence, existing favorites/history state modules (001-pinned-tokens)
- Browser IndexedDB for favorites/history/preferences/app configs; localStorage/sessionStorage for MSAL cache; no new server-side persistence for pinned metadata (001-pinned-tokens)

## Recent Changes
- 001-pinned-tokens: Added SvelteKit 2, Svelte 5 runes, shadcn components, `idb-keyval` for IndexedDB persistence, existing favorites/history state modules
