<script lang="ts">
  import { onMount } from 'svelte';
  import type { HistoryItem } from '$lib/types';
  import * as Card from "$lib/shadcn/components/ui/card";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { Trash2, Play, Clock3, Copy } from "@lucide/svelte";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";

  let history = $state<HistoryItem[]>([]);
  const historyCount = $derived(history.length);
  const lastUpdated = $derived(history[0]?.timestamp ? new Date(history[0].timestamp).toLocaleString() : null);

  onMount(() => {
    loadHistory();
  });

  function loadHistory() {
    const saved = localStorage.getItem('token_history');
    if (saved) {
      try {
        history = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }

  function clearHistory() {
    if (confirm('Clear all history?')) {
      history = [];
      localStorage.removeItem('token_history');
    }
  }

  function restoreHistoryItem(item: HistoryItem) {
    const params = new URLSearchParams();
    if (item.type === 'App Token') {
      params.set('tab', 'app-token');
      params.set('resource', item.target);
    } else {
      params.set('tab', 'user-token');
      params.set('scopes', item.target);
    }
    window.location.href = `/?${params.toString()}`;
  }

  async function copyTarget(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy value', err);
    }
  }
</script>

<svelte:head>
  <title>History | Entra Token Client</title>
</svelte:head>

<div class="space-y-8">
  <Card.Root class="border bg-card/70 p-6 shadow-sm">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="space-y-2">
        <div class="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Audit trail
        </div>
        <h2 class="text-3xl font-semibold tracking-tight">History</h2>
        <p class="max-w-2xl text-sm text-muted-foreground">Everything here lives only in your browser. Reuse inputs quickly or clear them when you are done.</p>
        <div class="flex flex-wrap gap-2">
          <Badge variant="secondary" class="gap-1">
            <Clock3 class="h-4 w-4" />
            {historyCount} saved
          </Badge>
          {#if lastUpdated}
            <Badge variant="outline">Updated {lastUpdated}</Badge>
          {/if}
        </div>
      </div>
      <Button variant="outline" size="sm" onclick={clearHistory} disabled={history.length === 0} class="gap-2">
        <Trash2 class="h-4 w-4" />
        Clear
      </Button>
    </div>
  </Card.Root>

  <Card.Root class="border bg-card/70">
    <Card.Content class="p-0">
      {#if history.length === 0}
        <div class="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <div class="rounded-full bg-muted p-4">
            <Trash2 class="h-8 w-8 text-muted-foreground" />
          </div>
          <div class="space-y-2">
            <h3 class="text-lg font-semibold">No history yet</h3>
            <p class="text-muted-foreground max-w-md">
              Your recent token requests will appear here. Start by generating a token on the dashboard.
            </p>
          </div>
          <Button href="/" variant="default" class="gap-2">
            <Play class="h-4 w-4" />
            Start generating
          </Button>
        </div>
      {:else}
        <ScrollArea class="max-h-[620px]">
          <ul class="divide-y">
            {#each history as item}
              <li class="flex flex-col gap-2 p-4 transition hover:bg-muted/40">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <Badge variant={item.type === 'App Token' ? 'secondary' : 'outline'}>
                        {item.type}
                      </Badge>
                      <span class="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p class="font-mono text-xs text-foreground break-all" title={item.target}>
                      {item.target}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onclick={() => copyTarget(item.target)} title="Copy value">
                      <Copy class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onclick={() => restoreHistoryItem(item)} class="gap-2">
                      <Play class="h-4 w-4" />
                      <span class="hidden sm:inline">Use again</span>
                    </Button>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </ScrollArea>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
