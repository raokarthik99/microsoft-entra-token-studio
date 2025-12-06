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
  import { appRegistry } from '$lib/states/app-registry.svelte';
  import type { LayoutData } from './$types';
  import type { ClientConfig, AppConfig } from '$lib/types';
  import TokenDock from "$lib/components/TokenDock.svelte";
  import AppFormDialog from "$lib/components/app-form-dialog.svelte";

  let { children, data } = $props<{ children: any, data: LayoutData }>();
  let authService: AuthService | null = $state(null);
  let addAppDialogOpen = $state(false);
  
  /** Track the last app ID the AuthService was initialized for */
  let currentAuthAppId: string | null = $state(null);

  /**
   * Create a ClientConfig from an AppConfig for AuthService initialization.
   */
  function appConfigToClientConfig(app: AppConfig): ClientConfig {
    return {
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      tenantId: app.tenantId,
      redirectUri: app.redirectUri,
    };
  }

  /** Tracks whether we're currently initializing to prevent re-entry */
  let initializingAuth = false;

  /**
   * Initialize or reinitialize the AuthService for a given app.
   */
  async function initializeAuthForApp(app: AppConfig) {
    // Guard against concurrent initializations
    if (initializingAuth) return;
    
    // Set immediately to prevent effect from re-triggering
    currentAuthAppId = app.id;
    initializingAuth = true;
    
    try {
      const config = appConfigToClientConfig(app);
      
      if (authService) {
        // Reinitialize existing service with new config
        await authService.reinitialize(config);
      } else {
        // Create new service
        authService = new AuthService(config);
        await authService.initialize();
      }
      
      authServiceStore.set(authService);
    } finally {
      initializingAuth = false;
    }
  }

  /**
   * Clear auth state when no apps are available.
   */
  function clearAuthState() {
    if (authService) {
      authService.logout();
    }
    authService = null;
    currentAuthAppId = null;
    authServiceStore.set(null);
  }

  onMount(async () => {
    // Ensure registry is loaded before we decide which app to initialize with.
    if (!appRegistry.ready) {
      await appRegistry.load();
    }

    // Prefer the saved active app when available to avoid double-initializing MSAL.
    if (appRegistry.activeApp) {
      await initializeAuthForApp(appRegistry.activeApp);
      return;
    }

    // Fall back to server-side config (env vars) when no apps are stored locally.
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
      currentAuthAppId = config.id;
      authServiceStore.set(authService);
      return;
    }
    
    // Otherwise, mark loading as complete - the $effect will handle
    // initialization when registry becomes ready
    auth.setUser(null);
    authServiceStore.set(null);
  });

  /**
   * Watch for app registry changes and reinitialize auth when needed.
   * This handles:
   * 1. App switches - user selects a different app
   * 2. App deletions - signed-in app gets deleted
   * 3. All apps deleted - clear any orphaned sign-in
   * 4. First load when registry becomes ready
   */
  $effect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    // Wait for registry to be ready
    if (!appRegistry.ready) return;
    
    const activeApp = appRegistry.activeApp;
    const signedInAppId = $auth.signedInAppId;
    
    // Case 1: No apps remain - ensure loading is complete and clear any stale auth
    if (!appRegistry.hasApps) {
      // When running purely from server-provided config, keep the auth session alive.
      if (!data.authConfig) {
        if ($auth.isAuthenticated || signedInAppId) {
          console.log('[Auth] No apps configured, clearing sign-in state');
          clearAuthState();
        }
      }
      // Ensure loading is marked complete even with no apps
      if ($auth.loading) {
        auth.setUser(null);
      }
      return;
    }
    
    // Case 2: Active app changed to a different app than what we initialized for
    if (activeApp && currentAuthAppId && activeApp.id !== currentAuthAppId) {
      console.log(`[Auth] App changed from ${currentAuthAppId} to ${activeApp.id}, reinitializing auth`);
      initializeAuthForApp(activeApp);
      return;
    }
    
    // Case 3: We have an active app but no auth service yet (first load from registry)
    if (activeApp && !authService) {
      console.log(`[Auth] Initializing auth for app: ${activeApp.name}`);
      initializeAuthForApp(activeApp);
      return;
    }
    
    // Case 4: The app we signed in with was deleted (signedInAppId no longer exists in registry)
    if (signedInAppId && !appRegistry.getById(signedInAppId)) {
      console.log(`[Auth] Signed-in app ${signedInAppId} was deleted, clearing sign-in state`);
      auth.reset();
      // Reinitialize with current active app if available
      if (activeApp) {
        initializeAuthForApp(activeApp);
      }
      return;
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

  function handleAddApp() {
    addAppDialogOpen = true;
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
    <AppFormDialog bind:open={addAppDialogOpen} onOpenChange={(v: boolean) => addAppDialogOpen = v} />
    <AppSidebar />
    <SidebarInset class="min-h-screen bg-background/80">
      <AppHeader user={$auth.user} onLogout={handleLogout} onLogin={handleLogin} onAddApp={handleAddApp} photoUrl={$auth.photoUrl} />

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
