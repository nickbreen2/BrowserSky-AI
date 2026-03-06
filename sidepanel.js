// Spirit.AI Side Panel Logic

class SpiritAIPanel {
  constructor() {
    this.messages = [];
    this.isLoading = false;
    this.loadingProgressTimeout = null;
    this.tabId = null;
    this.pendingPlan = null; // { steps, domain, originalQuestion }
    this.selectedModel = 'gpt-4o';
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
    this.modelDropdown = document.getElementById('modelDropdown');
    this.modelLabel = document.getElementById('modelLabel');
    this.modelLogo = document.getElementById('modelLogo');

    // Capture the tab this panel belongs to
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.tabId = tab?.id ?? null;

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

    // Model selector toggle
    this.modelSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.modelDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      this.modelDropdown.classList.remove('open');
    });

    document.querySelectorAll('.model-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedModel = btn.dataset.model;
        this.modelLabel.textContent = btn.querySelector('.model-option-name').textContent;
        this.modelLogo.src = btn.dataset.logo;
        document.querySelectorAll('.model-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.modelDropdown.classList.remove('open');
      });
    });

    // Clear chat
    this.clearChatButton.addEventListener('click', () => {
      this.messages = [];
      this.pendingPlan = null;
      this.messagesContainer.innerHTML = '<div class="welcome-message"><p>Ask me anything about the current page!</p></div>';
      if (this.tabId !== null) {
        chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATION', tabId: this.tabId });
      }
    });

    // Plan keyboard shortcuts
    document.addEventListener('keydown', (e) => {
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
      }
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
      // Clear any existing highlights before asking a new question
      if (this.tabId !== null) {
        chrome.tabs.sendMessage(this.tabId, { type: 'CLEAR_HIGHLIGHTS' }).catch(() => {});
      }

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

  renderPlanCard(plan) {
    const existing = this.messagesContainer.querySelector('.plan-card');
    if (existing) existing.remove();

    const welcomeMsg = this.messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const card = document.createElement('div');
    card.className = 'plan-card';

    // Header
    const header = document.createElement('div');
    header.className = 'plan-card-header';
    header.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><span>Spirit.AI's plan</span>`;

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
    footer.textContent = "Spirit.AI will only use the sites listed. You'll be asked before accessing anything else.";

    card.appendChild(header);
    card.appendChild(sites);
    card.appendChild(steps);
    card.appendChild(approveBtn);
    card.appendChild(changesBtn);
    card.appendChild(footer);

    this.messagesContainer.appendChild(card);
    this.scrollToBottom();
  }

  approvePlan() {
    if (!this.pendingPlan) return;
    const { originalQuestion } = this.pendingPlan;
    this.pendingPlan = null;

    const card = this.messagesContainer.querySelector('.plan-card');
    if (card) card.remove();

    this.setLoading(true);
    this.hideError();

    if (this.tabId !== null) {
      chrome.tabs.sendMessage(this.tabId, { type: 'CLEAR_HIGHLIGHTS' }).catch(() => {});
    }

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

    const card = this.messagesContainer.querySelector('.plan-card');
    if (card) card.remove();

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
      const typingEl = document.createElement('div');
      typingEl.id = 'typingIndicator';
      typingEl.className = 'message assistant';
      typingEl.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
      this.messagesContainer.appendChild(typingEl);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

      this.loadingProgressTimeout = setTimeout(() => {
        const el = document.getElementById('typingIndicator');
        if (el) el.querySelector('.typing-dots').insertAdjacentHTML('afterend', '<div class="loading-progress-inline">Taking longer than expected...</div>');
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SpiritAIPanel();
  });
} else {
  new SpiritAIPanel();
}

