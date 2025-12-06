# ⚠️ Local-Only Security Tool — Read Before Using

This project is deliberately built for **local, developer-supervised use only**. It handles access tokens, client secrets, and certificate-based credentials that grant real authorization to Entra-protected resources. Running it on shared, hosted, or unattended environments increases the risk of credential leakage, misuse of tokens with live scopes, and accidental exposure of sensitive configuration. Always run it on your own machine, with your own credentials, and keep the browser storage and any copied tokens under your direct control. Do not deploy this tool as a multi-user service; it is a personal playground for testing and debugging token flows.

# Entra Token Studio

Playground for generating and inspecting Microsoft Entra access tokens. Built with SvelteKit 2, Svelte 5 runes, and TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.48-orange.svg)
![Svelte](https://img.shields.io/badge/Svelte-5.43-ff3e00.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)

## Features

- **Multi-app support** with UI-based configuration and secure Azure Key Vault credential storage.
- **App tokens** via confidential client credentials at `/api/token/app`; supports both client secrets and certificates from Azure Key Vault.
- **User tokens** through the authorization code + PKCE flow with silent acquisition and popup fallback.
- **Flexible credential paths** for app tokens: local `.env` (client secret or certificate path) for fast local development, or Azure Key Vault for production-ready secret and certificate storage.
- **Token status tracking** with real-time indicators (expired, expiring, valid) and color-coded badges.
- **Full-screen token inspector** for immersive token analysis with ESC key support.
- **Enhanced decoded claims viewer** with search, filtering (Important/All), and per-claim copy functionality.
- **Floating token dock** for quick access to token actions without scrolling.
- **Comprehensive history management** with Load, Reissue, and Delete actions plus search/filter/sort.
- **Favorites system** for saving frequently used targets with names, tags, colors, and descriptions for quick access.
- **Pinned tokens navigation** to promote up to five favorites into the header for instant reissue, ordered by most recently pinned.
- **One-click token reissue** from favorites with automatic parameter population.
- **Visual prominence** for expired/expiring tokens with highlighted reissue buttons.
- **Local-only storage**: history/preferences live in IndexedDB via a shared client storage helper, and the MSAL cache stays in `localStorage` for smoother reuse; clear data anytime from Settings.
- **Local backup/restore**: export all IndexedDB data (history, favorites, preferences, app configs) to JSON and re-import backups from Settings with validation and replace safeguards.
- **Guided app setup** on the Apps page that automatically onboards first-time users with no apps configured.
- **Server-only secret handling** with `@azure/msal-node`; tokens stay in the browser unless you copy them.

## Quick Start

1. **Prerequisites**

   - Node.js 18+ (LTS recommended).
   - pnpm (`npm i -g pnpm` if needed).
   - **OpenSSL** (required for Azure Key Vault certificates with modern PKCS#12 encryption).
   - An Entra tenant where you can register apps.
   - **Azure Key Vault** with your client secret or certificate stored.

2. **Install**

   ```bash
   git clone <repository-url>
   cd entra-token-client
   pnpm install
   ```

3. **Configure Server**

   ```bash
   cp .env.example .env
   ```

   At minimum, the `.env` file configures server behavior (port, redirect URI). App registrations for user tokens are configured through the UI, and app token credentials are provided via environment variables (client secret, local certificate, or Azure Key Vault).

4. **Run**
   ```bash
   pnpm dev
   ```
   Open http://localhost:5173 — first-time users with no apps configured are automatically redirected to the **Apps** page for onboarding.

5. **Add Your First App**
   - Click **Add App** in the header or go to the **Apps** page
   - Enter your Entra app registration details (Tenant ID, Client ID)
   - Provide your Azure Key Vault URI and credential name, or choose a local `.env` credential path for development
   - The app validates Key Vault access before saving

## Microsoft Entra App Registration

1. Go to **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name it (e.g., `Entra Token Studio`), choose **Single tenant**.
3. **Platform Configuration**:
   - Click **Add a platform** → **Single-page application**.
   - Add Redirect URI: `http://localhost:5173/auth/callback`.
   - **Important**: Do NOT use the "Web" platform for the redirect URI, as this will cause CORS errors with the client-side flow.
4. After creation:
   - Copy **Directory (tenant) ID** — you'll enter this in the UI.
   - Copy **Application (client) ID** — you'll enter this in the UI.
5. Create credentials under **Certificates & secrets**:
   - **Option A (Secret)**: Click **New client secret** → copy the value → store in Azure Key Vault.
   - **Option B (Certificate)**: Upload a certificate (`.cer` or `.pem`). Store the full certificate with private key in Azure Key Vault.
6. **Store in Azure Key Vault**:
   - Create an Azure Key Vault if you don't have one.
   - Add your client secret or certificate to Key Vault.
   - Grant your identity access to Key Vault (Key Vault Administrator or Key Vault Secrets User + Key Vault Certificate User).
7. Permissions:
   - App token flow: add application permissions for the API you want (e.g., Graph `Application` perms).
   - User token flow: add delegated scopes (e.g., `User.Read`, `openid`, `profile`, `offline_access`) and grant admin consent if required.
8. The redirect URI must match exactly (scheme/host/port/path).

References: [Azure portal](https://portal.azure.com) and [registration guide](https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app)

## Configuration

### Server Configuration (.env)

The `.env` file contains only server-level configuration:

```bash
# Port for the dev server (defaults to 5173)
PORT=5173

# Redirect URI for user token authentication callbacks
REDIRECT_URI=http://localhost:5173/auth/callback
```

### App Configuration (UI)

All app credentials are configured through the UI and stored securely:

- **App details** (name, tenant ID, client ID) are stored in IndexedDB
- **Credentials** (secrets, certificates) are stored in Azure Key Vault — never locally
- **Multiple apps** can be configured and switched between in the header

To add an app:
1. Click **Add App** in the header (or open the **Apps** page)
2. Enter your Entra app registration details
3. Provide your Azure Key Vault URI
4. Select credential type (Secret or Certificate) and enter the Key Vault secret/certificate name
5. The app validates Key Vault access before saving

### Azure Key Vault Setup

1. **Create an Azure Key Vault** if you don't have one.
2. **Add your credential**:
   - For secrets: Add a new secret with your client secret value
   - For certificates: Import your certificate with private key (PEM or PKCS#12)
3. **Grant access** to your identity:
   - Sign in to Azure CLI: `az login`
   - Assign **Key Vault Administrator** (simplest) OR
   - Assign **Key Vault Certificate User** AND **Key Vault Secrets User**
4. **Note your Key Vault URI**: `https://your-vault.vault.azure.net`

The app uses `DefaultAzureCredential` from `@azure/identity` for Key Vault access, which automatically uses Azure CLI, VS Code, or Managed Identity credentials.

## Scripts

- `pnpm dev` — start the dev server with HMR.
- `pnpm check` — run `svelte-kit sync` and `svelte-check` with the repo tsconfig.
- `pnpm build` — production build to verify SSR/adapter output.
- `pnpm preview` — serve the production build locally.

## Using the App

### App token (client credentials)

1. Choose **App token** on the Playground page.
2. Enter a resource (e.g., `https://graph.microsoft.com`); `/.default` is applied automatically.
3. Submit to call `/api/token/app`, which exchanges your confidential client credentials for an access token.
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

### Switching between apps

- Click the app selector in the header to switch between configured apps.
- Each app has its own color and configuration.
- The active app determines which credentials are used for token requests.

### History and settings

- Recent requests are stored in `IndexedDB` (via `idb-keyval`) with full token data and surface on the dashboard and `/history`.
- **Load**: View previously acquired tokens with decoded claims and full details.
- **Reissue**: One-click token reissue from history automatically issues a token with the same parameters.
- **Delete**: Remove individual items from history via the trash icon.
- **Search, filter, sort**: Find entries by target/type/status, toggle status/type filters, and sort by issued/expires/status/target.
- **Clear all**: Wipe history, favorites, and saved preferences stored in IndexedDB from the dashboard or Settings page.
- **Backup/Restore**: Export all local data to a JSON backup from Settings and import it later to replace current data (with preview/validation before restore).
- **Token status**: History items display real-time expiry status (expired, expiring, valid) with visual indicators.
- **Favorites**: Save frequently used targets to favorites for quick access, with support for names, tags, colors, and descriptions.
- **Favorite/Unfavorite**: Add or remove items from favorites directly from history entries.
- **Quick reissue**: Use favorites to instantly reissue tokens with the same parameters.
- Clear data, switch theme, or view your **Profile** details from `/settings`.

### Favorites management

- Access the dedicated **Favorites page** at `/favorites` to manage all your saved favorites.
- **Create favorites** with optional names, tags, colors, and descriptions for better organization.
- **Filter favorites** by type (App Token/User Token), status, tags, and colors.
- **Pinned slots**: Pin favorites from token results, the floating dock, fullscreen inspector, or history; up to five pinned entries stay in the header for one-click reissue and can be unpinned without deleting the favorite.
- **Bulk operations**: Select multiple favorites for bulk delete operations.
- **Usage tracking**: See how many times each favorite has been used and when it was last accessed.
- **Quick access**: Use favorites to instantly populate token generation forms with saved parameters.
- **Visual organization**: Color-code favorites and use tags for easy filtering and grouping.

### Setup and onboarding

- First-time users with no apps configured are automatically redirected to the **Apps** page.
- The Apps page provides a guided onboarding experience, including credential health checks and environment configuration tips.
- Once at least one app is configured, you land directly on the Playground.
- Manage apps anytime via the header app selector → **Manage apps** or by navigating directly to `/apps`.

## Project Structure

- `src/routes/+page.svelte` — Playground dashboard (flows, output, history peek).
- `src/routes/apps/+page.svelte` — Apps management and first-time onboarding experience.
- `src/routes/api/token/app/+server.ts` — Client-credential token issuer (server-side).
- `src/routes/api/apps/validate/+server.ts` — Key Vault validation endpoint for app configuration.
- `src/routes/api/health/+server.ts` — Server-side health and credential configuration status used by setup guidance.
- `src/routes/auth/callback/+page.svelte` — Client-side redirect handler for MSAL.js.
- `src/lib/server/msal.ts` — Server-side confidential client token acquisition using `@azure/msal-node`, including Key Vault and local certificate/secret resolution.
- `src/lib/services/auth.ts` — Client-side authentication service (MSAL.js wrapper).
- `src/lib/stores/auth.ts` — Svelte stores for authentication state.
- `src/lib/stores/time.ts` — Reactive time store for real-time expiry updates.
- `src/lib/states/app-registry.svelte.ts` — Multi-app configuration state management.
- `src/routes/history/+page.svelte`, `src/routes/settings/+page.svelte`, and `src/routes/favorites/+page.svelte` — local history, preferences, and favorites management.
- `src/lib/components/` — reusable UI components:
  - `app-selector.svelte` — Header app selector dropdown.
  - `app-form-dialog.svelte` — Dialog used for creating and editing app configurations.
  - `apps-table.svelte` / `apps-table-actions.svelte` — Apps management table and actions.
  - `DecodedClaims.svelte` — Searchable, filterable claims viewer with copy functionality.
  - `TokenFullScreenView.svelte` — Immersive full-screen token inspector.
  - `TokenStatusBadge.svelte` — Real-time token status indicators.
  - `HistoryList.svelte` — Shared history management component with Load/Reissue/Delete, search, filters, sorting.
  - `FavoritesList.svelte` — Favorites management component with advanced filtering, bulk operations, and usage tracking.
  - `FavoriteFormSheet.svelte` — Form for creating and editing favorites.
  - Layout components: `app-header.svelte`, `app-sidebar.svelte`, `app-footer.svelte`.
- `src/lib/server/keyvault.ts` — Key Vault helpers for certificates and secrets.
- `src/lib/server/keyvault-validator.ts` — Key Vault validation for app configuration.
- `src/lib/server/certificate.ts` — Certificate parsing with OpenSSL fallback.
- `src/lib/shadcn/` — shadcn-svelte UI primitives and components.
- `src/lib/utils.ts` — helpers for JWT decoding, expiry calculations, and token status.
- `src/lib/types.ts` — TypeScript interfaces for app configuration, tokens, history, and favorites.
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
- Multi-app: Can add, edit, switch between, and delete app configurations.
- Key Vault validation: App configuration validates Key Vault access before saving.
- Favorites can be created, edited, and deleted from both the main page and favorites page.
- Favorites filtering by type, status, tags, and colors works correctly.
- Export downloads a JSON backup; import validates counts and replaces current data without errors.
- No secrets or tokens leak into server logs or browser console beyond intentional copy actions.

## Troubleshooting

- **Redirect URI mismatch**: Match `REDIRECT_URI` in `.env` with the Entra SPA redirect and `/auth/callback`.
- **Key Vault access denied**: Ensure your Azure CLI is signed in (`az login`) and has appropriate Key Vault permissions.
- **Invalid scopes/resources**: For app tokens, use `/.default` on the resource; for user tokens, ensure delegated scopes are granted.
- **Consent/admin approval**: Grant required delegated or application permissions in the Azure portal.
- **Token errors after login**: Check for `invalid_state` or `redemption_failed` in the URL; restart the flow after clearing history.
- **No apps showing**: Click "No apps" in the header to add your first Entra app configuration.

## Security Notes

- For production, store app credentials in Azure Key Vault (certificate or secret). For local development, you may use a `CLIENT_SECRET` or `CERTIFICATE_PATH` in `.env`; treat these as sensitive secrets and never commit them.
- App configuration (IDs only, no secrets) is stored in browser IndexedDB.
- Tokens are stored only in the browser; clear history on shared machines and use least-privilege scopes.
- OpenSSL is used for certificate parsing when Key Vault returns modern PKCS#12 encryption.

## License

MIT License. See `LICENSE` if present, or the badge above.
