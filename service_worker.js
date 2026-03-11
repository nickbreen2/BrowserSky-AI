// Browsersky Service Worker - Background Orchestrator

// Per-tab conversation history { [tabId]: [{role, content, timestamp}] }
const conversations = {};

// Configuration
const CONFIG = {
  backendEndpoint: 'http://localhost:3001/api/chat',
  visionEndpoint: 'http://localhost:3001/api/chat/vision',
  classifyEndpoint: 'http://localhost:3001/api/classify',
  defaultModel: 'MiniMax-Text-01',
  fallbackModel: 'gpt-4o-mini',
  requestTimeout: 30000, // 30 seconds
  progressWarningDelay: 10000, // 10 seconds
  minTextLength: 200 // characters below this triggers screenshot fallback
};

/**
 * Opens the side panel when the extension icon is clicked
 */
chrome.action.onClicked.addListener(async (tab) => {
  // Enable and open the panel locked to this specific tab only.
  // Must NOT await setOptions — open() must be called synchronously within the user gesture.
  chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
  chrome.sidePanel.open({ tabId: tab.id });

  // Add the tab to a Browsersky tab group for visual clarity
  try {
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId, title: 'Browsersky AI' });
    if (groups.length > 0) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: groups[0].id });
    } else {
      const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      await chrome.tabGroups.update(groupId, { title: 'Browsersky AI', color: 'purple' });
    }
  } catch (e) {
    console.warn('Browsersky: Tab grouping failed:', e);
  }

  // Show scan border on the page to signal Browsersky is active
  chrome.tabs.sendMessage(tab.id, { type: 'BROWSERSKY_SCANNING' }).catch(() => {});

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
 * Checks if a URL is a known JS-heavy app where text extraction is unreliable.
 * These pages always use the screenshot fallback regardless of extracted text length.
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isComplexPage(url) {
  if (!url) return false;
  const complexPatterns = [
    'docs.google.com',
    'sheets.google.com',
    'slides.google.com',
    'figma.com',
    'notion.so',
    'airtable.com',
    'miro.com',
    'canva.com',
    'linear.app',
    'app.asana.com',
    'trello.com'
  ];
  return complexPatterns.some(pattern => url.includes(pattern));
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
        console.log('Browsersky: Content script not found, injecting...');
        try {
          // Clear the guard flag if it exists (in case of partial load)
          await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              if (window.__browserskyContentScriptLoaded) {
                delete window.__browserskyContentScriptLoaded;
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
          console.error('Browsersky: Failed to inject content script:', injectError);
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
    console.error('Browsersky: Error getting page context:', error);
    
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
 * Captures a screenshot of the visible area of a tab
 * @param {number} tabId - The tab ID
 * @returns {Promise<string|null>} Base64 data URL or null on failure
 */
async function captureTabScreenshot(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 80
    });
    return dataUrl;
  } catch (error) {
    console.warn('Browsersky: Screenshot capture failed:', error);
    return null;
  }
}

/**
 * Calls the AI provider with a screenshot via the vision backend endpoint
 * @param {string} question - User's question
 * @param {string} screenshotDataUrl - Base64 JPEG data URL
 * @param {string} url - Page URL
 * @param {string} title - Page title
 * @returns {Promise<Object>} AI response {answer, usage?, model?}
 */
async function getAuthHeaders() {
  const { clerkToken } = await chrome.storage.local.get('clerkToken');
  return clerkToken
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clerkToken}` }
    : { 'Content-Type': 'application/json' };
}

async function askBrowserskyWithVision(question, screenshotDataUrl, url, title) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

    const response = await fetch(CONFIG.visionEndpoint, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        question,
        screenshot: screenshotDataUrl,
        pageInfo: { url, title },
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
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
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
 * Classifies whether a question needs a multi-step plan or a direct answer
 * @param {string} question - User's question
 * @param {Object} pageContext - Page context {title, url, text}
 * @returns {Promise<Object>} Classification {type: "plan"|"direct", steps?: string[]}
 */
async function classifyQuestion(question, pageContext) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Short timeout for classification

    const response = await fetch(CONFIG.classifyEndpoint, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ question, pageContext }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) return { type: 'direct' };

    const data = await response.json();
    return data;
  } catch {
    return { type: 'direct' };
  }
}

/**
 * Calls the AI provider via backend proxy
 * @param {string} question - User's question
 * @param {Object} pageContext - Page context {title, url, text}
 * @returns {Promise<Object>} AI response {answer, usage?, model?}
 */
async function askBrowsersky(question, pageContext, model) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

    const response = await fetch(CONFIG.backendEndpoint, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        question,
        pageContext,
        model: model || CONFIG.defaultModel
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
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
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
 * Handles ASK_BROWSERSKY messages from the side panel
 * @param {Object} message - Message from side panel
 * @param {chrome.runtime.MessageSender} sender - Message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleAskBrowsersky(message) {
  const tabId = message.tabId;

  // Helper: send response tagged with tabId so panels can filter
  function sendResponse(payload) {
    chrome.runtime.sendMessage({ ...payload, type: 'BROWSERSKY_RESPONSE', tabId });
  }

  // Helper: send a progress step to the side panel
  function sendProgress(step, label) {
    chrome.runtime.sendMessage({ type: 'BROWSERSKY_PROGRESS', tabId, step, label });
  }

  // Helper: save a message to this tab's conversation history
  function saveMessage(role, content) {
    if (!conversations[tabId]) conversations[tabId] = [];
    conversations[tabId].push({ role, content, timestamp: Date.now() });
  }

  try {
    if (!tabId) {
      chrome.runtime.sendMessage({
        type: 'BROWSERSKY_RESPONSE',
        error: 'No tab ID provided. Please close and reopen the panel.'
      });
      return;
    }

    // Save the user's question only on the initial (non-approved) call
    if (!message.approved) {
      saveMessage('user', message.question);
    }
    sendProgress('page_read', 'Reading page...');

    // Use context captured when this tab's panel opened
    const stored = await chrome.storage.session.get(`ctx_${tabId}`);
    let pageContext = stored[`ctx_${tabId}`];
    if (!pageContext) {
      // Service worker may have restarted — re-fetch from the same tab
      const contextResult = await getPageContext(tabId);
      if (contextResult.error) {
        if (contextResult.error !== 'RESTRICTED_PAGE') {
          // Non-restricted failure: try screenshot fallback
          sendProgress('screenshot', 'Taking screenshot...');
          const screenshot = await captureTabScreenshot(tabId);
          if (screenshot) {
            sendProgress('thinking', 'Thinking...');
            const tab = await chrome.tabs.get(tabId);
            const aiResponse = await askBrowserskyWithVision(message.question, screenshot, tab.url, tab.title);
            saveMessage('assistant', aiResponse.answer);
            sendResponse({ answer: aiResponse.answer, meta: { usage: aiResponse.usage, model: aiResponse.model } });
            return;
          }
        }
        sendResponse({ error: contextResult.message || 'Failed to extract page context.' });
        return;
      }
      pageContext = contextResult.context;
    }

    // Always show a plan approval on first (non-approved) ask
    if (!message.approved) {
      const classification = await classifyQuestion(message.question, pageContext);
      const steps = (Array.isArray(classification.steps) && classification.steps.length > 0)
        ? classification.steps
        : ['Read page content', 'Analyze your question', 'Write response'];
      let domain = pageContext.url;
      try { domain = new URL(pageContext.url).hostname; } catch { /* keep raw url */ }
      sendResponse({ plan: { steps, domain, originalQuestion: message.question } });
      return;
    }

    const useScreenshot = isComplexPage(pageContext.url) || !pageContext.text || pageContext.text.length < CONFIG.minTextLength;

    // Fall back to screenshot for known JS-heavy apps or if extracted text is too short
    if (useScreenshot) {
      console.log('Browsersky: Insufficient text, falling back to screenshot');
      sendProgress('screenshot', 'Taking screenshot...');
      const screenshot = await captureTabScreenshot(tabId);
      if (screenshot) {
        sendProgress('thinking', 'Thinking...');
        const aiResponse = await askBrowserskyWithVision(
          message.question, screenshot, pageContext.url, pageContext.title
        );
        saveMessage('assistant', aiResponse.answer);
        sendResponse({ answer: aiResponse.answer, meta: { usage: aiResponse.usage, model: aiResponse.model } });
        return;
      }
    }

    // Call AI provider with text context
    sendProgress('thinking', 'Thinking...');
    const aiResponse = await askBrowsersky(message.question, pageContext, message.model);
    saveMessage('assistant', aiResponse.answer);
    sendResponse({ answer: aiResponse.answer, meta: { usage: aiResponse.usage, model: aiResponse.model } });

  } catch (error) {
    console.error('Browsersky: Error handling ASK_BROWSERSKY:', error);
    sendResponse({ error: error.message || 'An unexpected error occurred. Please try again.' });
  }
}

// Listen for messages sent from auth-bridge and settings pages on localhost:3000
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CLERK_TOKEN' && message.token) {
    chrome.storage.local.set({ clerkToken: message.token, clerkUser: message.user || {} }, () => {
      chrome.runtime.sendMessage({ type: 'CLERK_TOKEN_RECEIVED' }).catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'SIGN_OUT') {
    chrome.storage.local.remove(['clerkToken', 'clerkUser'], () => {
      chrome.runtime.sendMessage({ type: 'SIGNED_OUT' }).catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'CLEAR_ALL_DATA') {
    Object.keys(conversations).forEach(k => delete conversations[k]);
    chrome.storage.session.get(null, (items) => {
      const ctxKeys = Object.keys(items).filter(k => k.startsWith('ctx_'));
      if (ctxKeys.length) chrome.storage.session.remove(ctxKeys);
    });
    sendResponse({ ok: true });
    return true;
  }
});

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ASK_BROWSERSKY') {
    handleAskBrowsersky(message);
  } else if (message.type === 'GET_CONVERSATION') {
    sendResponse({ conversation: conversations[message.tabId] || [] });
  } else if (message.type === 'CLEAR_CONVERSATION') {
    delete conversations[message.tabId];
    chrome.storage.session.remove(`ctx_${message.tabId}`);
  }
  return false;
});

// Clean up conversation history when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete conversations[tabId];
  chrome.storage.session.remove(`ctx_${tabId}`);
});

console.log('Browsersky service worker loaded');

