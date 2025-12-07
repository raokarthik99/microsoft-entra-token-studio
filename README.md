# Entra Token Studio

Local, single-user lab for generating and inspecting Microsoft Entra access tokens. Built with SvelteKit 2, Svelte 5 runes, and TypeScript using shadcn components.

> ⚠️ **Local-only, developer-supervised use.** The app handles real app credentials and live access tokens. Run it on your own machine, keep browser storage under your control, and do not deploy it as a shared or multi-user service.

## What you get

- Multi-app workspace: configure multiple Entra app registrations, switch in the header, and keep per-app colors, tags, and notes.
- App tokens (confidential client) issued server-side via `/api/token/app`, supporting Azure Key Vault certificates/secrets or local `.env` credentials for development.
- User tokens (Authorization Code + PKCE) with MSAL.js, silent acquisition, and popup fallback.
- Token intelligence: live expiry badges, floating token dock, full-screen inspector, decoded claims search/filter, and per-claim copy.
- Productivity features: history with Load/Reissue/Delete, advanced sorting/filtering, favorites with tags/colors/descriptions, and pinned favorites in the header for one-click reissue.
- Data portability: import/export all IndexedDB data (history, favorites, preferences, app configs) with validation and replace semantics.
- First-run onboarding: automatic redirect to `/apps` when no apps exist, guided setup, and credential health checks.

## How token flows work

- **App tokens**: Server-side client credential flow using `@azure/msal-node`. Certificates support PEM and PKCS#12 with OpenSSL fallback for modern encryption. Authentication method is auto-selected in this order: Key Vault certificate → local certificate file → Key Vault secret → local client secret.
- **User tokens**: Client-side Authorization Code + PKCE using `@azure/msal-browser`. Silent acquisition runs first; consent or account switch triggers a popup. Tokens are decoded client-side and never logged.
- **Routing**: First-time users are redirected to `/apps`; returning users land on the Playground.

## Data boundaries and safety

- Tokens, history, favorites, preferences, and app configs live only in IndexedDB (`idb-keyval`).
- MSAL cache stays in `localStorage` (plus session storage for popups); logout clears `msal.*` keys and client-specific cache.
- Secrets and certificates stay server-side via Azure Key Vault or local `.env` (dev only). They are never written to IndexedDB.
- No secrets or tokens are intentionally logged; avoid pasting tokens into shared channels. Clear local data on shared machines.

## Prerequisites

- Node.js 18+ (LTS recommended).
- pnpm (`npm i -g pnpm` if needed).
- OpenSSL CLI (required for PKCS#12 certificates with modern encryption).
- Microsoft Entra tenant with permission to register apps.
- Azure Key Vault containing your client secret or certificate, and Azure identity access (CLI login, VS Code, or managed identity via `DefaultAzureCredential`).

## Setup

1) **Clone and install**
```bash
git clone <repository-url>
cd entra-token-client
pnpm install
```

2) **Configure environment**
```bash
cp .env.example .env
```
Set at least:
- `PORT` — dev server port (defaults to 5173).
- `REDIRECT_URI` — SPA redirect (defaults to `http://localhost:5173/auth/callback`).

3) **Choose an app token credential source**
- **Azure Key Vault (recommended)**  
  - `AZURE_KEYVAULT_URI` — `https://your-vault.vault.azure.net`  
  - `AZURE_KEYVAULT_CERT_NAME` — certificate name **or**  
  - `AZURE_KEYVAULT_SECRET_NAME` — client secret name  
  - Optional: `CERTIFICATE_PFX_PASSPHRASE` if the PFX is protected.
- **Local development (single-user only)**  
  - `TENANT_ID` and `CLIENT_ID` for your app registration.  
  - Either `CLIENT_SECRET` **or** `CERTIFICATE_PATH` (PEM or PFX; supports `CERTIFICATE_PFX_PASSPHRASE`).

The server auto-picks the first available method. Restart the dev server after changing credentials.

4) **Run the app**
```bash
pnpm dev
```
Open `http://localhost:5173`. With no apps configured, you'll be redirected to `/apps` to connect your first client app.

## Onboarding and everyday use

- **Connect a client app**: From the header, click **Connect Client App** (or go to `/apps`). Enter tenant ID, client ID, redirect URI, Key Vault URI, and credential name (secret or certificate). Validation checks Key Vault connectivity before saving.
- **Issue an app token**: On the Playground, choose **App token**, enter a resource (e.g., `https://graph.microsoft.com`), and issue. `/.default` is applied automatically. Results include token type, expiry, status badge, and decoded claims.
- **Issue a user token**: Choose **User token**, set scopes (space-separated), and issue. The app attempts silent acquisition; if consent or login is needed, a popup prompts you. You can switch accounts before issuing.
- **Stay organized**: History captures full results with per-app context. Favorites support names/tags/colors/descriptions, usage counts, and bulk delete. Pin up to five favorites to the header for instant reissue.
- **Inspect quickly**: Use the floating token dock for active tokens, open the full-screen inspector with ESC-to-close support, and search/filter claims with Important/All toggles and per-claim copy.
- **Port your data**: Export all local data to JSON from Settings; imports validate counts and replace current data.

## Development commands

- `pnpm dev` — start the dev server with HMR.
- `pnpm check` — `svelte-kit sync` + `svelte-check` with strict TS settings.
- `pnpm build` — production build to verify SSR stability.
- `pnpm preview` — serve the built app locally.

## Project map

- `src/routes/+page.svelte` — Playground flows, decoded output, floating panel, history preview, and active app selector.
- `src/routes/apps/+page.svelte` — multi-app onboarding, validation, and CRUD UI.
- `src/routes/api/token/app/+server.ts` — confidential client flow using MSAL Node.
- `src/routes/api/apps/validate/+server.ts` — Key Vault connectivity checks for app configs.
- `src/routes/api/health/+server.ts` — server/env credential health and guidance.
- `src/routes/auth/callback/+page.svelte` — SPA redirect handler for user tokens.
- `src/lib/server/{msal,keyvault,keyvault-validator,certificate}.ts` — credential resolution, Key Vault helpers, and certificate parsing (PEM/PKCS#12 with OpenSSL fallback).
- `src/lib/services/auth.ts`, `src/lib/stores/auth.ts`, `src/lib/stores/time.ts` — client auth wrapper, auth state, and real-time expiry ticking.
- `src/lib/states/{app-registry,history,favorites}.svelte.ts` — Svelte 5 runes-based state for multi-app registry, history, and favorites.
- `src/lib/components/` — shared UI (app selector, management sheets/dialogs, History/Favorites lists, TokenStatusBadge, TokenFullScreenView, DecodedClaims, layout components).
- `src/lib/utils.ts`, `src/lib/types.ts` — helpers and shared types. Global shell/styles live in `src/app.html` and `src/app.css`; static assets in `static/`.

## Manual validation (high-value checks)

- App token flow: issues a token for the provided resource, decodes claims, and shows the correct auth method/source.
- User token flow: signs in, handles consent/popup, and renders decoded claims without errors.
- Status UX: expiry badges update in real time; expired/expiring tokens surface reissue prompts.
- Token views: floating dock and full-screen inspector work; ESC closes the full-screen view.
- Claims UX: Important/All toggle works; search and per-claim copy behave correctly.
- History/favorites: search/filter/sort, Load/Reissue/Delete work; pinned favorites render in the header and reissue successfully.
- Data portability: export produces JSON; import validates and replaces data without errors.
- Multi-app: add/edit/delete apps, switch active app, and validate Key Vault connectivity.

## Troubleshooting

- Redirect issues: ensure `REDIRECT_URI` matches the Entra SPA redirect (`/auth/callback`).
- Key Vault access denied: run `az login` and ensure Secrets/Certificates permissions (or Key Vault Administrator) on the vault.
- App token failures: confirm `TENANT_ID`, `CLIENT_ID`, and one credential path (Key Vault secret/cert or local secret/cert) are set; restart after changes.
- Scope/resource errors: app tokens expect resources with `/.default`; user tokens require delegated scopes with consent.
- Popups blocked: allow popups for `localhost` or trigger the flow again after enabling.

## License

MIT. See `LICENSE` for details.
