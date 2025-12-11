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
