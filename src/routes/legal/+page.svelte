<script lang="ts">
  import { Github, CheckCircle, XCircle, Globe, Server, KeyRound, Database, Lock, ShieldCheck, Scale, FileText, Package, AlertTriangle, User, Star, ShieldHalf } from "@lucide/svelte";
  import { GITHUB_URL } from "$lib/constants";
</script>

<svelte:head>
  <title>Privacy & Terms · Entra Token Studio</title>
  <meta name="description" content="Privacy posture, responsible use guidance, and licensing for Entra Token Studio." />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:py-12">
  <!-- Hero Section -->
  <section
    class="rounded-3xl border border-border/80 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-8 shadow-2xl ring-1 ring-border/70 dark:border-primary/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:ring-primary/10"
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
          <ShieldCheck class="h-3.5 w-3.5" />
          Privacy-First
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Local Storage Only
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Zero Telemetry
        </span>
      </div>
      <h1 class="text-3xl font-semibold text-foreground dark:text-white md:text-4xl">Privacy & Terms</h1>
      <p class="max-w-3xl text-base leading-relaxed text-muted-foreground dark:text-slate-200">
        Entra Token Studio is local-first and open source. Tokens live in your application, credentials stay in Azure Key Vault or your own .env during development, and no telemetry is collected. Use it responsibly and only in environments you control.
      </p>
    </div>
  </section>

  <!-- Data Boundary Visualization -->
  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <div class="flex items-center gap-2 mb-6">
      <Database class="h-5 w-5 text-primary" />
      <h2 class="text-xl font-semibold text-foreground">Where Your Data Lives</h2>
    </div>
    <div class="grid gap-4 md:grid-cols-3">
      <!-- Browser Column -->
      <div class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div class="flex items-center gap-2 mb-4">
          <Globe class="h-5 w-5 text-blue-400" />
          <h3 class="font-semibold text-foreground">Local Storage</h3>
        </div>
        <ul class="space-y-3">
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">Token history</span>
              <p class="text-xs text-muted-foreground">IndexedDB via idb-keyval</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">Favorites & preferences</span>
              <p class="text-xs text-muted-foreground">IndexedDB with tags/colors</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">MSAL cache</span>
              <p class="text-xs text-muted-foreground">localStorage for silent auth</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">App configurations</span>
              <p class="text-xs text-muted-foreground">Client IDs, tenant IDs, names</p>
            </div>
          </li>
        </ul>
        <p class="mt-4 text-xs text-blue-400/80 border-t border-blue-500/20 pt-3">
          ✓ Stays on your machine. Clear anytime via Settings.
        </p>
      </div>

      <!-- Server Column -->
      <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
        <div class="flex items-center gap-2 mb-4">
          <Server class="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 class="font-semibold text-foreground">Dev Server</h3>
        </div>
        <ul class="space-y-3">
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">App token issuance</span>
              <p class="text-xs text-muted-foreground">Client Credentials flow endpoint</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">Key Vault resolution</span>
              <p class="text-xs text-muted-foreground">Fetches secrets/certs on demand</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <span class="text-foreground font-medium">No persistent storage</span>
              <p class="text-xs text-muted-foreground">Tokens never logged or saved</p>
            </div>
          </li>
        </ul>
        <p class="mt-4 text-xs text-amber-600/80 dark:text-amber-400/80 border-t border-amber-500/20 pt-3">
          ✓ Runs on localhost. No external hosting.
        </p>
      </div>

      <!-- Key Vault Column -->
      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div class="flex items-center gap-2 mb-4">
          <KeyRound class="h-5 w-5 text-emerald-400" />
          <h3 class="font-semibold text-foreground">Azure Key Vault</h3>
        </div>
        <ul class="space-y-3">
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">Client secrets</span>
              <p class="text-xs text-muted-foreground">Fetched via Azure SDK</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">Certificates</span>
              <p class="text-xs text-muted-foreground">PEM/PKCS#12 with private key</p>
            </div>
          </li>
          <li class="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <span class="text-foreground font-medium">Access via your identity</span>
              <p class="text-xs text-muted-foreground">DefaultAzureCredential (Azure CLI)</p>
            </div>
          </li>
        </ul>
        <p class="mt-4 text-xs text-emerald-400/80 border-t border-emerald-500/20 pt-3">
          ✓ Your vault, your control.
        </p>
      </div>
    </div>
  </section>

  <!-- What We Collect / Don't Collect -->
  <section class="grid gap-6 md:grid-cols-2">
    <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-foreground flex items-center gap-2">
        <CheckCircle class="h-5 w-5 text-emerald-500" />
        Stored Locally (This Device)
      </h2>
      <ul class="mt-4 space-y-3">
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <Database class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Token history with decoded claims and expiry timestamps</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <Star class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Favorites with names, tags, colors, and use counts</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <User class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>App configurations (client ID, tenant ID, redirect URI)</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <Lock class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>MSAL cache for silent token acquisition</span>
        </li>
      </ul>
    </div>

    <div class="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-destructive flex items-center gap-2">
        <XCircle class="h-5 w-5" />
        We Do Not Collect
      </h2>
      <ul class="mt-4 space-y-3">
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Access tokens, refresh tokens, or authorization codes</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Your tenant ID, client ID, or Key Vault URIs to any server</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Usage analytics, behavior tracking, or telemetry</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Error reports or crash data to external services</span>
        </li>
      </ul>
      <div class="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <p class="text-xs text-destructive/80 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 shrink-0" />
          Clear application storage when done, especially on shared machines.
        </p>
      </div>
    </div>
  </section>

  <!-- Terms of Use -->
  <section class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
    <div class="flex items-center gap-2 mb-6">
      <Scale class="h-5 w-5 text-primary" />
      <h2 class="text-xl font-semibold text-foreground">Terms of Use</h2>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-xl border border-border bg-background/60 p-4 space-y-2">
        <p class="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldHalf class="h-4 w-4 text-primary" />
          Intended Scope
        </p>
        <p class="text-sm text-muted-foreground">For local development, debugging, and education. Not intended for production, shared hosting, or multi-user deployments.</p>
      </div>
      <div class="rounded-xl border border-border bg-background/60 p-4 space-y-2">
        <p class="text-sm font-semibold text-foreground flex items-center gap-2">
          <User class="h-4 w-4 text-primary" />
          Your Responsibilities
        </p>
        <p class="text-sm text-muted-foreground">Use least-privilege scopes, protect your .env files, and avoid copying live tokens into third-party tools. You are responsible for how tokens and secrets are used.</p>
      </div>
      <div class="rounded-xl border border-border bg-background/60 p-4 space-y-2">
        <p class="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-600 dark:text-amber-400" />
          No Affiliation
        </p>
        <p class="text-sm text-muted-foreground">Entra Token Studio is an independent project and is not affiliated with, endorsed by, or connected to Microsoft Corporation.</p>
      </div>
      <div class="rounded-xl border border-border bg-background/60 p-4 space-y-2">
        <p class="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText class="h-4 w-4 text-primary" />
          Liability
        </p>
        <p class="text-sm text-muted-foreground">Provided "as is" without warranty of any kind. Use at your own risk; verify flows and scopes before using against sensitive resources.</p>
      </div>
    </div>
  </section>

  <!-- Open Source License -->
  <section id="license" class="rounded-3xl border border-primary/10 bg-primary/5 p-6 shadow-inner">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-foreground flex items-center gap-2">
          <Scale class="h-5 w-5 text-primary" />
          Open Source License
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">MIT License — broad rights with attribution and warranty disclaimer.</p>
      </div>
      <a
        href="{GITHUB_URL}/blob/main/LICENSE"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/60 hover:bg-primary/15"
      >
        <Github class="h-4 w-4" />
        View LICENSE
      </a>
    </div>
    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p class="text-sm font-semibold text-emerald-400 flex items-center gap-2">
          <CheckCircle class="h-4 w-4" />
          You May
        </p>
        <p class="mt-2 text-sm text-muted-foreground">Use, copy, modify, merge, publish, and distribute the software freely.</p>
      </div>
      <div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
        <p class="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-700 dark:text-amber-300" />
          You Must
        </p>
        <p class="mt-2 text-sm text-muted-foreground">Include the MIT copyright and permission notice in substantial portions of the software.</p>
      </div>
      <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p class="text-sm font-semibold text-blue-400 flex items-center gap-2">
          <FileText class="h-4 w-4" />
          You Accept
        </p>
        <p class="mt-2 text-sm text-muted-foreground">No warranty or liability. Evaluate suitability for your environment before using.</p>
      </div>
    </div>
  </section>

  <!-- Third-Party Dependencies -->
  <section class="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
    <div class="flex items-center gap-2 mb-4">
      <Package class="h-5 w-5 text-primary" />
      <h2 class="text-lg font-semibold text-foreground">Third-Party Dependencies</h2>
    </div>
    <div class="grid gap-4 md:grid-cols-3">
      <div class="space-y-2">
        <p class="text-sm font-semibold text-foreground">Framework & UI</p>
        <p class="text-sm text-muted-foreground">SvelteKit 2, Svelte 5 runes, Tailwind CSS, shadcn-svelte, bits-ui primitives</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-semibold text-foreground">Authentication</p>
        <p class="text-sm text-muted-foreground">@azure/msal-browser, @azure/msal-node for OIDC flows</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-semibold text-foreground">Azure SDK</p>
        <p class="text-sm text-muted-foreground">@azure/identity, @azure/keyvault-secrets, @azure/keyvault-certificates</p>
      </div>
    </div>
  </section>
</div>
