import type {
  UserPreferences,
  ExternalAPISettings,
  CacheEntry,
  ClassificationResult,
  SourceEntry,
  KeywordEntry,
  KnownActorEntry,
  ExtractedAuthor,
  AuthorClassification,
  AuthorCacheEntry,
  SiteProfile
} from '../types/index.js';

// Database constants
const DB_NAME = 'derigo';
const DB_VERSION = 2;  // Updated for author classification

// Default user preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  economicRange: null,
  socialRange: null,
  authorityRange: null,
  globalismRange: null,
  minTruthScore: 0,
  // Author filters
  minAuthenticity: 0,
  maxCoordination: 100,
  blockedIntents: [],
  // Display
  displayMode: 'badge',
  enabled: true,
  // Site profiles
  siteProfiles: []
};

// Default external API settings - ALL DISABLED
export const DEFAULT_EXTERNAL_API_SETTINGS: ExternalAPISettings = {
  allowExternalCalls: false,
  factCheck: {
    enabled: false,
    apiKey: '',
    tier: 'free'
  },
  claimBuster: {
    enabled: false,
    apiKey: '',
    tier: 'free'
  },
  newsGuard: {
    enabled: false,
    apiKey: '',
    tier: 'basic'
  },
  aiClassification: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
    tier: 'payg',
    autoAnalyze: false,
    confidenceThreshold: 0.7
  },
  authorDatabase: {
    enabled: false,
    botSentinel: {
      enabled: false,
      apiKey: '',
      tier: 'free'
    },
    usePublicLists: true  // Use bundled known actors list
  }
};

// IndexedDB database instance
let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Classifications cache
      if (!database.objectStoreNames.contains('classifications')) {
        const classStore = database.createObjectStore('classifications', {
          keyPath: 'urlHash'
        });
        classStore.createIndex('timestamp', 'timestamp');
        classStore.createIndex('domain', 'domain');
      }

      // Source reputation (pre-populated)
      if (!database.objectStoreNames.contains('sources')) {
        const sourceStore = database.createObjectStore('sources', {
          keyPath: 'domain'
        });
        sourceStore.createIndex('factualRating', 'factualRating');
      }

      // Keywords (pre-populated)
      if (!database.objectStoreNames.contains('keywords')) {
        const keywordStore = database.createObjectStore('keywords', {
          keyPath: 'id',
          autoIncrement: true
        });
        keywordStore.createIndex('axis', 'axis');
        keywordStore.createIndex('term', 'term');
      }

      // Author cache (new in version 2)
      if (!database.objectStoreNames.contains('authors')) {
        const authorStore = database.createObjectStore('authors', {
          keyPath: 'authorKey'
        });
        authorStore.createIndex('timestamp', 'timestamp');
        authorStore.createIndex('platform', 'platform');
      }

      // Known actors database (new in version 2)
      if (!database.objectStoreNames.contains('knownActors')) {
        const actorStore = database.createObjectStore('knownActors', {
          keyPath: 'actorKey'
        });
        actorStore.createIndex('platform', 'platform');
        actorStore.createIndex('category', 'category');
      }
    };
  });
}

/**
 * Get the database instance, initializing if needed
 */
async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    await initDatabase();
  }
  return db!;
}

// ============================================
// Chrome Storage API functions (for settings)
// ============================================

/**
 * Get user preferences from Chrome storage
 */
export async function getPreferences(): Promise<UserPreferences> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('preferences', (result) => {
      const stored = result.preferences as Partial<UserPreferences> | undefined;
      resolve({ ...DEFAULT_PREFERENCES, ...stored });
    });
  });
}

/**
 * Set user preferences in Chrome storage
 */
export async function setPreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const current = await getPreferences();
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      preferences: { ...current, ...prefs }
    }, resolve);
  });
}

/**
 * Get external API settings from Chrome storage
 */
export async function getExternalAPISettings(): Promise<ExternalAPISettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('externalAPIs', (result) => {
      const stored = result.externalAPIs as Partial<ExternalAPISettings> | undefined;
      resolve({ ...DEFAULT_EXTERNAL_API_SETTINGS, ...stored });
    });
  });
}

/**
 * Set external API settings in Chrome storage
 */
export async function setExternalAPISettings(settings: Partial<ExternalAPISettings>): Promise<void> {
  const current = await getExternalAPISettings();
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      externalAPIs: { ...current, ...settings }
    }, resolve);
  });
}

/**
 * Check if external API calls are allowed for a specific API
 */
export async function canMakeExternalCall(apiName: keyof Omit<ExternalAPISettings, 'allowExternalCalls'>): Promise<boolean> {
  const settings = await getExternalAPISettings();

  // Master switch must be on
  if (!settings.allowExternalCalls) return false;

  // Individual API must be enabled
  const apiSettings = settings[apiName];
  if (!apiSettings?.enabled) return false;

  // Check for apiKey for APIs that require it (not authorDatabase)
  if (apiName !== 'authorDatabase') {
    const settingsWithKey = apiSettings as { apiKey?: string };
    if (!settingsWithKey.apiKey) return false;
  }

  return true;
}

// ============================================
// IndexedDB functions (for cache and data)
// ============================================

/**
 * Hash a URL for cache key
 */
export async function hashUrl(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get cached classification result
 */
export async function getCachedClassification(url: string): Promise<CacheEntry | null> {
  const database = await getDB();
  const hash = await hashUrl(url);

  return new Promise((resolve) => {
    const tx = database.transaction('classifications', 'readonly');
    const store = tx.objectStore('classifications');
    const request = store.get(hash);

    request.onsuccess = () => {
      const entry = request.result as CacheEntry | undefined;
      if (entry && Date.now() - entry.timestamp < entry.ttl) {
        resolve(entry);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

/**
 * Cache a classification result
 */
export async function cacheClassification(
  url: string,
  result: ClassificationResult,
  ttl: number = 24 * 60 * 60 * 1000
): Promise<void> {
  const database = await getDB();
  const hash = await hashUrl(url);
  const domain = new URL(url).hostname;

  const entry: CacheEntry = {
    urlHash: hash,
    domain,
    result,
    timestamp: Date.now(),
    ttl
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction('classifications', 'readwrite');
    const store = tx.objectStore('classifications');
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const database = await getDB();
  const now = Date.now();
  let cleared = 0;

  return new Promise((resolve) => {
    const tx = database.transaction('classifications', 'readwrite');
    const store = tx.objectStore('classifications');
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        const entry = cursor.value as CacheEntry;
        if (now - entry.timestamp >= entry.ttl) {
          cursor.delete();
          cleared++;
        }
        cursor.continue();
      } else {
        resolve(cleared);
      }
    };
    request.onerror = () => resolve(cleared);
  });
}

/**
 * Get source reputation from database
 */
export async function getSourceReputation(domain: string): Promise<SourceEntry | null> {
  const database = await getDB();

  // Try exact match first, then try without 'www.'
  const domainsToTry = [domain, domain.replace(/^www\./, '')];

  for (const d of domainsToTry) {
    const result = await new Promise<SourceEntry | null>((resolve) => {
      const tx = database.transaction('sources', 'readonly');
      const store = tx.objectStore('sources');
      const request = store.get(d);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });

    if (result) return result;
  }

  return null;
}

/**
 * Get all keywords from database
 */
export async function getKeywords(): Promise<KeywordEntry[]> {
  const database = await getDB();

  return new Promise((resolve) => {
    const tx = database.transaction('keywords', 'readonly');
    const store = tx.objectStore('keywords');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Seed initial data into the database
 */
export async function seedInitialData(
  keywords: KeywordEntry[],
  sources: SourceEntry[]
): Promise<void> {
  const database = await getDB();

  // Seed keywords
  const keywordTx = database.transaction('keywords', 'readwrite');
  const keywordStore = keywordTx.objectStore('keywords');

  for (const keyword of keywords) {
    keywordStore.put(keyword);
  }

  // Seed sources
  const sourceTx = database.transaction('sources', 'readwrite');
  const sourceStore = sourceTx.objectStore('sources');

  for (const source of sources) {
    sourceStore.put(source);
  }

  return new Promise((resolve) => {
    sourceTx.oncomplete = () => resolve();
  });
}

/**
 * Check if database has been seeded
 */
export async function isDatabaseSeeded(): Promise<boolean> {
  const database = await getDB();

  return new Promise((resolve) => {
    const tx = database.transaction('keywords', 'readonly');
    const store = tx.objectStore('keywords');
    const request = store.count();

    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => resolve(false);
  });
}

// ============================================
// Site Profile Functions
// ============================================

/**
 * Generate a UUID for profile IDs
 */
function generateProfileId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a new site profile
 */
export async function createSiteProfile(
  profile: Omit<SiteProfile, 'id'>
): Promise<string> {
  const prefs = await getPreferences();
  const id = generateProfileId();

  const newProfile: SiteProfile = {
    ...profile,
    id
  };

  await setPreferences({
    siteProfiles: [...prefs.siteProfiles, newProfile]
  });

  return id;
}

/**
 * Update an existing site profile
 */
export async function updateSiteProfile(
  id: string,
  updates: Partial<Omit<SiteProfile, 'id'>>
): Promise<void> {
  const prefs = await getPreferences();

  const profileIndex = prefs.siteProfiles.findIndex(p => p.id === id);
  if (profileIndex === -1) {
    throw new Error(`Profile not found: ${id}`);
  }

  const updatedProfiles = [...prefs.siteProfiles];
  updatedProfiles[profileIndex] = {
    ...updatedProfiles[profileIndex],
    ...updates
  };

  await setPreferences({
    siteProfiles: updatedProfiles
  });
}

/**
 * Delete a site profile
 */
export async function deleteSiteProfile(id: string): Promise<void> {
  const prefs = await getPreferences();

  await setPreferences({
    siteProfiles: prefs.siteProfiles.filter(p => p.id !== id)
  });
}

/**
 * Get a site profile by ID
 */
export async function getSiteProfile(id: string): Promise<SiteProfile | null> {
  const prefs = await getPreferences();
  return prefs.siteProfiles.find(p => p.id === id) || null;
}

/**
 * Get all site profiles
 */
export async function getAllSiteProfiles(): Promise<SiteProfile[]> {
  const prefs = await getPreferences();
  return prefs.siteProfiles;
}

/**
 * Check if a domain matches a profile domain (supports subdomain matching)
 */
function domainMatchesPattern(domain: string, pattern: string): boolean {
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
  const normalizedPattern = pattern.replace(/^www\./, '').toLowerCase();

  // Exact match
  if (normalizedDomain === normalizedPattern) return true;

  // Subdomain match (e.g., "news.bbc.com" matches "bbc.com")
  if (normalizedDomain.endsWith('.' + normalizedPattern)) return true;

  return false;
}

/**
 * Get the profile that applies to a domain
 * Uses most-specific-wins logic: longer matching domain takes priority
 */
export async function getProfileForDomain(domain: string): Promise<SiteProfile | null> {
  const prefs = await getPreferences();

  // Find all matching profiles
  const matches: Array<{ profile: SiteProfile; matchLength: number }> = [];

  for (const profile of prefs.siteProfiles) {
    for (const patternDomain of profile.domains) {
      if (domainMatchesPattern(domain, patternDomain)) {
        matches.push({
          profile,
          matchLength: patternDomain.length
        });
        break; // One match per profile is enough
      }
    }
  }

  if (matches.length === 0) return null;

  // Most specific wins (longest matching domain)
  matches.sort((a, b) => b.matchLength - a.matchLength);
  return matches[0].profile;
}

/**
 * Add a domain to a profile
 */
export async function addDomainToProfile(
  profileId: string,
  domain: string
): Promise<void> {
  const prefs = await getPreferences();

  const profile = prefs.siteProfiles.find(p => p.id === profileId);
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  // Normalize and check for duplicates
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
  if (profile.domains.includes(normalizedDomain)) {
    return; // Already exists
  }

  await updateSiteProfile(profileId, {
    domains: [...profile.domains, normalizedDomain]
  });
}

/**
 * Remove a domain from a profile
 */
export async function removeDomainFromProfile(
  profileId: string,
  domain: string
): Promise<void> {
  const prefs = await getPreferences();

  const profile = prefs.siteProfiles.find(p => p.id === profileId);
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

  await updateSiteProfile(profileId, {
    domains: profile.domains.filter(d => d !== normalizedDomain)
  });
}

/**
 * Check if a domain is disabled (either via profile or legacy whitelist)
 */
export async function isDomainDisabled(domain: string): Promise<boolean> {
  const profile = await getProfileForDomain(domain);
  return profile?.overrides.displayMode === 'disabled';
}

// ============================================
// Author Cache Functions
// ============================================

/**
 * Get author cache key
 */
function getAuthorCacheKey(author: ExtractedAuthor): string {
  return `${author.platform}:${author.identifier}`;
}

/**
 * Get cached author classification
 */
export async function getCachedAuthor(author: ExtractedAuthor): Promise<AuthorCacheEntry | null> {
  const database = await getDB();
  const key = getAuthorCacheKey(author);

  return new Promise((resolve) => {
    const tx = database.transaction('authors', 'readonly');
    const store = tx.objectStore('authors');
    const request = store.get(key);

    request.onsuccess = () => {
      const entry = request.result as AuthorCacheEntry | undefined;
      if (entry && Date.now() - entry.timestamp < entry.ttl) {
        resolve(entry);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

/**
 * Cache an author classification
 */
export async function cacheAuthor(
  author: ExtractedAuthor,
  classification: AuthorClassification,
  source: 'local' | 'external' | 'ai' = 'local'
): Promise<void> {
  const database = await getDB();
  const key = getAuthorCacheKey(author);

  // TTL varies by data quality and platform
  let ttl = 6 * 60 * 60 * 1000; // 6 hours default
  if (classification.dataQuality === 'high') {
    ttl = 7 * 24 * 60 * 60 * 1000; // 7 days for high confidence
  } else if (['twitter', 'reddit'].includes(author.platform)) {
    ttl = 12 * 60 * 60 * 1000; // 12 hours for social media
  }

  const entry: AuthorCacheEntry = {
    authorKey: key,
    classification,
    timestamp: Date.now(),
    ttl,
    source
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction('authors', 'readwrite');
    const store = tx.objectStore('authors');
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear expired author cache entries
 */
export async function clearExpiredAuthorCache(): Promise<number> {
  const database = await getDB();
  const now = Date.now();
  let cleared = 0;

  return new Promise((resolve) => {
    const tx = database.transaction('authors', 'readwrite');
    const store = tx.objectStore('authors');
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        const entry = cursor.value as AuthorCacheEntry;
        if (now - entry.timestamp >= entry.ttl) {
          cursor.delete();
          cleared++;
        }
        cursor.continue();
      } else {
        resolve(cleared);
      }
    };
    request.onerror = () => resolve(cleared);
  });
}

// ============================================
// Known Actors Functions
// ============================================

// In-memory cache for known actors
let knownActorsCache: Map<string, KnownActorEntry> | null = null;

/**
 * Get known actor entry for an author
 */
export async function getKnownActor(author: ExtractedAuthor): Promise<KnownActorEntry | null> {
  // Try memory cache first
  if (knownActorsCache) {
    const key = `${author.platform}:${author.identifier}`;
    const allKey = `all:${author.identifier}`;
    return knownActorsCache.get(key) || knownActorsCache.get(allKey) || null;
  }

  // Fall back to database lookup
  const database = await getDB();
  const key = `${author.platform}:${author.identifier}`;

  return new Promise((resolve) => {
    const tx = database.transaction('knownActors', 'readonly');
    const store = tx.objectStore('knownActors');

    // Try exact platform match
    const request1 = store.get(key);
    request1.onsuccess = () => {
      if (request1.result) {
        resolve(request1.result);
        return;
      }

      // Try "all" platform match
      const allKey = `all:${author.identifier}`;
      const request2 = store.get(allKey);
      request2.onsuccess = () => resolve(request2.result || null);
      request2.onerror = () => resolve(null);
    };
    request1.onerror = () => resolve(null);
  });
}

/**
 * Seed known actors from data file
 */
export async function seedKnownActors(actors: KnownActorEntry[]): Promise<void> {
  const database = await getDB();

  // Clear existing entries
  const clearTx = database.transaction('knownActors', 'readwrite');
  const clearStore = clearTx.objectStore('knownActors');
  await new Promise<void>((resolve) => {
    const clearRequest = clearStore.clear();
    clearRequest.onsuccess = () => resolve();
  });

  // Add new entries
  const tx = database.transaction('knownActors', 'readwrite');
  const store = tx.objectStore('knownActors');

  for (const actor of actors) {
    const key = `${actor.platform}:${actor.identifier}`;
    store.put({ ...actor, actorKey: key });
  }

  // Update memory cache
  knownActorsCache = new Map();
  for (const actor of actors) {
    const key = `${actor.platform}:${actor.identifier}`;
    knownActorsCache.set(key, actor);
  }

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
}

/**
 * Load known actors into memory cache
 */
export async function loadKnownActorsCache(): Promise<void> {
  const database = await getDB();

  return new Promise((resolve) => {
    const tx = database.transaction('knownActors', 'readonly');
    const store = tx.objectStore('knownActors');
    const request = store.getAll();

    request.onsuccess = () => {
      knownActorsCache = new Map();
      for (const actor of request.result) {
        knownActorsCache.set(actor.actorKey, actor);
      }
      resolve();
    };
    request.onerror = () => {
      knownActorsCache = new Map();
      resolve();
    };
  });
}

/**
 * Get all known actors
 */
export async function getAllKnownActors(): Promise<KnownActorEntry[]> {
  const database = await getDB();

  return new Promise((resolve) => {
    const tx = database.transaction('knownActors', 'readonly');
    const store = tx.objectStore('knownActors');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Check if known actors database has been seeded
 */
export async function isKnownActorsSeeded(): Promise<boolean> {
  const database = await getDB();

  return new Promise((resolve) => {
    const tx = database.transaction('knownActors', 'readonly');
    const store = tx.objectStore('knownActors');
    const request = store.count();

    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => resolve(false);
  });
}
