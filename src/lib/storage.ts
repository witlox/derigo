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
  AuthorCacheEntry
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
  // Author filters (new)
  minAuthenticity: 0,
  maxCoordination: 100,
  blockedIntents: [],
  // Display
  displayMode: 'badge',
  enabled: true,
  whitelistedDomains: []
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
      resolve({ ...DEFAULT_PREFERENCES, ...result.preferences });
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
      resolve({ ...DEFAULT_EXTERNAL_API_SETTINGS, ...result.externalAPIs });
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

/**
 * Add domain to whitelist
 */
export async function addToWhitelist(domain: string): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.whitelistedDomains.includes(domain)) {
    await setPreferences({
      whitelistedDomains: [...prefs.whitelistedDomains, domain]
    });
  }
}

/**
 * Remove domain from whitelist
 */
export async function removeFromWhitelist(domain: string): Promise<void> {
  const prefs = await getPreferences();
  await setPreferences({
    whitelistedDomains: prefs.whitelistedDomains.filter(d => d !== domain)
  });
}

/**
 * Check if domain is whitelisted
 */
export async function isWhitelisted(domain: string): Promise<boolean> {
  const prefs = await getPreferences();
  return prefs.whitelistedDomains.includes(domain) ||
         prefs.whitelistedDomains.includes(domain.replace(/^www\./, ''));
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
