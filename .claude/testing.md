# Testing Strategy

## Test Categories

### 1. Unit Tests

Test individual functions and modules in isolation.

**Classification Logic**:
```typescript
// tests/classifier.test.ts
import { classifyKeywords, calculateAxisScore } from '../src/lib/classifier';

describe('Keyword Classification', () => {
  test('detects left economic keywords', () => {
    const text = 'We need to nationalize healthcare and increase wealth tax';
    const result = classifyKeywords(text);

    expect(result.economic).toBeLessThan(-30);
  });

  test('detects right economic keywords', () => {
    const text = 'Deregulation and tax cuts will boost free enterprise';
    const result = classifyKeywords(text);

    expect(result.economic).toBeGreaterThan(30);
  });

  test('returns neutral for balanced content', () => {
    const text = 'The economy grew 2% last quarter according to reports';
    const result = classifyKeywords(text);

    expect(Math.abs(result.economic)).toBeLessThan(20);
  });

  test('handles empty content', () => {
    const result = classifyKeywords('');

    expect(result.economic).toBe(0);
    expect(result.confidence).toBe(0);
  });
});

describe('Axis Score Calculation', () => {
  test('normalizes scores to -100..100 range', () => {
    const score = calculateAxisScore([
      { direction: -1, weight: 10 },
      { direction: 1, weight: 5 }
    ]);

    expect(score).toBeGreaterThanOrEqual(-100);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

**Source Reputation**:
```typescript
// tests/sources.test.ts
import { lookupSource, getSourceScore } from '../src/lib/sources';

describe('Source Lookup', () => {
  test('finds known source by domain', async () => {
    const source = await lookupSource('nytimes.com');

    expect(source).not.toBeNull();
    expect(source.name).toBe('New York Times');
  });

  test('handles subdomain lookup', async () => {
    const source = await lookupSource('www.nytimes.com');

    expect(source).not.toBeNull();
  });

  test('returns null for unknown source', async () => {
    const source = await lookupSource('unknown-random-site-12345.com');

    expect(source).toBeNull();
  });
});
```

**Caching**:
```typescript
// tests/cache.test.ts
import { ClassificationCache } from '../src/lib/cache';

describe('Classification Cache', () => {
  let cache: ClassificationCache;

  beforeEach(() => {
    cache = new ClassificationCache();
  });

  test('stores and retrieves results', async () => {
    const result = { economic: 20, social: -10, /* ... */ };
    await cache.set('https://example.com/article', result);

    const cached = await cache.get('https://example.com/article');
    expect(cached).toEqual(result);
  });

  test('returns null for expired entries', async () => {
    // Set entry with short TTL
    await cache.set('https://example.com', result, { ttl: 1 });

    // Wait for expiry
    await new Promise(r => setTimeout(r, 10));

    const cached = await cache.get('https://example.com');
    expect(cached).toBeNull();
  });
});
```

### 2. Integration Tests

Test interactions between components.

```typescript
// tests/integration/classification-flow.test.ts
import { analyzeContent } from '../src/content/analyzer';
import { mockChrome } from './mocks/chrome';

describe('Full Classification Flow', () => {
  beforeAll(() => {
    global.chrome = mockChrome();
  });

  test('classifies page and caches result', async () => {
    const mockDocument = createMockDocument(`
      <article>
        <h1>Progressive Tax Reform Needed</h1>
        <p>Experts argue for wealth redistribution policies...</p>
      </article>
    `);

    const result = await analyzeContent(mockDocument, 'https://news.example.com/article');

    expect(result.economic).toBeLessThan(0); // Left-leaning
    expect(result.cached).toBe(false);

    // Second call should hit cache
    const cachedResult = await analyzeContent(mockDocument, 'https://news.example.com/article');
    expect(cachedResult.cached).toBe(true);
  });
});
```

### 3. E2E Tests

Test the full extension in a browser environment.

**Using Playwright**:
```typescript
// tests/e2e/extension.test.ts
import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Derigo Extension', () => {
  test('loads and shows badge on news article', async () => {
    const pathToExtension = path.join(__dirname, '../../dist');

    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });

    const page = await browser.newPage();
    await page.goto('https://www.bbc.com/news');

    // Wait for badge to appear
    const badge = page.locator('.derigo-badge');
    await expect(badge).toBeVisible({ timeout: 10000 });

    // Click badge to expand
    await badge.click();

    // Check classification is shown
    const economicAxis = page.locator('#axis-economic');
    await expect(economicAxis).toBeVisible();

    await browser.close();
  });

  test('blocks content when filter matches', async () => {
    // Setup: configure to block far-left content

    const page = await browser.newPage();
    await page.goto('https://some-left-leaning-site.com');

    // Should show block screen
    const blockScreen = page.locator('.derigo-block-screen');
    await expect(blockScreen).toBeVisible();

    // Click "View Anyway"
    await page.click('#derigo-proceed');

    // Block screen should be gone, badge should appear
    await expect(blockScreen).not.toBeVisible();
    await expect(page.locator('.derigo-badge')).toBeVisible();
  });
});
```

### 4. Manual Testing Checklist

**Sites to test**:
- [ ] Major news: NYT, BBC, CNN, Fox News, Reuters, AP
- [ ] Opinion sites: various political blogs
- [ ] Social media: Twitter/X, Facebook, Reddit
- [ ] Alternative media: various independent outlets
- [ ] Satire: The Onion, Babylon Bee
- [ ] Misinformation (known): fact-check verified false stories

**Scenarios**:
- [ ] Fresh install experience
- [ ] Classification accuracy (compare to known ratings)
- [ ] Performance on content-heavy pages
- [ ] Memory usage over extended browsing
- [ ] Settings sync across devices
- [ ] Display mode switching
- [ ] Filter configuration
- [ ] Whitelist functionality

## Test Data

### Sample Content Fixtures

```typescript
// tests/fixtures/content.ts
export const leftEconomicContent = `
The government must take bold action to address income inequality.
Universal healthcare and free college education are essential rights.
We need stronger regulations on corporations and higher taxes on the wealthy.
Workers deserve better wages and stronger union protections.
`;

export const rightEconomicContent = `
Lower taxes and reduced regulations will spur economic growth.
Free market solutions outperform government intervention.
Individual liberty and private enterprise drive innovation.
Small business owners need relief from burdensome regulations.
`;

export const neutralContent = `
The quarterly earnings report showed mixed results.
Weather forecasts predict rain for the weekend.
Local sports team won their game yesterday.
New restaurant opened downtown last week.
`;

export const highTruthContent = `
According to the CDC, vaccination rates increased 5% last month.
The Federal Reserve announced a 0.25% interest rate increase.
NASA confirmed the successful launch of the satellite at 3:45 PM EST.
`;

export const lowTruthContent = `
SHOCKING: Secret documents reveal EVERYTHING they don't want you to know!
Scientists EXPOSED: The truth about [topic] will BLOW YOUR MIND!
Share before this gets DELETED!!!
`;
```

### Mock Chrome APIs

```typescript
// tests/mocks/chrome.ts
export function mockChrome() {
  return {
    storage: {
      sync: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined)
      },
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined)
      }
    },
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn()
      },
      onInstalled: {
        addListener: jest.fn()
      }
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn()
    }
  };
}
```

## Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build
      - run: npx playwright install chromium
      - run: npm run test:e2e
```

## Coverage Requirements

- Unit test coverage: >80%
- Critical paths (classification, filtering): >95%
- Integration tests for all message types
- E2E tests for main user flows
