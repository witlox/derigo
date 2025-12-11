// ============================================
// Author Classification Types
// ============================================

// Author intent categories
export type AuthorIntent = 'organic' | 'troll' | 'bot' | 'stateSponsored' | 'commercial' | 'activist';

// Platform types for author extraction
export type AuthorPlatform = 'twitter' | 'reddit' | 'facebook' | 'article' | 'comment' | 'unknown';

// Extracted author information from page
export interface ExtractedAuthor {
  identifier: string;          // Username, byline, or unique ID
  displayName?: string;
  platform: AuthorPlatform;
  profileUrl?: string;
  metadata: Record<string, any>; // Platform-specific data (verified, accountAge, etc.)
}

// Author classification result
export interface AuthorClassification {
  authenticity: number;        // 0 (bot-like) to 100 (human)
  coordination: number;        // 0 (organic) to 100 (orchestrated)
  intent: {
    primary: AuthorIntent;
    confidence: number;        // 0-1 confidence in primary
    breakdown: {
      organic: number;
      troll: number;
      bot: number;
      stateSponsored: number;
      commercial: number;
      activist: number;
    };
  };
  authorId?: string;           // Extracted identifier
  platform?: AuthorPlatform;
  knownActor?: KnownActorEntry; // Match from database if found
  signals: AuthorSignal[];     // Evidence used for classification
  dataQuality: 'high' | 'medium' | 'low' | 'minimal';
}

// Signal used in author classification
export interface AuthorSignal {
  type: string;
  value: number | string | boolean;
  weight: number;
  direction: 'authentic' | 'suspicious' | 'neutral';
}

// Known actor database entry
export interface KnownActorEntry {
  identifier: string;          // Username or pattern
  platform: AuthorPlatform | 'all';
  category: AuthorIntent;
  confidence: number;          // 0-1
  source: string;              // Attribution (e.g., "Stanford IO Report 2023")
  addedDate: string;
  attribution?: {
    country?: string;          // e.g., "Russia", "China", "Iran"
    campaign?: string;         // e.g., "Internet Research Agency"
    organization?: string;
  };
}

// Content-based signals for author analysis
export interface ContentSignals {
  repetitivePatterns: number;
  templateLikelihood: number;
  unnaturalPhrasing: number;
  emotionalLanguageDensity: number;
  personalAttacks: number;
  badFaithArguments: number;
  engagementBaiting: number;
  promotionalLanguage: number;
  affiliateLinkCount: number;
  productMentions: number;
  coordinatedNarratives: number;
  whataboutismDensity: number;
  personalVoice: number;
  nuancedArguments: number;
  originalContent: number;
}

// ============================================
// Site Profile Types
// ============================================

// Display mode including 'disabled' for skipping analysis entirely
export type DisplayMode = 'block' | 'overlay' | 'badge' | 'off' | 'disabled';

// Site profile for per-domain filter customization
export interface SiteProfile {
  id: string;                    // UUID
  name: string;                  // e.g., "News Sites"
  description?: string;
  domains: string[];             // Assigned domains (supports subdomain matching)
  // Partial overrides - undefined means "use global default"
  overrides: {
    economicRange?: [number, number] | null;
    socialRange?: [number, number] | null;
    authorityRange?: [number, number] | null;
    globalismRange?: [number, number] | null;
    minTruthScore?: number;
    minAuthenticity?: number;
    maxCoordination?: number;
    blockedIntents?: AuthorIntent[];
    displayMode?: DisplayMode;
  };
}

// ============================================
// Content Classification Types
// ============================================

// Content classification result (political alignment)
export interface ContentClassification {
  economic: number;      // -100 (left) to +100 (right)
  social: number;        // -100 (progressive) to +100 (conservative)
  authority: number;     // -100 (libertarian) to +100 (authoritarian)
  globalism: number;     // -100 (nationalist) to +100 (globalist)
  truthScore: number;    // 0 to 100
}

// Full classification result (content + author)
export interface FullClassificationResult {
  content: ContentClassification;
  author: AuthorClassification;
  confidence: number;    // 0 to 1
  source: 'local' | 'enhanced';
  timestamp: number;
}

// Classification result
export interface ClassificationResult {
  economic: number;      // -100 (left) to +100 (right)
  social: number;        // -100 (progressive) to +100 (conservative)
  authority: number;     // -100 (libertarian) to +100 (authoritarian)
  globalism: number;     // -100 (nationalist) to +100 (globalist)
  truthScore: number;    // 0 to 100
  confidence: number;    // 0 to 1
  source: string;        // 'local' or 'local+ai+factCheck' etc.
  timestamp: number;
  // Author classification (optional)
  author?: AuthorClassification;
  // Enhanced analysis data (when external APIs are used)
  enhancedData?: EnhancedAnalysisData;
}

// Data from enhanced analysis (external APIs)
export interface EnhancedAnalysisData {
  aiAnalysis?: {
    reasoning: {
      economic: string;
      social: string;
      authority: string;
      globalism: string;
      truthfulness: string;
    };
    claims: Array<{
      claim: string;
      assessment: string;
    }>;
  };
  factChecks?: Array<{
    query: string;
    results: Array<{
      text: string;
      reviews: Array<{
        publisher: string;
        rating: string;
        url: string;
      }>;
    }>;
  }>;
  botSentinel?: {
    rating: number;
    category: 'normal' | 'satisfactory' | 'alarming' | 'problematic';
    isTrollBot: boolean;
  };
}

// User preferences for filtering
export interface UserPreferences {
  // Content filters (null = no filter)
  economicRange: [number, number] | null;
  socialRange: [number, number] | null;
  authorityRange: [number, number] | null;
  globalismRange: [number, number] | null;

  // Truthfulness threshold (0-100, content below this triggers action)
  minTruthScore: number;

  // Author filters
  minAuthenticity: number;           // 0-100, filter authors below this
  maxCoordination: number;           // 0-100, filter authors above this
  blockedIntents: AuthorIntent[];    // Block specific author types

  // Display behavior (global default, can be overridden by profiles)
  displayMode: DisplayMode;

  // Extension enabled
  enabled: boolean;

  // Enhanced analysis (external APIs)
  enableEnhancedAnalysis: boolean;

  // Site profiles for per-domain customization
  siteProfiles: SiteProfile[];
}

// External API settings
export type AIProvider = 'openai' | 'anthropic' | 'google';
export type OpenAITier = 'payg' | 'plus' | 'team' | 'enterprise';
export type AnthropicTier = 'payg' | 'pro' | 'team' | 'enterprise';
export type GoogleTier = 'free' | 'payg' | 'enterprise';

export interface FactCheckAPISettings {
  enabled: boolean;
  apiKey: string;
  tier: 'free' | 'paid';
  dailyLimit?: number;
}

export interface ClaimBusterAPISettings {
  enabled: boolean;
  apiKey: string;
  tier: 'free' | 'research' | 'commercial';
  endpoint?: string;
}

export interface NewsGuardAPISettings {
  enabled: boolean;
  apiKey: string;
  tier: 'basic' | 'professional' | 'enterprise';
  organizationId?: string;
}

export interface AIClassificationSettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  model?: string;
  tier: OpenAITier | AnthropicTier | GoogleTier;
  autoAnalyze: boolean;
  confidenceThreshold: number;
  monthlyBudget?: number;
  requestsPerMinute?: number;
}

// Author database API settings
export interface BotSentinelSettings {
  enabled: boolean;
  apiKey: string;
  tier: 'free' | 'basic' | 'pro';
}

export interface AuthorDatabaseAPISettings {
  enabled: boolean;
  botSentinel: BotSentinelSettings;
  usePublicLists: boolean;  // Use bundled known actors list
}

export interface ExternalAPISettings {
  allowExternalCalls: boolean;
  factCheck: FactCheckAPISettings;
  claimBuster: ClaimBusterAPISettings;
  newsGuard: NewsGuardAPISettings;
  aiClassification: AIClassificationSettings;
  authorDatabase: AuthorDatabaseAPISettings;
}

// Keyword entry for scoring
export interface KeywordEntry {
  term: string;
  axis: 'economic' | 'social' | 'authority' | 'globalism';
  direction: -1 | 1;  // -1 for left/progressive/lib/nationalist, +1 for right/conservative/auth/globalist
  weight: number;     // 1-10 strength
  context?: string[]; // Required context words (optional)
}

// Source reputation entry
export interface SourceEntry {
  domain: string;
  name: string;
  factualRating: number;  // 0-100
  biasRating: {
    economic: number;
    social: number;
    authority: number;
    globalism: number;
  };
  category: string;       // news, opinion, satire, etc.
  country?: string;
  lastVerified?: string;  // ISO date
  sources?: string[];     // Where ratings came from
}

// Cache entry for classification results
export interface CacheEntry {
  urlHash: string;
  domain: string;
  result: ClassificationResult;
  timestamp: number;
  ttl: number;
}

// Cache entry for author classification
export interface AuthorCacheEntry {
  authorKey: string;          // `${platform}:${identifier}`
  classification: AuthorClassification;
  timestamp: number;
  ttl: number;
  source: 'local' | 'external' | 'ai';
}

// Filter action result
export type FilterReason =
  | 'economic'
  | 'social'
  | 'authority'
  | 'globalism'
  | 'truthfulness'
  | 'authenticity'      // Author below minimum
  | 'coordination'      // Author above maximum
  | 'authorIntent';     // Author intent in blocked list

export interface FilterAction {
  action: 'none' | 'badge' | 'overlay' | 'block';
  reason?: FilterReason;
  result: ClassificationResult;
}

// Message types for communication
export type MessageType =
  | { type: 'CLASSIFY'; data: { url: string; content: string; author?: ExtractedAuthor } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; data: UserPreferences }
  | { type: 'CACHE_RESULT'; data: { url: string; result: ClassificationResult } }
  | { type: 'CLASSIFICATION_RESULT'; data: ClassificationResult }
  | { type: 'REQUEST_ENHANCED'; data: { url: string; content: string; author?: ExtractedAuthor } }
  | { type: 'GET_CURRENT_CLASSIFICATION' }
  | { type: 'WHITELIST_DOMAIN'; data: { domain: string } }
  | { type: 'LOOKUP_AUTHOR'; data: { author: ExtractedAuthor } }
  | { type: 'AUTHOR_RESULT'; data: AuthorClassification }
  | { type: 'CACHE_AUTHOR'; data: { author: ExtractedAuthor; result: AuthorClassification } };

// API response types
export interface AIClassificationResponse {
  content: {
    economic: { score: number; reasoning: string };
    social: { score: number; reasoning: string };
    authority: { score: number; reasoning: string };
    globalism: { score: number; reasoning: string };
    truthfulness: { score: number; reasoning: string };
  };
  author: {
    authenticity: { score: number; reasoning: string };
    coordination: { score: number; reasoning: string };
    intent: {
      primary: AuthorIntent;
      confidence: number;
      reasoning: string;
    };
  };
  confidence: number;
  claims: Array<{ claim: string; assessment: string }>;
}

// Legacy API response (for backward compatibility)
export interface LegacyAIClassificationResponse {
  economic: { score: number; reasoning: string };
  social: { score: number; reasoning: string };
  authority: { score: number; reasoning: string };
  globalism: { score: number; reasoning: string };
  truthfulness: { score: number; reasoning: string };
  confidence: number;
  claims: Array<{ claim: string; assessment: string }>;
}
