<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from "$lib/shadcn/components/ui/button";
  import { AlertTriangle, Home, RotateCcw } from "@lucide/svelte";
</script>

<div class="flex min-h-[80vh] flex-col items-center justify-center p-4 text-center">
  <div class="mb-6 rounded-full bg-destructive/10 p-4">
    <AlertTriangle class="h-10 w-10 text-destructive" />
  </div>
  
  <h1 class="mb-2 text-2xl font-bold tracking-tight">Something went wrong</h1>
  <p class="mb-8 max-w-md text-muted-foreground">
    {$page.error?.message || 'An unexpected error occurred while loading this page.'}
  </p>

  <div class="flex gap-4">
    <Button variant="outline" class="gap-2" onclick={() => window.location.reload()}>
      <RotateCcw class="h-4 w-4" />
      Reload page
    </Button>
    <Button class="gap-2" href="/">
      <Home class="h-4 w-4" />
      Back to home
    </Button>
  </div>
  
  {#if $page.status}
    <div class="mt-12 text-xs text-muted-foreground">
      Error code: {$page.status}
    </div>
  {/if}
</div>
