<script lang="ts">
</script>

<footer class="border-t bg-background/80 py-6 md:px-8 md:py-8">
  <div class="flex flex-col items-start justify-between gap-4 md:flex-row">
    <div class="space-y-1">
      <p class="text-sm leading-relaxed text-muted-foreground">
        Built for fast validation of Microsoft Entra flows. No tokens are stored server-side; keep secrets moving, not sitting.
      </p>
      <p class="text-xs text-muted-foreground">
        Tip: Use a non-production tenant for experimentation and clear history regularly.
      </p>
    </div>
    <div class="flex items-center gap-3 text-sm">
      <a href="/history" class="text-foreground underline-offset-4 transition hover:underline">History</a>
      <a href="/settings" class="text-foreground underline-offset-4 transition hover:underline">Settings</a>
      <a href="https://learn.microsoft.com/azure/active-directory/develop/" target="_blank" class="text-foreground underline-offset-4 transition hover:underline" rel="noreferrer">
        Microsoft Entra docs
      </a>
    </div>
  </div>
</footer>
