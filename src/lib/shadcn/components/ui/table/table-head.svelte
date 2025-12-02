<script lang="ts">
  import { cn } from "$lib/shadcn/utils.js";
  import type { HTMLThAttributes } from "svelte/elements";

  let {
    class: className,
    children,
    ...restProps
  }: HTMLThAttributes = $props();
</script>

<th
  data-slot="table-head"
  class={cn(
    "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</th>
