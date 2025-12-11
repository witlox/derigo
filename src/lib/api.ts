/**
 * External API integrations
 * All APIs are DISABLED by default and require explicit user opt-in
 */

import type {
  AIClassificationResponse,
  AIProvider,
  ExtractedAuthor,
  AuthorIntent
} from '../types/index.js';
import { getExternalAPISettings, canMakeExternalCall } from './storage.js';

// Provider endpoints
const PROVIDER_ENDPOINTS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// Default models per provider
const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash'
};

/**
 * Request AI classification for content and author
 * Returns null if API is not enabled or fails
 */
export async function requestAIClassification(
  content: string,
  url: string,
  author?: ExtractedAuthor
): Promise<AIClassificationResponse | null> {
  // Guard: check if enabled
  if (!await canMakeExternalCall('aiClassification')) {
    return null;
  }

  const settings = await getExternalAPISettings();
  const aiSettings = settings.aiClassification;

  const prompt = buildClassificationPrompt(content, url, author);

  try {
    const response = await callProvider(
      aiSettings.provider,
      aiSettings.apiKey,
      aiSettings.model || DEFAULT_MODELS[aiSettings.provider],
      prompt
    );

    return parseAIResponse(response);
  } catch (error) {
    console.error('[Derigo] AI classification error:', error);
    return null;
  }
}

/**
 * Build the classification prompt with optional author analysis
 */
function buildClassificationPrompt(content: string, url: string, author?: ExtractedAuthor): string {
  // Truncate content to 2000 chars
  const truncated = content.length > 2000
    ? content.substring(0, 2000) + '...'
    : content;

  // Build author context if available
  let authorContext = '';
  if (author) {
    authorContext = `
Author Information:
- Identifier: ${author.identifier}
- Platform: ${author.platform}
${author.displayName ? `- Display Name: ${author.displayName}` : ''}
${author.profileUrl ? `- Profile URL: ${author.profileUrl}` : ''}
${Object.keys(author.metadata).length > 0 ? `- Metadata: ${JSON.stringify(author.metadata)}` : ''}
`;
  }

  return `Analyze this content for political alignment, factual accuracy, and author authenticity.

URL: ${url}
${authorContext}
Content:
${truncated}

Respond with a JSON object containing:
{
  "content": {
    "economic": { "score": <-100 to +100, left to right>, "reasoning": "<brief explanation>" },
    "social": { "score": <-100 to +100, progressive to conservative>, "reasoning": "<brief explanation>" },
    "authority": { "score": <-100 to +100, libertarian to authoritarian>, "reasoning": "<brief explanation>" },
    "globalism": { "score": <-100 to +100, nationalist to globalist>, "reasoning": "<brief explanation>" },
    "truthfulness": { "score": <0 to 100>, "reasoning": "<brief explanation>" }
  },
  "author": {
    "authenticity": { "score": <0 to 100, bot-like to human>, "reasoning": "<brief explanation>" },
    "coordination": { "score": <0 to 100, organic to orchestrated campaign>, "reasoning": "<brief explanation>" },
    "intent": {
      "primary": "<organic|troll|bot|stateSponsored|commercial|activist>",
      "confidence": <0 to 1>,
      "reasoning": "<brief explanation>"
    }
  },
  "confidence": <0 to 1>,
  "claims": [{ "claim": "<factual claim found>", "assessment": "<verified/unverified/false>" }]
}

Author intent categories:
- organic: Genuine individual sharing their views
- troll: Account primarily seeking to provoke or disrupt
- bot: Automated account with non-human posting patterns
- stateSponsored: Account linked to government influence operations
- commercial: Account promoting products/services or paid content
- activist: Organized advocacy account (not necessarily bad, but coordinated)

Analyze the writing style, language patterns, emotional manipulation, and content signals to determine author authenticity and intent. Be objective and evidence-based. Only output valid JSON.`;
}

/**
 * Call the AI provider
 */
async function callProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model, prompt);
    case 'anthropic':
      return callAnthropic(apiKey, model, prompt);
    case 'google':
      return callGoogle(apiKey, model, prompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(PROVIDER_ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a content analysis assistant. Respond only with valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call Anthropic API
 */
async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2024-01-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Anthropic API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Call Google Gemini API
 */
async function callGoogle(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `${PROVIDER_ENDPOINTS.google}/${model}:generateContent?key=${apiKey}`;

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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Google API error');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Parse AI response into structured format
 * Handles both new (nested) and legacy (flat) response formats
 */
function parseAIResponse(response: string): AIClassificationResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Check if it's the new nested format or legacy flat format
    const isNewFormat = parsed.content && typeof parsed.content === 'object';

    if (isNewFormat) {
      // New format with nested content and author
      const content = parsed.content;
      const author = parsed.author;

      // Validate content structure
      if (
        typeof content.economic?.score !== 'number' ||
        typeof content.social?.score !== 'number' ||
        typeof content.authority?.score !== 'number' ||
        typeof content.globalism?.score !== 'number' ||
        typeof content.truthfulness?.score !== 'number'
      ) {
        throw new Error('Invalid content response structure');
      }

      // Build response with author data if available
      const result: AIClassificationResponse = {
        content: {
          economic: {
            score: clamp(content.economic.score, -100, 100),
            reasoning: content.economic.reasoning || ''
          },
          social: {
            score: clamp(content.social.score, -100, 100),
            reasoning: content.social.reasoning || ''
          },
          authority: {
            score: clamp(content.authority.score, -100, 100),
            reasoning: content.authority.reasoning || ''
          },
          globalism: {
            score: clamp(content.globalism.score, -100, 100),
            reasoning: content.globalism.reasoning || ''
          },
          truthfulness: {
            score: clamp(content.truthfulness.score, 0, 100),
            reasoning: content.truthfulness.reasoning || ''
          }
        },
        author: {
          authenticity: {
            score: clamp(author?.authenticity?.score ?? 50, 0, 100),
            reasoning: author?.authenticity?.reasoning || ''
          },
          coordination: {
            score: clamp(author?.coordination?.score ?? 0, 0, 100),
            reasoning: author?.coordination?.reasoning || ''
          },
          intent: {
            primary: validateIntent(author?.intent?.primary) || 'organic',
            confidence: clamp(author?.intent?.confidence ?? 0.5, 0, 1),
            reasoning: author?.intent?.reasoning || ''
          }
        },
        confidence: clamp(parsed.confidence || 0.5, 0, 1),
        claims: parsed.claims || []
      };

      return result;
    } else {
      // Legacy flat format - convert to new format
      if (
        typeof parsed.economic?.score !== 'number' ||
        typeof parsed.social?.score !== 'number' ||
        typeof parsed.authority?.score !== 'number' ||
        typeof parsed.globalism?.score !== 'number' ||
        typeof parsed.truthfulness?.score !== 'number'
      ) {
        throw new Error('Invalid response structure');
      }

      return {
        content: {
          economic: {
            score: clamp(parsed.economic.score, -100, 100),
            reasoning: parsed.economic.reasoning || ''
          },
          social: {
            score: clamp(parsed.social.score, -100, 100),
            reasoning: parsed.social.reasoning || ''
          },
          authority: {
            score: clamp(parsed.authority.score, -100, 100),
            reasoning: parsed.authority.reasoning || ''
          },
          globalism: {
            score: clamp(parsed.globalism.score, -100, 100),
            reasoning: parsed.globalism.reasoning || ''
          },
          truthfulness: {
            score: clamp(parsed.truthfulness.score, 0, 100),
            reasoning: parsed.truthfulness.reasoning || ''
          }
        },
        author: {
          authenticity: { score: 50, reasoning: 'Not analyzed' },
          coordination: { score: 0, reasoning: 'Not analyzed' },
          intent: { primary: 'organic', confidence: 0, reasoning: 'Not analyzed' }
        },
        confidence: clamp(parsed.confidence || 0.5, 0, 1),
        claims: parsed.claims || []
      };
    }
  } catch (error) {
    console.error('[Derigo] Failed to parse AI response:', error);
    return null;
  }
}

/**
 * Validate author intent is a known type
 */
function validateIntent(intent: string | undefined): AuthorIntent | null {
  const validIntents: AuthorIntent[] = ['organic', 'troll', 'bot', 'stateSponsored', 'commercial', 'activist'];
  if (intent && validIntents.includes(intent as AuthorIntent)) {
    return intent as AuthorIntent;
  }
  return null;
}

/**
 * Clamp a number to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Query Google Fact Check API
 */
export async function queryFactCheck(claim: string): Promise<FactCheckResult | null> {
  if (!await canMakeExternalCall('factCheck')) {
    return null;
  }

  const settings = await getExternalAPISettings();
  const apiKey = settings.factCheck.apiKey;

  const url = new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search');
  url.searchParams.set('query', claim);
  url.searchParams.set('key', apiKey);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Fact Check API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Derigo] Fact check error:', error);
    return null;
  }
}

// Types for fact check
interface FactCheckResult {
  claims?: Array<{
    text: string;
    claimant?: string;
    claimDate?: string;
    claimReview: Array<{
      publisher: { name: string; site: string };
      url: string;
      title: string;
      textualRating: string;
      languageCode: string;
    }>;
  }>;
}

export type { FactCheckResult };

/**
 * Bot Sentinel API integration
 * https://botsentinel.com/api
 */
export async function queryBotSentinel(
  username: string,
  platform: string = 'twitter'
): Promise<BotSentinelResult | null> {
  if (!await canMakeExternalCall('botSentinel')) {
    return null;
  }

  // Bot Sentinel only supports Twitter/X currently
  if (platform !== 'twitter') {
    return null;
  }

  const settings = await getExternalAPISettings();
  const apiKey = settings.authorDatabase?.botSentinel?.apiKey;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`https://api.botsentinel.com/v1/account/${username}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Account not in database
        return null;
      }
      throw new Error(`Bot Sentinel API error: ${response.status}`);
    }

    const data = await response.json();
    return parseBotSentinelResponse(data);
  } catch (error) {
    console.error('[Derigo] Bot Sentinel error:', error);
    return null;
  }
}

/**
 * Parse Bot Sentinel response
 */
function parseBotSentinelResponse(data: BotSentinelAPIResponse): BotSentinelResult {
  // Bot Sentinel uses a 0-100 scale where higher = more problematic
  // Categories: Normal, Satisfactory, Alarming, Problematic
  const rating = data.rating || 0;

  let category: 'normal' | 'satisfactory' | 'alarming' | 'problematic' = 'normal';
  if (rating >= 75) {
    category = 'problematic';
  } else if (rating >= 50) {
    category = 'alarming';
  } else if (rating >= 25) {
    category = 'satisfactory';
  }

  return {
    username: data.screen_name || data.username || 'unknown',
    rating,
    category,
    isTrollBot: rating >= 50,
    analysisDate: data.last_analyzed || new Date().toISOString(),
    details: {
      accountAge: data.account_age_days,
      followerCount: data.followers_count,
      followingCount: data.following_count,
      tweetCount: data.statuses_count
    }
  };
}

// Bot Sentinel types
interface BotSentinelAPIResponse {
  screen_name?: string;
  username?: string;
  rating?: number;
  last_analyzed?: string;
  account_age_days?: number;
  followers_count?: number;
  following_count?: number;
  statuses_count?: number;
}

export interface BotSentinelResult {
  username: string;
  rating: number;
  category: 'normal' | 'satisfactory' | 'alarming' | 'problematic';
  isTrollBot: boolean;
  analysisDate: string;
  details: {
    accountAge?: number;
    followerCount?: number;
    followingCount?: number;
    tweetCount?: number;
  };
}

/**
 * Enhanced classification that combines local + external APIs
 * Called when user has enabled enhanced analysis
 */
export async function enhancedClassification(
  content: string,
  url: string,
  author?: ExtractedAuthor,
  localResult?: {
    economic: number;
    social: number;
    authority: number;
    globalism: number;
    truthfulness: number;
    authorAuthenticity?: number;
    authorCoordination?: number;
    authorIntent?: AuthorIntent;
  }
): Promise<EnhancedClassificationResult> {
  const result: EnhancedClassificationResult = {
    aiAnalysis: null,
    factChecks: [],
    botSentinel: null,
    combined: null
  };

  // Run external API calls in parallel
  const promises: Promise<void>[] = [];

  // AI Classification
  promises.push(
    requestAIClassification(content, url, author).then(ai => {
      result.aiAnalysis = ai;
    })
  );

  // Bot Sentinel (if author on Twitter/X)
  if (author && author.platform === 'twitter') {
    promises.push(
      queryBotSentinel(author.identifier, author.platform).then(bs => {
        result.botSentinel = bs;
      })
    );
  }

  // Fact Check for claims (extract potential claims from content)
  const potentialClaims = extractClaims(content);
  if (potentialClaims.length > 0) {
    // Only check first 3 claims to avoid rate limiting
    const claimPromises = potentialClaims.slice(0, 3).map(claim =>
      queryFactCheck(claim).then(fc => {
        if (fc?.claims && fc.claims.length > 0) {
          result.factChecks.push({ query: claim, result: fc });
        }
      })
    );
    promises.push(...claimPromises);
  }

  // Wait for all APIs
  await Promise.allSettled(promises);

  // Combine results if we have local + AI
  if (localResult && result.aiAnalysis) {
    result.combined = combineResults(localResult, result);
  }

  return result;
}

/**
 * Extract potential factual claims from content
 */
function extractClaims(content: string): string[] {
  const claims: string[] = [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

  // Look for claim indicators
  const claimPatterns = [
    /\b(study shows?|research (shows?|proves?|indicates?))\b/i,
    /\b(according to|statistics show|data shows?)\b/i,
    /\b(experts? (say|claim|believe)|scientists? (say|found))\b/i,
    /\b(it('s| is) (true|false|a fact) that)\b/i,
    /\b\d+%\s+(of|increase|decrease)/i,
    /\b(never|always|every|all|none)\b.*\b(are|is|have|do)\b/i
  ];

  for (const sentence of sentences) {
    for (const pattern of claimPatterns) {
      if (pattern.test(sentence)) {
        claims.push(sentence.trim());
        break;
      }
    }
  }

  return claims;
}

/**
 * Combine local and external API results
 */
function combineResults(
  local: {
    economic: number;
    social: number;
    authority: number;
    globalism: number;
    truthfulness: number;
    authorAuthenticity?: number;
    authorCoordination?: number;
    authorIntent?: AuthorIntent;
  },
  external: EnhancedClassificationResult
): CombinedScores {
  const ai = external.aiAnalysis;
  const bs = external.botSentinel;

  // Weight: 60% local, 40% AI (when available)
  const localWeight = 0.6;
  const aiWeight = ai ? 0.4 : 0;
  const totalWeight = localWeight + aiWeight;

  const combined: CombinedScores = {
    economic: (local.economic * localWeight + (ai?.content.economic.score || 0) * aiWeight) / totalWeight,
    social: (local.social * localWeight + (ai?.content.social.score || 0) * aiWeight) / totalWeight,
    authority: (local.authority * localWeight + (ai?.content.authority.score || 0) * aiWeight) / totalWeight,
    globalism: (local.globalism * localWeight + (ai?.content.globalism.score || 0) * aiWeight) / totalWeight,
    truthfulness: (local.truthfulness * localWeight + (ai?.content.truthfulness.score || 0) * aiWeight) / totalWeight,
    confidence: ai?.confidence || 0.5,
    sources: ['local']
  };

  if (ai) {
    combined.sources.push('ai');
  }

  // Author scores - combine local, AI, and Bot Sentinel
  if (local.authorAuthenticity !== undefined || ai?.author || bs) {
    let authTotal = 0;
    let authWeight = 0;

    if (local.authorAuthenticity !== undefined) {
      authTotal += local.authorAuthenticity * 0.4;
      authWeight += 0.4;
    }
    if (ai?.author.authenticity) {
      authTotal += ai.author.authenticity.score * 0.3;
      authWeight += 0.3;
    }
    if (bs) {
      // Bot Sentinel rating is inverted (higher = more problematic)
      authTotal += (100 - bs.rating) * 0.3;
      authWeight += 0.3;
      combined.sources.push('botSentinel');
    }

    combined.authorAuthenticity = authWeight > 0 ? authTotal / authWeight : undefined;
  }

  if (local.authorCoordination !== undefined || ai?.author) {
    let coordTotal = 0;
    let coordWeight = 0;

    if (local.authorCoordination !== undefined) {
      coordTotal += local.authorCoordination * 0.5;
      coordWeight += 0.5;
    }
    if (ai?.author.coordination) {
      coordTotal += ai.author.coordination.score * 0.5;
      coordWeight += 0.5;
    }

    combined.authorCoordination = coordWeight > 0 ? coordTotal / coordWeight : undefined;
  }

  // Adjust truthfulness based on fact checks
  if (external.factChecks.length > 0) {
    let falseCount = 0;
    let verifiedCount = 0;

    for (const fc of external.factChecks) {
      for (const claim of fc.result.claims || []) {
        for (const review of claim.claimReview || []) {
          const rating = review.textualRating.toLowerCase();
          if (rating.includes('false') || rating.includes('pants on fire') || rating.includes('incorrect')) {
            falseCount++;
          } else if (rating.includes('true') || rating.includes('correct') || rating.includes('verified')) {
            verifiedCount++;
          }
        }
      }
    }

    // Adjust truthfulness based on fact checks
    if (falseCount > 0) {
      combined.truthfulness = Math.max(0, combined.truthfulness - (falseCount * 15));
      combined.sources.push('factCheck');
    } else if (verifiedCount > 0) {
      combined.truthfulness = Math.min(100, combined.truthfulness + (verifiedCount * 5));
      combined.sources.push('factCheck');
    }
  }

  return combined;
}

// Types for enhanced classification
export interface EnhancedClassificationResult {
  aiAnalysis: AIClassificationResponse | null;
  factChecks: Array<{ query: string; result: FactCheckResult }>;
  botSentinel: BotSentinelResult | null;
  combined: CombinedScores | null;
}

export interface CombinedScores {
  economic: number;
  social: number;
  authority: number;
  globalism: number;
  truthfulness: number;
  authorAuthenticity?: number;
  authorCoordination?: number;
  confidence: number;
  sources: string[];
}
