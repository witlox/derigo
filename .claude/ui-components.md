# UI Components and Display Modes

## Overview

The UI displays classification results in a unified **7-axis radar chart** combining:
- **Content axes** (4): Economic, Social, Authority, Globalism
- **Author axes** (2): Authenticity, Coordination (inverted)
- **Quality axis** (1): Truthfulness

Author intent is displayed as a categorical badge alongside the radar chart.

---

## Display Mode Implementations

### 1. Block Mode

Completely replaces page content when content is filtered.

```javascript
function applyBlockMode(result, reason) {
  // Save original content for potential restoration
  const originalContent = document.body.innerHTML;

  document.body.innerHTML = `
    <div class="derigo-block-screen">
      <div class="derigo-block-content">
        <div class="derigo-logo">Derigo</div>
        <h1>Content Blocked</h1>
        <p class="derigo-reason">
          This content was blocked based on your preferences.
        </p>

        <div class="derigo-details">
          <h3>Classification Results:</h3>
          ${renderRadarChart(result)}
          ${renderAuthorBadge(result.author)}
          <p class="derigo-filter-reason">
            <strong>Blocked due to:</strong> ${formatReason(reason)}
          </p>
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

  // Handle actions
  document.getElementById('derigo-proceed').onclick = () => {
    document.body.innerHTML = originalContent;
    // Add warning badge instead
    injectWarningBadge(result);
  };

  document.getElementById('derigo-back').onclick = () => {
    history.back();
  };
}
```

### 2. Overlay Mode

Shows dismissible warning overlay while keeping content visible beneath.

```javascript
function applyOverlayMode(result, reason) {
  const overlay = document.createElement('div');
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
        <p>This content matches your filter criteria:</p>

        ${renderRadarChartCompact(result)}
        ${renderAuthorBadge(result.author)}

        <p class="derigo-filter-note">
          <strong>Triggered by:</strong> ${formatReason(reason)}
        </p>
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

  // Prevent scrolling while overlay is visible
  document.body.style.overflow = 'hidden';

  document.getElementById('derigo-dismiss').onclick = () => {
    overlay.remove();
    document.body.style.overflow = '';
    injectBadge(result); // Show badge after dismissing
  };

  document.getElementById('derigo-always-allow').onclick = async () => {
    await addToWhitelist(window.location.hostname);
    overlay.remove();
    document.body.style.overflow = '';
  };
}
```

### 3. Badge Mode

Non-intrusive indicator showing classification at a glance.

```javascript
function applyBadgeMode(result) {
  const badge = document.createElement('div');
  badge.className = 'derigo-badge';
  badge.setAttribute('data-position', 'bottom-right'); // Configurable

  // Color based on combined score and author status
  const color = getBadgeColor(result);
  const authorIndicator = getAuthorIndicator(result.author);

  badge.innerHTML = `
    <div class="derigo-badge-icon" style="background: ${color}">
      D
      ${authorIndicator.warning ? '<span class="derigo-author-warning">!</span>' : ''}
    </div>
    <div class="derigo-badge-expanded">
      <div class="derigo-badge-header">
        <span>Derigo Analysis</span>
        <button class="derigo-badge-close">×</button>
      </div>

      <!-- 7-axis Radar Chart -->
      <div class="derigo-radar-container">
        ${renderRadarChart(result)}
      </div>

      <!-- Author Intent Badge -->
      <div class="derigo-author-section">
        ${renderAuthorBadge(result.author)}
      </div>

      <div class="derigo-badge-confidence">
        Confidence: ${Math.round(result.confidence * 100)}%
      </div>
    </div>
  `;

  document.body.appendChild(badge);

  // Toggle expanded view on click
  badge.querySelector('.derigo-badge-icon').onclick = () => {
    badge.classList.toggle('derigo-badge-open');
  };

  badge.querySelector('.derigo-badge-close').onclick = (e) => {
    e.stopPropagation();
    badge.classList.remove('derigo-badge-open');
  };
}

function getAuthorIndicator(author) {
  // Warning if author is suspicious
  const warning = author.authenticity < 40 ||
                  author.coordination > 60 ||
                  ['bot', 'troll', 'stateSponsored'].includes(author.intent.primary);

  return { warning };
}
```

---

## 7-Axis Radar Chart

The radar chart visualizes all classification dimensions in a unified display.

### Radar Chart Rendering

```javascript
function renderRadarChart(result) {
  const size = 200;
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // 7 axes at equal angles (360/7 ≈ 51.4° apart)
  const axes = [
    { name: 'Economic', value: normalizeScore(result.content.economic), color: '#3b82f6' },
    { name: 'Social', value: normalizeScore(result.content.social), color: '#8b5cf6' },
    { name: 'Authority', value: normalizeScore(result.content.authority), color: '#ec4899' },
    { name: 'Globalism', value: normalizeScore(result.content.globalism), color: '#f59e0b' },
    { name: 'Authenticity', value: result.author.authenticity, color: '#10b981' },
    { name: 'Organic', value: 100 - result.author.coordination, color: '#06b6d4' }, // Inverted
    { name: 'Truth', value: result.content.truthScore, color: '#22c55e' }
  ];

  const angleStep = (2 * Math.PI) / axes.length;

  // Calculate points for the polygon
  const points = axes.map((axis, i) => {
    const angle = i * angleStep - Math.PI / 2; // Start from top
    const radius = (axis.value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Generate axis lines and labels
  const axisLines = axes.map((axis, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const endX = center + maxRadius * Math.cos(angle);
    const endY = center + maxRadius * Math.sin(angle);
    const labelX = center + (maxRadius + 15) * Math.cos(angle);
    const labelY = center + (maxRadius + 15) * Math.sin(angle);

    return `
      <line x1="${center}" y1="${center}" x2="${endX}" y2="${endY}"
            stroke="#e5e7eb" stroke-width="1"/>
      <text x="${labelX}" y="${labelY}" text-anchor="middle"
            dominant-baseline="middle" font-size="9" fill="#6b7280">
        ${axis.name.substring(0, 4)}
      </text>
    `;
  }).join('');

  // Generate concentric circles (25%, 50%, 75%, 100%)
  const circles = [0.25, 0.5, 0.75, 1].map(pct => `
    <circle cx="${center}" cy="${center}" r="${maxRadius * pct}"
            fill="none" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="2,2"/>
  `).join('');

  return `
    <svg width="${size}" height="${size}" class="derigo-radar-chart">
      ${circles}
      ${axisLines}
      <polygon points="${polygonPoints}"
               fill="rgba(59, 130, 246, 0.2)"
               stroke="#3b82f6" stroke-width="2"/>
      ${points.map((p, i) => `
        <circle cx="${p.x}" cy="${p.y}" r="4"
                fill="${axes[i].color}" stroke="white" stroke-width="1"/>
      `).join('')}
    </svg>
  `;
}

function normalizeScore(score) {
  // Convert -100..100 to 0..100 for radar display
  return (score + 100) / 2;
}

function renderRadarChartCompact(result) {
  // Smaller version for overlay/inline display
  // Same logic, just smaller size (120px)
  // ... implementation similar but scaled down
}
```

### Author Badge Rendering

```javascript
function renderAuthorBadge(author) {
  const intentConfig = {
    organic: { label: 'Organic', color: '#22c55e', icon: '✓' },
    troll: { label: 'Troll', color: '#ef4444', icon: '🔥' },
    bot: { label: 'Bot', color: '#f59e0b', icon: '🤖' },
    stateSponsored: { label: 'State-Sponsored', color: '#dc2626', icon: '🏛️' },
    commercial: { label: 'Commercial', color: '#8b5cf6', icon: '💰' },
    activist: { label: 'Activist', color: '#3b82f6', icon: '📢' }
  };

  const config = intentConfig[author.intent.primary];
  const confidencePercent = Math.round(author.intent.confidence * 100);

  const authenticityLabel = author.authenticity < 40 ? 'Suspicious' :
                           author.authenticity < 70 ? 'Unclear' : 'Human';

  return `
    <div class="derigo-author-badge">
      <div class="derigo-author-intent" style="background: ${config.color}">
        <span class="derigo-intent-icon">${config.icon}</span>
        <span class="derigo-intent-label">${config.label}</span>
        <span class="derigo-intent-confidence">${confidencePercent}%</span>
      </div>
      <div class="derigo-author-metrics">
        <span class="derigo-authenticity ${authenticityLabel.toLowerCase()}">
          ${authenticityLabel} (${author.authenticity}%)
        </span>
        <span class="derigo-data-quality">
          Data: ${author.dataQuality}
        </span>
      </div>
      ${author.authorId ? `
        <div class="derigo-author-id">
          @${author.authorId}
        </div>
      ` : ''}
    </div>
  `;
}
```

---

## CSS Styles

```css
/* Injected styles - content/styles.css */

/* Reset for injected elements */
.derigo-badge,
.derigo-overlay,
.derigo-block-screen {
  all: initial;
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
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
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
  bottom: 50px;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  min-width: 220px;
}

.derigo-badge-open .derigo-badge-expanded {
  display: block;
}

/* Axis visualization */
.derigo-axis-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.derigo-axis-name {
  width: 70px;
  font-size: 11px;
  color: #666;
}

.derigo-axis-bar {
  flex: 1;
  height: 4px;
  background: linear-gradient(to right, #3b82f6, #e5e7eb, #ef4444);
  border-radius: 2px;
  position: relative;
}

.derigo-axis-marker {
  position: absolute;
  top: -3px;
  width: 10px;
  height: 10px;
  background: #333;
  border-radius: 50%;
  transform: translateX(-50%);
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
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  margin: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
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
}

.derigo-block-content {
  text-align: center;
  max-width: 500px;
  padding: 40px;
}

.derigo-logo {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 20px;
}

/* Buttons */
.derigo-btn {
  padding: 10px 20px;
  border-radius: 6px;
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

/* Truth score colors */
.derigo-truth-high { color: #22c55e; }
.derigo-truth-medium { color: #f59e0b; }
.derigo-truth-low { color: #ef4444; }

/* Radar chart styles */
.derigo-radar-container {
  display: flex;
  justify-content: center;
  padding: 8px;
}

.derigo-radar-chart {
  max-width: 100%;
  height: auto;
}

/* Author badge styles */
.derigo-author-badge {
  margin-top: 12px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 8px;
}

.derigo-author-intent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 16px;
  color: white;
  font-size: 12px;
  font-weight: 500;
}

.derigo-intent-icon {
  font-size: 14px;
}

.derigo-intent-confidence {
  opacity: 0.8;
  font-size: 11px;
}

.derigo-author-metrics {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: #6b7280;
}

.derigo-authenticity.suspicious { color: #ef4444; }
.derigo-authenticity.unclear { color: #f59e0b; }
.derigo-authenticity.human { color: #22c55e; }

.derigo-author-id {
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
}

/* Author warning indicator on badge icon */
.derigo-author-warning {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.derigo-badge-icon {
  position: relative;
}
```

## Popup UI Design

```html
<!-- popup/popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup">
    <!-- Header -->
    <header class="popup-header">
      <h1 class="popup-title">Derigo</h1>
      <div class="popup-status" id="status">
        <span class="status-dot"></span>
        <span class="status-text">Active</span>
      </div>
    </header>

    <!-- Current Page Analysis -->
    <section class="popup-section" id="analysis-section">
      <h2>Current Page</h2>
      <div class="analysis-loading" id="loading">
        Analyzing...
      </div>

      <div class="analysis-results" id="results" style="display: none;">
        <!-- Political Compass Mini -->
        <div class="compass-mini">
          <div class="compass-grid">
            <div class="compass-marker" id="compass-marker"></div>
          </div>
          <div class="compass-labels">
            <span class="label-left">Left</span>
            <span class="label-right">Right</span>
            <span class="label-lib">Lib</span>
            <span class="label-auth">Auth</span>
          </div>
        </div>

        <!-- Axis Bars -->
        <div class="axis-list">
          <div class="axis-row">
            <span class="axis-label">Economic</span>
            <div class="axis-bar" id="axis-economic"></div>
          </div>
          <div class="axis-row">
            <span class="axis-label">Social</span>
            <div class="axis-bar" id="axis-social"></div>
          </div>
          <div class="axis-row">
            <span class="axis-label">Globalism</span>
            <div class="axis-bar" id="axis-globalism"></div>
          </div>
        </div>

        <!-- Truth Score -->
        <div class="truth-meter">
          <span class="truth-label">Truthfulness</span>
          <div class="truth-bar">
            <div class="truth-fill" id="truth-fill"></div>
          </div>
          <span class="truth-value" id="truth-value">--</span>
        </div>

        <!-- Confidence -->
        <div class="confidence">
          <span>Analysis confidence: </span>
          <span id="confidence-value">--</span>
        </div>
      </div>
    </section>

    <!-- Quick Toggles -->
    <section class="popup-section">
      <h2>Quick Settings</h2>
      <div class="toggle-group">
        <label class="toggle">
          <input type="checkbox" id="toggle-enabled">
          <span class="toggle-slider"></span>
          <span class="toggle-label">Extension enabled</span>
        </label>
        <label class="toggle">
          <input type="checkbox" id="toggle-enhanced">
          <span class="toggle-slider"></span>
          <span class="toggle-label">Enhanced analysis</span>
        </label>
      </div>

      <div class="display-mode">
        <span>Display mode:</span>
        <select id="display-mode">
          <option value="badge">Badge</option>
          <option value="overlay">Overlay</option>
          <option value="block">Block</option>
          <option value="off">Off</option>
        </select>
      </div>
    </section>

    <!-- Footer -->
    <footer class="popup-footer">
      <a href="#" id="open-options">Full Settings</a>
      <span class="version">v1.0.0</span>
    </footer>
  </div>

  <script src="popup.js" type="module"></script>
</body>
</html>
```

## Options Page Design

Full settings page with:

### Content Filters
- Filter range sliders for each axis (Economic, Social, Authority, Globalism)
- Truthfulness threshold slider

### Author Filters (New)
- Minimum authenticity threshold slider (0-100)
- Maximum coordination threshold slider (0-100)
- Author intent blocklist checkboxes:
  - [ ] Block Bots
  - [ ] Block Trolls
  - [ ] Block State-sponsored
  - [ ] Block Commercial/Spam
  - [ ] Block Activist accounts

### Display Settings
- Display mode selection (Block/Overlay/Badge/Off)
- Badge position (corner selection)

### Data Management
- Site whitelist management
- API key configuration
- Import/export settings
- Clear cache, reset to defaults

## Accessibility Considerations

- All interactive elements keyboard accessible
- Sufficient color contrast (WCAG AA)
- Screen reader support with ARIA labels
- Reduced motion option
- Focus indicators visible
