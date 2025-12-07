<script lang="ts">
  import { Github, ExternalLink } from "@lucide/svelte";
  import { GITHUB_URL } from "$lib/constants";
</script>

<footer class="sticky bottom-0 z-20 border-t bg-gradient-to-r from-background/95 via-background/90 to-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
  <div class="mx-auto flex w-full max-w-6xl items-center justify-center">
    <nav class="flex flex-wrap items-center justify-center gap-3 rounded-full border border-primary/10 bg-background/70 px-4 py-2 text-xs md:text-sm shadow-sm">
      <a href="/about" class="text-foreground underline-offset-4 transition hover:text-primary hover:underline">About</a>
      <span class="text-muted-foreground/60">•</span>
      <a href="/contact" class="text-foreground underline-offset-4 transition hover:text-primary hover:underline">Contact</a>
      <span class="text-muted-foreground/60">•</span>
      <a href="/legal" class="text-foreground underline-offset-4 transition hover:text-primary hover:underline">Privacy & Terms</a>
      <span class="text-muted-foreground/60">•</span>
      <a
        href={GITHUB_URL}
        target="_blank"
        class="text-foreground underline-offset-4 transition hover:text-primary hover:underline"
        rel="noreferrer"
      >
        <Github class="inline-block h-4 w-4 mr-1" />
        GitHub
      </a>
      <span class="hidden text-muted-foreground/60 md:inline">•</span>
      <a
        href="https://learn.microsoft.com/azure/active-directory/develop/"
        target="_blank"
        class="hidden text-foreground underline-offset-4 transition hover:text-primary hover:underline md:inline"
        rel="noreferrer"
      >
        <ExternalLink class="inline-block h-3 w-3 mr-1" />
        Entra docs
      </a>
    </nav>
  </div>
</footer>
