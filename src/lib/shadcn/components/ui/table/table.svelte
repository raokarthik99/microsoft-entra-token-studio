<script lang="ts">
  import { cn } from "$lib/shadcn/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLTableElement> & { ref?: HTMLTableElement | null } = $props();
</script>

<table
  bind:this={ref}
  data-slot="table"
  class={cn("w-full caption-bottom text-sm", className)}
  {...restProps}
>
  {@render children?.()}
</table>
