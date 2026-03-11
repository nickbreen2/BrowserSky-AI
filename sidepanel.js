// Browsersky Side Panel Logic

const MODELS = [
  { id: 'gpt-4o',                    name: 'GPT-4o',        desc: 'Most capable OpenAI model',  logo: 'icons/ChatGPT_Logo_0.svg', categories: ['Reasoning', 'Coding', 'Writing'],                credits: 6  },
  { id: 'gpt-4o-mini',               name: 'GPT-4o mini',   desc: 'Faster & lighter',            logo: 'icons/ChatGPT_Logo_0.svg', categories: ['Writing', 'Speed'],                              credits: 1  },
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet', desc: 'Smart & efficient',           logo: 'icons/claude.svg',         categories: ['Reasoning', 'Coding', 'Writing', 'Large Context'], credits: 8  },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku',  desc: 'Fastest Claude',              logo: 'icons/claude.svg',         categories: ['Speed'],                                          credits: 3  },
  { id: 'grok-3',                    name: 'Grok 3',        desc: "xAI's most capable",          logo: 'icons/grok.svg',           categories: ['Reasoning', 'Coding', 'Writing'],                credits: 8  },
  { id: 'grok-3-mini',               name: 'Grok 3 Mini',   desc: 'Fast & efficient',            logo: 'icons/grok.svg',           categories: ['Speed'],                                          credits: 1  },
  { id: 'MiniMax-Text-01',           name: 'MiniMax',       desc: '1M context window',           logo: 'icons/minimax-color.svg',  categories: ['Large Context'],                                 credits: 1  },
];

const FREE_DAILY_CREDITS  = 50;
const PRO_MONTHLY_CREDITS = 2000;

async function getCreditState() {
  const { creditBalance, creditResetAt, userTier = 'free' } =
    await chrome.storage.local.get(['creditBalance', 'creditResetAt', 'userTier']);

  const now = Date.now();
  if (!creditResetAt || now >= creditResetAt) {
    // Reset period has elapsed — issue a fresh batch
    const balance = userTier === 'pro' ? PRO_MONTHLY_CREDITS : FREE_DAILY_CREDITS;
    const resetIn = userTier === 'pro'
      ? 30 * 24 * 60 * 60 * 1000   // 30 days
      : 24 * 60 * 60 * 1000;        // 24 hours
    const nextReset = now + resetIn;
    await chrome.storage.local.set({ creditBalance: balance, creditResetAt: nextReset });
    return { balance, resetAt: nextReset, userTier };
  }

  return { balance: creditBalance ?? FREE_DAILY_CREDITS, resetAt: creditResetAt, userTier };
}

async function deductCredits(amount) {
  const { creditBalance = 0 } = await chrome.storage.local.get('creditBalance');
  await chrome.storage.local.set({ creditBalance: Math.max(0, creditBalance - amount) });
}
const MODEL_CATEGORIES = ['All', 'Reasoning', 'Coding', 'Writing', 'Speed', 'Large Context'];

const AVATAR_COLORS = [
  '#1a73e8', '#ea4335', '#34a853', '#fa7b17',
  '#9c27b0', '#00897b', '#e91e63', '#3949ab',
  '#039be5', '#f4511e', '#0b8043', '#8e24aa',
];

function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

class BrowserskyPanel {
  constructor() {
    this.messages = [];
    this.isLoading = false;
    this.loadingProgressTimeout = null;
    this.tabId = null;
    this.pendingPlan = null; // { steps, domain, originalQuestion }
    this.pendingQuestion = null; // preserved across auth errors for auto-retry
    this.awaitingAuthRetry = false; // true only after an actual auth error, not silent refreshes
    this.selectedModel = 'MiniMax-Text-01';
    this.tabUrl   = '';
    this.tabTitle = '';
    this.clerkUser = null;
    this.init();
  }

  async init() {
    // Auth gate — check for Clerk token before showing chat UI
    const { clerkToken, clerkUser } = await chrome.storage.local.get(['clerkToken', 'clerkUser']);
    if (!clerkToken) {
      this.showAuthGate();
      return;
    }
    this.clerkUser = clerkUser || null;

    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.messagesContainer = document.getElementById('messagesContainer');
    this.loadingIndicator = null;
    this.loadingProgress = null;
    this.errorBanner = document.getElementById('errorBanner');
    this.errorMessage = document.getElementById('errorMessage');
    this.errorClose = document.getElementById('errorClose');
    this.clearChatButton = document.getElementById('clearChatButton');
    this.modelSelectorBtn = document.getElementById('modelSelectorBtn');
    this.modelLabel = document.getElementById('modelLabel');
    this.modelLogo = document.getElementById('modelLogo');
    this.modelPickerView = 'grid';
    this.pageIndicator        = document.getElementById('pageIndicator');
    this.pageIndicatorFavicon = document.getElementById('pageIndicatorFavicon');
    this.pageIndicatorTitle   = document.getElementById('pageIndicatorTitle');
    this.suggestionChips      = document.getElementById('suggestionChips');

    // Capture the tab this panel belongs to
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.tabId  = tab?.id  ?? null;
    this.tabUrl   = tab?.url   ?? '';
    this.tabTitle = tab?.title ?? '';
    if (tab) this.updatePageIndicator(tab);
    if (tab) this.showSuggestions(tab);

    this.renderProfileAvatar();
    this.setupEventListeners();
    this.setupMessageListener();
    this.updateSendButtonState();

    // Restore this tab's conversation history from the service worker
    if (this.tabId !== null) {
      const { conversation } = await chrome.runtime.sendMessage({
        type: 'GET_CONVERSATION',
        tabId: this.tabId
      });
      this.loadConversation(conversation);
    }
  }

  setupEventListeners() {
    // Send button click
    this.sendButton.addEventListener('click', () => this.handleSend());

    // Enter key to send, Shift+Enter for newline
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.messageInput.addEventListener('input', () => {
      this.messageInput.style.height = 'auto';
      const newHeight = this.messageInput.scrollHeight;
      this.messageInput.style.height = Math.min(newHeight, 160) + 'px';
      this.messageInput.style.overflowY = newHeight > 160 ? 'auto' : 'hidden';
      this.updateSendButtonState();
    });

    // Error banner close
    this.errorClose.addEventListener('click', () => {
      this.hideError();
    });

    // Model picker — opens bottom-sheet
    this.modelSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.renderModelPicker();
    });

    // Profile/settings button
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.renderSettingsSheet());
    }

    // Clear chat
    this.clearChatButton.addEventListener('click', async () => {
      this.messages = [];
      this.pendingPlan = null;
      this.dismissPlanSheet();
      this.messagesContainer.innerHTML = '<div class="welcome-message"><img src="icons/Browsersky-full-logo.svg" alt="Browsersky" class="welcome-logo"><p>Ask Browsersky anything about this page</p><div class="suggestion-chips" id="suggestionChips"></div></div>';
      this.suggestionChips = document.getElementById('suggestionChips');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) this.showSuggestions(tab);
      if (this.tabId !== null) {
        chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATION', tabId: this.tabId });
      }
    });

    // Plan keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.dismissModelPicker(); this.dismissSettingsSheet(); }
      if (!this.pendingPlan) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        this.approvePlan();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.makePlanChanges();
      }
    });
  }

  renderProfileAvatar() {
    const avatarEl = document.getElementById('headerAvatar');
    if (!avatarEl) return;
    const user = this.clerkUser;
    const imageUrl = user?.imageUrl || user?.profileImageUrl;
    const firstName = user?.firstName || '';
    const email = user?.emailAddresses?.[0]?.emailAddress || user?.email || '';
    const initial = (firstName[0] || email[0] || '?').toUpperCase();
    const color = getAvatarColor(firstName || email);
    avatarEl.style.background = color;
    if (imageUrl) {
      avatarEl.innerHTML = `<img src="${imageUrl}" alt="Profile" onerror="this.parentElement.style.background='${color}';this.parentElement.innerHTML='<span>${initial}</span>'">`;
    } else {
      avatarEl.innerHTML = `<span>${initial}</span>`;
    }
  }

  dismissSettingsSheet() {
    document.getElementById('settingsSheet')?.remove();
    document.getElementById('settingsSheetBackdrop')?.remove();
  }

  renderSettingsSheet() {
    this.dismissSettingsSheet();

    const user = this.clerkUser;
    const imageUrl = user?.imageUrl || user?.profileImageUrl;
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
    const email = user?.emailAddresses?.[0]?.emailAddress || user?.email || '';
    const initial = (firstName[0] || email[0] || '?').toUpperCase();
    const color = getAvatarColor(firstName || email);

    const backdrop = document.createElement('div');
    backdrop.id = 'settingsSheetBackdrop';
    backdrop.addEventListener('click', () => this.dismissSettingsSheet());
    document.body.appendChild(backdrop);

    const avatarHtml = imageUrl
      ? `<div class="settings-avatar-lg" style="background:${color}"><img src="${imageUrl}" alt="Profile" onerror="this.parentElement.innerHTML='<span>${initial}</span>'"></div>`
      : `<div class="settings-avatar-lg" style="background:${color}"><span>${initial}</span></div>`;

    const sheet = document.createElement('div');
    sheet.id = 'settingsSheet';
    sheet.className = 'settings-sheet';
    sheet.innerHTML = `
      <div class="settings-email-line">${email}</div>
      <div class="settings-user-card">
        ${avatarHtml}
        <div class="settings-user-info">
          <div class="settings-user-name">${fullName}</div>
          <div class="settings-plan-inline">Free</div>
        </div>
      </div>
      <div class="settings-usage-card">
        <div class="settings-credits-main">
          <img src="icons/LLM token.svg" class="settings-credits-icon" alt="">
          <span class="settings-credits-value" id="settingsCreditsValue">—</span>
          <span class="settings-credits-label">credits left</span>
        </div>
        <div class="settings-credits-sub" id="settingsCreditsReset">Renews in —</div>
        <button class="settings-upgrade-btn" id="settingsUpgradeBtn">Upgrade to Pro</button>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-actions">
        <button class="settings-action-item" id="settingsSupportBtn">
          <span class="settings-action-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </span>
          Talk to support
        </button>
        <button class="settings-action-item" id="settingsFeedbackBtn">
          <span class="settings-action-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </span>
          Share feedback
        </button>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-actions">
        <button class="settings-action-item" id="settingsPageBtn">
          <span class="settings-action-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </span>
          Go to settings
        </button>
        <button class="settings-action-item danger" id="settingsSignOutBtn">
          <span class="settings-action-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          Sign out
        </button>
      </div>`;

    document.body.appendChild(sheet);

    getCreditState().then(({ balance, resetAt, userTier }) => {
      const el = document.getElementById('settingsCreditsValue');
      const subEl = document.getElementById('settingsCreditsReset');
      if (el) el.textContent = balance.toLocaleString();
      if (subEl) {
        const msLeft = resetAt - Date.now();
        const hLeft = Math.ceil(msLeft / (1000 * 60 * 60));
        const label = userTier === 'pro'
          ? `${Math.ceil(hLeft / 24)}d · Pro plan`
          : `${hLeft}h · Free plan`;
        subEl.textContent = `Renews in ${label}`;
      }
    });

    document.getElementById('settingsUpgradeBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: `http://localhost:3000/upgrade?extId=${chrome.runtime.id}` });
      this.dismissSettingsSheet();
    });

    document.getElementById('settingsSupportBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: `http://localhost:3000/support?extId=${chrome.runtime.id}` });
      this.dismissSettingsSheet();
    });

    document.getElementById('settingsFeedbackBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: `http://localhost:3000/feedback?extId=${chrome.runtime.id}` });
      this.dismissSettingsSheet();
    });

    document.getElementById('settingsPageBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      this.dismissSettingsSheet();
    });

    document.getElementById('settingsSignOutBtn').addEventListener('click', async () => {
      await chrome.storage.local.remove(['clerkToken', 'clerkUser']);
      this.dismissSettingsSheet();
      location.reload();
    });
  }

  showAuthGate() {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:12px;font-family:sans-serif;padding:24px;box-sizing:border-box;text-align:center;">
        <img src="icons/Browsersky-full-logo.svg" alt="Browsersky" style="width:96px;height:96px;">
        <h2 style="margin:0;font-size:18px;color:#111;">Sign in to Browsersky AI</h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">Connect your account to get started</p>
        <button id="signInBtn" style="margin-top:8px;width:100%;max-width:220px;padding:10px 24px;background:#111827;color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
          Sign In
        </button>
      </div>`;

    const extId = chrome.runtime.id;
    document.getElementById('signInBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: `http://localhost:3000/auth-bridge?extId=${extId}&mode=sign-in` });
    });
    // Listen for token arriving from service worker after sign-in
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'CLERK_TOKEN_RECEIVED') {
        // Re-initialize the panel now that we have a token
        document.body.innerHTML = '';
        location.reload();
      }
    });
  }

  setupMessageListener() {
    // Listen for responses from service worker — only handle messages for this tab
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'BROWSERSKY_RESPONSE' && message.tabId === this.tabId) {
        this.handleBrowserskyResponse(message);
      } else if (message.type === 'BROWSERSKY_PROGRESS' && message.tabId === this.tabId) {
        this.appendProgressStep(message.step, message.label);
      } else if (message.type === 'SIGNED_OUT') {
        location.reload();
      } else if (message.type === 'CLERK_TOKEN_RECEIVED') {
        // Only auto-retry if an actual auth error was shown — not routine silent refreshes
        if (this.pendingQuestion && this.awaitingAuthRetry) {
          const q = this.pendingQuestion;
          this.pendingQuestion = null;
          this.awaitingAuthRetry = false;
          this.hideError();
          this.setLoading(true, q);
          chrome.runtime.sendMessage({
            type: 'ASK_BROWSERSKY',
            question: q,
            tabId: this.tabId,
            model: this.selectedModel
          });
        }
      }
    });

    // Update page indicator when the active tab navigates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tabId !== this.tabId || changeInfo.status !== 'complete') return;
      this.updatePageIndicator(tab);
    });
  }

  updateSendButtonState() {
    const hasText = this.messageInput.value.trim().length > 0;
    this.sendButton.disabled = !hasText || this.isLoading;
  }

  async handleSend() {
    const question = this.messageInput.value.trim();
    if (!question || this.isLoading) return;

    // Credit check
    const model = MODELS.find(m => m.id === this.selectedModel);
    const cost = model?.credits ?? 1;
    const { balance } = await getCreditState();
    if (balance < cost) {
      this.showError(`Not enough credits. This model costs ${cost} credit${cost !== 1 ? 's' : ''} and you have ${balance} remaining. Upgrade to Pro for more.`);
      return;
    }

    // Preserve question for auto-retry after token refresh
    this.pendingQuestion = question;

    // Add user message to UI
    this.addMessage('user', question);

    // Clear input
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';
    this.updateSendButtonState();

    // Show loading state with contextual title
    this.setLoading(true, question);

    // Hide any previous errors
    this.hideError();

    try {
      // Send message to service worker
      chrome.runtime.sendMessage({
        type: 'ASK_BROWSERSKY',
        question: question,
        tabId: this.tabId,
        model: this.selectedModel
      });
    } catch (error) {
      this.setLoading(false);
      this.showError('Failed to send message. Please try again.');
      console.error('Error sending message:', error);
    }
  }

  handleBrowserskyResponse(message) {
    this.setLoading(false);

    if (message.error) {
      const isAuthError = /unauthorized|invalid.*token|expired.*token|token.*expired/i.test(message.error);
      if (isAuthError) {
        // pendingQuestion is kept so setupMessageListener can auto-retry after sign-in
        this.awaitingAuthRetry = true;
        this.showAuthError();
      } else {
        this.pendingQuestion = null;
        this.awaitingAuthRetry = false;
        this.showError(message.error);
      }
    } else if (message.plan) {
      this.pendingQuestion = null;
      this.awaitingAuthRetry = false;
      this.pendingPlan = message.plan;
      this.renderPlanCard(message.plan);
    } else if (message.answer) {
      this.pendingQuestion = null;
      this.awaitingAuthRetry = false;
      this.addMessage('assistant', message.answer, new Date(), message.highlights || []);
      // Deduct credits
      const modelId = message.meta?.model || this.selectedModel;
      const model = MODELS.find(m => m.id === modelId);
      const cost = model?.credits ?? 1;
      deductCredits(cost);
    }
  }

  dismissPlanSheet() {
    const sheet = document.getElementById('planSheet');
    const backdrop = document.getElementById('planSheetBackdrop');
    if (sheet) sheet.remove();
    if (backdrop) backdrop.remove();
  }

  dismissModelPicker() {
    document.getElementById('modelPickerSheet')?.remove();
    document.getElementById('modelPickerBackdrop')?.remove();
  }

  renderModelPicker() {
    this.dismissModelPicker();

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'modelPickerBackdrop';
    backdrop.addEventListener('click', () => this.dismissModelPicker());
    document.body.appendChild(backdrop);

    // Sheet
    const sheet = document.createElement('div');
    sheet.id = 'modelPickerSheet';
    sheet.className = 'model-picker-sheet';

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'model-picker-handle';
    sheet.appendChild(handle);

    // Header row
    const headerRow = document.createElement('div');
    headerRow.className = 'model-picker-header';
    headerRow.innerHTML = `
      <span class="model-picker-title">Choose a model</span>
      <div class="model-picker-view-toggle">
        <button class="model-picker-view-btn ${this.modelPickerView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
        </button>
        <button class="model-picker-view-btn ${this.modelPickerView === 'list' ? 'active' : ''}" data-view="list" title="List view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>
      </div>`;
    sheet.appendChild(headerRow);

    headerRow.querySelectorAll('.model-picker-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.modelPickerView = btn.dataset.view;
        headerRow.querySelectorAll('.model-picker-view-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.view === this.modelPickerView);
        });
        this._refreshModelGrid(sheet);
      });
    });

    // Search bar
    const searchWrap = document.createElement('div');
    searchWrap.className = 'model-picker-search-wrap';
    searchWrap.innerHTML = `
      <svg class="model-picker-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input class="model-picker-search" id="modelPickerSearch" type="text" placeholder="Search models" autocomplete="off">`;
    sheet.appendChild(searchWrap);

    // Category pills
    const CATEGORY_ICONS = {
      'All':           `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
      'Reasoning':     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0112 4.5v0A2.5 2.5 0 019.5 7h-5A2.5 2.5 0 012 4.5v0A2.5 2.5 0 014.5 2h5z"/><path d="M14.5 2A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0114.5 7h0"/><path d="M12 7v4"/><path d="M8 11h8a4 4 0 014 4v0a4 4 0 01-4 4H8a4 4 0 01-4-4v0a4 4 0 014-4z"/><line x1="8" y1="19" x2="8" y2="22"/><line x1="16" y1="19" x2="16" y2="22"/></svg>`,
      'Coding':        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
      'Writing':       `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
      'Speed':         `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      'Large Context': `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    };

    const pills = document.createElement('div');
    pills.className = 'model-picker-pills';
    pills.dataset.activeCategory = 'All';
    MODEL_CATEGORIES.forEach(cat => {
      const pill = document.createElement('button');
      pill.className = 'model-picker-pill' + (cat === 'All' ? ' active' : '');
      pill.innerHTML = `${CATEGORY_ICONS[cat] || ''}<span>${cat}</span>`;
      pill.dataset.category = cat;
      pill.addEventListener('click', () => {
        pills.dataset.activeCategory = cat;
        pills.querySelectorAll('.model-picker-pill').forEach(p => {
          p.classList.toggle('active', p.dataset.category === cat);
        });
        this._refreshModelGrid(sheet);
      });
      pills.appendChild(pill);
    });
    sheet.appendChild(pills);

    // Grid container (populated by _refreshModelGrid)
    const gridContainer = document.createElement('div');
    gridContainer.id = 'modelPickerGrid';
    sheet.appendChild(gridContainer);

    document.body.appendChild(sheet);

    // Wire search after sheet is in DOM
    sheet.querySelector('#modelPickerSearch').addEventListener('input', () => this._refreshModelGrid(sheet));
    sheet.querySelector('#modelPickerSearch').focus();

    this._refreshModelGrid(sheet);
  }

  _refreshModelGrid(sheet) {
    const query = (sheet.querySelector('#modelPickerSearch')?.value || '').toLowerCase();
    const activeCategory = sheet.querySelector('.model-picker-pills')?.dataset.activeCategory || 'All';
    const isGrid = this.modelPickerView === 'grid';

    const filtered = MODELS.filter(m => {
      const matchesCategory = activeCategory === 'All' || m.categories.includes(activeCategory);
      const matchesSearch = !query || m.name.toLowerCase().includes(query) || m.desc.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });

    const container = sheet.querySelector('#modelPickerGrid');
    container.innerHTML = '';
    container.className = isGrid ? 'model-picker-grid' : 'model-picker-list';

    if (filtered.length === 0) {
      container.innerHTML = '<p class="model-picker-empty">No models match your search.</p>';
      return;
    }

    filtered.forEach(model => {
      const card = document.createElement('button');
      const isSelected = model.id === this.selectedModel;
      card.className = 'model-picker-card' + (isSelected ? ' active' : '');

      card.innerHTML = `
        <div class="model-picker-card-top">
          <img class="model-picker-card-logo" src="${model.logo}" alt="${model.name}">
          <div class="model-picker-card-indicators">
            <span class="model-picker-credit-cost"><img src="icons/LLM token.svg" class="model-picker-credit-icon" alt="">${model.credits}</span>
            ${isSelected ? '<span class="model-picker-selected-dot"></span>' : ''}
          </div>
        </div>
        <span class="model-picker-card-name">${model.name}</span>
        <span class="model-picker-card-desc">${model.desc}</span>`;

      card.addEventListener('click', () => {
        this.selectedModel = model.id;
        this.modelLabel.textContent = model.name;
        this.modelLogo.src = model.logo;
        this.dismissModelPicker();
      });

      container.appendChild(card);
    });
  }

  renderPlanCard(plan) {
    this.dismissPlanSheet();

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'planSheetBackdrop';
    document.body.appendChild(backdrop);

    // Sheet
    const sheet = document.createElement('div');
    sheet.id = 'planSheet';
    sheet.className = 'plan-sheet';

    // Header
    const header = document.createElement('div');
    header.className = 'plan-card-header';
    header.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><span>Browsersky's plan</span>`;

    // Sites section
    const sites = document.createElement('div');
    sites.className = 'plan-card-sites';
    sites.innerHTML = `<div class="plan-card-sites-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>Allow actions on these sites</div><div class="plan-card-domain">${plan.domain}</div>`;

    // Steps list
    const steps = document.createElement('ol');
    steps.className = 'plan-card-steps';
    plan.steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      steps.appendChild(li);
    });

    // Approve button
    const approveBtn = document.createElement('button');
    approveBtn.className = 'plan-btn-approve';
    approveBtn.innerHTML = 'Approve plan <kbd>&#9166;</kbd>';
    approveBtn.addEventListener('click', () => this.approvePlan());

    // Make changes button
    const changesBtn = document.createElement('button');
    changesBtn.className = 'plan-btn-changes';
    changesBtn.innerHTML = 'Make changes <kbd>&#8984;&#9166;</kbd>';
    changesBtn.addEventListener('click', () => this.makePlanChanges());

    // Footer
    const footer = document.createElement('p');
    footer.className = 'plan-card-footer';
    footer.textContent = "Browsersky AI will only use the sites listed. You'll be asked before accessing anything else.";

    sheet.appendChild(header);
    sheet.appendChild(sites);
    sheet.appendChild(steps);
    sheet.appendChild(approveBtn);
    sheet.appendChild(changesBtn);
    sheet.appendChild(footer);

    document.body.appendChild(sheet);
  }

  approvePlan() {
    if (!this.pendingPlan) return;
    const { originalQuestion } = this.pendingPlan;
    this.pendingPlan = null;

    this.dismissPlanSheet();
    this.setLoading(true, originalQuestion);
    this.hideError();

    chrome.runtime.sendMessage({
      type: 'ASK_BROWSERSKY',
      question: originalQuestion,
      tabId: this.tabId,
      approved: true,
      model: this.selectedModel
    });
  }

  makePlanChanges() {
    if (!this.pendingPlan) return;
    const { originalQuestion } = this.pendingPlan;
    this.pendingPlan = null;

    this.dismissPlanSheet();

    // Remove the user message that triggered the plan from the UI and history
    const userMsgs = this.messagesContainer.querySelectorAll('.message.user');
    if (userMsgs.length > 0) userMsgs[userMsgs.length - 1].remove();
    this.messages.pop();

    this.messageInput.value = originalQuestion;
    this.messageInput.style.height = 'auto';
    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    this.updateSendButtonState();
    this.messageInput.focus();
    this.messageInput.setSelectionRange(originalQuestion.length, originalQuestion.length);
  }

  loadConversation(conversation) {
    if (!conversation || conversation.length === 0) return;
    for (const msg of conversation) {
      this.addMessage(msg.role, msg.content, new Date(msg.timestamp));
    }
  }

  renderMarkdown(text) {
    // Escape HTML to prevent XSS
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold + italic, bold, italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');

    // Markdown links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Auto-link full URLs (https:// or http://) not already inside an <a>
    html = html.replace(/(?<!href=")https?:\/\/[^\s<>"')]+/g, url =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);

    // Auto-link bare domains like polishify.app, github.com/foo, etc.
    // (?![a-zA-Z0-9]) ensures the TLD isn't followed by more letters (e.g. .config, .mjs)
    html = html.replace(/(?<!["'=/\w])([a-zA-Z0-9][a-zA-Z0-9-]*\.(?:app|com|io|org|net|dev|ai|co|ly|me|to|gg|so|sh|xyz|site|tech|info)(?![a-zA-Z0-9])(?:\/[^\s<>"',]*)?)/g,
      (_match, domain) => `<a href="https://${domain}" target="_blank" rel="noopener noreferrer">${domain}</a>`);

    // Lists — collect consecutive list lines into ul/ol
    html = html.replace(/((?:^[*\-] .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[*\-] /, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    });
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    // Paragraphs — double newline becomes paragraph break
    html = html
      .split(/\n{2,}/)
      .map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (/^<(h[1-3]|ul|ol|hr)/.test(trimmed)) return trimmed;
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    return html;
  }

  addMessage(role, content, timestamp = new Date(), highlights = []) {
    const message = { role, content, timestamp };
    this.messages.push(message);

    // Remove welcome message if present
    const welcomeMsg = this.messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (role === 'assistant') {
      bubble.innerHTML = this.renderMarkdown(content);
      if (highlights.length > 0) {
        const chipsRow = document.createElement('div');
        chipsRow.className = 'highlight-chips';
        highlights.forEach(phrase => {
          const chip = document.createElement('span');
          chip.className = 'highlight-chip';
          chip.textContent = phrase;
          chipsRow.appendChild(chip);
        });
        bubble.appendChild(chipsRow);
      }
    } else {
      bubble.textContent = content;
    }

    messageDiv.appendChild(bubble);

    if (role === 'assistant') {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="message-action-btn" title="Copy" data-action="copy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
          </svg>
        </button>
        <button class="message-action-btn" title="Helpful" data-action="thumbs-up">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"></path>
            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"></path>
          </svg>
        </button>
        <button class="message-action-btn" title="Not helpful" data-action="thumbs-down">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"></path>
            <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"></path>
          </svg>
        </button>`;

      actions.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
        navigator.clipboard.writeText(content);
        const btn = e.currentTarget;
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 1500);
      });

      actions.querySelector('[data-action="thumbs-up"]').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('active');
        actions.querySelector('[data-action="thumbs-down"]').classList.remove('active');
      });

      actions.querySelector('[data-action="thumbs-down"]').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('active');
        actions.querySelector('[data-action="thumbs-up"]').classList.remove('active');
      });

      messageDiv.appendChild(actions);
    }

    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  getContextualTitle(question) {
    const q = (question || '').toLowerCase();
    if (/summar|overview|brief|tldr/.test(q))           return 'Summarizing...';
    if (/translat/.test(q))                              return 'Translating...';
    if (/compar/.test(q))                                return 'Comparing...';
    if (/explain|describe/.test(q))                      return 'Analyzing content...';
    if (/who (is|are|wrote|made|created|built)/.test(q)) return 'Looking up the author...';
    if (/price|cost|how much/.test(q))                   return 'Finding prices...';
    if (/when|what (year|date|time)/.test(q))            return 'Checking dates...';
    if (/list|find all|every/.test(q))                   return 'Gathering information...';
    if (/link|url/.test(q))                              return 'Finding links...';
    if (/name|title|called/.test(q))                     return 'Looking up the name...';
    if (/review|rating|opinion/.test(q))                 return 'Reading the reviews...';
    if (/how (do|does|can|to)/.test(q))                  return 'Figuring out how...';
    if (/why/.test(q))                                   return 'Looking into why...';
    if (/what/.test(q))                                  return 'Looking that up...';
    if (/who/.test(q))                                   return 'Finding out who...';
    if (/where/.test(q))                                 return 'Locating that...';
    return 'Working on it...';
  }

  setLoading(loading, question = null) {
    this.isLoading = loading;
    this.updateSendButtonState();

    if (loading) {
      const titleText = question ? this.getContextualTitle(question) : 'Working on it...';

      const typingEl = document.createElement('div');
      typingEl.id = 'typingIndicator';
      typingEl.className = 'message assistant';
      typingEl.innerHTML = `
        <div class="progress-container">
          <div class="progress-header">
            <div class="typing-dots"><span></span><span></span><span></span></div>
            <span class="progress-title"></span>
          </div>
        </div>`;
      this.messagesContainer.appendChild(typingEl);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

      // Typewriter effect — types the title character by character, replays every 3s
      const titleEl = typingEl.querySelector('.progress-title');
      const startTypewriter = () => {
        titleEl.textContent = '';
        let i = 0;
        const tick = () => {
          if (i < titleText.length) {
            titleEl.textContent += titleText[i++];
            this.typewriterTimeout = setTimeout(tick, 55);
          }
        };
        tick();
      };
      startTypewriter();
      this.loadingProgressTimeout = setInterval(startTypewriter, 3000);
    } else {
      const typingEl = document.getElementById('typingIndicator');
      if (typingEl) typingEl.remove();
      if (this.loadingProgressTimeout) {
        clearInterval(this.loadingProgressTimeout);
        this.loadingProgressTimeout = null;
      }
      if (this.typewriterTimeout) {
        clearTimeout(this.typewriterTimeout);
        this.typewriterTimeout = null;
      }
    }
  }

  appendProgressStep(step, label) {
    const stepsEl = document.getElementById('progressSteps');
    if (!stepsEl) return;

    const stepIcons = {
      page_read:  '📄',
      screenshot: '📸',
      thinking:   '💡',
    };
    const icon = stepIcons[step] || '⚙️';

    const row = document.createElement('div');
    row.className = 'progress-step';
    row.innerHTML = `<span class="progress-step-icon">${icon}</span><span class="progress-step-label">${label}</span>`;
    stepsEl.appendChild(row);

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorBanner.style.display = 'flex';
  }

  showAuthError() {
    const hasQuestion = !!this.pendingQuestion;
    this.errorMessage.innerHTML = `Session expired. <a id="reSignInLink" style="color:inherit;font-weight:600;text-decoration:underline;cursor:pointer;">Sign in again</a>${hasQuestion ? ' — your message will send automatically.' : ''}`;
    this.errorBanner.style.display = 'flex';
    document.getElementById('reSignInLink')?.addEventListener('click', () => {
      chrome.tabs.create({ url: `http://localhost:3000/auth-bridge?extId=${chrome.runtime.id}&mode=sign-in` });
    });
  }

  hideError() {
    this.errorBanner.style.display = 'none';
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  updatePageIndicator(tab) {
    if (!tab || !this.pageIndicator) return;
    this.pageIndicator.classList.remove('loading');

    this.pageIndicatorTitle.textContent = tab.title || tab.url || 'Unknown page';

    const faviconEl = this.pageIndicatorFavicon;
    faviconEl.classList.remove('loaded');
    let src = '';
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
      src = tab.favIconUrl;
    } else if (tab.url) {
      try { src = `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`; }
      catch { /* no favicon */ }
    }
    if (src) {
      faviconEl.onload  = () => faviconEl.classList.add('loaded');
      faviconEl.onerror = () => faviconEl.classList.remove('loaded');
      faviconEl.src = src;
    }
  }

  showSuggestions(tab) {
    if (!this.suggestionChips || !tab?.url) return;

    const SUGGESTIONS = {
      'github.com': [
        'Summarize what this page is about',
        'Explain the code on this page',
        'What are the recent changes here?',
      ],
      'youtube.com': [
        'Summarize this video for me',
        'What are the key points in this video?',
        'Give me the main takeaways',
      ],
      'youtu.be': [
        'Summarize this video for me',
        'What are the key points in this video?',
      ],
      'amazon.com': [
        'Is this product worth buying?',
        'Summarize the reviews',
        'What are the pros and cons?',
      ],
      'amazon.co.uk': [
        'Is this product worth buying?',
        'Summarize the reviews',
      ],
      'reddit.com': [
        'Summarize the top comments',
        "What's the main discussion about?",
      ],
      'linkedin.com': [
        'Summarize this profile',
        'What does this job require?',
      ],
      'twitter.com': [
        'Summarize this thread',
        "What's this tweet about?",
      ],
      'x.com': [
        'Summarize this thread',
        "What's this tweet about?",
      ],
      'nytimes.com':     ['Summarize this article', 'What are the key facts?'],
      'bbc.com':         ['Summarize this article', 'What are the key facts?'],
      'bbc.co.uk':       ['Summarize this article', 'What are the key facts?'],
      'cnn.com':         ['Summarize this article', 'What are the key facts?'],
      'theguardian.com': ['Summarize this article', 'What are the key facts?'],
      'reuters.com':     ['Summarize this article', 'What are the key facts?'],
      'techcrunch.com':  ['Summarize this article', 'What are the main points?'],
      'medium.com':      ['Summarize this article', 'What are the main points?'],
      'substack.com':    ['Summarize this article', 'What are the main points?'],
      'theverge.com':    ['Summarize this article', 'What are the main points?'],
      'wired.com':       ['Summarize this article', 'What are the main points?'],
    };

    let hostname = '';
    try { hostname = new URL(tab.url).hostname.replace('www.', ''); }
    catch { return; }

    const suggestions = SUGGESTIONS[hostname];
    if (!suggestions?.length) return;

    this.suggestionChips.innerHTML = '';
    suggestions.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-chip';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        this.messageInput.value = text;
        this.updateSendButtonState();
        this.handleSend();
      });
      this.suggestionChips.appendChild(btn);
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BrowserskyPanel();
  });
} else {
  new BrowserskyPanel();
}

