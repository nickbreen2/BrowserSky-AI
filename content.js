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

// ── Highlight logic ────────────────────────────────────────────────────────

let highlightClearTimeout = null;
let activeKeywords = [];
let highlightObserver = null;
let observerReconnectTimeout = null;

function startHighlightObserver(keywords) {
  stopHighlightObserver();
  activeKeywords = keywords.slice();

  highlightObserver = new MutationObserver(() => {
    if (activeKeywords.length === 0) return;
    const hasHighlights = document.querySelector('.spirit-ai-highlight');
    if (!hasHighlights) {
      // Disconnect to prevent re-entrancy while we re-apply
      highlightObserver.disconnect();
      for (const kw of activeKeywords) {
        highlightElementContaining(kw);
      }
      // Reconnect after DOM settles
      observerReconnectTimeout = setTimeout(() => {
        if (highlightObserver && activeKeywords.length > 0) {
          highlightObserver.observe(document.body, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['class']
          });
        }
      }, 200);
    }
  });

  highlightObserver.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class']
  });
}

function stopHighlightObserver() {
  if (observerReconnectTimeout) {
    clearTimeout(observerReconnectTimeout);
    observerReconnectTimeout = null;
  }
  if (highlightObserver) {
    highlightObserver.disconnect();
    highlightObserver = null;
  }
  activeKeywords = [];
}

function injectHighlightStyles() {
  if (document.getElementById('spirit-ai-highlight-styles')) return;
  const style = document.createElement('style');
  style.id = 'spirit-ai-highlight-styles';
  style.textContent = `
    .spirit-ai-highlight {
      outline: 2px solid #3b82f6 !important;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3) !important;
      border-radius: 4px !important;
      transition: outline 0.3s ease, box-shadow 0.3s ease !important;
      animation: spiritHighlightPulse 1.8s ease-in-out infinite !important;
    }
    @keyframes spiritHighlightPulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3) !important; }
      50%       { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.55), 0 0 16px rgba(59, 130, 246, 0.35) !important; }
    }
    #spirit-ai-scan-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      box-shadow: inset 0 0 0 3px #3b82f6;
      z-index: 2147483647;
      animation: spiritScanFade 2.5s ease-in-out forwards;
    }
    @keyframes spiritScanFade {
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
  const existing = document.getElementById('spirit-ai-scan-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'spirit-ai-scan-overlay';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2600);
}

function clearHighlights() {
  stopHighlightObserver();
  document.querySelectorAll('.spirit-ai-highlight').forEach(el => {
    el.classList.remove('spirit-ai-highlight');
  });
  if (highlightClearTimeout) {
    clearTimeout(highlightClearTimeout);
    highlightClearTimeout = null;
  }
}

// Tags that should never be highlighted themselves
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'textarea', 'input', 'select', 'html', 'body', 'head', 'meta', 'link']);
// Natural block-level content elements — stop walking up here
const BLOCK_TAGS = new Set(['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'dt', 'dd', 'figcaption', 'label', 'button', 'article', 'section']);

/**
 * Finds the tightest visible block ancestor of a text node match and highlights it.
 * Strategy 1 (text-node walk-up): works on React/Next.js apps like Vercel where
 * the keyword is in a single text node inside spans/divs.
 * Strategy 2 (element textContent): fallback for apps like Google Docs where
 * text is fragmented across many tiny text nodes.
 */
function highlightElementContaining(keyword) {
  const lower = keyword.toLowerCase().trim();
  if (!lower) return false;

  // ── Strategy 1: walk text nodes, then walk UP to find a highlight target ──
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName?.toLowerCase();
      return SKIP_TAGS.has(tag) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });

  let textNode;
  while ((textNode = walker.nextNode())) {
    if (!textNode.textContent.toLowerCase().includes(lower)) continue;

    // Walk up from the text node to find the best element to outline
    let el = textNode.parentElement;
    while (el && el !== document.body) {
      const tag = el.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) break;
      if (el.classList.contains('spirit-ai-highlight')) break;

      const rect = el.getBoundingClientRect();
      // Skip zero-size or off-screen elements
      if (rect.width === 0 || rect.height === 0) { el = el.parentElement; continue; }

      // Always stop at semantic block elements
      if (BLOCK_TAGS.has(tag)) {
        el.classList.add('spirit-ai-highlight');
        return true;
      }

      // For divs/spans/anchors: stop when the element is a "tight" container
      // (height < 120px avoids highlighting whole page sections)
      if (rect.height < 120) {
        el.classList.add('spirit-ai-highlight');
        return true;
      }

      el = el.parentElement;
    }
  }

  // ── Strategy 2: element.textContent match (Google Docs fragmented text) ──
  const blockSelector = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th',
    'blockquote', 'dt', 'dd',
    '[role="paragraph"]', '[role="heading"]', '[role="listitem"]', '[role="cell"]',
    '.kix-paragraphrenderer'
  ].join(', ');

  for (const el of document.querySelectorAll(blockSelector)) {
    if (!el.classList.contains('spirit-ai-highlight') && el.textContent.toLowerCase().includes(lower)) {
      el.classList.add('spirit-ai-highlight');
      return true;
    }
  }

  // ── Strategy 3: find the smallest visible element containing the keyword ──
  // Last resort — works on any app regardless of class names (Google Docs, etc.)
  let best = null;
  let bestArea = Infinity;
  for (const el of document.querySelectorAll('*')) {
    if (el.classList.contains('spirit-ai-highlight')) continue;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    if (!el.textContent.toLowerCase().includes(lower)) continue;
    const rect = el.getBoundingClientRect();
    // Must be a visible, reasonably-sized element (not a character-level span or full-page container)
    if (rect.width < 50 || rect.height < 10 || rect.width * rect.height > 600000) continue;
    const area = rect.width * rect.height;
    if (area < bestArea) {
      bestArea = area;
      best = el;
    }
  }
  if (best) {
    best.classList.add('spirit-ai-highlight');
    return true;
  }

  return false;
}

function highlightKeywords(keywords) {
  if (!keywords || keywords.length === 0) return;
  clearHighlights();
  injectHighlightStyles();

  let anyFound = false;
  for (const keyword of keywords) {
    if (highlightElementContaining(keyword)) anyFound = true;
  }

  if (anyFound) {
    const first = document.querySelector('.spirit-ai-highlight');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Watch for DOM mutations that could wipe highlights (React re-renders, Google Docs updates)
    startHighlightObserver(keywords);
  }
}

// ── Message listener ────────────────────────────────────────────────────────

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
  } else if (message.type === 'HIGHLIGHT_ELEMENTS') {
    highlightKeywords(message.keywords);
  } else if (message.type === 'CLEAR_HIGHLIGHTS') {
    clearHighlights();
  } else if (message.type === 'SPIRIT_SCANNING') {
    showScanEffect();
  }
});

  // Log that content script is loaded (for debugging)
  console.log('Spirit.AI content script loaded');
})();
