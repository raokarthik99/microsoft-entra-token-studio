<script lang="ts">
  import { goto } from "$app/navigation";
  import { buttonVariants } from "$lib/shadcn/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { appRegistry, APP_COLORS } from "$lib/states/app-registry.svelte";
  import { ChevronDown, Plus, Settings, Check, CircleDot } from "@lucide/svelte";

  async function handleSelectApp(appId: string) {
    await appRegistry.setActive(appId);
  }

  function navigateToApps() {
    goto('/apps');
  }

  const activeApp = $derived(appRegistry.activeApp);
  const apps = $derived(appRegistry.apps);
  const hasApps = $derived(appRegistry.hasApps);
</script>

{#if appRegistry.ready}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      <button 
        class={buttonVariants({ variant: "outline", size: "sm" })}
        style="gap: 0.5rem; min-width: 140px; justify-content: space-between; display: inline-flex;"
        type="button"
      >
        {#if activeApp}
          <div class="flex items-center gap-2">
            <div 
              class="w-2.5 h-2.5 rounded-full shrink-0" 
              style="background-color: {activeApp.color || APP_COLORS[0]}"
            ></div>
            <span class="truncate max-w-[100px]">{activeApp.name}</span>
          </div>
        {:else if hasApps}
          <span class="text-muted-foreground">Select app...</span>
        {:else}
          <span class="text-muted-foreground">No apps</span>
        {/if}
        <ChevronDown class="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-[200px]">
      {#if hasApps}
        <DropdownMenu.Group>
          <DropdownMenu.Label class="text-xs text-muted-foreground">Apps</DropdownMenu.Label>
          {#each apps as app (app.id)}
            <DropdownMenu.Item 
              class="flex items-center justify-between gap-2 cursor-pointer"
              onclick={() => handleSelectApp(app.id)}
            >
              <div class="flex items-center gap-2 min-w-0">
                <div 
                  class="w-2.5 h-2.5 rounded-full shrink-0" 
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
      {/if}
      <DropdownMenu.Item class="cursor-pointer gap-2" onclick={navigateToApps}>
        <Plus class="h-4 w-4" />
        Connect client app...
      </DropdownMenu.Item>
      {#if hasApps}
        <DropdownMenu.Item class="cursor-pointer gap-2" onclick={navigateToApps}>
          <Settings class="h-4 w-4" />
          Manage apps
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else}
  <button 
    class={buttonVariants({ variant: "outline", size: "sm" })}
    style="gap: 0.5rem; min-width: 140px;"
    disabled
    type="button"
  >
    <CircleDot class="h-3.5 w-3.5 animate-pulse" />
    Loading...
  </button>
{/if}

