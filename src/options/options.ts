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
  getAllSiteProfiles,
  createSiteProfile,
  updateSiteProfile,
  deleteSiteProfile
} from '../lib/storage.js';
import type { UserPreferences, ExternalAPISettings, AuthorIntent, SiteProfile, DisplayMode } from '../types/index.js';

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

  // Data management
  clearCache: document.getElementById('clear-cache') as HTMLButtonElement,
  resetSettings: document.getElementById('reset-settings') as HTMLButtonElement,

  // Site Profiles
  profileList: document.getElementById('profile-list') as HTMLElement,
  createProfileBtn: document.getElementById('create-profile-btn') as HTMLButtonElement,

  // Profile Modal
  profileModal: document.getElementById('profile-modal') as HTMLElement,
  modalTitle: document.getElementById('modal-title') as HTMLElement,
  modalClose: document.getElementById('modal-close') as HTMLButtonElement,
  profileName: document.getElementById('profile-name') as HTMLInputElement,
  profileDescription: document.getElementById('profile-description') as HTMLInputElement,
  profileDomains: document.getElementById('profile-domains') as HTMLElement,
  profileDomainInput: document.getElementById('profile-domain-input') as HTMLInputElement,
  profileAddDomainBtn: document.getElementById('profile-add-domain-btn') as HTMLButtonElement,

  // Profile overrides
  overrideDisplayMode: document.getElementById('override-display-mode') as HTMLInputElement,
  profileDisplayMode: document.getElementById('profile-display-mode') as HTMLSelectElement,
  overrideTruthScore: document.getElementById('override-truth-score') as HTMLInputElement,
  profileTruthScore: document.getElementById('profile-truth-score') as HTMLInputElement,
  profileTruthScoreValue: document.getElementById('profile-truth-score-value') as HTMLElement,
  overrideAuthenticity: document.getElementById('override-authenticity') as HTMLInputElement,
  profileAuthenticity: document.getElementById('profile-authenticity') as HTMLInputElement,
  profileAuthenticityValue: document.getElementById('profile-authenticity-value') as HTMLElement,
  overrideCoordination: document.getElementById('override-coordination') as HTMLInputElement,
  profileCoordination: document.getElementById('profile-coordination') as HTMLInputElement,
  profileCoordinationValue: document.getElementById('profile-coordination-value') as HTMLElement,
  overrideBlockedIntents: document.getElementById('override-blocked-intents') as HTMLInputElement,
  profileBlockTroll: document.getElementById('profile-block-troll') as HTMLInputElement,
  profileBlockBot: document.getElementById('profile-block-bot') as HTMLInputElement,
  profileBlockState: document.getElementById('profile-block-state') as HTMLInputElement,
  profileBlockCommercial: document.getElementById('profile-block-commercial') as HTMLInputElement,
  profileBlockActivist: document.getElementById('profile-block-activist') as HTMLInputElement,

  // Profile action buttons
  profileDeleteBtn: document.getElementById('profile-delete-btn') as HTMLButtonElement,
  profileCancelBtn: document.getElementById('profile-cancel-btn') as HTMLButtonElement,
  profileSaveBtn: document.getElementById('profile-save-btn') as HTMLButtonElement
};

// Current profile being edited (null = creating new)
let editingProfileId: string | null = null;
// Temporary domains list for modal
let modalDomains: string[] = [];

/**
 * Initialize options page
 */
async function init(): Promise<void> {
  // Load and display current settings
  const prefs = await getPreferences();
  const apiSettings = await getExternalAPISettings();

  updatePreferencesUI(prefs);
  updateAPISettingsUI(apiSettings);

  // Load and display site profiles
  await renderProfiles();

  // Set up event listeners
  setupEventListeners();
  setupProfileEventListeners();
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

// ============================================
// SITE PROFILES MANAGEMENT
// ============================================

/**
 * Render profiles list
 */
async function renderProfiles(): Promise<void> {
  const profiles = await getAllSiteProfiles();

  if (profiles.length === 0) {
    elements.profileList.innerHTML = '<p class="no-profiles">No profiles created yet. Create a profile to customize filter settings for specific sites.</p>';
    return;
  }

  elements.profileList.innerHTML = profiles.map(profile => {
    const domainCount = profile.domains.length;
    const domainText = domainCount === 0
      ? 'No domains assigned'
      : domainCount <= 3
        ? profile.domains.join(', ')
        : `${profile.domains.slice(0, 3).join(', ')} +${domainCount - 3} more`;

    const overrideCount = countOverrides(profile);
    const overrideText = overrideCount === 0 ? '' : `${overrideCount} override${overrideCount > 1 ? 's' : ''}`;

    return `
      <div class="profile-card" data-profile-id="${profile.id}">
        <div class="profile-card-header">
          <h4 class="profile-card-name">${escapeHtml(profile.name)}</h4>
          <button class="profile-edit-btn" title="Edit profile">Edit</button>
        </div>
        ${profile.description ? `<p class="profile-card-desc">${escapeHtml(profile.description)}</p>` : ''}
        <div class="profile-card-meta">
          <span class="profile-domains-count">${domainText}</span>
          ${overrideText ? `<span class="profile-overrides-count">${overrideText}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add edit button listeners
  elements.profileList.querySelectorAll('.profile-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.profile-card');
      const profileId = card?.getAttribute('data-profile-id');
      if (profileId) {
        openProfileModal(profileId);
      }
    });
  });
}

/**
 * Count number of active overrides in a profile
 */
function countOverrides(profile: SiteProfile): number {
  let count = 0;
  const o = profile.overrides;
  if (o.displayMode !== undefined) count++;
  if (o.minTruthScore !== undefined) count++;
  if (o.minAuthenticity !== undefined) count++;
  if (o.maxCoordination !== undefined) count++;
  if (o.blockedIntents !== undefined) count++;
  if (o.economicRange !== undefined) count++;
  if (o.socialRange !== undefined) count++;
  if (o.authorityRange !== undefined) count++;
  if (o.globalismRange !== undefined) count++;
  return count;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Open profile modal for creating or editing
 */
async function openProfileModal(profileId?: string): Promise<void> {
  editingProfileId = profileId || null;

  if (profileId) {
    // Editing existing profile
    const profiles = await getAllSiteProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    elements.modalTitle.textContent = 'Edit Profile';
    elements.profileName.value = profile.name;
    elements.profileDescription.value = profile.description || '';
    modalDomains = [...profile.domains];

    // Set override states
    setOverrideState('DisplayMode', profile.overrides.displayMode);
    setOverrideState('TruthScore', profile.overrides.minTruthScore);
    setOverrideState('Authenticity', profile.overrides.minAuthenticity);
    setOverrideState('Coordination', profile.overrides.maxCoordination);
    setOverrideState('BlockedIntents', profile.overrides.blockedIntents);

    // Set override values
    if (profile.overrides.displayMode !== undefined) {
      elements.profileDisplayMode.value = profile.overrides.displayMode;
    }
    if (profile.overrides.minTruthScore !== undefined) {
      elements.profileTruthScore.value = String(profile.overrides.minTruthScore);
      elements.profileTruthScoreValue.textContent = `${profile.overrides.minTruthScore}%`;
    }
    if (profile.overrides.minAuthenticity !== undefined) {
      elements.profileAuthenticity.value = String(profile.overrides.minAuthenticity);
      elements.profileAuthenticityValue.textContent = `${profile.overrides.minAuthenticity}%`;
    }
    if (profile.overrides.maxCoordination !== undefined) {
      elements.profileCoordination.value = String(profile.overrides.maxCoordination);
      elements.profileCoordinationValue.textContent = `${profile.overrides.maxCoordination}%`;
    }
    if (profile.overrides.blockedIntents !== undefined) {
      elements.profileBlockTroll.checked = profile.overrides.blockedIntents.includes('troll');
      elements.profileBlockBot.checked = profile.overrides.blockedIntents.includes('bot');
      elements.profileBlockState.checked = profile.overrides.blockedIntents.includes('stateSponsored');
      elements.profileBlockCommercial.checked = profile.overrides.blockedIntents.includes('commercial');
      elements.profileBlockActivist.checked = profile.overrides.blockedIntents.includes('activist');
    }

    elements.profileDeleteBtn.style.display = 'block';
  } else {
    // Creating new profile
    elements.modalTitle.textContent = 'Create Profile';
    elements.profileName.value = '';
    elements.profileDescription.value = '';
    modalDomains = [];

    // Reset all overrides to unchecked
    resetProfileOverrides();
    elements.profileDeleteBtn.style.display = 'none';
  }

  renderModalDomains();
  elements.profileModal.style.display = 'flex';
}

/**
 * Set override checkbox and control state
 */
function setOverrideState(name: string, value: unknown): void {
  const checkbox = elements[`override${name}` as keyof typeof elements] as HTMLInputElement;
  const hasValue = value !== undefined;

  checkbox.checked = hasValue;

  // Enable/disable the associated controls
  updateOverrideControlState(name, hasValue);
}

/**
 * Update the enabled/disabled state of override controls
 */
function updateOverrideControlState(name: string, enabled: boolean): void {
  switch (name) {
    case 'DisplayMode':
      elements.profileDisplayMode.disabled = !enabled;
      break;
    case 'TruthScore':
      elements.profileTruthScore.disabled = !enabled;
      break;
    case 'Authenticity':
      elements.profileAuthenticity.disabled = !enabled;
      break;
    case 'Coordination':
      elements.profileCoordination.disabled = !enabled;
      break;
    case 'BlockedIntents':
      elements.profileBlockTroll.disabled = !enabled;
      elements.profileBlockBot.disabled = !enabled;
      elements.profileBlockState.disabled = !enabled;
      elements.profileBlockCommercial.disabled = !enabled;
      elements.profileBlockActivist.disabled = !enabled;
      break;
  }
}

/**
 * Reset all profile override fields
 */
function resetProfileOverrides(): void {
  // Uncheck all override checkboxes
  elements.overrideDisplayMode.checked = false;
  elements.overrideTruthScore.checked = false;
  elements.overrideAuthenticity.checked = false;
  elements.overrideCoordination.checked = false;
  elements.overrideBlockedIntents.checked = false;

  // Disable all controls
  updateOverrideControlState('DisplayMode', false);
  updateOverrideControlState('TruthScore', false);
  updateOverrideControlState('Authenticity', false);
  updateOverrideControlState('Coordination', false);
  updateOverrideControlState('BlockedIntents', false);

  // Reset values to defaults
  elements.profileDisplayMode.value = 'badge';
  elements.profileTruthScore.value = '0';
  elements.profileTruthScoreValue.textContent = '0%';
  elements.profileAuthenticity.value = '0';
  elements.profileAuthenticityValue.textContent = '0%';
  elements.profileCoordination.value = '100';
  elements.profileCoordinationValue.textContent = '100%';
  elements.profileBlockTroll.checked = false;
  elements.profileBlockBot.checked = false;
  elements.profileBlockState.checked = false;
  elements.profileBlockCommercial.checked = false;
  elements.profileBlockActivist.checked = false;
}

/**
 * Render domains in modal
 */
function renderModalDomains(): void {
  if (modalDomains.length === 0) {
    elements.profileDomains.innerHTML = '<span class="no-domains">No domains added</span>';
    return;
  }

  elements.profileDomains.innerHTML = modalDomains.map(domain => `
    <span class="domain-tag" data-domain="${escapeHtml(domain)}">
      ${escapeHtml(domain)}
      <button class="domain-remove" title="Remove">&times;</button>
    </span>
  `).join('');

  // Add remove listeners
  elements.profileDomains.querySelectorAll('.domain-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tag = (e.target as HTMLElement).closest('.domain-tag');
      const domain = tag?.getAttribute('data-domain');
      if (domain) {
        modalDomains = modalDomains.filter(d => d !== domain);
        renderModalDomains();
      }
    });
  });
}

/**
 * Close profile modal
 */
function closeProfileModal(): void {
  elements.profileModal.style.display = 'none';
  editingProfileId = null;
  modalDomains = [];
}

/**
 * Save profile from modal
 */
async function saveProfile(): Promise<void> {
  const name = elements.profileName.value.trim();
  if (!name) {
    alert('Please enter a profile name.');
    return;
  }

  // Build overrides object (only include checked fields)
  const overrides: SiteProfile['overrides'] = {};

  if (elements.overrideDisplayMode.checked) {
    overrides.displayMode = elements.profileDisplayMode.value as DisplayMode;
  }
  if (elements.overrideTruthScore.checked) {
    overrides.minTruthScore = parseInt(elements.profileTruthScore.value);
  }
  if (elements.overrideAuthenticity.checked) {
    overrides.minAuthenticity = parseInt(elements.profileAuthenticity.value);
  }
  if (elements.overrideCoordination.checked) {
    overrides.maxCoordination = parseInt(elements.profileCoordination.value);
  }
  if (elements.overrideBlockedIntents.checked) {
    const intents: AuthorIntent[] = [];
    if (elements.profileBlockTroll.checked) intents.push('troll');
    if (elements.profileBlockBot.checked) intents.push('bot');
    if (elements.profileBlockState.checked) intents.push('stateSponsored');
    if (elements.profileBlockCommercial.checked) intents.push('commercial');
    if (elements.profileBlockActivist.checked) intents.push('activist');
    overrides.blockedIntents = intents;
  }

  if (editingProfileId) {
    // Update existing profile
    await updateSiteProfile(editingProfileId, {
      name,
      description: elements.profileDescription.value.trim() || undefined,
      domains: modalDomains,
      overrides
    });
  } else {
    // Create new profile
    await createSiteProfile({
      name,
      description: elements.profileDescription.value.trim() || undefined,
      domains: modalDomains,
      overrides
    });
  }

  closeProfileModal();
  await renderProfiles();

  // Notify content scripts about profile update
  notifyProfileUpdate();
}

/**
 * Delete current profile
 */
async function deleteProfile(): Promise<void> {
  if (!editingProfileId) return;

  if (!confirm('Are you sure you want to delete this profile? Domains assigned to this profile will fall back to global settings.')) {
    return;
  }

  await deleteSiteProfile(editingProfileId);
  closeProfileModal();
  await renderProfiles();
  notifyProfileUpdate();
}

/**
 * Add domain to modal list
 */
function addDomainToModal(): void {
  let domain = elements.profileDomainInput.value.trim().toLowerCase();

  // Remove protocol and path if present
  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  if (!domain) return;

  // Basic domain validation
  if (!/^[a-z0-9]+([\-.][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain) && !/^localhost(:\d+)?$/.test(domain)) {
    alert('Please enter a valid domain (e.g., example.com)');
    return;
  }

  if (modalDomains.includes(domain)) {
    alert('This domain is already added.');
    return;
  }

  modalDomains.push(domain);
  elements.profileDomainInput.value = '';
  renderModalDomains();
}

/**
 * Notify content scripts that profiles have been updated
 */
function notifyProfileUpdate(): void {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'PROFILE_UPDATED' }).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    });
  });
}

/**
 * Set up profile-related event listeners
 */
function setupProfileEventListeners(): void {
  // Create profile button
  elements.createProfileBtn.addEventListener('click', () => openProfileModal());

  // Modal close buttons
  elements.modalClose.addEventListener('click', closeProfileModal);
  elements.profileCancelBtn.addEventListener('click', closeProfileModal);

  // Close modal on backdrop click
  elements.profileModal.addEventListener('click', (e) => {
    if (e.target === elements.profileModal) {
      closeProfileModal();
    }
  });

  // Save and delete buttons
  elements.profileSaveBtn.addEventListener('click', saveProfile);
  elements.profileDeleteBtn.addEventListener('click', deleteProfile);

  // Add domain button and enter key
  elements.profileAddDomainBtn.addEventListener('click', addDomainToModal);
  elements.profileDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDomainToModal();
    }
  });

  // Override checkbox listeners
  elements.overrideDisplayMode.addEventListener('change', () => {
    updateOverrideControlState('DisplayMode', elements.overrideDisplayMode.checked);
  });
  elements.overrideTruthScore.addEventListener('change', () => {
    updateOverrideControlState('TruthScore', elements.overrideTruthScore.checked);
  });
  elements.overrideAuthenticity.addEventListener('change', () => {
    updateOverrideControlState('Authenticity', elements.overrideAuthenticity.checked);
  });
  elements.overrideCoordination.addEventListener('change', () => {
    updateOverrideControlState('Coordination', elements.overrideCoordination.checked);
  });
  elements.overrideBlockedIntents.addEventListener('change', () => {
    updateOverrideControlState('BlockedIntents', elements.overrideBlockedIntents.checked);
  });

  // Slider value displays
  elements.profileTruthScore.addEventListener('input', () => {
    elements.profileTruthScoreValue.textContent = `${elements.profileTruthScore.value}%`;
  });
  elements.profileAuthenticity.addEventListener('input', () => {
    elements.profileAuthenticityValue.textContent = `${elements.profileAuthenticity.value}%`;
  });
  elements.profileCoordination.addEventListener('input', () => {
    elements.profileCoordinationValue.textContent = `${elements.profileCoordination.value}%`;
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
