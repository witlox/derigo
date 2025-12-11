# API Integration Guide

## Overview

Derigo uses a hybrid approach where most classification happens locally for speed, with optional external API calls for enhanced analysis and fact-checking.

**IMPORTANT: All external API integrations are DISABLED by default.** Users must explicitly enable each integration and provide their own API keys. No external calls are made unless the user opts in.

## External API Settings (Master Configuration)

All external APIs are controlled through a unified settings interface:

```typescript
interface ExternalAPISettings {
  // Master kill switch - if false, no external calls ever
  allowExternalCalls: boolean;

  // Individual API configurations
  factCheck: FactCheckAPISettings;
  claimBuster: ClaimBusterAPISettings;
  newsGuard: NewsGuardAPISettings;
  aiClassification: AIClassificationSettings;
}

// Default: Everything disabled
const DEFAULT_EXTERNAL_API_SETTINGS: ExternalAPISettings = {
  allowExternalCalls: false,
  factCheck: { enabled: false, apiKey: '', tier: 'free' },
  claimBuster: { enabled: false, apiKey: '', tier: 'free' },
  newsGuard: { enabled: false, apiKey: '', tier: 'basic' },
  aiClassification: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
    model: '',
    tier: 'standard',
    autoAnalyze: false,
    confidenceThreshold: 0.7
  }
};

// Guard function - checks before ANY external call
async function canMakeExternalCall(apiName: string): Promise<boolean> {
  const settings = await getExternalAPISettings();

  // Master switch must be on
  if (!settings.allowExternalCalls) return false;

  // Individual API must be enabled with valid key
  const apiSettings = settings[apiName];
  if (!apiSettings?.enabled || !apiSettings?.apiKey) return false;

  return true;
}
```

## Fact-Check APIs

### Google Fact Check Tools API

**Purpose**: Query known fact-checks from reputable organizations.

**Default State**: DISABLED

**Tiers**:
| Tier | Rate Limit | Cost | Features |
|------|------------|------|----------|
| Free | 10,000 queries/day | $0 | Basic claim search |
| Paid | Custom | Usage-based | Higher limits, priority |

**Settings**:
```typescript
interface FactCheckAPISettings {
  enabled: boolean;          // Default: false
  apiKey: string;            // User provides
  tier: 'free' | 'paid';     // Affects rate limiting behavior
  dailyLimit?: number;       // Custom limit for paid tier
}

const DEFAULT_FACTCHECK_SETTINGS: FactCheckAPISettings = {
  enabled: false,
  apiKey: '',
  tier: 'free'
};
```

**Setup** (only if user enables):
1. Enable Fact Check Tools API in Google Cloud Console
2. Create API credentials
3. Store key in extension settings
4. Toggle "Enable Google Fact Check" ON

**Usage**:
```typescript
async function queryFactCheck(claim: string): Promise<FactCheckResult | null> {
  // Guard: check if enabled
  if (!await canMakeExternalCall('factCheck')) return null;

  const settings = await getFactCheckSettings();

  const url = new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search');
  url.searchParams.set('query', claim);
  url.searchParams.set('key', settings.apiKey);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Fact check API error:', error);
    return null;
  }
}
```

### ClaimBuster API

**Purpose**: Detect check-worthy factual claims in text.

**Default State**: DISABLED

**Tiers**:
| Tier | Rate Limit | Cost | Features |
|------|------------|------|----------|
| Free (Academic) | 100 requests/day | $0 | Basic claim detection |
| Research | 1,000 requests/day | Contact | Academic use |
| Commercial | Unlimited | Contact | Production use |

**Settings**:
```typescript
interface ClaimBusterAPISettings {
  enabled: boolean;                              // Default: false
  apiKey: string;                                // User provides
  tier: 'free' | 'research' | 'commercial';     // Affects rate limiting
  endpoint?: string;                            // Custom endpoint for commercial
}

const DEFAULT_CLAIMBUSTER_SETTINGS: ClaimBusterAPISettings = {
  enabled: false,
  apiKey: '',
  tier: 'free'
};
```

**Usage**:
```typescript
async function detectClaims(text: string): Promise<ClaimBusterResult | null> {
  // Guard: check if enabled
  if (!await canMakeExternalCall('claimBuster')) return null;

  const settings = await getClaimBusterSettings();
  const endpoint = settings.endpoint || 'https://idir.uta.edu/claimbuster/api/v2/score/text/';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey
    },
    body: JSON.stringify({ input_text: text })
  });

  return await response.json();
}
```

### NewsGuard API

**Purpose**: Publisher-level credibility ratings from professional journalists.

**Default State**: DISABLED

**Note**: This is a commercial API. All tiers require a paid subscription.

**Tiers**:
| Tier | Access | Cost | Features |
|------|--------|------|----------|
| Basic | Domain lookup | ~$500/year | Nutrition labels for sites |
| Professional | Full API | ~$2,000/year | Detailed ratings, metadata |
| Enterprise | Unlimited | Custom | Bulk access, custom integration |

**Settings**:
```typescript
interface NewsGuardAPISettings {
  enabled: boolean;                                    // Default: false
  apiKey: string;                                      // User provides (paid)
  tier: 'basic' | 'professional' | 'enterprise';      // Determines available endpoints
  organizationId?: string;                             // Required for enterprise
}

const DEFAULT_NEWSGUARD_SETTINGS: NewsGuardAPISettings = {
  enabled: false,
  apiKey: '',
  tier: 'basic'
};
```

**Usage**:
```typescript
async function getNewsGuardRating(domain: string): Promise<NewsGuardRating | null> {
  // Guard: check if enabled
  if (!await canMakeExternalCall('newsGuard')) return null;

  const settings = await getNewsGuardSettings();

  // Endpoint varies by tier
  const endpoints = {
    basic: 'https://api.newsguardtech.com/v1/label',
    professional: 'https://api.newsguardtech.com/v2/rating',
    enterprise: 'https://api.newsguardtech.com/v3/rating'
  };

  const response = await fetch(`${endpoints[settings.tier]}/${domain}`, {
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'X-Organization-Id': settings.organizationId || ''
    }
  });

  return await response.json();
}
```

**Alternative (Free)**: The bundled source reputation database uses publicly available ratings from MediaBiasFactCheck, AllSides, and Ad Fontes Media. This works without any API calls.

## Source Reputation Database

### Data Structure

```typescript
interface SourceEntry {
  domain: string;
  name: string;
  factualRating: number;      // 0-100
  biasRating: {
    economic: number;         // -100 to +100
    social: number;
    authority: number;
    globalism: number;
  };
  category: string;           // news, opinion, satire, etc.
  country: string;
  lastVerified: string;       // ISO date
  sources: string[];          // Where ratings came from
}
```

### Building the Database

Sources for reputation data:
1. **MediaBiasFactCheck.com** - Manual ratings of news sources
2. **AllSides.com** - Bias ratings with methodology
3. **Ad Fontes Media** - Media bias chart data
4. **Wikipedia** - Reliable sources list

**Aggregation approach**:
```typescript
function aggregateSourceRatings(
  mbfc: MBFCRating | null,
  allSides: AllSidesRating | null,
  adFontes: AdFontesRating | null
): SourceEntry {
  // Weight by source reliability and recency
  const weights = {
    mbfc: 0.4,
    allSides: 0.3,
    adFontes: 0.3
  };

  // Normalize and combine ratings
  // ...
}
```

### Update Strategy

- Initial database bundled with extension
- Periodic updates via extension update
- Optional: fetch updates from hosted JSON file
- User can't modify base ratings (integrity)

## AI Classification API (Optional)

Derigo supports multiple LLM providers for enhanced content analysis. Users can choose their preferred provider and use their own API keys.

**Default State**: DISABLED

**Note**: All LLM providers are pay-per-use services. Users must create accounts and provide their own API keys.

### Supported Providers

| Provider | Models | Tiers | Approximate Cost |
|----------|--------|-------|------------------|
| **OpenAI** | gpt-4o-mini, gpt-4o | Pay-as-you-go, Plus ($20/mo), Team, Enterprise | ~$0.15-$5 / 1M tokens |
| **Anthropic** | claude-3-haiku, claude-3-sonnet, claude-3-opus | Pay-as-you-go, Pro ($20/mo), Team, Enterprise | ~$0.25-$15 / 1M tokens |
| **Google** | gemini-1.5-flash, gemini-1.5-pro | Free tier (limited), Pay-as-you-go, Enterprise | ~$0-$1.25 / 1M tokens |

### Provider Tiers Configuration

```typescript
type AIProvider = 'openai' | 'anthropic' | 'google';
type OpenAITier = 'payg' | 'plus' | 'team' | 'enterprise';
type AnthropicTier = 'payg' | 'pro' | 'team' | 'enterprise';
type GoogleTier = 'free' | 'payg' | 'enterprise';

interface AIClassificationSettings {
  enabled: boolean;                    // Default: false
  provider: AIProvider;                // Which provider to use
  apiKey: string;                      // User's API key
  model?: string;                      // Override default model
  tier: OpenAITier | AnthropicTier | GoogleTier;  // Affects rate limits
  autoAnalyze: boolean;                // Auto-trigger for low confidence
  confidenceThreshold: number;         // Trigger threshold (default 0.7)
  monthlyBudget?: number;              // Optional spending cap in USD
  requestsPerMinute?: number;          // Custom rate limit
}

const DEFAULT_AI_SETTINGS: AIClassificationSettings = {
  enabled: false,
  provider: 'openai',
  apiKey: '',
  tier: 'payg',
  autoAnalyze: false,
  confidenceThreshold: 0.7
};
```

### Rate Limits by Tier

**OpenAI**:
| Tier | RPM | TPM | Notes |
|------|-----|-----|-------|
| Pay-as-you-go (new) | 500 | 30,000 | Increases with usage |
| Pay-as-you-go (established) | 5,000 | 600,000 | After $50+ spent |
| Plus | 5,000 | 600,000 | Consumer subscription |
| Team/Enterprise | Custom | Custom | Contact sales |

**Anthropic**:
| Tier | RPM | TPM | Notes |
|------|-----|-----|-------|
| Pay-as-you-go | 1,000 | 80,000 | Default |
| Pro | 2,000 | 160,000 | Consumer subscription |
| Team/Enterprise | Custom | Custom | Contact sales |

**Google**:
| Tier | RPM | Daily Limit | Notes |
|------|-----|-------------|-------|
| Free | 15 | 1,500 | Limited models |
| Pay-as-you-go | 1,000 | Unlimited | All models |
| Enterprise | Custom | Unlimited | SLA, support |

### When to Use AI Classification

Only triggered when:
- User has explicitly enabled AI classification AND
- User has provided a valid API key AND
- One of the following conditions:
  - Local classification confidence < user's threshold
  - User manually requests detailed analysis
  - New/unknown source type (if autoAnalyze enabled)

### Provider Configuration

```typescript
interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint: string;
  tier: string;
}

const PROVIDER_CONFIGS: Record<AIProvider, Omit<AIProviderConfig, 'apiKey' | 'tier'>> = {
  openai: {
    provider: 'openai',
    model: 'gpt-4o-mini',  // Fast and cheap default
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },
  anthropic: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  google: {
    provider: 'google',
    model: 'gemini-1.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
  }
};
```

### Unified Interface

```typescript
interface AIClassificationRequest {
  content: string;
  url: string;
  existingClassification: ClassificationResult;
}

interface AIClassificationResponse {
  economic: { score: number; reasoning: string };
  social: { score: number; reasoning: string };
  authority: { score: number; reasoning: string };
  globalism: { score: number; reasoning: string };
  truthfulness: { score: number; reasoning: string };
  confidence: number;
  claims: Array<{ claim: string; assessment: string }>;
}

// Unified classification function
async function requestAIClassification(
  request: AIClassificationRequest
): Promise<AIClassificationResponse | null> {
  // Guard: check master switch AND individual setting
  if (!await canMakeExternalCall('aiClassification')) return null;

  const settings = await getAISettings();

  // Check budget limit if configured
  if (settings.monthlyBudget) {
    const spent = await getMonthlySpend('aiClassification');
    if (spent >= settings.monthlyBudget) {
      console.warn('AI classification budget exceeded');
      return null;
    }
  }

  const prompt = buildClassificationPrompt(request);

  try {
    const response = await callProvider(settings, prompt);
    await trackAPIUsage('aiClassification', estimateTokens(prompt, response));
    return parseAIResponse(response);
  } catch (error) {
    console.error('AI classification error:', error);
    return null;
  }
}
```

### Provider-Specific Implementations

#### OpenAI (ChatGPT)

```typescript
async function callOpenAI(
  config: AIProviderConfig,
  prompt: string
): Promise<string> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a content analysis assistant. Respond only with valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.3,  // Lower for more consistent results
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

#### Anthropic (Claude)

```typescript
async function callAnthropic(
  config: AIProviderConfig,
  prompt: string
): Promise<string> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2024-01-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}
```

#### Google (Gemini)

```typescript
async function callGoogle(
  config: AIProviderConfig,
  prompt: string
): Promise<string> {
  const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

### Unified Provider Caller

```typescript
async function callProvider(
  settings: AISettings,
  prompt: string
): Promise<string> {
  const config: AIProviderConfig = {
    ...PROVIDER_CONFIGS[settings.provider],
    apiKey: settings.apiKey,
    model: settings.model || PROVIDER_CONFIGS[settings.provider].model
  };

  switch (settings.provider) {
    case 'openai':
      return callOpenAI(config, prompt);
    case 'anthropic':
      return callAnthropic(config, prompt);
    case 'google':
      return callGoogle(config, prompt);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
```

### Classification Prompt

The same prompt works across all providers:

```typescript
function buildClassificationPrompt(request: AIClassificationRequest): string {
  return `Analyze this content for political alignment and factual accuracy.

URL: ${request.url}

Content (truncated to 2000 chars):
${request.content.slice(0, 2000)}

Respond with a JSON object containing:
{
  "economic": { "score": <-100 to +100, left to right>, "reasoning": "<brief explanation>" },
  "social": { "score": <-100 to +100, progressive to conservative>, "reasoning": "<brief explanation>" },
  "authority": { "score": <-100 to +100, libertarian to authoritarian>, "reasoning": "<brief explanation>" },
  "globalism": { "score": <-100 to +100, nationalist to globalist>, "reasoning": "<brief explanation>" },
  "truthfulness": { "score": <0 to 100>, "reasoning": "<brief explanation>" },
  "confidence": <0 to 1>,
  "claims": [{ "claim": "<factual claim found>", "assessment": "<verified/unverified/false>" }]
}

Be objective and evidence-based. Only output valid JSON.`;
}
```

### Settings UI

Users configure their AI provider in the options page. The UI should clearly show:
- Current status (enabled/disabled)
- Selected provider and tier
- API key (masked)
- Monthly budget and usage tracking
- Rate limit status

See `AIClassificationSettings` interface in Provider Tiers Configuration section above.

### Cost Optimization

Regardless of provider:
- **Cache aggressively**: Store results for 24+ hours
- **Use fast/cheap models**: Default to mini/flash/haiku variants
- **Trigger selectively**: Only for uncertain local classifications
- **Rate limit**: Max 10 requests per minute
- **Truncate content**: Send max 2000 characters

### Model Recommendations

| Use Case | OpenAI | Anthropic | Google |
|----------|--------|-----------|--------|
| **Cost-sensitive** | gpt-4o-mini | claude-3-haiku | gemini-1.5-flash |
| **Balanced** | gpt-4o | claude-3-sonnet | gemini-1.5-flash |
| **Best quality** | gpt-4o | claude-3-opus | gemini-1.5-pro |

### Error Handling Per Provider

```typescript
function handleProviderError(provider: AIProvider, error: any): APIError {
  // OpenAI error format
  if (provider === 'openai' && error.error) {
    return new APIError(
      error.error.message,
      error.error.code,
      error.error.code === 'rate_limit_exceeded'
    );
  }

  // Anthropic error format
  if (provider === 'anthropic' && error.error) {
    return new APIError(
      error.error.message,
      error.error.type,
      error.error.type === 'rate_limit_error'
    );
  }

  // Google error format
  if (provider === 'google' && error.error) {
    return new APIError(
      error.error.message,
      error.error.status,
      error.error.status === 'RESOURCE_EXHAUSTED'
    );
  }

  return new APIError('Unknown error', 'unknown', true);
}
```

## Caching Strategy

### Cache Levels

1. **Memory cache**: Current session, instant lookup
2. **IndexedDB cache**: Persistent, keyed by URL hash
3. **Source cache**: Domain-level, longer TTL

### Cache Implementation

```typescript
class ClassificationCache {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MEMORY_MAX = 100;

  async get(url: string): Promise<ClassificationResult | null> {
    const hash = await hashUrl(url);

    // Check memory first
    const memEntry = this.memoryCache.get(hash);
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.result;
    }

    // Check IndexedDB
    const dbEntry = await this.getFromDB(hash);
    if (dbEntry && !this.isExpired(dbEntry)) {
      // Promote to memory cache
      this.memoryCache.set(hash, dbEntry);
      this.pruneMemoryCache();
      return dbEntry.result;
    }

    return null;
  }

  async set(url: string, result: ClassificationResult): Promise<void> {
    const hash = await hashUrl(url);
    const entry: CacheEntry = {
      hash,
      result,
      timestamp: Date.now(),
      ttl: this.getTTL(url)
    };

    this.memoryCache.set(hash, entry);
    this.pruneMemoryCache();
    await this.saveToDB(entry);
  }

  private getTTL(url: string): number {
    // Social media: shorter TTL (content changes)
    if (this.isSocialMedia(url)) return 60 * 60 * 1000; // 1 hour

    // News: medium TTL
    if (this.isNews(url)) return 6 * 60 * 60 * 1000; // 6 hours

    // Static content: longer TTL
    return 24 * 60 * 60 * 1000; // 24 hours
  }
}
```

## Error Handling

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean
  ) {
    super(message);
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof APIError && !error.retryable) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

## Privacy Considerations

### Default Behavior (No External Calls)

By default, Derigo makes **ZERO external network requests**:
- All classification happens locally using bundled keyword databases
- Source reputation uses bundled data (no API calls)
- No analytics, telemetry, or tracking
- Works completely offline

### When External Calls Are Made

External API calls are ONLY made when ALL of these conditions are met:
1. User has enabled the master "Allow External Calls" switch
2. User has enabled the specific API integration
3. User has provided a valid API key for that service
4. The specific trigger condition for that API is met

### Privacy Principles

1. **Off by default**: No external calls until user explicitly opts in
2. **Granular control**: Each API can be enabled/disabled independently
3. **Transparency**: User can see exactly what data is sent to each API
4. **No data collection**: Extension never collects or transmits user data
5. **Local-first**: Core functionality works without any external APIs
6. **User's keys**: Users provide their own API keys (we never proxy requests)
7. **Content not stored**: Only URL hashes cached locally, not page content
8. **Budget controls**: Users can set spending limits on paid APIs

### Data Flow Transparency

When an external API is enabled, the extension sends:
- **Fact-Check APIs**: Extracted claims (text snippets) for verification
- **NewsGuard**: Domain name only (no page content)
- **AI Classification**: Truncated page content (max 2000 chars) + URL

Users can view all pending and completed API requests in the extension's activity log.
