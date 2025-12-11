# Derigo - Political Content & Author Classification Browser Extension

## Project Overview

Derigo is a browser extension (Chrome/Brave, with future Safari/iOS support) that performs dual analysis of web content:

1. **Content Classification**: Analyzes the political alignment and truthfulness of the content itself
2. **Author Classification**: Analyzes the authenticity and intent of content creators (detecting bots, trolls, state-sponsored actors, etc.)

Users can filter or block content based on either dimension, with results displayed in an integrated 7-axis radar chart visualization.

**Target Platforms (Priority Order):**
1. Chrome/Brave (Manifest V3) - Primary focus
2. Firefox - Secondary
3. Safari/iOS - Future phase

## Architecture

### Core Components

```
derigo/
├── src/                      # Source code
│   ├── manifest.json         # Extension manifest (MV3)
│   ├── background/           # Service worker
│   ├── content/              # Content scripts
│   │   ├── content.ts        # Main content script
│   │   ├── display.ts        # UI rendering
│   │   └── styles.css        # Injected styles
│   ├── popup/                # Extension popup UI
│   ├── options/              # Settings page
│   ├── lib/                  # Shared libraries
│   │   ├── classifier.ts     # Content classification
│   │   ├── author-classifier.ts  # Author analysis
│   │   ├── author-extractor.ts   # Author extraction
│   │   └── storage.ts        # Storage wrapper
│   ├── data/
│   │   └── known-actors.json # Known bad actors DB
│   └── types/                # TypeScript types
├── data/                     # Classification data
│   ├── sources.json          # Source reputation database
│   └── keywords.json         # Keyword weights by category
├── tests/                    # Test suite
│   ├── unit/                 # Unit tests
│   └── mocks/                # Chrome API mocks
└── scripts/                  # Build and utility scripts
```

### Classification System

#### Content Classification: Political Alignment (Multi-dimensional)

The system uses multiple axes for nuanced content classification:

1. **Economic Axis**: Left (collectivist) ↔ Right (free market)
2. **Social Axis**: Progressive ↔ Conservative
3. **Authority Axis**: Libertarian ↔ Authoritarian
4. **Globalism Axis**: Nationalist ↔ Globalist

Each piece of content receives scores on each axis (-100 to +100), allowing users to filter based on any combination.

#### Author Classification (New)

Analyzes the content creator across three dimensions:

5. **Authenticity Axis** (0-100): Bot ↔ Human
   - Detects automated/bot accounts vs genuine human authors
   - Uses posting patterns, content originality, account age

6. **Coordination Axis** (0-100): Organic ↔ Orchestrated
   - Independent content vs coordinated campaigns
   - Identifies coordinated inauthentic behavior

7. **Intent Classification** (Categorical):
   - **Organic**: Genuine personal/organizational expression
   - **Troll**: Provocative, disruptive intent
   - **Bot**: Automated spam/amplification
   - **State-sponsored**: Government-affiliated disinformation
   - **Commercial**: Marketing/promotional content
   - **Activist**: Organized advocacy campaigns

#### Truthfulness Scoring

Truthfulness is assessed via:

1. **Source Reputation Database**: Pre-scored credibility ratings for known domains
2. **Fact-Check API Integration**: Query external services (Google Fact Check, ClaimBuster)
3. **Cross-reference Signals**: Presence of citations, external links, claim verification

Truthfulness score: 0-100 scale
- 0-30: High misinformation risk
- 31-60: Mixed/unverified
- 61-80: Generally reliable
- 81-100: Highly credible/fact-checked

### Hybrid Classification Approach

For speed and minimal footprint:

1. **Fast Path (Local)**:
   - Keyword-based scoring with weighted terms
   - Domain/source reputation lookup (cached)
   - Pattern matching for known content types
   - Author heuristic analysis (posting patterns, content signals)
   - Known actor database lookup (bundled)
   - Target: <50ms classification time

2. **Enhanced Path (Optional API)**:
   - AI analysis via OpenAI/Anthropic/Google for nuanced content and author assessment
   - Fact-check API queries for specific claims
   - External author database lookups (Bot Sentinel, etc.)
   - Only triggered for uncertain classifications or user request
   - Results cached to minimize API calls

3. **Caching Strategy**:
   - IndexedDB for classification results (keyed by URL hash)
   - Author cache by identifier (keyed by username/platform)
   - Source reputation cached for 24 hours
   - User settings synced via Chrome Storage API

## Technical Specifications

### Content Script Behavior

```javascript
// Classification flow
1. Page loads → content.js injected
2. Extract text content (throttled, incremental)
3. Fast local classification
4. Apply user preferences (block/warn/badge)
5. Cache result
6. Optional: background enhanced analysis
```

### Data Storage

- **IndexedDB**: Classification cache, source database, keyword weights
- **Chrome Storage Sync**: User preferences, blocked categories, display settings
- **Chrome Storage Local**: Large caches, temporary data

### User Preferences Schema

```typescript
interface UserPreferences {
  // Content filters (null = no filter)
  economicRange: [number, number] | null;  // [-100, 100]
  socialRange: [number, number] | null;
  authorityRange: [number, number] | null;
  globalismRange: [number, number] | null;

  // Truthfulness threshold
  minTruthScore: number;  // 0-100, content below this triggers action

  // Author filters (new)
  minAuthenticity: number;        // 0-100, filter authors below this
  maxCoordination: number;        // 0-100, filter authors above this
  blockedIntents: AuthorIntent[]; // Block specific author types

  // Display behavior
  displayMode: 'block' | 'overlay' | 'badge' | 'off';

  // Performance
  enableEnhancedAnalysis: boolean;
  cacheRetentionDays: number;
}

type AuthorIntent = 'organic' | 'troll' | 'bot' | 'stateSponsored' | 'commercial' | 'activist';
```

### Display Modes

1. **Block**: Replace page content with block message
2. **Overlay**: Dismissible warning overlay (proceed button)
3. **Badge**: Color-coded indicator in corner, no blocking
4. **Off**: Classification only, no visual changes

### Visualization

All classification results are displayed in a **7-axis radar chart**:
- Economic, Social, Authority, Globalism (content axes)
- Authenticity, Coordination (author axes, inverted for display)
- Truthfulness (quality axis)

Author intent is shown as a categorical badge with confidence indicator.

## Development Guidelines

### Code Style

- TypeScript for all new code
- ESLint with recommended config
- Prettier for formatting
- No external runtime dependencies in content scripts (bundle everything)

### Performance Requirements

- Content script bundle: <100KB
- Classification time: <50ms for local path
- Memory footprint: <50MB
- No blocking of page render

### Testing

- Unit tests for classification logic
- Integration tests for extension APIs
- Manual testing on major news sites

### Build Process

```bash
npm run build      # Production build
npm run dev        # Development with watch
npm run test       # Run test suite
npm run package    # Create distributable .zip
```

## API Integrations

**IMPORTANT**: All external API integrations are DISABLED by default.

### Fact-Check APIs (Optional)

- **Google Fact Check Tools API**: Free, requires API key
- **ClaimBuster**: Academic API for claim detection
- **NewsGuard**: Commercial source ratings (requires license)

### AI Classification (Optional)

- OpenAI, Anthropic, or Google AI for complex content/author analysis
- Rate-limited and cached aggressively
- User opt-in required (API key)

### Author Database APIs (Optional, New)

- **Bot Sentinel**: Bot/troll account detection
- **Hamilton 68 / ASD**: State-sponsored actor tracking
- **Bundled database**: Known actors list ships with extension (no API needed)

## Security Considerations

- No sensitive data leaves browser without explicit consent
- API keys stored securely in Chrome Storage
- Content analysis happens locally by default
- CSP-compliant content script injection

## Current State

The project is fully functional with:
- Complete MV3 manifest structure
- Multi-dimensional keyword scoring system (4 political axes)
- Author classification system (authenticity, coordination, intent detection)
- IndexedDB storage with Chrome Storage API for settings
- Display modes (badge, overlay, block)
- Popup and options UI
- Site profiles for per-domain customization
- Known actors database (bundled)
- Comprehensive test suite

### Architecture

```
src/
├── background/          # Service worker
├── content/             # Content scripts (content.ts, display.ts)
├── popup/               # Toolbar popup UI
├── options/             # Settings page
├── lib/                 # Shared libraries
│   ├── classifier.ts    # Content classification engine
│   ├── author-classifier.ts   # Author analysis
│   ├── author-extractor.ts    # Author extraction from pages
│   ├── extractor.ts     # Content extraction
│   └── storage.ts       # Chrome storage wrapper
├── data/
│   └── known-actors.json # Known bots/trolls/state actors
└── types/               # TypeScript definitions
```

## Roadmap

### Phase 1: Core Extension ✅
- [x] Migrate from SQLite to IndexedDB
- [x] Implement multi-dimensional scoring
- [x] Build source reputation database
- [x] Create configurable UI
- [x] Add display mode options
- [x] Author classification system
- [x] 7-axis radar chart visualization
- [x] Known actor database
- [x] Site profiles for per-domain customization

### Phase 2: Enhanced Analysis (In Progress)
- [ ] Integrate fact-check APIs
- [ ] Add optional AI classification
- [x] Implement caching layer
- [ ] Bot Sentinel integration
- [ ] Performance optimization

### Phase 3: Platform Expansion
- [ ] Firefox port
- [ ] Safari Web Extension
- [ ] iOS companion app
- [ ] Community source ratings
- [ ] Browser history analysis

## Commands Reference

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev build with watch
npm run lint         # Run linter
npm run test         # Run tests

# Production
npm run build        # Create production build
npm run package      # Create extension package

# Utilities
npm run update-sources  # Update source reputation DB
npm run stats           # Show classification statistics
```
