<script lang="ts">
  import { Github, MessageSquare, ShieldAlert, GitPullRequest, CheckCircle, XCircle, AlertTriangle, Clock, Bug, Lightbulb } from "@lucide/svelte";
  import { GITHUB_URL } from "$lib/constants";
</script>

<svelte:head>
  <title>Contact · Entra Token Studio</title>
  <meta name="description" content="How to reach the maintainers, ask questions, and report issues for Entra Token Studio." />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:py-12">
  <!-- Hero Section -->
  <section
    class="rounded-3xl border border-border/80 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-8 shadow-2xl ring-1 ring-border/70 dark:border-primary/20 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-950 dark:ring-primary/10"
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Open Source Community
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
          No Telemetry
        </span>
      </div>
      <h1 class="text-3xl font-semibold text-foreground dark:text-white md:text-4xl">Get in Touch</h1>
      <p class="max-w-3xl text-base leading-relaxed text-muted-foreground dark:text-slate-200">
        Questions, ideas, or issues? Choose the path that best fits. Please avoid sharing secrets, tokens, or tenant-specific data—screenshots with redactions and repro steps are enough.
      </p>
    </div>
  </section>

  <!-- Contact Channels -->
  <section class="grid gap-4 md:grid-cols-2">
    <a
      class="group flex flex-col rounded-2xl border-2 border-blue-500/20 bg-card/70 p-5 shadow-sm transition hover:border-blue-500/40 hover:shadow-md"
      href="{GITHUB_URL}/issues/new/choose"
      target="_blank"
      rel="noreferrer"
    >
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-blue-500/20">
          <Bug class="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <p class="font-semibold text-foreground flex items-center gap-2">
            Report an Issue
            <Github class="h-4 w-4 text-muted-foreground" />
          </p>
          <p class="text-xs text-muted-foreground">Bugs, regressions, or unexpected behavior</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">
        Found something broken? Open an issue with repro steps. Include browser/OS info and whether you used Key Vault or local credentials.
      </p>
      <p class="mt-auto pt-3 text-xs text-blue-400 group-hover:text-blue-300">Open issue template →</p>
    </a>

    <a
      class="group flex flex-col rounded-2xl border-2 border-purple-500/20 bg-card/70 p-5 shadow-sm transition hover:border-purple-500/40 hover:shadow-md"
      href="{GITHUB_URL}/discussions"
      target="_blank"
      rel="noreferrer"
    >
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-purple-500/10 p-2.5 ring-1 ring-purple-500/20">
          <MessageSquare class="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <p class="font-semibold text-foreground flex items-center gap-2">
            Start a Discussion
            <Github class="h-4 w-4 text-muted-foreground" />
          </p>
          <p class="text-xs text-muted-foreground">Questions, ideas, or design feedback</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">
        Have a question about usage or want to suggest a feature? Discussions are the place for open-ended conversations.
      </p>
      <p class="mt-auto pt-3 text-xs text-purple-400 group-hover:text-purple-300">Join discussions →</p>
    </a>

    <a
      class="group flex flex-col rounded-2xl border-2 border-red-500/20 bg-card/70 p-5 shadow-sm transition hover:border-red-500/40 hover:shadow-md"
      href="{GITHUB_URL}/security/advisories/new"
      target="_blank"
      rel="noreferrer"
    >
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-red-500/10 p-2.5 ring-1 ring-red-500/20">
          <ShieldAlert class="h-5 w-5 text-red-400" />
        </div>
        <div>
          <p class="font-semibold text-foreground flex items-center gap-2">
            Security Report
            <Github class="h-4 w-4 text-muted-foreground" />
          </p>
          <p class="text-xs text-muted-foreground">Vulnerabilities or data privacy concerns</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">
        Found a security issue? Use private disclosure. We'll respond promptly and credit responsible disclosures.
      </p>
      <p class="mt-auto pt-3 text-xs text-red-400 group-hover:text-red-300">Report privately →</p>
    </a>

    <a
      class="group flex flex-col rounded-2xl border-2 border-emerald-500/20 bg-card/70 p-5 shadow-sm transition hover:border-emerald-500/40 hover:shadow-md"
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
    >
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-emerald-500/10 p-2.5 ring-1 ring-emerald-500/20">
          <GitPullRequest class="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p class="font-semibold text-foreground flex items-center gap-2">
            Contribute
            <Github class="h-4 w-4 text-muted-foreground" />
          </p>
          <p class="text-xs text-muted-foreground">Code, docs, or design improvements</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">
        Want to help? Fork the repo, make your changes, and open a PR. We prioritize safety, clarity, and UX improvements.
      </p>
      <p class="mt-auto pt-3 text-xs text-emerald-400 group-hover:text-emerald-300">View repository →</p>
    </a>
  </section>

  <!-- What to Include / Do Not Send -->
  <section class="grid gap-6 md:grid-cols-2">
    <div class="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-foreground flex items-center gap-2">
        <CheckCircle class="h-5 w-5 text-emerald-500" />
        What to Include
      </h2>
      <ul class="mt-4 space-y-3">
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Clear description of goal, expected result, and what happened instead</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Steps to reproduce (use placeholders like <code class="rounded bg-muted px-1 py-0.5 text-xs">tenant-id-here</code>)</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Token type used (app/user) and flow (auth code, client credentials)</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Browser, OS, and credential source (Key Vault / local .env)</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>Screenshots with sensitive values redacted</span>
        </li>
      </ul>
    </div>

    <div class="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-destructive flex items-center gap-2">
        <XCircle class="h-5 w-5" />
        Please Do Not Send
      </h2>
      <ul class="mt-4 space-y-3">
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Live access tokens, refresh tokens, or auth codes</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Client secrets or certificate private keys</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Real tenant IDs for production environments</span>
        </li>
        <li class="flex items-start gap-3 text-sm text-destructive/90">
          <XCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <span>Key Vault URIs or secret names from sensitive vaults</span>
        </li>
      </ul>
      <div class="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <p class="text-xs text-destructive/80 flex items-start gap-2">
          <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" />
          <span>This project has no telemetry. Keep security reports private until confirmed and fixed.</span>
        </p>
      </div>
    </div>
  </section>

  <!-- Response Expectations -->
  <section class="rounded-2xl border border-primary/10 bg-primary/5 p-6 shadow-inner">
    <h2 class="text-lg font-semibold text-foreground flex items-center gap-2">
      <Clock class="h-5 w-5 text-primary" />
      Response Expectations
    </h2>
    <div class="mt-4 grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border border-border bg-background/60 p-4">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-red-500"></div>
          <p class="text-sm font-semibold text-foreground">Security Issues</p>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">Highest priority. We aim to acknowledge within 24-48 hours and provide updates throughout resolution.</p>
      </div>
      <div class="rounded-xl border border-border bg-background/60 p-4">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-amber-500"></div>
          <p class="text-sm font-semibold text-foreground">Bug Reports</p>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">High priority. We triage within a few days and prioritize based on impact and reproducibility.</p>
      </div>
      <div class="rounded-xl border border-border bg-background/60 p-4">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-blue-500"></div>
          <p class="text-sm font-semibold text-foreground">Features & Questions</p>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">As time allows. We engage with discussions and evaluate feature requests for fit and scope.</p>
      </div>
    </div>
  </section>

  <!-- Collaboration Notes -->
  <section class="grid gap-4 md:grid-cols-3">
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground flex items-center gap-2">
        <Lightbulb class="h-4 w-4 text-primary" />
        Openness
      </p>
      <p class="mt-2 text-sm text-muted-foreground">MIT licensed for broad reuse. Contributions that improve clarity, UX, or safety are prioritized.</p>
    </div>
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground flex items-center gap-2">
        <ShieldAlert class="h-4 w-4 text-primary" />
        Privacy Respect
      </p>
      <p class="mt-2 text-sm text-muted-foreground">No analytics or call-home code. History stays in your browser; secrets stay in Key Vault or .env.</p>
    </div>
    <div class="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <p class="text-sm font-semibold text-foreground flex items-center gap-2">
        <Github class="h-4 w-4 text-primary" />
        Community Driven
      </p>
      <p class="mt-2 text-sm text-muted-foreground">Built by developers, for developers. Your feedback shapes the roadmap.</p>
    </div>
  </section>
</div>
