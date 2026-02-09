<script lang="ts">
  import { AlertTriangle, AlertCircle, ExternalLink, Copy, ChevronDown, Key, Shield, Wifi, Clock, HelpCircle } from '@lucide/svelte';
  import { Button } from '$lib/shadcn/components/ui/button';
  import { Badge } from '$lib/shadcn/components/ui/badge';
  import * as Collapsible from '$lib/shadcn/components/ui/collapsible';
  import { openExternalUrl } from '$lib/utils/runtime';

  interface KeyVaultErrorData {
    code: string;
    message: string;
    action: string;
    actionUrl?: string;
    actionLabel?: string;
    detail?: string;
    severity: 'error' | 'warning';
    context?: {
      vaultUri?: string;
      resourceName?: string;
      expiryDate?: string;
      daysUntilExpiry?: number;
    };
  }

  interface Props {
    error: KeyVaultErrorData | string;
    onCopy?: () => void;
    onClear?: () => void;
  }

  let { error, onCopy, onClear }: Props = $props();

  // Parse error - could be JSON string or already parsed
  let parsedError = $derived.by(() => {
    if (typeof error === 'string') {
      // Try to parse as JSON (structured error)
      try {
        const parsed = JSON.parse(error);
        if (parsed.code && parsed.message && parsed.action) {
          return parsed as KeyVaultErrorData;
        }
      } catch {
        // Not JSON, treat as plain error message
      }
      // Check if it's a known Key Vault error pattern
      return detectKeyVaultError(error);
    }
    return error;
  });

  // Detect Key Vault errors from plain error messages
  function detectKeyVaultError(message: string): KeyVaultErrorData | null {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('access denied') || lowerMessage.includes('forbidden') || lowerMessage.includes('403')) {
      return {
        code: 'ACCESS_DENIED',
        message: message,
        action: "Verify you have the required Key Vault roles assigned. If using PIM, ensure your elevated access is active.",
        severity: 'error',
      };
    }
    
    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return {
        code: 'NOT_FOUND',
        message: message,
        action: "Verify the certificate or secret name is correct and exists in the Key Vault.",
        severity: 'error',
      };
    }
    
    if (lowerMessage.includes('expired')) {
      return {
        code: 'EXPIRED',
        message: message,
        action: "Rotate the expired certificate or secret in Key Vault and update your Entra app registration.",
        severity: 'error',
      };
    }
    
    if (lowerMessage.includes('az login') || lowerMessage.includes('credential')) {
      return {
        code: 'CREDENTIAL_UNAVAILABLE',
        message: message,
        action: 'Run "az login" in your terminal to authenticate with Azure CLI.',
        actionUrl: 'https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli',
        actionLabel: 'Learn about Azure CLI login',
        severity: 'error',
      };
    }
    
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('enotfound')) {
      return {
        code: 'NETWORK_ERROR',
        message: message,
        action: "Check your network connection. If the Key Vault uses Private Endpoints, ensure your network can reach it.",
        severity: 'error',
      };
    }
    
    return null;
  }

  // Get icon based on error code
  function getErrorIcon(code: string) {
    switch (code) {
      case 'ACCESS_DENIED':
        return Shield;
      case 'CERT_EXPIRED':
      case 'SECRET_EXPIRED':
      case 'CERT_EXPIRING_SOON':
      case 'SECRET_EXPIRING_SOON':
      case 'EXPIRED':
        return Clock;
      case 'CERT_NOT_FOUND':
      case 'SECRET_NOT_FOUND':
      case 'NOT_FOUND':
        return Key;
      case 'CREDENTIAL_UNAVAILABLE':
        return AlertCircle;
      case 'NETWORK_ERROR':
        return Wifi;
      default:
        return HelpCircle;
    }
  }

  // Get human-readable error title
  function getErrorTitle(code: string): string {
    switch (code) {
      case 'ACCESS_DENIED':
        return 'Access Denied';
      case 'CERT_EXPIRED':
        return 'Certificate Expired';
      case 'SECRET_EXPIRED':
        return 'Secret Expired';
      case 'CERT_EXPIRING_SOON':
        return 'Certificate Expiring Soon';
      case 'SECRET_EXPIRING_SOON':
        return 'Secret Expiring Soon';
      case 'CERT_NOT_FOUND':
        return 'Certificate Not Found';
      case 'SECRET_NOT_FOUND':
        return 'Secret Not Found';
      case 'CREDENTIAL_UNAVAILABLE':
        return 'Azure Credentials Unavailable';
      case 'NETWORK_ERROR':
        return 'Network Error';
      case 'SIGNING_FAILED':
        return 'Signing Failed';
      default:
        return 'Key Vault Error';
    }
  }

  let detailsOpen = $state(false);
  let copied = $state(false);

  async function copyError() {
    const textToCopy = parsedError 
      ? `${parsedError.message}\n\nAction: ${parsedError.action}${parsedError.detail ? `\n\nDetails: ${parsedError.detail}` : ''}`
      : String(error);
    
    await navigator.clipboard.writeText(textToCopy);
    copied = true;
    onCopy?.();
    setTimeout(() => copied = false, 2000);
  }

  function openActionUrl() {
    if (parsedError?.actionUrl) {
      openExternalUrl(parsedError.actionUrl);
    }
  }
</script>

{#if parsedError}
  {@const ErrorIcon = getErrorIcon(parsedError.code)}
  {@const isWarning = parsedError.severity === 'warning'}
  
  <div class="space-y-3 rounded-xl border p-5 {isWarning 
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
    : 'border-destructive/40 bg-destructive/10 text-destructive'}">
    
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {isWarning 
          ? 'bg-amber-500/20' 
          : 'bg-destructive/20'}">
          <ErrorIcon class="h-5 w-5 {isWarning ? 'text-amber-600 dark:text-amber-400' : ''}" />
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-semibold">{getErrorTitle(parsedError.code)}</h3>
            <Badge variant="outline" class="text-[10px] {isWarning 
              ? 'border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300'
              : 'border-destructive/40 bg-destructive/20 text-destructive'}">
              {parsedError.code}
            </Badge>
          </div>
          <p class="text-sm leading-relaxed opacity-90">{parsedError.message}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2 shrink-0">
        <Button 
          size="sm" 
          variant="ghost" 
          class="h-8 px-2.5 {isWarning 
            ? 'hover:bg-amber-500/20 text-amber-800 dark:text-amber-200' 
            : 'hover:bg-destructive/20'}" 
          onclick={copyError}
          title="Copy error details"
        >
          <Copy class="h-3.5 w-3.5 mr-1.5" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {#if onClear}
          <Button 
            size="sm" 
            variant="secondary" 
            class="h-8"
            onclick={onClear}
          >
            Clear
          </Button>
        {/if}
      </div>
    </div>
    
    <!-- Action Required Section -->
    <div class="rounded-lg border p-4 space-y-3 {isWarning 
      ? 'border-amber-500/30 bg-amber-500/10' 
      : 'border-destructive/30 bg-destructive/5'}">
      <div class="flex items-start gap-2">
        <AlertTriangle class="h-4 w-4 mt-0.5 shrink-0 {isWarning ? 'text-amber-600 dark:text-amber-400' : ''}" />
        <div class="space-y-1">
          <p class="text-xs font-semibold {isWarning ? 'text-amber-800 dark:text-amber-200' : ''}">
            What you should do
          </p>
          <p class="text-sm leading-relaxed {isWarning 
            ? 'text-amber-800/90 dark:text-amber-200/80' 
            : 'opacity-90'}">
            {parsedError.action}
          </p>
        </div>
      </div>
      
      <!-- Action Button -->
      {#if parsedError.actionUrl}
        <Button
          size="sm"
          variant={isWarning ? 'outline' : 'secondary'}
          class="gap-2 {isWarning 
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20' 
            : ''}"
          onclick={openActionUrl}
        >
          <ExternalLink class="h-3.5 w-3.5" />
          {parsedError.actionLabel || 'Open in Azure Portal'}
        </Button>
      {/if}
    </div>
    
    <!-- Context Info (if available) -->
    {#if parsedError.context?.vaultUri || parsedError.context?.resourceName || parsedError.context?.expiryDate}
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs {isWarning 
        ? 'text-amber-700/80 dark:text-amber-300/70' 
        : 'opacity-70'}">
        {#if parsedError.context.resourceName}
          <span>
            <span class="font-medium">Resource:</span> 
            <code class="ml-1 font-mono">{parsedError.context.resourceName}</code>
          </span>
        {/if}
        {#if parsedError.context.expiryDate}
          <span>
            <span class="font-medium">Expiry:</span> 
            <span class="ml-1">{new Date(parsedError.context.expiryDate).toLocaleDateString()}</span>
          </span>
        {/if}
        {#if parsedError.context.daysUntilExpiry !== undefined}
          <span>
            <span class="font-medium">Days remaining:</span> 
            <span class="ml-1 font-semibold">{parsedError.context.daysUntilExpiry}</span>
          </span>
        {/if}
      </div>
    {/if}
    
    <!-- Technical Details (Collapsible) -->
    {#if parsedError.detail}
      <Collapsible.Root bind:open={detailsOpen}>
        <Collapsible.Trigger class="inline-flex items-center gap-1.5 text-xs font-medium {isWarning 
          ? 'text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200' 
          : 'opacity-70 hover:opacity-100'} transition-opacity">
          <ChevronDown class="h-3.5 w-3.5 transition-transform duration-200 {detailsOpen ? 'rotate-180' : ''}" />
          Technical details
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div class="mt-2 rounded-lg border p-3 font-mono text-xs leading-relaxed {isWarning 
            ? 'border-amber-500/20 bg-amber-100/50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200' 
            : 'border-destructive/20 bg-destructive/5'} whitespace-pre-wrap break-all">
            {parsedError.detail}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    {/if}
  </div>
{:else}
  <!-- Fallback for non-KeyVault errors -->
  <div class="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 font-semibold">
        <AlertTriangle class="h-4 w-4" />
        Token request failed
      </div>
      <div class="flex items-center gap-2">
        <Button 
          size="sm" 
          variant="ghost" 
          class="h-8 px-2.5 hover:bg-destructive/20" 
          onclick={copyError}
          title="Copy error message"
        >
          <Copy class="h-3.5 w-3.5 mr-1.5" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {#if onClear}
          <Button size="sm" variant="secondary" onclick={onClear}>Clear</Button>
        {/if}
      </div>
    </div>
    <p class="text-sm leading-relaxed break-all">{error}</p>
  </div>
{/if}
