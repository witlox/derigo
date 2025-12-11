// Classification result from analyzing content
export interface ClassificationResult {
  economic: number;      // -100 (left) to +100 (right)
  social: number;        // -100 (progressive) to +100 (conservative)
  authority: number;     // -100 (libertarian) to +100 (authoritarian)
  globalism: number;     // -100 (nationalist) to +100 (globalist)
  truthScore: number;    // 0 to 100
  confidence: number;    // 0 to 1
  source: 'local' | 'enhanced';
  timestamp: number;
}

// User preferences for filtering
export interface UserPreferences {
  // Political filters (null = no filter)
  economicRange: [number, number] | null;
  socialRange: [number, number] | null;
  authorityRange: [number, number] | null;
  globalismRange: [number, number] | null;

  // Truthfulness threshold (0-100, content below this triggers action)
  minTruthScore: number;

  // Display behavior
  displayMode: 'block' | 'overlay' | 'badge' | 'off';

  // Extension enabled
  enabled: boolean;

  // Whitelist domains
  whitelistedDomains: string[];
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

export interface ExternalAPISettings {
  allowExternalCalls: boolean;
  factCheck: FactCheckAPISettings;
  claimBuster: ClaimBusterAPISettings;
  newsGuard: NewsGuardAPISettings;
  aiClassification: AIClassificationSettings;
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

// Filter action result
export interface FilterAction {
  action: 'none' | 'badge' | 'overlay' | 'block';
  reason?: 'economic' | 'social' | 'authority' | 'globalism' | 'truthfulness';
  result: ClassificationResult;
}

// Message types for communication
export type MessageType =
  | { type: 'CLASSIFY'; data: { url: string; content: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; data: UserPreferences }
  | { type: 'CACHE_RESULT'; data: { url: string; result: ClassificationResult } }
  | { type: 'CLASSIFICATION_RESULT'; data: ClassificationResult }
  | { type: 'REQUEST_ENHANCED'; data: { url: string; content: string } }
  | { type: 'GET_CURRENT_CLASSIFICATION' }
  | { type: 'WHITELIST_DOMAIN'; data: { domain: string } };

// API response types
export interface AIClassificationResponse {
  economic: { score: number; reasoning: string };
  social: { score: number; reasoning: string };
  authority: { score: number; reasoning: string };
  globalism: { score: number; reasoning: string };
  truthfulness: { score: number; reasoning: string };
  confidence: number;
  claims: Array<{ claim: string; assessment: string }>;
}
