<script lang="ts">
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/shadcn/components/ui/avatar";
  import { User, LogOut, Settings } from "@lucide/svelte";
  import type { AccountInfo } from "@azure/msal-browser";

  import { cn } from "$lib/utils";

  export let user: AccountInfo;
  export let onLogout: () => void;
  export let photoUrl: string | null = null;

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class="relative h-9 w-9 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
    <Avatar class="h-9 w-9 border border-border/50">
      <AvatarImage src={photoUrl || ""} alt={user.name} />
      <AvatarFallback class="bg-primary/10 text-primary font-medium">
        {getInitials(user.name || 'User')}
      </AvatarFallback>
    </Avatar>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="w-56" align="end">
    <DropdownMenu.Label class="font-normal">
      <div class="flex flex-col space-y-1">
        <p class="text-sm font-medium leading-none">{user.name}</p>
        <p class="text-xs leading-none text-muted-foreground">{user.username}</p>
      </div>
    </DropdownMenu.Label>
    <DropdownMenu.Separator />
    <DropdownMenu.Group>
      <DropdownMenu.Item>
        {#snippet child({ props })}
          <a href="/settings" {...props} class={cn(props.class ?? "", "flex w-full items-center")}>
            <Settings class="mr-2 h-4 w-4" />
            <span>Settings</span>
          </a>
        {/snippet}
      </DropdownMenu.Item>
    </DropdownMenu.Group>
    <DropdownMenu.Separator />
    <DropdownMenu.Item onclick={onLogout} class="text-destructive focus:text-destructive">
      <LogOut class="mr-2 h-4 w-4" />
      <span>Sign out</span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
