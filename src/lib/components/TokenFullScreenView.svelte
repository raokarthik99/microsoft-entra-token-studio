<script lang="ts">
  import { X, Copy, Check, Search, Filter, Maximize2, Minimize2, FileJson, Shield, Clock, User } from "@lucide/svelte";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { Input } from "$lib/shadcn/components/ui/input";
  import * as Card from "$lib/shadcn/components/ui/card";
  import DecodedClaims from "./DecodedClaims.svelte";
  import { fade, fly } from "svelte/transition";
  import { toast } from "svelte-sonner";

  let { 
    result = null, 
    decodedClaims = null, 
    onClose 
  } = $props<{ 
    result: any, 
    decodedClaims: any, 
    onClose: () => void 
  }>();

  let copiedToken = $state(false);
  let showRawToken = $state(true);

  async function copyToken() {
    if (!result?.accessToken) return;
    try {
      await navigator.clipboard.writeText(result.accessToken);
      copiedToken = true;
      toast.success("Token copied to clipboard");
      setTimeout(() => copiedToken = false, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error("Failed to copy token");
    }
  }

  // Derived values for header
  const resultKind = $derived(result ? (result.scopes?.length ? 'User Token' : 'App Token') : 'Token');
  const scopeCount = $derived(result?.scopes?.length || 0);
  const expiresOnDate = $derived(result?.expiresOn ? new Date(result.expiresOn) : null);
  
  function readableExpiry() {
    if (!expiresOnDate) return null;
    const minutes = Math.round((expiresOnDate.getTime() - Date.now()) / 60000);
    if (minutes < 0) return `${Math.abs(minutes)} min ago`;
    if (minutes <= 1) return 'expires now';
    if (minutes < 60) return `${minutes} min left`;
    return `${Math.round(minutes / 60)} hr remaining`;
  }

  const expiryStatus = $derived(() => {
    if (!expiresOnDate) return 'unknown';
    const minutes = Math.round((expiresOnDate.getTime() - Date.now()) / 60000);
    return minutes < 0 ? 'expired' : minutes <= 5 ? 'expiring' : 'valid';
  });
</script>

<div class="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90" transition:fade={{ duration: 200 }}>
  <!-- Header -->
  <header class="flex items-center justify-between border-b bg-background/50 px-6 py-3 shadow-sm">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-primary/10 p-2">
          <Shield class="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold leading-none tracking-tight">Token Inspector</h2>
        </div>
      </div>
      
      <Separator orientation="vertical" class="h-8" />
      
      <div class="flex items-center gap-2">
        <Badge variant="secondary" class="h-6 gap-1.5 px-2.5 font-medium">
          {resultKind}
        </Badge>
        <Badge variant="outline" class="h-6 gap-1.5 px-2.5 font-normal text-muted-foreground">
          {result?.tokenType || 'Bearer'}
        </Badge>
        {#if expiresOnDate}
          <Badge variant={expiryStatus() === 'expired' ? 'destructive' : expiryStatus() === 'expiring' ? 'secondary' : 'outline'} class="h-6 gap-1.5 px-2.5 font-normal text-muted-foreground">
            <Clock class="h-3.5 w-3.5" />
            {expiryStatus() === 'expired' ? 'Expired' : ''} {readableExpiry()}
          </Badge>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" class="gap-2" onclick={copyToken}>
        {#if copiedToken}
          <Check class="h-4 w-4 text-green-500" />
          Copied
        {:else}
          <Copy class="h-4 w-4" />
          Copy Token
        {/if}
      </Button>
      <Separator orientation="vertical" class="h-6" />
      <Button variant="ghost" size="icon" class="h-9 w-9" onclick={onClose} title="Exit full screen (Esc)">
        <X class="h-5 w-5" />
      </Button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="flex-1 overflow-hidden p-6">
    <div class="grid h-full gap-6 lg:grid-cols-[350px_1fr] xl:grid-cols-[400px_1fr]">
      
      <!-- Left Column: Raw Token & Meta -->
      <div class="flex flex-col gap-6 overflow-hidden" transition:fly={{ x: -20, duration: 300, delay: 100 }}>
        <!-- Raw Token Card -->
        <Card.Root class="flex flex-col overflow-hidden border-primary/20 shadow-md flex-1">
          <Card.Header class="bg-muted/30 px-4 py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileJson class="h-4 w-4 text-muted-foreground" />
                <h3 class="text-sm font-medium">Raw Access Token</h3>
              </div>
              <span class="text-[10px] text-muted-foreground font-mono">
                {result?.accessToken?.length || 0} chars
              </span>
            </div>
          </Card.Header>
          <div class="flex-1 overflow-hidden bg-muted/10 relative group">
            <ScrollArea class="h-full w-full p-4">
              <pre class="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground/90">{result?.accessToken}</pre>
            </ScrollArea>
          </div>
        </Card.Root>

        <!-- Scopes / Audience Card -->
        <Card.Root class="overflow-hidden border-border/60 shadow-sm shrink-0">
          <Card.Header class="bg-muted/30 px-4 py-3">
             <div class="flex items-center gap-2">
                <User class="h-4 w-4 text-muted-foreground" />
                <h3 class="text-sm font-medium">Scopes & Audience</h3>
              </div>
          </Card.Header>
          <Card.Content class="p-4">
            <div class="space-y-4">
              {#if result?.scopes?.length}
                <div class="space-y-2">
                  <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scopes ({result.scopes.length})</span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each result.scopes as scope}
                      <Badge variant="secondary" class="font-mono text-[10px]">{scope}</Badge>
                    {/each}
                  </div>
                </div>
              {/if}
              
              {#if decodedClaims?.aud}
                <div class="space-y-2">
                  <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audience</span>
                  <div class="font-mono text-xs text-foreground/90 break-all bg-muted/30 p-2 rounded border">
                    {decodedClaims.aud}
                  </div>
                </div>
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Right Column: Decoded Claims -->
      <div class="flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg" transition:fly={{ y: 20, duration: 300, delay: 200 }}>
        <div class="flex-1 overflow-hidden p-1">
           <!-- We wrap DecodedClaims in a container that provides the scrolling context if needed, 
                though DecodedClaims has its own internal structure. 
                We might want to customize DecodedClaims to be more "full screen friendly" 
                or just let it expand. -->
           <div class="h-full overflow-y-auto p-4 custom-scrollbar">
             <DecodedClaims claims={decodedClaims} />
           </div>
        </div>
      </div>

    </div>
  </div>
</div>

<style>
  /* Custom scrollbar for the claims area if needed */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.2);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--muted-foreground) / 0.4);
  }
</style>
