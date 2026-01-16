<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import * as Card from '$lib/shadcn/components/ui/card';
  import * as Collapsible from '$lib/shadcn/components/ui/collapsible';
  import { Button } from '$lib/shadcn/components/ui/button';
  import logo from '$lib/assets/token-studio-icon.png';
  import { CheckCircle2, Copy, Loader2, XCircle, ChevronDown } from '@lucide/svelte';

  type CallbackStatus = 'working' | 'success' | 'error';
  type FriendlyError = {
    title: string;
    summary: string;
    nextSteps: string[];
    technical?: string;
  };

  let status = $state<CallbackStatus>('working');
  let rawError = $state<string | null>(null);
  let detailsOpen = $state(false);
  let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
  let isPopup = $state(false);
  let showStuckHelp = $state(false);

  function summarizeAuthError(message: string): FriendlyError {
    const normalized = message.toLowerCase();

    // Common "user backed out" scenarios.
    if (
      normalized.includes('user_cancelled') ||
      normalized.includes('user canceled') ||
      normalized.includes('user cancelled') ||
      normalized.includes('access_denied')
    ) {
      return {
        title: "Sign-in was canceled",
        summary: "The sign-in request was closed or canceled before it could finish.",
        nextSteps: [
          "Close this window and try again from Entra Token Studio.",
          "If you were trying to switch accounts, pick the correct account and complete the prompts."
        ],
        technical: message,
      };
    }

    // Consent declined / permissions not granted.
    if (normalized.includes('aadsts65004') || normalized.includes('declined to consent')) {
      return {
        title: "Permissions weren’t granted",
        summary: "You didn’t approve the requested permissions, so Entra Token Studio can’t finish signing you in.",
        nextSteps: [
          "Close this window and try again, then select Accept on the permissions prompt.",
          "If your org requires admin approval, ask an admin to grant consent for the app."
        ],
        technical: message,
      };
    }

    // Generic fallback.
    return {
      title: "Sign-in didn’t complete",
      summary: "We couldn’t finish signing you in. You can close this window and return to Entra Token Studio to try again.",
      nextSteps: [
        "Close this window and try again from Entra Token Studio.",
        "If this keeps happening, open Details and share the trace/correlation IDs with your Entra admin."
      ],
      technical: message,
    };
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      copyState = 'copied';
      setTimeout(() => (copyState = 'idle'), 1500);
    } catch {
      copyState = 'failed';
      setTimeout(() => (copyState = 'idle'), 1500);
    }
  }

  function tryCloseWindow() {
    try {
      window.close();
    } catch {
      // Best-effort: window.close may be blocked if not opened by script.
    }
  }

  onMount(() => {
    isPopup = !!window.opener && window.opener !== window;

    // Watch auth state that is produced by +layout.svelte / AuthService.handleRedirectPromise().
    const unsubscribe = auth.subscribe((state) => {
      if (state.isAuthenticated) {
        status = 'success';

        // Redirect back to the main app. If this is a popup window, also try to close it.
        setTimeout(() => {
          if (isPopup) {
            tryCloseWindow();
          }
          goto('/');
        }, 450);
        return;
      }

      if (state.error) {
        status = 'error';
        rawError = state.error;
        return;
      }

      status = 'working';
    });

    // If nothing resolves, offer manual guidance instead of silently bouncing.
    const stuckTimer = setTimeout(() => {
      if (status === 'working') {
        showStuckHelp = true;
      }
    }, 6000);

    return () => {
      clearTimeout(stuckTimer);
      unsubscribe();
    };
  });
</script>

<div class="w-full px-4">
  <Card.Root class="w-full max-w-lg border-border/60 bg-card/70 shadow-xl shadow-black/10 backdrop-blur">
    <Card.Header class="items-center text-center">
      <div class="mb-2 flex items-center justify-center gap-3">
        <img src={logo} alt="Entra Token Studio" class="h-9 w-9 rounded" />
      </div>
      <Card.Title class="text-base font-semibold">Entra Token Studio</Card.Title>
      <Card.Description>
        {#if status === 'working'}
          Finishing sign-in…
        {:else if status === 'success'}
          Sign-in complete
        {:else}
          Sign-in didn’t complete
        {/if}
      </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-5">
      {#if status === 'working'}
        <div class="flex flex-col items-center gap-3 text-center">
          <Loader2 class="h-10 w-10 animate-spin text-primary" />
          <div class="space-y-1">
            <p class="text-sm text-foreground">Completing the sign-in flow.</p>
            <p class="text-xs text-muted-foreground">
              If this window doesn’t close automatically, you can return to Entra Token Studio and continue there.
            </p>
          </div>
        </div>

        {#if showStuckHelp}
          <div class="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            Still waiting? You can safely close this tab/window and go back to Entra Token Studio.
          </div>
        {/if}

        <div class="flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" onclick={() => goto('/')}>Back to Entra Token Studio</Button>
          {#if isPopup}
            <Button variant="ghost" onclick={tryCloseWindow}>Close window</Button>
          {/if}
        </div>
      {:else if status === 'success'}
        <div class="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 class="h-12 w-12 text-emerald-500" />
          <div class="space-y-1">
            <p class="text-sm text-foreground">You’re signed in.</p>
            <p class="text-xs text-muted-foreground">
              {#if isPopup}
                You can close this window and return to Entra Token Studio.
              {:else}
                Returning you to Entra Token Studio…
              {/if}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2">
          <Button onclick={() => goto('/')}>Continue</Button>
          {#if isPopup}
            <Button variant="secondary" onclick={tryCloseWindow}>Close window</Button>
          {/if}
        </div>
      {:else}
        {@const friendly = rawError ? summarizeAuthError(rawError) : summarizeAuthError('Unknown error')}
        <div class="flex flex-col items-center gap-3 text-center">
          <XCircle class="h-12 w-12 text-destructive" />
          <div class="space-y-1">
            <p class="text-base font-semibold text-destructive">{friendly.title}</p>
            <p class="text-sm text-muted-foreground">{friendly.summary}</p>
          </div>
        </div>

        <div class="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <p class="text-sm font-medium text-foreground">What you can do</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {#each friendly.nextSteps as step}
              <li>{step}</li>
            {/each}
          </ul>
        </div>

        {#if friendly.technical}
          <Collapsible.Root class="rounded-lg border border-border/60 bg-muted/20 px-3 py-2" bind:open={detailsOpen}>
            <Collapsible.Trigger class="group flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground">
              <span>Details</span>
              <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Collapsible.Trigger>
            <Collapsible.Content class="space-y-3 pt-3">
              <div class="rounded-md border border-border/60 bg-background/60 p-3">
                <p class="mb-2 text-xs font-medium text-muted-foreground">Error message from Microsoft Entra ID</p>
                <pre class="whitespace-pre-wrap break-words text-xs text-muted-foreground">{friendly.technical}</pre>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onclick={() => copyToClipboard(friendly.technical ?? '')}
                  title="Copy details"
                >
                  <Copy class="mr-2 h-4 w-4" />
                  {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
                </Button>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        {/if}

        <div class="flex flex-wrap items-center justify-center gap-2">
          <Button onclick={() => goto('/')}>Back to Entra Token Studio</Button>
          {#if isPopup}
            <Button variant="secondary" onclick={tryCloseWindow}>Close window</Button>
          {/if}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
