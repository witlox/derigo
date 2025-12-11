/**
 * Author classification engine
 * Analyzes content creators for authenticity and intent
 */

import type {
  ExtractedAuthor,
  AuthorClassification,
  AuthorIntent,
  AuthorSignal,
  ContentSignals,
  KnownActorEntry
} from '../types/index.js';
import { getKnownActor } from './storage.js';

// ============================================
// Pattern Constants
// ============================================

// Emotional/inflammatory language
const EMOTIONAL_WORDS = [
  'outrage', 'disgusting', 'horrific', 'unbelievable', 'shocking',
  'pathetic', 'idiotic', 'insane', 'radical', 'extremist',
  'destroy', 'attack', 'enemy', 'traitor', 'corrupt', 'evil',
  'terrible', 'awful', 'horrible', 'despicable', 'vile'
];

// Personal attack patterns
const ATTACK_PATTERNS = [
  /you('re| are) (an? )?(idiot|moron|stupid|dumb)/gi,
  /people like you/gi,
  /wake up,? (sheeple|sheep)/gi,
  /(libtard|conservatard|snowflake|cuck|shill)/gi,
  /go back to/gi,
  /typical (liberal|conservative|leftist|rightist)/gi,
  /you (must|probably) (work for|be paid by)/gi
];

// Bad faith argument patterns
const BAD_FAITH_PATTERNS = [
  /what about/gi,           // Whataboutism
  /so you('re)? saying/gi,  // Strawman setup
  /typical \w+ response/gi, // Dismissive generalization
  /you (probably|must) (think|believe)/gi, // Assumption attacks
  /nice try,? but/gi,
  /that's rich coming from/gi
];

// Engagement bait patterns
const ENGAGEMENT_BAIT = [
  /change my mind/gi,
  /fight me/gi,
  /prove me wrong/gi,
  /bet you (can't|won't)/gi,
  /i dare (you|anyone)/gi,
  /unpopular opinion:?/gi,
  /hot take:?/gi,
  /controversial:?/gi
];

// Promotional language patterns
const PROMOTIONAL_PATTERNS = [
  /buy now/gi,
  /limited time/gi,
  /click (here|the link)/gi,
  /check out/gi,
  /don't miss/gi,
  /exclusive offer/gi,
  /use code/gi,
  /sign up/gi,
  /subscribe/gi,
  /free trial/gi
];

// Template patterns (bot indicator)
const TEMPLATE_PATTERNS = [
  /\[name\]|\[company\]|\[product\]/gi,
  /{{.*?}}/g,
  /%[A-Z_]+%/g,
  /INSERT .* HERE/gi,
  /\{your.*?\}/gi
];

// Affiliate/tracking URL patterns
const AFFILIATE_PATTERNS = [
  /\?ref=/i,
  /\?aff=/i,
  /\?tag=/i,
  /affiliate/i,
  /amzn\.to/i,
  /bit\.ly/i,
  /tinyurl/i,
  /linktr\.ee/i
];

// ============================================
// Main Classification Function
// ============================================

/**
 * Classify an author based on content and available metadata
 */
export async function classifyAuthor(
  author: ExtractedAuthor,
  content: string
): Promise<AuthorClassification> {
  // Analyze content signals
  const signals = analyzeContentSignals(content);

  // Check known actor database
  const knownActor = await getKnownActor(author);

  // Calculate scores
  return calculateAuthorScores(author, signals, knownActor);
}

/**
 * Analyze content for author signals
 */
export function analyzeContentSignals(content: string): ContentSignals {
  const words = content.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lowerContent = content.toLowerCase();

  return {
    // Bot detection signals
    repetitivePatterns: calculateRepetition(sentences),
    templateLikelihood: detectTemplates(content),
    unnaturalPhrasing: 0, // Requires more sophisticated NLP

    // Troll detection signals
    emotionalLanguageDensity: countPatternMatches(words, EMOTIONAL_WORDS) / Math.max(words.length, 1),
    personalAttacks: countRegexMatches(content, ATTACK_PATTERNS),
    badFaithArguments: countRegexMatches(content, BAD_FAITH_PATTERNS),
    engagementBaiting: detectEngagementBait(content),

    // Commercial detection signals
    promotionalLanguage: countRegexMatches(lowerContent, PROMOTIONAL_PATTERNS) / Math.max(sentences.length, 1),
    affiliateLinkCount: countAffiliateLinks(content),
    productMentions: 0, // Would require product database

    // Coordination signals
    coordinatedNarratives: 0, // Would require external data
    whataboutismDensity: countWhataboutism(content),

    // Authenticity (positive) signals
    personalVoice: detectPersonalVoice(content),
    nuancedArguments: detectNuance(content),
    originalContent: 1 - calculateRepetition(sentences)
  };
}

// ============================================
// Signal Detection Functions
// ============================================

/**
 * Count matches in word array
 */
function countPatternMatches(words: string[], patterns: string[]): number {
  return words.filter(w => patterns.includes(w)).length;
}

/**
 * Count regex pattern matches
 */
function countRegexMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce(
    (count, pattern) => count + (text.match(pattern)?.length || 0),
    0
  );
}

/**
 * Calculate repetition score (bot indicator)
 */
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

/**
 * Detect template-like content
 */
function detectTemplates(content: string): number {
  const matches = countRegexMatches(content, TEMPLATE_PATTERNS);
  return Math.min(1, matches * 0.5);
}

/**
 * Detect engagement bait
 */
function detectEngagementBait(content: string): number {
  const matches = countRegexMatches(content, ENGAGEMENT_BAIT);
  return Math.min(1, matches * 0.3);
}

/**
 * Count affiliate/tracking links
 */
function countAffiliateLinks(content: string): number {
  return AFFILIATE_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0
  );
}

/**
 * Count whataboutism patterns
 */
function countWhataboutism(content: string): number {
  const patterns = [
    /what about/gi,
    /but (what|how) about/gi,
    /yeah,? but/gi,
    /but they (also|did)/gi
  ];
  return countRegexMatches(content, patterns) / Math.max(content.split(/[.!?]/).length, 1);
}

/**
 * Detect personal voice (authenticity indicator)
 */
function detectPersonalVoice(content: string): number {
  let score = 0;
  const lower = content.toLowerCase();

  // Personal pronouns
  if (/\bi\s+(think|believe|feel|wonder|guess)/gi.test(lower)) score += 0.2;
  if (/\bmy (experience|opinion|view|take)/gi.test(lower)) score += 0.2;

  // Hedging language (shows nuance)
  if (/\b(maybe|perhaps|might|could be|seems like)/gi.test(lower)) score += 0.15;

  // Acknowledgment of uncertainty
  if (/\b(i'm not sure|i could be wrong|correct me if)/gi.test(lower)) score += 0.2;

  // Original phrasing (longer sentences with varied structure)
  const sentences = content.split(/[.!?]+/);
  const avgLength = sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length;
  if (avgLength > 80 && avgLength < 200) score += 0.15;

  // First-person storytelling
  if (/\bi (was|went|saw|heard|met|talked)/gi.test(lower)) score += 0.1;

  return Math.min(1, score);
}

/**
 * Detect nuanced arguments
 */
function detectNuance(content: string): number {
  let score = 0;
  const lower = content.toLowerCase();

  // Acknowledging other viewpoints
  if (/\b(on the other hand|however|although|while|granted)/gi.test(lower)) score += 0.2;

  // Conditional statements
  if (/\b(it depends|in some cases|under certain)/gi.test(lower)) score += 0.15;

  // Acknowledging complexity
  if (/\b(complex|nuanced|complicated|multifaceted)/gi.test(lower)) score += 0.15;

  // Citations or references
  if (/\b(according to|research shows|studies indicate|data suggests)/gi.test(lower)) score += 0.2;

  // Questions (engagement, not rhetorical attacks)
  const genuineQuestions = content.match(/\?[^?!]*\?/g)?.length || 0;
  if (genuineQuestions > 0 && !/\b(seriously|really|honestly)\?/gi.test(lower)) {
    score += Math.min(0.2, genuineQuestions * 0.05);
  }

  // Acknowledging limitations
  if (/\b(i (don't|can't) (know|say) for sure|more research|not an expert)/gi.test(lower)) score += 0.1;

  return Math.min(1, score);
}

// ============================================
// Score Calculation
// ============================================

/**
 * Calculate author classification scores
 */
function calculateAuthorScores(
  author: ExtractedAuthor,
  signals: ContentSignals,
  knownActor: KnownActorEntry | null
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

  const collectedSignals: AuthorSignal[] = [];

  // ----- Bot signals -----
  if (signals.repetitivePatterns > 0.3) {
    authenticity -= 25;
    intentScores.bot += 0.25;
    intentScores.organic -= 0.2;
    collectedSignals.push({
      type: 'repetitive_content',
      value: signals.repetitivePatterns,
      weight: 0.25,
      direction: 'suspicious'
    });
  }

  if (signals.templateLikelihood > 0.5) {
    authenticity -= 30;
    intentScores.bot += 0.3;
    collectedSignals.push({
      type: 'template_detected',
      value: signals.templateLikelihood,
      weight: 0.3,
      direction: 'suspicious'
    });
  }

  // ----- Troll signals -----
  if (signals.emotionalLanguageDensity > 0.15) {
    intentScores.troll += 0.2;
    intentScores.organic -= 0.1;
    collectedSignals.push({
      type: 'emotional_language',
      value: signals.emotionalLanguageDensity,
      weight: 0.2,
      direction: 'suspicious'
    });
  }

  if (signals.personalAttacks > 2) {
    intentScores.troll += 0.25;
    intentScores.organic -= 0.15;
    collectedSignals.push({
      type: 'personal_attacks',
      value: signals.personalAttacks,
      weight: 0.25,
      direction: 'suspicious'
    });
  }

  if (signals.engagementBaiting > 0.5) {
    intentScores.troll += 0.2;
    collectedSignals.push({
      type: 'engagement_bait',
      value: signals.engagementBaiting,
      weight: 0.2,
      direction: 'suspicious'
    });
  }

  if (signals.badFaithArguments > 1) {
    intentScores.troll += 0.15;
    collectedSignals.push({
      type: 'bad_faith_arguments',
      value: signals.badFaithArguments,
      weight: 0.15,
      direction: 'suspicious'
    });
  }

  // ----- Commercial signals -----
  if (signals.promotionalLanguage > 0.2) {
    intentScores.commercial += 0.3;
    intentScores.organic -= 0.15;
    collectedSignals.push({
      type: 'promotional_language',
      value: signals.promotionalLanguage,
      weight: 0.3,
      direction: 'suspicious'
    });
  }

  if (signals.affiliateLinkCount > 2) {
    intentScores.commercial += 0.25;
    collectedSignals.push({
      type: 'affiliate_links',
      value: signals.affiliateLinkCount,
      weight: 0.25,
      direction: 'suspicious'
    });
  }

  // ----- Coordination signals -----
  if (signals.whataboutismDensity > 0.1) {
    intentScores.stateSponsored += 0.1;
    intentScores.troll += 0.1;
    coordination += 10;
    collectedSignals.push({
      type: 'whataboutism',
      value: signals.whataboutismDensity,
      weight: 0.1,
      direction: 'suspicious'
    });
  }

  // ----- Positive authenticity signals -----
  if (signals.personalVoice > 0.7) {
    authenticity += 15;
    intentScores.organic += 0.15;
    collectedSignals.push({
      type: 'personal_voice',
      value: signals.personalVoice,
      weight: 0.15,
      direction: 'authentic'
    });
  }

  if (signals.nuancedArguments > 0.5) {
    authenticity += 10;
    intentScores.organic += 0.1;
    collectedSignals.push({
      type: 'nuanced_arguments',
      value: signals.nuancedArguments,
      weight: 0.1,
      direction: 'authentic'
    });
  }

  if (signals.originalContent > 0.8) {
    authenticity += 10;
    collectedSignals.push({
      type: 'original_content',
      value: signals.originalContent,
      weight: 0.1,
      direction: 'authentic'
    });
  }

  // ----- Known actor override -----
  if (knownActor) {
    const categoryKey = knownActor.category;
    const weight = knownActor.confidence;

    // Set primary intent based on known category
    intentScores[categoryKey] = weight;

    // Reduce other categories proportionally
    const remaining = 1 - weight;
    for (const key of Object.keys(intentScores) as AuthorIntent[]) {
      if (key !== categoryKey) {
        intentScores[key] *= remaining;
      }
    }

    // Adjust authenticity based on category
    if (knownActor.category === 'bot') {
      authenticity = Math.round(authenticity * (1 - weight) + 10 * weight);
    }

    // Adjust coordination for state-sponsored
    if (knownActor.category === 'stateSponsored') {
      coordination = Math.round(coordination * (1 - weight) + 85 * weight);
    }

    collectedSignals.push({
      type: 'known_actor',
      value: knownActor.category,
      weight: knownActor.confidence,
      direction: 'suspicious'
    });
  }

  // ----- Apply metadata signals -----
  if (author.metadata?.accountAge !== undefined && author.metadata.accountAge < 30) {
    authenticity -= 10;
    collectedSignals.push({
      type: 'new_account',
      value: author.metadata.accountAge,
      weight: 0.1,
      direction: 'suspicious'
    });
  }

  if (author.metadata?.verified) {
    authenticity += 15;
    intentScores.organic += 0.1;
    collectedSignals.push({
      type: 'verified_account',
      value: true,
      weight: 0.15,
      direction: 'authentic'
    });
  }

  // Normalize intent scores
  const total = Object.values(intentScores).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(intentScores) as AuthorIntent[]) {
    intentScores[key] /= total;
  }

  // Determine primary intent
  const sortedIntents = Object.entries(intentScores)
    .sort((a, b) => b[1] - a[1]);
  const primaryIntent = sortedIntents[0];

  // Determine data quality
  const dataQuality = determineDataQuality(signals, knownActor, author.metadata);

  return {
    authenticity: clamp(Math.round(authenticity), 0, 100),
    coordination: clamp(Math.round(coordination), 0, 100),
    intent: {
      primary: primaryIntent[0] as AuthorIntent,
      confidence: primaryIntent[1],
      breakdown: intentScores
    },
    authorId: author.identifier,
    platform: author.platform,
    knownActor: knownActor || undefined,
    signals: collectedSignals,
    dataQuality
  };
}

/**
 * Determine data quality based on available signals
 */
function determineDataQuality(
  signals: ContentSignals,
  knownActor: KnownActorEntry | null,
  metadata: Record<string, any> | undefined
): 'high' | 'medium' | 'low' | 'minimal' {
  let score = 0;

  // Known actor = high quality data
  if (knownActor && knownActor.confidence > 0.8) return 'high';

  // Check available metadata
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

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Create default author classification for when no author is found
 */
export function getDefaultAuthorClassification(): AuthorClassification {
  return {
    authenticity: 50,
    coordination: 20,
    intent: {
      primary: 'organic',
      confidence: 0.5,
      breakdown: {
        organic: 0.5,
        troll: 0.1,
        bot: 0.1,
        stateSponsored: 0.1,
        commercial: 0.1,
        activist: 0.1
      }
    },
    signals: [],
    dataQuality: 'minimal'
  };
}

/**
 * Get author intent display info
 */
export function getAuthorIntentInfo(intent: AuthorIntent): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  const info: Record<AuthorIntent, { label: string; color: string; icon: string; description: string }> = {
    organic: {
      label: 'Organic',
      color: '#22c55e',
      icon: '✓',
      description: 'Genuine personal or organizational expression'
    },
    troll: {
      label: 'Troll',
      color: '#ef4444',
      icon: '🔥',
      description: 'Provocative, disruptive intent'
    },
    bot: {
      label: 'Bot',
      color: '#f59e0b',
      icon: '🤖',
      description: 'Automated spam or amplification'
    },
    stateSponsored: {
      label: 'State-Sponsored',
      color: '#dc2626',
      icon: '🏛️',
      description: 'Government-affiliated disinformation'
    },
    commercial: {
      label: 'Commercial',
      color: '#8b5cf6',
      icon: '💰',
      description: 'Marketing or promotional content'
    },
    activist: {
      label: 'Activist',
      color: '#3b82f6',
      icon: '📢',
      description: 'Organized advocacy campaigns'
    }
  };

  return info[intent];
}

/**
 * Get authenticity label
 */
export function getAuthenticityLabel(score: number): string {
  if (score < 30) return 'Bot-like';
  if (score < 50) return 'Suspicious';
  if (score < 70) return 'Unclear';
  return 'Human';
}

/**
 * Get coordination label
 */
export function getCoordinationLabel(score: number): string {
  if (score < 20) return 'Organic';
  if (score < 40) return 'Independent';
  if (score < 60) return 'Aligned';
  if (score < 80) return 'Coordinated';
  return 'Orchestrated';
}
