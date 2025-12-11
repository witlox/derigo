# Derigo - Political Content Classification Browser Extension

## Project Overview

Derigo is a browser extension (Chrome/Brave, with future Safari/iOS support) that analyzes web content for political alignment and truthfulness. Users can filter or block content based on their preferences, with configurable display options ranging from visual indicators to full blocking.

**Target Platforms (Priority Order):**
1. Chrome/Brave (Manifest V3) - Primary focus
2. Firefox - Secondary
3. Safari/iOS - Future phase

## Architecture

### Core Components

```
derigo/
├── extension/           # Browser extension source
│   ├── manifest.json    # Extension manifest (MV3)
│   ├── background.js    # Service worker
│   ├── content.js       # Content script (injected)
│   ├── popup/           # Extension popup UI
│   ├── options/         # Settings page
│   └── lib/             # Shared libraries
├── shared/              # Code shared across platforms
│   ├── classifier/      # Classification engine
│   ├── scoring/         # Scoring algorithms
│   └── types/           # TypeScript types
├── data/                # Classification data
│   ├── sources.json     # Source reputation database
│   └── keywords.json    # Keyword weights by category
└── scripts/             # Build and utility scripts
```

### Classification System

#### Political Alignment (Multi-dimensional)

The system uses multiple axes for nuanced classification:

1. **Economic Axis**: Left (collectivist) ↔ Right (free market)
2. **Social Axis**: Progressive ↔ Conservative
3. **Authority Axis**: Libertarian ↔ Authoritarian
4. **Globalism Axis**: Nationalist ↔ Globalist

Each piece of content receives scores on each axis (-100 to +100), allowing users to filter based on any combination.

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
   - Target: <50ms classification time

2. **Enhanced Path (Optional API)**:
   - AI analysis via Claude API for nuanced content
   - Fact-check API queries for specific claims
   - Only triggered for uncertain classifications or user request
   - Results cached to minimize API calls

3. **Caching Strategy**:
   - IndexedDB for classification results (keyed by URL hash)
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
  // Political filters (null = no filter)
  economicRange: [number, number] | null;  // [-100, 100]
  socialRange: [number, number] | null;
  authorityRange: [number, number] | null;
  globalismRange: [number, number] | null;

  // Truthfulness threshold
  minTruthScore: number;  // 0-100, content below this triggers action

  // Display behavior
  displayMode: 'block' | 'overlay' | 'badge' | 'off';

  // Performance
  enableEnhancedAnalysis: boolean;
  cacheRetentionDays: number;
}
```

### Display Modes

1. **Block**: Replace page content with block message
2. **Overlay**: Dismissible warning overlay (proceed button)
3. **Badge**: Color-coded indicator in corner, no blocking
4. **Off**: Classification only, no visual changes

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

### Fact-Check APIs (Future)

- **Google Fact Check Tools API**: Free, requires API key
- **ClaimBuster**: Academic API for claim detection
- **NewsGuard**: Commercial source ratings (requires license)

### AI Classification (Optional)

- Claude API for complex content analysis
- Rate-limited and cached aggressively
- User opt-in required (API key or service subscription)

## Security Considerations

- No sensitive data leaves browser without explicit consent
- API keys stored securely in Chrome Storage
- Content analysis happens locally by default
- CSP-compliant content script injection

## Current State

The project has a basic skeleton with:
- MV3 manifest structure
- Basic keyword scoring system
- SQLite database setup (needs migration to IndexedDB)
- Simple popup UI

### Migration Needed

The current implementation uses Node.js `sqlite3` which won't work in browser extensions. Migrate to:
- IndexedDB for structured data
- Chrome Storage API for settings
- Remove all Node.js dependencies from extension code

## Roadmap

### Phase 1: Core Extension
- [ ] Migrate from SQLite to IndexedDB
- [ ] Implement multi-dimensional scoring
- [ ] Build source reputation database
- [ ] Create configurable UI
- [ ] Add display mode options

### Phase 2: Enhanced Analysis
- [ ] Integrate fact-check APIs
- [ ] Add optional AI classification
- [ ] Implement caching layer
- [ ] Performance optimization

### Phase 3: Platform Expansion
- [ ] Firefox port
- [ ] Safari Web Extension
- [ ] iOS companion app

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
