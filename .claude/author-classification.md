# Author Classification System

## Overview

The author classification system analyzes WHO created content, complementing content analysis (WHAT is said). It works across:
- Social media embeds (Twitter/X, Reddit, Facebook)
- Article bylines
- Comment sections
- Any page with identifiable author information

**Key Principle**: Local heuristics first, optional external database lookups, optional AI enhancement.

---

## Author Extraction

### Platform-Specific Extractors

#### Twitter/X Embeds

```typescript
function extractTwitterAuthor(document: Document): ExtractedAuthor | null {
  // Twitter embeds use specific class structures
  const tweetContainers = document.querySelectorAll(
    '[data-tweet-id], .twitter-tweet, .Tweet'
  );

  for (const container of tweetContainers) {
    // Look for username
    const usernameEl = container.querySelector(
      '[data-screen-name], .Tweet-authorScreenName, a[href*="twitter.com/"]'
    );

    if (usernameEl) {
      const username = extractUsername(usernameEl);
      return {
        identifier: username,
        displayName: extractDisplayName(container),
        platform: 'twitter',
        profileUrl: `https://twitter.com/${username}`,
        metadata: {
          verified: container.querySelector('[data-verified="true"], .Icon--verified') !== null,
          tweetId: container.getAttribute('data-tweet-id'),
          timestamp: extractTimestamp(container)
        }
      };
    }
  }

  return null;
}

function extractUsername(el: Element): string {
  // Handle various Twitter embed formats
  if (el.hasAttribute('data-screen-name')) {
    return el.getAttribute('data-screen-name')!;
  }

  const href = el.getAttribute('href');
  if (href && href.includes('twitter.com/')) {
    const match = href.match(/twitter\.com\/([^/?]+)/);
    if (match) return match[1];
  }

  const text = el.textContent?.trim();
  if (text?.startsWith('@')) return text.slice(1);

  return text || '';
}
```

#### Reddit Embeds

```typescript
function extractRedditAuthor(document: Document): ExtractedAuthor | null {
  // Reddit embed selectors
  const redditContainers = document.querySelectorAll(
    '.reddit-embed, [data-reddit-embed], iframe[src*="reddit.com"]'
  );

  for (const container of redditContainers) {
    const authorEl = container.querySelector(
      '[data-author], .author, a[href*="/user/"]'
    );

    if (authorEl) {
      const username = extractRedditUsername(authorEl);
      return {
        identifier: username,
        platform: 'reddit',
        profileUrl: `https://reddit.com/user/${username}`,
        metadata: {
          subreddit: extractSubreddit(container),
          postId: extractPostId(container),
          karma: extractKarma(container) // If available
        }
      };
    }
  }

  // Also check for Reddit links in page
  const redditLinks = document.querySelectorAll('a[href*="reddit.com/r/"]');
  // ... extract author from linked posts

  return null;
}
```

#### Article Bylines

```typescript
function extractArticleByline(document: Document): ExtractedAuthor | null {
  // Common byline selectors (ordered by specificity)
  const bylineSelectors = [
    // Structured data
    '[itemprop="author"]',
    '[rel="author"]',
    // Schema.org
    '[itemtype*="Person"] [itemprop="name"]',
    // Common class names
    '.author-name',
    '.byline__name',
    '.article-author',
    '.post-author',
    '.author',
    '.byline',
    // News site specific
    '.ArticleAuthor',
    '.story-meta__author',
    '[data-testid="author-name"]',
    // Generic patterns
    'a[href*="/author/"]',
    'a[href*="/writers/"]'
  ];

  for (const selector of bylineSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const name = el.textContent?.trim();
      if (name && name.length > 2 && name.length < 100) {
        return {
          identifier: normalizeAuthorName(name),
          displayName: name,
          platform: 'article',
          profileUrl: extractAuthorUrl(el),
          metadata: {
            publication: extractPublication(document),
            publishDate: extractPublishDate(document)
          }
        };
      }
    }
  }

  // Try meta tags
  const metaAuthor = document.querySelector('meta[name="author"]');
  if (metaAuthor) {
    const content = metaAuthor.getAttribute('content');
    if (content) {
      return {
        identifier: normalizeAuthorName(content),
        displayName: content,
        platform: 'article',
        metadata: {
          publication: extractPublication(document)
        }
      };
    }
  }

  return null;
}

function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}
```

#### Comment Authors

```typescript
function extractCommentAuthor(document: Document): ExtractedAuthor | null {
  // Common comment system selectors
  const commentSelectors = [
    // Disqus
    '.post-meta__name', '.author-name',
    // WordPress
    '.comment-author', '.fn',
    // Generic
    '.comment-user', '.commenter-name'
  ];

  // Only extract if we're in a comment context
  const commentContainer = document.querySelector(
    '#comments, .comments-section, [data-comments]'
  );

  if (!commentContainer) return null;

  // Note: Comment authors are lower confidence
  // Multiple authors may exist - return primary/first
  for (const selector of commentSelectors) {
    const el = commentContainer.querySelector(selector);
    if (el) {
      return {
        identifier: el.textContent?.trim() || 'anonymous',
        platform: 'comment',
        metadata: {
          system: detectCommentSystem(document)
        }
      };
    }
  }

  return null;
}
```

#### Domain as Author (Fallback)

```typescript
function extractDomainAuthor(url: string): ExtractedAuthor {
  const domain = new URL(url).hostname.replace('www.', '');

  return {
    identifier: domain,
    displayName: domain,
    platform: 'unknown',
    profileUrl: url,
    metadata: {
      isOrganization: true,
      domain: domain
    }
  };
}
```

---

## Heuristic Analysis

### Content-Based Signals

These signals are extracted from the content itself without external lookups.

```typescript
interface ContentSignals {
  // Bot indicators
  repetitivePatterns: number;      // 0-1, higher = more repetitive
  templateLikelihood: number;      // 0-1, looks like templated content
  unnaturalPhrasing: number;       // 0-1, grammatically correct but odd

  // Troll indicators
  emotionalLanguageDensity: number; // 0-1, inflammatory words per total
  personalAttacks: number;          // Count of ad hominem patterns
  badFaithArguments: number;        // Strawman, whataboutism, etc.
  engagementBaiting: number;        // 0-1, "fight me", controversial takes

  // Commercial indicators
  promotionalLanguage: number;      // 0-1, sales-speak density
  affiliateLinkCount: number;       // Number of affiliate/tracking URLs
  productMentions: number;          // Named products/services

  // State-sponsored indicators
  coordinatedNarratives: number;    // 0-1, matches known talking points
  foreignPolicyAlignment: number;   // Consistent alignment with state positions
  whataboutismDensity: number;      // Deflection patterns

  // Authenticity indicators (positive)
  personalVoice: number;            // 0-1, unique style indicators
  nuancedArguments: number;         // Acknowledges opposing views
  originalContent: number;          // 0-1, not copy-pasted
}

function analyzeContentSignals(content: string): ContentSignals {
  const words = content.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/);

  return {
    // Bot detection
    repetitivePatterns: calculateRepetition(sentences),
    templateLikelihood: detectTemplates(content),
    unnaturalPhrasing: detectUnnaturalLanguage(content),

    // Troll detection
    emotionalLanguageDensity: countEmotionalWords(words) / words.length,
    personalAttacks: countPersonalAttacks(content),
    badFaithArguments: countBadFaithPatterns(content),
    engagementBaiting: detectEngagementBait(content),

    // Commercial detection
    promotionalLanguage: countPromotionalPatterns(content) / sentences.length,
    affiliateLinkCount: countAffiliateLinks(content),
    productMentions: countProductMentions(content),

    // State-sponsored detection
    coordinatedNarratives: matchKnownNarratives(content),
    foreignPolicyAlignment: 0, // Requires external data
    whataboutismDensity: countWhataboutism(content),

    // Authenticity (positive signals)
    personalVoice: detectPersonalStyle(content),
    nuancedArguments: detectNuance(content),
    originalContent: 1 - calculateRepetition(sentences)
  };
}
```

### Pattern Detection Functions

```typescript
// Emotional/inflammatory language
const EMOTIONAL_WORDS = [
  'outrage', 'disgusting', 'horrific', 'unbelievable', 'shocking',
  'pathetic', 'idiotic', 'insane', 'radical', 'extremist',
  'destroy', 'attack', 'enemy', 'traitor', 'corrupt'
];

function countEmotionalWords(words: string[]): number {
  return words.filter(w => EMOTIONAL_WORDS.includes(w)).length;
}

// Personal attack patterns
const ATTACK_PATTERNS = [
  /you('re| are) (an? )?(idiot|moron|stupid)/gi,
  /people like you/gi,
  /wake up,? (sheeple|sheep)/gi,
  /(libtard|conservatard|snowflake)/gi,
  /go back to/gi
];

function countPersonalAttacks(content: string): number {
  return ATTACK_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0
  );
}

// Bad faith argument patterns
const BAD_FAITH_PATTERNS = [
  /what about/gi,           // Whataboutism
  /so you('re)? saying/gi,  // Strawman setup
  /typical \w+ response/gi, // Dismissive generalization
  /you (probably|must) (think|believe)/gi, // Assumption attacks
];

function countBadFaithPatterns(content: string): number {
  return BAD_FAITH_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0
  );
}

// Engagement bait
const ENGAGEMENT_BAIT = [
  /change my mind/gi,
  /fight me/gi,
  /prove me wrong/gi,
  /bet you (can't|won't)/gi,
  /i dare (you|anyone)/gi,
  /unpopular opinion:?/gi
];

function detectEngagementBait(content: string): number {
  const matches = ENGAGEMENT_BAIT.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0
  );
  return Math.min(1, matches * 0.3);
}

// Repetition detection (bot signal)
function calculateRepetition(sentences: string[]): number {
  if (sentences.length < 3) return 0;

  // Check for repeated phrases
  const phrases = new Map<string, number>();
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().trim();
    if (normalized.length > 10) {
      phrases.set(normalized, (phrases.get(normalized) || 0) + 1);
    }
  }

  const repeated = Array.from(phrases.values()).filter(count => count > 1).length;
  return Math.min(1, repeated / sentences.length);
}

// Template detection
const TEMPLATE_PATTERNS = [
  /\[name\]|\[company\]|\[product\]/gi,
  /{{.*?}}/g,
  /%[A-Z_]+%/g,
  /INSERT .* HERE/gi
];

function detectTemplates(content: string): number {
  const matches = TEMPLATE_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0
  );
  return Math.min(1, matches * 0.5);
}
```

---

## Known Actor Matching

### Bundled Database Structure

```typescript
// data/known-actors.json
interface KnownActorsDatabase {
  version: string;
  lastUpdated: string;
  actors: KnownActorEntry[];
  patterns: KnownActorPattern[];  // Regex patterns for detection
}

interface KnownActorEntry {
  identifier: string;         // Exact match (username)
  platform: 'twitter' | 'reddit' | 'facebook' | 'all';
  category: 'bot' | 'troll' | 'stateSponsored' | 'commercial';
  confidence: number;         // 0-1
  source: string;             // Attribution
  attribution?: {
    country?: string;
    campaign?: string;
    organization?: string;
  };
  addedDate: string;
  evidence?: string[];        // Links to reports
}

interface KnownActorPattern {
  pattern: string;            // Regex pattern
  platform: string;
  category: string;
  confidence: number;
  description: string;
}
```

### Matching Logic

```typescript
async function matchKnownActor(
  author: ExtractedAuthor
): Promise<KnownActorEntry | null> {
  const db = await loadKnownActorsDB();

  // 1. Exact match
  const exactMatch = db.actors.find(
    a => a.identifier.toLowerCase() === author.identifier.toLowerCase() &&
         (a.platform === author.platform || a.platform === 'all')
  );

  if (exactMatch) return exactMatch;

  // 2. Pattern match
  for (const pattern of db.patterns) {
    if (pattern.platform !== author.platform && pattern.platform !== 'all') {
      continue;
    }

    const regex = new RegExp(pattern.pattern, 'i');
    if (regex.test(author.identifier)) {
      return {
        identifier: author.identifier,
        platform: author.platform as any,
        category: pattern.category as any,
        confidence: pattern.confidence,
        source: 'pattern-match',
        addedDate: db.lastUpdated
      };
    }
  }

  return null;
}
```

### Database Sources

The bundled database is compiled from:

1. **Academic Research**
   - Stanford Internet Observatory reports
   - Oxford Internet Institute studies
   - Clemson University bot datasets

2. **Government Disclosures**
   - US State Department GEC reports
   - EU DisinfoLab investigations
   - Twitter/Meta transparency reports

3. **Journalism**
   - Hamilton 68 dashboard data
   - Bellingcat investigations
   - DFRLab reports

**Important**: Only include accounts that have been:
- Publicly disclosed by platforms
- Documented in peer-reviewed research
- Part of government sanctions/reports

---

## Score Calculation

### Combining Signals

```typescript
function calculateAuthorScores(
  contentSignals: ContentSignals,
  knownActor: KnownActorEntry | null,
  authorMetadata: ExtractedAuthor['metadata']
): AuthorClassification {

  // Initialize base scores
  let authenticity = 60;  // Assume human until proven otherwise
  let coordination = 15;  // Assume organic until proven otherwise

  // Intent probability distribution
  const intentScores = {
    organic: 0.6,
    troll: 0.1,
    bot: 0.1,
    stateSponsored: 0.05,
    commercial: 0.1,
    activist: 0.05
  };

  // Apply content signals
  // ----- Bot signals -----
  if (contentSignals.repetitivePatterns > 0.3) {
    authenticity -= 25;
    intentScores.bot += 0.25;
    intentScores.organic -= 0.2;
  }

  if (contentSignals.templateLikelihood > 0.5) {
    authenticity -= 30;
    intentScores.bot += 0.3;
  }

  // ----- Troll signals -----
  if (contentSignals.emotionalLanguageDensity > 0.15) {
    intentScores.troll += 0.2;
    intentScores.organic -= 0.1;
  }

  if (contentSignals.personalAttacks > 2) {
    intentScores.troll += 0.25;
    intentScores.organic -= 0.15;
  }

  if (contentSignals.engagementBaiting > 0.5) {
    intentScores.troll += 0.2;
  }

  // ----- Commercial signals -----
  if (contentSignals.promotionalLanguage > 0.2) {
    intentScores.commercial += 0.3;
    intentScores.organic -= 0.15;
  }

  if (contentSignals.affiliateLinkCount > 2) {
    intentScores.commercial += 0.25;
  }

  // ----- State-sponsored signals -----
  if (contentSignals.coordinatedNarratives > 0.5) {
    intentScores.stateSponsored += 0.2;
    coordination += 20;
  }

  if (contentSignals.whataboutismDensity > 0.1) {
    intentScores.stateSponsored += 0.1;
    intentScores.troll += 0.1;
  }

  // ----- Positive authenticity signals -----
  if (contentSignals.personalVoice > 0.7) {
    authenticity += 15;
    intentScores.organic += 0.15;
  }

  if (contentSignals.nuancedArguments > 0.5) {
    authenticity += 10;
    intentScores.organic += 0.1;
  }

  // Apply known actor data (high confidence override)
  if (knownActor) {
    const weight = knownActor.confidence;

    // Set primary intent based on known category
    intentScores[knownActor.category] = weight;

    // Adjust authenticity
    if (knownActor.category === 'bot') {
      authenticity = Math.round(authenticity * (1 - weight) + 10 * weight);
    }

    // Adjust coordination for state-sponsored
    if (knownActor.category === 'stateSponsored') {
      coordination = Math.round(coordination * (1 - weight) + 85 * weight);
    }
  }

  // Apply metadata signals (if available)
  if (authorMetadata?.accountAge !== undefined && authorMetadata.accountAge < 30) {
    authenticity -= 10;
  }

  if (authorMetadata?.verified) {
    authenticity += 15;
    intentScores.organic += 0.1;
  }

  // Normalize intent scores
  const total = Object.values(intentScores).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(intentScores) as (keyof typeof intentScores)[]) {
    intentScores[key] /= total;
  }

  // Determine primary intent
  const sortedIntents = Object.entries(intentScores)
    .sort((a, b) => b[1] - a[1]);
  const primaryIntent = sortedIntents[0];

  // Determine data quality
  const dataQuality = determineDataQuality(contentSignals, knownActor, authorMetadata);

  return {
    authenticity: clamp(authenticity, 0, 100),
    coordination: clamp(coordination, 0, 100),
    intent: {
      primary: primaryIntent[0] as AuthorIntent,
      confidence: primaryIntent[1],
      breakdown: intentScores
    },
    dataQuality,
    signals: [] // Would include detailed signal breakdown
  };
}

function determineDataQuality(
  signals: ContentSignals,
  knownActor: KnownActorEntry | null,
  metadata: any
): 'high' | 'medium' | 'low' | 'minimal' {
  let score = 0;

  // Known actor = high quality data
  if (knownActor && knownActor.confidence > 0.8) return 'high';

  // Check available signals
  if (metadata?.accountAge !== undefined) score += 2;
  if (metadata?.verified !== undefined) score += 2;
  if (metadata?.followers !== undefined) score += 1;

  // Content signals available
  const signalCount = Object.values(signals).filter(v => v > 0).length;
  score += Math.min(3, signalCount / 3);

  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  if (score >= 2) return 'low';
  return 'minimal';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

---

## External API Integration

### When to Use External APIs

External author database lookups are only made when ALL conditions are met:
1. User has enabled external API calls (master switch)
2. User has enabled author database lookups specifically
3. Local heuristics have low confidence OR author matches a suspicious pattern
4. Author hasn't been recently looked up (cache check)

```typescript
async function shouldQueryExternalDB(
  author: ExtractedAuthor,
  localResult: AuthorClassification
): Promise<boolean> {
  // Check if enabled
  if (!await canMakeExternalCall('authorDatabase')) return false;

  // Check cache
  const cached = await getCachedAuthorLookup(author);
  if (cached && !isExpired(cached, 24 * 60 * 60 * 1000)) return false;

  // Query if suspicious or low confidence
  if (localResult.dataQuality === 'minimal') return true;
  if (localResult.authenticity < 40) return true;
  if (localResult.coordination > 60) return true;
  if (['bot', 'troll', 'stateSponsored'].includes(localResult.intent.primary) &&
      localResult.intent.confidence > 0.5) return true;

  return false;
}
```

---

## Caching Strategy

### Author Cache

```typescript
interface AuthorCacheEntry {
  authorKey: string;          // `${platform}:${identifier}`
  classification: AuthorClassification;
  timestamp: number;
  source: 'local' | 'external' | 'ai';
}

// Cache TTLs
const AUTHOR_CACHE_TTL = {
  high_confidence: 7 * 24 * 60 * 60 * 1000,    // 7 days for known actors
  medium_confidence: 24 * 60 * 60 * 1000,       // 24 hours for moderate signals
  low_confidence: 6 * 60 * 60 * 1000,           // 6 hours for uncertain
  social_media: 12 * 60 * 60 * 1000             // 12 hours for social (accounts change)
};

function getAuthorCacheTTL(result: AuthorClassification, platform: string): number {
  if (result.dataQuality === 'high') return AUTHOR_CACHE_TTL.high_confidence;
  if (['twitter', 'reddit'].includes(platform)) return AUTHOR_CACHE_TTL.social_media;
  if (result.dataQuality === 'medium') return AUTHOR_CACHE_TTL.medium_confidence;
  return AUTHOR_CACHE_TTL.low_confidence;
}
```

---

## Privacy Considerations

### What Data Is Collected

- Author identifiers (usernames) are cached locally
- No personal information beyond public profile data
- Cache is device-local (not synced)
- User can clear author cache at any time

### What Data Is Sent Externally

Only when user opts in to external APIs:
- **Bot Sentinel**: Username only (Twitter/X)
- **AI Analysis**: Username + content snippet (truncated)

### What Data Is Never Stored

- Private messages or DMs
- Password or authentication data
- Browsing history beyond current page
- Personal data from profiles beyond public username

---

## Testing

### Test Cases

```typescript
// Bot detection
const BOT_CONTENT = `
Buy now! Limited time offer! Click here: bit.ly/xyz123
Buy now! Limited time offer! Click here: bit.ly/xyz123
Buy now! Limited time offer! Click here: bit.ly/xyz123
`;

// Troll detection
const TROLL_CONTENT = `
You're an idiot if you believe this. Typical libtard response.
Wake up sheeple! Anyone who disagrees is a moron.
Fight me on this. I dare you to prove me wrong.
`;

// State-sponsored pattern
const STATE_CONTENT = `
What about when [other country] did [similar thing]?
This is typical Western propaganda. The mainstream media
won't tell you the real story. Both sides are the same.
`;

// Organic content
const ORGANIC_CONTENT = `
I've been thinking about this issue, and while I understand
the concerns on both sides, I believe we need to consider
the nuances here. Studies suggest that the reality is more
complex than either extreme position acknowledges.
`;
```
