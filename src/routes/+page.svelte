<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import type { HistoryItem, TokenData, FavoriteItem, HealthStatus, CredentialValidationStatus } from '$lib/types';
  import { parseJwt, getTokenStatus } from '$lib/utils';
  import { historyState } from '$lib/states/history.svelte';
  import { favoritesState } from '$lib/states/favorites.svelte';
  import { tokenDockState } from '$lib/states/token-dock.svelte';
  import { appRegistry, APP_COLORS } from '$lib/states/app-registry.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
  import FavoriteFormSheet from '$lib/components/FavoriteFormSheet.svelte';
  import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
  import AppFormDialog from '$lib/components/app-form-dialog.svelte';
  import DecodedClaims from '$lib/components/DecodedClaims.svelte';
  import TokenStatusBadge from '$lib/components/TokenStatusBadge.svelte';
  import { time } from '$lib/stores/time';
  import { toast } from "svelte-sonner";
  import SuggestionsInput from "$lib/components/SuggestionsInput.svelte";

  import { Button } from "$lib/shadcn/components/ui/button";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Label } from "$lib/shadcn/components/ui/label";
  import * as Card from "$lib/shadcn/components/ui/card";
  import * as Tabs from "$lib/shadcn/components/ui/tabs";
  import * as DropdownMenu from "$lib/shadcn/components/ui/dropdown-menu";
  import * as Collapsible from "$lib/shadcn/components/ui/collapsible";
  import { Badge } from "$lib/shadcn/components/ui/badge";
  import { Separator } from "$lib/shadcn/components/ui/separator";
  import { ScrollArea } from "$lib/shadcn/components/ui/scroll-area";
  import * as Tooltip from "$lib/shadcn/components/ui/tooltip";
  import { goto } from '$app/navigation';
  import { clientStorage, CLIENT_STORAGE_KEYS } from '$lib/services/client-storage';
  import { clearReissueParams, REISSUE_EVENT, type ReissueEventDetail, type ReissueContext } from '$lib/services/token-reissue';
  
  import { 
    User,
    History,
    Copy,
    Play,
    LogIn,
    Loader2,
    ShieldCheck,
    Clock3,
    ListChecks,
    AlertTriangle,
    Info,
    ShieldHalf,
    ArrowRight,
    Eye,
    EyeOff,
    Maximize2,
    Home,
    Star,
    StarOff,
    Pin,
    PinOff,
    RefreshCw,
    ChevronDown,
    Plus,
    Settings,
    Check,
    Cloud,
    BookOpen,
    Zap,
    ExternalLink,
    ShieldAlert,
    X,
  } from "@lucide/svelte";
  import { auth, authServiceStore } from '$lib/stores/auth';
  import { tauriUser, setTauriUser } from '$lib/states/tauri-user';
  import { isTauriMode } from '$lib/utils/runtime';
  import { identityPreference } from '$lib/states/identity.svelte';

  type FlowTab = 'app-token' | 'user-token';

  let activeTab = $state<FlowTab>('user-token');
  let resourceInput = $state('https://graph.microsoft.com');
  let scopesInput = $state('User.Read');
  // history state is now managed by historyState
  let result = $state<TokenData | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let copied = $state(false);
  let favoriteOpen = $state(false);
  let favoriteDraft: HistoryItem | null = $state(null);
  let favoritePinMode = $state(false);
  let resetConfirmOpen = $state(false);
  let appFormOpen = $state(false);

  let tokenVisible = $state(true);
  let hasAutoScrolled = $state(false);
  let highlightTarget: 'scopes' | 'resource' | null = $state(null);
  let highlightTimeout: number | null = null;
  let switchingAccount = $state(false);
  let scopeHelpOpen = $state(false);
  let appHelpOpen = $state(false);
  let lastErrorSource: 'user-token' | 'app-token' | 'external' | null = $state(null);

  // Derived state for active account (checks both msal-browser and Tauri sidecar auth)
  const activeAccount = $derived($auth.user || (isTauriMode() ? $tauriUser : null));


  const decodedClaims = $derived(result ? parseJwt(result.accessToken) : null);
  const resultKind = $derived(result ? (result.scopes?.length ? 'User Token' : 'App Token') : '');
  const issuedAtDate = $derived(decodedClaims?.iat ? new Date(Number((decodedClaims as any).iat) * 1000) : null);
  const audienceClaim = $derived((() => {
    if (!decodedClaims || !(decodedClaims as any).aud) return null;
    const aud = (decodedClaims as any).aud;
    return Array.isArray(aud) ? aud.join(', ') : String(aud);
  })());
  const resultScopes = $derived((() => {
    if (!result) return [];
    if (result.scopes?.length) return result.scopes;
    if (result.scope) return result.scope.split(' ').filter(Boolean);
    return [];
  })());



  const hasResult = $derived(Boolean(result));
  const lastRun = $derived(historyState.items[0] ?? null);
  const showResultScopes = $derived(resultKind !== 'App Token' && resultScopes.length > 0);
  const currentStatus = $derived(result?.expiresOn ? getTokenStatus(new Date(result.expiresOn), $time) : null);
  const scopeCount = $derived(resultScopes.length);
  const activeClientId = $derived(appRegistry.activeApp?.clientId ?? null);
  const portalAppPermissionsUrl = $derived(activeClientId
    ? `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${activeClientId}`
    : null);
  const portalExposeApiUrl = $derived(activeClientId
    ? `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/ExposeAnAPI/appId/${activeClientId}`
    : null);

  const isConsentLikeError = $derived(
    error && lastErrorSource === 'user-token' && (() => {
      const lower = error.toLowerCase();
      return (
        lower.includes('consent') ||
        lower.includes('admin approval') ||
        lower.includes('admin_consent') ||
        lower.includes('insufficient privileges') ||
        lower.includes('aadsts65001') ||
        lower.includes('needs admin approval')
      );
    })()
  );

  const isAppPermissionError = $derived(
    error && lastErrorSource === 'app-token' && (() => {
      const lower = error.toLowerCase();
      return (
        lower.includes('unauthorized') ||
        lower.includes('forbidden') ||
        lower.includes('insufficient privileges') ||
        lower.includes('aadsts700016') || // Application not found
        lower.includes('aadsts7000215') || // Invalid client secret
        lower.includes('aadsts700027') || // Client assertion contains an invalid signature
        lower.includes('aadsts70011') || // Invalid scope
        lower.includes('access denied') ||
        lower.includes('does not have permissions') ||
        lower.includes('role') ||
        lower.includes('permission')
      );
    })()
  );
  
  // App readiness now comes from the app registry
  const hasActiveApp = $derived(appRegistry.hasApps && !!appRegistry.activeApp);
  const configReady = $derived(hasActiveApp);

  // Dynamic routing: redirect to Setup when no apps are configured
  $effect(() => {
    if (typeof window === 'undefined') return;
    if (!appRegistry.ready) return; // Wait for registry to load from IndexedDB
    
    // If no apps configured, always redirect to setup - the user needs to configure
    // an app before they can use the playground, regardless of how they got here
    if (!appRegistry.hasApps) {
      goto('/apps', { replaceState: true });
    }
  });

  // When consent-related errors occur on the user-token tab, surface the scopes help panel
  $effect(() => {
    if (activeTab === 'user-token' && isConsentLikeError && lastErrorSource === 'user-token') {
      scopeHelpOpen = true;
      highlightTarget = 'scopes';
    }
  });

  // When permission-related errors occur on the app-token tab, surface the app help panel
  $effect(() => {
    if (activeTab === 'app-token' && isAppPermissionError && lastErrorSource === 'app-token') {
      appHelpOpen = true;
      highlightTarget = 'resource';
    }
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    if (!loading && (hasResult || error)) {
      if (hasAutoScrolled) return;
      const outputEl = document.getElementById('output');
      if (outputEl) {
        outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        (outputEl as HTMLElement).focus({ preventScroll: true });
        hasAutoScrolled = true;
      }
    } else {
      hasAutoScrolled = false;
    }
  });

  // Keep main result in sync with the shared dock token so both views stay consistent across navigation.
  $effect(() => {
    const dockToken = tokenDockState.token;
    if (dockToken?.tokenData) {
      result = dockToken.tokenData;
      if (dockToken.type === 'App Token') {
        activeTab = 'app-token';
        resourceInput = dockToken.target;
      } else {
        activeTab = 'user-token';
        scopesInput = dockToken.target;
      }
    } else if (!dockToken && !loading) {
      result = null;
    }
  });

  /**
   * Handle reissue events dispatched when already on the playground.
   * This enables idempotent reissue from any location.
   */
  async function handleReissueEvent(event: CustomEvent<ReissueEventDetail>) {
    const { context } = event.detail;
    
    // Switch tab and update input based on token type
    if (context.type === 'App Token') {
      activeTab = 'app-token';
      resourceInput = context.target;
      await tick();
      handleAppSubmit();
    } else {
      activeTab = 'user-token';
      scopesInput = context.target;
      await tick();
      handleUserSubmit();
    }
  }

  onMount(() => {
    // Listen for reissue events (when already on playground)
    window.addEventListener(REISSUE_EVENT, handleReissueEvent as unknown as EventListener);

    (async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const tab = tabParam === 'app-token' || tabParam === 'user-token' ? tabParam : null;
      const startGeneratingIntent = urlParams.get('cta') === 'start-generating';
      if (tab) {
        activeTab = tab;
        
        if (tab === 'app-token' && urlParams.has('resource')) {
          const r = urlParams.get('resource');
          if (r) resourceInput = r;
        } else if (tab === 'user-token' && urlParams.has('scopes')) {
          const s = urlParams.get('scopes');
          if (s) scopesInput = s;
        }
      } else {
        const savedTab = await clientStorage.get<FlowTab>(CLIENT_STORAGE_KEYS.activeTab);
        if (savedTab === 'app-token' || savedTab === 'user-token') activeTab = savedTab;
      }

      // historyState.load() is called in constructor, but we can call it again if needed, or rely on it being singleton
      await checkUrlForToken();

      const autorun = urlParams.get('autorun');
      if (autorun === 'true') {
        if (activeTab === 'app-token') {
          handleAppSubmit();
        } else {
          handleUserSubmit();
        }
      }

      const pendingLoad = await clientStorage.get<HistoryItem>(CLIENT_STORAGE_KEYS.pendingTokenLoad);
      if (pendingLoad) {
        try {
          await loadHistoryItem(pendingLoad);
          await clientStorage.remove(CLIENT_STORAGE_KEYS.pendingTokenLoad);
        } catch (e) {
          // Silently ignore
        }
      }

      if (startGeneratingIntent) {
        setTimeout(() => {
          scrollToFlows({ highlight: true, targetTab: tab ?? activeTab });
        }, 150);
      }

      // Clear URL params immediately after reading to prevent stale autorun on refresh
      clearReissueParams();
    })();
  });

  onDestroy(() => {
    // Clean up reissue event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener(REISSUE_EVENT, handleReissueEvent as unknown as EventListener);
    }
  });

  // Removed loadHistory function

  async function addToHistory(item: HistoryItem) {
    await historyState.add(item);
  }

  // Removed clearHistory function - use historyState.clear()

  async function checkUrlForToken() {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      try {
        const tokenBase64 = hash.split('token=')[1];
        const tokenJson = atob(tokenBase64);
        const tokenData = JSON.parse(tokenJson);
        const tokenTarget = (tokenData.scopes || []).join(' ');
        const timestamp = Date.now();
        
        activeTab = 'user-token';
        await clientStorage.set(CLIENT_STORAGE_KEYS.activeTab, 'user-token');
        
        result = tokenData;
        const historyItem: HistoryItem = {
          type: 'User Token',
          target: tokenTarget,
          timestamp,
          tokenData: JSON.parse(JSON.stringify(tokenData))
        };
        await addToHistory(historyItem);
        tokenDockState.setToken(historyItem);
        
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        error = 'Failed to parse token from URL';
        lastErrorSource = 'external';
        tokenDockState.setError('Failed to parse token from URL');
      }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
      error = `${urlParams.get('error')}: ${urlParams.get('error_description') || ''}`;
      lastErrorSource = 'external';
      tokenDockState.setError(error);
    }
  }

  async function handleAppSubmit() {
    if (!ensureSetupReady()) return;
    if (!appRegistry.activeApp) {
      toast.error('No active app configured');
      return;
    }
    
    loading = true;
    error = null;
    lastErrorSource = null;
    result = null;
    tokenDockState.setLoading({ type: 'App Token', target: resourceInput });

    try {
      const { acquireAppToken } = await import('$lib/services/tauri-api');
      const data = await acquireAppToken(
        {
          clientId: appRegistry.activeApp.clientId,
          tenantId: appRegistry.activeApp.tenantId,
          keyVault: appRegistry.activeApp.keyVault,
        },
        resourceInput,
      );

      // Check if cancelled during wait
      if (tokenDockState.status !== 'loading') return;

      result = data;
      const issuedAt = Date.now();
      const historyItem: HistoryItem = {
        type: 'App Token',
        target: resourceInput,
        timestamp: issuedAt,
        tokenData: JSON.parse(JSON.stringify(data)),
        // App context for multi-app support
        appId: appRegistry.activeApp?.id,
        appName: appRegistry.activeApp?.name,
        appColor: appRegistry.activeApp?.color,
      };
      if (appRegistry.activeApp) {
        void appRegistry.markUsed(appRegistry.activeApp.id);
      }
      await addToHistory(historyItem);
      tokenDockState.setToken(historyItem);
      // Sync favorite's token data if this target is already favorited
      await favoritesState.updateTokenData(historyItem.type, historyItem.target, historyItem.tokenData);
      toast.success("App token acquired successfully");
    } catch (err: any) {
      const message = err?.message ?? 'Failed to acquire token';
      error = message;
      lastErrorSource = 'app-token';
      tokenDockState.setError(message);
      toast.error(message);
      if (err?.setupRequired) {
        await goto('/apps?from=playground');
      }
    } finally {
      loading = false;
    }
  }

  async function handleUserSubmit(forceSwitch: boolean = false) {
    if (!ensureSetupReady()) return;
    if (!scopesInput) return;
    if (!appRegistry.activeApp) {
      toast.error('No active app configured');
      return;
    }
    await clientStorage.set(CLIENT_STORAGE_KEYS.activeTab, 'user-token');
    loading = true;
    error = null;
    lastErrorSource = null;
    result = null;
    tokenDockState.setLoading({ type: 'User Token', target: scopesInput });

    try {
      const scopeArray = scopesInput.split(/[ ,]+/).filter(Boolean);
      let tokenResponse: { accessToken: string; tokenType: string; expiresOn?: Date | string; scopes?: string[] };

      if (isTauriMode()) {
        // Tauri mode: Use sidecar with msal-node (opens system browser)
        const { acquireUserToken } = await import('$lib/services/tauri-api');
        const prompt =
          forceSwitch || identityPreference.shouldAskEveryTime
            ? 'select_account'
            : undefined;
        const response = await acquireUserToken(
          appRegistry.activeApp.clientId,
          appRegistry.activeApp.tenantId,
          scopeArray,
          prompt,
          $tauriUser?.homeAccountId,
        );
        tokenResponse = {
          accessToken: response.accessToken,
          tokenType: response.tokenType || 'Bearer',
          expiresOn: response.expiresOn,
          scopes: response.scopes,
        };

        // Check if cancelled during wait
        if (tokenDockState.status !== 'loading') return;

        // Update desktop session metadata for UI display (no tokens persisted)
        if (response.account) {
          setTauriUser(response.account, appRegistry.activeApp);
        }
      } else {
        // Web mode: Use msal-browser with popup
        const service = $authServiceStore;
        if (!service) throw new Error('Auth service not initialized');
        
        const options =
          forceSwitch || identityPreference.shouldAskEveryTime
            ? { forceInteraction: true, prompt: 'select_account' as const }
            : {};
        const msalResponse = await service.getToken(scopeArray, options);
        tokenResponse = {
          accessToken: msalResponse.accessToken,
          tokenType: msalResponse.tokenType,
          expiresOn: msalResponse.expiresOn,
          scopes: msalResponse.scopes,
        };
      }
      
      // Check if cancelled during wait
      if (tokenDockState.status !== 'loading') return;

      result = {
        accessToken: tokenResponse.accessToken,
        tokenType: tokenResponse.tokenType,
        expiresOn: tokenResponse.expiresOn instanceof Date 
          ? tokenResponse.expiresOn.toISOString() 
          : tokenResponse.expiresOn,
        scopes: tokenResponse.scopes,
      };
      
      const issuedAt = Date.now();
      const historyItem: HistoryItem = {
        type: 'User Token',
        target: scopesInput,
        timestamp: issuedAt,
        tokenData: JSON.parse(JSON.stringify(result!)),
        appId: appRegistry.activeApp?.id,
        appName: appRegistry.activeApp?.name,
        appColor: appRegistry.activeApp?.color,
      };

      if (appRegistry.activeApp) {
        void appRegistry.markUsed(appRegistry.activeApp.id);
      }
      await addToHistory(historyItem);
      tokenDockState.setToken(historyItem);
      await favoritesState.updateTokenData(historyItem.type, historyItem.target, historyItem.tokenData);
      toast.success("User token acquired successfully");
    } catch (err: any) {
      const message = err?.message ?? 'Failed to acquire token';
      if (message !== 'Sign-in was cancelled') {
        error = message;
        lastErrorSource = 'user-token';
        tokenDockState.setError(message);
        toast.error(message);
      } else {
        toast.warning("Sign-in was cancelled");
        tokenDockState.clearLoading();
      }
    } finally {
      loading = false;
      switchingAccount = false;
    }
  }

  async function handleSwitchAccount() {
    switchingAccount = true;
    await handleUserSubmit(true);
  }

  function requestResetAll() {
    resetConfirmOpen = true;
  }

  async function confirmResetAll() {
    resourceInput = 'https://graph.microsoft.com';
    scopesInput = 'User.Read';
    result = null;
    error = null;
    await clientStorage.remove(CLIENT_STORAGE_KEYS.lastResource);
    await clientStorage.remove(CLIENT_STORAGE_KEYS.lastScopes);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      toast.success("Copied to clipboard");
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  }

  async function switchTab(tab: FlowTab) {
    activeTab = tab;
    await clientStorage.set(CLIENT_STORAGE_KEYS.activeTab, tab);
  }

  async function restoreHistoryItem(item: HistoryItem) {
    if (item.type === 'App Token') {
      switchTab('app-token');
      resourceInput = item.target;
      await tick();
      handleAppSubmit();
    } else {
      switchTab('user-token');
      scopesInput = item.target;
      await tick();
      handleUserSubmit();
    }
  }

  async function loadHistoryItem(item: HistoryItem) {
    if (item.tokenData) {
      result = item.tokenData;
      tokenDockState.setToken(item);
      if (item.type === 'App Token') {
        activeTab = 'app-token';
        resourceInput = item.target;
      } else {
        activeTab = 'user-token';
        scopesInput = item.target;
      }
      // Scroll to output
      await tick();
      const outputEl = document.getElementById('output');
      if (outputEl) {
        outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  const favoriteTags = $derived(
    Array.from(new Set(favoritesState.items.flatMap((fav) => fav.tags ?? []))).filter(Boolean)
  );

  type FavoriteFormValue = Omit<FavoriteItem, 'id' | 'timestamp' | 'createdAt' | 'useCount'> & {
    useCount?: number;
    createdAt?: number;
    timestamp?: number;
    isPinned?: boolean;
    pinnedAt?: number | null;
  };

  function isFavorited(item: HistoryItem) {
    return favoritesState.isFavorited(item.type, item.target);
  }

  function isPinned(item: HistoryItem) {
    return favoritesState.isPinnedTarget(item.type, item.target);
  }

  function startFavoriteFromHistory(item: HistoryItem) {
    favoriteDraft = item;
    favoritePinMode = false;
    favoriteOpen = true;
  }

  async function saveFavoriteFromHistory(payload: FavoriteFormValue) {
    if (!favoriteDraft) return;
    try {
      const extras: Partial<FavoriteItem> = {
        ...payload,
        isPinned: favoritePinMode || payload.isPinned,
        pinnedAt: favoritePinMode ? Date.now() : payload.pinnedAt
      };
      await favoritesState.addFromHistory(favoriteDraft, extras);
      await favoritesState.load();
      toast.success(favoritePinMode ? 'Pinned and added to favorites' : 'Added to favorites');
    } catch (err) {
      toast.error('Could not add to favorites');
    } finally {
      favoriteDraft = null;
      favoriteOpen = false;
      favoritePinMode = false;
    }
  }

  async function removeFavoriteFromHistory(item: HistoryItem) {
    const match = favoritesState.items.find((fav) => fav.type === item.type && fav.target === item.target);
    if (!match) return;
    await favoritesState.delete(match);
    toast.success('Removed from favorites');
  }

  async function pinHistoryItem(item: HistoryItem) {
    const match = favoritesState.findMatch(item.type, item.target);
    if (match) {
      const result = await favoritesState.pin(match.id);
      if (!result.success && result.reason === 'limit') {
        toast.error('You can pin up to five favorites. Unpin one to add this.');
        return;
      }
      toast.success('Pinned to navigation');
      return;
    }

    if (favoritesState.pinnedCount >= 5) {
      toast.error('You can pin up to five favorites. Unpin one to add this.');
      return;
    }

    favoritePinMode = true;
    favoriteDraft = item;
    favoriteOpen = true;
  }

  async function unpinHistoryItem(item: HistoryItem) {
    const match = favoritesState.findMatch(item.type, item.target);
    if (!match) return;
    await favoritesState.unpin(match.id);
    toast.success('Unpinned');
  }

  const currentFavoriteSeed: HistoryItem | null = $derived((() => {
    const latest = historyState.items[0];
    if (!latest || !latest.tokenData) return null;
    return latest;
  })());

  const currentFavorited = $derived(currentFavoriteSeed ? isFavorited(currentFavoriteSeed) : false);
  const currentPinned = $derived(currentFavoriteSeed ? isPinned(currentFavoriteSeed) : false);

  function startFavoriteFromCurrent() {
    if (!currentFavoriteSeed) return;
    favoriteDraft = currentFavoriteSeed;
    favoritePinMode = false;
    favoriteOpen = true;
  }

  async function pinCurrentFavorite() {
    if (!currentFavoriteSeed) return;
    await pinHistoryItem(currentFavoriteSeed);
  }

  async function unpinCurrentFavorite() {
    if (!currentFavoriteSeed) return;
    await unpinHistoryItem(currentFavoriteSeed);
  }

  async function deleteHistoryItem(item: HistoryItem) {
    await historyState.delete(item);
  }

  function handleSaveFavorite(val: string) {
    favoriteDraft = {
        type: activeTab === 'user-token' ? 'User Token' : 'App Token',
        target: val,
        timestamp: Date.now(),
        appId: appRegistry.activeApp?.id,
        appName: appRegistry.activeApp?.name,
        appColor: appRegistry.activeApp?.color
    };
    favoriteOpen = true;
    favoritePinMode = false;
  }

  async function handleSelectApp(appId: string) {
    await appRegistry.setActive(appId);
  }

  function navigateToApps() {
    goto('/apps');
  }

  function openAppDialog() {
    appFormOpen = true;
  }

  function highlightRequiredInput(tab: FlowTab) {
    // Only use the guided highlight for the app-token resource field.
    // The user-token scopes field should only highlight in response to errors.
    if (tab !== 'app-token') return;

    const targetField = 'resource';
    highlightTarget = targetField;

    const inputEl = document.getElementById(targetField) as HTMLInputElement | null;
    if (inputEl) {
      inputEl.focus({ preventScroll: true });
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }

    highlightTimeout = window.setTimeout(() => {
      highlightTarget = null;
    }, 1800);
  }

  function ensureSetupReady() {
    if (configReady) return true;
    toast.warning('Add an app to start issuing tokens', {
      description: 'Click "Connect Client App" in the header to configure your first Entra app registration.',
    });
    return false;
  }

  async function scrollToFlows(options: { highlight?: boolean; targetTab?: FlowTab } = {}) {
    const { highlight = false, targetTab } = options;
    if (!configReady) {
      ensureSetupReady();
      return;
    }

    if (targetTab && targetTab !== activeTab) {
      switchTab(targetTab);
      await tick();
    }

    const flowsEl = document.getElementById('flows');
    if (flowsEl) {
      flowsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (highlight) {
      await tick();
      highlightRequiredInput(targetTab ?? activeTab);
    }
  }

  function refreshCurrent() {
    if (!ensureSetupReady()) return;
    if (activeTab === 'app-token') {
      handleAppSubmit();
    } else {
      handleUserSubmit();
    }
  }
</script>

<svelte:head>
  <title>Playground | Entra Token Studio</title>
</svelte:head>



<div class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Home class="h-5 w-5" />
      </div>
      <div>
        <p class="text-lg font-semibold leading-tight">Playground</p>
        <p class="text-sm text-muted-foreground">Generate and inspect tokens with live status updates.</p>
      </div>
    </div>
  </div>

  <div class="space-y-6">
    <div class="space-y-3">
      {#if appRegistry.hasApps && appRegistry.activeApp}
        <div class="space-y-1">
          <Label class="text-sm font-medium text-foreground">Active Client App</Label>
          <p class="text-xs text-muted-foreground">Select the client app to use for generating tokens to access other apps and resources.</p>
        </div>
        <!-- Interactive App Selector Dropdown -->
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button 
              type="button"
              class="inline-flex items-center gap-3 rounded-lg border bg-gradient-to-r from-primary/5 to-transparent px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div 
                class="w-2.5 h-2.5 rounded-full shrink-0"
                style="background-color: {appRegistry.activeApp.color || APP_COLORS[0]}"
              ></div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-foreground">{appRegistry.activeApp.name}</span>
                <span class="text-muted-foreground">·</span>
                <code class="font-mono text-[10px] text-muted-foreground">{appRegistry.activeApp.clientId.slice(0, 8)}...</code>
              </div>
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Cloud class="h-3 w-3" />
                <span class="text-[10px]">{appRegistry.activeApp.keyVault.uri.replace('https://', '').replace('.vault.azure.net', '')}</span>
              </div>
              <ChevronDown class="h-3.5 w-3.5 shrink-0 opacity-50" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" class="w-[220px]">
            <DropdownMenu.Group>
              <DropdownMenu.Label class="text-xs text-muted-foreground">Switch app</DropdownMenu.Label>
              {#each appRegistry.apps as app (app.id)}
                <DropdownMenu.Item 
                  class="flex items-center justify-between gap-2 cursor-pointer"
                  onclick={() => handleSelectApp(app.id)}
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <div 
                      class="w-2.5 h-2.5 rounded-full shrink-0" 
                      style="background-color: {app.color || APP_COLORS[0]}"
                    ></div>
                    <span class="truncate">{app.name}</span>
                  </div>
                  {#if app.id === appRegistry.activeAppId}
                    <Check class="h-4 w-4 shrink-0 text-primary" />
                  {/if}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Item class="cursor-pointer gap-2" onclick={openAppDialog}>
              <Plus class="h-4 w-4" />
              Connect client app...
            </DropdownMenu.Item>
            <DropdownMenu.Item class="cursor-pointer gap-2" onclick={navigateToApps}>
              <Settings class="h-4 w-4" />
              Manage apps
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      {:else if !appRegistry.hasApps}
        <!-- Compact Empty State -->
        <div class="w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3">
          <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Info class="h-4 w-4" />
          <span>Click <strong>"Connect Client App"</strong> in the header to configure your first Entra app registration.</span>
          </div>
        </div>
      {/if}
    </div>
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-foreground">Choose a flow</p>
      </div>
      <Tabs.Root id="flows" value={activeTab} onValueChange={(v) => switchTab(v as FlowTab)} class="w-full">
        <Tabs.List class="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1">
          <Tabs.Trigger value="user-token" class="gap-2 rounded-full">
            <User class="h-4 w-4" />
            User token (delegated)
          </Tabs.Trigger>
          <Tabs.Trigger value="app-token" class="gap-2 rounded-full">
            <ShieldHalf class="h-4 w-4" />
            App token (daemon)
          </Tabs.Trigger>
        </Tabs.List>

        <div class="mt-4 space-y-4">
          <Tabs.Content value="user-token">
            <Card.Root class="border bg-card/80 shadow-sm">
              <Card.Header class="space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <div class="space-y-1">
                    <Card.Title>User token</Card.Title>
                    <Card.Description>
                      Best when testing what a signed-in user can do in an app or Microsoft 365 (for example, reading their profile, mail, or calendar).
                    </Card.Description>
                  </div>
                  <Badge variant="secondary" class="gap-2 font-semibold text-foreground">
                    <LogIn class="h-4 w-4" />
                    Auth code flow
                  </Badge>
                </div>
              </Card.Header>
              <Card.Content class="space-y-4">
                <form onsubmit={(e) => { e.preventDefault(); handleUserSubmit(); }} class="space-y-4">
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <Label for="scopes">Scopes</Label>
                    <SuggestionsInput
                      id="scopes"
                      flow="user-token"
                      bind:value={scopesInput}
                      placeholder="User.Read Mail.Read (space separated)"
                      required
                      highlightClass={highlightTarget === 'scopes'
                        ? 'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background bg-gradient-to-r from-amber-200/70 via-orange-100/70 to-transparent shadow-[0_0_0_10px_rgba(251,191,36,0.35),0_14px_30px_-10px_rgba(249,115,22,0.45)] animate-[pulse_1.2s_ease-in-out_0s_4]'
                        : ''}
                      onSaveFavorite={handleSaveFavorite}
                    />
                      <p class="text-[10px] text-muted-foreground">
                        Tip: You can request multiple scopes by separating them with spaces or commas.
                      </p>
                      <Collapsible.Root bind:open={scopeHelpOpen} class="mt-2">
                        <Collapsible.Trigger
                          class={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                            isConsentLikeError
                              ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-800 dark:text-amber-200 hover:from-amber-500/20 hover:to-amber-500/10 shadow-sm shadow-amber-500/10'
                              : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          {#if isConsentLikeError}
                            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/25">
                              <AlertTriangle class="h-3.5 w-3.5 text-amber-400" />
                            </span>
                            <span>Troubleshoot consent error</span>
                            <Badge variant="outline" class="h-5 border-amber-500/40 bg-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                              Fix required
                            </Badge>
                          {:else}
                            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                              <BookOpen class="h-3.5 w-3.5 text-primary" />
                            </span>
                            <span>Scope & consent guide</span>
                          {/if}
                          <ChevronDown class="h-3.5 w-3.5 ml-auto transition-transform duration-200 data-[state=open]:rotate-180" />
                        </Collapsible.Trigger>
                        <Collapsible.Content>
                          <div class={`mt-3 rounded-xl border overflow-hidden ${
                            isConsentLikeError
                              ? 'border-amber-500/40 bg-gradient-to-b from-amber-100 dark:from-amber-950/40 to-background'
                              : 'border-border/60 bg-muted/20'
                          }`}>
                            <!-- Header -->
                            {#if isConsentLikeError}
                              <div class="px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
                                <div class="flex items-start gap-3">
                                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                                    <AlertTriangle class="h-4 w-4 text-amber-400" />
                                  </div>
                                  <div class="space-y-1">
                                    <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">Consent or permission error detected</p>
                                    <p class="text-xs text-amber-700/90 dark:text-amber-300/80">Your token request failed because the required permissions aren't configured. Follow the steps below to fix it.</p>
                                  </div>
                                </div>
                              </div>
                            {/if}
                            
                            <!-- Content -->
                            <div class="p-4 space-y-4">
                              <!-- Step 1: Understand the scope -->
                              <div class="space-y-2">
                                <div class="flex items-center gap-2">
                                  <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isConsentLikeError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>1</span>
                                  <p class={`text-xs font-semibold ${isConsentLikeError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Understand what you're requesting</p>
                                </div>
                                <div class={`ml-7 text-xs leading-relaxed ${isConsentLikeError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                                  <p>Each scope (like <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[11px]">User.Read</code> or <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[11px]">api://your-api/access</code>) represents a permission your app needs to access a resource.</p>
                                </div>
                              </div>

                              <!-- Step 2: Configure permissions -->
                              <div class="space-y-2">
                                <div class="flex items-center gap-2">
                                  <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isConsentLikeError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>2</span>
                                  <p class={`text-xs font-semibold ${isConsentLikeError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Configure the permission</p>
                                </div>
                                <div class={`ml-7 space-y-2 text-xs leading-relaxed ${isConsentLikeError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                                  <div class={`rounded-lg border p-3 space-y-1.5 ${isConsentLikeError ? 'border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/5' : 'border-border/40 bg-muted/30'}`}>
                                    <p class="font-medium flex items-center gap-1.5">
                                      <span class={`inline-block w-1.5 h-1.5 rounded-full ${isConsentLikeError ? 'bg-amber-400' : 'bg-primary'}`}></span>
                                      For Microsoft APIs (Graph, ARM, etc.)
                                    </p>
                                    <p class="ml-3">Add the scope as an <span class="font-medium">API permission</span> in your app registration's "API permissions" blade in the Azure portal.</p>
                                  </div>
                                  <div class={`rounded-lg border p-3 space-y-1.5 ${isConsentLikeError ? 'border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/5' : 'border-border/40 bg-muted/30'}`}>
                                    <p class="font-medium flex items-center gap-1.5">
                                      <span class={`inline-block w-1.5 h-1.5 rounded-full ${isConsentLikeError ? 'bg-amber-400' : 'bg-primary'}`}></span>
                                      For custom/internal APIs
                                    </p>
                                    <p class="ml-3">Ask the API owner to add your app under <span class="font-medium">Authorized client applications</span> in their "Expose an API" settings.</p>
                                  </div>
                                </div>
                              </div>

                              <!-- Step 3: Get admin consent if needed -->
                              <div class="space-y-2">
                                <div class="flex items-center gap-2">
                                  <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isConsentLikeError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>3</span>
                                  <p class={`text-xs font-semibold ${isConsentLikeError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Get admin consent (if required)</p>
                                </div>
                                <div class={`ml-7 text-xs leading-relaxed ${isConsentLikeError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                                  <p>Some organizations require an Entra ID admin to approve permissions. If you see an "admin approval required" error, contact your IT admin to grant consent for your app.</p>
                                </div>
                              </div>

                              <!-- Note: API-specific authorization -->
                              <div class={`rounded-lg border p-3 space-y-1.5 ${isConsentLikeError ? 'border-amber-500/20 bg-amber-100/60 dark:bg-amber-900/20' : 'border-muted-foreground/20 bg-muted/30'}`}>
                                <div class="flex items-start gap-2">
                                  <ShieldAlert class={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isConsentLikeError ? 'text-amber-600 dark:text-amber-400/70' : 'text-muted-foreground'}`} />
                                  <div class="space-y-1">
                                    <p class={`text-[11px] font-medium ${isConsentLikeError ? 'text-amber-800 dark:text-amber-200/90' : 'text-foreground/80'}`}>Good to know</p>
                                    <p class={`text-[11px] leading-relaxed ${isConsentLikeError ? 'text-amber-700/90 dark:text-amber-300/70' : 'text-muted-foreground'}`}>
                                      The above steps are <span class="font-medium">Entra ID prerequisites</span> for obtaining a token. However, some APIs perform additional internal authorization checks (e.g., whitelisting, role-based access). If you receive a <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[10px]">401</code> or <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[10px]">403</code> error when <span class="italic">calling</span> the API, contact the API owner or check API-specific documentation.
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <!-- Quick Actions -->
                              {#if activeClientId}
                                <div class={`rounded-lg border p-3 space-y-3 ${isConsentLikeError ? 'border-amber-500/30 bg-amber-100/60 dark:bg-amber-500/5' : 'border-primary/20 bg-primary/5'}`}>
                                  <div class="flex items-center gap-2">
                                    <Zap class={`h-3.5 w-3.5 ${isConsentLikeError ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
                                    <p class={`text-xs font-semibold ${isConsentLikeError ? 'text-amber-800 dark:text-amber-200' : 'text-foreground'}`}>Quick actions</p>
                                  </div>
                                  <div class="flex flex-wrap gap-2">
                                    {#if portalAppPermissionsUrl}
                                      <a
                                        href={portalAppPermissionsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        class={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                                          isConsentLikeError 
                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20' 
                                            : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                                        }`}
                                      >
                                        <ExternalLink class="h-3 w-3" />
                                        Open API permissions
                                      </a>
                                    {/if}
                                    {#if portalExposeApiUrl}
                                      <a
                                        href={portalExposeApiUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        class={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                                          isConsentLikeError 
                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20' 
                                            : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                                        }`}
                                      >
                                        <ExternalLink class="h-3 w-3" />
                                        Open Expose an API
                                      </a>
                                    {/if}
                                  </div>
                                  <p class={`text-[10px] ${isConsentLikeError ? 'text-amber-700/80 dark:text-amber-300/60' : 'text-muted-foreground'}`}>
                                    Client ID: <code class="font-mono">{activeClientId}</code>
                                  </p>
                                </div>
                              {/if}

                              <!-- Learn more -->
                              <div class={`flex items-center gap-1.5 pt-1 text-[11px] ${isConsentLikeError ? 'text-amber-700/90 dark:text-amber-300/70' : 'text-muted-foreground'}`}>
                                <BookOpen class="h-3 w-3" />
                                <span>Learn more:</span>
                                <a
                                  href="https://learn.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent"
                                  target="_blank"
                                  rel="noreferrer"
                                  class={`font-medium underline underline-offset-2 hover:no-underline ${isConsentLikeError ? 'text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100' : 'text-primary hover:text-primary/80'}`}
                                >
                                  Permissions and consent
                                </a>
                                <span>·</span>
                                <a
                                  href="https://learn.microsoft.com/azure/active-directory/develop/howto-add-app-roles-in-azure-ad-apps#configure-a-client-application-to-access-a-web-api"
                                  target="_blank"
                                  rel="noreferrer"
                                  class={`font-medium underline underline-offset-2 hover:no-underline ${isConsentLikeError ? 'text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100' : 'text-primary hover:text-primary/80'}`}
                                >
                                  Configure client apps
                                </a>
                              </div>
                            </div>
                          </div>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </div>
                    

                  </div>
                  <div class="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Consent is handled by Microsoft Identity. A popup may appear if permission is needed.
                  </div>
                  
                  <!-- Identity Indicator -->
                  <div class="flex items-center justify-between rounded-lg border px-3 py-2.5 {activeAccount ? 'bg-background border-border' : 'bg-amber-500/10 border-amber-500/20'}">
                    {#if activeAccount}
                      <div class="flex items-center gap-2 text-sm">
                        <User class="h-4 w-4 text-muted-foreground" />
                        <span class="text-muted-foreground">Issuing as</span>
                        <span class="font-medium text-foreground">{activeAccount.username || activeAccount.name}</span>
                      </div>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus:outline-none"
                        onclick={handleSwitchAccount}
                        disabled={loading || switchingAccount}
                      >
                        <RefreshCw class={`h-3 w-3 ${switchingAccount ? 'animate-spin' : ''}`} />
                        Switch account
                      </button>
                    {:else}
                      <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <Info class="h-4 w-4" />
                        <span class="font-medium">No active session—clicking <span class="font-bold">Issue token</span> will launch sign-in</span>
                      </div>
                    {/if}
                  </div>

                  <div class="flex gap-2">
                    <Button type="submit" class="flex-1 gap-2" disabled={loading}>
                      {#if loading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                        {switchingAccount ? 'Switching account...' : 'Acquiring token...'}
                      {:else}
                        <Play class="h-4 w-4" />
                        <span>Issue token</span>
                      {/if}
                    </Button>
                    {#if loading}
                      <Button
                        type="button"
                        variant="outline"
                        class="gap-2"
                        onclick={() => { tokenDockState.cancel(); loading = false; switchingAccount = false; }}
                      >
                        <X class="h-4 w-4" />
                        Cancel
                      </Button>
                    {/if}
                  </div>
                </form>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>

          <Tabs.Content value="app-token">
            <Card.Root class="border bg-card/80 shadow-sm">
              <Card.Header class="space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <Card.Title>App token</Card.Title>
                    <Card.Description>
                      Best for service accounts, background jobs, and APIs where user context isn't relevant—permissions are assigned to the app itself.
                    </Card.Description>
                  </div>
                  <Badge variant="secondary" class="gap-2 font-semibold text-foreground">
                    <ShieldHalf class="h-4 w-4" />
                    Client credentials
                  </Badge>
                </div>
              </Card.Header>
              <Card.Content class="space-y-4">
                <form onsubmit={(e) => { e.preventDefault(); handleAppSubmit(); }} class="space-y-4">
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <Label for="resource">Resource</Label>
                        <span class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">/.default will be applied</span>
                      </div>
                      <SuggestionsInput
                      id="resource"
                      flow="app-token"
                      bind:value={resourceInput}
                      placeholder="https://graph.microsoft.com"
                      required
                      highlightClass={highlightTarget === 'resource'
                        ? 'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background bg-gradient-to-r from-amber-200/70 via-orange-100/70 to-transparent shadow-[0_0_0_10px_rgba(251,191,36,0.35),0_14px_30px_-10px_rgba(249,115,22,0.45)] animate-[pulse_1.2s_ease-in-out_0s_4]'
                        : ''}
                      onSaveFavorite={handleSaveFavorite}
                    />
                    </div>
                  </div>


                  <!-- App Permissions Guide -->
                  <Collapsible.Root bind:open={appHelpOpen} class="mt-1">
                    <Collapsible.Trigger
                      class={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        isAppPermissionError
                          ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-800 dark:text-amber-200 hover:from-amber-500/20 hover:to-amber-500/10 shadow-sm shadow-amber-500/10'
                          : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      {#if isAppPermissionError}
                        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/25">
                          <AlertTriangle class="h-3.5 w-3.5 text-amber-400" />
                        </span>
                        <span>Troubleshoot permission error</span>
                        <Badge variant="outline" class="h-5 border-amber-500/40 bg-amber-500/20 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                          Fix required
                        </Badge>
                      {:else}
                        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                          <BookOpen class="h-3.5 w-3.5 text-primary" />
                        </span>
                        <span>Application permissions guide</span>
                      {/if}
                      <ChevronDown class="h-3.5 w-3.5 ml-auto transition-transform duration-200 data-[state=open]:rotate-180" />
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                      <div class={`mt-3 rounded-xl border overflow-hidden ${
                        isAppPermissionError
                          ? 'border-amber-500/40 bg-gradient-to-b from-amber-100 dark:from-amber-950/40 to-background'
                          : 'border-border/60 bg-muted/20'
                      }`}>
                        <!-- Header -->
                        {#if isAppPermissionError}
                          <div class="px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
                            <div class="flex items-start gap-3">
                              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                                <AlertTriangle class="h-4 w-4 text-amber-400" />
                              </div>
                              <div class="space-y-1">
                                <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">Permission or credential error detected</p>
                                <p class="text-xs text-amber-700/90 dark:text-amber-300/80">Your app token request failed. This is usually due to missing application permissions or credential issues. Follow the steps below to diagnose and fix.</p>
                              </div>
                            </div>
                          </div>
                        {/if}
                        
                        <!-- Content -->
                        <div class="p-4 space-y-4">
                          <!-- Step 1: Understand the flow -->
                          <div class="space-y-2">
                            <div class="flex items-center gap-2">
                              <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isAppPermissionError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>1</span>
                              <p class={`text-xs font-semibold ${isAppPermissionError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Understand client credentials flow</p>
                            </div>
                            <div class={`ml-7 text-xs leading-relaxed ${isAppPermissionError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                              <p>App tokens use the <span class="font-medium">client credentials</span> flow—user context and permissions aren't relevant. There's no interactive sign-in; the app authenticates using a secret or certificate and receives permissions assigned directly to the application.</p>
                            </div>
                          </div>

                          <!-- Step 2: Configure application permissions -->
                          <div class="space-y-2">
                            <div class="flex items-center gap-2">
                              <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isAppPermissionError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>2</span>
                              <p class={`text-xs font-semibold ${isAppPermissionError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Add application permissions (not delegated)</p>
                            </div>
                            <div class={`ml-7 space-y-2 text-xs leading-relaxed ${isAppPermissionError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                              <div class={`rounded-lg border p-3 space-y-1.5 ${isAppPermissionError ? 'border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/5' : 'border-border/40 bg-muted/30'}`}>
                                <p class="font-medium flex items-center gap-1.5">
                                  <span class={`inline-block w-1.5 h-1.5 rounded-full ${isAppPermissionError ? 'bg-amber-400' : 'bg-primary'}`}></span>
                                  For Microsoft APIs
                                </p>
                                <p class="ml-3">In your app registration, go to <span class="font-medium">API permissions</span> → <span class="font-medium">Add a permission</span> → select the API → choose <span class="font-medium">Application permissions</span> (not Delegated).</p>
                              </div>
                              <div class={`rounded-lg border p-3 space-y-1.5 ${isAppPermissionError ? 'border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/5' : 'border-border/40 bg-muted/30'}`}>
                                <p class="font-medium flex items-center gap-1.5">
                                  <span class={`inline-block w-1.5 h-1.5 rounded-full ${isAppPermissionError ? 'bg-amber-400' : 'bg-primary'}`}></span>
                                  For custom APIs
                                </p>
                                <p class="ml-3">You can request a token for any valid resource URI (e.g., <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[10px]">api://&lt;client-id&gt;</code>). If the API enforces <span class="font-medium">App roles</span>, you'll need to add those roles as Application permissions.</p>
                              </div>
                            </div>
                          </div>

                          <!-- Step 3: Grant admin consent -->
                          <div class="space-y-2">
                            <div class="flex items-center gap-2">
                              <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isAppPermissionError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>3</span>
                              <p class={`text-xs font-semibold ${isAppPermissionError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Grant admin consent (required)</p>
                            </div>
                            <div class={`ml-7 text-xs leading-relaxed ${isAppPermissionError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                              <p><span class="font-medium">Application permissions always require admin consent</span>—there's no user to consent on behalf of. An Entra ID admin must click "Grant admin consent" on the API permissions page for your app.</p>
                            </div>
                          </div>

                          <!-- Step 4: Verify credentials -->
                          <div class="space-y-2">
                            <div class="flex items-center gap-2">
                              <span class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isAppPermissionError ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary/15 text-primary'}`}>4</span>
                              <p class={`text-xs font-semibold ${isAppPermissionError ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'}`}>Verify your credentials</p>
                            </div>
                            <div class={`ml-7 text-xs leading-relaxed ${isAppPermissionError ? 'text-amber-800/90 dark:text-amber-200/80' : 'text-muted-foreground'}`}>
                              <p>Ensure your client secret or certificate is valid and not expired. Check that the credential in Key Vault matches what's configured in your Entra app registration.</p>
                            </div>
                          </div>

                          <!-- Note: API-specific authorization -->
                          <div class={`rounded-lg border p-3 space-y-1.5 ${isAppPermissionError ? 'border-amber-500/20 bg-amber-100/60 dark:bg-amber-900/20' : 'border-muted-foreground/20 bg-muted/30'}`}>
                            <div class="flex items-start gap-2">
                              <ShieldAlert class={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isAppPermissionError ? 'text-amber-600 dark:text-amber-400/70' : 'text-muted-foreground'}`} />
                              <div class="space-y-1">
                                <p class={`text-[11px] font-medium ${isAppPermissionError ? 'text-amber-800 dark:text-amber-200/90' : 'text-foreground/80'}`}>Good to know</p>
                                <p class={`text-[11px] leading-relaxed ${isAppPermissionError ? 'text-amber-700/90 dark:text-amber-300/70' : 'text-muted-foreground'}`}>
                                  The above steps configure <span class="font-medium">Entra ID authorization</span>. Some APIs also perform internal authorization checks (e.g., subscription validation, IP whitelisting, custom role checks). If you receive a <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[10px]">401</code> or <code class="px-1 py-0.5 rounded bg-muted/50 font-mono text-[10px]">403</code> when <span class="italic">calling</span> the API, contact the API owner or consult API-specific documentation.
                                </p>
                              </div>
                            </div>
                          </div>

                          <!-- Quick Actions -->
                          {#if activeClientId}
                            <div class={`rounded-lg border p-3 space-y-3 ${isAppPermissionError ? 'border-amber-500/30 bg-amber-100/60 dark:bg-amber-500/5' : 'border-primary/20 bg-primary/5'}`}>
                              <div class="flex items-center gap-2">
                                <Zap class={`h-3.5 w-3.5 ${isAppPermissionError ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
                                <p class={`text-xs font-semibold ${isAppPermissionError ? 'text-amber-800 dark:text-amber-200' : 'text-foreground'}`}>Quick actions</p>
                              </div>
                              <div class="flex flex-wrap gap-2">
                                {#if portalAppPermissionsUrl}
                                  <a
                                    href={portalAppPermissionsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    class={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                                      isAppPermissionError 
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20' 
                                        : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                                    }`}
                                  >
                                    <ExternalLink class="h-3 w-3" />
                                    Open API permissions
                                  </a>
                                {/if}
                                <a
                                  href={`https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/${activeClientId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  class={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                                    isAppPermissionError 
                                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20' 
                                      : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                                  }`}
                                >
                                  <ExternalLink class="h-3 w-3" />
                                  Check credentials
                                </a>
                              </div>
                              <p class={`text-[10px] ${isAppPermissionError ? 'text-amber-700/80 dark:text-amber-300/60' : 'text-muted-foreground'}`}>
                                Client ID: <code class="font-mono">{activeClientId}</code>
                              </p>
                            </div>
                          {/if}

                          <!-- Learn more -->
                          <div class={`flex items-center gap-1.5 pt-1 text-[11px] ${isAppPermissionError ? 'text-amber-700/90 dark:text-amber-300/70' : 'text-muted-foreground'}`}>
                            <BookOpen class="h-3 w-3" />
                            <span>Learn more:</span>
                            <a
                              href="https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow"
                              target="_blank"
                              rel="noreferrer"
                              class={`font-medium underline underline-offset-2 hover:no-underline ${isAppPermissionError ? 'text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100' : 'text-primary hover:text-primary/80'}`}
                            >
                              Client credentials flow
                            </a>
                            <span>·</span>
                            <a
                              href="https://learn.microsoft.com/azure/active-directory/develop/howto-add-app-roles-in-azure-ad-apps"
                              target="_blank"
                              rel="noreferrer"
                              class={`font-medium underline underline-offset-2 hover:no-underline ${isAppPermissionError ? 'text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100' : 'text-primary hover:text-primary/80'}`}
                            >
                              App roles
                            </a>
                          </div>
                        </div>
                      </div>
                    </Collapsible.Content>
                  </Collapsible.Root>

                  <div class="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Tokens are issued via your confidential client credentials and stay locally unless you copy them.
                  </div>
                  <div class="flex gap-2">
                    <Button type="submit" class="flex-1 gap-2" disabled={loading}>
                      {#if loading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                        Processing...
                      {:else}
                        <Play class="h-4 w-4" />
                        <span>Issue token</span>
                      {/if}
                    </Button>
                    {#if loading}
                      <Button
                        type="button"
                        variant="outline"
                        class="gap-2"
                        onclick={() => { tokenDockState.cancel(); loading = false; }}
                      >
                        <X class="h-4 w-4" />
                        Cancel
                      </Button>
                    {/if}
                  </div>
                </form>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>

    <div class="space-y-5">
      <div class="space-y-4" id="output" tabindex="-1">
        <Card.Root class={`border bg-card/90 ${hasResult ? 'border-primary/40 shadow-xl shadow-primary/10' : 'shadow-sm'}`}>
          <Card.Header class="space-y-4 pb-2">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1">
                <Card.Title class="text-xl">Token result</Card.Title>
                <Card.Description>Run a flow above, then review the decoded claims and raw token output.</Card.Description>
              </div>
              
              {#if hasResult}
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    class="h-8 gap-2"
                    onclick={() => copyToClipboard(result?.accessToken || '')}
                    disabled={!hasResult}
                    title="Copy access token"
                  >
                    <Copy class="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant={currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'default' : 'ghost'} 
                    class={`h-8 gap-2 ${currentStatus?.label === 'Expired' || currentStatus?.label === 'Expiring' ? 'shadow-[0_0_15px_-3px_oklch(var(--primary)/0.6)] hover:shadow-[0_0_20px_-3px_oklch(var(--primary)/0.7)] transition-all' : ''}`}
                    onclick={refreshCurrent} 
                    disabled={loading || !hasResult}
                    title="Reissue this token"
                  >
                    <Play class="h-3.5 w-3.5" />
                    Reissue
                  </Button>
                  <Button
                    size="sm"
                    variant={currentFavorited ? "secondary" : "ghost"}
                    class="h-8 gap-2"
                    onclick={() => (currentFavorited ? removeFavoriteFromHistory(currentFavoriteSeed!) : startFavoriteFromCurrent())}
                    disabled={!currentFavoriteSeed}
                    title={currentFavorited ? "Remove Favorite" : "Favorite"}
                  >
                    {#if currentFavorited}
                      <StarOff class="h-3.5 w-3.5" />
                      Remove Favorite
                    {:else}
                      <Star class="h-3.5 w-3.5" />
                      Favorite
                    {/if}
                  </Button>
                  <Button
                    size="sm"
                    variant={currentPinned ? "secondary" : "ghost"}
                    class="h-8 gap-2"
                    onclick={() => (currentPinned ? unpinCurrentFavorite() : pinCurrentFavorite())}
                    disabled={!currentFavoriteSeed}
                    title={currentPinned ? "Unpin from navigation" : "Pin for instant access"}
                  >
                    {#if currentPinned}
                      <PinOff class="h-3.5 w-3.5" />
                      Unpin
                    {:else}
                      <Pin class="h-3.5 w-3.5" />
                      Pin
                    {/if}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-8 gap-2"
                    onclick={() => (tokenVisible = !tokenVisible)}
                    disabled={!hasResult}
                    title={tokenVisible ? 'Hide token' : 'Show token'}
                  >
                    {#if tokenVisible}
                      <EyeOff class="h-3.5 w-3.5" />
                      Hide
                    {:else}
                      <Eye class="h-3.5 w-3.5" />
                      Show
                    {/if}
                  </Button>
                  <Separator orientation="vertical" class="h-4" />
                  <Button size="icon-sm" variant="outline" class="h-8 w-8" onclick={() => tokenDockState.openFullScreen()} title="Open in full screen view">
                    <Maximize2 class="h-3.5 w-3.5" />
                    <span class="sr-only">Full Screen</span>
                  </Button>
                </div>
              {/if}
            </div>


          </Card.Header>

          <Card.Content class="space-y-5 pt-2">
            {#if error}
              <div class="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2 font-semibold">
                    <AlertTriangle class="h-4 w-4" />
                    Token request failed
                  </div>
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="ghost" class="h-9 px-3 hover:bg-destructive/20" onclick={() => copyToClipboard(error || '')} title="Copy error message">
                      <Copy class="h-4 w-4" />
                      Copy error
                    </Button>
                    <Button size="sm" variant="secondary" onclick={requestResetAll} title="Clear inputs and try again">Clear inputs</Button>
                  </div>
                </div>
                <p class="text-sm leading-relaxed break-all">{error}</p>
                <div class="grid gap-2 text-xs text-destructive/80">
                  <div class="flex items-center gap-2">
                    <Info class="h-3.5 w-3.5" />
                    Verify redirect URI matches your Entra app exactly (scheme/host/port/path).
                  </div>
                  <div class="flex items-center gap-2">
                    <Info class="h-3.5 w-3.5" />
                    Confirm scopes/resources are consented for this tenant and flow type.
                  </div>

                </div>
              </div>
            {:else if tokenDockState.status === 'loading'}
              <div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-primary/30 bg-primary/5 py-16 text-center">
                <div class="mb-2 rounded-full bg-primary/10 p-4">
                  <Loader2 class="h-8 w-8 text-primary animate-spin" />
                </div>
                <div class="space-y-2">
                  <h3 class="text-lg font-semibold text-foreground">Acquiring token...</h3>
                  {#if tokenDockState.context?.type || tokenDockState.context?.target}
                    <p class="text-sm text-muted-foreground max-w-sm">
                      {#if tokenDockState.context?.type}
                        <span class="font-medium">{tokenDockState.context.type}</span>
                      {/if}
                      {#if tokenDockState.context?.target}
                        <span class="block mt-1 font-mono text-xs text-muted-foreground/80 truncate max-w-[280px]">
                          {tokenDockState.context.target}
                        </span>
                      {/if}
                    </p>
                  {:else}
                    <p class="text-sm text-muted-foreground">
                      Please wait while we acquire your token...
                    </p>
                  {/if}
                </div>
                <Button
                  variant="outline"
                  class="gap-2 mt-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                  onclick={() => { tokenDockState.cancel(); loading = false; }}
                >
                  <X class="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            {:else if hasResult && result}
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Type</p>
                  <div class="text-sm font-semibold text-foreground">{resultKind || 'Token'}</div>
                  <p class="text-xs text-muted-foreground">{result.tokenType || 'Bearer'}</p>
                </div>
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Client App</p>
                  {#if tokenDockState.token?.appName}
                    <div class="mt-1 flex items-center gap-2">
                      <div 
                        class="w-2.5 h-2.5 rounded-full shrink-0" 
                        style="background-color: {tokenDockState.token.appColor || '#10b981'}"
                      ></div>
                      <span class="text-sm font-semibold text-foreground truncate">{tokenDockState.token.appName}</span>
                    </div>
                    {#if tokenDockState.token.appId}
                      <p class="mt-1 font-mono text-[11px] text-muted-foreground truncate">{tokenDockState.token.appId}</p>
                    {/if}
                  {:else}
                    <div class="text-sm font-semibold text-foreground">Legacy token</div>
                    <p class="text-xs text-muted-foreground">No app context available</p>
                  {/if}
                </div>
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Issued</p>
                  <div class="text-sm font-semibold text-foreground">
                    {#if issuedAtDate}
                      {issuedAtDate.toLocaleString()}
                    {:else}
                      Unknown
                    {/if}
                  </div>
                </div>
                <div class="rounded-lg border bg-muted/25 p-4">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Expiry</p>
                  <div class="text-sm font-semibold text-foreground">
                    {#if result?.expiresOn}
                      {new Date(result.expiresOn).toLocaleString()}
                    {:else}
                      Unknown
                    {/if}
                  </div>
                  <div class="mt-1">
                    {#if result?.expiresOn}
                      <TokenStatusBadge expiresOn={result.expiresOn} />
                    {:else}
                      <p class="text-xs text-muted-foreground">Lifetime not provided</p>
                    {/if}
                  </div>
                </div>
              {#if showResultScopes}
                <div class="rounded-lg border bg-muted/25 p-4 md:col-span-2 xl:col-span-2">
                  <div class="flex items-center justify-between">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Scopes</p>
                    <Badge variant="outline" class="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">{scopeCount}</Badge>
                  </div>
                  <ScrollArea class="mt-2 h-[110px] rounded-md border bg-background/50 px-2 py-2">
                    <div class="flex flex-wrap gap-1.5">
                      {#each resultScopes as scope}
                        <Badge variant="secondary" class="font-mono text-[11px] leading-4 break-all hover:bg-secondary/80 transition-colors" title={scope}>{scope}</Badge>
                      {/each}
                    </div>
                  </ScrollArea>
                </div>
              {/if}

              {#if audienceClaim}
                <div class="rounded-lg border bg-muted/25 p-4 md:col-span-2 xl:col-span-2">
                  <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Audience</p>
                  <div class="mt-2 flex items-start gap-2">
                    <div class="rounded-md border bg-background/50 px-3 py-2 font-mono text-xs text-foreground/90 break-all w-full">
                      {audienceClaim}
                    </div>
                    <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" onclick={() => copyToClipboard(audienceClaim)} title="Copy audience">
                      <Copy class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              {/if}
            </div>

              <div class="grid gap-4 lg:grid-cols-[1.15fr_0.9fr]">
                <div
                  class="space-y-2 rounded-xl border bg-muted/15 p-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">Access token</p>
                      <p class="text-xs text-muted-foreground">Raw token is kept client-side for inspection and copy.</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button variant="ghost" size="sm" class="gap-2" onclick={() => tokenVisible = !tokenVisible} title={tokenVisible ? 'Hide token' : 'Show token'}>
                        {#if tokenVisible}
                          <EyeOff class="h-4 w-4" />
                          Hide
                        {:else}
                          <Eye class="h-4 w-4" />
                          Show
                        {/if}
                      </Button>
                      <Button variant="secondary" size="sm" class="gap-2" onclick={() => copyToClipboard(result?.accessToken || '')} title="Copy access token">
                        <Copy class="h-4 w-4" />
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                  <ScrollArea class="h-[260px] rounded-lg border bg-muted/40 p-4">
                    {#if tokenVisible}
                      <pre class="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-foreground/90">{result.accessToken}</pre>
                    {:else}
                      <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Token hidden. Click “Show” to reveal.
                      </div>
                    {/if}
                  </ScrollArea>
                </div>

                {#if decodedClaims}
                  <div class="rounded-xl border bg-muted/10 p-4">
                    <DecodedClaims claims={decodedClaims} />
                  </div>
                {/if}
              </div>


            {:else}
              <div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/10 py-16 text-center">
                <div class="mb-4 rounded-full bg-primary/10 p-3">
                  <ShieldCheck class="h-6 w-6 text-primary" />
                </div>
                <h3 class="text-lg font-semibold text-foreground">Run a token flow</h3>
                <p class="mt-2 max-w-sm text-sm text-muted-foreground">
                  Use the App token or User token forms above, then return here to see the raw token and decoded claims.
                </p>
                <Button variant="default" class="gap-2" onclick={() => scrollToFlows({ highlight: true })}>
                  <Play class="h-4 w-4" />
                  Start generating
                </Button>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <Card.Root class="border bg-card/70">
        <Card.Header class="pb-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <History class="h-5 w-5 text-muted-foreground" />
              <Card.Title>Recent activity</Card.Title>
            </div>
            <Button variant="ghost" size="sm" href="/history" class="gap-2">
              View all
              <ArrowRight class="h-4 w-4" />
            </Button>
          </div>
        </Card.Header>
        <Card.Content class="p-0">
          <div class="px-3 md:px-4">
            <HistoryList 
              items={historyState.items} 
              limit={5} 
              onRestore={restoreHistoryItem} 
              onLoad={loadHistoryItem}
              onFavorite={startFavoriteFromHistory}
              onUnfavorite={removeFavoriteFromHistory}
              onPin={pinHistoryItem}
              onUnpin={unpinHistoryItem}
              isFavorited={isFavorited}
              isPinned={isPinned}
              enableToolbar={false}
              enableSorting={false}
              compact={true}
              showFooter={false}
              emptyCtaHref="/"
              emptyCtaLabel="Start generating"
              emptyCtaOnClick={() => scrollToFlows({ highlight: true })}
            />
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<FavoriteFormSheet
  bind:open={favoriteOpen}
  mode="create"
  title="Save to favorites"
  favorite={favoriteDraft
    ? {
        id: 'draft',
        type: favoriteDraft.type,
        target: favoriteDraft.target,
        timestamp: favoriteDraft.timestamp,
        tokenData: favoriteDraft.tokenData,
        createdAt: favoriteDraft.timestamp,
        useCount: 1
      }
    : undefined}
  existingTags={favoriteTags}
  onSave={saveFavoriteFromHistory}
  onClose={() => {
    favoriteOpen = false;
    favoriteDraft = null;
    favoritePinMode = false;
  }}
/>

<ConfirmDialog
  bind:open={resetConfirmOpen}
  title="Clear forms and result?"
  description="This will reset all inputs to defaults and clear the current token result."
  confirmText="Clear"
  onConfirm={confirmResetAll}
  destructive={true}
/>

<AppFormDialog bind:open={appFormOpen} />
