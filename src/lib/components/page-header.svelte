<script lang="ts">
  import { cn } from "$lib/utils";

  let { 
    title, 
    description, 
    class: className,
    children 
  } = $props<{
    title: string;
    description?: string;
    class?: string;
    children?: import('svelte').Snippet;
  }>();
</script>

<div class={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
  <div class="space-y-1.5">
    <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
    {#if description}
      <p class="text-sm text-muted-foreground text-balance leading-relaxed">
        {description}
      </p>
    {/if}
  </div>
  {#if children}
    <div class="flex items-center gap-2">
      {@render children()}
    </div>
  {/if}
</div>
