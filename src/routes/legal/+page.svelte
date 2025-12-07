<script lang="ts">
  import { Github } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Privacy & Terms · Entra Token Studio</title>
  <meta name="description" content="Privacy posture, responsible use guidance, and licensing for Entra Token Studio." />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:py-12">
  <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 shadow-2xl ring-1 ring-primary/10">
    <div class="space-y-3">
      <p class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
        Privacy-first · Local storage only
      </p>
      <h1 class="text-3xl font-semibold text-white md:text-4xl">Privacy & Terms</h1>
      <p class="max-w-3xl text-base leading-relaxed text-slate-200">
        This project is local-first and open source. Tokens live in your browser, credentials stay in Azure Key Vault or your own .env during development, and no telemetry is collected. Use it responsibly and only in environments you control.
      </p>
    </div>
  </section>

  <section class="grid gap-6 md:grid-cols-2">
    <div class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-foreground">Privacy at a glance</h2>
      <ul class="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <li>• Token history, favorites, and preferences are stored locally in your browser (IndexedDB).</li>
        <li>• MSAL cache stays in localStorage to enable silent auth and quick reissue.</li>
        <li>• Secrets and certificates are retrieved from Azure Key Vault or a local `.env` during development—never persisted to a hosted database.</li>
        <li>• No analytics, tracking pixels, or call-home telemetry are included.</li>
      </ul>
    </div>
    <div class="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-destructive">We do not collect</h2>
      <ul class="mt-3 space-y-2 text-sm leading-relaxed text-destructive/90">
        <li>• Access tokens, refresh tokens, or authorization codes.</li>
        <li>• Tenant IDs, client IDs, or Key Vault URIs beyond what you store locally.</li>
        <li>• Usage analytics or behavior tracking.</li>
      </ul>
      <p class="mt-3 text-xs text-destructive/80">
        Clear your browser storage or use the in-app data clearing tools when you finish a session, especially on shared machines.
      </p>
    </div>
  </section>

  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <h2 class="text-xl font-semibold text-foreground">Terms of use</h2>
    <div class="mt-3 grid gap-4 md:grid-cols-2">
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Intended scope</p>
        <p>For local development, debugging, and education. Not intended for production, shared hosting, or multi-user deployments.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Your responsibilities</p>
        <p>Use least-privilege scopes, protect your environment variables, and avoid copying live tokens into third-party tools. You are responsible for how tokens and secrets are used.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">No affiliation</p>
        <p>Entra Token Studio is an independent project and is not affiliated with, endorsed by, or connected to Microsoft Corporation.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Liability</p>
        <p>Provided “as is” without warranty of any kind. Use at your own risk; verify flows and scopes before using against sensitive resources.</p>
      </div>
    </div>
  </section>

  <section id="license" class="rounded-3xl border border-primary/10 bg-primary/5 p-6 shadow-inner">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 class="text-xl font-semibold text-foreground">Open source license</h2>
        <p class="mt-1 text-sm text-muted-foreground">MIT License — broad rights with attribution and warranty disclaimer.</p>
      </div>
      <a
        href="https://github.com/raokarthik99/entra-token-client/blob/main/LICENSE"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary/60 hover:bg-primary/15"
      >
        <Github class="h-4 w-4" />
        View LICENSE
      </a>
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-3">
      <div class="space-y-1 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">You may</p>
        <p>Use, copy, modify, merge, publish, and distribute the software.</p>
      </div>
      <div class="space-y-1 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">You must</p>
        <p>Include the MIT copyright and permission notice in substantial portions of the software.</p>
      </div>
      <div class="space-y-1 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">You accept</p>
        <p>No warranty or liability. Evaluate suitability for your environment before using.</p>
      </div>
    </div>
  </section>

  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <h2 class="text-xl font-semibold text-foreground">Third-party dependencies</h2>
    <p class="mt-2 text-sm text-muted-foreground">
      Built with SvelteKit 2, Svelte 5 runes, shadcn components, TypeScript, and Microsoft identity libraries. Azure Key Vault access uses `@azure/identity`, `@azure/keyvault-secrets`, and `@azure/keyvault-certificates`.
    </p>
  </section>
</div>
