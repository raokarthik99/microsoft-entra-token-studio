<script lang="ts">
  import * as Breadcrumb from "$lib/shadcn/components/ui/breadcrumb";
  import { SidebarTrigger } from "$lib/shadcn/components/ui/sidebar";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { page } from "$app/stores";
  import { Sparkles, Sun, MoonStar } from "@lucide/svelte";
  import { setMode, userPrefersMode } from "mode-watcher";

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

  const toggleTheme = () => {
    const next = userPrefersMode.current === 'dark' ? 'light' : 'dark';
    setMode(next);
  };
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
    <Button variant="outline" size="icon" class="rounded-full" onclick={toggleTheme} title="Toggle theme">
      {#if userPrefersMode.current === 'dark'}
        <Sun class="h-4 w-4" />
      {:else}
        <MoonStar class="h-4 w-4" />
      {/if}
    </Button>
  </div>
</header>
