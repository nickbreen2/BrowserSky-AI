// Spirit.AI Service Worker - Background Orchestrator

// Configuration
const CONFIG = {
  backendEndpoint: 'http://localhost:3001/api/chat',
  defaultModel: 'gpt-4o',
  fallbackModel: 'gpt-4o-mini',
  requestTimeout: 30000, // 30 seconds
  progressWarningDelay: 10000 // 10 seconds
};

/**
 * Opens the side panel when the extension icon is clicked
 */
chrome.action.onClicked.addListener(async (tab) => {
  // Enable and open the panel locked to this specific tab only.
  // Must NOT await setOptions — open() must be called synchronously within the user gesture.
  chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
  chrome.sidePanel.open({ tabId: tab.id });

  // Add the tab to a Spirit.AI tab group for visual clarity
  try {
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId, title: 'Spirit.AI' });
    if (groups.length > 0) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: groups[0].id });
    } else {
      const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      await chrome.tabGroups.update(groupId, { title: 'Spirit.AI', color: 'purple' });
    }
  } catch (e) {
    console.warn('Spirit.AI: Tab grouping failed:', e);
  }

  // Capture page context now, keyed by tab ID
  const contextResult = await getPageContext(tab.id);
  if (!contextResult.error) {
    await chrome.storage.session.set({ [`ctx_${tab.id}`]: contextResult.context });
  }
});

/**
 * Sets the side panel as the default action
 */
chrome.runtime.onInstalled.addListener(() => {
  // Disable the panel globally — it is enabled per-tab when the icon is clicked
  chrome.sidePanel.setOptions({ enabled: false });
});

/**
 * Gets the currently active tab
 * @returns {Promise<chrome.tabs.Tab>}
 */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Checks if a URL is a restricted page
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isRestrictedPage(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('moz-extension://') ||
         url.startsWith('about:');
}

/**
 * Gets page context from the content script
 * @param {number} tabId - The tab ID
 * @returns {Promise<Object>} Page context or error
 */
async function getPageContext(tabId) {
  try {
    // Check if tab is restricted
    const tab = await chrome.tabs.get(tabId);
    if (isRestrictedPage(tab.url)) {
      return {
        error: 'RESTRICTED_PAGE',
        message: 'I can\'t read this page due to browser restrictions. Try a different webpage.'
      };
    }

    // Try to send message first (content script might already be loaded)
    let response;
    try {
      response = await chrome.tabs.sendMessage(tabId, {
        type: 'GET_PAGE_CONTEXT'
      });
    } catch (messageError) {
      // If message fails, try to inject content script
      if (messageError.message && messageError.message.includes('Receiving end does not exist')) {
        console.log('Spirit.AI: Content script not found, injecting...');
        try {
          // Clear the guard flag if it exists (in case of partial load)
          await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              if (window.__spiritAIContentScriptLoaded) {
                delete window.__spiritAIContentScriptLoaded;
              }
            }
          });
          
          // Inject the content script
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });
          
          // Wait longer for script to initialize and set up message listener
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try sending message again
          response = await chrome.tabs.sendMessage(tabId, {
            type: 'GET_PAGE_CONTEXT'
          });
        } catch (injectError) {
          console.error('Spirit.AI: Failed to inject content script:', injectError);
          return {
            error: 'INJECTION_ERROR',
            message: 'Failed to load content script. Please refresh the page and try again.'
          };
        }
      } else {
        throw messageError;
      }
    }

    if (response && response.error) {
      return response;
    }

    if (!response || !response.context) {
      return {
        error: 'NO_CONTEXT',
        message: 'Failed to extract page context. Please try again.'
      };
    }

    return { context: response.context };
  } catch (error) {
    console.error('Spirit.AI: Error getting page context:', error);
    
    // Check if it's a restricted page error
    if (error.message && error.message.includes('Cannot access')) {
      return {
        error: 'RESTRICTED_PAGE',
        message: 'I can\'t read this page due to browser restrictions. Try a different webpage.'
      };
    }

    return {
      error: 'CONTEXT_ERROR',
      message: 'Failed to read page content. Please try again or refresh the page.'
    };
  }
}

/**
 * Calls the AI provider via backend proxy
 * @param {string} question - User's question
 * @param {Object} pageContext - Page context {title, url, text}
 * @returns {Promise<Object>} AI response {answer, usage?, model?}
 */
async function askSpiritAI(question, pageContext) {
  const systemPrompt = `You are Spirit.AI, a browser-based assistant.
Answer the user's question using only the provided webpage content (title, URL, and extracted text).
If the webpage content does not contain the answer, say so explicitly.
Be concise and accurate. Do not invent details.`;

  const userPrompt = `Page Title: ${pageContext.title}
Page URL: ${pageContext.url}

Page Content:
${pageContext.text}

User Question: ${question}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

    const response = await fetch(CONFIG.backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        pageContext,
        model: CONFIG.defaultModel
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      answer: data.answer || 'I apologize, but I couldn\'t generate a response.',
      usage: data.usage,
      model: data.model || CONFIG.defaultModel
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('The AI service is temporarily unavailable. Please check your connection and try again.');
    }

    throw error;
  }
}

/**
 * Handles ASK_SPIRIT messages from the side panel
 * @param {Object} message - Message from side panel
 * @param {chrome.runtime.MessageSender} sender - Message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleAskSpirit(message) {
  try {
    const tabId = message.tabId;
    if (!tabId) {
      chrome.runtime.sendMessage({
        type: 'SPIRIT_RESPONSE',
        error: 'No tab ID provided. Please close and reopen the panel.'
      });
      return;
    }

    // Use context captured when this tab's panel opened
    const stored = await chrome.storage.session.get(`ctx_${tabId}`);
    let pageContext = stored[`ctx_${tabId}`];
    if (!pageContext) {
      // Service worker may have restarted — re-fetch from the same tab
      const contextResult = await getPageContext(tabId);
      if (contextResult.error) {
        chrome.runtime.sendMessage({
          type: 'SPIRIT_RESPONSE',
          error: contextResult.message || 'Failed to extract page context.'
        });
        return;
      }
      pageContext = contextResult.context;
    }

    // Call AI provider
    const aiResponse = await askSpiritAI(message.question, pageContext);
    
    chrome.runtime.sendMessage({
      type: 'SPIRIT_RESPONSE',
      answer: aiResponse.answer,
      meta: {
        usage: aiResponse.usage,
        model: aiResponse.model
      }
    });
  } catch (error) {
    console.error('Spirit.AI: Error handling ASK_SPIRIT:', error);
    
    let errorMessage = 'An unexpected error occurred. Please try again.';
    if (error.message) {
      errorMessage = error.message;
    }

    chrome.runtime.sendMessage({
      type: 'SPIRIT_RESPONSE',
      error: errorMessage
    });
  }
}

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ASK_SPIRIT') {
    handleAskSpirit(message);
  }
});

console.log('Spirit.AI service worker loaded');

