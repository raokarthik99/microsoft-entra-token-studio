<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { SidebarProvider, SidebarInset } from "$lib/shadcn/components/ui/sidebar";
  import { ModeWatcher } from "mode-watcher";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import AppHeader from "$lib/components/app-header.svelte";
  import AppFooter from "$lib/components/app-footer.svelte";

  let { children } = $props();
</script>

<svelte:head>
  <title>Entra Token Client</title>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
</svelte:head>

<ModeWatcher />
<SidebarProvider>
  <AppSidebar />
  <SidebarInset class="min-h-screen bg-background/80">
    <AppHeader />
    <div class="flex flex-1 flex-col gap-6 p-6 pt-2">
      <div class="mx-auto w-full max-w-6xl space-y-6">
        {@render children()}
      </div>
    </div>
    <AppFooter />
  </SidebarInset>
</SidebarProvider>
