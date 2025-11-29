import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  // Elements
  const tabs = document.querySelectorAll<HTMLElement>('.tab-btn');
  const panels = document.querySelectorAll<HTMLElement>('.form-panel');
  const appForm = document.getElementById('app-form') as HTMLFormElement;
  const userForm = document.getElementById('user-form') as HTMLFormElement;
  const resultContainer = document.getElementById('result-container') as HTMLElement;
  const resultContent = document.getElementById('result-content') as HTMLElement;
  const historyList = document.getElementById('history-list') as HTMLElement;
  const resetAllBtn = document.getElementById('reset-all-btn') as HTMLButtonElement;
  const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;
  const collapseResultBtn = document.getElementById('collapse-result-btn') as HTMLButtonElement;
  const closeResultBtn = document.getElementById('close-result-btn') as HTMLButtonElement;

  // State
  let activeTab = localStorage.getItem('active_tab') || 'app-token';

  // Init
  switchTab(activeTab);
  
  // Load saved values
  const lastResource = localStorage.getItem('last_resource');
  if (lastResource) {
    (document.getElementById('resource') as HTMLInputElement).value = lastResource;
  }

  const lastScopes = localStorage.getItem('last_scopes');
  if (lastScopes) {
    (document.getElementById('scopes') as HTMLInputElement).value = lastScopes;
  }

  loadHistory();
  checkUrlForToken();
  fetchConfig();

  // Event Listeners
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab!));
  });

  resetAllBtn.addEventListener('click', resetAll);
  clearHistoryBtn.addEventListener('click', clearHistory);
  
  // History Click Handler
  historyList.addEventListener('click', (e: Event) => {
    const targetEl = e.target as HTMLElement;
    const item = targetEl.closest('.history-item') as HTMLElement;
    if (!item) return;
    
    const type = item.dataset.type;
    const target = item.dataset.target;
    
    if (type === 'App Token') {
      switchTab('app-token');
      (document.getElementById('resource') as HTMLInputElement).value = target!;
      // Visual feedback
      const input = document.getElementById('resource') as HTMLInputElement;
      input.focus();
      input.parentElement?.classList.add('highlight');
      setTimeout(() => input.parentElement?.classList.remove('highlight'), 1000);
    } else if (type === 'User Token') {
      switchTab('user-token');
      (document.getElementById('scopes') as HTMLInputElement).value = target!;
      // Visual feedback
      const input = document.getElementById('scopes') as HTMLInputElement;
      input.focus();
      input.parentElement?.classList.add('highlight');
      setTimeout(() => input.parentElement?.classList.remove('highlight'), 1000);
    }
  });
  
  collapseResultBtn.addEventListener('click', () => {
    resultContainer.classList.toggle('minimized');
  });

  closeResultBtn.addEventListener('click', () => {
    resultContainer.classList.add('collapsed');
  });

  // App Token Handler
  appForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const btn = appForm.querySelector('button') as HTMLButtonElement;
    const originalText = btn.innerHTML;
    setLoading(btn, true);

    const resource = (document.getElementById('resource') as HTMLInputElement).value.trim();
    localStorage.setItem('last_resource', resource);
    
    try {
      const res = await fetch(`/token/app?resource=${encodeURIComponent(resource)}`);
      const data = await res.json();
      
      if (res.ok) {
        displayToken(data);
        addToHistory({ type: 'App Token', target: resource, timestamp: new Date() });
      } else {
        showError(data.error || 'Failed to fetch token');
      }
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(btn, false, originalText);
    }
  });

  // User Token Handler
  userForm.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const scopes = (document.getElementById('scopes') as HTMLInputElement).value.trim();
    if (!scopes) return;
    
    localStorage.setItem('last_scopes', scopes);
    localStorage.setItem('active_tab', 'user-token'); // Ensure we come back to this tab
    
    const btn = userForm.querySelector('button') as HTMLButtonElement;
    setLoading(btn, true, 'Redirecting...');
    window.location.href = `/auth/start?scopes=${encodeURIComponent(scopes)}`;
  });

  // Functions
  function switchTab(tabId: string) {
    activeTab = tabId;
    localStorage.setItem('active_tab', activeTab);

    tabs.forEach(t => {
      if (t.dataset.tab === tabId) t.classList.add('active');
      else t.classList.remove('active');
    });

    panels.forEach(p => {
      if (p.id === `${tabId}-panel`) p.classList.add('active');
      else p.classList.remove('active');
    });
  }

  function resetAll() {
    if (confirm('Are you sure you want to reset forms and clear the current result?')) {
      appForm.reset();
      userForm.reset();
      resultContainer.classList.add('collapsed');
      resultContent.innerHTML = '';
      // Reset defaults
      (document.getElementById('resource') as HTMLInputElement).value = 'https://graph.microsoft.com';
      (document.getElementById('scopes') as HTMLInputElement).value = 'User.Read';
      
      // Clear saved state
      localStorage.removeItem('last_resource');
      localStorage.removeItem('last_scopes');
    }
  }

  function displayToken(data: any) {
    const token = data.accessToken;
    const claims = parseJwt(token);
    
    resultContent.innerHTML = `
      <div class="token-display">
        <div class="token-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <h3 style="font-size:0.9rem; color:var(--text-muted);">Access Token</h3>
            <button class="icon-btn-sm" onclick="copyToClipboard('${token}')" title="Copy">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </button>
          </div>
          <pre class="token-content">${token}</pre>
        </div>
        
        ${claims ? `
          <div class="token-box">
            <h3 style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0.5rem;">Decoded Claims</h3>
            <div class="claims-grid" style="max-height:200px; overflow-y:auto;">
              ${Object.entries(claims).map(([k, v]) => `
                <div class="claim-key">${k}</div>
                <div class="claim-value">${typeof v === 'object' ? JSON.stringify(v) : v}</div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    resultContainer.classList.remove('collapsed', 'minimized');
  }

  function showError(msg: string) {
    resultContent.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error); color: var(--error); padding: 1rem; border-radius: 0.5rem;">
        <strong>Error:</strong> ${msg}
      </div>
    `;
    resultContainer.classList.remove('collapsed');
  }

  function checkUrlForToken() {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      try {
        const tokenBase64 = hash.split('token=')[1];
        const tokenJson = atob(tokenBase64);
        const tokenData = JSON.parse(tokenJson);
        
        // Switch to user tab if not already
        switchTab('user-token');
        
        displayToken(tokenData);
        addToHistory({ type: 'User Token', target: tokenData.scopes.join(' '), timestamp: new Date() });
        
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse token', e);
        showError('Failed to parse token from URL');
      }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
      showError(`${urlParams.get('error')}: ${urlParams.get('error_description') || ''}`);
    }
  }

  async function fetchConfig() {
    try {
      const res = await fetch('/health');
      const data = await res.json();
      if (data.clientId) {
        document.getElementById('client-id-value')!.textContent = data.clientId;
        document.getElementById('client-id-badge')!.style.display = 'inline-block';
      }
    } catch (err) {
      console.error('Failed to fetch config', err);
    }
  }

  function addToHistory(item: any) {
    const history = JSON.parse(localStorage.getItem('token_history') || '[]');
    history.unshift(item);
    if (history.length > 20) history.pop();
    localStorage.setItem('token_history', JSON.stringify(history));
    loadHistory();
  }

  function loadHistory() {
    const history = JSON.parse(localStorage.getItem('token_history') || '[]');
    if (history.length === 0) {
      historyList.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 1rem; font-size: 0.85rem;">No recent history</li>';
      return;
    }

    historyList.innerHTML = history.map((item: any) => `
      <li class="history-item" data-type="${item.type}" data-target="${item.target}">
        <div class="history-meta">
          <span>${item.type}</span>
          <span>${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="history-target" title="${item.target}">${item.target}</div>
      </li>
    `).join('');
  }

  function clearHistory() {
    if (confirm('Clear history?')) {
      localStorage.removeItem('token_history');
      loadHistory();
    }
  }

  function setLoading(btn: HTMLButtonElement, isLoading: boolean, text?: string) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="loader"></span> ${text || 'Processing...'}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = text || 'Submit';
    }
  }

  function parseJwt(token: string) {
    try {
      const base64Url = token.split('.')[1] || '';
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  (window as any).copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };
});
