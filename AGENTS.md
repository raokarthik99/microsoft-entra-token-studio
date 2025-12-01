# Repository Guidelines

## Context
- SvelteKit 2 app using Svelte 5 runes and TypeScript. UI is built from shadcn components plus a small set of custom layout pieces.
- Two token flows: app tokens via `/api/token/app` (client credentials) and user tokens via `/auth/start` → `/auth/callback` (auth code + PKCE).
- Readiness is surfaced through `/api/health` and mirrored on the home page Setup card.
- Tokens and history live only in `localStorage`; secrets stay server-side. Avoid logging tokens or secrets in client or server code.

## Project Structure & Module Organization
- `src/routes/+page.svelte` is the Token Studio dashboard (setup checks, flows, decoded output, floating panel, history preview).
- Server routes: `src/routes/api/token/app/+server.ts` (confidential client tokens), `src/routes/api/health/+server.ts` (config check), `src/routes/auth/start|callback/+server.ts` (auth code + PKCE).
- Supporting pages: `src/routes/history/+page.svelte` (local history) and `src/routes/settings/+page.svelte` (theme + data clearing).
- Shared logic/UI in `src/lib` (`components/`, `shadcn/`, `utils.ts`, `types.ts`, server-only MSAL helpers in `server/msal.ts`). Keep server imports out of client modules.
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
- Smoke test both flows from the home page, ensure decoded claims render, and confirm history entries appear and can be cleared (dashboard and `/history`).
- Validate readiness with `/api/health` and the Setup card once `.env` is populated (tenant/client/redirect).
- Sanity check theme and data clearing under `/settings` when touching local storage logic.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit style seen in history (`feat: ...`, `chore: ...`, `refactor: ...`). Keep subjects in the imperative and under ~70 chars.
- PRs should describe the change, list testing performed (commands + manual steps), and link related issues. Include before/after screenshots or a short clip for UI changes.
- Keep changes scoped; prefer separate PRs for refactors vs. feature work to simplify review.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and fill `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`; do not commit `.env` or real secrets.
- `REDIRECT_URI` should match the Entra registration; if omitted, the app falls back to `${origin}/auth/callback`.
- Treat access tokens as sensitive: avoid logging them and ensure any new server routes keep token exchange logic server-side (see `src/lib/server/msal.ts`).
- Local history/preferences stay in the browser; remind users to clear data on shared machines when changing those flows.
