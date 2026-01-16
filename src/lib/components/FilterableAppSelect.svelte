<script lang="ts">
  import * as Popover from "$lib/shadcn/components/ui/popover";
  import * as Command from "$lib/shadcn/components/ui/command";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Check, ChevronDown, Shield, KeyRound, Cloud, Plus, Settings } from "@lucide/svelte";
  import { appRegistry, APP_COLORS } from "$lib/states/app-registry.svelte";
  import type { AppConfig } from "$lib/types";

  interface Props {
    onSelectApp?: (appId: string) => void;
    onAddApp?: () => void;
    onManageApps?: () => void;
    width?: string;
    align?: "start" | "center" | "end";
    variant?: "default" | "compact";
  }

  let {
    onSelectApp,
    onAddApp,
    onManageApps,
    width = "400px",
    align = "start",
    variant = "default",
  }: Props = $props();

  let open = $state(false);
  let searchQuery = $state("");

  const filteredApps = $derived(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return appRegistry.apps;

    return appRegistry.apps.filter((app) => {
      return (
        app.name.toLowerCase().includes(query) ||
        app.clientId.toLowerCase().includes(query) ||
        app.keyVault.uri.toLowerCase().includes(query) ||
        (app.keyVault.secretName?.toLowerCase().includes(query) ?? false) ||
        (app.keyVault.certName?.toLowerCase().includes(query) ?? false)
      );
    });
  });

  function handleSelect(appId: string) {
    if (onSelectApp) {
      onSelectApp(appId);
    } else {
      appRegistry.setActive(appId);
    }
    open = false;
    searchQuery = "";
  }

  function getVaultName(uri: string): string {
    return uri.replace("https://", "").replace(".vault.azure.net", "");
  }
</script>

<div style="width: {width}">
  <Popover.Root bind:open>
    <Popover.Trigger class="w-full">
      {#if variant === "compact"}
        <!-- Compact variant for header - 2 row layout -->
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          class="w-full justify-between px-3 py-1 h-auto"
        >
          {#if appRegistry.activeApp}
            <div class="flex items-start gap-2 min-w-0 flex-1 text-left">
              <div 
                class="w-2 h-2 rounded-full shrink-0 mt-1 ring-1 ring-offset-1 ring-offset-background"
                style="background-color: {appRegistry.activeApp.color || APP_COLORS[0]}; --tw-ring-color: {appRegistry.activeApp.color || APP_COLORS[0]}"
              ></div>
              <div class="flex flex-col items-start min-w-0 flex-1">
                <span class="font-semibold text-foreground truncate max-w-[360px]">{appRegistry.activeApp.name}</span>
                <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <code class="font-mono truncate max-w-[220px]">{appRegistry.activeApp.clientId}</code>
                  <span class="text-muted-foreground/40">•</span>
                  <span class="inline-flex items-center gap-0.5">
                    {#if appRegistry.activeApp.keyVault.credentialType === 'certificate'}
                      <Shield class="h-2.5 w-2.5" />
                    {:else}
                      <KeyRound class="h-2.5 w-2.5" />
                    {/if}
                    <span class="truncate max-w-[140px]">{appRegistry.activeApp.keyVault.secretName || appRegistry.activeApp.keyVault.certName}</span>
                  </span>
                </div>
              </div>
            </div>
          {:else}
            <span class="text-muted-foreground">Select app...</span>
          {/if}
          <ChevronDown class="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      {:else}
        <!-- Default variant with full details -->
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          class="w-full justify-between px-4 py-3 h-auto bg-gradient-to-r from-primary/5 to-transparent"
        >
          {#if appRegistry.activeApp}
            <div class="flex items-start gap-3 min-w-0 flex-1 text-left">
              <div 
                class="w-2.5 h-2.5 rounded-full shrink-0 mt-1 ring-2 ring-offset-2 ring-offset-background"
                style="background-color: {appRegistry.activeApp.color || APP_COLORS[0]}; --tw-ring-color: {appRegistry.activeApp.color || APP_COLORS[0]}"
              ></div>
              <div class="flex flex-col items-start gap-1 min-w-0 flex-1">
                <span class="font-semibold text-sm text-foreground truncate max-w-[400px]">{appRegistry.activeApp.name}</span>
                <code class="font-mono text-[11px] text-muted-foreground">{appRegistry.activeApp.clientId}</code>
                <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    {#if appRegistry.activeApp.keyVault.credentialType === 'certificate'}
                      <Shield class="h-3 w-3" />
                      <span class="truncate max-w-[200px]">{appRegistry.activeApp.keyVault.certName}</span>
                    {:else}
                      <KeyRound class="h-3 w-3" />
                      <span class="truncate max-w-[200px]">{appRegistry.activeApp.keyVault.secretName}</span>
                    {/if}
                  </span>
                  <span class="text-muted-foreground/40">•</span>
                  <span class="inline-flex items-center gap-1">
                    <Cloud class="h-3 w-3" />
                    <span class="truncate max-w-[120px]">{getVaultName(appRegistry.activeApp.keyVault.uri)}</span>
                  </span>
                </div>
              </div>
            </div>
          {:else}
            <span class="text-muted-foreground">Select app...</span>
          {/if}
          <ChevronDown class="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      {/if}
    </Popover.Trigger>
    <Popover.Content class="p-0 w-[var(--bits-popover-anchor-width)]" {align}>
      <Command.Root>
        <Command.Input placeholder="Search apps..." bind:value={searchQuery} />
        <Command.List>
          <Command.Empty>No apps found.</Command.Empty>
          <Command.Group heading="Switch app">
            {#each filteredApps() as app (app.id)}
              {@const isSelected = app.id === appRegistry.activeAppId}
              {@const vaultName = getVaultName(app.keyVault.uri)}
              <Command.Item
                value={app.name}
                onSelect={() => handleSelect(app.id)}
                class="flex flex-col items-start gap-1 py-2.5 px-3 {isSelected ? 'bg-primary/10' : ''}"
              >
                <!-- Row 1: App Name -->
                <div class="flex items-center gap-2 w-full">
                  <div 
                    class="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-offset-1 ring-offset-background" 
                    style="background-color: {app.color || APP_COLORS[0]}; --tw-ring-color: {app.color || APP_COLORS[0]}"
                  ></div>
                  <span class="font-semibold text-sm truncate flex-1">{app.name}</span>
                  {#if isSelected}
                    <Check class="h-4 w-4 shrink-0 text-primary" />
                  {/if}
                </div>
                <!-- Row 2: Client ID -->
                <div class="pl-4">
                  <code class="font-mono text-[11px] text-muted-foreground">{app.clientId}</code>
                </div>
                <!-- Row 3: Credential + Key Vault -->
                <div class="flex items-center gap-3 pl-4 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    {#if app.keyVault.credentialType === 'certificate'}
                      <Shield class="h-3 w-3" />
                      <span class="truncate max-w-[140px]">{app.keyVault.certName}</span>
                    {:else}
                      <KeyRound class="h-3 w-3" />
                      <span class="truncate max-w-[140px]">{app.keyVault.secretName}</span>
                    {/if}
                  </span>
                  <span class="text-muted-foreground/40">•</span>
                  <span class="inline-flex items-center gap-1">
                    <Cloud class="h-3 w-3" />
                    <span class="truncate max-w-[100px]">{vaultName}</span>
                  </span>
                </div>
              </Command.Item>
            {/each}
          </Command.Group>
          {#if onAddApp || onManageApps}
            <Command.Separator />
            <Command.Group>
              {#if onAddApp}
                <Command.Item onSelect={() => { onAddApp(); open = false; }} class="gap-2">
                  <Plus class="h-4 w-4" />
                  Connect client app...
                </Command.Item>
              {/if}
              {#if onManageApps}
                <Command.Item onSelect={() => { onManageApps(); open = false; }} class="gap-2">
                  <Settings class="h-4 w-4" />
                  Manage apps
                </Command.Item>
              {/if}
            </Command.Group>
          {/if}
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
</div>
