<script lang="ts">
  import { cn } from "$lib/utils";

  type DotSize = number | `${number}${"px" | "rem" | "em" | "%"}`;

  let {
    color = "#10b981",
    size = 10,
    ring = false,
    ringColor = "",
    title = ""
  } = $props<{
    color?: string;
    size?: DotSize;
    ring?: boolean;
    ringColor?: string;
    title?: string;
  }>();

  const dimension = $derived(typeof size === "number" ? `${size}px` : size);
</script>

<div
  role="presentation"
  aria-hidden="true"
  class={cn("rounded-full shrink-0", ring ? "ring-2 ring-offset-2 ring-offset-background" : "")}
  style={`width:${dimension};height:${dimension};background-color:${color};${ring && ringColor ? `--tw-ring-color:${ringColor};` : ""}`}
  title={title}
></div>
