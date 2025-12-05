<script lang="ts">
  interface Props {
    steps: Array<{ status: 'pending' | 'complete' | 'error' }>;
  }

  let { steps }: Props = $props();

  const completedCount = $derived(steps.filter(s => s.status === 'complete').length);
  const progress = $derived((completedCount / steps.length) * 100);
</script>

<div class="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
  <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground shrink-0">Progress</span>
  <div class="flex-1 relative h-1.5 overflow-hidden rounded-full bg-muted">
    <div 
      class="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-300 ease-out rounded-full"
      style="width: {progress}%"
    ></div>
  </div>
  <span class="text-xs font-medium text-foreground/80 shrink-0 tabular-nums">{completedCount}/{steps.length}</span>
</div>
