# Browsersky - Chrome Extension

A Chrome Manifest V3 browser extension that provides a persistent, right-side panel AI chat experience. Browsersky analyzes the currently active webpage by extracting page context and answering user questions using OpenAI GPT-4.

## Features

- **Right-side panel chat interface** - Persistent side panel that stays open across tab changes
- **Page context extraction** - Automatically extracts title, URL, and visible text from the current page
- **AI-powered answers** - Uses GPT-4 to answer questions based on page content
- **Clean, modern UI** - Beautiful chat interface with message history
- **Error handling** - Graceful handling of restricted pages, network errors, and edge cases

## Installation

### Prerequisites

- Chrome or Edge browser (Manifest V3 compatible)
- Node.js 18+ (for backend server)
- OpenAI API key

### Step 1: Install the Extension

1. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `Browsersky` directory (the folder containing `manifest.json`)
5. The extension should now appear in your extensions list

### Step 2: Set Up the Backend Server

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   ```

5. Start the backend server:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

   The server should start on `http://localhost:3001`

### Step 3: Add Extension Icons

1. Navigate to the `icons` directory
2. Create or add icon files:
   - `icon16.png` (16x16 pixels)
   - `icon32.png` (32x32 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

   You can use the `create-placeholder-icons.html` file in the icons directory to generate simple placeholder icons, or use your own Browsersky branding.

### Step 4: Verify Installation

1. Make sure the backend server is running
2. Navigate to any webpage (e.g., a news article or blog post)
3. Click the Browsersky icon in your browser toolbar
4. The side panel should open on the right
5. Try asking a question like "Summarize this page"

## Development Workflow

### Running the Backend

```bash
cd backend
npm install
npm start  # or npm run dev for auto-reload
```

### Making Changes to the Extension

1. Make your changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Browsersky extension card
4. Test your changes

### Debugging

- **Service Worker**: Go to `chrome://extensions/`, find Browsersky, click "service worker" link
- **Side Panel**: Right-click in the side panel → "Inspect"
- **Content Script**: Open DevTools on the webpage, check Console tab
- **Backend**: Check terminal output and `http://localhost:3001/health`

## Configuration

### Backend Endpoint

The default backend endpoint is `http://localhost:3001/api/chat`. To change it, edit the `CONFIG.backendEndpoint` in `service_worker.js`.

### AI Model

Default model is `gpt-4o` with fallback to `gpt-4o-mini`. Configure in:
- Backend: Set `DEFAULT_MODEL` and `FALLBACK_MODEL` in `.env`
- Service Worker: Edit `CONFIG.defaultModel` and `CONFIG.fallbackModel`

### Text Extraction Limits

- Maximum text length: 50,000 characters (configurable in `content.js`)
- Minimum text length: 100 characters (for meaningful context)

### Request Timeout

Default timeout is 30 seconds. Configure in `service_worker.js` → `CONFIG.requestTimeout`.

## Known Limitations

1. **Restricted Pages**: Cannot extract content from `chrome://`, `chrome-extension://`, or browser settings pages
2. **Heavily Client-Rendered Content**: Some SPAs may have limited extractable text on initial load
3. **Image-Only Pages**: Pages with mostly images and minimal text will show an insufficient text error
4. **No Persistent Memory**: Chat history is only stored in-memory (cleared on panel close)
5. **Single Tab Context**: Only analyzes the currently active tab

## Troubleshooting

### Extension won't load
- Check that `manifest.json` is valid JSON
- Ensure all required files exist (service_worker.js, content.js, sidepanel.html, etc.)
- Check browser console for errors

### Side panel won't open
- Verify the extension is enabled in `chrome://extensions/`
- Check service worker for errors (click "service worker" link)
- Try reloading the extension

### "AI service is temporarily unavailable"
- Verify backend server is running (`http://localhost:3001/health`)
- Check that `OPENAI_API_KEY` is set correctly in `.env`
- Check backend server logs for errors
- Verify network connectivity

### "I can't read this page"
- This is expected for restricted pages (chrome://, chrome-extension://)
- Try navigating to a regular webpage (http:// or https://)

### No response from AI
- Check backend server logs
- Verify OpenAI API key is valid
- Check for rate limits or API errors
- Ensure backend endpoint URL matches in `service_worker.js`

## Testing

Test the extension on various websites:

1. **News Articles**: Try summarizing articles from news sites
2. **Documentation**: Ask questions about technical documentation
3. **Blog Posts**: Extract key points from blog content
4. **Wikipedia**: Test on information-dense pages
5. **Restricted Pages**: Verify error handling on `chrome://extensions/`

## Project Structure

```
Browsersky/
├── manifest.json              # Extension manifest
├── service_worker.js          # Background orchestrator
├── content.js                 # Page context extractor
├── sidepanel.html             # Side panel UI
├── sidepanel.js               # Side panel logic
├── sidepanel.css              # Side panel styles
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── create-placeholder-icons.html
├── backend/                    # Backend proxy server
│   ├── server.js
│   ├── package.json
│   └── .env
├── README.md                  # This file
└── docs/
    └── ARCHITECTURE.md        # Technical documentation
```

## License

MIT

## Support

For issues, questions, or contributions, please refer to the project documentation in `docs/ARCHITECTURE.md`.

