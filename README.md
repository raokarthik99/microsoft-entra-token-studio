# Entra Token Client

Token studio for generating and inspecting Microsoft Entra access tokens. Built with SvelteKit 2, Svelte 5 runes, and TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.48-orange.svg)
![Svelte](https://img.shields.io/badge/Svelte-5.43-ff3e00.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)

## Features
- App tokens via confidential client credentials at `/api/token/app`; resources are normalized to `/.default`.
- User tokens through the authorization code + PKCE flow (`/auth/start` → `/auth/callback`).
- Immediate JWT decoding with claims, scopes, expiry helpers, and a floating copy panel.
- Local-only history, presets, and quick replay; data lives in `IndexedDB` and can be cleared from Settings.
- Built-in readiness check powered by `/api/health`, surfaced on the home page Setup card.
- Server-only secret handling with `@azure/msal-node`; tokens stay in the browser unless you copy them.

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
1. **Sign In**: The app now requires you to sign in with your Microsoft account to access the dashboard.
2. Choose **User token** and enter scopes (space-separated, e.g., `User.Read Mail.Read`).
3. Click **Get user token**.
   - The app attempts to acquire the token **silently** using your active session.
   - If consent is required (e.g., new scopes), a **popup** will appear for you to approve.
4. The token is returned directly to the client and displayed for decoding.

### History and settings
### History and settings
- Recent targets are stored in `IndexedDB` (via `idb-keyval`) and surface on the dashboard and `/history`.
- **Use again**: One-click replay from history automatically populates and submits the request.
- **Manage history**: Delete individual items via the trash icon or clear all data from the dashboard or Settings.
- Clear data, switch theme, or view your **Profile** details from `/settings`.

### Setup and health
- The home page Setup card reads `/api/health` to confirm `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, and `REDIRECT_URI`.
- The same endpoint can be polled directly for JSON readiness data.

## Project Structure
- `src/routes/+page.svelte` — Token Studio dashboard (flows, setup check, output, history peek).
- `src/routes/api/token/app/+server.ts` — client-credential token issuer (server-side).
- `src/routes/auth/callback/+page.svelte` — Client-side redirect handler for MSAL.js.
- `src/lib/services/auth.ts` — Client-side authentication service (MSAL.js wrapper).
- `src/lib/stores/auth.ts` — Svelte stores for authentication state.
- `src/routes/api/health/+server.ts` — readiness details exposed to the UI.
- `src/routes/history/+page.svelte` and `src/routes/settings/+page.svelte` — local history and preferences.
- `src/lib` — shared UI (shadcn components, layout chrome), helpers (`utils.ts`, `types.ts`), server-only MSAL config (`server/msal.ts`).
- `static/` and `src/app.css`/`src/app.html` — assets and global styles.

## Manual Validation Checklist
- App token flow issues a token for the provided resource and decodes claims.
- User token flow signs in, returns delegated scopes, and decoded claims render without errors.
- Setup card shows ready with a valid `.env`; `/api/health` matches the expected redirect URI.
- History entries appear, can be replayed, and can be cleared (from dashboard or `/settings`).
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
