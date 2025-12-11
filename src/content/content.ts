/**
 * Derigo Content Script
 * Runs on every page to analyze and classify content
 */

import { classifyContent, determineFilterAction } from '../lib/classifier.js';
import { extractPageContent, shouldAnalyzePage, getCacheTTL } from '../lib/extractor.js';
import { extractAuthor } from '../lib/author-extractor.js';
import {
  getPreferences,
  getCachedClassification,
  cacheClassification,
  isWhitelisted
} from '../lib/storage.js';
import type { ClassificationResult, FilterAction, ExtractedAuthor } from '../types/index.js';
import { applyDisplay, removeDisplay } from './display.js';

// Store current classification for popup access
let currentClassification: ClassificationResult | null = null;
let currentFilterAction: FilterAction | null = null;
let currentAuthor: ExtractedAuthor | null = null;

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Check if we should analyze this page
  if (!shouldAnalyzePage()) {
    console.log('[Derigo] Skipping page:', window.location.href);
    return;
  }

  // Check if extension is enabled
  const prefs = await getPreferences();
  if (!prefs.enabled) {
    console.log('[Derigo] Extension disabled');
    return;
  }

  // Check if domain is whitelisted
  const domain = window.location.hostname;
  if (await isWhitelisted(domain)) {
    console.log('[Derigo] Domain whitelisted:', domain);
    return;
  }

  // Check cache first
  const cached = await getCachedClassification(window.location.href);
  if (cached) {
    console.log('[Derigo] Using cached classification');
    currentClassification = cached.result;
    currentFilterAction = determineFilterAction(cached.result, prefs);
    applyDisplay(currentFilterAction, prefs);
    notifyBackgroundScript(cached.result);
    return;
  }

  // Wait for page to be ready
  if (document.readyState !== 'complete') {
    await new Promise<void>(resolve => {
      window.addEventListener('load', () => resolve());
    });
  }

  // Small delay to let dynamic content load
  await new Promise(resolve => setTimeout(resolve, 500));

  // Extract and classify content
  const content = extractPageContent();
  if (!content || content.length < 100) {
    console.log('[Derigo] Insufficient content to analyze');
    return;
  }

  // Extract author information
  currentAuthor = extractAuthor(document, window.location.href);
  if (currentAuthor) {
    console.log('[Derigo] Extracted author:', currentAuthor.identifier, '(', currentAuthor.platform, ')');
  }

  console.log('[Derigo] Analyzing content...');
  const result = await classifyContent(content, window.location.href, currentAuthor || undefined);
  currentClassification = result;

  // Cache the result
  const ttl = getCacheTTL(window.location.href);
  await cacheClassification(window.location.href, result, ttl);

  // Determine filter action
  currentFilterAction = determineFilterAction(result, prefs);

  // Apply display
  applyDisplay(currentFilterAction, prefs);

  // Notify background script
  notifyBackgroundScript(result);

  console.log('[Derigo] Classification complete:', result);
}

/**
 * Notify background script of classification result
 */
function notifyBackgroundScript(result: ClassificationResult): void {
  chrome.runtime.sendMessage({
    type: 'CLASSIFICATION_RESULT',
    data: result
  }).catch(() => {
    // Ignore errors if background script is not ready
  });
}

/**
 * Handle messages from popup or background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_CURRENT_CLASSIFICATION':
      sendResponse({
        classification: currentClassification,
        filterAction: currentFilterAction,
        author: currentAuthor
      });
      break;

    case 'SETTINGS_UPDATED':
      // Re-apply display with new settings
      if (currentClassification) {
        const newAction = determineFilterAction(currentClassification, message.data);
        currentFilterAction = newAction;
        removeDisplay();
        applyDisplay(newAction, message.data);
      }
      sendResponse({ success: true });
      break;

    case 'WHITELIST_DOMAIN':
      // Remove display when domain is whitelisted
      removeDisplay();
      sendResponse({ success: true });
      break;
  }

  return true; // Keep message channel open for async response
});

/**
 * Watch for significant DOM changes (SPA navigation)
 */
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Reset and re-analyze
    currentClassification = null;
    currentFilterAction = null;
    currentAuthor = null;
    removeDisplay();
    main();
  }
});

// Start observing
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// Run main
main().catch(console.error);
