/**
 * Author extraction utilities for identifying content creators
 * Extracts author information from various sources:
 * - Social media embeds (Twitter, Reddit, Facebook)
 * - Article bylines
 * - Comment sections
 * - Domain as fallback
 */

import type { ExtractedAuthor } from '../types/index.js';

/**
 * Main function to extract author from a document
 */
export function extractAuthor(doc: Document = document, url: string): ExtractedAuthor | null {
  // Try extraction in priority order
  const extractors = [
    extractTwitterAuthor,
    extractRedditAuthor,
    extractFacebookAuthor,
    extractArticleByline,
    extractCommentAuthor
  ];

  for (const extractor of extractors) {
    const author = extractor(doc);
    if (author) return author;
  }

  // Fall back to domain-as-author for organizational content
  return extractDomainAuthor(url);
}

/**
 * Extract author from Twitter/X embeds
 */
function extractTwitterAuthor(doc: Document): ExtractedAuthor | null {
  // Twitter embeds use specific class structures
  const tweetContainers = doc.querySelectorAll(
    '[data-tweet-id], .twitter-tweet, .Tweet, blockquote.twitter-tweet'
  );

  for (const container of tweetContainers) {
    // Look for username in various formats
    const usernameEl = container.querySelector(
      '[data-screen-name], .Tweet-authorScreenName, a[href*="twitter.com/"], a[href*="x.com/"]'
    );

    if (usernameEl) {
      const username = extractTwitterUsername(usernameEl);
      if (username) {
        return {
          identifier: username.toLowerCase(),
          displayName: extractDisplayName(container),
          platform: 'twitter',
          profileUrl: `https://twitter.com/${username}`,
          metadata: {
            verified: container.querySelector('[data-verified="true"], .Icon--verified, [aria-label*="Verified"]') !== null,
            tweetId: container.getAttribute('data-tweet-id'),
            timestamp: extractTimestamp(container)
          }
        };
      }
    }
  }

  // Also check for Twitter links in page that might indicate embedded content
  const twitterLinks = doc.querySelectorAll('a[href*="twitter.com/"], a[href*="x.com/"]');
  for (const link of twitterLinks) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/(?:twitter\.com|x\.com)\/([^/?#]+)(?:\/status)?/);
      if (match && match[1] && !['home', 'search', 'explore', 'i', 'intent'].includes(match[1])) {
        return {
          identifier: match[1].toLowerCase(),
          platform: 'twitter',
          profileUrl: `https://twitter.com/${match[1]}`,
          metadata: {}
        };
      }
    }
  }

  return null;
}

/**
 * Extract username from Twitter element
 */
function extractTwitterUsername(el: Element): string | null {
  if (el.hasAttribute('data-screen-name')) {
    return el.getAttribute('data-screen-name');
  }

  const href = el.getAttribute('href');
  if (href) {
    const match = href.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/);
    if (match) return match[1];
  }

  const text = el.textContent?.trim();
  if (text?.startsWith('@')) return text.slice(1);

  return null;
}

/**
 * Extract author from Reddit embeds
 */
function extractRedditAuthor(doc: Document): ExtractedAuthor | null {
  // Reddit embed selectors
  const redditContainers = doc.querySelectorAll(
    '.reddit-embed, [data-reddit-embed], iframe[src*="reddit.com"], blockquote[cite*="reddit.com"]'
  );

  for (const container of redditContainers) {
    const authorEl = container.querySelector(
      '[data-author], .author, a[href*="/user/"], a[href*="/u/"]'
    );

    if (authorEl) {
      const username = extractRedditUsername(authorEl);
      if (username) {
        return {
          identifier: username.toLowerCase(),
          platform: 'reddit',
          profileUrl: `https://reddit.com/user/${username}`,
          metadata: {
            subreddit: extractSubreddit(container),
            postId: extractRedditPostId(container)
          }
        };
      }
    }
  }

  // Check for Reddit links
  const redditLinks = doc.querySelectorAll('a[href*="reddit.com/r/"], a[href*="reddit.com/u/"]');
  for (const link of redditLinks) {
    const href = link.getAttribute('href');
    if (href) {
      const userMatch = href.match(/reddit\.com\/u(?:ser)?\/([^/?#]+)/);
      if (userMatch) {
        return {
          identifier: userMatch[1].toLowerCase(),
          platform: 'reddit',
          profileUrl: `https://reddit.com/user/${userMatch[1]}`,
          metadata: {}
        };
      }
    }
  }

  return null;
}

/**
 * Extract Reddit username from element
 */
function extractRedditUsername(el: Element): string | null {
  if (el.hasAttribute('data-author')) {
    return el.getAttribute('data-author');
  }

  const href = el.getAttribute('href');
  if (href) {
    const match = href.match(/\/u(?:ser)?\/([^/?#]+)/);
    if (match) return match[1];
  }

  const text = el.textContent?.trim();
  if (text?.startsWith('u/')) return text.slice(2);

  return null;
}

/**
 * Extract subreddit from Reddit container
 */
function extractSubreddit(container: Element): string | null {
  const subredditEl = container.querySelector('a[href*="/r/"]');
  if (subredditEl) {
    const href = subredditEl.getAttribute('href');
    const match = href?.match(/\/r\/([^/?#]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract Reddit post ID
 */
function extractRedditPostId(container: Element): string | null {
  const href = container.getAttribute('cite') || container.querySelector('a')?.getAttribute('href');
  if (href) {
    const match = href.match(/comments\/([a-z0-9]+)/i);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract author from Facebook embeds
 */
function extractFacebookAuthor(doc: Document): ExtractedAuthor | null {
  const fbContainers = doc.querySelectorAll(
    '.fb-post, [data-href*="facebook.com"], iframe[src*="facebook.com"]'
  );

  for (const container of fbContainers) {
    const href = container.getAttribute('data-href') || container.getAttribute('src');
    if (href) {
      const match = href.match(/facebook\.com\/([^/?#]+)/);
      if (match && !['plugins', 'sharer', 'share'].includes(match[1])) {
        return {
          identifier: match[1].toLowerCase(),
          platform: 'facebook',
          profileUrl: `https://facebook.com/${match[1]}`,
          metadata: {}
        };
      }
    }
  }

  return null;
}

/**
 * Extract author from article byline
 */
function extractArticleByline(doc: Document): ExtractedAuthor | null {
  // Common byline selectors (ordered by specificity)
  const bylineSelectors = [
    // Structured data
    '[itemprop="author"]',
    '[rel="author"]',
    // Schema.org
    '[itemtype*="Person"] [itemprop="name"]',
    // Common class names
    '.author-name',
    '.byline__name',
    '.article-author',
    '.post-author',
    '.author',
    '.byline',
    // News site specific
    '.ArticleAuthor',
    '.story-meta__author',
    '[data-testid="author-name"]',
    '.contributor-name',
    '.article__author-name',
    // Generic patterns
    'a[href*="/author/"]',
    'a[href*="/writers/"]',
    'a[href*="/contributor/"]'
  ];

  for (const selector of bylineSelectors) {
    const el = doc.querySelector(selector);
    if (el) {
      const name = el.textContent?.trim();
      if (name && name.length > 2 && name.length < 100) {
        return {
          identifier: normalizeAuthorName(name),
          displayName: name,
          platform: 'article',
          profileUrl: extractAuthorUrl(el),
          metadata: {
            publication: extractPublication(doc),
            publishDate: extractPublishDate(doc)
          }
        };
      }
    }
  }

  // Try meta tags
  const metaAuthor = doc.querySelector('meta[name="author"]');
  if (metaAuthor) {
    const content = metaAuthor.getAttribute('content');
    if (content && content.length > 2) {
      return {
        identifier: normalizeAuthorName(content),
        displayName: content,
        platform: 'article',
        metadata: {
          publication: extractPublication(doc)
        }
      };
    }
  }

  return null;
}

/**
 * Normalize author name for consistent identification
 */
function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Extract author profile URL
 */
function extractAuthorUrl(el: Element): string | undefined {
  if (el.tagName === 'A') {
    return el.getAttribute('href') || undefined;
  }
  const link = el.closest('a') || el.querySelector('a');
  return link?.getAttribute('href') || undefined;
}

/**
 * Extract publication name
 */
function extractPublication(doc: Document): string | undefined {
  const selectors = [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
    '.site-name',
    '.publication-name'
  ];

  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (el) {
      const content = el.getAttribute('content') || el.textContent;
      if (content) return content.trim();
    }
  }

  return undefined;
}

/**
 * Extract publish date
 */
function extractPublishDate(doc: Document): string | undefined {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
    'time[datetime]',
    '.publish-date',
    '.article-date'
  ];

  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (el) {
      const content = el.getAttribute('content') || el.getAttribute('datetime') || el.textContent;
      if (content) return content.trim();
    }
  }

  return undefined;
}

/**
 * Extract author from comment sections
 */
function extractCommentAuthor(doc: Document): ExtractedAuthor | null {
  // Common comment system selectors
  const commentSelectors = [
    // Disqus
    '.post-meta__name',
    '.author-name',
    // WordPress
    '.comment-author',
    '.fn',
    // Generic
    '.comment-user',
    '.commenter-name'
  ];

  // Only extract if we're in a comment context
  const commentContainer = doc.querySelector(
    '#comments, .comments-section, [data-comments]'
  );

  if (!commentContainer) return null;

  // Note: Comment authors are lower confidence
  // Return primary/first comment author
  for (const selector of commentSelectors) {
    const el = commentContainer.querySelector(selector);
    if (el) {
      const name = el.textContent?.trim();
      if (name && name.length > 1) {
        return {
          identifier: normalizeAuthorName(name) || 'anonymous',
          displayName: name,
          platform: 'comment',
          metadata: {
            system: detectCommentSystem(doc)
          }
        };
      }
    }
  }

  return null;
}

/**
 * Detect comment system in use
 */
function detectCommentSystem(doc: Document): string | undefined {
  if (doc.querySelector('#disqus_thread, .dsq-widget')) return 'disqus';
  if (doc.querySelector('.fb-comments')) return 'facebook';
  if (doc.querySelector('[data-isso-id]')) return 'isso';
  if (doc.querySelector('.commentbox')) return 'commentbox';
  return 'unknown';
}

/**
 * Extract display name from container
 */
function extractDisplayName(container: Element): string | undefined {
  const nameSelectors = [
    '.Tweet-authorName',
    '.fullname',
    '[data-name]',
    '.author-name'
  ];

  for (const selector of nameSelectors) {
    const el = container.querySelector(selector);
    if (el) {
      const name = el.getAttribute('data-name') || el.textContent;
      if (name) return name.trim();
    }
  }

  return undefined;
}

/**
 * Extract timestamp from container
 */
function extractTimestamp(container: Element): string | undefined {
  const timeEl = container.querySelector('time[datetime], .timestamp, .tweet-timestamp');
  if (timeEl) {
    return timeEl.getAttribute('datetime') || timeEl.textContent?.trim();
  }
  return undefined;
}

/**
 * Extract domain as author (fallback for organizational content)
 */
function extractDomainAuthor(url: string): ExtractedAuthor {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');

    return {
      identifier: domain,
      displayName: domain,
      platform: 'unknown',
      profileUrl: url,
      metadata: {
        isOrganization: true,
        domain: domain
      }
    };
  } catch {
    return {
      identifier: 'unknown',
      platform: 'unknown',
      metadata: {
        isOrganization: true
      }
    };
  }
}

/**
 * Get author cache key for storage
 */
export function getAuthorCacheKey(author: ExtractedAuthor): string {
  return `${author.platform}:${author.identifier}`;
}
