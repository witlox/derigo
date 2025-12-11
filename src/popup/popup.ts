/**
 * Derigo Popup Script
 * Displays classification results and quick settings
 */

import { getPreferences, setPreferences } from '../lib/storage.js';
import { getTruthIndicator, formatAxisLabel } from '../lib/classifier.js';
import type { ClassificationResult, UserPreferences } from '../types/index.js';

// DOM Elements
const elements = {
  loading: document.getElementById('loading') as HTMLElement,
  noAnalysis: document.getElementById('no-analysis') as HTMLElement,
  analysis: document.getElementById('analysis') as HTMLElement,
  status: document.getElementById('status') as HTMLElement,
  radarPolygon: document.getElementById('radar-polygon') as SVGPolygonElement,
  toggleEnabled: document.getElementById('toggle-enabled') as HTMLInputElement,
  displayMode: document.getElementById('display-mode') as HTMLSelectElement,
  openOptions: document.getElementById('open-options') as HTMLAnchorElement
};

// Axis elements
const axisElements = {
  economic: {
    marker: document.getElementById('economic-marker') as HTMLElement,
    value: document.getElementById('economic-value') as HTMLElement
  },
  social: {
    marker: document.getElementById('social-marker') as HTMLElement,
    value: document.getElementById('social-value') as HTMLElement
  },
  authority: {
    marker: document.getElementById('authority-marker') as HTMLElement,
    value: document.getElementById('authority-value') as HTMLElement
  },
  globalism: {
    marker: document.getElementById('globalism-marker') as HTMLElement,
    value: document.getElementById('globalism-value') as HTMLElement
  }
};

// Truth elements
const truthElements = {
  score: document.getElementById('truth-score') as HTMLElement,
  fill: document.getElementById('truth-fill') as HTMLElement,
  indicator: document.getElementById('truth-indicator') as HTMLElement
};

const confidenceValue = document.getElementById('confidence-value') as HTMLElement;

/**
 * Initialize popup
 */
async function init(): Promise<void> {
  // Load preferences
  const prefs = await getPreferences();
  updateSettingsUI(prefs);

  // Set up event listeners
  setupEventListeners();

  // Get current tab and request classification
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab.id && tab.url && !tab.url.startsWith('chrome')) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_CURRENT_CLASSIFICATION'
      });

      if (response?.classification) {
        showAnalysis(response.classification);
      } else {
        showNoAnalysis();
      }
    } catch {
      showNoAnalysis();
    }
  } else {
    showNoAnalysis();
  }
}

/**
 * Update settings UI with current preferences
 */
function updateSettingsUI(prefs: UserPreferences): void {
  elements.toggleEnabled.checked = prefs.enabled;
  elements.displayMode.value = prefs.displayMode;

  // Update status indicator
  if (prefs.enabled) {
    elements.status.classList.remove('disabled');
    elements.status.querySelector('.status-text')!.textContent = 'Active';
  } else {
    elements.status.classList.add('disabled');
    elements.status.querySelector('.status-text')!.textContent = 'Disabled';
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Toggle enabled
  elements.toggleEnabled.addEventListener('change', async () => {
    const enabled = elements.toggleEnabled.checked;
    await setPreferences({ enabled });

    // Update status indicator
    if (enabled) {
      elements.status.classList.remove('disabled');
      elements.status.querySelector('.status-text')!.textContent = 'Active';
    } else {
      elements.status.classList.add('disabled');
      elements.status.querySelector('.status-text')!.textContent = 'Disabled';
    }

    // Notify content script
    notifyContentScript();
  });

  // Display mode
  elements.displayMode.addEventListener('change', async () => {
    const displayMode = elements.displayMode.value as UserPreferences['displayMode'];
    await setPreferences({ displayMode });
    notifyContentScript();
  });

  // Open options
  elements.openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

/**
 * Notify content script of settings change
 */
async function notifyContentScript(): Promise<void> {
  const prefs = await getPreferences();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SETTINGS_UPDATED',
        data: prefs
      });
    } catch {
      // Content script may not be loaded
    }
  }
}

/**
 * Show loading state
 */
function showLoading(): void {
  elements.loading.style.display = 'flex';
  elements.noAnalysis.style.display = 'none';
  elements.analysis.style.display = 'none';
}

/**
 * Show no analysis state
 */
function showNoAnalysis(): void {
  elements.loading.style.display = 'none';
  elements.noAnalysis.style.display = 'block';
  elements.analysis.style.display = 'none';
}

/**
 * Show analysis results
 */
function showAnalysis(result: ClassificationResult): void {
  elements.loading.style.display = 'none';
  elements.noAnalysis.style.display = 'none';
  elements.analysis.style.display = 'block';

  // Update radar chart
  updateRadarChart(result);

  // Update axis bars
  updateAxisBar('economic', result.economic);
  updateAxisBar('social', result.social);
  updateAxisBar('authority', result.authority);
  updateAxisBar('globalism', result.globalism);

  // Update truth score
  updateTruthScore(result.truthScore);

  // Update confidence
  confidenceValue.textContent = `${Math.round(result.confidence * 100)}%`;
}

/**
 * Update radar chart polygon
 */
function updateRadarChart(result: ClassificationResult): void {
  const centerX = 100;
  const centerY = 100;
  const radius = 80;

  // Convert scores (-100 to 100) to radius factor (0 to 1)
  const normalize = (score: number) => (score + 100) / 200;

  // Calculate points (clockwise from top)
  // Top: Authority (positive = authoritarian)
  const topY = centerY - radius * normalize(result.authority);

  // Right: Economic (positive = right)
  const rightX = centerX + radius * normalize(result.economic);

  // Bottom: Authority inverted (positive = libertarian)
  const bottomY = centerY + radius * (1 - normalize(result.authority));

  // Left: Economic inverted (positive = left)
  const leftX = centerX - radius * (1 - normalize(result.economic));

  const points = [
    `${centerX},${topY}`,
    `${rightX},${centerY}`,
    `${centerX},${bottomY}`,
    `${leftX},${centerY}`
  ].join(' ');

  elements.radarPolygon.setAttribute('points', points);
}

/**
 * Update axis bar
 */
function updateAxisBar(
  axis: 'economic' | 'social' | 'authority' | 'globalism',
  score: number
): void {
  const el = axisElements[axis];
  const position = ((score + 100) / 200) * 100;
  const label = formatAxisLabel(axis, score);

  el.marker.style.left = `${position}%`;
  el.value.textContent = label;
}

/**
 * Update truth score display
 */
function updateTruthScore(score: number): void {
  const indicator = getTruthIndicator(score);

  truthElements.score.textContent = `${score}%`;
  truthElements.score.className = 'truth-score';

  // Set color class
  if (score >= 80) {
    truthElements.score.classList.add('high');
    truthElements.fill.className = 'truth-fill high';
  } else if (score >= 60) {
    truthElements.score.classList.add('medium-high');
    truthElements.fill.className = 'truth-fill medium-high';
  } else if (score >= 40) {
    truthElements.score.classList.add('medium');
    truthElements.fill.className = 'truth-fill medium';
  } else {
    truthElements.score.classList.add('low');
    truthElements.fill.className = 'truth-fill low';
  }

  truthElements.fill.style.width = `${score}%`;
  truthElements.indicator.textContent = indicator.label;
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
