# Repository Guidelines

## Context

- SvelteKit 2 app using Svelte 5 runes and TypeScript. UI is built from shadcn components plus custom layout pieces and feature-specific components.
- **Two runtimes**:
  - **Web**: SvelteKit app with server routes under `src/routes/api/*`
  - **Desktop (experimental)**: Tauri 2 (Rust) + a Node.js sidecar for Azure SDK operations
- **Multi-app support**: Users can configure multiple Entra app registrations through the UI. App configs are stored in IndexedDB; credentials are stored in Azure Key Vault.
- **App tokens**: Client credentials flow via `POST /api/token/app` (web) or the Tauri sidecar (desktop). Supports Key Vault **client secrets** and **certificates**. For certificates, signing happens via Key Vault's `CryptographyClient`—the private key never leaves Key Vault.
- **Credential management**: App tokens use credentials stored exclusively in Azure Key Vault. For secrets, the backend fetches the value at runtime. For certificates, the backend requests a signature from Key Vault (private key never leaves). No local `.env` secrets are used for app tokens.
- **User tokens**:
  - Web: Authorization Code + PKCE via `@azure/msal-browser` (silent acquisition + popup fallback)
  - Desktop: Authorization Code + PKCE via `@azure/msal-node` in the sidecar (silent acquisition + system browser fallback)
- **Authentication UX**: Users can explore the app without signing in. Sign-in is triggered as part of the user token flow when issuing tokens (web popup or desktop system browser).
- **Token status tracking**: Real-time expiry monitoring with color-coded badges (expired, expiring, valid).
- **Full-screen token inspector**: Immersive token analysis view with ESC key support.
- **Favorites system**: Save frequently used targets with names, tags, colors, and descriptions for quick access and reissue.
- **Quick-pick inputs**: Resource and scope fields surface pinned favorites, recents, and Graph/Azure presets with admin-consent badges for sensitive scopes.
- **Dynamic routing**: First-time users (no apps configured) are redirected to the Apps page; returning users land on Playground.
- **Data portability**: Local backup/restore for IndexedDB data (history, favorites, preferences, app configs) via Settings import/export with validation and replace semantics.
- **Storage boundaries**: History/favorites/app configs live in IndexedDB (`idb-keyval`). Web MSAL cache uses `localStorage`; desktop MSAL cache is stored on disk by the sidecar (encrypted when possible). Secrets/certs stay in Azure Key Vault. Avoid logging tokens or secrets in any runtime.

## Project Structure & Module Organization

- `src/routes/+page.svelte` is the Playground dashboard (flows, decoded output, floating panel, history preview). Includes redirect to the Apps page if no apps are configured.
- `src/routes/apps/+page.svelte` — Apps management and onboarding page with first-app flow and credential health checks.
- **Multi-app management**: `src/lib/states/app-registry.svelte.ts` manages app configurations. `src/lib/components/app-selector.svelte`, `src/lib/components/app-form-dialog.svelte`, and `src/lib/components/apps-table.svelte` provide the UI.
- **Runtime-aware API**: `src/lib/services/tauri-api.ts` routes calls to web endpoints (web) or Tauri IPC (desktop). `src/lib/utils/runtime.ts` detects runtime.
- **Client-side Auth (web)**: `src/lib/services/auth.ts` (MSAL wrapper), `src/lib/stores/auth.ts` (auth state), `src/routes/auth/callback/+page.svelte` (redirect handler).
- **Desktop user state**: `src/lib/states/tauri-user.ts` stores user metadata from sidecar auth (no tokens persisted by this module).
- **Web server routes**: `src/routes/api/token/app/+server.ts` (app tokens), `src/routes/api/apps/validate/+server.ts` (Key Vault validation), `src/routes/api/health/+server.ts` (env/health guidance).
- Supporting pages: `src/routes/history/+page.svelte` (local history), `src/routes/settings/+page.svelte` (theme, profile, data clearing, import/export), `src/routes/favorites/+page.svelte` (favorites management).
- **History management**: `src/lib/states/history.svelte.ts` manages state via a shared `HistoryState` class (Svelte 5 runes). `src/lib/services/history.ts` handles `idb-keyval` persistence. `src/lib/components/HistoryList.svelte` is the shared UI component.
- **Favorites management**: `src/lib/states/favorites.svelte.ts` manages favorites state via a shared `FavoritesState` class (Svelte 5 runes). `src/lib/services/favorites.ts` handles `idb-keyval` persistence with CRUD operations. `src/lib/components/FavoritesList.svelte` is the main UI component.
- **Suggestions**: `src/lib/states/suggestions.svelte.ts` ranks quick-pick options from pinned favorites, history, and presets. `src/lib/data/scope-metadata.ts` holds Graph scope metadata plus scope/resource presets. `src/lib/components/SuggestionsInput.svelte` is the shared input used on Playground resource/scope fields.
- **UI Components** (`src/lib/components/`):
  - `app-selector.svelte` — Header dropdown for switching between configured apps.
  - `app-form-dialog.svelte` — Sheet for connecting/editing apps (includes Key Vault validation).
  - `apps-table.svelte` — App list + actions for multi-app management.
  - `DecodedClaims.svelte` — Searchable, filterable claims viewer with important/all toggle and per-claim copy.
  - `PinnedTokensNav.svelte` — Pinned favorites navigation (quick reissue).
  - `TokenDock.svelte` — Floating token dock for the active token.
  - `TokenFullScreenView.svelte` — Immersive full-screen token inspector with raw token, decoded claims, and scopes.
  - `TokenStatusBadge.svelte` — Real-time status indicators based on token expiry.
  - `HistoryList.svelte` — Shared history list with Load, Reissue, Delete, search/filter/sort, and status-aware styling.
  - `FavoritesList.svelte` — Favorites management with advanced filtering and bulk operations.
  - `FavoriteFormSheet.svelte` — Form for creating and editing favorites.
  - `SuggestionsInput.svelte` — Quick-pick input with keyboard navigation that prefers pinned favorites, recents, and presets.
  - Collapsible primitives: `shadcn/components/ui/collapsible/{collapsible.svelte,collapsible-content.svelte,collapsible-trigger.svelte}`.
  - Layout: `app-header.svelte`, `app-sidebar.svelte`, `app-footer.svelte`, `UserMenu.svelte`.
- **State management**: Svelte 5 runes-based state in `src/lib/states/`; reactive time store in `src/lib/stores/time.ts` for real-time expiry updates.
- **Server-side Azure/Key Vault (web)**: `src/lib/server/app-token-service.ts`, `src/lib/server/credential-fetcher.ts`, `src/lib/server/keyvault-signer.ts`, and `src/lib/server/keyvault-validator.ts`.
- **Legacy/env health helpers (web)**: `src/lib/server/msal.ts` and `src/lib/server/keyvault.ts` support env-var health checks and legacy flows; avoid extending these for new features.
- **Desktop backend**: `src-tauri/src/lib.rs` defines Tauri commands; `src-tauri/src/sidecar.rs` starts and manages the Node sidecar. The sidecar lives in `sidecar/` and exposes JSON-RPC methods from `sidecar/src/index.ts` and `sidecar/src/handlers/*`.
- Shared logic/UI in `src/lib` (`shadcn/` for shadcn-svelte primitives, `utils.ts` for JWT/expiry/status helpers, `types.ts` for TypeScript interfaces, `services/data-export.ts` for IndexedDB backup/restore). Keep server imports out of client modules.
- Global shell and styles: `src/app.html`, `src/app.css`; static assets live in `static/`.
- Type configuration extends SvelteKit defaults via `tsconfig.json`; use the `$lib` alias.

## Build, Test, and Development Commands

- `pnpm install` — install dependencies (pnpm is required).
- `pnpm dev` — start the dev server with HMR (default `5173`; required for `pnpm tauri:dev`).
- `pnpm check` — run `svelte-kit sync` plus `svelte-check` with strict TS settings; fix these before commits.
- `pnpm check:watch` — run type checking in watch mode for rapid feedback during development.
- `pnpm build` — production build; use this to verify SSR/build stability before releasing.
- `pnpm preview` — serve the built app locally to sanity-check deployment output.
- `pnpm tauri:dev` — run the desktop app (starts the web dev server via Tauri config).
- `pnpm tauri:build` — build desktop app installers (experimental).
- `pnpm sidecar:build` — build the Node.js sidecar (`sidecar/dist/index.js`) required by the desktop app.

## Coding Style & Naming Conventions

- TypeScript-first with Svelte 5 runes; prefer 2-space indentation and follow existing semicolon usage.
- Components: PascalCase Svelte components in `src/lib/components` and `src/lib/shadcn`, exported via `src/lib/index.ts`. Utility functions and stores use `camelCase`.
- Keep server-only code in `src/lib/server`; do not import it into client modules to avoid bundling secrets.
- Keep Tauri-only code behind runtime checks; dynamically import `@tauri-apps/api` only when `IS_TAURI` (see `src/lib/services/tauri-api.ts`).
- Reuse shadcn primitives and `cn` helper for class composition; avoid inline styles where utility classes exist.
- Keep flows small and focused; prefer extracting shared UI/logic into `$lib` rather than duplicating across routes.

## Testing Guidelines

- No automated tests yet; rely on `pnpm check` plus manual verification.
- Smoke test both flows from the Playground page, ensure decoded claims render, and confirm history entries appear and can be managed.
- Desktop smoke test: `pnpm sidecar:build` + `pnpm tauri:dev`, then verify app tokens, Key Vault validation, and user token flow (system browser).
- **Multi-app**: Test adding, editing, switching, and deleting apps. Verify Key Vault validation works (success and error states).
- **Token status badges**: Verify expired, expiring, and valid states display with correct colors and update in real-time.
- **Full-screen token view**: Test launch (via button), ESC key exit, and that all sections render correctly.
- **Decoded claims**: Test search functionality, Important/All filter toggle, and per-claim copy actions.
- **History management**: Verify Load displays full token details, Reissue issues new tokens, Delete removes items, and the history toolbar search/filter/sort behave correctly.
- **Favorites management**: Test creating, editing, and deleting favorites. Verify filtering and bulk operations work.
- **Quick-pick inputs**: Verify resource/scope inputs show pinned favorites first, include recents and presets (Graph scopes with admin badges, Azure resource presets), support keyboard navigation, and fill the form on selection.
- **Real-time updates**: Confirm token expiry status updates every minute; expired/expiring tokens show prominent reissue buttons.
- **Dynamic routing**: Verify first-time users (no apps) are redirected to the Apps page; returning users land on Playground.
- Sanity check theme, data clearing, and import/export under `/settings`. Export should download JSON; import should preview counts and replace current data without errors.

## Commit & Pull Request Guidelines

- Follow the existing Conventional Commit style seen in history (`feat: ...`, `chore: ...`, `refactor: ...`). Keep subjects in the imperative and under ~70 chars.
- PRs should describe the change, list testing performed (commands + manual steps), and link related issues. Include before/after screenshots or a short clip for UI changes.
- Keep changes scoped; prefer separate PRs for refactors vs. feature work to simplify review.

## Security & Configuration Tips

- Do not store secrets in `.env` or in browser storage; app token credentials must live in Azure Key Vault.
- **App credentials**: Store credentials in Azure Key Vault (secret or certificate). App configurations (clientId, tenantId, Key Vault URI, credential name) are entered through the UI and stored in IndexedDB. Credentials are fetched from Key Vault at runtime.
- The app only stores tenant/client IDs and per-app metadata in IndexedDB; secrets and certificates stay in Azure Key Vault and are never stored locally.
- **Adding apps via UI**: When no apps exist, use the **Connect Client App** button in the header or open `/apps` → enter Entra details and Key Vault credential configuration. The app validates Key Vault access before saving.
- **Key Vault setup**: Create a Key Vault, store your client secret or certificate, and grant your identity access:
  - For secrets: `Key Vault Secrets User` (or `Key Vault Administrator`)
  - For certificates: `Key Vault Crypto User` + `Key Vault Certificates User` (or `Key Vault Administrator`)
- Do not commit `.env` or real secrets.
- Treat access tokens as sensitive: avoid logging them.
- **App Tokens**: Keep token exchange logic out of the browser. Web uses `src/routes/api/token/app/+server.ts` + `src/lib/server/app-token-service.ts`; desktop uses the sidecar (`sidecar/src/handlers/app-token.ts`). Certificate private keys never leave Key Vault.
- **User Tokens (Web)**: `@azure/msal-browser` uses `localStorage` by default; ensure no XSS vulnerabilities as tokens are accessible to client-side scripts.
- **User Tokens (Desktop)**: The sidecar persists MSAL cache on disk and encrypts it when a cache key is available (release builds prefer OS keyring).
- Local history/preferences/app configs stay in IndexedDB; remind users to clear data on shared machines.

## Active Technologies
- SvelteKit 2, Svelte 5 runes, shadcn components, `idb-keyval` for IndexedDB persistence.
- Web auth: `@azure/msal-browser` (user tokens) + SvelteKit server routes for Key Vault/MSAL Node operations.
- Desktop (experimental): Tauri 2 (Rust) + Node.js sidecar (Azure SDK + `@azure/msal-node`).
- Scope/resource quick-pick suggestions sourced from favorites/history plus Graph scope metadata and presets.

## Recent Changes
- 001-pinned-tokens: Added SvelteKit 2, Svelte 5 runes, shadcn components, `idb-keyval` for IndexedDB persistence, existing favorites/history state modules
- Scope/resource quick-pick inputs for Playground flows powered by favorites/history/presets with Graph scope metadata badges
- Desktop runtime: added Tauri host + Node sidecar, plus runtime-aware API routing for app/user token flows
