# Entra Token Client

Developer-focused SvelteKit utility for requesting and inspecting Microsoft Entra ID access tokens. It supports both service-to-service and delegated user flows, decodes JWT claims instantly, and keeps a local history for quick retesting.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.0-orange.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)

## What This App Does
- Requests **App Tokens** (client credentials) for APIs such as Microsoft Graph or custom scopes.
- Requests **User Tokens** (authorization code) via interactive login and PKCE.
- Decodes JWTs on the client for quick inspection of claims, scopes, and expiration.
- Saves recent requests and tokens to local storage for reuse and one-click replay.
- Keeps client secrets server-side by delegating token exchange to `@azure/msal-node`.

## Quick Start
1. **Install prerequisites**
   - Node.js 18+ (LTS recommended).
   - pnpm (`npm i -g pnpm` if you do not have it).
   - A Microsoft Entra tenant with permission to register apps.

2. **Clone and install**
   ```bash
   git clone <repository-url>
   cd entra-token-client
   pnpm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in tenant and app details (see “Configuration” below).

4. **Run**
   ```bash
   pnpm dev
   ```
   Open http://localhost:5173 and follow the on-page forms for App Token or User Token.

## Microsoft Entra App Registration
You need a web app registration for both flows.

1. In Azure Portal, go to **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name it (e.g., `Entra Token Client`) and choose **Single tenant**.
3. Add a redirect URI: **Web** → `http://localhost:5173/auth/callback`.
4. After creating:
   - Copy **Directory (tenant) ID** → `TENANT_ID`.
   - Copy **Application (client) ID** → `CLIENT_ID`.
5. Create a client secret: **Certificates & secrets** → **New client secret**. Copy the value → `CLIENT_SECRET`.
6. API permissions:
   - For App Token tests: add application permissions for your target API (e.g., `Graph` → `Application` permissions).
   - For User Token tests: add delegated permissions (e.g., `User.Read`). Grant admin consent if required.
7. Ensure the redirect URI matches exactly, including scheme/host/port/path.

Useful references:  
- Azure Portal: https://portal.azure.com  
- Entra app registrations: https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app

## Configuration (.env)
Copy `.env.example` and set the following:

```
TENANT_ID=your-tenant-guid
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
PORT=5173
REDIRECT_URI=http://localhost:5173/auth/callback
```

- `TENANT_ID`: Directory ID of the Entra tenant.
- `CLIENT_ID`: App registration client ID.
- `CLIENT_SECRET`: Client secret for the app (used server-side only).
- `PORT`: Port for `pnpm dev` (default 5173).
- `REDIRECT_URI`: Must match the portal redirect URI and the `/auth/callback` route.

> Never commit `.env` or real secrets. Secrets stay server-side; the UI only receives issued tokens.

## Running and Building
- `pnpm dev` – Start SvelteKit with HMR on the configured port.
- `pnpm check` – Run `svelte-kit sync` and type-check via `svelte-check`. Fix all issues before committing.
- `pnpm build` – Production build; ensures SSR and adapter output succeed.
- `pnpm preview` – Serve the production build locally for sanity checks.

## How to Use the App
### App Token (Client Credentials)
1. Open the **App Token** tab on the home page.
2. Enter a **Resource / Scope** (default `https://graph.microsoft.com/.default`).
3. Click **Get App Token**. The server exchanges credentials via MSAL and returns an access token.
4. Inspect claims, expiration, and audiences in the decoded view. Copy the token if needed.

### User Token (Authorization Code + PKCE)
1. Open the **User Token** tab.
2. Enter scopes (default `User.Read`). Use space-delimited scopes.
3. Click **Sign in** to start the auth code flow. Complete the Microsoft login and consent screens.
4. On return to `/auth/callback`, the server redeems the code for an access token; the UI displays and decodes it.

### History and Reuse
- Recent requests and tokens are stored in local storage for quick replay. Clear history from the UI if needed.
- Forms auto-fill from the latest history entry to speed up repeated tests.

### Health Check
With a populated `.env`, hitting the home page performs a lightweight readiness check for tenant/client/redirect configuration. Ensure this passes before testing flows.

## Project Structure
- `src/routes` – SvelteKit routes (pages, layouts, API endpoints). Key areas: `api/`, `auth/`, `history/`, `settings/`.
- `src/lib` – Shared logic and UI. Components in `components/` and `shadcn/`; helpers in `utils.ts`, types in `types.ts`.
- `src/lib/server/msal.ts` – Server-only MSAL helpers; keep secrets and token exchange logic here.
- `src/app.css`, `src/app.html` – Global styles and HTML shell.
- `static/` – Public assets.

## Manual Validation Checklist
- App Token flow returns a token for the requested resource and decodes claims.
- User Token flow completes login, returns delegated token, and claims display correctly.
- History entries appear, can be replayed, and can be cleared.
- Health check on page load passes with valid `.env`.
- No secrets logged in browser DevTools or server logs.

## Troubleshooting
- **Redirect URI mismatch**: Ensure `REDIRECT_URI` in `.env` exactly matches the portal entry and the `/auth/callback` route.
- **Invalid scope/resource**: For client credentials, use `.default` on the resource (e.g., `https://graph.microsoft.com/.default`).
- **Consent required**: Admin consent may be needed for application permissions; grant in the portal.
- **Clock skew/expired token**: Verify system clock; re-request token.
- **CORS or HTTP errors**: Run through `pnpm dev` to ensure SvelteKit serves both UI and API routes together.

## Security Notes
- Keep `CLIENT_SECRET` server-side only; never expose it in the browser or commits.
- Use least-privilege scopes when testing.
- Clear local history if using shared machines; tokens are sensitive.

## License
MIT License. See `LICENSE` if present, or the badge above.
