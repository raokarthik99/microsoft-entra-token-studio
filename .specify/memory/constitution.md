<!--
Sync Impact Report
- Version: unversioned → 1.0.0
- Modified principles: none → Protect Credentials & Tokens; Local-Only, Single-User Control; Typed SvelteKit-First Delivery; Safe Token UX & Validation Loops; Quality Gates & Observability Hygiene
- Added sections: Operational Constraints & Security Posture; Development Workflow & Quality Gates
- Removed sections: none
- Templates requiring updates: .specify/templates/plan-template.md ✅ | .specify/templates/spec-template.md ✅ | .specify/templates/tasks-template.md ✅ | command templates (not present) n/a
- Follow-up TODOs: none
-->
# Entra Token Studio Constitution

## Core Principles

### Protect Credentials & Tokens (NON-NEGOTIABLE)
All credentials and tokens are treated as secrets. Confidential client credentials live only in environment variables or Azure Key Vault; the browser holds tokens and app metadata only in IndexedDB. Never log raw tokens, secrets, or Key Vault responses; error messages must avoid sensitive content. Server-only code handles secret retrieval and certificate parsing (including the OpenSSL fallback) and must not be bundled client-side. Clear data paths must fully wipe IndexedDB, localStorage/sessionStorage `msal.*` keys, and any cached tokens.

### Local-Only, Single-User Control
The app runs only on a developer-controlled machine; no hosted multi-user deployment or background service operation is permitted. Avoid features that depend on shared infrastructure or remote analytics. User remains in control of browser storage and backups; defaults keep data local with explicit opt-in for any export/import actions. Assume offline or constrained network environments when designing flows.

### Typed SvelteKit-First Delivery
Use SvelteKit 2 with Svelte 5 runes and TypeScript as the default. Reuse shadcn components and `$lib` utilities; prefer composition over custom one-offs. Keep server-only modules within `$lib/server` and out of client imports. Maintain two-space indentation and existing style conventions; prefer helper extraction over inline complexity.

### Safe Token UX & Validation Loops
UX must preserve guardrails: first-time users redirect to Apps, app configuration validates Key Vault access before saving, and multi-app switching must be reliable. Token status indicators update in real time (expired/expiring/valid) and make reissue paths obvious. Token viewers and history/favorites actions must never expose secrets beyond the user's explicit copy/export actions and should degrade gracefully if authentication fails.

### Quality Gates & Observability Hygiene
`pnpm check` is mandatory pre-merge; run `pnpm build` to catch SSR or adapter regressions. Manual smoke coverage must include: app token issuance, user token issuance (silent + popup fallback), decoded claims filtering, history load/reissue/delete, favorites create/edit/bulk delete, token fullscreen viewer, and settings export/import with replace semantics. Logging must be structured and minimal, redacting tokens and secrets by default.

## Operational Constraints & Security Posture
Keep secrets out of the repository and client bundles; use `.env` only for local development and Key Vault for production-ready secrets or certificates. Ensure OpenSSL is available for PKCS#12 handling. Do not introduce telemetry that could transmit tokens or credentials. Backups are local-only JSON exports with validation before replace; imports must fail safely on schema mismatch. Maintain IndexedDB as the source of truth for history, favorites, preferences, and app configs; server routes must not persist user data.

## Development Workflow & Quality Gates
Start from `.env.example` and keep redirect URIs aligned with the Entra registration. Prefer feature work that reuses existing layout primitives (header, sidebar, footer) and app/favorites/history components. Every change requires a security pass: verify no new logs or error surfaces include secrets, and confirm client/server boundaries are respected. Before completion, run `pnpm check` and `pnpm build`, then manually exercise the smoke flows listed under Quality Gates & Observability Hygiene. Document any residual risks or constraints in PRs, especially around Key Vault dependencies and offline behavior.

## Governance
This constitution supersedes other project practices. Amendments require documented rationale, explicit version bumps, and updates to dependent templates or guidance. Versioning follows semantic rules: MAJOR for breaking principle changes or removals, MINOR for new principles or material expansions, PATCH for clarifications. Reviewers must verify compliance with principles and smoke-test coverage before approving changes. Revisit this constitution quarterly or after any security-relevant incident.

**Version**: 1.0.0 | **Ratified**: 2025-12-06 | **Last Amended**: 2025-12-06
