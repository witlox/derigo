# Migration Plan: Current State to Target Architecture

## Current State Analysis

The existing codebase has several issues that need addressing:

### Problems with Current Implementation

1. **Node.js SQLite in browser context**
   - `content.js` uses `require('sqlite3')` which won't work in browser
   - Browser extensions can't use Node.js modules

2. **Duplicated files**
   - Files exist in both root (`/`) and `/extension/` directories
   - Extension directory files are empty placeholders

3. **localStorage in content scripts**
   - `localStorage` access is unreliable in content scripts
   - Should use Chrome Storage API instead

4. **Single-dimensional classification**
   - Current categories: "Extreme Left", "Extreme Right", etc.
   - Need multi-axis scoring system

5. **No build system**
   - Raw JS files, no TypeScript
   - No bundling or minification

## Migration Steps

### Phase 1: Project Structure

**Goal**: Clean up and establish proper project structure.

```bash
# Remove duplicates
rm -rf extension/  # Empty placeholders

# Create new structure
mkdir -p src/{content,popup,options,lib,background}
mkdir -p data
mkdir -p tests/{unit,integration,e2e,fixtures,mocks}
mkdir -p scripts
mkdir -p dist
```

**Move and rename files**:
- `manifest.json` → `src/manifest.json` (will copy to dist)
- `background.js` → `src/background/service-worker.ts`
- `content.js` → `src/content/content.ts` (rewrite)
- `popup.html/js` → `src/popup/` (rewrite)
- `styles.css` → `src/content/styles.css` (expand)
- `db_init.js` → `scripts/generate-data.ts` (transform to JSON)

### Phase 2: Build System Setup

**Install dependencies**:
```bash
npm init -y
npm install -D typescript esbuild @types/chrome
npm install -D jest @types/jest ts-jest
npm install -D playwright @playwright/test
npm install -D eslint prettier
```

**Create `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Create build script** (`scripts/build.ts`):
```typescript
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

async function build() {
  // Bundle TypeScript files
  await esbuild.build({
    entryPoints: [
      'src/background/service-worker.ts',
      'src/content/content.ts',
      'src/popup/popup.ts',
      'src/options/options.ts'
    ],
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    target: 'chrome100',
    minify: process.env.NODE_ENV === 'production'
  });

  // Copy static files
  mkdirSync('dist/icons', { recursive: true });
  copyFileSync('src/manifest.json', 'dist/manifest.json');
  copyFileSync('src/popup/popup.html', 'dist/popup.html');
  // ... etc
}

build();
```

**Update `package.json`**:
```json
{
  "name": "derigo",
  "version": "1.0.0",
  "scripts": {
    "build": "tsx scripts/build.ts",
    "dev": "tsx scripts/build.ts --watch",
    "test": "jest",
    "test:e2e": "playwright test",
    "lint": "eslint src/",
    "package": "npm run build && cd dist && zip -r ../derigo.zip ."
  }
}
```

### Phase 3: Data Migration

**Convert SQLite schema to JSON**:

Transform `db_init.js` categories and keywords into JSON data files:

`data/keywords.json`:
```json
{
  "keywords": [
    {
      "term": "socialism",
      "axis": "economic",
      "direction": -1,
      "weight": 7
    },
    {
      "term": "nationalize",
      "axis": "economic",
      "direction": -1,
      "weight": 8
    },
    {
      "term": "deregulation",
      "axis": "economic",
      "direction": 1,
      "weight": 6
    }
    // ... hundreds more
  ]
}
```

`data/sources.json`:
```json
{
  "sources": [
    {
      "domain": "nytimes.com",
      "name": "New York Times",
      "factualRating": 78,
      "biasRating": {
        "economic": -25,
        "social": -30,
        "authority": 10,
        "globalism": 40
      }
    }
    // ... many more
  ]
}
```

### Phase 4: Storage Layer

**Replace SQLite with IndexedDB**:

```typescript
// src/lib/storage.ts
const DB_NAME = 'derigo';
const DB_VERSION = 1;

export async function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Classifications cache
      const classStore = db.createObjectStore('classifications', {
        keyPath: 'urlHash'
      });
      classStore.createIndex('timestamp', 'timestamp');
      classStore.createIndex('domain', 'domain');

      // Source reputation (pre-populated)
      const sourceStore = db.createObjectStore('sources', {
        keyPath: 'domain'
      });
      sourceStore.createIndex('factualRating', 'factualRating');

      // Keywords (pre-populated)
      const keywordStore = db.createObjectStore('keywords', {
        keyPath: 'id',
        autoIncrement: true
      });
      keywordStore.createIndex('axis', 'axis');
      keywordStore.createIndex('term', 'term');
    };
  });
}

// Seed initial data on install
export async function seedInitialData(db: IDBDatabase): Promise<void> {
  const keywordsData = await fetch(chrome.runtime.getURL('data/keywords.json'));
  const sourcesData = await fetch(chrome.runtime.getURL('data/sources.json'));

  // ... populate stores
}
```

**Replace localStorage with Chrome Storage**:

```typescript
// src/lib/preferences.ts
export interface UserPreferences {
  economicRange: [number, number] | null;
  socialRange: [number, number] | null;
  authorityRange: [number, number] | null;
  globalismRange: [number, number] | null;
  minTruthScore: number;
  displayMode: 'block' | 'overlay' | 'badge' | 'off';
  enableEnhancedAnalysis: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  economicRange: null,
  socialRange: null,
  authorityRange: null,
  globalismRange: null,
  minTruthScore: 0,
  displayMode: 'badge',
  enableEnhancedAnalysis: false
};

export async function getPreferences(): Promise<UserPreferences> {
  const result = await chrome.storage.sync.get('preferences');
  return { ...DEFAULT_PREFERENCES, ...result.preferences };
}

export async function setPreferences(
  prefs: Partial<UserPreferences>
): Promise<void> {
  const current = await getPreferences();
  await chrome.storage.sync.set({
    preferences: { ...current, ...prefs }
  });
}
```

### Phase 5: Classification Engine Rewrite

**Implement multi-axis scoring**:

```typescript
// src/lib/classifier.ts
import keywordsData from '../data/keywords.json';

interface ClassificationResult {
  economic: number;
  social: number;
  authority: number;
  globalism: number;
  truthScore: number;
  confidence: number;
}

export function classifyContent(
  text: string,
  sourceRating: SourceReputation | null
): ClassificationResult {
  const normalizedText = text.toLowerCase();
  const axes = {
    economic: { sum: 0, count: 0 },
    social: { sum: 0, count: 0 },
    authority: { sum: 0, count: 0 },
    globalism: { sum: 0, count: 0 }
  };

  // Score each keyword
  for (const keyword of keywordsData.keywords) {
    if (normalizedText.includes(keyword.term)) {
      const axis = axes[keyword.axis];
      axis.sum += keyword.direction * keyword.weight;
      axis.count += 1;
    }
  }

  // Calculate axis scores
  const result: ClassificationResult = {
    economic: normalizeScore(axes.economic),
    social: normalizeScore(axes.social),
    authority: normalizeScore(axes.authority),
    globalism: normalizeScore(axes.globalism),
    truthScore: calculateTruthScore(text, sourceRating),
    confidence: calculateConfidence(axes, sourceRating)
  };

  // Blend with source reputation if available
  if (sourceRating) {
    result.economic = blend(result.economic, sourceRating.biasRating.economic, 0.3);
    // ... blend other axes
  }

  return result;
}
```

### Phase 6: Content Script Rewrite

```typescript
// src/content/content.ts
import { classifyContent } from '../lib/classifier';
import { getPreferences } from '../lib/preferences';
import { applyDisplay } from './display';
import { extractContent } from './extractor';

async function main() {
  // Skip non-content pages
  if (!shouldAnalyze()) return;

  // Check cache
  const cached = await checkCache(location.href);
  if (cached) {
    await applyDisplay(cached, await getPreferences());
    return;
  }

  // Extract and classify
  const content = extractContent(document);
  const sourceRating = await lookupSource(location.hostname);
  const result = classifyContent(content, sourceRating);

  // Apply user preferences
  const prefs = await getPreferences();
  await applyDisplay(result, prefs);

  // Cache result
  await cacheResult(location.href, result);
}

main();
```

### Phase 7: UI Implementation

Implement popup and options pages as described in `ui-components.md`.

### Phase 8: Testing

1. Write unit tests for classifier
2. Write integration tests for storage
3. Write E2E tests for full flow
4. Manual testing on target sites

### Phase 9: Polish

1. Create extension icons (16, 48, 128 px)
2. Write extension description
3. Add screenshots for store listing
4. Performance optimization
5. Security audit

## File Changes Summary

| Old File | Action | New Location |
|----------|--------|--------------|
| `manifest.json` | Update | `src/manifest.json` |
| `background.js` | Rewrite | `src/background/service-worker.ts` |
| `content.js` | Rewrite | `src/content/content.ts` |
| `popup.html` | Update | `src/popup/popup.html` |
| `popup.js` | Rewrite | `src/popup/popup.ts` |
| `styles.css` | Expand | `src/content/styles.css` |
| `db_init.js` | Transform | `data/keywords.json`, `data/sources.json` |
| `extension/*` | Delete | - |
| `classification.db` | Delete | - |

## Estimated Effort

Breaking this into work units (not time-based):

1. **Project setup**: Build system, dependencies, config files
2. **Data layer**: IndexedDB, Chrome Storage, data files
3. **Classifier**: Multi-axis scoring, confidence calculation
4. **Content script**: Extraction, classification flow, caching
5. **Display modes**: Block, overlay, badge implementations
6. **Popup UI**: Current page display, quick settings
7. **Options UI**: Full settings page, filter sliders
8. **Testing**: Unit, integration, E2E tests
9. **Polish**: Icons, descriptions, optimization
