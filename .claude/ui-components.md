# UI Components and Display Modes

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
          ${renderClassificationSummary(result)}
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

        ${renderClassificationCompact(result)}

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

  // Color based on combined score
  const color = getScoreColor(result);
  const truthIndicator = getTruthIndicator(result.truthScore);

  badge.innerHTML = `
    <div class="derigo-badge-icon" style="background: ${color}">
      D
    </div>
    <div class="derigo-badge-expanded">
      <div class="derigo-badge-header">
        <span>Derigo Analysis</span>
        <button class="derigo-badge-close">×</button>
      </div>

      <div class="derigo-badge-axes">
        ${renderAxisMini('Economic', result.economic)}
        ${renderAxisMini('Social', result.social)}
        ${renderAxisMini('Authority', result.authority)}
        ${renderAxisMini('Globalism', result.globalism)}
      </div>

      <div class="derigo-badge-truth">
        <span class="derigo-truth-label">Truthfulness</span>
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
  badge.querySelector('.derigo-badge-icon').onclick = () => {
    badge.classList.toggle('derigo-badge-open');
  };

  badge.querySelector('.derigo-badge-close').onclick = (e) => {
    e.stopPropagation();
    badge.classList.remove('derigo-badge-open');
  };
}

function renderAxisMini(name, value) {
  const position = ((value + 100) / 200) * 100; // Convert -100..100 to 0..100
  const label = value < -33 ? 'L' : value > 33 ? 'R' : 'C';

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
```

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
- Filter range sliders for each axis
- Truthfulness threshold slider
- Display mode selection
- Site whitelist management
- API key configuration
- Import/export settings
- Data management (clear cache, reset)

## Accessibility Considerations

- All interactive elements keyboard accessible
- Sufficient color contrast (WCAG AA)
- Screen reader support with ARIA labels
- Reduced motion option
- Focus indicators visible
