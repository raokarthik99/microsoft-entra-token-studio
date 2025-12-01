<script lang="ts">
  import * as Breadcrumb from "$lib/shadcn/components/ui/breadcrumb";
  import { SidebarTrigger } from "$lib/shadcn/components/ui/sidebar";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { page } from "$app/stores";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import type { AccountInfo } from "@azure/msal-browser";

  let { user, onLogout, photoUrl } = $props<{ user?: AccountInfo | null, onLogout?: () => void, photoUrl?: string | null }>();

  const titles: Record<string, string> = {
    '/': 'Token Studio',
    '/history': 'History',
    '/settings': 'Settings',
  };

  const subtitles: Record<string, string> = {
    '/': 'Token workbench',
    '/history': 'Your recent calls',
    '/settings': 'Preferences',
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
    {/if}
  </div>
</header>
