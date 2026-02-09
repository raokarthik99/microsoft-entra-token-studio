<script lang="ts">
  import { AlertTriangle, Download, RefreshCw, Terminal, ExternalLink } from '@lucide/svelte';
  import { Button } from '$lib/shadcn/components/ui/button';
  import * as Collapsible from '$lib/shadcn/components/ui/collapsible';
  import logo from '$lib/assets/token-studio-icon.png';
  import { openExternalUrl } from '$lib/utils/runtime';

  interface Props {
    error: string;
    onRetry: () => void;
    retrying?: boolean;
  }

  let { error, onRetry, retrying = false }: Props = $props();
  let detailsOpen = $state(false);

  // Detect platform from error message or user agent
  const platform = $derived.by(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    return 'unknown';
  });

  // Platform-specific installation instructions
  const installInstructions = $derived.by(() => {
    switch (platform) {
      case 'macos':
        return {
          primary: 'brew install node',
          secondary: 'Or download the installer from nodejs.org',
          packageManager: 'Homebrew',
        };
      case 'windows':
        return {
          primary: 'winget install OpenJS.NodeJS.LTS',
          secondary: 'Or use: choco install nodejs-lts, scoop install nodejs-lts',
          packageManager: 'Winget/Chocolatey/Scoop',
        };
      case 'linux':
        return {
          primary: 'sudo apt install nodejs  # Debian/Ubuntu',
          secondary: 'Or: sudo dnf install nodejs (Fedora), sudo pacman -S nodejs (Arch), snap install node --classic',
          packageManager: 'apt/dnf/pacman/snap',
        };
      default:
        return {
          primary: 'Download from nodejs.org',
          secondary: 'Install Node.js version 20 or higher',
          packageManager: 'Package Manager',
        };
    }
  });

  function openNodeJsDownload() {
    openExternalUrl('https://nodejs.org');
  }
</script>

<div class="flex min-h-screen w-full items-center justify-center bg-background p-6">
  <div class="w-full max-w-lg space-y-6">
    <!-- Header -->
    <div class="flex flex-col items-center text-center space-y-4">
      <div class="relative">
        <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 ring-4 ring-destructive/20">
          <img src={logo} alt="Entra Token Studio" class="h-12 w-12 opacity-50" />
        </div>
        <div class="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
          <AlertTriangle class="h-4 w-4" />
        </div>
      </div>
      
      <div class="space-y-2">
        <h1 class="text-2xl font-bold text-foreground">Node.js Required</h1>
        <p class="text-muted-foreground max-w-md">
          Entra Token Studio requires <span class="font-semibold text-foreground">Node.js 20</span> or higher to run. 
          Please install Node.js and try again.
        </p>
      </div>
    </div>

    <!-- Installation Card -->
    <div class="rounded-xl border bg-card p-6 space-y-5">
      <div class="space-y-4">
        <!-- Primary Command -->
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Terminal class="h-4 w-4" />
            <span>Install via {installInstructions.packageManager}</span>
          </div>
          <div class="flex items-center gap-2">
            <code class="flex-1 rounded-lg bg-muted px-4 py-3 font-mono text-sm text-foreground select-all">
              {installInstructions.primary}
            </code>
          </div>
          <p class="text-xs text-muted-foreground">
            {installInstructions.secondary}
          </p>
        </div>

        <!-- Download Button -->
        <div class="flex flex-col gap-3 pt-2">
          <Button 
            variant="default" 
            class="w-full gap-2" 
            onclick={openNodeJsDownload}
          >
            <Download class="h-4 w-4" />
            Download from nodejs.org
            <ExternalLink class="h-3 w-3 opacity-50" />
          </Button>
          
          <Button 
            variant="outline" 
            class="w-full gap-2" 
            onclick={onRetry}
            disabled={retrying}
          >
            {#if retrying}
              <RefreshCw class="h-4 w-4 animate-spin" />
              Checking...
            {:else}
              <RefreshCw class="h-4 w-4" />
              Retry
            {/if}
          </Button>
        </div>
      </div>
    </div>

    <!-- Technical Details -->
    <Collapsible.Root bind:open={detailsOpen}>
      <Collapsible.Trigger class="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
        <span>{detailsOpen ? 'Hide' : 'Show'} technical details</span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div class="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p class="text-xs font-medium text-destructive mb-2">Error Details</p>
          <code class="block text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all leading-relaxed">
            {error}
          </code>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>

    <!-- Help Text -->
    <p class="text-center text-xs text-muted-foreground">
      After installing Node.js, you may need to restart your terminal or computer for the changes to take effect.
    </p>
  </div>
</div>
