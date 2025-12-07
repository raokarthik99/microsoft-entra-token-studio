<svelte:head>
  <title>About · Entra Token Studio</title>
  <meta name="description" content="What Entra Token Studio is, how it works, and how we keep tokens local-first." />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:py-12">
  <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 shadow-2xl ring-1 ring-primary/10">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="space-y-3">
        <p class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Local-first · Developer-owned
        </p>
        <h1 class="text-3xl font-semibold text-white md:text-4xl">About Entra Token Studio</h1>
        <p class="max-w-3xl text-base leading-relaxed text-slate-200">
          Entra Token Studio is a local-first workbench for experimenting with Microsoft Entra tokens. It keeps secrets server-side or in your own Azure Key Vault, stores token history only in your browser, and helps you iterate safely with short-lived scopes.
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <a
            href="https://github.com/raokarthik99/entra-token-client"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:bg-white/15 hover:ring-white/30"
          >
            View on GitHub
          </a>
          <a
            href="https://github.com/raokarthik99/entra-token-client/issues/new/choose"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-white/40 hover:bg-white/10"
          >
            Report an issue
          </a>
        </div>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur">
        <p class="font-semibold text-white">Principles</p>
        <ul class="mt-2 space-y-1 text-slate-200">
          <li>Local-only token storage</li>
          <li>Azure Key Vault for credentials</li>
          <li>Transparent flows & guardrails</li>
          <li>Open source (MIT)</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="grid gap-6 md:grid-cols-3">
    <div class="rounded-2xl border border-primary/10 bg-background/60 p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-primary">What it does</p>
      <h2 class="text-lg font-semibold text-foreground">Token lab, not a production service</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        Issue, inspect, and reissue Entra tokens with clear visibility into scopes, expiry, and claims. Everything is optimized for hands-on debugging and developer education.
      </p>
    </div>
    <div class="rounded-2xl border border-primary/10 bg-background/60 p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-primary">How it stores data</p>
      <h2 class="text-lg font-semibold text-foreground">Local-first by design</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        Token history, favorites, and preferences live in your browser (IndexedDB). Secrets stay in Azure Key Vault or your local .env for development. Nothing is uploaded to a shared server.
      </p>
    </div>
    <div class="rounded-2xl border border-primary/10 bg-background/60 p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-primary">Why it exists</p>
      <h2 class="text-lg font-semibold text-foreground">Confidence while experimenting</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        Quickly validate app registrations, compare app vs. user tokens, and understand the claims you receive—without risking secrets or tokens in hosted environments.
      </p>
    </div>
  </section>

  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="space-y-2">
        <h3 class="text-xl font-semibold text-foreground">Design pillars</h3>
        <p class="text-sm text-muted-foreground">Choices we made to keep the tool predictable and safe for local use.</p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs font-semibold uppercase text-primary">
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Local storage</span>
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Token clarity</span>
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Key Vault first</span>
      </div>
    </div>
    <div class="mt-6 grid gap-5 md:grid-cols-2">
      <div class="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
        <p class="text-sm font-semibold text-foreground">Transparent token handling</p>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li>• Decoded claims with search, copy, and Important/All toggle.</li>
          <li>• Real-time expiry badges with expiring/expired emphasis.</li>
          <li>• Full-screen inspector for deep dives without clutter.</li>
        </ul>
      </div>
      <div class="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
        <p class="text-sm font-semibold text-foreground">Safety guardrails</p>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li>• First-run acknowledgment to reinforce responsible use.</li>
          <li>• Local-only history and favorites with one-click clear.</li>
          <li>• Secrets and certificates resolved from Azure Key Vault or local .env only.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="rounded-3xl border border-primary/10 bg-primary/5 p-6 shadow-inner">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div class="space-y-2">
        <h3 class="text-xl font-semibold text-foreground">Project notes</h3>
        <p class="text-sm text-muted-foreground">Context for contributors and adopters.</p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs font-medium text-primary">
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">SvelteKit 2 + Svelte 5 runes</span>
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">TypeScript-first</span>
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Shadcn UI</span>
      </div>
    </div>
    <div class="mt-5 grid gap-5 md:grid-cols-3">
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Scope</p>
        <p>Single-user, local dev tooling. Not intended for shared hosting or multi-tenant production deployments.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Data boundaries</p>
        <p>History, favorites, and preferences stay in IndexedDB. MSAL cache stays in localStorage. Tokens are never logged or persisted server-side.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Open source</p>
        <p>Licensed under MIT for broad reuse. Contributions that improve safety, clarity, or developer experience are welcome.</p>
      </div>
    </div>
  </section>

  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <h3 class="text-xl font-semibold text-foreground">Disclaimer</h3>
    <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
      Entra Token Studio is an independent project and is not affiliated with, endorsed by, or connected to Microsoft Corporation. Use it for local development and education only. Do not paste production tokens into third-party tools, and never deploy this app to a public environment with live credentials.
    </p>
  </section>
</div>
