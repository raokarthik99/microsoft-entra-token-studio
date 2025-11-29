# Entra token generator

Lightweight Node/Express client that produces:
- App tokens via the client credentials flow (resource → `/.default` scope)
- User tokens via the authorization code flow (redirect to Microsoft Entra, then redeem)

Built on `@azure/msal-node` to stay close to the Entra SDK surface.

## Prereqs
- Node 18+ (for native fetch/crypto)
- An Entra app registration with:
  - A client secret
  - Redirect URI pointing to `http://localhost:3000/auth/callback` (or your chosen port)
  - API permissions for the resources you plan to request

## Setup
1) Copy the sample env and fill it with your app registration values:
   ```bash
   cp .env.example .env
   # then edit TENANT_ID, CLIENT_ID, CLIENT_SECRET
   ```
2) Install deps and start the server:
   ```bash
   npm install
   npm start
   ```
3) Open `http://localhost:3000` and use the UI.

## Using the endpoints
- **App token (S2S):** `GET /token/app?resource=https://graph.microsoft.com`  
  The resource is converted to `resource/.default` and redeemed with client credentials.
  ```bash
  curl "http://localhost:3000/token/app?resource=https://graph.microsoft.com"
  ```
- **User token (auth code):**
  1. Start sign-in: `GET /auth/start?scopes=User.Read%20Mail.Read`
  2. Complete login/consent in the browser; you are redirected to `/auth/callback` where the token payload is printed.

The home page wires these calls up with a simple UI.

## Environment variables
- `TENANT_ID` – Directory tenant (GUID). Defaults to `organizations` in code but set this for S2S.
- `CLIENT_ID` – App registration (client) ID.
- `CLIENT_SECRET` – Secret for the confidential client.
- `PORT` – Optional; defaults to `3000`.
- `REDIRECT_URI` – Optional; defaults to `http://localhost:PORT/auth/callback`.

## Notes
- Tokens are only returned in the response; nothing is persisted server-side.
- State is kept in-memory with a short TTL to align the `/auth/start` and `/auth/callback` hops.
- The `/health` endpoint echoes config context without secrets for quick verification.
