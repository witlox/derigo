/**
 * External API integrations
 * All APIs are DISABLED by default and require explicit user opt-in
 */

import type {
  AIClassificationResponse,
  ExternalAPISettings,
  AIProvider
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
 * Request AI classification for content
 * Returns null if API is not enabled or fails
 */
export async function requestAIClassification(
  content: string,
  url: string
): Promise<AIClassificationResponse | null> {
  // Guard: check if enabled
  if (!await canMakeExternalCall('aiClassification')) {
    return null;
  }

  const settings = await getExternalAPISettings();
  const aiSettings = settings.aiClassification;

  const prompt = buildClassificationPrompt(content, url);

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
 * Build the classification prompt
 */
function buildClassificationPrompt(content: string, url: string): string {
  // Truncate content to 2000 chars
  const truncated = content.length > 2000
    ? content.substring(0, 2000) + '...'
    : content;

  return `Analyze this content for political alignment and factual accuracy.

URL: ${url}

Content:
${truncated}

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
 */
function parseAIResponse(response: string): AIClassificationResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
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
      },
      confidence: clamp(parsed.confidence || 0.5, 0, 1),
      claims: parsed.claims || []
    };
  } catch (error) {
    console.error('[Derigo] Failed to parse AI response:', error);
    return null;
  }
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
