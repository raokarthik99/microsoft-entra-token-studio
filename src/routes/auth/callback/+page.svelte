<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AuthService } from '$lib/services/auth';
  import { auth } from '$lib/stores/auth';
  import { page } from '$app/stores';

  let error = $state<string | null>(null);

  onMount(async () => {
    // We need to re-initialize auth service here because this is a new page load
    // and we need to handle the redirect promise.
    // In a real app, the AuthService singleton or context would handle this,
    // but since we initialize in layout, we might need to wait or re-init.
    
    // However, since +layout.svelte mounts FIRST, it should have already initialized
    // and handled the redirect promise!
    
    // If +layout.svelte handles it, it will update the auth store.
    // We just need to watch the auth store and redirect when authenticated.
    
    // BUT: The hash might be consumed by the router before layout sees it?
    // SvelteKit router usually preserves hash.
    
    // Let's wait a bit for layout to process.
    
    const checkAuth = setInterval(() => {
      if ($auth.isAuthenticated) {
        clearInterval(checkAuth);
        goto('/');
      } else if ($auth.error) {
        clearInterval(checkAuth);
        error = $auth.error;
      }
    }, 100);
    
    // Timeout
    setTimeout(() => {
      clearInterval(checkAuth);
      if (!$auth.isAuthenticated && !error) {
        // If layout didn't handle it, maybe we need to trigger something?
        // Or maybe the hash was lost.
        console.warn('Auth timeout in callback');
        goto('/'); // Go home and let layout try again or show login
      }
    }, 5000);
  });
</script>

<div class="flex h-screen w-full items-center justify-center bg-background">
  <div class="flex flex-col items-center gap-4">
    {#if error}
      <div class="text-destructive">
        <p class="font-bold">Authentication Failed</p>
        <p class="text-sm">{error}</p>
        <a href="/" class="mt-4 text-primary hover:underline">Return to Home</a>
      </div>
    {:else}
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">Completing sign in...</p>
    {/if}
  </div>
</div>
