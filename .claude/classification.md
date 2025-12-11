# Classification System Architecture

## Multi-Dimensional Political Scoring

### Axis Definitions

#### 1. Economic Axis (-100 to +100)
- **-100 (Far Left)**: Full collectivism, state ownership, wealth redistribution
- **0 (Center)**: Mixed economy, regulated markets
- **+100 (Far Right)**: Pure free market, minimal regulation, privatization

**Keywords/Signals**:
- Left indicators: "nationalize", "workers' rights", "universal basic income", "wealth tax", "collective ownership"
- Right indicators: "deregulation", "tax cuts", "free enterprise", "privatization", "market freedom"

#### 2. Social Axis (-100 to +100)
- **-100 (Progressive)**: Social change, equality focus, reform
- **0 (Moderate)**: Balanced tradition and progress
- **+100 (Conservative)**: Traditional values, social stability, heritage

**Keywords/Signals**:
- Progressive: "equality", "reform", "rights", "diversity", "inclusion", "change"
- Conservative: "tradition", "family values", "heritage", "stability", "moral"

#### 3. Authority Axis (-100 to +100)
- **-100 (Libertarian)**: Individual freedom, minimal state
- **0 (Moderate)**: Balanced governance
- **+100 (Authoritarian)**: Strong state, order, security focus

**Keywords/Signals**:
- Libertarian: "freedom", "liberty", "individual rights", "privacy", "autonomy"
- Authoritarian: "law and order", "national security", "control", "mandate", "enforce"

#### 4. Globalism Axis (-100 to +100)
- **-100 (Nationalist)**: National sovereignty, borders, local focus
- **0 (Moderate)**: Balanced international cooperation
- **+100 (Globalist)**: International cooperation, open borders, multilateralism

**Keywords/Signals**:
- Nationalist: "sovereignty", "borders", "domestic", "national interest", "patriot"
- Globalist: "international", "cooperation", "global", "multilateral", "united nations"

## Scoring Algorithm

### Fast Local Classification

```typescript
interface ClassificationResult {
  economic: number;      // -100 to +100
  social: number;        // -100 to +100
  authority: number;     // -100 to +100
  globalism: number;     // -100 to +100
  truthScore: number;    // 0 to 100
  confidence: number;    // 0 to 1
  source: 'local' | 'enhanced';
}

function classifyContent(text: string, url: string): ClassificationResult {
  // 1. Source-based scoring (fast lookup)
  const sourceScore = lookupSourceReputation(getDomain(url));

  // 2. Keyword analysis
  const keywordScores = analyzeKeywords(text);

  // 3. Pattern matching
  const patternScores = matchPatterns(text);

  // 4. Combine scores with weights
  return combineScores(sourceScore, keywordScores, patternScores);
}
```

### Keyword Weight Schema

```typescript
interface KeywordEntry {
  term: string;
  axis: 'economic' | 'social' | 'authority' | 'globalism';
  direction: number;     // -1 (left/progressive/lib/nationalist) or +1
  weight: number;        // 1-10 strength
  context?: string[];    // Required context words (optional)
}
```

### Confidence Calculation

Confidence is based on:
1. **Signal strength**: How many keywords/patterns matched
2. **Signal consistency**: Agreement between different signals
3. **Source reliability**: Known vs unknown sources
4. **Content length**: More content = higher confidence

```typescript
function calculateConfidence(signals: Signal[]): number {
  const signalCount = signals.length;
  const consistency = calculateConsistency(signals);
  const sourceWeight = getSourceWeight(signals);

  return Math.min(1, (signalCount * 0.1 + consistency * 0.5 + sourceWeight * 0.4));
}
```

## Truthfulness Assessment

### Source Reputation Database

Each known source has:
```typescript
interface SourceReputation {
  domain: string;
  factualRating: number;      // 0-100
  biasProfile: {
    economic: number;
    social: number;
    authority: number;
    globalism: number;
  };
  lastUpdated: Date;
  sources: string[];          // Where rating came from
}
```

### Fact-Check Integration

When enhanced analysis is enabled:

1. **Extract claims**: Identify factual claims in text
2. **Query fact-checkers**: Check against known debunked/verified claims
3. **Cross-reference**: Look for claim in multiple sources
4. **Aggregate score**: Combine all signals

### Truthfulness Signals

- Citation presence and quality
- Source reputation score
- Fact-check API results
- Emotional language density (high = lower truth score)
- Clickbait patterns (lower truth score)
- Date recency of claims

## Performance Optimization

### Incremental Analysis

Don't analyze entire page at once:
1. Analyze visible viewport first
2. Queue below-fold content
3. Skip non-content areas (nav, footer, ads)

### Caching Strategy

```typescript
interface CacheEntry {
  urlHash: string;
  result: ClassificationResult;
  timestamp: Date;
  contentHash: string;  // Detect content changes
}

// Cache invalidation
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DYNAMIC_CONTENT_TTL = 60 * 60 * 1000; // 1 hour for social media
```

### Efficient Text Extraction

```typescript
function extractRelevantText(document: Document): string {
  // Priority areas
  const selectors = [
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    'main'
  ];

  // Skip areas
  const skipSelectors = [
    'nav', 'footer', 'aside', '.ad', '.advertisement',
    '.sidebar', '.comments', 'script', 'style'
  ];

  // Extract and normalize
  return extractAndNormalize(document, selectors, skipSelectors);
}
```

## User Filtering Logic

```typescript
function shouldFilter(
  result: ClassificationResult,
  prefs: UserPreferences
): FilterAction {
  // Check each axis against user preferences
  if (prefs.economicRange && !inRange(result.economic, prefs.economicRange)) {
    return { action: prefs.displayMode, reason: 'economic' };
  }

  if (prefs.socialRange && !inRange(result.social, prefs.socialRange)) {
    return { action: prefs.displayMode, reason: 'social' };
  }

  // ... check other axes

  // Check truthfulness
  if (result.truthScore < prefs.minTruthScore) {
    return { action: prefs.displayMode, reason: 'truthfulness' };
  }

  return { action: 'none' };
}
```
