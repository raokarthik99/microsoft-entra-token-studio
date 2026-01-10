<script lang="ts">
  import * as Sheet from '$lib/shadcn/components/ui/sheet';
  import type { Component } from 'svelte';
  import { cn } from '$lib/utils';

  export type Props = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: string;
    description?: string;
    icon?: Component | null;
    eyebrow?: string;
    side?: 'right' | 'left' | 'top' | 'bottom';
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
    bodyClass?: string;
    footerClass?: string;
    headerClass?: string;
    contentClass?: string;
    children?: import('svelte').Snippet;
    headerExtra?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    title,
    description = '',
    icon = null,
    eyebrow = '',
    side = 'right' as Props['side'],
    maxWidth = 'lg' as Props['maxWidth'],
    bodyClass = '',
    footerClass = '',
    headerClass = '',
    contentClass = '',
    children,
    headerExtra,
    footer,
  } = $props<Props>();

  const widthMap = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-3xl',
  };
  const widthClass = widthMap[maxWidth ?? 'md'] || 'sm:max-w-xl';
</script>

<Sheet.Root bind:open onOpenChange={onOpenChange}>
  <Sheet.Content
    side={side}
    class={cn(
      'w-full h-full overflow-hidden p-0',
      widthClass,
      contentClass
    )}
  >
    <div class="flex h-full flex-col bg-background">
      <div class={cn(
        'sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur',
        headerClass
      )}>
        <div class="space-y-2 px-5 py-4 pr-6">
          {#if eyebrow}
            <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          {/if}
          <div class="flex items-start gap-3">
            {#if icon}
              {@const Icon = icon}
              <Icon class="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
            {/if}
            <div class="space-y-1">
              <Sheet.Title class="text-lg font-semibold leading-tight">{title}</Sheet.Title>
              {#if description}
                <Sheet.Description class="text-sm leading-relaxed text-muted-foreground">{description}</Sheet.Description>
              {/if}
            </div>
          </div>
          {#if headerExtra}
            {@render headerExtra()}
          {/if}
        </div>
      </div>

      <div class={cn('flex-1 overflow-y-auto px-5 py-4 space-y-4', bodyClass)}>
        {#if children}
          {@render children()}
        {/if}
      </div>

      <div class={cn(
        'sticky bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur',
        footerClass
      )}>
        <div class="flex items-center justify-between gap-3 px-5 py-3">
          {#if footer}
            {@render footer()}
          {/if}
        </div>
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>
