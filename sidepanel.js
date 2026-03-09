// Spirit.AI Side Panel Logic

const MODELS = [
  { id: 'gpt-4o',                    name: 'GPT-4o',        desc: 'Most capable OpenAI model',  logo: 'icons/ChatGPT_Logo_0.svg', categories: ['Reasoning', 'Coding', 'Writing'],                credits: 10, pro: true  },
  { id: 'gpt-4o-mini',               name: 'GPT-4o mini',   desc: 'Faster & lighter',            logo: 'icons/ChatGPT_Logo_0.svg', categories: ['Writing', 'Speed'],                              credits: 2,  pro: false },
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet', desc: 'Smart & efficient',           logo: 'icons/claude.svg',         categories: ['Reasoning', 'Coding', 'Writing', 'Large Context'], credits: 8,  pro: true  },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku',  desc: 'Fastest Claude',              logo: 'icons/claude.svg',         categories: ['Speed'],                                          credits: 1,  pro: false },
  { id: 'grok-3',                    name: 'Grok 3',        desc: "xAI's most capable",          logo: 'icons/grok.svg',           categories: ['Reasoning', 'Coding', 'Writing'],                credits: 8,  pro: true  },
  { id: 'grok-3-mini',               name: 'Grok 3 Mini',   desc: 'Fast & efficient',            logo: 'icons/grok.svg',           categories: ['Speed'],                                          credits: 2,  pro: false },
  { id: 'MiniMax-Text-01',           name: 'MiniMax',       desc: '1M context window',           logo: 'icons/minimax-color.svg',  categories: ['Large Context'],                                 credits: 3,  pro: false },
];
const MODEL_CATEGORIES = ['All', 'Reasoning', 'Coding', 'Writing', 'Speed', 'Large Context'];

class SpiritAIPanel {
  constructor() {
    this.messages = [];
    this.isLoading = false;
    this.loadingProgressTimeout = null;
    this.tabId = null;
    this.pendingPlan = null; // { steps, domain, originalQuestion }
    this.selectedModel = 'MiniMax-Text-01';
    this.init();
  }

  async init() {
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
    this.tabId = tab?.id ?? null;
    if (tab) this.updatePageIndicator(tab);
    if (tab) this.showSuggestions(tab);

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

    // Clear chat
    this.clearChatButton.addEventListener('click', async () => {
      this.messages = [];
      this.pendingPlan = null;
      this.dismissPlanSheet();
      this.messagesContainer.innerHTML = '<div class="welcome-message"><img src="icons/BirdBot.svg" alt="BirdBot" class="welcome-logo"><p>Ask your BirdBot anything about this page</p><div class="suggestion-chips" id="suggestionChips"></div></div>';
      this.suggestionChips = document.getElementById('suggestionChips');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) this.showSuggestions(tab);
      if (this.tabId !== null) {
        chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATION', tabId: this.tabId });
      }
    });

    // Plan keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.dismissModelPicker();
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

  setupMessageListener() {
    // Listen for responses from service worker — only handle messages for this tab
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SPIRIT_RESPONSE' && message.tabId === this.tabId) {
        this.handleSpiritResponse(message);
      } else if (message.type === 'SPIRIT_PROGRESS' && message.tabId === this.tabId) {
        this.appendProgressStep(message.step, message.label);
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

    // Add user message to UI
    this.addMessage('user', question);
    
    // Clear input
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';
    this.updateSendButtonState();

    // Show loading state
    this.setLoading(true);

    // Hide any previous errors
    this.hideError();

    try {
      // Send message to service worker
      chrome.runtime.sendMessage({
        type: 'ASK_SPIRIT',
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

  handleSpiritResponse(message) {
    this.setLoading(false);

    if (message.error) {
      this.showError(message.error);
    } else if (message.plan) {
      this.pendingPlan = message.plan;
      this.renderPlanCard(message.plan);
    } else if (message.answer) {
      this.addMessage('assistant', message.answer);
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
      card.className = 'model-picker-card' + (model.id === this.selectedModel ? ' active' : '');

      const isSelected = model.id === this.selectedModel;
      card.innerHTML = `
        <div class="model-picker-card-top">
          <img class="model-picker-card-logo" src="${model.logo}" alt="${model.name}">
          <div class="model-picker-card-indicators">
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
    header.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><span>BirdBot's plan</span>`;

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
    footer.textContent = "BirdBot AI will only use the sites listed. You'll be asked before accessing anything else.";

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
    this.setLoading(true);
    this.hideError();

    chrome.runtime.sendMessage({
      type: 'ASK_SPIRIT',
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

  addMessage(role, content, timestamp = new Date()) {
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
    bubble.textContent = content;

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

  setLoading(loading) {
    this.isLoading = loading;
    this.updateSendButtonState();

    if (loading) {
      const openingPhrases = [
        'On it...', 'Let me check...', 'Looking into that...', 'Give me a second...',
        'Digging in...', 'On the case...', 'Figuring that out...', 'Let me look at that...',
        'Working on it...', 'Thinking through this...',
      ];
      const titleText = openingPhrases[Math.floor(Math.random() * openingPhrases.length)];

      const typingEl = document.createElement('div');
      typingEl.id = 'typingIndicator';
      typingEl.className = 'message assistant';
      typingEl.innerHTML = `
        <div class="progress-container">
          <div class="progress-header">
            <div class="typing-dots"><span></span><span></span><span></span></div>
            <span class="progress-title">${titleText}</span>
          </div>
          <div class="progress-steps" id="progressSteps">
            <div class="progress-timeline"></div>
          </div>
        </div>`;
      this.messagesContainer.appendChild(typingEl);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

      this.loadingProgressTimeout = setTimeout(() => {
        const stepsEl = document.getElementById('progressSteps');
        if (stepsEl && stepsEl.querySelectorAll('.progress-step').length === 0) {
          const row = document.createElement('div');
          row.className = 'progress-step';
          row.innerHTML = '<span class="progress-step-icon">⏳</span><span class="progress-step-label">Taking longer than expected...</span>';
          stepsEl.appendChild(row);
        }
      }, 10000);
    } else {
      const typingEl = document.getElementById('typingIndicator');
      if (typingEl) typingEl.remove();
      if (this.loadingProgressTimeout) {
        clearTimeout(this.loadingProgressTimeout);
        this.loadingProgressTimeout = null;
      }
    }
  }

  appendProgressStep(step, label) {
    const stepsEl = document.getElementById('progressSteps');
    if (!stepsEl) return;
    const row = document.createElement('div');
    row.className = 'progress-step';
    row.innerHTML = `<span class="progress-step-icon">🔧</span><span class="progress-step-label">${label}</span>`;
    stepsEl.appendChild(row);

    const stepTitles = {
      page_read:  'Reading the page...',
      screenshot: 'Taking a screenshot...',
      thinking:   'Thinking it through...',
    };
    const titleEl = document.querySelector('.progress-title');
    if (titleEl && stepTitles[step]) titleEl.textContent = stepTitles[step];

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorBanner.style.display = 'flex';
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
    new SpiritAIPanel();
  });
} else {
  new SpiritAIPanel();
}

