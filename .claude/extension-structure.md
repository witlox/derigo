# Browser Extension Structure

## Manifest V3 Requirements

Chrome/Brave extensions must use Manifest V3. Key differences from V2:
- Service workers instead of background pages
- No remote code execution
- Declarative content blocking where possible
- Promise-based APIs

## File Structure

```
extension/
├── manifest.json           # Extension configuration
├── service-worker.js       # Background service worker
├── content/
│   ├── content.js          # Main content script
│   ├── analyzer.js         # Classification logic
│   ├── display.js          # UI overlays and badges
│   └── styles.css          # Injected styles
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.js            # Popup logic
│   └── popup.css           # Popup styles
├── options/
│   ├── options.html        # Full settings page
│   ├── options.js          # Settings logic
│   └── options.css         # Settings styles
├── lib/
│   ├── storage.js          # Storage abstraction
│   ├── classifier.js       # Classification engine
│   ├── cache.js            # Caching layer
│   └── api.js              # External API calls
├── data/
│   ├── sources.json        # Source reputation data
│   └── keywords.json       # Keyword weights
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Derigo",
  "version": "1.0.0",
  "description": "Analyze content for political alignment and truthfulness",

  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "alarms"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "options_page": "options/options.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## Service Worker (Background)

```javascript
// service-worker.js
import { initializeDatabase } from './lib/storage.js';
import { ClassificationCache } from './lib/cache.js';

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  await initializeDatabase();
  console.log('Derigo extension installed');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CLASSIFY':
      handleClassification(message.data, sender.tab).then(sendResponse);
      return true; // Keep channel open for async response

    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'CACHE_RESULT':
      cacheResult(message.data);
      break;
  }
});

// Periodic cache cleanup
chrome.alarms.create('cache-cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cache-cleanup') {
    cleanExpiredCache();
  }
});
```

## Content Script Architecture

```javascript
// content/content.js
(async function() {
  // Skip non-content pages
  if (!shouldAnalyzePage()) return;

  // Check cache first
  const cached = await checkCache(window.location.href);
  if (cached && !isExpired(cached)) {
    applyClassification(cached.result);
    return;
  }

  // Extract content
  const content = extractPageContent();

  // Classify locally
  const result = await classifyLocally(content);

  // Apply user preferences
  const settings = await getSettings();
  applyClassification(result, settings);

  // Cache result
  cacheResult(window.location.href, result);

  // Optional: request enhanced analysis
  if (settings.enableEnhancedAnalysis && result.confidence < 0.7) {
    requestEnhancedAnalysis(content, result);
  }
})();

function shouldAnalyzePage() {
  // Skip browser internal pages
  if (window.location.protocol === 'chrome:') return false;
  if (window.location.protocol === 'chrome-extension:') return false;

  // Skip if page has no content
  if (!document.body) return false;

  return true;
}
```

## Popup UI

The popup provides quick access to:
1. Current page classification results
2. Quick filter toggles
3. Link to full settings

```html
<!-- popup/popup.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="derigo-popup">
    <header>
      <h1>Derigo</h1>
      <span id="status" class="status"></span>
    </header>

    <section id="classification">
      <h2>Page Analysis</h2>
      <div class="axes">
        <div class="axis" id="economic"></div>
        <div class="axis" id="social"></div>
        <div class="axis" id="authority"></div>
        <div class="axis" id="globalism"></div>
      </div>
      <div class="truth-score" id="truth"></div>
    </section>

    <section id="quick-settings">
      <h2>Quick Filters</h2>
      <div class="filter-toggles"></div>
    </section>

    <footer>
      <a href="#" id="open-settings">Full Settings</a>
    </footer>
  </div>
  <script src="popup.js" type="module"></script>
</body>
</html>
```

## Storage Architecture

### IndexedDB Schema

```javascript
// Database: derigo_db
// Version: 1

// Object Stores:
const DB_SCHEMA = {
  // Classification cache
  classifications: {
    keyPath: 'urlHash',
    indexes: ['timestamp', 'domain']
  },

  // Source reputation
  sources: {
    keyPath: 'domain',
    indexes: ['lastUpdated', 'factualRating']
  },

  // Keyword weights
  keywords: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: ['axis', 'term']
  }
};
```

### Chrome Storage Schema

```javascript
// chrome.storage.sync (synced across devices)
const SYNC_SCHEMA = {
  preferences: {
    economicRange: null,      // [min, max] or null
    socialRange: null,
    authorityRange: null,
    globalismRange: null,
    minTruthScore: 50,
    displayMode: 'badge',
    enableEnhancedAnalysis: false
  },

  // User's API keys (if using their own)
  apiKeys: {
    claude: null,
    factCheck: null
  }
};

// chrome.storage.local (device-specific)
const LOCAL_SCHEMA = {
  // Large caches that shouldn't sync
  recentClassifications: [],

  // Debug settings
  debugMode: false,
  logLevel: 'error'
};
```

## Message Protocol

```typescript
// Message types between content script and service worker

type Message =
  | { type: 'CLASSIFY'; data: { url: string; content: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'CACHE_RESULT'; data: { url: string; result: ClassificationResult } }
  | { type: 'CLASSIFICATION_RESULT'; data: ClassificationResult }
  | { type: 'REQUEST_ENHANCED'; data: { url: string; content: string } }
  | { type: 'SETTINGS_UPDATED'; data: UserPreferences };
```

## Build Configuration

Use a bundler (esbuild recommended for speed):

```javascript
// build.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: [
    'src/service-worker.js',
    'src/content/content.js',
    'src/popup/popup.js',
    'src/options/options.js'
  ],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  target: 'chrome100',
  minify: process.env.NODE_ENV === 'production'
});

// Copy static assets
// ... manifest.json, icons, html files
```

## Cross-Browser Compatibility

For Firefox compatibility, use webextension-polyfill:

```javascript
// Use browser.* API that works in both
import browser from 'webextension-polyfill';

// Instead of chrome.storage.sync.get()
await browser.storage.sync.get('preferences');
```
