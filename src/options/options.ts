/**
 * Derigo Options Page Script
 * Full settings configuration
 */

import {
  getPreferences,
  setPreferences,
  getExternalAPISettings,
  setExternalAPISettings,
  DEFAULT_PREFERENCES,
  DEFAULT_EXTERNAL_API_SETTINGS,
  clearExpiredCache,
  addToWhitelist,
  removeFromWhitelist
} from '../lib/storage.js';
import type { UserPreferences, ExternalAPISettings, AuthorIntent } from '../types/index.js';

// DOM Elements
const elements = {
  // General
  enabled: document.getElementById('enabled') as HTMLInputElement,
  displayMode: document.getElementById('display-mode') as HTMLSelectElement,

  // Political filters
  economicEnabled: document.getElementById('economic-enabled') as HTMLInputElement,
  economicMin: document.getElementById('economic-min') as HTMLInputElement,
  economicMax: document.getElementById('economic-max') as HTMLInputElement,
  economicSlider: document.getElementById('economic-slider-container') as HTMLElement,
  economicRange: document.getElementById('economic-range-display') as HTMLElement,

  socialEnabled: document.getElementById('social-enabled') as HTMLInputElement,
  socialMin: document.getElementById('social-min') as HTMLInputElement,
  socialMax: document.getElementById('social-max') as HTMLInputElement,
  socialSlider: document.getElementById('social-slider-container') as HTMLElement,
  socialRange: document.getElementById('social-range-display') as HTMLElement,

  authorityEnabled: document.getElementById('authority-enabled') as HTMLInputElement,
  authorityMin: document.getElementById('authority-min') as HTMLInputElement,
  authorityMax: document.getElementById('authority-max') as HTMLInputElement,
  authoritySlider: document.getElementById('authority-slider-container') as HTMLElement,
  authorityRange: document.getElementById('authority-range-display') as HTMLElement,

  globalismEnabled: document.getElementById('globalism-enabled') as HTMLInputElement,
  globalismMin: document.getElementById('globalism-min') as HTMLInputElement,
  globalismMax: document.getElementById('globalism-max') as HTMLInputElement,
  globalismSlider: document.getElementById('globalism-slider-container') as HTMLElement,
  globalismRange: document.getElementById('globalism-range-display') as HTMLElement,

  // Truthfulness
  truthThreshold: document.getElementById('truth-threshold') as HTMLInputElement,
  truthThresholdValue: document.getElementById('truth-threshold-value') as HTMLElement,

  // Author filters
  minAuthenticity: document.getElementById('min-authenticity') as HTMLInputElement | null,
  minAuthenticityValue: document.getElementById('min-authenticity-value') as HTMLElement | null,
  maxCoordination: document.getElementById('max-coordination') as HTMLInputElement | null,
  maxCoordinationValue: document.getElementById('max-coordination-value') as HTMLElement | null,
  blockTroll: document.getElementById('block-troll') as HTMLInputElement | null,
  blockBot: document.getElementById('block-bot') as HTMLInputElement | null,
  blockStateSponsored: document.getElementById('block-state-sponsored') as HTMLInputElement | null,
  blockCommercial: document.getElementById('block-commercial') as HTMLInputElement | null,
  blockActivist: document.getElementById('block-activist') as HTMLInputElement | null,

  // External APIs
  allowExternal: document.getElementById('allow-external') as HTMLInputElement,
  apiSettings: document.getElementById('api-settings') as HTMLElement,
  aiEnabled: document.getElementById('ai-enabled') as HTMLInputElement,
  aiProvider: document.getElementById('ai-provider') as HTMLSelectElement,
  aiKey: document.getElementById('ai-key') as HTMLInputElement,
  aiConfidence: document.getElementById('ai-confidence') as HTMLInputElement,
  aiConfidenceValue: document.getElementById('ai-confidence-value') as HTMLElement,
  factcheckEnabled: document.getElementById('factcheck-enabled') as HTMLInputElement,
  factcheckKey: document.getElementById('factcheck-key') as HTMLInputElement,

  // Whitelist
  whitelistItems: document.getElementById('whitelist-items') as HTMLElement,
  whitelistInput: document.getElementById('whitelist-input') as HTMLInputElement,
  whitelistAddBtn: document.getElementById('whitelist-add-btn') as HTMLButtonElement,

  // Data management
  clearCache: document.getElementById('clear-cache') as HTMLButtonElement,
  resetSettings: document.getElementById('reset-settings') as HTMLButtonElement
};

/**
 * Initialize options page
 */
async function init(): Promise<void> {
  // Load and display current settings
  const prefs = await getPreferences();
  const apiSettings = await getExternalAPISettings();

  updatePreferencesUI(prefs);
  updateAPISettingsUI(apiSettings);
  renderWhitelist(prefs.whitelistedDomains);

  // Set up event listeners
  setupEventListeners();
}

/**
 * Update preferences UI
 */
function updatePreferencesUI(prefs: UserPreferences): void {
  // General
  elements.enabled.checked = prefs.enabled;
  elements.displayMode.value = prefs.displayMode;

  // Political filters
  setupAxisFilter('economic', prefs.economicRange);
  setupAxisFilter('social', prefs.socialRange);
  setupAxisFilter('authority', prefs.authorityRange);
  setupAxisFilter('globalism', prefs.globalismRange);

  // Truthfulness
  elements.truthThreshold.value = String(prefs.minTruthScore);
  elements.truthThresholdValue.textContent = `${prefs.minTruthScore}%`;

  // Author filters
  if (elements.minAuthenticity && elements.minAuthenticityValue) {
    elements.minAuthenticity.value = String(prefs.minAuthenticity);
    elements.minAuthenticityValue.textContent = `${prefs.minAuthenticity}%`;
  }
  if (elements.maxCoordination && elements.maxCoordinationValue) {
    elements.maxCoordination.value = String(prefs.maxCoordination);
    elements.maxCoordinationValue.textContent = `${prefs.maxCoordination}%`;
  }
  if (elements.blockTroll) elements.blockTroll.checked = prefs.blockedIntents.includes('troll');
  if (elements.blockBot) elements.blockBot.checked = prefs.blockedIntents.includes('bot');
  if (elements.blockStateSponsored) elements.blockStateSponsored.checked = prefs.blockedIntents.includes('stateSponsored');
  if (elements.blockCommercial) elements.blockCommercial.checked = prefs.blockedIntents.includes('commercial');
  if (elements.blockActivist) elements.blockActivist.checked = prefs.blockedIntents.includes('activist');
}

/**
 * Set up axis filter UI
 */
function setupAxisFilter(
  axis: 'economic' | 'social' | 'authority' | 'globalism',
  range: [number, number] | null
): void {
  const enabled = elements[`${axis}Enabled` as keyof typeof elements] as HTMLInputElement;
  const min = elements[`${axis}Min` as keyof typeof elements] as HTMLInputElement;
  const max = elements[`${axis}Max` as keyof typeof elements] as HTMLInputElement;
  const slider = elements[`${axis}Slider` as keyof typeof elements] as HTMLElement;
  const display = elements[`${axis}Range` as keyof typeof elements] as HTMLElement;

  if (range) {
    enabled.checked = true;
    min.value = String(range[0]);
    max.value = String(range[1]);
    slider.classList.add('active');
    display.textContent = `${range[0]} to ${range[1]}`;
  } else {
    enabled.checked = false;
    min.value = '-100';
    max.value = '100';
    slider.classList.remove('active');
    display.textContent = 'All allowed';
  }
}

/**
 * Update API settings UI
 */
function updateAPISettingsUI(settings: ExternalAPISettings): void {
  elements.allowExternal.checked = settings.allowExternalCalls;
  elements.apiSettings.style.display = settings.allowExternalCalls ? 'block' : 'none';

  // AI Classification
  elements.aiEnabled.checked = settings.aiClassification.enabled;
  elements.aiProvider.value = settings.aiClassification.provider;
  elements.aiKey.value = settings.aiClassification.apiKey;
  elements.aiConfidence.value = String(settings.aiClassification.confidenceThreshold * 100);
  elements.aiConfidenceValue.textContent = `${settings.aiClassification.confidenceThreshold * 100}%`;

  // Fact Check
  elements.factcheckEnabled.checked = settings.factCheck.enabled;
  elements.factcheckKey.value = settings.factCheck.apiKey;
}

/**
 * Render whitelist
 */
function renderWhitelist(domains: string[]): void {
  elements.whitelistItems.innerHTML = domains.map(domain => `
    <div class="whitelist-item" data-domain="${domain}">
      <span>${domain}</span>
      <button title="Remove">&times;</button>
    </div>
  `).join('');

  // Add remove listeners
  elements.whitelistItems.querySelectorAll('.whitelist-item button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = (e.target as HTMLElement).closest('.whitelist-item');
      const domain = item?.getAttribute('data-domain');
      if (domain) {
        await removeFromWhitelist(domain);
        const prefs = await getPreferences();
        renderWhitelist(prefs.whitelistedDomains);
      }
    });
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // General settings
  elements.enabled.addEventListener('change', savePreferences);
  elements.displayMode.addEventListener('change', savePreferences);

  // Political filters
  ['economic', 'social', 'authority', 'globalism'].forEach(axis => {
    const enabled = elements[`${axis}Enabled` as keyof typeof elements] as HTMLInputElement;
    const min = elements[`${axis}Min` as keyof typeof elements] as HTMLInputElement;
    const max = elements[`${axis}Max` as keyof typeof elements] as HTMLInputElement;
    const slider = elements[`${axis}Slider` as keyof typeof elements] as HTMLElement;

    enabled.addEventListener('change', () => {
      slider.classList.toggle('active', enabled.checked);
      savePreferences();
    });

    min.addEventListener('input', () => updateAxisRange(axis as any));
    max.addEventListener('input', () => updateAxisRange(axis as any));
    min.addEventListener('change', savePreferences);
    max.addEventListener('change', savePreferences);
  });

  // Truthfulness
  elements.truthThreshold.addEventListener('input', () => {
    elements.truthThresholdValue.textContent = `${elements.truthThreshold.value}%`;
  });
  elements.truthThreshold.addEventListener('change', savePreferences);

  // Author filters
  if (elements.minAuthenticity && elements.minAuthenticityValue) {
    elements.minAuthenticity.addEventListener('input', () => {
      elements.minAuthenticityValue!.textContent = `${elements.minAuthenticity!.value}%`;
    });
    elements.minAuthenticity.addEventListener('change', savePreferences);
  }

  if (elements.maxCoordination && elements.maxCoordinationValue) {
    elements.maxCoordination.addEventListener('input', () => {
      elements.maxCoordinationValue!.textContent = `${elements.maxCoordination!.value}%`;
    });
    elements.maxCoordination.addEventListener('change', savePreferences);
  }

  // Blocked intents
  const intentCheckboxes = [
    elements.blockTroll,
    elements.blockBot,
    elements.blockStateSponsored,
    elements.blockCommercial,
    elements.blockActivist
  ];
  intentCheckboxes.forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', savePreferences);
    }
  });

  // External APIs
  elements.allowExternal.addEventListener('change', async () => {
    elements.apiSettings.style.display = elements.allowExternal.checked ? 'block' : 'none';
    await saveAPISettings();
  });

  elements.aiEnabled.addEventListener('change', saveAPISettings);
  elements.aiProvider.addEventListener('change', saveAPISettings);
  elements.aiKey.addEventListener('change', saveAPISettings);
  elements.aiConfidence.addEventListener('input', () => {
    elements.aiConfidenceValue.textContent = `${elements.aiConfidence.value}%`;
  });
  elements.aiConfidence.addEventListener('change', saveAPISettings);

  elements.factcheckEnabled.addEventListener('change', saveAPISettings);
  elements.factcheckKey.addEventListener('change', saveAPISettings);

  // Whitelist
  elements.whitelistAddBtn.addEventListener('click', async () => {
    const domain = elements.whitelistInput.value.trim().toLowerCase();
    if (domain) {
      await addToWhitelist(domain);
      elements.whitelistInput.value = '';
      const prefs = await getPreferences();
      renderWhitelist(prefs.whitelistedDomains);
    }
  });

  elements.whitelistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.whitelistAddBtn.click();
    }
  });

  // Data management
  elements.clearCache.addEventListener('click', async () => {
    const cleared = await clearExpiredCache();
    alert(`Cleared ${cleared} cached entries.`);
  });

  elements.resetSettings.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await setPreferences(DEFAULT_PREFERENCES);
      await setExternalAPISettings(DEFAULT_EXTERNAL_API_SETTINGS);
      location.reload();
    }
  });
}

/**
 * Update axis range display
 */
function updateAxisRange(axis: 'economic' | 'social' | 'authority' | 'globalism'): void {
  const min = elements[`${axis}Min` as keyof typeof elements] as HTMLInputElement;
  const max = elements[`${axis}Max` as keyof typeof elements] as HTMLInputElement;
  const display = elements[`${axis}Range` as keyof typeof elements] as HTMLElement;

  const minVal = parseInt(min.value);
  const maxVal = parseInt(max.value);

  // Prevent crossing
  if (minVal > maxVal) {
    min.value = max.value;
  }

  display.textContent = `${min.value} to ${max.value}`;
}

/**
 * Save preferences
 */
async function savePreferences(): Promise<void> {
  const prefs: Partial<UserPreferences> = {
    enabled: elements.enabled.checked,
    displayMode: elements.displayMode.value as UserPreferences['displayMode'],
    minTruthScore: parseInt(elements.truthThreshold.value),
    economicRange: getAxisRange('economic'),
    socialRange: getAxisRange('social'),
    authorityRange: getAxisRange('authority'),
    globalismRange: getAxisRange('globalism'),
    minAuthenticity: elements.minAuthenticity ? parseInt(elements.minAuthenticity.value) : 0,
    maxCoordination: elements.maxCoordination ? parseInt(elements.maxCoordination.value) : 100,
    blockedIntents: getBlockedIntents()
  };

  await setPreferences(prefs);
}

/**
 * Get blocked intents from checkboxes
 */
function getBlockedIntents(): AuthorIntent[] {
  const blocked: AuthorIntent[] = [];
  if (elements.blockTroll?.checked) blocked.push('troll');
  if (elements.blockBot?.checked) blocked.push('bot');
  if (elements.blockStateSponsored?.checked) blocked.push('stateSponsored');
  if (elements.blockCommercial?.checked) blocked.push('commercial');
  if (elements.blockActivist?.checked) blocked.push('activist');
  return blocked;
}

/**
 * Get axis range from inputs
 */
function getAxisRange(axis: string): [number, number] | null {
  const enabled = elements[`${axis}Enabled` as keyof typeof elements] as HTMLInputElement;
  if (!enabled.checked) return null;

  const min = elements[`${axis}Min` as keyof typeof elements] as HTMLInputElement;
  const max = elements[`${axis}Max` as keyof typeof elements] as HTMLInputElement;

  return [parseInt(min.value), parseInt(max.value)];
}

/**
 * Save API settings
 */
async function saveAPISettings(): Promise<void> {
  const settings: Partial<ExternalAPISettings> = {
    allowExternalCalls: elements.allowExternal.checked,
    aiClassification: {
      enabled: elements.aiEnabled.checked,
      provider: elements.aiProvider.value as any,
      apiKey: elements.aiKey.value,
      tier: 'payg',
      autoAnalyze: false,
      confidenceThreshold: parseInt(elements.aiConfidence.value) / 100
    },
    factCheck: {
      enabled: elements.factcheckEnabled.checked,
      apiKey: elements.factcheckKey.value,
      tier: 'free'
    }
  };

  await setExternalAPISettings(settings);
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
