<script lang="ts">
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import * as Card from "$lib/shadcn/components/ui/card";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  import { Search, Copy, Check, Eye, EyeOff, Filter, X } from "@lucide/svelte";
  import { fade, slide } from "svelte/transition";

  let { claims = {} } = $props<{ claims: Record<string, any> | null }>();

  let searchQuery = $state("");
  let showAll = $state(false);
  let copiedKey = $state<string | null>(null);

  const importantKeys = new Set([
    "aud", "iss", "sub", "exp", "nbf", "iat", "scp", "roles", "name", 
    "oid", "tid", "azp", "ver", "upn", "email", "preferred_username"
  ]);

  const claimEntries = $derived(claims ? Object.entries(claims) : []);

  const filteredClaims = $derived(claimEntries.filter(([key, value]) => {
    const matchesSearch = 
      key.toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(value).toLowerCase().includes(searchQuery.toLowerCase());
    
    const isImportant = importantKeys.has(key);
    
    if (searchQuery) return matchesSearch;
    return showAll || isImportant;
  }));

  const hiddenCount = $derived(claimEntries.length - filteredClaims.length);

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedKey = key;
      setTimeout(() => copiedKey = null, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  function formatValue(value: any): string {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function isComplex(value: any): boolean {
    return typeof value === 'object' && value !== null;
  }
</script>

<div class="space-y-3">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-semibold">Decoded claims</h3>
      <Badge variant="outline" class="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
        {claimEntries.length}
      </Badge>
    </div>
    
    <div class="flex items-center gap-2 w-full sm:w-auto">
      <div class="relative flex-1 sm:w-56">
        <Search class="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input 
          placeholder="Search..." 
          class="pl-8 h-8 text-xs" 
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button 
            class="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            onclick={() => searchQuery = ""}
          >
            <X class="h-3.5 w-3.5" />
          </button>
        {/if}
      </div>
      
      <Button 
        variant={showAll ? "secondary" : "outline"} 
        size="sm" 
        class="h-8 gap-1.5 text-xs"
        onclick={() => showAll = !showAll}
      >
        <Filter class="h-3 w-3" />
        {showAll ? 'All' : 'Important'}
      </Button>
    </div>
  </div>

  {#if filteredClaims.length === 0}
    <div class="flex flex-col items-center justify-center py-6 text-center text-muted-foreground border rounded-lg bg-muted/10 border-dashed">
      <Search class="h-6 w-6 mb-2 opacity-50" />
      <p class="text-xs">No claims match.</p>
      <Button variant="link" size="sm" class="text-xs h-auto p-0 mt-1" onclick={() => { searchQuery = ""; showAll = true; }}>
        Clear filters
      </Button>
    </div>
  {:else}
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" transition:fade>
      {#each filteredClaims as [key, value] (key)}
        <div class="group relative rounded-md border bg-card/50 p-2.5 shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:bg-card">
          <div class="flex items-start justify-between gap-2 mb-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate" title={key}>
                {key}
              </span>
              {#if importantKeys.has(key)}
                <div class="h-1 w-1 rounded-full bg-primary/60" title="Important claim"></div>
              {/if}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              class="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1" 
              onclick={() => copyToClipboard(isComplex(value) ? JSON.stringify(value, null, 2) : String(value), key)}
              title="Copy value"
            >
              {#if copiedKey === key}
                <Check class="h-2.5 w-2.5 text-green-500" />
              {:else}
                <Copy class="h-2.5 w-2.5" />
              {/if}
            </Button>
          </div>
          
          <div class="text-[11px] font-mono text-foreground/90 break-all leading-snug">
            {#if Array.isArray(value)}
              <div class="flex flex-wrap gap-1">
                {#each value as item}
                  <Badge variant="secondary" class="font-mono text-[10px] px-2 py-1 h-auto whitespace-normal break-all text-left leading-tight rounded-md w-full">{item}</Badge>
                {/each}
              </div>
            {:else if typeof value === 'object' && value !== null}
              <pre class="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(value)}</pre>
            {:else}
              {value}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if !showAll && !searchQuery && hiddenCount > 0}
    <div class="flex justify-center pt-1">
      <Button variant="ghost" size="sm" class="text-xs text-muted-foreground gap-1.5 h-7" onclick={() => showAll = true}>
        Show {hiddenCount} more
        <Filter class="h-3 w-3" />
      </Button>
    </div>
  {/if}
</div>
