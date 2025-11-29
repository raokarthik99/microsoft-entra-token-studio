<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/token-studio-icon.png';
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
  import type { AppConfig } from '$lib/types';
  import TokenDock from "$lib/components/TokenDock.svelte";
  import AppFormDialog from "$lib/components/app-form-dialog.svelte";
  import ConfirmDialog from "$lib/components/confirm-dialog.svelte";
  import { ShieldAlert } from "@lucide/svelte";
  import { clientStorage, CLIENT_STORAGE_KEYS } from '$lib/services/client-storage';
  import logo from '$lib/assets/token-studio-icon.png';

  let { children } = $props<{ children: any }>();
  let authService: AuthService | null = $state(null);
  let addAppDialogOpen = $state(false);
  
  // FRE State
  let freOpen = $state(false);
  let isFreChecked = $state(false);
  let freAck1 = $state(false); // Local dev only
  let freAck2 = $state(false); // Responsible use
  let freAck3 = $state(false); // Never share tokens
  let freAck4 = $state(false); // Not affiliated with Microsoft

  const canProceedFre = $derived(freAck1 && freAck2 && freAck3 && freAck4);

  async function handleFreConfirm() {
    await clientStorage.set(CLIENT_STORAGE_KEYS.freAcknowledged, true);
    freOpen = false;
  }

  function handleFreExit() {
    // Redirect away to prevent access if they decline
    window.location.href = 'about:blank';
  }
  
  /** Track the last app ID the AuthService was initialized for */
  let currentAuthAppId: string | null = $state(null);



  /** Tracks whether we're currently initializing to prevent re-entry */
  let initializingAuth = false;

  async function initializeAuthForApp(app: AppConfig) {
    // Guard against concurrent initializations
    if (initializingAuth) return;
    
    // Set immediately to prevent effect from re-triggering
    currentAuthAppId = app.id;
    initializingAuth = true;
    
    try {
      if (authService) {
        // Reinitialize existing service with new config
        await authService.reinitialize(app);
      } else {
        // Create new service
        authService = new AuthService(app);
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
    // Check availability of FRE acknowledgment first
    const freAck = await clientStorage.get(CLIENT_STORAGE_KEYS.freAcknowledged);
    if (!freAck) {
      freOpen = true;
    }
    isFreChecked = true;

    // Ensure registry is loaded before we decide which app to initialize with.
    if (!appRegistry.ready) {
      await appRegistry.load();
    }

    // Initialize auth for the active app if available
    if (appRegistry.activeApp) {
      await initializeAuthForApp(appRegistry.activeApp);
      return;
    }
    
    // No apps yet - mark loading as complete, the $effect will handle
    // initialization when an app is added
    auth.setUser(null);
    authServiceStore.set(null);
  });
  
  // ... (effects and handlers remain unchanged)
  
  // Need to splice the handle handlers back in as this tool replaces a block
  $effect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    // Wait for registry to be ready
    if (!appRegistry.ready) return;
    
    const activeApp = appRegistry.activeApp;
    const signedInAppId = $auth.signedInAppId;
    
    // Case 1: No apps remain - clear any stale auth
    if (!appRegistry.hasApps) {
      if ($auth.isAuthenticated || signedInAppId) {
        clearAuthState();
      }
      // Ensure loading is marked complete even with no apps
      if ($auth.loading) {
        auth.setUser(null);
      }
      return;
    }
    
    // Case 2: Active app changed to a different app than what we initialized for
    if (activeApp && currentAuthAppId && activeApp.id !== currentAuthAppId) {
      initializeAuthForApp(activeApp);
      return;
    }
    
    // Case 3: We have an active app but no auth service yet (first load from registry)
    if (activeApp && !authService) {
      initializeAuthForApp(activeApp);
      return;
    }
    
    // Case 4: The app we signed in with was deleted (signedInAppId no longer exists in registry)
    if (signedInAppId && !appRegistry.getById(signedInAppId)) {
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
  <title>Entra Token Studio</title>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
</svelte:head>

<ModeWatcher />
<Toaster position="top-center" richColors />

{#if !isFreChecked || $auth.loading}
  <div class="flex h-screen w-full items-center justify-center bg-background">
    <div class="flex flex-col items-center gap-4">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">{!isFreChecked ? 'Initializing...' : 'Loading application...'}</p>
    </div>
  </div>
{:else if freOpen}
  <div class="flex h-screen w-full items-center justify-center bg-background">
     <!-- Empty container to block view, dialog will float above -->
     <div class="max-w-md text-center space-y-4 opacity-50 blur-[1px]">
        <div class="h-12 w-12 rounded-full bg-muted mx-auto animate-pulse"></div>
        <div class="h-4 w-32 bg-muted rounded mx-auto animate-pulse"></div>
        <div class="h-32 w-full bg-muted/50 rounded-lg animate-pulse"></div>
     </div>
  </div>
  
  <!-- First Run Experience Security Acknowledgment -->
  <ConfirmDialog
    bind:open={freOpen}
    title="Welcome to Entra Token Studio"
    confirmText="Get Started"
    cancelText="Exit"
    destructive={false}
    onConfirm={handleFreConfirm}
    onCancel={handleFreExit}
    confirmDisabled={!canProceedFre}
  >
    {#snippet descriptionContent()}
      <div class="space-y-4">
        <div class="rounded-md border border-primary/20 bg-primary/5 p-4">
          <div class="flex items-start gap-4">
            <div class="flex aspect-square size-12 items-center justify-center rounded-full shrink-0 overflow-hidden">
              <img src={logo} alt="Token Studio" class="size-12 rounded-full object-cover" />
            </div>
            <div class="space-y-2">
              <p class="text-sm text-foreground leading-relaxed">
                This tool allows you to easily manage Entra ID tokens tailored for your development needs. 
                Because it handles sensitive identity data, we need you to acknowledge the following security practices 
                to ensure your data remains safe.
              </p>
              <p class="text-[10px] text-muted-foreground">
                <span class="font-medium text-primary">Disclaimer:</span> This tool is an independent project and is not affiliated with, endorsed by, or connected to Microsoft Corporation.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={freAck1}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I understand this tool is for <strong>local development only</strong> and should <strong>never be deployed</strong> to a public server or shared environment.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={freAck2}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I will use this tool <strong>responsibly</strong> and understand that all data is stored locally in my browser's storage.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={freAck3}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I will <strong>never share my exported data or tokens</strong> with others. Identity tokens are personal and should not be shared, even with trusted team members.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              bind:checked={freAck4}
              class="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
            />
            <span class="text-sm text-foreground leading-tight">
              I understand this tool is <strong>not affiliated with Microsoft</strong>. Microsoft will not provide support for this tool, and I <strong>use it at my own risk</strong>.
            </span>
          </label>
        </div>

        {#if !canProceedFre}
          <p class="text-xs text-muted-foreground pt-2">
            Please acknowledge all items to continue.
          </p>
        {/if}
      </div>
    {/snippet}
  </ConfirmDialog>
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
