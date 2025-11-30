# Repository Guidelines

## Project Structure & Module Organization
- SvelteKit app rooted in `src/routes` (top-level layout, page, and API endpoints under `api/`, `auth/`, `history/`, `settings/`).
- Shared logic and UI live in `src/lib` (`components/`, `shadcn/` UI kit, `utils.ts` helpers, `types.ts`, server-only MSAL helpers in `server/msal.ts`).
- Global styles and HTML shell: `src/app.css`, `src/app.html`. Static assets go in `static/`.
- Type configuration extends SvelteKit output via `tsconfig.json`; aliases use the default `$lib` path.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies (pnpm is required).
- `pnpm dev` — start the dev server with HMR on the port defined in `.env` (default 5173).
- `pnpm check` — run `svelte-kit sync` plus `svelte-check` with strict TS settings; fix these before commits.
- `pnpm build` — production build; use this to verify SSR/build stability before releasing.
- `pnpm preview` — serve the built app locally to sanity-check deployment output.

## Coding Style & Naming Conventions
- Codebase is TypeScript-first with Svelte 5 runes; prefer 2-space indentation and keep semicolons consistent with existing files.
- Components: PascalCase Svelte components in `src/lib/components` and `src/lib/shadcn`, exported via `src/lib/index.ts`. Utility functions and store helpers use `camelCase`.
- Keep server-only code in `src/lib/server`; avoid importing it into client modules to prevent bundling secrets.
- Favor small, focused components and reuse Shadcn primitives; compose styles with existing utility classes rather than inline styles.

## Testing Guidelines
- There are no automated tests yet; rely on `pnpm check` plus manual verification.
- Manual smoke test both flows: App Token (client credentials) and User Token (auth code) from the home page, confirm decoded claims render, and ensure history entries appear and can be cleared.
- Validate the health endpoint by loading the page with a populated `.env` to confirm tenant/client/redirect checks pass.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit style seen in history (`feat: ...`, `chore: ...`, `refactor: ...`). Keep subjects in the imperative and under ~70 chars.
- PRs should describe the change, list testing performed (commands + manual steps), and link related issues. Include before/after screenshots or a short clip for UI changes.
- Keep changes scoped; prefer separate PRs for refactors vs. feature work to simplify review.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and fill `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`; do not commit `.env` or real secrets.
- Treat access tokens as sensitive: avoid logging them and ensure any new server routes keep token exchange logic server-side (see `src/lib/server/msal.ts`).
