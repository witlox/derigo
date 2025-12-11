/**
 * Author Extractor unit tests
 */

import { extractAuthor, getAuthorCacheKey } from '../../src/lib/author-extractor';
import type { ExtractedAuthor } from '../../src/types/index';

// Helper to create a mock document
function createMockDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('Author Extractor', () => {
  describe('getAuthorCacheKey', () => {
    it('creates cache key from platform and identifier', () => {
      const author: ExtractedAuthor = {
        identifier: 'testuser',
        platform: 'twitter',
        metadata: {}
      };
      expect(getAuthorCacheKey(author)).toBe('twitter:testuser');
    });

    it('handles different platforms', () => {
      const platforms: ExtractedAuthor['platform'][] = ['twitter', 'reddit', 'facebook', 'article', 'comment', 'unknown'];

      for (const platform of platforms) {
        const author: ExtractedAuthor = {
          identifier: 'user123',
          platform,
          metadata: {}
        };
        expect(getAuthorCacheKey(author)).toBe(`${platform}:user123`);
      }
    });
  });

  describe('extractAuthor - Twitter', () => {
    it('extracts author from Twitter embed with data-screen-name', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <blockquote class="twitter-tweet">
              <a data-screen-name="elonmusk" href="https://twitter.com/elonmusk">@elonmusk</a>
              <p>Tweet content here</p>
            </blockquote>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('twitter');
      expect(result?.identifier).toBe('elonmusk');
    });

    it('extracts author from Twitter link in page', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <a href="https://twitter.com/jack/status/123456">Tweet by @jack</a>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('twitter');
      expect(result?.identifier).toBe('jack');
    });

    it('extracts author from x.com links', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <a href="https://x.com/someuser/status/123456">Post</a>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.identifier).toBe('someuser');
    });

    it('ignores Twitter system pages', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <a href="https://twitter.com/home">Home</a>
            <a href="https://twitter.com/search">Search</a>
            <a href="https://twitter.com/explore">Explore</a>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      // Should fall back to domain
      expect(result?.platform).toBe('unknown');
    });

    it('detects verified status from metadata', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <blockquote class="twitter-tweet" data-tweet-id="123456">
              <a data-screen-name="verified_user" href="https://twitter.com/verified_user">@verified_user</a>
              <span class="Icon--verified" aria-label="Verified account"></span>
            </blockquote>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.metadata?.verified).toBe(true);
    });
  });

  describe('extractAuthor - Reddit', () => {
    it('extracts author from Reddit embed', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <blockquote cite="https://reddit.com/r/technology/comments/abc123">
              <a href="https://reddit.com/user/redditor123">u/redditor123</a>
              <p>Comment content</p>
            </blockquote>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('reddit');
      expect(result?.identifier).toBe('redditor123');
    });

    it('extracts author from Reddit user links', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <a href="https://reddit.com/u/cooluser">u/cooluser</a>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.platform).toBe('reddit');
      expect(result?.identifier).toBe('cooluser');
    });

    it('extracts subreddit from Reddit content', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div class="reddit-embed">
              <a href="https://reddit.com/r/programming/comments/abc123">Post</a>
              <a data-author="coder42" href="/user/coder42">coder42</a>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.metadata?.subreddit).toBe('programming');
    });
  });

  describe('extractAuthor - Facebook', () => {
    it('extracts author from Facebook embed', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div class="fb-post" data-href="https://facebook.com/zuck/posts/123456">
              Post content
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('facebook');
      expect(result?.identifier).toBe('zuck');
    });

    it('ignores Facebook system pages', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div class="fb-post" data-href="https://facebook.com/sharer/sharer.php">
              Share dialog
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      // Should fall back to article byline or domain
      expect(result?.platform).not.toBe('facebook');
    });
  });

  describe('extractAuthor - Article Bylines', () => {
    it('extracts author from itemprop="author"', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <article>
              <h1>Article Title</h1>
              <span itemprop="author">John Smith</span>
              <p>Article content...</p>
            </article>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('article');
      expect(result?.displayName).toBe('John Smith');
      expect(result?.identifier).toBe('john_smith');
    });

    it('extracts author from rel="author" link', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <article>
              <a rel="author" href="/authors/jane-doe">Jane Doe</a>
              <p>Article content...</p>
            </article>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result?.displayName).toBe('Jane Doe');
      expect(result?.profileUrl).toBe('/authors/jane-doe');
    });

    it('extracts author from .author-name class', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div class="article">
              <span class="author-name">Bob Wilson</span>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result?.displayName).toBe('Bob Wilson');
    });

    it('extracts author from .byline class', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div class="byline">Sarah Johnson</div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result?.displayName).toBe('Sarah Johnson');
    });

    it('extracts author from /author/ URL pattern', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <a href="/author/tech-writer">Tech Writer</a>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result?.profileUrl).toContain('/author/');
    });

    it('extracts author from meta tag', () => {
      const doc = createMockDocument(`
        <html>
          <head>
            <meta name="author" content="Meta Author Name">
          </head>
          <body>
            <p>Article without visible byline...</p>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result?.displayName).toBe('Meta Author Name');
    });

    it('extracts publication from og:site_name', () => {
      const doc = createMockDocument(`
        <html>
          <head>
            <meta property="og:site_name" content="Tech News Daily">
          </head>
          <body>
            <span itemprop="author">Reporter Name</span>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://technews.example.com/article');

      expect(result?.metadata?.publication).toBe('Tech News Daily');
    });

    it('extracts publish date from article:published_time', () => {
      const doc = createMockDocument(`
        <html>
          <head>
            <meta property="article:published_time" content="2024-01-15T10:30:00Z">
          </head>
          <body>
            <span itemprop="author">News Writer</span>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://news.example.com/article');

      expect(result?.metadata?.publishDate).toBe('2024-01-15T10:30:00Z');
    });

    it('ignores very short or very long author names', () => {
      const docShort = createMockDocument(`
        <html><body><span itemprop="author">AB</span></body></html>
      `);

      const docLong = createMockDocument(`
        <html><body><span itemprop="author">${'A'.repeat(150)}</span></body></html>
      `);

      const resultShort = extractAuthor(docShort, 'https://example.com/article');
      const resultLong = extractAuthor(docLong, 'https://example.com/article');

      // Should fall back to domain for invalid names
      expect(resultShort?.platform).toBe('unknown');
      expect(resultLong?.platform).toBe('unknown');
    });
  });

  describe('extractAuthor - Comment Systems', () => {
    it('extracts author from Disqus comments', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div id="comments">
              <div class="post-meta__name">Commenter User</div>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('comment');
      expect(result?.displayName).toBe('Commenter User');
    });

    it('extracts author from WordPress comments', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <div id="comments">
              <div class="comment-author">
                <span class="fn">WordPress User</span>
              </div>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.platform).toBe('comment');
      expect(result?.displayName).toBe('WordPress User');
    });

    it('detects disqus comment system type', () => {
      // Use post-meta__name which is a disqus-specific selector
      const docDisqus = createMockDocument(`
        <html>
          <body>
            <div id="disqus_thread"></div>
            <div id="comments">
              <div class="post-meta__name">Disqus User</div>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(docDisqus, 'https://example.com/article');

      expect(result?.platform).toBe('comment');
      expect(result?.metadata?.system).toBe('disqus');
    });

    it('detects facebook comment system type', () => {
      // Use commenter-name which is a comment-specific selector
      const docFb = createMockDocument(`
        <html>
          <body>
            <div class="fb-comments"></div>
            <div id="comments">
              <div class="commenter-name">FB User</div>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(docFb, 'https://example.com/article');

      expect(result?.platform).toBe('comment');
      expect(result?.metadata?.system).toBe('facebook');
    });

    it('returns unknown for generic comment systems', () => {
      // Use comment-user which is comment-specific
      const doc = createMockDocument(`
        <html>
          <body>
            <div id="comments">
              <div class="comment-user">Generic User</div>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.platform).toBe('comment');
      expect(result?.metadata?.system).toBe('unknown');
    });

    it('only extracts from comment context', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <!-- No #comments or .comments-section container -->
            <div class="comment-author">
              <span class="fn">Not In Comments</span>
            </div>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      // Should fall back to domain, not extract as comment
      expect(result?.platform).not.toBe('comment');
    });
  });

  describe('extractAuthor - Domain Fallback', () => {
    it('falls back to domain when no author found', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <p>Just some content without any author information.</p>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://www.example.com/page');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('unknown');
      expect(result?.identifier).toBe('example.com');
      expect(result?.metadata?.isOrganization).toBe(true);
    });

    it('strips www from domain', () => {
      const doc = createMockDocument('<html><body><p>Content</p></body></html>');
      const result = extractAuthor(doc, 'https://www.subdomain.example.com/page');

      expect(result?.identifier).toBe('subdomain.example.com');
    });

    it('handles invalid URLs gracefully', () => {
      const doc = createMockDocument('<html><body><p>Content</p></body></html>');
      const result = extractAuthor(doc, 'not-a-valid-url');

      expect(result).not.toBeNull();
      expect(result?.identifier).toBe('unknown');
    });
  });

  describe('Extraction Priority', () => {
    it('prioritizes social media over article bylines', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <blockquote class="twitter-tweet">
              <a data-screen-name="twitter_user" href="https://twitter.com/twitter_user">@twitter_user</a>
            </blockquote>
            <span itemprop="author">Article Author</span>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      // Should extract Twitter author first
      expect(result?.platform).toBe('twitter');
      expect(result?.identifier).toBe('twitter_user');
    });

    it('prioritizes Twitter over Reddit', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <a href="https://twitter.com/tweet_user">Tweet</a>
            <a href="https://reddit.com/user/reddit_user">Reddit</a>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.platform).toBe('twitter');
    });
  });

  describe('Author Name Normalization', () => {
    it('normalizes author name to lowercase identifier', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <span itemprop="author">John Q. Public Jr.</span>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.identifier).toBe('john_q_public_jr');
      expect(result?.displayName).toBe('John Q. Public Jr.');
    });

    it('removes special characters from identifier', () => {
      const doc = createMockDocument(`
        <html>
          <body>
            <span itemprop="author">Dr. Jane O'Brien-Smith!</span>
          </body>
        </html>
      `);

      const result = extractAuthor(doc, 'https://example.com/article');

      expect(result?.identifier).toBe('dr_jane_obriensmith');
    });
  });
});

describe('Edge Cases', () => {
  it('handles empty document', () => {
    const doc = createMockDocument('<html><body></body></html>');
    const result = extractAuthor(doc, 'https://example.com/');

    expect(result).not.toBeNull();
    expect(result?.platform).toBe('unknown');
  });

  it('handles document with only whitespace text', () => {
    const doc = createMockDocument('<html><body>   \n\t   </body></html>');
    const result = extractAuthor(doc, 'https://example.com/');

    expect(result).not.toBeNull();
  });

  it('handles multiple Twitter embeds - returns first', () => {
    const doc = createMockDocument(`
      <html>
        <body>
          <blockquote class="twitter-tweet">
            <a data-screen-name="first_user">@first_user</a>
          </blockquote>
          <blockquote class="twitter-tweet">
            <a data-screen-name="second_user">@second_user</a>
          </blockquote>
        </body>
      </html>
    `);

    const result = extractAuthor(doc, 'https://example.com/article');

    expect(result?.identifier).toBe('first_user');
  });

  it('handles special characters in URLs', () => {
    const doc = createMockDocument('<html><body><p>Content</p></body></html>');
    const result = extractAuthor(doc, 'https://example.com/path?query=value&other=123#hash');

    expect(result?.identifier).toBe('example.com');
  });
});
