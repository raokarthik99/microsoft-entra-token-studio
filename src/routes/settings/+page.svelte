<script lang="ts">
  import * as Card from "$lib/shadcn/components/ui/card";
  import PageHeader from "$lib/components/page-header.svelte";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Trash2 } from "@lucide/svelte";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { Badge } from "$lib/shadcn/components/ui/badge";

  const storedKeys = ['token_history', 'last_resource', 'last_scopes', 'active_tab'];

  function clearAllData() {
    if (confirm('This will clear all history and saved preferences. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  }
</script>

<svelte:head>
  <title>Settings | Entra Token Client</title>
</svelte:head>

<div class="space-y-10">
  <PageHeader 
    title="Settings" 
    description="Adjust how the workspace feels and clear cached values when you need a clean slate. All data is stored locally."
  />

  <div class="grid gap-6 lg:grid-cols-2">
    <Card.Root class="border bg-card/70">
      <Card.Header class="pb-2">
        <Card.Title>Appearance</Card.Title>
        <Card.Description>Choose the theme that matches your environment.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div class="space-y-1">
            <Label>Theme</Label>
            <p class="text-sm text-muted-foreground">Apply light, dark, or follow system preference.</p>
          </div>
          <Select.Root type="single" value={userPrefersMode.current} onValueChange={(v) => setMode(v as "light" | "dark" | "system")}>
            <Select.Trigger class="w-[180px]">
              {userPrefersMode.current === "light" ? "Light" : userPrefersMode.current === "dark" ? "Dark" : "System"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="light">Light</Select.Item>
              <Select.Item value="dark">Dark</Select.Item>
              <Select.Item value="system">System</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
        <p class="text-xs text-muted-foreground">Tip: Dark mode keeps tokens easier to scan in low light sessions.</p>
      </Card.Content>
    </Card.Root>

    <Card.Root class="border bg-card/70">
      <Card.Header class="pb-2">
        <Card.Title>Data management</Card.Title>
        <Card.Description>These values never leave your browser.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="rounded-xl border bg-muted/30 p-4">
          <Label class="mb-3 block">Tracked keys</Label>
          <div class="flex flex-wrap gap-2">
            {#each storedKeys as key}
              <Badge variant="outline" class="font-mono text-[11px]">{key}</Badge>
            {/each}
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
          <div class="space-y-1">
            <Label>Clear data</Label>
            <p class="text-sm text-muted-foreground">Remove history and saved preferences from this browser.</p>
          </div>
          <Button variant="destructive" onclick={clearAllData} class="gap-2">
            <Trash2 class="h-4 w-4" />
            Clear all
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>
