<script lang="ts">
  import * as Breadcrumb from "$lib/shadcn/components/ui/breadcrumb";
  import { SidebarTrigger } from "$lib/shadcn/components/ui/sidebar";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { page } from "$app/stores";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import type { AccountInfo } from "@azure/msal-browser";
  import { LogIn } from "@lucide/svelte";

  let { user, onLogout, onLogin, photoUrl } = $props<{ 
    user?: AccountInfo | null, 
    onLogout?: () => void, 
    onLogin?: () => void,
    photoUrl?: string | null 
  }>();

  const titles: Record<string, string> = {
    '/': 'Playground',
    '/history': 'History',
    '/settings': 'Settings',
    '/favorites': 'Favorites',
    '/setup': 'Setup',
  };

  const subtitles: Record<string, string> = {
    '/': 'Token workbench',
    '/history': 'Your recent calls',
    '/settings': 'Preferences',
    '/favorites': 'Quick access',
    '/setup': 'Configuration',
  };

  const pageTitle = $derived(titles[$page.url.pathname] ?? 'Entra Client');
  const pageSubtitle = $derived(subtitles[$page.url.pathname] ?? 'Secure tooling');
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
    {#if user && onLogout}
      <UserMenu {user} {onLogout} {photoUrl} />
    {:else if onLogin}
      <Button variant="outline" size="sm" class="gap-2" onclick={onLogin}>
        <LogIn class="h-4 w-4" />
        Sign In
      </Button>
    {/if}
  </div>
</header>

