/**
 * Display modes for content filtering
 * - Badge: Non-intrusive corner indicator
 * - Overlay: Dismissible warning overlay
 * - Block: Full page block
 */

import type { FilterAction, UserPreferences, ClassificationResult, AuthorClassification } from '../types/index.js';
import {
  getScoreColor,
  getTruthIndicator,
  formatAxisLabel,
  getAuthenticityColor,
  getCoordinationColor,
  getIntentIndicator,
  formatFilterReason
} from '../lib/classifier.js';
import { getAuthenticityLabel, getCoordinationLabel, getAuthorIntentInfo } from '../lib/author-classifier.js';
import { createSiteProfile, getProfileForDomain } from '../lib/storage.js';

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

      <div class="derigo-badge-section">
        <div class="derigo-section-title">Content</div>
        <div class="derigo-badge-axes">
          ${renderAxisMini('Economic', result.economic)}
          ${renderAxisMini('Social', result.social)}
          ${renderAxisMini('Authority', result.authority)}
          ${renderAxisMini('Globalism', result.globalism)}
        </div>
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

      <div class="derigo-badge-section">
        <div class="derigo-section-title">Author</div>
        ${renderAuthorBadge(result.author)}
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

  // Always allow button - creates a profile with displayMode: 'disabled'
  document.getElementById('derigo-always-allow')?.addEventListener('click', async () => {
    const domain = window.location.hostname.replace(/^www\./, '');
    // Check if domain already has a profile
    const existingProfile = await getProfileForDomain(domain);
    if (!existingProfile) {
      await createSiteProfile({
        name: `Trusted: ${domain}`,
        description: 'Auto-created to skip analysis for this site',
        domains: [domain],
        overrides: {
          displayMode: 'disabled'
        }
      });
    }
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
 * Render a 7-axis radar chart (SVG)
 * Axes: Economic, Social, Authority, Globalism, Truth, Authenticity, Coordination
 */
function renderRadarChart(result: ClassificationResult): string {
  const size = 140;
  const center = size / 2;
  const radius = size / 2 - 20;

  // Define 7 axes with their properties
  const axes = [
    { name: 'Econ', value: result.economic, type: 'bipolar' },      // -100 to 100
    { name: 'Social', value: result.social, type: 'bipolar' },      // -100 to 100
    { name: 'Auth', value: result.authority, type: 'bipolar' },     // -100 to 100
    { name: 'Global', value: result.globalism, type: 'bipolar' },   // -100 to 100
    { name: 'Truth', value: result.truthScore, type: 'unipolar' },  // 0 to 100
    { name: 'Human', value: result.author?.authenticity ?? 50, type: 'unipolar' }, // 0 to 100
    { name: 'Organic', value: 100 - (result.author?.coordination ?? 0), type: 'unipolar' } // Inverted: 100 = organic
  ];

  const numAxes = axes.length;
  const angleStep = (2 * Math.PI) / numAxes;

  // Normalize values to 0-1 range
  const normalize = (value: number, type: string) => {
    if (type === 'bipolar') {
      return (value + 100) / 200;
    }
    return value / 100;
  };

  // Calculate points for the data polygon
  const dataPoints = axes.map((axis, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const normalizedValue = normalize(axis.value, axis.type);
    const r = radius * normalizedValue;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  });

  // Create data polygon path
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

  // Background grid (concentric polygons)
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPolygons = gridLevels.map(scale => {
    const gridPoints = axes.map((_, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const r = radius * scale;
      return `${(center + r * Math.cos(angle)).toFixed(1)},${(center + r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${gridPoints}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
  }).join('');

  // Axis lines from center to each vertex
  const axisLines = axes.map((_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x2 = center + radius * Math.cos(angle);
    const y2 = center + radius * Math.sin(angle);
    return `<line x1="${center}" y1="${center}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#d1d5db" stroke-width="1"/>`;
  }).join('');

  // Labels at each axis
  const labels = axes.map((axis, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const labelRadius = radius + 12;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);
    const anchor = Math.abs(angle) < 0.1 ? 'middle' :
                   angle > 0 && angle < Math.PI ? 'start' : 'end';
    const dy = angle > -0.1 && angle < 0.1 ? '-3' :
               angle > Math.PI - 0.1 || angle < -Math.PI + 0.1 ? '6' : '3';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dy="${dy}" class="derigo-radar-label">${axis.name}</text>`;
  }).join('');

  // Determine polygon fill color based on author data
  const hasAuthorData = result.author != null;
  const fillColor = hasAuthorData ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.3)';
  const strokeColor = hasAuthorData ? '#3b82f6' : '#3b82f6';

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="derigo-radar-svg">
      ${gridPolygons}
      ${axisLines}
      <path d="${dataPath}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
      ${labels}
    </svg>
  `;
}

/**
 * Render author badge with intent and scores
 */
function renderAuthorBadge(author: AuthorClassification | undefined): string {
  if (!author) {
    return `
      <div class="derigo-author-badge derigo-author-unknown">
        <span class="derigo-author-icon">?</span>
        <span class="derigo-author-label">Unknown Author</span>
      </div>
    `;
  }

  const intentInfo = getIntentIndicator(author.intent.primary);
  const authenticityColor = getAuthenticityColor(author.authenticity);
  const coordinationColor = getCoordinationColor(author.coordination);

  return `
    <div class="derigo-author-badge">
      <div class="derigo-author-header">
        <span class="derigo-author-icon" style="background: ${intentInfo.color}">${intentInfo.icon}</span>
        <span class="derigo-author-label">${intentInfo.label}</span>
        ${author.intent.confidence >= 0.7 ? '<span class="derigo-author-confidence">High confidence</span>' : ''}
      </div>
      <div class="derigo-author-scores">
        <div class="derigo-author-score">
          <span class="derigo-score-label">Authenticity</span>
          <div class="derigo-score-bar">
            <div class="derigo-score-fill" style="width: ${author.authenticity}%; background: ${authenticityColor}"></div>
          </div>
          <span class="derigo-score-value">${author.authenticity}%</span>
        </div>
        <div class="derigo-author-score">
          <span class="derigo-score-label">Coordination</span>
          <div class="derigo-score-bar">
            <div class="derigo-score-fill" style="width: ${author.coordination}%; background: ${coordinationColor}"></div>
          </div>
          <span class="derigo-score-value">${author.coordination}%</span>
        </div>
      </div>
      ${author.knownActor ? `
        <div class="derigo-known-actor">
          <span class="derigo-known-actor-badge">Known Actor</span>
          <span class="derigo-known-actor-source">${author.knownActor.source}</span>
        </div>
      ` : ''}
    </div>
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
      <div class="derigo-compact-section">
        <div class="derigo-compact-title">Content Analysis</div>
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

      ${result.author ? `
        <div class="derigo-compact-section">
          <div class="derigo-compact-title">Author Analysis</div>
          ${renderAuthorCompact(result.author)}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render compact author display
 */
function renderAuthorCompact(author: AuthorClassification): string {
  const intentInfo = getIntentIndicator(author.intent.primary);

  return `
    <div class="derigo-author-compact">
      <div class="derigo-axis-row">
        <span>Intent:</span>
        <span style="color: ${intentInfo.color}">${intentInfo.icon} ${intentInfo.label}</span>
      </div>
      <div class="derigo-axis-row">
        <span>Authenticity:</span>
        <span>${author.authenticity}% - ${getAuthenticityLabel(author.authenticity)}</span>
      </div>
      <div class="derigo-axis-row">
        <span>Coordination:</span>
        <span>${author.coordination}% - ${getCoordinationLabel(author.coordination)}</span>
      </div>
      ${author.knownActor ? `
        <div class="derigo-axis-row derigo-known-row">
          <span>Known Actor:</span>
          <span class="derigo-known-actor-inline">${author.knownActor.source}</span>
        </div>
      ` : ''}
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
 * Format filter reason for display (wrapper for classifier function)
 */
function formatReason(reason: string): string {
  // Use the centralized formatFilterReason from classifier
  // But cast to FilterReason type since we know these are valid reasons
  return formatFilterReason(reason as import('../types/index.js').FilterReason);
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

    /* Section styles */
    .derigo-badge-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }

    .derigo-section-title {
      font-size: 11px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    /* Author badge styles */
    .derigo-author-badge {
      background: #f9fafb;
      border-radius: 8px;
      padding: 10px;
    }

    .derigo-author-unknown {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #9ca3af;
    }

    .derigo-author-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .derigo-author-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
    }

    .derigo-author-unknown .derigo-author-icon {
      background: #9ca3af;
    }

    .derigo-author-label {
      font-weight: 500;
      font-size: 13px;
    }

    .derigo-author-confidence {
      font-size: 10px;
      color: #22c55e;
      background: #dcfce7;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .derigo-author-scores {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .derigo-author-score {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .derigo-score-label {
      font-size: 11px;
      color: #666;
      width: 70px;
    }

    .derigo-score-bar {
      flex: 1;
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
    }

    .derigo-score-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s;
    }

    .derigo-score-value {
      font-size: 11px;
      color: #666;
      width: 35px;
      text-align: right;
    }

    .derigo-known-actor {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .derigo-known-actor-badge {
      font-size: 10px;
      font-weight: 600;
      color: #dc2626;
      background: #fef2f2;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .derigo-known-actor-source {
      font-size: 11px;
      color: #666;
    }

    /* Compact section styles */
    .derigo-compact-section {
      margin-bottom: 12px;
    }

    .derigo-compact-section:last-child {
      margin-bottom: 0;
    }

    .derigo-compact-title {
      font-size: 11px;
      font-weight: 600;
      color: #666;
      margin-bottom: 6px;
    }

    .derigo-author-compact {
      /* Uses axis-row styles */
    }

    .derigo-known-row {
      border-top: 1px dashed #e5e7eb;
      margin-top: 4px;
      padding-top: 4px;
    }

    .derigo-known-actor-inline {
      color: #dc2626;
      font-size: 12px;
    }

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
