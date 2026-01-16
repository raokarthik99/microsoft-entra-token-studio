<script lang="ts">
  import * as Breadcrumb from "$lib/shadcn/components/ui/breadcrumb";
  import { SidebarTrigger } from "$lib/shadcn/components/ui/sidebar";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { page } from "$app/stores";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import FilterableAppSelect from "$lib/components/FilterableAppSelect.svelte";
  import type { AccountInfo } from "@azure/msal-browser";
  import { LogIn, Plus } from "@lucide/svelte";
  import { appRegistry } from "$lib/states/app-registry.svelte";
  import { goto } from "$app/navigation";

  let { 
    user, 
    onLogout, 
    onLogin, 
    photoUrl,
    onAddApp 
  } = $props<{ 
    user?: AccountInfo | null, 
    onLogout?: () => void, 
    onLogin?: () => void,
    photoUrl?: string | null,
    onAddApp?: () => void
  }>();

  const titles: Record<string, string> = {
    '/': 'Playground',
    '/history': 'History',
    '/settings': 'Settings',
    '/favorites': 'Favorites',
    '/apps': 'Apps',
    '/about': 'About',
    '/contact': 'Contact',
    '/legal': 'Privacy & Terms',
  };

  const subtitles: Record<string, string> = {
    '/': 'Token workbench',
    '/history': 'Your recent calls',
    '/settings': 'Preferences',
    '/favorites': 'Quick access',
    '/apps': 'App Management',
    '/about': 'Project overview',
    '/contact': 'Reach the maintainers',
    '/legal': 'Privacy & terms',
  };

  const pageTitle = $derived(titles[$page.url.pathname] ?? 'Entra Client');
  const pageSubtitle = $derived(subtitles[$page.url.pathname] ?? 'Secure tooling');

  async function handleSelectApp(appId: string) {
    await appRegistry.setActive(appId);
  }

  function handleAddAppClick() {
    if (onAddApp) {
      onAddApp();
    }
  }
</script>

<header class="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div class="flex items-center gap-3">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="hidden h-6 lg:block" />
    <div class="flex flex-col">
      <Breadcrumb.Root>
        <Breadcrumb.List class="text-sm font-semibold leading-tight text-foreground">
          <Breadcrumb.Item>
            <Breadcrumb.Page>{pageTitle}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    </div>
  </div>

  <div class="flex items-center gap-2">
    {#if !appRegistry.hasApps}
      <!-- No apps configured: Show "Connect Client App" CTA -->
      <Button variant="default" size="sm" class="gap-2" onclick={handleAddAppClick}>
        <Plus class="h-4 w-4" />
        Connect Client App
      </Button>
    {:else}
      <!-- Apps exist: Show filterable app selector -->
      <FilterableAppSelect
        width="480px"
        align="end"
        variant="compact"
        onSelectApp={handleSelectApp}
        onAddApp={handleAddAppClick}
        onManageApps={() => goto('/apps')}
      />

      <Separator orientation="vertical" class="h-6" />

      <!-- Sign-in / User menu -->
      {#if user && onLogout}
        <UserMenu {user} {onLogout} {photoUrl} />
      {:else if onLogin}
        <Button variant="outline" size="sm" class="gap-2" onclick={onLogin}>
          <LogIn class="h-4 w-4" />
          Sign In
        </Button>
      {/if}
    {/if}
  </div>
</header>
