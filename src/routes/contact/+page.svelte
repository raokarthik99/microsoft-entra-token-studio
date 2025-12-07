<script lang="ts">
  import { Github } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Contact · Entra Token Studio</title>
  <meta name="description" content="How to reach the maintainers, ask questions, and report issues for Entra Token Studio." />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:py-12">
  <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 px-6 py-8 shadow-2xl ring-1 ring-primary/10">
    <div class="space-y-3">
      <p class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
        We keep tokens local · No telemetry
      </p>
      <h1 class="text-3xl font-semibold text-white md:text-4xl">Get in touch</h1>
      <p class="max-w-3xl text-base leading-relaxed text-slate-200">
        Questions, ideas, or issues? Choose the path that best fits. Please avoid sharing secrets, tokens, or tenant-specific data—screenshots and repro steps are enough.
      </p>
    </div>
    <div class="mt-6 grid gap-4 md:grid-cols-3">
      <a
        class="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow hover:border-primary/40 hover:bg-primary/10 transition"
        href="https://github.com/raokarthik99/entra-token-client/issues/new/choose"
        target="_blank"
        rel="noreferrer"
      >
        <p class="font-semibold inline-flex items-center gap-2">
          <Github class="h-4 w-4" />
          Create an issue
        </p>
        <p class="mt-1 text-slate-200">Bugs, regressions, or feature requests with repro details.</p>
      </a>
      <a
        class="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow hover:border-primary/40 hover:bg-primary/10 transition"
        href="https://github.com/raokarthik99/entra-token-client/discussions"
        target="_blank"
        rel="noreferrer"
      >
        <p class="font-semibold inline-flex items-center gap-2">
          <Github class="h-4 w-4" />
          Start a discussion
        </p>
        <p class="mt-1 text-slate-200">Usage questions, tips, or design feedback.</p>
      </a>
      <a
        class="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow hover:border-primary/40 hover:bg-primary/10 transition"
        href="https://github.com/raokarthik99/entra-token-client/security/advisories/new"
        target="_blank"
        rel="noreferrer"
      >
        <p class="font-semibold inline-flex items-center gap-2">
          <Github class="h-4 w-4" />
          Security reports
        </p>
        <p class="mt-1 text-slate-200">Responsible disclosure for vulnerabilities or data risks.</p>
      </a>
      <a
        class="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow hover:border-primary/40 hover:bg-primary/10 transition"
        href="https://github.com/raokarthik99/entra-token-client"
        target="_blank"
        rel="noreferrer"
      >
        <p class="font-semibold inline-flex items-center gap-2">
          <Github class="h-4 w-4" />
          Contribute on GitHub
        </p>
        <p class="mt-1 text-slate-200">Read the code, open PRs, or suggest improvements.</p>
      </a>
    </div>
  </section>

  <section class="grid gap-6 md:grid-cols-2">
    <div class="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-foreground">What to include</h2>
      <ul class="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <li>• Clear description of the goal, expected result, and what happened instead.</li>
        <li>• Steps to reproduce (no real tenant IDs or client secrets—use placeholders).</li>
        <li>• Whether you used an app token or user token, and which flow (auth code + PKCE or client credentials).</li>
        <li>• Browser and OS details, plus whether you were using Key Vault or local .env credentials.</li>
      </ul>
    </div>
    <div class="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-destructive">Please do not send</h2>
      <ul class="mt-3 space-y-2 text-sm leading-relaxed text-destructive/90">
        <li>• Live tokens, client secrets, or certificate material.</li>
        <li>• Tenant IDs tied to sensitive environments (use redacted examples).</li>
        <li>• Screenshots that expose access tokens or Key Vault names.</li>
      </ul>
      <p class="mt-3 text-xs text-destructive/80">
        This is a local-first project with no telemetry; keep security reports private until confirmed and fixed.
      </p>
    </div>
  </section>

  <section class="rounded-3xl border border-primary/10 bg-primary/5 p-6 shadow-inner">
    <h2 class="text-xl font-semibold text-foreground">Collaboration notes</h2>
    <div class="mt-3 grid gap-4 md:grid-cols-3">
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Openness</p>
        <p>MIT licensed for broad reuse. Contributions that improve clarity, UX, or safety are prioritized.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Respect for privacy</p>
        <p>No analytics or call-home code. History and favorites stay in your browser; secrets stay in Key Vault or .env.</p>
      </div>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p class="text-foreground font-semibold">Response expectations</p>
        <p>We respond as quickly as we can, prioritizing security, data handling, and regressions first.</p>
      </div>
    </div>
  </section>
</div>
