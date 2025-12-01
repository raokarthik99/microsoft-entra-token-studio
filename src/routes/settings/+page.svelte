<script lang="ts">
  import * as Card from "$lib/shadcn/components/ui/card";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Trash2 } from "@lucide/svelte";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { Badge } from "$lib/shadcn/components/ui/badge";

  import { auth } from '$lib/stores/auth';
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/shadcn/components/ui/avatar";

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

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

  <div class="grid gap-6 lg:grid-cols-2">
    <Card.Root class="border bg-card/70 lg:col-span-2">
      <Card.Header class="pb-2">
        <Card.Title>Profile</Card.Title>
        <Card.Description>Your authenticated session details.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
          <Avatar class="h-16 w-16 border border-border/50">
            <AvatarImage src={$auth.photoUrl || ""} alt={$auth.user?.name} />
            <AvatarFallback class="bg-primary/10 text-xl text-primary font-medium">
              {getInitials($auth.user?.name || 'User')}
            </AvatarFallback>
          </Avatar>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold">{$auth.user?.name}</h3>
            <p class="text-sm text-muted-foreground">{$auth.user?.username}</p>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="font-mono">Tenant ID: {$auth.user?.tenantId}</span>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
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
      </Card.Content>
    </Card.Root>

    <Card.Root class="border bg-card/70">
      <Card.Header class="pb-2">
        <Card.Title>Data management</Card.Title>
        <Card.Description>These values never leave your browser.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
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
