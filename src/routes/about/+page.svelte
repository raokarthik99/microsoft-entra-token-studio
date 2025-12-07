<script lang="ts">
  import { Github, KeyRound, User, ShieldHalf, History, Star, Database, Download, Lock, Eye, Zap, Server, Globe } from "@lucide/svelte";
</script>

<svelte:head>
  <title>About · Entra Token Studio</title>
  <meta name="description" content="What Entra Token Studio is, how it works, and how we keep tokens local-first." />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:py-12">
  <!-- Hero Section -->
  <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 shadow-2xl ring-1 ring-primary/10">
    <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div class="space-y-4 md:max-w-2xl">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            Local-first
          </span>
          <span class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Open Source
          </span>
          <span class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Zero Telemetry
          </span>
        </div>
        <h1 class="text-3xl font-semibold text-white md:text-4xl">About Entra Token Studio</h1>
        <p class="text-base leading-relaxed text-slate-200">
          A developer workbench for experimenting with Microsoft Entra ID tokens. Issue, inspect, and iterate on access tokens with full visibility into claims, expiry, and scopes—all while keeping your secrets secure and your data local.
        </p>
        <div class="flex flex-wrap gap-2 pt-2">
          <a
            href="https://github.com/raokarthik99/entra-token-client"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:bg-white/15 hover:ring-white/30"
          >
            <Github class="h-4 w-4" />
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
      <div class="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-100 shadow-lg backdrop-blur md:min-w-[200px]">
        <p class="font-semibold text-white flex items-center gap-2">
          <Lock class="h-4 w-4 text-primary" />
          Core Principles
        </p>
        <ul class="mt-3 space-y-2 text-slate-200">
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Local-only token storage
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Azure Key Vault for credentials
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Transparent flows & guardrails
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Open source (MIT)
          </li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Feature Showcase -->
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <Zap class="h-5 w-5 text-primary" />
      <h2 class="text-xl font-semibold text-foreground">What You Get</h2>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="group rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-blue-500/10 p-2 ring-1 ring-blue-500/20">
            <User class="h-5 w-5 text-blue-400" />
          </div>
          <h3 class="font-semibold text-foreground">User Tokens</h3>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Delegated permissions via Authorization Code + PKCE. Test what a signed-in user can access in Graph, custom APIs, or Microsoft 365.
        </p>
        <p class="mt-2 text-xs text-primary/80">Auth Code Flow • Silent Acquisition • Popup Fallback</p>
      </div>

      <div class="group rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-purple-500/10 p-2 ring-1 ring-purple-500/20">
            <ShieldHalf class="h-5 w-5 text-purple-400" />
          </div>
          <h3 class="font-semibold text-foreground">App Tokens</h3>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Application permissions via Client Credentials. Perfect for daemons, background jobs, and service-to-service scenarios.
        </p>
        <p class="mt-2 text-xs text-primary/80">Client Credentials • Certificate Auth • Secret Auth</p>
      </div>

      <div class="group rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-500/20">
            <KeyRound class="h-5 w-5 text-amber-400" />
          </div>
          <h3 class="font-semibold text-foreground">Key Vault Integration</h3>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Secrets and certificates stay in Azure Key Vault. Auto-detect configured credentials with health checks and validation.
        </p>
        <p class="mt-2 text-xs text-primary/80">Certificates • Secrets • DefaultAzureCredential</p>
      </div>

      <div class="group rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-500/20">
            <Eye class="h-5 w-5 text-emerald-400" />
          </div>
          <h3 class="font-semibold text-foreground">Token Intelligence</h3>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Live expiry badges, decoded claims with search/filter, full-screen inspector, and per-claim copy. Know exactly what's in your token.
        </p>
        <p class="mt-2 text-xs text-primary/80">Decoded Claims • Expiry Tracking • Important Claims Toggle</p>
      </div>

      <div class="group rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-pink-500/10 p-2 ring-1 ring-pink-500/20">
            <Star class="h-5 w-5 text-pink-400" />
          </div>
          <h3 class="font-semibold text-foreground">Favorites & History</h3>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Save token configurations with tags, colors, and notes. Pin favorites for one-click reissue. Full history with load/reissue support.
        </p>
        <p class="mt-2 text-xs text-primary/80">Tags & Colors • Pinned Favorites • Quick Reissue</p>
      </div>

      <div class="group rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-cyan-500/10 p-2 ring-1 ring-cyan-500/20">
            <Download class="h-5 w-5 text-cyan-400" />
          </div>
          <h3 class="font-semibold text-foreground">Data Portability</h3>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Export all your data to JSON—history, favorites, app configs, preferences. Import with validation and replace semantics.
        </p>
        <p class="mt-2 text-xs text-primary/80">JSON Export • Validated Import • Full Backup</p>
      </div>
    </div>
  </section>

  <!-- How It Works - Data Flow -->
  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <div class="flex items-center gap-2 mb-6">
      <Server class="h-5 w-5 text-primary" />
      <h2 class="text-xl font-semibold text-foreground">How Data Flows</h2>
    </div>
    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div class="flex items-center gap-2 mb-3">
          <Globe class="h-5 w-5 text-blue-400" />
          <h3 class="font-semibold text-foreground">Your Browser</h3>
        </div>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li class="flex items-center gap-2">
            <Database class="h-3.5 w-3.5 text-blue-400" />
            Token history (IndexedDB)
          </li>
          <li class="flex items-center gap-2">
            <Star class="h-3.5 w-3.5 text-blue-400" />
            Favorites & preferences
          </li>
          <li class="flex items-center gap-2">
            <Lock class="h-3.5 w-3.5 text-blue-400" />
            MSAL cache (localStorage)
          </li>
          <li class="flex items-center gap-2">
            <User class="h-3.5 w-3.5 text-blue-400" />
            App configurations
          </li>
        </ul>
        <p class="mt-3 text-xs text-blue-400/80">Stays on your machine. No server sync.</p>
      </div>

      <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div class="flex items-center gap-2 mb-3">
          <Server class="h-5 w-5 text-amber-400" />
          <h3 class="font-semibold text-foreground">Dev Server</h3>
        </div>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li class="flex items-center gap-2">
            <ShieldHalf class="h-3.5 w-3.5 text-amber-400" />
            App token issuance
          </li>
          <li class="flex items-center gap-2">
            <KeyRound class="h-3.5 w-3.5 text-amber-400" />
            Key Vault resolution
          </li>
          <li class="flex items-center gap-2">
            <Lock class="h-3.5 w-3.5 text-amber-400" />
            Credential validation
          </li>
        </ul>
        <p class="mt-3 text-xs text-amber-400/80">Runs locally. No external hosting.</p>
      </div>

      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div class="flex items-center gap-2 mb-3">
          <KeyRound class="h-5 w-5 text-emerald-400" />
          <h3 class="font-semibold text-foreground">Azure Key Vault</h3>
        </div>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li class="flex items-center gap-2">
            <Lock class="h-3.5 w-3.5 text-emerald-400" />
            Client secrets
          </li>
          <li class="flex items-center gap-2">
            <ShieldHalf class="h-3.5 w-3.5 text-emerald-400" />
            Certificates (PEM/PKCS#12)
          </li>
        </ul>
        <p class="mt-3 text-xs text-emerald-400/80">Your vault, your control. Access via DefaultAzureCredential.</p>
      </div>
    </div>
  </section>

  <!-- Design Pillars -->
  <section class="rounded-3xl border border-primary/10 bg-primary/5 p-6 shadow-inner">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
      <div class="space-y-1">
        <h2 class="text-xl font-semibold text-foreground">Design Pillars</h2>
        <p class="text-sm text-muted-foreground">Choices we made to keep the tool predictable and safe for local use.</p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs font-semibold uppercase text-primary">
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Local storage</span>
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Token clarity</span>
        <span class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">Key Vault first</span>
      </div>
    </div>
    <div class="grid gap-5 md:grid-cols-2">
      <div class="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
        <p class="text-sm font-semibold text-foreground flex items-center gap-2">
          <Eye class="h-4 w-4 text-primary" />
          Transparent token handling
        </p>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li>• Decoded claims with search, copy, and Important/All toggle</li>
          <li>• Real-time expiry badges with expiring/expired emphasis</li>
          <li>• Full-screen inspector for deep dives without clutter</li>
        </ul>
      </div>
      <div class="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
        <p class="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock class="h-4 w-4 text-primary" />
          Safety guardrails
        </p>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li>• First-run acknowledgment to reinforce responsible use</li>
          <li>• Local-only history and favorites with one-click clear</li>
          <li>• Secrets and certificates from Key Vault or local .env only</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Project Notes -->
  <section class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground">Scope</p>
      <p class="mt-1 text-sm text-muted-foreground">Single-user, local dev tooling. Not intended for shared hosting or multi-tenant production.</p>
    </div>
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground">Data Boundaries</p>
      <p class="mt-1 text-sm text-muted-foreground">History and preferences in IndexedDB. MSAL cache in localStorage. Tokens never logged server-side.</p>
    </div>
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground">Open Source</p>
      <p class="mt-1 text-sm text-muted-foreground">MIT licensed for broad reuse. Contributions that improve safety and clarity are welcome.</p>
    </div>
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground">Tech Stack</p>
      <p class="mt-1 text-sm text-muted-foreground">SvelteKit 2 + Svelte 5, Tailwind + shadcn, MSAL for auth, Azure SDK for Key Vault.</p>
    </div>
  </section>

  <!-- Disclaimer -->
  <section class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 shadow-sm">
    <p class="text-sm font-semibold text-amber-200 flex items-center gap-2">
      <Lock class="h-4 w-4" />
      Disclaimer
    </p>
    <p class="mt-2 text-sm leading-relaxed text-amber-200/80">
      Entra Token Studio is an independent project and is not affiliated with, endorsed by, or connected to Microsoft Corporation. Use it for local development and education only. Do not paste production tokens into third-party tools, and never deploy this app to a public environment with live credentials.
    </p>
  </section>
</div>
