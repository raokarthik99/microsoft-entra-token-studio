# Entra Token Client

Playground for generating and inspecting Microsoft Entra access tokens. Built with SvelteKit 2, Svelte 5 runes, and TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.48-orange.svg)
![Svelte](https://img.shields.io/badge/Svelte-5.43-ff3e00.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)

## Features

- **App tokens** via confidential client credentials at `/api/token/app`; resources are normalized to `/.default`.
- **User tokens** through the authorization code + PKCE flow with silent acquisition and popup fallback.
- **Token status tracking** with real-time indicators (expired, expiring, valid) and color-coded badges.
- **Full-screen token inspector** for immersive token analysis with ESC key support.
- **Enhanced decoded claims viewer** with search, filtering (Important/All), and per-claim copy functionality.
- **Floating token dock** for quick access to token actions without scrolling.
- **Comprehensive history management** with Load, Reissue, and Delete actions plus search/filter/sort.
- **Favorites system** for saving frequently used targets with names, tags, colors, and descriptions for quick access.
- **One-click token reissue** from favorites with automatic parameter population.
- **Visual prominence** for expired/expiring tokens with highlighted reissue buttons.
- **Local-only storage** in IndexedDB for history and preferences; clear data anytime from Settings.
- **Built-in readiness check** powered by `/api/health`, surfaced on the home page Setup card.
- **Server-only secret handling** with `@azure/msal-node`; tokens stay in the browser unless you copy them.

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

   Fill in the values below, then restart the dev server after edits.

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
5. Create a secret under **Certificates & secrets** → **New client secret** → value → `CLIENT_SECRET`.
6. Permissions:
   - App token flow: add application permissions for the API you want (e.g., Graph `Application` perms).
   - User token flow: add delegated scopes (e.g., `User.Read`, `openid`, `profile`, `offline_access`) and grant admin consent if required.
7. The redirect URI must match exactly (scheme/host/port/path).

References: Azure portal https://portal.azure.com and registration guide https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app

## Configuration (.env)

Copy `.env.example` and set:

```
TENANT_ID=your-tenant-guid
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
PORT=5173
REDIRECT_URI=http://localhost:5173/auth/callback
```

- `TENANT_ID`: Directory ID for your tenant.
- `CLIENT_ID`: App registration client ID.
- `CLIENT_SECRET`: Confidential client secret (used server-side only for App tokens).
- `PORT`: Port for `pnpm dev` (defaults to 5173).
- `REDIRECT_URI`: Must match the Entra redirect and `/auth/callback`; falls back to `${origin}/auth/callback` if unset.

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
- **Clear all**: Wipe all history data from the dashboard or Settings page.
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

- The home page Setup card reads `/api/health` to confirm `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, and `REDIRECT_URI`.
- The same endpoint can be polled directly for JSON readiness data.

## Project Structure

- `src/routes/+page.svelte` — Playground dashboard (flows, setup check, output, history peek).
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
  - Layout components: `app-header.svelte`, `app-sidebar.svelte`, `app-footer.svelte`.
- `src/lib/states/history.svelte.ts` — Svelte 5 runes-based history state management.
- `src/lib/states/favorites.svelte.ts` — Svelte 5 runes-based favorites state management.
- `src/lib/services/favorites.ts` — Favorites service for IndexedDB persistence with CRUD operations.
- `src/lib/shadcn/` — shadcn-svelte UI primitives and components (includes table primitives under `components/ui/table`).
- `src/lib/utils.ts` — helpers for JWT decoding, expiry calculations, and token status.
- `src/lib/types.ts` — TypeScript interfaces for HistoryItem, TokenData, and FavoriteItem.
- `src/lib/server/msal.ts` — server-only MSAL configuration.
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
- Setup card shows ready with a valid `.env`; `/api/health` matches the expected redirect URI.
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
