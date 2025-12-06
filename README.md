# ⚠️ Local-Only Security Tool — Read Before Using

This project is deliberately built for **local, developer-supervised use only**. It handles access tokens, client secrets, and certificate-based credentials that grant real authorization to Entra-protected resources. Running it on shared, hosted, or unattended environments increases the risk of credential leakage, misuse of tokens with live scopes, and accidental exposure of sensitive configuration (tenant IDs, client IDs, redirects, Key Vault paths, certificates, and secrets). Always run it on your own machine, with your own credentials, and keep the `.env`, browser storage, and any copied tokens under your direct control. Do not deploy this tool as a multi-user service; it is a personal playground for testing and debugging token flows.

# Entra Token Client

Playground for generating and inspecting Microsoft Entra access tokens. Built with SvelteKit 2, Svelte 5 runes, and TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.48-orange.svg)
![Svelte](https://img.shields.io/badge/Svelte-5.43-ff3e00.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)

## Features

- **App tokens** via confidential client credentials at `/api/token/app`; resources are normalized to `/.default`. Supports both client secrets and **certificates from Azure Key Vault**.
- **User tokens** through the authorization code + PKCE flow with silent acquisition and popup fallback.
- **Token status tracking** with real-time indicators (expired, expiring, valid) and color-coded badges.
- **Full-screen token inspector** for immersive token analysis with ESC key support.
- **Enhanced decoded claims viewer** with search, filtering (Important/All), and per-claim copy functionality.
- **Floating token dock** for quick access to token actions without scrolling.
- **Comprehensive history management** with Load, Reissue, and Delete actions plus search/filter/sort.
- **Favorites system** for saving frequently used targets with names, tags, colors, and descriptions for quick access.
- **One-click token reissue** from favorites with automatic parameter population.
- **Visual prominence** for expired/expiring tokens with highlighted reissue buttons.
- **Local-only storage**: history/preferences live in IndexedDB via a shared client storage helper, and the MSAL cache stays in `localStorage` for smoother reuse; clear data anytime from Settings.
- **Guided setup** experience and readiness check powered by `/api/health`, surfaced on the home page Setup card and `/setup` page.
- **Server-only secret handling** with `@azure/msal-node`; tokens stay in the browser unless you copy them.
- **Credential preference + validation** with per-path status (ready/issues/not set) and a saved selection (cookie) that drives both `/api/health` and `/api/token/app`.

## Quick Start

1. **Prerequisites**

   - Node.js 18+ (LTS recommended).
   - pnpm (`npm i -g pnpm` if needed).
   - An Entra tenant where you can register apps.

2. **Install**

   ```bash
   git clone <repository-url>
   cd entra-token-client
   pnpm install
   ```

3. **Configure**

   ```bash
   cp .env.example .env
   ```

   Fill in the values below, then restart the dev server after edits. Keep `.env` local and out of source control; never commit real secrets, certificates, or tenant-specific values.

4. **Run**
   ```bash
   pnpm dev
   ```
   Open http://localhost:5173 (or your configured port) and use the App token / User token tabs.

## Microsoft Entra App Registration

1. Go to **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name it (e.g., `Entra Token Client`), choose **Single tenant**.
3. **Platform Configuration**:
   - Click **Add a platform** → **Single-page application**.
   - Add Redirect URI: `http://localhost:5173/auth/callback`.
   - **Important**: Do NOT use the "Web" platform for the redirect URI, as this will cause CORS errors with the client-side flow.
4. After creation:
   - Copy **Directory (tenant) ID** → `TENANT_ID`.
   - Copy **Application (client) ID** → `CLIENT_ID`.
5. Create credentials under **Certificates & secrets**:
   - **Option A (Secret)**: Click **New client secret** → copy the value → `CLIENT_SECRET`.
   - **Option B (Certificate)**: Upload a certificate (`.cer` or `.pem`) for production use. Store the full certificate with private key in Azure Key Vault.
6. Permissions:
   - App token flow: add application permissions for the API you want (e.g., Graph `Application` perms).
   - User token flow: add delegated scopes (e.g., `User.Read`, `openid`, `profile`, `offline_access`) and grant admin consent if required.
7. The redirect URI must match exactly (scheme/host/port/path).

References: Azure portal https://portal.azure.com and registration guide https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app

## Configuration (.env)

Copy `.env.example` and set the core values:

```bash
# Core Configuration
TENANT_ID=your-tenant-guid
CLIENT_ID=your-client-id
PORT=5173
REDIRECT_URI=http://localhost:5173/auth/callback

# Authentication Method (choose one)
# Option 1: Client Secret
CLIENT_SECRET=your-client-secret

# Option 2: Certificate from Azure Key Vault (recommended for production)
# AZURE_KEYVAULT_URI=https://your-vault.vault.azure.net
# AZURE_KEYVAULT_CERT_NAME=your-certificate-name
```

### Core Variables

- `TENANT_ID`: Directory ID for your tenant.
- `CLIENT_ID`: App registration client ID.
- `PORT`: Port for `pnpm dev` (defaults to 5173).
- `REDIRECT_URI`: Must match the Entra redirect and `/auth/callback`; falls back to `${origin}/auth/callback` if unset.

### Authentication Methods

For App tokens (client credentials flow), the application supports **4 authentication methods**. They are attempted in the following priority order:

| Priority | Method | Source | Variables | Use Case |
|----------|--------|--------|-----------|----------|
| **1** | **Certificate** | Key Vault | `AZURE_KEYVAULT_URI` + `AZURE_KEYVAULT_CERT_NAME` | **Production (Recommended)** |
| **2** | **Certificate** | Local File | `CERTIFICATE_PATH` | Local Dev with Certs |
| **3** | **Client Secret** | Key Vault | `AZURE_KEYVAULT_URI` + `AZURE_KEYVAULT_SECRET_NAME` | Centralized Secrets |
| **4** | **Client Secret** | Environment | `CLIENT_SECRET` | Quick Start / Simple Dev |

> **Note**: The application auto-detects using the highest priority configured method, but you can override with a saved preference in the Setup → Credentials sheet. The cookie `auth_pref=method:source` (e.g., `certificate:keyvault`) is honored by `/api/health` and `/api/token/app` as long as that path remains valid.

### Certificate Authentication Setup

#### Option A: Azure Key Vault (Recommended)
1. **Create a certificate** in Azure Key Vault (or import an existing one with private key).
2. **Upload the public key** (`.cer`) to your App Registration under **Certificates & secrets**.
3. **Grant access** to Key Vault for your identity:
   - Assign **Key Vault Administrator** (simplest) OR
   - Assign **Key Vault Certificate User** AND **Key Vault Secrets User**.
4. **Set environment variables**:
   ```bash
   AZURE_KEYVAULT_URI=https://my-vault.vault.azure.net
   AZURE_KEYVAULT_CERT_NAME=my-app-cert
   ```

#### Option B: Local Certificate File
1. **Obtain a certificate** with private key (PEM or PFX format).
2. **Upload the public key** to your App Registration.
3. **Set environment variable**:
   ```bash
   CERTIFICATE_PATH=/absolute/path/to/certificate.pem
   ```

### Client Secret Setup

#### Option C: Azure Key Vault
1. **Create a secret** in Azure Key Vault containing your client secret.
2. **Grant access**: Assign **Key Vault Secrets User** role.
3. **Set environment variables**:
   ```bash
   AZURE_KEYVAULT_URI=https://my-vault.vault.azure.net
   AZURE_KEYVAULT_SECRET_NAME=my-client-secret
   ```

#### Option D: Environment Variable
1. **Create a client secret** in App Registration.
2. **Set environment variable**:
   ```bash
   CLIENT_SECRET=your-client-secret
   ```

The app uses `DefaultAzureCredential` from `@azure/identity` for Key Vault access, which automatically uses Azure CLI, VS Code, or Managed Identity credentials.

Never commit `.env` or real secrets.

## Scripts

- `pnpm dev` — start the dev server with HMR.
- `pnpm check` — run `svelte-kit sync` and `svelte-check` with the repo tsconfig.
- `pnpm build` — production build to verify SSR/adapter output.
- `pnpm preview` — serve the production build locally.

## Using the App

### App token (client credentials)

1. Choose **App token** on the home page.
2. Enter a resource (e.g., `https://graph.microsoft.com`); `/.default` is applied automatically.
3. Submit to call `/api/token/app`, which exchanges your confidential client for an access token.
4. Review the decoded claims, expiry, and audiences; copy the raw token if needed.

### User token (Authorization Code + PKCE)

1. Choose **User token** and enter scopes (space-separated, e.g., `User.Read Mail.Read`).
2. The form displays your current identity:
   - If signed in: Shows "Issuing as {email}" with a **Switch account** link.
   - If not signed in: Prompts "Click Issue token — we'll help you sign in".
3. Click **Issue token**.
   - If not signed in, a Microsoft sign-in popup appears.
   - If signed in, the app attempts **silent acquisition** first.
   - If consent is required (e.g., new scopes), a **popup** appears for approval.
4. The token is returned directly to the client and displayed for decoding.

### History and settings

- Recent requests are stored in `IndexedDB` (via `idb-keyval`) with full token data and surface on the dashboard and `/history`.
- **Load**: View previously acquired tokens with decoded claims and full details.
- **Reissue**: One-click token reissue from history automatically issues a token with the same parameters.
- **Delete**: Remove individual items from history via the trash icon.
- **Search, filter, sort**: Find entries by target/type/status, toggle status/type filters, and sort by issued/expires/status/target.
- **Clear all**: Wipe history, favorites, and saved preferences stored in IndexedDB from the dashboard or Settings page; the MSAL auth cache stays in `localStorage` until you clear it or sign out.
- **Token status**: History items display real-time expiry status (expired, expiring, valid) with visual indicators.
- **Favorites**: Save frequently used targets to favorites for quick access, with support for names, tags, colors, and descriptions.
- **Favorite/Unfavorite**: Add or remove items from favorites directly from history entries.
- **Quick reissue**: Use favorites to instantly reissue tokens with the same parameters.
- Clear data, switch theme, or view your **Profile** details from `/settings`.

### Favorites management

- Access the dedicated **Favorites page** at `/favorites` to manage all your saved favorites.
- **Create favorites** with optional names, tags, colors, and descriptions for better organization.
- **Filter favorites** by type (App Token/User Token), status, tags, and colors.
- **Bulk operations**: Select multiple favorites for bulk delete operations.
- **Usage tracking**: See how many times each favorite has been used and when it was last accessed.
- **Quick access**: Use favorites to instantly populate token generation forms with saved parameters.
- **Visual organization**: Color-code favorites and use tags for easy filtering and grouping.

### Setup and health

- The home page Setup card and `/setup` page read `/api/health` to confirm tenant/client/redirect plus credential validation per path (ready, issues, or not configured).
- The Setup card includes contextual copy about the active credential source (Key Vault vs. local secret/certificate) so users know what is being used.
- `/api/health` returns `authMethod`/`authSource` based on either your saved preference (`auth_pref` cookie) or auto-detection, along with a `validation` map for certificate/secret paths and specific Key Vault/local status + errors.
- `/api/token/app` echoes the resolved `authMethod`/`authSource` used to issue the token.

## Project Structure

- `src/routes/+page.svelte` — Playground dashboard (flows, setup check, output, history peek).
- `src/routes/setup/+page.svelte` — Guided setup and credential selection UI backed by `/api/health`.
- `src/routes/api/token/app/+server.ts` — client-credential token issuer (server-side).
- `src/routes/auth/callback/+page.svelte` — Client-side redirect handler for MSAL.js.
- `src/lib/services/auth.ts` — Client-side authentication service (MSAL.js wrapper).
- `src/lib/stores/auth.ts` — Svelte stores for authentication state.
- `src/lib/stores/time.ts` — Reactive time store for real-time expiry updates.
- `src/routes/api/health/+server.ts` — readiness details exposed to the UI.
- `src/routes/history/+page.svelte`, `src/routes/settings/+page.svelte`, and `src/routes/favorites/+page.svelte` — local history, preferences, and favorites management.
- `src/lib/components/` — reusable UI components:
  - `DecodedClaims.svelte` — Searchable, filterable claims viewer with copy functionality.
  - `TokenFullScreenView.svelte` — Immersive full-screen token inspector.
  - `TokenStatusBadge.svelte` — Real-time token status indicators.
  - `HistoryList.svelte` — Shared history management component with Load/Reissue/Delete, search, filters, sorting.
  - `FavoritesList.svelte` — Favorites management component with advanced filtering, bulk operations, and usage tracking.
  - `FavoriteFormSheet.svelte` — Form for creating and editing favorites with name, tags, color, and description support.
  - `history-table/data-table-actions.svelte` — Action dropdown for history rows (copy/load/reissue/delete).
  - Setup components: `setup/setup-step.svelte`, `setup/setup-progress.svelte`, `setup/credentials-sheet.svelte`, `setup/credentials-selector.svelte`.
  - Layout components: `app-header.svelte`, `app-sidebar.svelte`, `app-footer.svelte`.
- `src/lib/states/history.svelte.ts` — Svelte 5 runes-based history state management.
- `src/lib/states/favorites.svelte.ts` — Svelte 5 runes-based favorites state management.
- `src/lib/services/favorites.ts` — Favorites service for IndexedDB persistence with CRUD operations.
- `src/lib/shadcn/` — shadcn-svelte UI primitives and components (includes table primitives under `components/ui/table`).
- `src/lib/utils.ts` — helpers for JWT decoding, expiry calculations, and token status.
- `src/lib/types.ts` — TypeScript interfaces for HistoryItem, TokenData, FavoriteItem, HealthStatus, and shared config helpers.
- `src/lib/server/msal.ts` — server-only MSAL configuration with certificate/secret priority handling.
- `src/lib/server/keyvault.ts` — Key Vault helpers for certificates and secrets.
- `src/lib/server/certificate.ts` — Local certificate loader and status helpers.
- `static/` and `src/app.css`/`src/app.html` — assets and global styles.

## Manual Validation Checklist

- App token flow issues a token for the provided resource and decodes claims.
- User token flow signs in, returns delegated scopes, and decoded claims render without errors.
- Token status badges display correct state (expired, expiring, valid) with appropriate colors.
- Full-screen token view launches and exits correctly (via button or ESC key).
- Decoded claims search and filtering (Important/All) work as expected.
- History table search/filter/sort works; Load displays token details; Reissue issues a fresh token; Delete removes items.
- Real-time expiry updates occur every minute; expired/expiring tokens show prominent reissue buttons.
- Floating token dock remains visible and accessible.
- Setup card and `/setup` show ready with a valid `.env`; `/api/health` matches the expected redirect URI and reports the correct `authMethod`/`authSource`.
- Key Vault flows: `/api/health` returns `keyVault.status: connected` when `AZURE_KEYVAULT_URI` is configured with either `AZURE_KEYVAULT_CERT_NAME` or `AZURE_KEYVAULT_SECRET_NAME`.
- Local certificate flows: `/api/health` returns `localCert.status: loaded` when `CERTIFICATE_PATH` is valid.
- Favorites can be created, edited, and deleted from both the main page and favorites page.
- Favorites filtering by type, status, tags, and colors works correctly.
- Favorites usage tracking shows accurate counts and timestamps.
- Favorites can be used to quickly reissue tokens with saved parameters.
- No secrets or tokens leak into server logs or browser console beyond intentional copy actions.

## Troubleshooting

- **Redirect URI mismatch**: Match `REDIRECT_URI` with the Entra entry and `/auth/callback`.
- **Missing config**: The Setup card and `/api/health` list missing keys; set them and restart.
- **Invalid scopes/resources**: For app tokens, use `/.default` on the resource; for user tokens, ensure delegated scopes are granted.
- **Consent/admin approval**: Grant required delegated or application permissions in the portal.
- **Token errors after login**: Check for `invalid_state` or `redemption_failed` in the URL; restart the flow after clearing history.

## Security Notes

- `CLIENT_SECRET` stays server-side via `@azure/msal-node`; do not log or commit it.
- Tokens are stored only in the browser; clear history on shared machines and use least-privilege scopes.

## License

MIT License. See `LICENSE` if present, or the badge above.
