/**
 * Content extraction utilities for analyzing page content
 */

// Selectors for main content areas (priority order)
const CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.content',
  '.post',
  '#content',
  '#main'
];

// Selectors to skip (ads, navigation, etc.)
const SKIP_SELECTORS = [
  'nav',
  'footer',
  'header',
  'aside',
  '.ad',
  '.ads',
  '.advertisement',
  '.sidebar',
  '.comments',
  '.comment',
  '.social-share',
  '.related-posts',
  '.newsletter',
  '.popup',
  '.modal',
  'script',
  'style',
  'noscript',
  'iframe',
  '[role="navigation"]',
  '[role="complementary"]',
  '[aria-hidden="true"]'
];

/**
 * Extract relevant text content from a document
 */
export function extractPageContent(doc: Document = document): string {
  // Try to find main content area first
  let contentElement: Element | null = null;

  for (const selector of CONTENT_SELECTORS) {
    contentElement = doc.querySelector(selector);
    if (contentElement) break;
  }

  // Fall back to body if no main content found
  if (!contentElement) {
    contentElement = doc.body;
  }

  if (!contentElement) {
    return '';
  }

  // Clone the element to avoid modifying the actual page
  const clone = contentElement.cloneNode(true) as Element;

  // Remove elements we want to skip
  for (const selector of SKIP_SELECTORS) {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  }

  // Extract text content
  const text = extractText(clone);

  return normalizeWhitespace(text);
}

/**
 * Extract text from an element, preserving some structure
 */
function extractText(element: Element): string {
  const parts: string[] = [];

  // Get title/headline with extra weight
  const headline = element.querySelector('h1');
  if (headline) {
    parts.push(headline.textContent || '');
    parts.push(headline.textContent || ''); // Duplicate for extra weight
  }

  // Get subheadings
  const subheadings = element.querySelectorAll('h2, h3');
  subheadings.forEach(h => {
    parts.push(h.textContent || '');
  });

  // Get paragraphs
  const paragraphs = element.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.textContent || '';
    if (text.length > 20) { // Skip very short paragraphs
      parts.push(text);
    }
  });

  // Get list items
  const listItems = element.querySelectorAll('li');
  listItems.forEach(li => {
    const text = li.textContent || '';
    if (text.length > 10) {
      parts.push(text);
    }
  });

  // Get blockquotes
  const quotes = element.querySelectorAll('blockquote');
  quotes.forEach(q => {
    parts.push(q.textContent || '');
  });

  // If we didn't get much content, fall back to innerText
  if (parts.join(' ').length < 200) {
    return element.textContent || '';
  }

  return parts.join('\n\n');
}

/**
 * Normalize whitespace in text
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extract metadata from the page
 */
export function extractMetadata(doc: Document = document): {
  title: string;
  description: string;
  author: string;
  publishDate: string;
  siteName: string;
} {
  const getMeta = (names: string[]): string => {
    for (const name of names) {
      const el = doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      if (el) {
        return el.getAttribute('content') || '';
      }
    }
    return '';
  };

  return {
    title: doc.title || getMeta(['og:title', 'twitter:title']),
    description: getMeta(['description', 'og:description', 'twitter:description']),
    author: getMeta(['author', 'article:author']),
    publishDate: getMeta(['article:published_time', 'date', 'pubdate']),
    siteName: getMeta(['og:site_name', 'application-name'])
  };
}

/**
 * Check if the current page should be analyzed
 */
export function shouldAnalyzePage(location: Location = window.location): boolean {
  // Skip browser internal pages
  const skipProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'data:'];
  if (skipProtocols.some(p => location.protocol === p)) {
    return false;
  }

  // Skip file protocol
  if (location.protocol === 'file:') {
    return false;
  }

  // Skip common non-content pages
  const skipPatterns = [
    /\/login/i,
    /\/signin/i,
    /\/signup/i,
    /\/register/i,
    /\/cart/i,
    /\/checkout/i,
    /\/account/i,
    /\/settings/i,
    /\/search/i
  ];

  if (skipPatterns.some(p => p.test(location.pathname))) {
    return false;
  }

  return true;
}

/**
 * Get the TTL for caching based on the URL type
 */
export function getCacheTTL(url: string): number {
  const hostname = new URL(url).hostname;

  // Social media - shorter TTL (content changes frequently)
  const socialMedia = [
    'twitter.com', 'x.com',
    'facebook.com', 'fb.com',
    'reddit.com',
    'instagram.com',
    'tiktok.com',
    'linkedin.com'
  ];
  if (socialMedia.some(s => hostname.includes(s))) {
    return 60 * 60 * 1000; // 1 hour
  }

  // News sites - medium TTL
  const newsSites = [
    'news', 'cnn', 'bbc', 'reuters', 'nytimes', 'washingtonpost',
    'guardian', 'foxnews', 'msnbc', 'npr'
  ];
  if (newsSites.some(s => hostname.includes(s))) {
    return 6 * 60 * 60 * 1000; // 6 hours
  }

  // Default - longer TTL
  return 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Truncate content to a maximum length (for API calls)
 */
export function truncateContent(text: string, maxLength: number = 2000): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to truncate at a sentence boundary
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  const breakPoint = Math.max(lastPeriod, lastNewline);
  if (breakPoint > maxLength * 0.7) {
    return truncated.substring(0, breakPoint + 1);
  }

  return truncated + '...';
}
