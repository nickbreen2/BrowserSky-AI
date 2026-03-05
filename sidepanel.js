// Spirit.AI Side Panel Logic

class SpiritAIPanel {
  constructor() {
    this.messages = [];
    this.isLoading = false;
    this.loadingProgressTimeout = null;
    this.tabId = null;
    this.init();
  }

  async init() {
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.messagesContainer = document.getElementById('messagesContainer');
    this.loadingIndicator = document.getElementById('loadingIndicator');
    this.loadingProgress = document.getElementById('loadingProgress');
    this.errorBanner = document.getElementById('errorBanner');
    this.errorMessage = document.getElementById('errorMessage');
    this.errorClose = document.getElementById('errorClose');

    // Capture the tab this panel belongs to
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.tabId = tab?.id ?? null;

    this.setupEventListeners();
    this.setupMessageListener();
    this.updateSendButtonState();
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
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
      this.updateSendButtonState();
    });

    // Error banner close
    this.errorClose.addEventListener('click', () => {
      this.hideError();
    });
  }

  setupMessageListener() {
    // Listen for responses from service worker
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SPIRIT_RESPONSE') {
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
      // Send message to service worker
      chrome.runtime.sendMessage({
        type: 'ASK_SPIRIT',
        question: question,
        tabId: this.tabId
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
    } else if (message.answer) {
      this.addMessage('assistant', message.answer);
    }
  }

  addMessage(role, content) {
    const message = {
      role,
      content,
      timestamp: new Date()
    };
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

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = this.formatTime(message.timestamp);

    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);

    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.updateSendButtonState();

    if (loading) {
      this.loadingIndicator.style.display = 'flex';
      // Show "taking longer" message after 10 seconds
      this.loadingProgressTimeout = setTimeout(() => {
        this.loadingProgress.style.display = 'block';
      }, 10000);
    } else {
      this.loadingIndicator.style.display = 'none';
      this.loadingProgress.style.display = 'none';
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

