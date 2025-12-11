/**
 * Derigo Service Worker (Background Script)
 * Handles extension lifecycle, message passing, and periodic tasks
 */

import {
  initDatabase,
  seedInitialData,
  isDatabaseSeeded,
  clearExpiredCache,
  clearExpiredAuthorCache,
  seedKnownActors,
  isKnownActorsSeeded,
  setKnownActorPatterns,
  KnownActorPatterns
} from '../lib/storage.js';
import type { KeywordEntry, SourceEntry, ClassificationResult, KnownActorEntry } from '../types/index.js';

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

  // Seed known actors if needed
  if (!await isKnownActorsSeeded()) {
    console.log('[Derigo] Seeding known actors database...');
    await loadAndSeedKnownActors();
  }

  // Set up periodic cache cleanup (includes author cache)
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
 * Load and seed known actors database
 */
async function loadAndSeedKnownActors(): Promise<void> {
  try {
    const response = await fetch(chrome.runtime.getURL('data/known-actors.json'));
    const data = await response.json();
    const actors: KnownActorEntry[] = data.actors || [];

    if (actors.length > 0) {
      await seedKnownActors(actors);
      console.log('[Derigo] Known actors seeded:', actors.length, 'actors');
    } else {
      console.log('[Derigo] No known actors to seed');
    }

    // Load patterns into memory cache
    if (data.patterns) {
      const patterns: KnownActorPatterns = {
        botNamePatterns: data.patterns.botNamePatterns || [],
        trollPatterns: data.patterns.trollPatterns || [],
        suspiciousDomains: data.patterns.suspiciousDomains || [],
        coordinatedNarratives: data.patterns.coordinatedNarratives || [],
        stateMediaDomains: data.patterns.stateMediaDomains || {},
        proxyDomains: data.patterns.proxyDomains || []
      };
      setKnownActorPatterns(patterns);
      console.log('[Derigo] Patterns loaded:', {
        suspiciousDomains: patterns.suspiciousDomains.length,
        coordinatedNarratives: patterns.coordinatedNarratives.length,
        stateMediaCountries: Object.keys(patterns.stateMediaDomains).length
      });
    }
  } catch (error) {
    console.error('[Derigo] Failed to seed known actors:', error);
  }
}

/**
 * Handle alarms
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cache-cleanup') {
    const clearedContent = await clearExpiredCache();
    const clearedAuthors = await clearExpiredAuthorCache();
    const total = clearedContent + clearedAuthors;
    if (total > 0) {
      console.log('[Derigo] Cleared', clearedContent, 'content +', clearedAuthors, 'author cache entries');
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

    case 'GET_TAB_CLASSIFICATION': {
      // Get classification for a specific tab
      const tabId = message.tabId || sender.tab?.id;
      if (tabId) {
        sendResponse({ classification: tabClassifications.get(tabId) || null });
      } else {
        sendResponse({ classification: null });
      }
      break;
    }

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

  // Adjust for author authenticity (lower authenticity = more suspicious)
  if (result.author) {
    if (result.author.authenticity < 30) {
      color = '#dc2626'; // Dark red for likely bot/fake
    } else if (result.author.coordination > 70) {
      color = '#f97316'; // Orange for coordinated content
    }

    // Override for known actors
    if (result.author.knownActor) {
      color = '#dc2626'; // Dark red for known bad actors
    }
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
