<script lang="ts">
  import { Input } from "$lib/shadcn/components/ui/input";
  import { suggestionsService } from "$lib/states/suggestions.svelte";
  import { appRegistry } from "$lib/states/app-registry.svelte";
  import type { Suggestion } from "$lib/types";
  import { cn } from "$lib/utils";
  import { 
    Pin, 
    Clock, 
    Zap, 
    Lightbulb, 
    Star, 
    AlertTriangle,
  } from "@lucide/svelte";

  let { 
    value = $bindable(), 
    flow, 
    placeholder, 
    id, 
    required = false,
    highlightClass,
    onSelect 
  } = $props<{
    value: string;
    flow: 'user-token' | 'app-token';
    placeholder?: string;
    id?: string;
    required?: boolean;
    highlightClass?: string;
    onSelect?: (val: string) => void;
    onSaveFavorite?: (val: string) => void;
  }>();

  let open = $state(false);
  let highlightIndex = $state(0);
  let focused = $state(false);
  let inputRef: HTMLInputElement | null = $state(null);

  // Derive suggestions
  const suggestions = $derived(
    suggestionsService.getSuggestions(
      value || "", 
      flow, 
      appRegistry.activeAppId, 
      { limit: 20 }
    )
  );

  function handleKeydown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        open = true;
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = (highlightIndex + 1) % suggestions.length;
      scrollIntoView(highlightIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = (highlightIndex - 1 + suggestions.length) % suggestions.length;
      scrollIntoView(highlightIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[highlightIndex]) {
        selectSuggestion(suggestions[highlightIndex]);
      } else {
          // If no suggestion selected (e.g. empty list), enter just submits form (default)
          // But here we prevented default. 
          // If list is empty, enter usually submits.
          // If list has items, enter selects item.
          // If user wants to submit 'foo' which is not in list?
          // Usually 'Enter' on input submits form. 
          // We should only prevent default if we actually select a suggestion.
          open = false;
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      open = false;
    } else if (e.key === "Tab") {
      open = false;
      // Allow default tab behavior (focus next)
    }
  }

  function scrollIntoView(index: number) {
    const el = document.getElementById(`suggestion-${index}`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  function selectSuggestion(s: Suggestion) {
    value = s.value;
    open = false;
    onSelect?.(s.value);
  }

  function clickOutside(node: HTMLElement, onOutside: () => void) {
    const handleClick = (e: MouseEvent) => {
      if (node && !node.contains(e.target as Node) && !e.defaultPrevented) {
        onOutside();
      }
    };
    document.addEventListener('click', handleClick, true);
    return {
      destroy() { document.removeEventListener('click', handleClick, true); }
    };
  }

  function getSectionHeader(index: number, current: any, prev: any) {
    if (index === 0) return getTypeLabel(current.type);
    if (prev && prev.type !== current.type) return getTypeLabel(current.type);
    return null;
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'pinned': return 'Pinned';
      case 'favorite': return 'Favorites';
      case 'history': return 'Recent';
      case 'preset': return 'Suggestions';
      default: return null;
    }
  }

  function getTypeIcon(type: string) {
     switch (type) {
      case 'pinned': return Pin;
      case 'favorite': return Star;
      case 'history': return Clock;
      case 'preset': return Lightbulb;
      default: return Lightbulb;
    }
  }
</script>

<div 
  class="relative w-full"
  use:clickOutside={() => open = false}
>
  <div class="relative">
      <Input
        bind:ref={inputRef}
        type="text"
        {id}
        bind:value
        {placeholder}
        {required}
        class={highlightClass}
        onfocus={() => { focused = true; open = true; }}
        onkeydown={handleKeydown}
        autocomplete="off"
      />
      {#if value && !suggestions.some(s => s.value === value)}
         <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
             <!-- Optional: Add to fav button inside input if not matching? -->
         </div>
      {/if}
  </div>

  {#if open && suggestions.length > 0}
    <div class="absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-border/50 bg-popover text-popover-foreground shadow-2xl shadow-black/25 ring-1 ring-white/10 animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <!-- Dropdown header -->
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
        <div class="flex items-center justify-center h-5 w-5 rounded-md bg-primary/15">
          <Zap class="h-3 w-3 text-primary" />
        </div>
        <span class="text-xs font-semibold text-foreground/80">Quick picks</span>
        <div class="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/70 bg-muted/40 px-2 py-1 rounded-md">
          <span class="font-medium">↑↓</span>
          <span class="opacity-60">navigate</span>
          <span class="opacity-40">·</span>
          <span class="font-medium">Enter</span>
          <span class="opacity-60">select</span>
        </div>
      </div>
      
      <div class="max-h-[320px] overflow-auto py-2 px-1.5">
        {#each suggestions as s, i}
          {@const header = getSectionHeader(i, s, suggestions[i-1])}
          {#if header}
            {@const Icon = getTypeIcon(s.type)}
            <div class="flex items-center gap-2.5 px-2 py-2 mt-2 first:mt-0 mb-1">
              <div class="flex items-center justify-center h-5 w-5 rounded-md bg-muted/60">
                <Icon class="h-3 w-3 text-muted-foreground" />
              </div>
              <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{header}</span>
              <div class="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent ml-1"></div>
            </div>
          {/if}

          <button
            type="button"
            class={cn(
              "group relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-3 text-sm outline-none transition-all duration-100",
              i === highlightIndex 
                ? "bg-primary/10 text-foreground shadow-sm border-l-2 border-l-primary" 
                : "hover:bg-muted/50 hover:text-foreground border-l-2 border-l-transparent"
            )}
            id={`suggestion-${i}`}
            onclick={() => selectSuggestion(s)}
            role="option"
            aria-selected={i === highlightIndex}
          >
            <!-- App Color Dot -->
            {#if s.appColor}
              <div 
                class="absolute left-3 top-4 h-2.5 w-2.5 rounded-full ring-2 ring-background shadow-sm" 
                style={`background-color: ${s.appColor}`}
              ></div>
            {/if}

            <div class={cn("flex flex-col items-start gap-1", s.appColor ? "pl-5" : "")}>
              <div class="flex items-center gap-2">
                 <span class={cn(
                   "font-semibold truncate max-w-[280px]",
                   i === highlightIndex ? "text-foreground" : "text-foreground/90"
                 )}>
                    {s.label || s.value} 
                 </span>
                 <!-- Admin badge -->
                 {#if s.metadata?.adminConsentRequired}
                    <span class="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      <AlertTriangle class="h-2.5 w-2.5" />
                      Admin
                    </span>
                 {/if}
              </div>
              
              {#if s.label && s.label !== s.value}
                 <span class="text-xs text-muted-foreground font-mono truncate max-w-[320px]">
                   {s.value}
                 </span>
              {:else if s.description}
                  <span class="text-xs text-muted-foreground/80 truncate max-w-[320px]">
                   {s.description}
                 </span>
              {/if}

              <!-- Tags -->
              {#if s.tags?.length}
                 <div class="flex gap-1.5 mt-0.5">
                    {#each s.tags as tag}
                       <span class="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{tag}</span>
                    {/each}
                 </div>
              {/if}
            </div>

            <!-- Timestamp for history -->
            {#if s.type === 'history' && s.timestamp}
               <span class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums font-medium">
                  {new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </span>
            {/if}
            
            <!-- Selection indicator -->
            {#if i === highlightIndex}
              <div class="ml-auto pl-2">
                <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              </div>
            {/if}
          </button>
        {/each}
      </div>
      
      <!-- Footer hint -->
      <div class="px-3 py-2 border-t border-border/20 bg-muted/20">
        <span class="text-[10px] text-muted-foreground/50">Tip: Start typing to filter suggestions</span>
      </div>
    </div>
  {/if}
</div>
