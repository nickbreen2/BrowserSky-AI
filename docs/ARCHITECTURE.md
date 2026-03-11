# Browsersky Architecture Documentation

## Overview

Browsersky is a Chrome Manifest V3 browser extension that provides AI-powered page analysis through a side panel interface. The system consists of four main components:

1. **Side Panel UI** - User interface for chat interaction
2. **Service Worker** - Background orchestrator for messaging and AI calls
3. **Content Script** - Page context extractor running in webpage context
4. **Backend Proxy** - Express.js server that securely calls OpenAI API

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Side Panel   │◄────►│ Service      │                    │
│  │ (UI)         │      │ Worker       │                    │
│  └──────────────┘      └──────┬───────┘                    │
│                                │                            │
│                                ▼                            │
│                        ┌──────────────┐                    │
│                        │ Content      │                    │
│                        │ Script       │                    │
│                        └──────────────┘                    │
│                                                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTP Request
                               ▼
                    ┌──────────────────────┐
                    │  Backend Proxy      │
                    │  (Express.js)       │
                    └──────────┬──────────┘
                               │
                               │ OpenAI API
                               ▼
                    ┌──────────────────────┐
                    │   OpenAI API         │
                    │   (GPT-4)           │
                    └──────────────────────┘
```

## Component Details

### 1. Side Panel UI (`sidepanel.html`, `sidepanel.js`, `sidepanel.css`)

**Purpose**: Provides the chat interface for user interaction.

**Responsibilities**:
- Display message history (user and assistant messages)
- Handle user input (text area with send button)
- Show loading states during AI requests
- Display error messages
- Manage UI state (messages, loading, errors)

**Key Features**:
- Enter key to send, Shift+Enter for newline
- Auto-resizing textarea
- Smooth scrolling to latest message
- Loading indicator with progress warning after 10 seconds
- Error banner with dismiss functionality

**Message Flow**:
- User types question → Sends `ASK_BROWSERSKY` message to service worker
- Receives `BROWSERSKY_RESPONSE` message from service worker
- Displays answer or error in UI

### 2. Service Worker (`service_worker.js`)

**Purpose**: Orchestrates communication between components and handles AI provider calls.

**Responsibilities**:
- Open side panel when extension icon is clicked
- Route messages between side panel and content script
- Get page context from active tab
- Call AI provider via backend proxy
- Handle errors and edge cases
- Manage active tab detection

**Key Functions**:
- `getActiveTab()` - Gets currently active tab
- `isRestrictedPage(url)` - Checks if page is restricted
- `getPageContext(tabId)` - Extracts context from content script
- `askBrowsersky(question, pageContext)` - Calls backend API
- `handleAskBrowsersky()` - Main message handler

**Message Types Handled**:
- `ASK_BROWSERSKY` - From side panel, initiates AI request
- `GET_PAGE_CONTEXT` - To content script, requests page data

**Error Handling**:
- No active tab
- Restricted pages (chrome://, etc.)
- Content script unavailable
- Empty/insufficient text
- Network errors
- Timeout errors

### 3. Content Script (`content.js`)

**Purpose**: Extracts page context (title, URL, visible text) from the current webpage.

**Responsibilities**:
- Extract `document.title`
- Extract `window.location.href`
- Extract visible text from `document.body.innerText`
- Filter out scripts, styles, and hidden elements
- Apply text truncation (50,000 char limit)
- Validate minimum text length (100 chars)

**Key Functions**:
- `extractVisibleText()` - Gets visible text, filters unwanted elements
- `getPageContext()` - Returns complete context object
- `isValidContext(context)` - Validates context has sufficient text

**Message Types Handled**:
- `GET_PAGE_CONTEXT` - From service worker, returns context or error

**Text Extraction Logic**:
1. Clone document body
2. Remove script, style, noscript, iframe, svg elements
3. Remove hidden elements (hidden attribute, display:none)
4. Extract `innerText` (automatically excludes hidden content)
5. Normalize whitespace
6. Truncate to max length if needed

### 4. Backend Proxy (`backend/server.js`)

**Purpose**: Securely handles OpenAI API calls, keeping API keys server-side.

**Responsibilities**:
- Receive chat requests from extension
- Format prompts (system + user)
- Call OpenAI API with proper model
- Handle model fallback (gpt-4o → gpt-4o-mini)
- Return formatted responses
- Handle API errors gracefully

**API Endpoint**:
- `POST /api/chat` - Main chat endpoint
- `GET /health` - Health check endpoint

**Request Format**:
```json
{
  "question": "User's question",
  "pageContext": {
    "title": "Page title",
    "url": "https://example.com",
    "text": "Extracted page text..."
  },
  "model": "gpt-4o" // optional
}
```

**Response Format**:
```json
{
  "answer": "AI response text",
  "usage": {
    "prompt_tokens": 1234,
    "completion_tokens": 567,
    "total_tokens": 1801
  },
  "model": "gpt-4o"
}
```

**System Prompt**:
```
You are Browsersky, a browser-based assistant.
Answer the user's question using only the provided webpage content (title, URL, and extracted text).
If the webpage content does not contain the answer, say so explicitly.
Be concise and accurate. Do not invent details.
```

## Message Schema

### ASK_BROWSERSKY
**Direction**: Side Panel → Service Worker

```javascript
{
  type: 'ASK_BROWSERSKY',
  question: string
}
```

### GET_PAGE_CONTEXT
**Direction**: Service Worker → Content Script

```javascript
{
  type: 'GET_PAGE_CONTEXT'
}
```

**Response** (Success):
```javascript
{
  context: {
    title: string,
    url: string,
    text: string
  }
}
```

**Response** (Error):
```javascript
{
  error: 'RESTRICTED_PAGE' | 'INSUFFICIENT_TEXT' | 'EXTRACTION_ERROR',
  message: string,
  context?: object
}
```

### BROWSERSKY_RESPONSE
**Direction**: Service Worker → Side Panel

```javascript
{
  type: 'BROWSERSKY_RESPONSE',
  answer?: string,
  error?: string,
  meta?: {
    usage?: object,
    model?: string
  }
}
```

## Data Flow

### Golden Path (Successful Request)

1. User types question in side panel
2. Side panel sends `ASK_BROWSERSKY` to service worker
3. Service worker gets active tab
4. Service worker sends `GET_PAGE_CONTEXT` to content script
5. Content script extracts context and returns it
6. Service worker calls `askBrowsersky()` which makes HTTP request to backend
7. Backend formats prompts and calls OpenAI API
8. OpenAI returns response
9. Backend returns formatted response to service worker
10. Service worker sends `BROWSERSKY_RESPONSE` to side panel
11. Side panel displays answer to user

### Error Flows

**Restricted Page**:
1. Service worker detects restricted URL
2. Returns error: "I can't read this page due to browser restrictions..."

**Insufficient Text**:
1. Content script extracts text
2. Validates minimum length (100 chars)
3. Returns error: "This page does not contain enough readable text..."

**Network Error**:
1. Backend request fails
2. Service worker catches error
3. Returns error: "The AI service is temporarily unavailable..."

**Timeout**:
1. Request exceeds 30 second timeout
2. AbortController cancels request
3. Returns error: "Request timed out. Please try again."

## Configuration

### Service Worker Config (`service_worker.js`)

```javascript
const CONFIG = {
  backendEndpoint: 'http://localhost:3001/api/chat',
  defaultModel: 'gpt-4o',
  fallbackModel: 'gpt-4o-mini',
  requestTimeout: 30000, // 30 seconds
  progressWarningDelay: 10000 // 10 seconds
};
```

### Content Script Config (`content.js`)

```javascript
const MAX_TEXT_LENGTH = 50000; // 50k characters
const MIN_TEXT_LENGTH = 100; // Minimum for meaningful context
```

### Backend Config (`.env`)

```
OPENAI_API_KEY=your_key_here
PORT=3001
DEFAULT_MODEL=gpt-4o
FALLBACK_MODEL=gpt-4o-mini
```

## Security Considerations

1. **API Key Protection**: OpenAI API key is stored server-side only, never exposed to extension
2. **CORS**: Backend allows all origins in MVP (should be restricted in production)
3. **Content Script Isolation**: Content script runs in isolated context, cannot access extension APIs directly
4. **No Data Persistence**: Page content is not stored, only sent during active requests
5. **HTTPS**: In production, backend should use HTTPS

## Performance Considerations

1. **Text Extraction**: Typically completes in 100-300ms on standard pages
2. **Content Script Injection**: Runs at `document_idle` to avoid blocking page load
3. **Text Truncation**: Limits context to 50k chars to prevent excessive API costs
4. **Request Timeout**: 30 second timeout prevents hanging requests
5. **Progress Warning**: Shows "taking longer" message after 10 seconds

## Extension Permissions

- `sidePanel` - Required for side panel functionality
- `activeTab` - Required to access current tab
- `tabs` - Required for tab querying
- `scripting` - Required for content script injection
- `<all_urls>` - Required for content script to run on all pages

## Future Enhancements (Out of Scope for MVP)

- Selected text mode (highlight text and ask about it)
- Readability extraction / main content detection
- Citations with page snippet quotes
- Cross-tab memory and summarization cache
- PDF support via dedicated parsing
- Desktop overlay / multi-app integration
- Persistent chat history
- User accounts and subscriptions

## Testing Strategy

1. **Unit Testing**: Test individual functions (text extraction, validation)
2. **Integration Testing**: Test message flow between components
3. **E2E Testing**: Test full user flows on various websites
4. **Error Testing**: Test all error conditions (restricted pages, network errors, etc.)
5. **Performance Testing**: Verify extraction speed and UI responsiveness

## Debugging Tips

- **Service Worker**: Use `chrome://extensions/` → "service worker" link
- **Side Panel**: Right-click in panel → "Inspect"
- **Content Script**: Open DevTools on webpage, check Console
- **Backend**: Check terminal logs and `/health` endpoint
- **Network**: Use DevTools Network tab to inspect API calls

