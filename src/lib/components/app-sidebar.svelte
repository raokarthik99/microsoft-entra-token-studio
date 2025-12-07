<script lang="ts">
  import * as Sidebar from "$lib/shadcn/components/ui/sidebar";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { History, Home, Zap, ShieldHalf, Star, Cloud, Settings } from "@lucide/svelte";
  import { page } from '$app/stores';
  import entraIconUrl from "$lib/assets/microsoft-entra-color-icon.svg";
  import PinnedTokensNav from "$lib/components/PinnedTokensNav.svelte";

  let { ...restProps } = $props();

  const nav = [
    { href: '/', label: 'Playground', description: 'Generate and inspect tokens', icon: Home },
    { href: '/apps', label: 'Apps', description: 'Manage connected client apps', icon: Cloud },
    { href: '/favorites', label: 'Favorites', description: 'Quick access presets', icon: Star },
    { href: '/history', label: 'History', description: 'View past generations', icon: History },
  ];

  const quickLinks = [
    { href: '/?tab=user-token', label: 'User token (delegated)', icon: Zap },
    { href: '/?tab=app-token', label: 'App token (daemon)', icon: ShieldHalf },
  ];
</script>

<Sidebar.Root {...restProps}>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          {#snippet child({ props })}
            <a href="/" {...props}>
              <div class="flex items-center gap-3">
                <div class="flex aspect-square size-9 items-center justify-center rounded-xl bg-muted p-1 shrink-0">
                  <img src={entraIconUrl} alt="Microsoft Entra logo" class="size-7" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="block truncate text-sm font-semibold leading-tight">Entra Token Studio</span>
                </div>
              </div>
              <Badge variant="secondary" class="ml-auto text-[11px]">v1</Badge>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Menu</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="space-y-2 pl-2">
          {#each nav as item}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton isActive={$page.url.pathname === item.href}>
                {#snippet child({ props })}
                  <a href={item.href} {...props} class="flex w-full items-start gap-3">
                    <item.icon class="mt-0.5 h-4 w-4" />
                    <div class="flex-1 text-left">
                      <div class="font-medium leading-tight">{item.label}</div>
                      <p class="text-xs text-muted-foreground leading-tight">{item.description}</p>
                    </div>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>

    <Sidebar.Group class="mt-4">
      <Sidebar.GroupLabel>Pinned tokens</Sidebar.GroupLabel>
      <Sidebar.GroupContent class="pl-1">
        <PinnedTokensNav />
      </Sidebar.GroupContent>
    </Sidebar.Group>

    <Sidebar.Group class="mt-4">
      <Sidebar.GroupLabel>Jump to flow</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="space-y-2 pl-2">
          {#each quickLinks as item}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton>
                {#snippet child({ props })}
                  <a href={item.href} {...props} class="flex w-full items-center gap-3 text-sm">
                    <item.icon class="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer class="pb-4">
    <Sidebar.Menu class="px-2">
      <Sidebar.MenuItem>
        <Sidebar.MenuButton isActive={$page.url.pathname === '/settings'} class="rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
          {#snippet child({ props })}
            <a href="/settings" {...props} class="flex w-full items-center gap-3">
              <Settings class="h-4 w-4" />
              <span class="font-medium">Settings</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>

</Sidebar.Root>
