import type {
  ClassificationResult,
  KeywordEntry,
  SourceEntry,
  FilterAction,
  UserPreferences,
  ExtractedAuthor,
  AuthorClassification,
  FilterReason,
  SiteProfile,
  DisplayMode
} from '../types/index.js';
import { getKeywords, getSourceReputation, getCachedAuthor, cacheAuthor, getProfileForDomain } from './storage.js';
import { classifyAuthor, getDefaultAuthorClassification } from './author-classifier.js';

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
  const hasQuotes = /"[^"]{20,}"/.test(text);

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
 * Classifies content and optionally author
 */
export async function classifyContent(
  text: string,
  url: string,
  author?: ExtractedAuthor
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

  // Author classification (if author provided)
  let authorClassification: AuthorClassification | undefined;
  if (author) {
    authorClassification = await classifyAuthorWithCache(author, text);
  }

  return {
    economic: economicScore,
    social: socialScore,
    authority: authorityScore,
    globalism: globalismScore,
    truthScore,
    confidence,
    source: 'local',
    timestamp: Date.now(),
    author: authorClassification
  };
}

/**
 * Classify author with caching
 */
async function classifyAuthorWithCache(
  author: ExtractedAuthor,
  content: string
): Promise<AuthorClassification> {
  // Check cache first
  const cached = await getCachedAuthor(author);
  if (cached) {
    return cached.classification;
  }

  // Classify author
  const classification = await classifyAuthor(author, content);

  // Cache the result
  await cacheAuthor(author, classification, 'local');

  return classification;
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
function mapDisplayModeToAction(displayMode: DisplayMode): FilterAction['action'] {
  if (displayMode === 'off' || displayMode === 'disabled') return 'none';
  return displayMode;
}

/**
 * Merge a site profile's overrides with global preferences
 * Profile overrides take precedence; undefined values fall back to global
 */
export function mergeProfileWithPreferences(
  globalPrefs: UserPreferences,
  profile: SiteProfile | null
): UserPreferences {
  if (!profile) return globalPrefs;

  const overrides = profile.overrides;

  return {
    ...globalPrefs,
    // Apply overrides only if they are defined
    economicRange: overrides.economicRange !== undefined
      ? overrides.economicRange
      : globalPrefs.economicRange,
    socialRange: overrides.socialRange !== undefined
      ? overrides.socialRange
      : globalPrefs.socialRange,
    authorityRange: overrides.authorityRange !== undefined
      ? overrides.authorityRange
      : globalPrefs.authorityRange,
    globalismRange: overrides.globalismRange !== undefined
      ? overrides.globalismRange
      : globalPrefs.globalismRange,
    minTruthScore: overrides.minTruthScore !== undefined
      ? overrides.minTruthScore
      : globalPrefs.minTruthScore,
    minAuthenticity: overrides.minAuthenticity !== undefined
      ? overrides.minAuthenticity
      : globalPrefs.minAuthenticity,
    maxCoordination: overrides.maxCoordination !== undefined
      ? overrides.maxCoordination
      : globalPrefs.maxCoordination,
    blockedIntents: overrides.blockedIntents !== undefined
      ? overrides.blockedIntents
      : globalPrefs.blockedIntents,
    displayMode: overrides.displayMode !== undefined
      ? overrides.displayMode
      : globalPrefs.displayMode
  };
}

/**
 * Get effective preferences for a domain
 * Looks up any applicable profile and merges with global preferences
 */
export async function getEffectivePreferences(
  globalPrefs: UserPreferences,
  domain: string
): Promise<{ prefs: UserPreferences; profile: SiteProfile | null }> {
  const profile = await getProfileForDomain(domain);
  const prefs = mergeProfileWithPreferences(globalPrefs, profile);
  return { prefs, profile };
}

/**
 * Determine filter action based on classification and preferences
 * Optionally accepts a domain to look up site-specific profiles
 */
export function determineFilterAction(
  result: ClassificationResult,
  prefs: UserPreferences,
  profile?: SiteProfile | null
): FilterAction {
  // If a profile is provided, merge it with preferences
  const effectivePrefs = profile !== undefined
    ? mergeProfileWithPreferences(prefs, profile)
    : prefs;

  const action = mapDisplayModeToAction(effectivePrefs.displayMode);

  // If display mode is off or disabled, return none regardless of filters
  if (action === 'none') {
    return { action: 'none', result };
  }

  // Check each axis against user preferences
  if (!inRange(result.economic, effectivePrefs.economicRange)) {
    return { action, reason: 'economic', result };
  }

  if (!inRange(result.social, effectivePrefs.socialRange)) {
    return { action, reason: 'social', result };
  }

  if (!inRange(result.authority, effectivePrefs.authorityRange)) {
    return { action, reason: 'authority', result };
  }

  if (!inRange(result.globalism, effectivePrefs.globalismRange)) {
    return { action, reason: 'globalism', result };
  }

  // Check truthfulness
  if (result.truthScore < effectivePrefs.minTruthScore) {
    return { action, reason: 'truthfulness', result };
  }

  // Check author filters (if author classification exists)
  if (result.author) {
    // Check authenticity (filter if below minimum)
    if (result.author.authenticity < effectivePrefs.minAuthenticity) {
      return { action, reason: 'authenticity', result };
    }

    // Check coordination (filter if above maximum)
    if (result.author.coordination > effectivePrefs.maxCoordination) {
      return { action, reason: 'coordination', result };
    }

    // Check blocked intents
    if (effectivePrefs.blockedIntents.length > 0) {
      const primaryIntent = result.author.intent.primary;
      if (effectivePrefs.blockedIntents.includes(primaryIntent)) {
        return { action, reason: 'authorIntent', result };
      }
    }
  }

  // No filter triggered, but still show badge if enabled
  if (effectivePrefs.displayMode === 'badge') {
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

/**
 * Get author authenticity color for UI
 */
export function getAuthenticityColor(score: number): string {
  // Score is 0 (bot-like) to 100 (human)
  if (score >= 80) return '#22c55e'; // Green - highly authentic
  if (score >= 60) return '#84cc16'; // Light green - likely authentic
  if (score >= 40) return '#eab308'; // Yellow - uncertain
  if (score >= 20) return '#f97316'; // Orange - suspicious
  return '#ef4444'; // Red - likely bot/fake
}

/**
 * Get author coordination color for UI
 */
export function getCoordinationColor(score: number): string {
  // Score is 0 (organic) to 100 (orchestrated)
  if (score <= 20) return '#22c55e'; // Green - organic
  if (score <= 40) return '#84cc16'; // Light green - likely organic
  if (score <= 60) return '#eab308'; // Yellow - some coordination
  if (score <= 80) return '#f97316'; // Orange - likely coordinated
  return '#ef4444'; // Red - orchestrated campaign
}

/**
 * Get intent icon and label for UI
 */
export function getIntentIndicator(intent: string): { icon: string; label: string; color: string } {
  const indicators: Record<string, { icon: string; label: string; color: string }> = {
    organic: { icon: '👤', label: 'Organic User', color: '#22c55e' },
    troll: { icon: '🧌', label: 'Troll Account', color: '#f97316' },
    bot: { icon: '🤖', label: 'Bot Account', color: '#ef4444' },
    stateSponsored: { icon: '🏛️', label: 'State-Sponsored', color: '#dc2626' },
    commercial: { icon: '💰', label: 'Commercial', color: '#eab308' },
    activist: { icon: '📢', label: 'Activist', color: '#8b5cf6' }
  };

  return indicators[intent] || { icon: '?', label: 'Unknown', color: '#9ca3af' };
}

/**
 * Format filter reason for display
 */
export function formatFilterReason(reason: FilterReason): string {
  const reasons: Record<FilterReason, string> = {
    economic: 'Economic bias outside your range',
    social: 'Social bias outside your range',
    authority: 'Authority bias outside your range',
    globalism: 'Globalism bias outside your range',
    truthfulness: 'Below truthfulness threshold',
    authenticity: 'Author authenticity below minimum',
    coordination: 'Author coordination above maximum',
    authorIntent: 'Author intent type is blocked'
  };

  return reasons[reason] || 'Content filtered';
}
