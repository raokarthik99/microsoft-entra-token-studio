<script lang="ts">
  import * as Breadcrumb from "$lib/shadcn/components/ui/breadcrumb";
  import { SidebarTrigger } from "$lib/shadcn/components/ui/sidebar";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { Button } from "$lib/shadcn/components/ui/button";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { page } from "$app/stores";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import type { AccountInfo } from "@azure/msal-browser";
  import { LogIn, Plus, ChevronDown, Check, Settings } from "@lucide/svelte";
  import { appRegistry, APP_COLORS } from "$lib/states/app-registry.svelte";
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
  };

  const subtitles: Record<string, string> = {
    '/': 'Token workbench',
    '/history': 'Your recent calls',
    '/settings': 'Preferences',
    '/favorites': 'Quick access',
    '/apps': 'App Management',
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
    <Separator orientation="vertical" class="hidden h-6 md:block" />
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
      <!-- No apps configured: Show "Add App" CTA -->
      <Button variant="default" size="sm" class="gap-2" onclick={handleAddAppClick}>
        <Plus class="h-4 w-4" />
        Add App
      </Button>
    {:else}
      <!-- Apps exist: Show app selector -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {#if appRegistry.activeApp}
              <div 
                class="w-2 h-2 rounded-full shrink-0"
                style="background-color: {appRegistry.activeApp.color || APP_COLORS[0]}"
              ></div>
              <span class="font-medium text-foreground max-w-[120px] truncate">{appRegistry.activeApp.name}</span>
            {:else}
              <span class="text-muted-foreground">Select app...</span>
            {/if}
            <ChevronDown class="h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-[200px]">
          <DropdownMenu.Group>
            <DropdownMenu.Label class="text-xs text-muted-foreground">Switch App</DropdownMenu.Label>
            {#each appRegistry.apps as app (app.id)}
              <DropdownMenu.Item 
                class="flex items-center justify-between gap-2 cursor-pointer"
                onclick={() => handleSelectApp(app.id)}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <div 
                    class="w-2 h-2 rounded-full shrink-0" 
                    style="background-color: {app.color || APP_COLORS[0]}"
                  ></div>
                  <span class="truncate">{app.name}</span>
                </div>
                {#if app.id === appRegistry.activeAppId}
                  <Check class="h-4 w-4 shrink-0 text-primary" />
                {/if}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Item class="cursor-pointer gap-2" onclick={handleAddAppClick}>
            <Plus class="h-4 w-4" />
            Add app...
          </DropdownMenu.Item>
          <DropdownMenu.Item class="cursor-pointer gap-2" onclick={() => goto('/apps')}>
            <Settings class="h-4 w-4" />
            Manage apps
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

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

