/**
 * Display modes for content filtering
 * - Badge: Non-intrusive corner indicator
 * - Overlay: Dismissible warning overlay
 * - Block: Full page block
 */

import type { FilterAction, UserPreferences, ClassificationResult } from '../types/index.js';
import { getScoreColor, getTruthIndicator, formatAxisLabel } from '../lib/classifier.js';
import { addToWhitelist } from '../lib/storage.js';

// Element IDs
const BADGE_ID = 'derigo-badge';
const OVERLAY_ID = 'derigo-overlay';
const BLOCK_ID = 'derigo-block-screen';
const STYLES_ID = 'derigo-styles';

// Store original body content for restoration
let originalBodyContent: string | null = null;

/**
 * Apply display based on filter action
 */
export function applyDisplay(action: FilterAction, prefs: UserPreferences): void {
  // Ensure styles are injected
  injectStyles();

  switch (action.action) {
    case 'block':
      applyBlockMode(action.result, action.reason);
      break;
    case 'overlay':
      applyOverlayMode(action.result, action.reason);
      break;
    case 'badge':
      applyBadgeMode(action.result);
      break;
    case 'none':
      // No display needed
      break;
  }
}

/**
 * Remove all display elements
 */
export function removeDisplay(): void {
  const badge = document.getElementById(BADGE_ID);
  const overlay = document.getElementById(OVERLAY_ID);
  const block = document.getElementById(BLOCK_ID);

  if (badge) badge.remove();
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
  if (block && originalBodyContent !== null) {
    document.body.innerHTML = originalBodyContent;
    originalBodyContent = null;
  }
}

/**
 * Inject styles into the page
 */
function injectStyles(): void {
  if (document.getElementById(STYLES_ID)) return;

  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = getStyles();
  document.head.appendChild(style);
}

/**
 * Apply badge mode - non-intrusive corner indicator
 */
function applyBadgeMode(result: ClassificationResult): void {
  // Remove existing badge
  const existing = document.getElementById(BADGE_ID);
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = 'derigo-badge';

  const avgScore = (result.economic + result.social) / 2;
  const color = getScoreColor(avgScore);
  const truthIndicator = getTruthIndicator(result.truthScore);

  badge.innerHTML = `
    <div class="derigo-badge-icon" style="background: ${color}" title="Click to expand">
      D
    </div>
    <div class="derigo-badge-expanded">
      <div class="derigo-badge-header">
        <span>Derigo Analysis</span>
        <button class="derigo-badge-close" title="Close">×</button>
      </div>

      <div class="derigo-badge-radar">
        ${renderRadarChart(result)}
      </div>

      <div class="derigo-badge-axes">
        ${renderAxisMini('Economic', result.economic)}
        ${renderAxisMini('Social', result.social)}
        ${renderAxisMini('Authority', result.authority)}
        ${renderAxisMini('Globalism', result.globalism)}
      </div>

      <div class="derigo-badge-truth">
        <span class="derigo-truth-label">Truthfulness</span>
        <div class="derigo-truth-bar">
          <div class="derigo-truth-fill" style="width: ${result.truthScore}%"></div>
        </div>
        <span class="derigo-truth-score ${truthIndicator.class}">
          ${result.truthScore}% ${truthIndicator.icon}
        </span>
      </div>

      <div class="derigo-badge-confidence">
        Confidence: ${Math.round(result.confidence * 100)}%
      </div>
    </div>
  `;

  document.body.appendChild(badge);

  // Toggle expanded view on click
  const icon = badge.querySelector('.derigo-badge-icon');
  icon?.addEventListener('click', () => {
    badge.classList.toggle('derigo-badge-open');
  });

  // Close button
  const closeBtn = badge.querySelector('.derigo-badge-close');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    badge.classList.remove('derigo-badge-open');
  });
}

/**
 * Apply overlay mode - dismissible warning
 */
function applyOverlayMode(result: ClassificationResult, reason?: string): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'derigo-overlay';

  overlay.innerHTML = `
    <div class="derigo-overlay-backdrop"></div>
    <div class="derigo-overlay-modal">
      <div class="derigo-overlay-header">
        <span class="derigo-logo-small">Derigo</span>
        <span class="derigo-warning-icon">⚠️</span>
      </div>

      <div class="derigo-overlay-body">
        <h2>Content Warning</h2>
        <p>This content matches your filter criteria.</p>

        <div class="derigo-overlay-radar">
          ${renderRadarChart(result)}
        </div>

        ${renderClassificationCompact(result)}

        ${reason ? `
          <p class="derigo-filter-note">
            <strong>Triggered by:</strong> ${formatReason(reason)}
          </p>
        ` : ''}
      </div>

      <div class="derigo-overlay-actions">
        <button class="derigo-btn derigo-btn-primary" id="derigo-dismiss">
          I Understand, Continue
        </button>
        <button class="derigo-btn derigo-btn-link" id="derigo-always-allow">
          Always allow this site
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Dismiss button
  document.getElementById('derigo-dismiss')?.addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
    applyBadgeMode(result);
  });

  // Always allow button
  document.getElementById('derigo-always-allow')?.addEventListener('click', async () => {
    await addToWhitelist(window.location.hostname);
    overlay.remove();
    document.body.style.overflow = '';
  });
}

/**
 * Apply block mode - full page replacement
 */
function applyBlockMode(result: ClassificationResult, reason?: string): void {
  // Save original content
  if (originalBodyContent === null) {
    originalBodyContent = document.body.innerHTML;
  }

  document.body.innerHTML = `
    <div id="${BLOCK_ID}" class="derigo-block-screen">
      <div class="derigo-block-content">
        <div class="derigo-logo">Derigo</div>
        <h1>Content Blocked</h1>
        <p class="derigo-reason">
          This content was blocked based on your preferences.
        </p>

        <div class="derigo-block-radar">
          ${renderRadarChart(result)}
        </div>

        <div class="derigo-details">
          <h3>Classification Results:</h3>
          ${renderClassificationSummary(result)}
          ${reason ? `
            <p class="derigo-filter-reason">
              <strong>Blocked due to:</strong> ${formatReason(reason)}
            </p>
          ` : ''}
        </div>

        <div class="derigo-actions">
          <button class="derigo-btn derigo-btn-secondary" id="derigo-proceed">
            View Anyway
          </button>
          <button class="derigo-btn derigo-btn-primary" id="derigo-back">
            Go Back
          </button>
        </div>
      </div>
    </div>
  `;

  // Inject styles if they were lost
  injectStyles();

  // Proceed button
  document.getElementById('derigo-proceed')?.addEventListener('click', () => {
    if (originalBodyContent !== null) {
      document.body.innerHTML = originalBodyContent;
      originalBodyContent = null;
      injectStyles();
      applyBadgeMode(result);
    }
  });

  // Back button
  document.getElementById('derigo-back')?.addEventListener('click', () => {
    history.back();
  });
}

/**
 * Render a mini radar chart (SVG)
 */
function renderRadarChart(result: ClassificationResult): string {
  const size = 120;
  const center = size / 2;
  const radius = size / 2 - 10;

  // Convert scores (-100 to 100) to radius (0 to 1)
  const normalize = (score: number) => (score + 100) / 200;

  const economic = normalize(result.economic);
  const social = normalize(result.social);
  const authority = normalize(result.authority);
  const globalism = normalize(result.globalism);

  // Calculate points (4 axes at 90° intervals)
  const points = [
    { x: center, y: center - radius * authority },           // Top (authority)
    { x: center + radius * economic, y: center },            // Right (economic right)
    { x: center, y: center + radius * (1 - authority) },     // Bottom (libertarian)
    { x: center - radius * (1 - economic), y: center }       // Left (economic left)
  ];

  // Create polygon path
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // Background grid
  const gridLines = [0.25, 0.5, 0.75, 1].map(scale => {
    const r = radius * scale;
    return `<circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
  }).join('');

  // Axis lines
  const axisLines = `
    <line x1="${center}" y1="${center - radius}" x2="${center}" y2="${center + radius}" stroke="#d1d5db" stroke-width="1"/>
    <line x1="${center - radius}" y1="${center}" x2="${center + radius}" y2="${center}" stroke="#d1d5db" stroke-width="1"/>
  `;

  // Labels
  const labels = `
    <text x="${center}" y="8" text-anchor="middle" class="derigo-radar-label">Auth</text>
    <text x="${size - 2}" y="${center + 4}" text-anchor="end" class="derigo-radar-label">Right</text>
    <text x="${center}" y="${size - 2}" text-anchor="middle" class="derigo-radar-label">Lib</text>
    <text x="2" y="${center + 4}" text-anchor="start" class="derigo-radar-label">Left</text>
  `;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="derigo-radar-svg">
      ${gridLines}
      ${axisLines}
      <path d="${path}" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" stroke-width="2"/>
      ${labels}
    </svg>
  `;
}

/**
 * Render mini axis visualization
 */
function renderAxisMini(name: string, value: number): string {
  const position = ((value + 100) / 200) * 100;
  const label = formatAxisLabel(name.toLowerCase(), value);

  return `
    <div class="derigo-axis-mini">
      <span class="derigo-axis-name">${name}</span>
      <div class="derigo-axis-bar">
        <div class="derigo-axis-marker" style="left: ${position}%"></div>
      </div>
      <span class="derigo-axis-value">${label}</span>
    </div>
  `;
}

/**
 * Render compact classification display
 */
function renderClassificationCompact(result: ClassificationResult): string {
  const truthIndicator = getTruthIndicator(result.truthScore);

  return `
    <div class="derigo-classification-compact">
      <div class="derigo-axis-row">
        <span>Economic:</span>
        <span>${formatAxisLabel('economic', result.economic)} (${result.economic})</span>
      </div>
      <div class="derigo-axis-row">
        <span>Social:</span>
        <span>${formatAxisLabel('social', result.social)} (${result.social})</span>
      </div>
      <div class="derigo-axis-row">
        <span>Authority:</span>
        <span>${formatAxisLabel('authority', result.authority)} (${result.authority})</span>
      </div>
      <div class="derigo-axis-row">
        <span>Globalism:</span>
        <span>${formatAxisLabel('globalism', result.globalism)} (${result.globalism})</span>
      </div>
      <div class="derigo-axis-row derigo-truth-row">
        <span>Truthfulness:</span>
        <span class="${truthIndicator.class}">${result.truthScore}% - ${truthIndicator.label}</span>
      </div>
    </div>
  `;
}

/**
 * Render full classification summary
 */
function renderClassificationSummary(result: ClassificationResult): string {
  return renderClassificationCompact(result);
}

/**
 * Format filter reason for display
 */
function formatReason(reason: string): string {
  const labels: Record<string, string> = {
    economic: 'Economic alignment outside your preferred range',
    social: 'Social alignment outside your preferred range',
    authority: 'Authority alignment outside your preferred range',
    globalism: 'Globalism alignment outside your preferred range',
    truthfulness: 'Truthfulness score below your threshold'
  };
  return labels[reason] || reason;
}

/**
 * Get all styles for injected elements
 */
function getStyles(): string {
  return `
    /* Reset for injected elements */
    #${BADGE_ID},
    #${OVERLAY_ID},
    #${BLOCK_ID},
    #${BADGE_ID} *,
    #${OVERLAY_ID} *,
    #${BLOCK_ID} * {
      all: revert;
      box-sizing: border-box;
    }

    #${BADGE_ID},
    #${OVERLAY_ID},
    #${BLOCK_ID} {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
    }

    /* Badge styles */
    .derigo-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
    }

    .derigo-badge-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s;
    }

    .derigo-badge-icon:hover {
      transform: scale(1.1);
    }

    .derigo-badge-expanded {
      display: none;
      position: absolute;
      bottom: 54px;
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 16px;
      min-width: 260px;
    }

    .derigo-badge-open .derigo-badge-expanded {
      display: block;
    }

    .derigo-badge-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .derigo-badge-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      line-height: 1;
    }

    .derigo-badge-radar {
      display: flex;
      justify-content: center;
      margin-bottom: 12px;
    }

    .derigo-radar-svg {
      display: block;
    }

    .derigo-radar-label {
      font-size: 9px;
      fill: #666;
    }

    /* Axis visualization */
    .derigo-axis-mini {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
    }

    .derigo-axis-name {
      width: 70px;
      font-size: 12px;
      color: #666;
    }

    .derigo-axis-bar {
      flex: 1;
      height: 6px;
      background: linear-gradient(to right, #3b82f6, #e5e7eb 50%, #ef4444);
      border-radius: 3px;
      position: relative;
    }

    .derigo-axis-marker {
      position: absolute;
      top: -2px;
      width: 10px;
      height: 10px;
      background: #1f2937;
      border-radius: 50%;
      transform: translateX(-50%);
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .derigo-axis-value {
      width: 70px;
      font-size: 11px;
      color: #666;
      text-align: right;
    }

    /* Truth score */
    .derigo-badge-truth {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }

    .derigo-truth-label {
      font-size: 12px;
      color: #666;
    }

    .derigo-truth-bar {
      flex: 1;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .derigo-truth-fill {
      height: 100%;
      background: linear-gradient(to right, #ef4444, #f59e0b, #22c55e);
      transition: width 0.3s;
    }

    .derigo-truth-score {
      font-size: 12px;
      font-weight: 600;
    }

    .derigo-badge-confidence {
      margin-top: 8px;
      font-size: 11px;
      color: #999;
      text-align: center;
    }

    /* Truth score colors */
    .truth-high { color: #22c55e; }
    .truth-medium-high { color: #84cc16; }
    .truth-medium { color: #f59e0b; }
    .truth-low { color: #ef4444; }

    /* Overlay styles */
    .derigo-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .derigo-overlay-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
    }

    .derigo-overlay-modal {
      position: relative;
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 420px;
      margin: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .derigo-overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .derigo-logo-small {
      font-weight: 700;
      font-size: 18px;
      color: #3b82f6;
    }

    .derigo-warning-icon {
      font-size: 24px;
    }

    .derigo-overlay-body h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
    }

    .derigo-overlay-body p {
      margin: 0 0 16px 0;
      color: #666;
    }

    .derigo-overlay-radar {
      display: flex;
      justify-content: center;
      margin: 16px 0;
    }

    .derigo-classification-compact {
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      margin: 16px 0;
    }

    .derigo-axis-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
    }

    .derigo-truth-row {
      border-top: 1px solid #e5e7eb;
      margin-top: 8px;
      padding-top: 8px;
    }

    .derigo-filter-note {
      background: #fef3c7;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
    }

    .derigo-overlay-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 20px;
    }

    /* Block screen styles */
    .derigo-block-screen {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      z-index: 2147483647;
    }

    .derigo-block-content {
      text-align: center;
      max-width: 500px;
      padding: 40px;
    }

    .derigo-logo {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #60a5fa;
    }

    .derigo-block-content h1 {
      font-size: 28px;
      margin: 0 0 12px 0;
    }

    .derigo-block-content .derigo-reason {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 24px;
    }

    .derigo-block-radar {
      display: flex;
      justify-content: center;
      margin: 24px 0;
    }

    .derigo-block-radar .derigo-radar-label {
      fill: #94a3b8;
    }

    .derigo-details {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: left;
    }

    .derigo-details h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #94a3b8;
    }

    .derigo-details .derigo-classification-compact {
      background: rgba(255, 255, 255, 0.1);
    }

    .derigo-details .derigo-axis-row {
      color: #e2e8f0;
    }

    .derigo-filter-reason {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #fbbf24;
    }

    .derigo-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    /* Buttons */
    .derigo-btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .derigo-btn-primary {
      background: #3b82f6;
      color: white;
    }

    .derigo-btn-primary:hover {
      background: #2563eb;
    }

    .derigo-btn-secondary {
      background: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .derigo-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .derigo-btn-link {
      background: transparent;
      color: #3b82f6;
      padding: 8px;
    }

    .derigo-btn-link:hover {
      text-decoration: underline;
    }
  `;
}
