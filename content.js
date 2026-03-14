// Browsersky Content Script - Page Context Extractor
(function() {
  'use strict';
  
  // Prevent duplicate execution
  if (window.__browserskyContentScriptLoaded) {
    return;
  }
  window.__browserskyContentScriptLoaded = true;

  // Configuration
  const MAX_TEXT_LENGTH = 50000; // Configurable max length for extracted text
  const MIN_TEXT_LENGTH = 100; // Minimum text length for meaningful context

/**
 * LinkedIn-specific extractor.
 * Article editor pages: grabs the title + all contenteditable body text.
 * Published article pages: grabs the article body element.
 * Returns null if nothing useful is found so the generic extractor can run.
 */
function extractLinkedInArticle() {
  try {
    // Strategy 1: editor pages — find top-level contenteditable regions.
    // "Top-level" means no contenteditable ancestor, so we avoid duplicating
    // nested editable elements. Works regardless of the exact URL path LinkedIn uses.
    const allEditables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    const topLevelEditables = allEditables.filter(el => {
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        if (parent.contentEditable === 'true') return false;
        parent = parent.parentElement;
      }
      return true;
    });

    const editorParts = topLevelEditables
      .map(el => el.innerText.trim())
      .filter(t => t.length > 100); // skip trivial inputs like the search bar

    if (editorParts.length) return editorParts.join('\n\n');

    // Strategy 2: published article view — target the article body directly.
    const articleEl = document.querySelector(
      '.article-content, .reader-article-content, ' +
      '[data-test-id="article-content"], ' +
      '.prose, [class*="article-body"]'
    );
    if (articleEl) return articleEl.innerText.trim();

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Extracts visible text from the page body, preferring main content areas.
 * Falls back to a cleaned full-body dump if nothing better is found.
 */
function extractVisibleText() {
  try {
    const hostname = window.location.hostname.replace('www.', '');

    // Site-specific extractors
    if (hostname === 'linkedin.com') {
      const specific = extractLinkedInArticle();
      if (specific && specific.length >= MIN_TEXT_LENGTH) return specific.substring(0, MAX_TEXT_LENGTH);
    }

    // Prefer <main> or [role="main"] to avoid nav/sidebar noise
    const mainEl = document.querySelector('main, [role="main"]');
    const root = mainEl || document.body;

    // Clone the chosen root
    const clone = root.cloneNode(true);

    // Remove noise elements
    clone.querySelectorAll(
      'script, style, noscript, iframe, svg, ' +
      'nav, header, footer, aside, ' +
      '[role="navigation"], [role="banner"], [role="complementary"]'
    ).forEach(el => el.remove());

    // Remove hidden elements
    clone.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]')
      .forEach(el => el.remove());

    let text = clone.innerText || clone.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();

    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '... [truncated]';
    }

    return text;
  } catch (error) {
    console.error('Browsersky: Error extracting text:', error);
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

function injectHighlightStyles() {
  if (document.getElementById('browsersky-highlight-styles')) return;
  const style = document.createElement('style');
  style.id = 'browsersky-highlight-styles';
  style.textContent = `
    .browsersky-highlight {
      outline: 2px solid #3b82f6 !important;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3) !important;
      border-radius: 4px !important;
      transition: outline 0.3s ease, box-shadow 0.3s ease !important;
      animation: browserskyHighlightPulse 1.8s ease-in-out infinite !important;
    }
    @keyframes browserskyHighlightPulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3) !important; }
      50%       { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.55), 0 0 16px rgba(59, 130, 246, 0.35) !important; }
    }
    #browsersky-scan-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      box-shadow: inset 0 0 0 3px #3b82f6;
      z-index: 2147483647;
      animation: browserksyScanFade 2.5s ease-in-out forwards;
    }
    @keyframes browserksyScanFade {
      0%   { opacity: 0; }
      15%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function showScanEffect() {
  injectHighlightStyles();
  const existing = document.getElementById('browsersky-scan-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'browsersky-scan-overlay';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2600);
}

// ── Message listener ────────────────────────────────────────────────────────

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      console.error('Browsersky: Error getting page context:', error);
      sendResponse({
        error: 'EXTRACTION_ERROR',
        message: 'Failed to extract page context. Please try again.'
      });
    }
  } else if (message.type === 'BROWSERSKY_SCANNING') {
    showScanEffect();
  }
});

  // Log that content script is loaded (for debugging)
  console.log('Browsersky content script loaded');
})();
