<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { SidebarProvider, SidebarInset } from "$lib/shadcn/components/ui/sidebar";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/shadcn/components/ui/sonner";
  import { Button } from "$lib/shadcn/components/ui/button";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import AppHeader from "$lib/components/app-header.svelte";
  import AppFooter from "$lib/components/app-footer.svelte";
  import { onMount } from 'svelte';
  import { AuthService } from '$lib/services/auth';
  import { auth, authServiceStore } from '$lib/stores/auth';
  import type { LayoutData } from './$types';
  import type { ClientConfig } from '$lib/types';
  import TokenDock from "$lib/components/TokenDock.svelte";
  import { AlertTriangle } from "@lucide/svelte";

  let { children, data } = $props<{ children: any, data: LayoutData }>();
  let authService: AuthService;

  onMount(async () => {
    if (data.authConfig) {
      const config: ClientConfig = {
        id: data.authConfig.id ?? 'default',
        name: data.authConfig.name ?? 'Default App',
        clientId: data.authConfig.clientId,
        tenantId: data.authConfig.tenantId,
        redirectUri: data.authConfig.redirectUri,
      };
      authService = new AuthService(config);
      await authService.initialize();
      authServiceStore.set(authService);
    } else {
      // No auth config, mark loading as complete
      auth.setUser(null);
      authServiceStore.set(null);
    }
  });

  $effect(() => {
    if ($auth.isAuthenticated && authService) {
      authService.getProfilePhoto().then(url => {
        auth.setPhoto(url);
      });
    }
  });

  function handleLogin() {
    authService?.login();
  }

  function handleLogout() {
    authService?.logout();
  }
</script>

<svelte:head>
  <title>Entra Token Client</title>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
</svelte:head>

<ModeWatcher />
<Toaster position="top-center" richColors />

{#if $auth.loading}
  <div class="flex h-screen w-full items-center justify-center bg-background">
    <div class="flex flex-col items-center gap-4">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">Loading application...</p>
    </div>
  </div>
{:else}
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset class="min-h-screen bg-background/80">
      <AppHeader user={$auth.user} onLogout={handleLogout} onLogin={handleLogin} photoUrl={$auth.photoUrl} />
      {#if !data.authConfig}
        <div class="p-6 pt-3">
          <div class="mx-auto w-full max-w-6xl">
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <div class="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle class="h-4 w-4" />
                Finish Setup to issue tokens
              </div>
              <Button variant="secondary" size="sm" class="bg-amber-600 text-white hover:bg-amber-700" href="/setup">
                Go to Setup
              </Button>
            </div>
          </div>
        </div>
      {/if}
      <div class="flex flex-1 flex-col gap-6 p-6 pt-2">
        <div class="mx-auto w-full max-w-6xl space-y-6">
          {@render children()}
        </div>
      </div>
      <AppFooter />
    </SidebarInset>
    <TokenDock />
  </SidebarProvider>
{/if}
