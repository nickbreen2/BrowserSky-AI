// Spirit.AI Content Script - Page Context Extractor
(function() {
  'use strict';
  
  // Prevent duplicate execution
  if (window.__spiritAIContentScriptLoaded) {
    return;
  }
  window.__spiritAIContentScriptLoaded = true;

  // Configuration
  const MAX_TEXT_LENGTH = 50000; // Configurable max length for extracted text
  const MIN_TEXT_LENGTH = 100; // Minimum text length for meaningful context

/**
 * Extracts visible text from the page body
 * Filters out scripts, styles, and hidden elements
 */
function extractVisibleText() {
  try {
    // Clone the body to avoid modifying the original
    const clone = document.body.cloneNode(true);
    
    // Remove script and style elements
    const scripts = clone.querySelectorAll('script, style, noscript, iframe, svg');
    scripts.forEach(el => el.remove());
    
    // Remove hidden elements
    const hidden = clone.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]');
    hidden.forEach(el => el.remove());
    
    // Get text content
    let text = clone.innerText || clone.textContent || '';
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Truncate if too long
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '... [truncated]';
    }
    
    return text;
  } catch (error) {
    console.error('Spirit.AI: Error extracting text:', error);
    return '';
  }
}

/**
 * Extracts page context: title, URL, and visible text
 * @returns {Object} {title: string, url: string, text: string}
 */
function getPageContext() {
  const title = document.title || '';
  const url = window.location.href || '';
  const text = extractVisibleText();
  
  return {
    title,
    url,
    text
  };
}

/**
 * Validates that the extracted context has sufficient text
 * @param {Object} context - The page context object
 * @returns {boolean} True if context is valid
 */
function isValidContext(context) {
  return context && 
         context.text && 
         context.text.length >= MIN_TEXT_LENGTH;
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTEXT') {
    try {
      const context = getPageContext();
      
      // Check if page is restricted (chrome://, chrome-extension://, etc.)
      const url = window.location.href;
      if (url.startsWith('chrome://') ||
          url.startsWith('chrome-extension://') ||
          url.startsWith('edge://') ||
          url.startsWith('moz-extension://')) {
        sendResponse({
          error: 'RESTRICTED_PAGE',
          message: 'I can\'t read this page due to browser restrictions. Try a different webpage.'
        });
        return;
      }

      // Check if context is valid
      if (!isValidContext(context)) {
        sendResponse({
          error: 'INSUFFICIENT_TEXT',
          message: 'This page does not contain enough readable text for me to answer reliably. Try selecting text or open an article view.',
          context: context
        });
        return;
      }

      sendResponse({ context });
    } catch (error) {
      console.error('Spirit.AI: Error getting page context:', error);
      sendResponse({
        error: 'EXTRACTION_ERROR',
        message: 'Failed to extract page context. Please try again.'
      });
    }
  }
});

  // Log that content script is loaded (for debugging)
  console.log('Spirit.AI content script loaded');
})();
