<script lang="ts">
  import { CheckCircle2, AlertCircle, Circle, ChevronDown } from '@lucide/svelte';
  import { slide } from 'svelte/transition';

  interface Props {
    step: number;
    title: string;
    status: 'pending' | 'complete' | 'error';
    description?: string;
    collapsible?: boolean;
    defaultOpen?: boolean;
    children?: import('svelte').Snippet;
  }

  let { 
    step, 
    title, 
    status, 
    description,
    collapsible = false,
    defaultOpen = true,
    children 
  }: Props = $props();

  let isOpen = $state(defaultOpen);

  const statusConfig = {
    pending: {
      icon: Circle,
      iconClass: 'text-muted-foreground',
      stepClass: 'bg-muted text-muted-foreground',
      borderClass: 'border-border'
    },
    complete: {
      icon: CheckCircle2,
      iconClass: 'text-emerald-500',
      stepClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      borderClass: 'border-emerald-500/20'
    },
    error: {
      icon: AlertCircle,
      iconClass: 'text-red-500',
      stepClass: 'bg-red-500/10 text-red-500 border-red-500/20',
      borderClass: 'border-red-500/20'
    }
  };

  const config = $derived(statusConfig[status]);
</script>

<div class="rounded-lg border bg-card/80 shadow-sm {config.borderClass} transition-colors">
  <!-- Header -->
  <button
    type="button"
    class="flex w-full items-center gap-3 p-4 text-left"
    class:cursor-pointer={collapsible}
    class:cursor-default={!collapsible}
    onclick={() => collapsible && (isOpen = !isOpen)}
    disabled={!collapsible}
  >
    <!-- Step Number -->
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold {config.stepClass}">
      {step}
    </div>

    <!-- Title & Description -->
    <div class="flex-1 min-w-0">
      <h3 class="font-medium text-foreground text-sm">{title}</h3>
      {#if description}
        <p class="text-xs text-muted-foreground truncate">{description}</p>
      {/if}
    </div>

    <!-- Status Icon -->
    <svelte:component this={config.icon} class="h-4 w-4 shrink-0 {config.iconClass}" />

    <!-- Collapse Toggle -->
    {#if collapsible}
      <ChevronDown 
        class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
      />
    {/if}
  </button>

  <!-- Content -->
  {#if isOpen && children}
    <div transition:slide={{ duration: 150 }} class="border-t border-border/50 px-4 pb-4 pt-3">
      {@render children()}
    </div>
  {/if}
</div>
