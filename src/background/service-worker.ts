/**
 * Derigo Service Worker (Background Script)
 * Handles extension lifecycle, message passing, and periodic tasks
 */

import {
  initDatabase,
  seedInitialData,
  isDatabaseSeeded,
  clearExpiredCache
} from '../lib/storage.js';
import type { KeywordEntry, SourceEntry, ClassificationResult } from '../types/index.js';

// Store latest classification per tab
const tabClassifications = new Map<number, ClassificationResult>();

/**
 * Extension installed/updated handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Derigo] Extension installed:', details.reason);

  // Initialize database
  await initDatabase();

  // Seed initial data if needed
  if (!await isDatabaseSeeded()) {
    console.log('[Derigo] Seeding initial data...');
    await loadAndSeedData();
  }

  // Set up periodic cache cleanup
  chrome.alarms.create('cache-cleanup', { periodInMinutes: 60 });
});

/**
 * Load and seed keyword and source data
 */
async function loadAndSeedData(): Promise<void> {
  try {
    // Load keywords
    const keywordsResponse = await fetch(chrome.runtime.getURL('data/keywords.json'));
    const keywordsData = await keywordsResponse.json();
    const keywords: KeywordEntry[] = keywordsData.keywords || [];

    // Load sources
    const sourcesResponse = await fetch(chrome.runtime.getURL('data/sources.json'));
    const sourcesData = await sourcesResponse.json();
    const sources: SourceEntry[] = sourcesData.sources || [];

    await seedInitialData(keywords, sources);
    console.log('[Derigo] Data seeded:', keywords.length, 'keywords,', sources.length, 'sources');
  } catch (error) {
    console.error('[Derigo] Failed to seed data:', error);
  }
}

/**
 * Handle alarms
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cache-cleanup') {
    const cleared = await clearExpiredCache();
    if (cleared > 0) {
      console.log('[Derigo] Cleared', cleared, 'expired cache entries');
    }
  }
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CLASSIFICATION_RESULT':
      // Store classification for the tab
      if (sender.tab?.id) {
        tabClassifications.set(sender.tab.id, message.data);
        updateBadge(sender.tab.id, message.data);
      }
      sendResponse({ success: true });
      break;

    case 'GET_TAB_CLASSIFICATION':
      // Get classification for a specific tab
      const tabId = message.tabId || sender.tab?.id;
      if (tabId) {
        sendResponse({ classification: tabClassifications.get(tabId) || null });
      } else {
        sendResponse({ classification: null });
      }
      break;

    case 'CLEAR_TAB_CLASSIFICATION':
      // Clear classification when navigating away
      if (sender.tab?.id) {
        tabClassifications.delete(sender.tab.id);
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' });
      }
      sendResponse({ success: true });
      break;
  }

  return true; // Keep channel open for async response
});

/**
 * Update extension badge based on classification
 */
function updateBadge(tabId: number, result: ClassificationResult): void {
  // Calculate average political score
  const avgScore = (
    Math.abs(result.economic) +
    Math.abs(result.social) +
    Math.abs(result.authority) +
    Math.abs(result.globalism)
  ) / 4;

  // Determine badge color based on extremity
  let color: string;
  if (avgScore > 60) {
    color = '#ef4444'; // Red - extreme
  } else if (avgScore > 30) {
    color = '#f59e0b'; // Orange - moderate
  } else {
    color = '#22c55e'; // Green - balanced
  }

  // Adjust for truth score
  if (result.truthScore < 40) {
    color = '#dc2626'; // Dark red for low truth
  }

  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text: '●' });
}

/**
 * Clean up when tabs are closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  tabClassifications.delete(tabId);
});

/**
 * Handle tab updates (navigation)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear classification when page is loading
    tabClassifications.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});

console.log('[Derigo] Service worker initialized');
