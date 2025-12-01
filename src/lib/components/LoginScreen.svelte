<script lang="ts">
  import { Button } from "$lib/shadcn/components/ui/button";
  import * as Card from "$lib/shadcn/components/ui/card";
  import { LogIn, ShieldCheck } from "@lucide/svelte";
  
  export let onLogin: () => void;
  export let loading: boolean = false;
</script>

<div class="flex min-h-[80vh] items-center justify-center p-4">
  <Card.Root class="w-full max-w-md border-border/60 bg-card/50 shadow-xl backdrop-blur-sm">
    <Card.Header class="space-y-4 text-center">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <ShieldCheck class="h-6 w-6 text-primary" />
      </div>
      <div class="space-y-2">
        <Card.Title class="text-2xl font-bold">Welcome Back</Card.Title>
        <Card.Description>
          Sign in to your account to manage tokens and access the dashboard.
        </Card.Description>
      </div>
    </Card.Header>
    <Card.Content class="space-y-4 pb-8">
      <Button 
        size="lg" 
        class="w-full gap-2 font-semibold" 
        onclick={onLogin} 
        disabled={loading}
      >
        {#if loading}
          <span class="animate-pulse">Connecting...</span>
        {:else}
          <LogIn class="h-4 w-4" />
          Sign In with Microsoft
        {/if}
      </Button>
      <p class="text-center text-xs text-muted-foreground">
        By signing in, you agree to our terms of service and privacy policy.
      </p>
    </Card.Content>
  </Card.Root>
</div>
