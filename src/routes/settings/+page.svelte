<script lang="ts">
  import * as Card from "$lib/shadcn/components/ui/card";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { Trash2, LogOut, User } from "@lucide/svelte";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { toast } from "svelte-sonner";

  import { auth, authServiceStore } from '$lib/stores/auth';
  import { identityPreference } from '$lib/states/identity.svelte';
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/shadcn/components/ui/avatar";
  import { clientStorage } from '$lib/services/client-storage';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import { historyState } from '$lib/states/history.svelte';

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  async function clearAllData() {
    if (!confirm('This will clear all history and saved preferences. Are you sure?')) return;

    await clientStorage.clearAll();
    historyState.items = [];
    favoritesState.items = [];
    await identityPreference.reset();
    window.location.reload();
  }

  function clearCachedIdentity() {
    if (confirm('This will sign you out and clear cached identity. You will need to sign in again.')) {
      const service = $authServiceStore;
      if (service) {
        service.clearCachedAccounts();
        toast.success('Cached identity cleared');
      }
    }
  }

  async function handleIdentityPreferenceChange(value: string) {
    await identityPreference.setMode(value as 'use_last' | 'always_ask');
    toast.success('Identity preference saved');
  }

  const identityPreferenceLabel = $derived(
    identityPreference.mode === 'use_last' ? 'Always use last account' : 'Ask me each time'
  );
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
        {#if $auth.isAuthenticated}
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
        {:else}
          <div class="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User class="h-8 w-8 text-muted-foreground" />
            </div>
            <div class="space-y-1">
              <h3 class="text-lg font-semibold text-muted-foreground">Not signed in</h3>
              <p class="text-sm text-muted-foreground">Sign in via the header or when issuing user tokens.</p>
            </div>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root class="border bg-card/70 lg:col-span-2">
      <Card.Header class="pb-2">
        <Card.Title>Identity & Authentication</Card.Title>
        <Card.Description>Control how the app handles sign-in for user tokens.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div class="space-y-1">
            <Label>Identity behavior</Label>
            <p class="text-sm text-muted-foreground">Choose how the app selects identity when issuing user tokens.</p>
          </div>
          <Select.Root type="single" value={identityPreference.mode} onValueChange={handleIdentityPreferenceChange}>
            <Select.Trigger class="w-[200px]">
              {identityPreferenceLabel}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="use_last">Always use last account</Select.Item>
              <Select.Item value="always_ask">Ask me each time</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        {#if $auth.isAuthenticated}
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div class="space-y-1">
              <Label>Clear cached identity</Label>
              <p class="text-sm text-muted-foreground">Sign out and remove cached account from this browser.</p>
            </div>
            <Button variant="outline" onclick={clearCachedIdentity} class="gap-2">
              <LogOut class="h-4 w-4" />
              Clear identity
            </Button>
          </div>
        {/if}
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
