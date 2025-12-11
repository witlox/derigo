import type {
  ClassificationResult,
  KeywordEntry,
  SourceEntry,
  FilterAction,
  UserPreferences
} from '../types/index.js';
import { getKeywords, getSourceReputation } from './storage.js';

// In-memory cache for keywords (loaded once)
let keywordsCache: KeywordEntry[] | null = null;

/**
 * Load keywords into memory cache
 */
async function loadKeywords(): Promise<KeywordEntry[]> {
  if (keywordsCache) return keywordsCache;
  keywordsCache = await getKeywords();
  return keywordsCache;
}

/**
 * Normalize text for analysis
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate score for a single axis
 */
function calculateAxisScore(
  text: string,
  keywords: KeywordEntry[],
  axis: 'economic' | 'social' | 'authority' | 'globalism'
): { score: number; matches: number } {
  const axisKeywords = keywords.filter(k => k.axis === axis);
  let sum = 0;
  let matches = 0;
  let totalWeight = 0;

  for (const keyword of axisKeywords) {
    // Check for context if required
    if (keyword.context && keyword.context.length > 0) {
      const hasContext = keyword.context.some(ctx => text.includes(ctx.toLowerCase()));
      if (!hasContext) continue;
    }

    // Count occurrences
    const regex = new RegExp(`\\b${keyword.term.toLowerCase()}\\b`, 'g');
    const count = (text.match(regex) || []).length;

    if (count > 0) {
      // Apply diminishing returns for repeated matches
      const effectiveCount = Math.min(count, 3);
      sum += keyword.direction * keyword.weight * effectiveCount;
      totalWeight += keyword.weight * effectiveCount;
      matches++;
    }
  }

  // Normalize to -100 to +100 range
  const maxPossibleScore = Math.max(totalWeight, 1) * 10;
  const normalizedScore = Math.round((sum / maxPossibleScore) * 100);

  return {
    score: Math.max(-100, Math.min(100, normalizedScore)),
    matches
  };
}

/**
 * Calculate truthfulness score based on content signals
 */
function calculateTruthScore(
  text: string,
  sourceRating: SourceEntry | null
): number {
  let score = 50; // Start neutral

  // Source reputation (major factor)
  if (sourceRating) {
    score = sourceRating.factualRating;
  }

  // Content-based signals
  const signals = analyzeContentSignals(text);

  // Adjust based on signals (max +/- 20 from source score)
  if (signals.hasExcessiveCaps) score -= 5;
  if (signals.hasClickbait) score -= 10;
  if (signals.hasEmotionalLanguage) score -= 5;
  if (signals.hasCitations) score += 5;
  if (signals.hasNumbers) score += 3;
  if (signals.hasQuotes) score += 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Analyze content for quality signals
 */
function analyzeContentSignals(text: string): {
  hasExcessiveCaps: boolean;
  hasClickbait: boolean;
  hasEmotionalLanguage: boolean;
  hasCitations: boolean;
  hasNumbers: boolean;
  hasQuotes: boolean;
} {
  const originalText = text; // Keep original for caps check
  const lowerText = text.toLowerCase();

  // Excessive caps (more than 20% caps in words)
  const words = originalText.split(/\s+/);
  const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase());
  const hasExcessiveCaps = capsWords.length / words.length > 0.2;

  // Clickbait patterns
  const clickbaitPatterns = [
    'you won\'t believe',
    'shocking',
    'mind-blowing',
    'what happens next',
    'this will change',
    'secret revealed',
    'they don\'t want you to know',
    'share before deleted',
    'breaking:'
  ];
  const hasClickbait = clickbaitPatterns.some(p => lowerText.includes(p));

  // Emotional language
  const emotionalWords = [
    'outrage', 'disgusting', 'horrific', 'amazing', 'incredible',
    'terrifying', 'explosive', 'bombshell', 'slammed', 'destroyed'
  ];
  const emotionalCount = emotionalWords.filter(w => lowerText.includes(w)).length;
  const hasEmotionalLanguage = emotionalCount > 3;

  // Citations (URLs, "according to", "reported by")
  const citationPatterns = [
    'according to',
    'reported by',
    'study shows',
    'research indicates',
    'data from',
    'http',
    'source:'
  ];
  const hasCitations = citationPatterns.some(p => lowerText.includes(p));

  // Numbers and statistics
  const hasNumbers = /\d+%|\d+\.\d+|\$\d+|\d{4}/.test(text);

  // Direct quotes
  const hasQuotes = /"[^"]{20,}"/.test(text) || /\"[^\"]{20,}\"/.test(text);

  return {
    hasExcessiveCaps,
    hasClickbait,
    hasEmotionalLanguage,
    hasCitations,
    hasNumbers,
    hasQuotes
  };
}

/**
 * Calculate confidence based on signal strength
 */
function calculateConfidence(
  matches: { economic: number; social: number; authority: number; globalism: number },
  sourceRating: SourceEntry | null,
  textLength: number
): number {
  let confidence = 0;

  // More matches = higher confidence
  const totalMatches = matches.economic + matches.social + matches.authority + matches.globalism;
  confidence += Math.min(0.4, totalMatches * 0.02);

  // Known source = higher confidence
  if (sourceRating) {
    confidence += 0.3;
  }

  // Longer text = higher confidence (up to a point)
  const lengthFactor = Math.min(1, textLength / 5000);
  confidence += lengthFactor * 0.2;

  // Base confidence
  confidence += 0.1;

  return Math.min(1, confidence);
}

/**
 * Main classification function
 */
export async function classifyContent(
  text: string,
  url: string
): Promise<ClassificationResult> {
  const normalizedText = normalizeText(text);
  const keywords = await loadKeywords();
  const domain = new URL(url).hostname;
  const sourceRating = await getSourceReputation(domain);

  // Calculate axis scores
  const economic = calculateAxisScore(normalizedText, keywords, 'economic');
  const social = calculateAxisScore(normalizedText, keywords, 'social');
  const authority = calculateAxisScore(normalizedText, keywords, 'authority');
  const globalism = calculateAxisScore(normalizedText, keywords, 'globalism');

  // If we have source rating, blend it with keyword analysis
  let economicScore = economic.score;
  let socialScore = social.score;
  let authorityScore = authority.score;
  let globalismScore = globalism.score;

  if (sourceRating) {
    const sourceWeight = 0.4;
    const keywordWeight = 0.6;

    economicScore = Math.round(
      sourceRating.biasRating.economic * sourceWeight +
      economic.score * keywordWeight
    );
    socialScore = Math.round(
      sourceRating.biasRating.social * sourceWeight +
      social.score * keywordWeight
    );
    authorityScore = Math.round(
      sourceRating.biasRating.authority * sourceWeight +
      authority.score * keywordWeight
    );
    globalismScore = Math.round(
      sourceRating.biasRating.globalism * sourceWeight +
      globalism.score * keywordWeight
    );
  }

  const truthScore = calculateTruthScore(text, sourceRating);
  const confidence = calculateConfidence(
    {
      economic: economic.matches,
      social: social.matches,
      authority: authority.matches,
      globalism: globalism.matches
    },
    sourceRating,
    text.length
  );

  return {
    economic: economicScore,
    social: socialScore,
    authority: authorityScore,
    globalism: globalismScore,
    truthScore,
    confidence,
    source: 'local',
    timestamp: Date.now()
  };
}

/**
 * Check if a value is within a range
 */
function inRange(value: number, range: [number, number] | null): boolean {
  if (!range) return true;
  return value >= range[0] && value <= range[1];
}

/**
 * Map display mode to filter action
 */
function mapDisplayModeToAction(displayMode: UserPreferences['displayMode']): FilterAction['action'] {
  if (displayMode === 'off') return 'none';
  return displayMode;
}

/**
 * Determine filter action based on classification and preferences
 */
export function determineFilterAction(
  result: ClassificationResult,
  prefs: UserPreferences
): FilterAction {
  const action = mapDisplayModeToAction(prefs.displayMode);

  // If display mode is off, return none regardless of filters
  if (action === 'none') {
    return { action: 'none', result };
  }

  // Check each axis against user preferences
  if (!inRange(result.economic, prefs.economicRange)) {
    return { action, reason: 'economic', result };
  }

  if (!inRange(result.social, prefs.socialRange)) {
    return { action, reason: 'social', result };
  }

  if (!inRange(result.authority, prefs.authorityRange)) {
    return { action, reason: 'authority', result };
  }

  if (!inRange(result.globalism, prefs.globalismRange)) {
    return { action, reason: 'globalism', result };
  }

  // Check truthfulness
  if (result.truthScore < prefs.minTruthScore) {
    return { action, reason: 'truthfulness', result };
  }

  // No filter triggered, but still show badge if enabled
  if (prefs.displayMode === 'badge') {
    return { action: 'badge', result };
  }

  return { action: 'none', result };
}

/**
 * Get color for a score (for UI display)
 */
export function getScoreColor(score: number): string {
  // Score is -100 to +100
  // Left/Progressive = Blue, Right/Conservative = Red
  if (score < -50) return '#2563eb'; // Strong blue
  if (score < -20) return '#60a5fa'; // Light blue
  if (score < 20) return '#9ca3af';  // Gray (neutral)
  if (score < 50) return '#f87171';  // Light red
  return '#dc2626'; // Strong red
}

/**
 * Get truth score indicator
 */
export function getTruthIndicator(score: number): { class: string; icon: string; label: string } {
  if (score >= 80) return { class: 'truth-high', icon: '✓', label: 'Highly credible' };
  if (score >= 60) return { class: 'truth-medium-high', icon: '○', label: 'Generally reliable' };
  if (score >= 40) return { class: 'truth-medium', icon: '?', label: 'Mixed/unverified' };
  return { class: 'truth-low', icon: '!', label: 'Low credibility' };
}

/**
 * Format axis label
 */
export function formatAxisLabel(axis: string, score: number): string {
  const labels: Record<string, [string, string]> = {
    economic: ['Left', 'Right'],
    social: ['Progressive', 'Conservative'],
    authority: ['Libertarian', 'Authoritarian'],
    globalism: ['Nationalist', 'Globalist']
  };

  const [low, high] = labels[axis] || ['Low', 'High'];

  if (score < -33) return low;
  if (score > 33) return high;
  return 'Center';
}
