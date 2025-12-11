# Classification System Architecture

## Overview

Derigo performs two parallel classification analyses:
1. **Content Classification**: Political alignment and truthfulness of the content itself
2. **Author Classification**: Authenticity and intent of the content creator

Both classifications contribute to an integrated 7-axis radar chart visualization.

---

## Part 1: Content Classification

### Multi-Dimensional Political Scoring

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

---

## Part 2: Author Classification

Author classification analyzes WHO created the content, complementing the content analysis which focuses on WHAT is being said.

### Author Classification Axes

#### 5. Authenticity Axis (0 to 100)
- **0-20 (Bot-like)**: High probability of automated/bot account
- **21-40 (Suspicious)**: Exhibits some inauthentic behavior patterns
- **41-60 (Unknown)**: Insufficient data to determine
- **61-80 (Likely Human)**: Shows human-typical behavior patterns
- **81-100 (Verified Human)**: Known human author or verified account

**Detection Signals**:
- Posting frequency and timing patterns (bots often post at regular intervals)
- Content originality vs copy-paste behavior
- Account age and activity consistency
- Follower/following ratios
- Profile completeness
- Response patterns (engagement with replies)

#### 6. Coordination Axis (0 to 100)
- **0-20 (Organic)**: Independent, original content creation
- **21-40 (Influenced)**: May share coordinated messaging
- **41-60 (Aligned)**: Consistent alignment with coordinated narratives
- **61-80 (Coordinated)**: Part of coordinated messaging campaigns
- **81-100 (Orchestrated)**: Central node in coordinated inauthentic behavior

**Detection Signals**:
- Hashtag coordination patterns
- Timing alignment with other accounts
- Identical or near-identical content across accounts
- Network analysis (if data available)
- Known campaign participation

#### 7. Intent Axis (Categorical + Score)

Primary categories with confidence scores:

| Category | Description | Score Range |
|----------|-------------|-------------|
| **Organic** | Genuine personal/organizational expression | Confidence 0-100 |
| **Troll** | Provocative, disruptive, inflammatory intent | Confidence 0-100 |
| **Bot** | Automated account (spam, amplification) | Confidence 0-100 |
| **State-sponsored** | Government-affiliated disinformation | Confidence 0-100 |
| **Commercial** | Marketing, spam, promotional content | Confidence 0-100 |
| **Activist** | Organized advocacy (not necessarily bad) | Confidence 0-100 |

The highest-confidence category is used for filtering, with the confidence score displayed.

### Author Data Structure

```typescript
interface AuthorClassification {
  // Core metrics (0-100 scale)
  authenticity: number;        // Bot ← → Human
  coordination: number;        // Organic ← → Orchestrated

  // Categorical intent with confidences
  intent: {
    primary: AuthorIntent;     // Most likely category
    confidence: number;        // 0-1 confidence in primary
    breakdown: {               // Probability distribution
      organic: number;
      troll: number;
      bot: number;
      stateSponsored: number;
      commercial: number;
      activist: number;
    };
  };

  // Metadata
  authorId?: string;           // Extracted identifier (username, byline)
  platform?: string;           // twitter, reddit, article, etc.
  knownActor?: KnownActorEntry; // Match from database if found
  signals: AuthorSignal[];     // Evidence used for classification
  dataQuality: 'high' | 'medium' | 'low' | 'minimal';
}

type AuthorIntent = 'organic' | 'troll' | 'bot' | 'stateSponsored' | 'commercial' | 'activist';

interface AuthorSignal {
  type: string;
  value: number | string | boolean;
  weight: number;
  direction: 'authentic' | 'suspicious' | 'neutral';
}
```

### Author Detection Algorithm

#### Phase 1: Author Extraction

```typescript
interface ExtractedAuthor {
  identifier: string;          // Username, byline, or unique ID
  displayName?: string;
  platform: 'twitter' | 'reddit' | 'facebook' | 'article' | 'comment' | 'unknown';
  profileUrl?: string;
  metadata: Record<string, any>; // Platform-specific data
}

function extractAuthor(document: Document, url: string): ExtractedAuthor | null {
  // 1. Check for social media embeds
  const twitterEmbed = extractTwitterAuthor(document);
  if (twitterEmbed) return twitterEmbed;

  const redditEmbed = extractRedditAuthor(document);
  if (redditEmbed) return redditEmbed;

  // 2. Check for article bylines
  const byline = extractArticleByline(document);
  if (byline) return byline;

  // 3. Check for comment authors
  const commentAuthor = extractCommentAuthor(document);
  if (commentAuthor) return commentAuthor;

  // 4. Fall back to domain-as-author for organizational content
  return extractDomainAuthor(url);
}
```

#### Phase 2: Heuristic Analysis (Local, Fast)

```typescript
interface HeuristicSignals {
  // Posting patterns (if available)
  postingRegularity?: number;      // 0-1, higher = more regular (bot-like)
  timeOfDayDistribution?: number;  // Variance in posting times

  // Content patterns
  contentOriginality: number;      // 0-1, unique vs copied content
  emotionalLanguageDensity: number; // High = troll-like
  hashtacOveruse: number;          // Excessive hashtags = bot/spam
  urlDensity: number;              // Many links = spam/commercial

  // Profile signals (if available)
  accountAge?: number;             // Days old
  profileCompleteness?: number;    // 0-1, filled profile fields
  followerRatio?: number;          // followers / following

  // Engagement patterns
  replyRate?: number;              // Does account engage with replies?
  originalContentRate?: number;    // Original vs retweets/shares
}

function analyzeAuthorHeuristics(
  author: ExtractedAuthor,
  content: string
): HeuristicSignals {
  const signals: HeuristicSignals = {
    contentOriginality: calculateOriginality(content),
    emotionalLanguageDensity: calculateEmotionalDensity(content),
    hashtacOveruse: countHashtags(content) / content.split(' ').length,
    urlDensity: countUrls(content) / content.split(' ').length
  };

  // Platform-specific enrichment
  if (author.metadata) {
    if (author.metadata.accountAge) {
      signals.accountAge = author.metadata.accountAge;
    }
    if (author.metadata.followers !== undefined) {
      signals.followerRatio =
        author.metadata.followers / (author.metadata.following || 1);
    }
  }

  return signals;
}
```

#### Phase 3: Database Lookup (Optional)

```typescript
interface KnownActorEntry {
  identifier: string;          // Username or pattern
  platform: string;
  category: AuthorIntent;
  confidence: number;
  source: string;              // Database source
  lastUpdated: string;
  notes?: string;
  // Attribution
  attribution?: {
    country?: string;          // For state-sponsored
    organization?: string;
    campaign?: string;
  };
}

async function lookupKnownActor(
  author: ExtractedAuthor
): Promise<KnownActorEntry | null> {
  // Check if author database lookup is enabled
  if (!await canMakeExternalCall('authorDatabase')) {
    // Fall back to bundled known actors list
    return lookupBundledActors(author);
  }

  // External database lookup
  return queryAuthorDatabase(author);
}
```

#### Phase 4: Score Calculation

```typescript
function calculateAuthorScores(
  signals: HeuristicSignals,
  knownActor: KnownActorEntry | null,
  aiAnalysis: AIAuthorAnalysis | null
): AuthorClassification {
  // Start with base scores
  let authenticity = 50;
  let coordination = 20;
  const intentBreakdown = {
    organic: 0.7,
    troll: 0.1,
    bot: 0.05,
    stateSponsored: 0.02,
    commercial: 0.1,
    activist: 0.03
  };

  // Apply heuristic signals
  if (signals.contentOriginality < 0.3) {
    authenticity -= 20;
    intentBreakdown.bot += 0.2;
  }

  if (signals.emotionalLanguageDensity > 0.4) {
    intentBreakdown.troll += 0.25;
    intentBreakdown.organic -= 0.15;
  }

  if (signals.hashtacOveruse > 0.15) {
    authenticity -= 15;
    intentBreakdown.bot += 0.15;
    intentBreakdown.commercial += 0.1;
  }

  if (signals.accountAge && signals.accountAge < 30) {
    authenticity -= 10;
  }

  if (signals.followerRatio && signals.followerRatio > 100) {
    authenticity -= 15; // Suspicious follower ratio
  }

  // Known actor override
  if (knownActor) {
    const categoryKey = knownActor.category as keyof typeof intentBreakdown;
    intentBreakdown[categoryKey] = knownActor.confidence;

    // Reduce other categories proportionally
    const remaining = 1 - knownActor.confidence;
    for (const key of Object.keys(intentBreakdown)) {
      if (key !== categoryKey) {
        intentBreakdown[key as keyof typeof intentBreakdown] *= remaining;
      }
    }

    // Adjust authenticity based on category
    if (knownActor.category === 'bot') authenticity = 10;
    if (knownActor.category === 'stateSponsored') coordination = 90;
  }

  // AI analysis enhancement
  if (aiAnalysis) {
    authenticity = authenticity * 0.4 + aiAnalysis.authenticity * 0.6;
    coordination = coordination * 0.4 + aiAnalysis.coordination * 0.6;
    // Blend intent breakdowns
  }

  // Normalize intent breakdown
  const total = Object.values(intentBreakdown).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(intentBreakdown)) {
    intentBreakdown[key as keyof typeof intentBreakdown] /= total;
  }

  // Determine primary intent
  const primary = Object.entries(intentBreakdown)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    authenticity: Math.max(0, Math.min(100, Math.round(authenticity))),
    coordination: Math.max(0, Math.min(100, Math.round(coordination))),
    intent: {
      primary: primary[0] as AuthorIntent,
      confidence: primary[1],
      breakdown: intentBreakdown
    },
    signals: [], // Populated with actual signals used
    dataQuality: determineDataQuality(signals, knownActor)
  };
}
```

### Integrated Classification Result

```typescript
interface FullClassificationResult {
  // Content classification (existing)
  content: {
    economic: number;
    social: number;
    authority: number;
    globalism: number;
    truthScore: number;
  };

  // Author classification (new)
  author: AuthorClassification;

  // Combined metadata
  confidence: number;          // Overall confidence
  source: 'local' | 'enhanced';
  timestamp: number;
}
```

### Radar Chart Integration

The 7-axis radar chart displays:
1. **Economic** (-100 to +100) → normalized to 0-100 for display
2. **Social** (-100 to +100) → normalized to 0-100 for display
3. **Authority** (-100 to +100) → normalized to 0-100 for display
4. **Globalism** (-100 to +100) → normalized to 0-100 for display
5. **Authenticity** (0 to 100) - new
6. **Coordination** (0 to 100, inverted: 0=orchestrated, 100=organic) - new
7. **Truthfulness** (0 to 100) - existing

For the inverted Coordination axis, low values (orchestrated) show as concerning, high values (organic) as positive.

### User Filtering with Author Criteria

```typescript
interface UserPreferences {
  // Existing content filters
  economicRange: [number, number] | null;
  socialRange: [number, number] | null;
  authorityRange: [number, number] | null;
  globalismRange: [number, number] | null;
  minTruthScore: number;

  // New author filters
  minAuthenticity: number;           // 0-100, filter below this
  maxCoordination: number;           // 0-100, filter above this
  blockedIntents: AuthorIntent[];    // Block these author types

  // Display settings
  displayMode: 'block' | 'overlay' | 'badge' | 'off';
  enabled: boolean;
  whitelistedDomains: string[];
}

function shouldFilter(
  result: FullClassificationResult,
  prefs: UserPreferences
): FilterAction {
  // Content checks (existing)
  // ...

  // Author checks (new)
  if (result.author.authenticity < prefs.minAuthenticity) {
    return { action: prefs.displayMode, reason: 'authenticity' };
  }

  if (result.author.coordination > prefs.maxCoordination) {
    return { action: prefs.displayMode, reason: 'coordination' };
  }

  if (prefs.blockedIntents.includes(result.author.intent.primary)) {
    return { action: prefs.displayMode, reason: 'authorIntent' };
  }

  return { action: 'none' };
}
```
