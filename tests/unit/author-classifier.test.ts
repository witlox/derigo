/**
 * Author Classifier unit tests
 */

import {
  classifyAuthor,
  analyzeContentSignals,
  getDefaultAuthorClassification,
  getAuthenticityLabel,
  getCoordinationLabel,
  getAuthorIntentInfo
} from '../../src/lib/author-classifier';
import type { ExtractedAuthor, AuthorClassification, ContentSignals } from '../../src/types/index';

// Mock the storage module to avoid IndexedDB issues in tests
jest.mock('../../src/lib/storage', () => ({
  getKnownActor: jest.fn().mockResolvedValue(null)
}));

describe('Author Classifier', () => {
  describe('getDefaultAuthorClassification', () => {
    it('returns default classification with expected values', () => {
      const result = getDefaultAuthorClassification();

      expect(result.authenticity).toBe(50);
      expect(result.coordination).toBe(20);
      expect(result.intent.primary).toBe('organic');
      expect(result.intent.confidence).toBe(0.5);
      expect(result.dataQuality).toBe('minimal');
      expect(result.signals).toEqual([]);
    });

    it('returns organic as the primary intent breakdown', () => {
      const result = getDefaultAuthorClassification();
      expect(result.intent.breakdown.organic).toBe(0.5);
    });
  });

  describe('getAuthenticityLabel', () => {
    it('returns "Human" for scores >= 70', () => {
      expect(getAuthenticityLabel(70)).toBe('Human');
      expect(getAuthenticityLabel(85)).toBe('Human');
      expect(getAuthenticityLabel(100)).toBe('Human');
    });

    it('returns "Unclear" for scores 50-69', () => {
      expect(getAuthenticityLabel(50)).toBe('Unclear');
      expect(getAuthenticityLabel(69)).toBe('Unclear');
    });

    it('returns "Suspicious" for scores 30-49', () => {
      expect(getAuthenticityLabel(30)).toBe('Suspicious');
      expect(getAuthenticityLabel(49)).toBe('Suspicious');
    });

    it('returns "Bot-like" for scores < 30', () => {
      expect(getAuthenticityLabel(0)).toBe('Bot-like');
      expect(getAuthenticityLabel(29)).toBe('Bot-like');
    });
  });

  describe('getCoordinationLabel', () => {
    it('returns "Organic" for scores < 20', () => {
      expect(getCoordinationLabel(0)).toBe('Organic');
      expect(getCoordinationLabel(19)).toBe('Organic');
    });

    it('returns "Independent" for scores 20-39', () => {
      expect(getCoordinationLabel(20)).toBe('Independent');
      expect(getCoordinationLabel(39)).toBe('Independent');
    });

    it('returns "Aligned" for scores 40-59', () => {
      expect(getCoordinationLabel(40)).toBe('Aligned');
      expect(getCoordinationLabel(59)).toBe('Aligned');
    });

    it('returns "Coordinated" for scores 60-79', () => {
      expect(getCoordinationLabel(60)).toBe('Coordinated');
      expect(getCoordinationLabel(79)).toBe('Coordinated');
    });

    it('returns "Orchestrated" for scores >= 80', () => {
      expect(getCoordinationLabel(80)).toBe('Orchestrated');
      expect(getCoordinationLabel(100)).toBe('Orchestrated');
    });
  });

  describe('getAuthorIntentInfo', () => {
    it('returns correct info for organic', () => {
      const info = getAuthorIntentInfo('organic');
      expect(info.label).toBe('Organic');
      expect(info.description).toContain('Genuine');
      expect(info.icon).toBeDefined();
      expect(info.color).toBeDefined();
    });

    it('returns correct info for troll', () => {
      const info = getAuthorIntentInfo('troll');
      expect(info.label).toBe('Troll');
      expect(info.description).toContain('Provocative');
    });

    it('returns correct info for bot', () => {
      const info = getAuthorIntentInfo('bot');
      expect(info.label).toBe('Bot');
      expect(info.description).toContain('Automated');
    });

    it('returns correct info for stateSponsored', () => {
      const info = getAuthorIntentInfo('stateSponsored');
      expect(info.label).toBe('State-Sponsored');
      expect(info.description).toContain('Government');
    });

    it('returns correct info for commercial', () => {
      const info = getAuthorIntentInfo('commercial');
      expect(info.label).toBe('Commercial');
      expect(info.description).toContain('Marketing');
    });

    it('returns correct info for activist', () => {
      const info = getAuthorIntentInfo('activist');
      expect(info.label).toBe('Activist');
      expect(info.description).toContain('advocacy');
    });
  });

  describe('analyzeContentSignals', () => {
    it('returns all signal fields', () => {
      const signals = analyzeContentSignals('Test content');

      expect(signals).toHaveProperty('repetitivePatterns');
      expect(signals).toHaveProperty('templateLikelihood');
      expect(signals).toHaveProperty('emotionalLanguageDensity');
      expect(signals).toHaveProperty('personalAttacks');
      expect(signals).toHaveProperty('badFaithArguments');
      expect(signals).toHaveProperty('engagementBaiting');
      expect(signals).toHaveProperty('promotionalLanguage');
      expect(signals).toHaveProperty('affiliateLinkCount');
      expect(signals).toHaveProperty('whataboutismDensity');
      expect(signals).toHaveProperty('personalVoice');
      expect(signals).toHaveProperty('nuancedArguments');
      expect(signals).toHaveProperty('originalContent');
    });

    it('detects emotional language density', () => {
      const content = 'This is outrageous! Disgusting and horrific behavior! Shocking and pathetic!';
      const signals = analyzeContentSignals(content);

      expect(signals.emotionalLanguageDensity).toBeGreaterThan(0);
    });

    it('detects personal attacks', () => {
      const content = "You're an idiot! People like you are the problem. Wake up sheeple!";
      const signals = analyzeContentSignals(content);

      expect(signals.personalAttacks).toBeGreaterThan(0);
    });

    it('detects bad faith arguments', () => {
      const content = "What about when they did it? So you're saying we should just ignore that?";
      const signals = analyzeContentSignals(content);

      expect(signals.badFaithArguments).toBeGreaterThan(0);
    });

    it('detects engagement baiting', () => {
      const content = 'Change my mind! Prove me wrong if you can. Hot take: unpopular opinion here';
      const signals = analyzeContentSignals(content);

      expect(signals.engagementBaiting).toBeGreaterThan(0);
    });

    it('detects promotional language', () => {
      const content = 'Buy now! Limited time offer! Click here to sign up for a free trial!';
      const signals = analyzeContentSignals(content);

      expect(signals.promotionalLanguage).toBeGreaterThan(0);
    });

    it('detects template patterns', () => {
      const content = 'Hello [name], check out {your_product} at INSERT LINK HERE';
      const signals = analyzeContentSignals(content);

      expect(signals.templateLikelihood).toBeGreaterThan(0);
    });

    it('detects affiliate links', () => {
      const content = 'Check out my favorite product: amzn.to/abc123 use ?ref=me or bit.ly/xyz';
      const signals = analyzeContentSignals(content);

      expect(signals.affiliateLinkCount).toBeGreaterThan(0);
    });

    it('detects whataboutism', () => {
      const content = 'What about when they did that? But what about the other side?';
      const signals = analyzeContentSignals(content);

      expect(signals.whataboutismDensity).toBeGreaterThan(0);
    });

    it('detects personal voice', () => {
      const content = 'I think this is interesting. In my experience, it works well. My opinion is that we should try it.';
      const signals = analyzeContentSignals(content);

      expect(signals.personalVoice).toBeGreaterThan(0);
    });

    it('detects nuanced arguments', () => {
      const content = 'On the other hand, we should consider alternatives. However, the evidence suggests otherwise. It depends on the situation.';
      const signals = analyzeContentSignals(content);

      expect(signals.nuancedArguments).toBeGreaterThan(0);
    });

    it('detects repetitive patterns', () => {
      const content = 'Buy this product. Buy this product. Buy this product. Buy this product.';
      const signals = analyzeContentSignals(content);

      expect(signals.repetitivePatterns).toBeGreaterThan(0);
    });

    it('returns low signals for neutral content', () => {
      const content = 'The weather is nice today. I went for a walk in the park.';
      const signals = analyzeContentSignals(content);

      expect(signals.personalAttacks).toBe(0);
      expect(signals.badFaithArguments).toBe(0);
      expect(signals.affiliateLinkCount).toBe(0);
    });
  });

  describe('classifyAuthor', () => {
    const baseAuthor: ExtractedAuthor = {
      identifier: 'testuser',
      platform: 'twitter',
      metadata: {}
    };

    it('classifies neutral content as organic', async () => {
      const content = 'This is a normal post about everyday things. The weather is nice today.';
      const result = await classifyAuthor(baseAuthor, content);

      expect(result.intent.primary).toBe('organic');
      expect(result.authenticity).toBeGreaterThan(40);
    });

    it('detects emotional language patterns', async () => {
      const content = `
        This is OUTRAGEOUS! Disgusting horrific pathetic insane radical extremist
        destroy attack enemy traitor corrupt evil terrible awful horrible situation!
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasEmotionalSignal = result.signals.some(
        s => s.type === 'emotional_language' && s.direction === 'suspicious'
      );
      expect(hasEmotionalSignal).toBe(true);
    });

    it('detects personal attack patterns', async () => {
      const content = `
        You're such an idiot! You're a moron! People like you are the problem.
        Wake up sheeple! Typical liberal response. You must be paid by them.
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasAttackSignal = result.signals.some(
        s => s.type === 'personal_attacks' && s.direction === 'suspicious'
      );
      expect(hasAttackSignal).toBe(true);
      expect(result.intent.breakdown.troll).toBeGreaterThan(0.1);
    });

    it('detects engagement bait patterns', async () => {
      const content = `
        Change my mind about this! Fight me if you disagree!
        Prove me wrong! I bet you can't! Hot take: controversial opinion!
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasBaitSignal = result.signals.some(
        s => s.type === 'engagement_bait' && s.direction === 'suspicious'
      );
      expect(hasBaitSignal).toBe(true);
    });

    it('detects promotional/commercial patterns', async () => {
      const content = `
        Buy now! Limited time offer! Click here to get started!
        Check out our product! Don't miss this exclusive offer!
        Use code SAVE20! Sign up today! Subscribe for more!
      `;
      const result = await classifyAuthor(baseAuthor, content);

      expect(result.intent.breakdown.commercial).toBeGreaterThan(0.1);
      const hasPromoSignal = result.signals.some(
        s => s.type === 'promotional_language' && s.direction === 'suspicious'
      );
      expect(hasPromoSignal).toBe(true);
    });

    it('detects template-like content', async () => {
      const content = `
        Hello [name]! Welcome to {your_company}!
        INSERT PRODUCT NAME HERE. Check out {{template_var}}!
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasTemplateSignal = result.signals.some(
        s => s.type === 'template_detected' && s.direction === 'suspicious'
      );
      expect(hasTemplateSignal).toBe(true);
    });

    it('detects bad faith argument patterns', async () => {
      const content = `
        What about when they did the same thing? But what about the other side?
        So you're saying we should ignore it? Nice try, but that's ridiculous.
        That's rich coming from someone like you!
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasBadFaithSignal = result.signals.some(
        s => s.type === 'bad_faith_arguments' && s.direction === 'suspicious'
      );
      expect(hasBadFaithSignal).toBe(true);
    });

    it('rewards personal voice indicators', async () => {
      const content = `
        I think this is interesting because in my experience, things work differently.
        In my opinion, we should consider multiple perspectives. I believe this is important.
        I'm not sure about everything, but I could be wrong. I guess we'll see.
        I was there when it happened. I saw it firsthand. I met the person involved.
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasPersonalVoice = result.signals.some(
        s => s.type === 'personal_voice' && s.direction === 'authentic'
      );
      expect(hasPersonalVoice).toBe(true);
      expect(result.authenticity).toBeGreaterThan(60);
    });

    it('rewards nuanced arguments', async () => {
      const content = `
        On the other hand, we should consider the downsides. However, the evidence
        suggests otherwise. Although there are benefits, it depends on the situation.
        The research shows that data suggests a more nuanced view. According to studies,
        in some cases it works, but under certain conditions it doesn't.
      `;
      const result = await classifyAuthor(baseAuthor, content);

      const hasNuanceSignal = result.signals.some(
        s => s.type === 'nuanced_arguments' && s.direction === 'authentic'
      );
      expect(hasNuanceSignal).toBe(true);
    });

    it('handles verified accounts from metadata', async () => {
      const verifiedAuthor: ExtractedAuthor = {
        identifier: 'verifieduser',
        platform: 'twitter',
        metadata: { verified: true }
      };
      const content = 'Regular post from a verified account.';
      const result = await classifyAuthor(verifiedAuthor, content);

      // Verified should boost authenticity
      expect(result.authenticity).toBeGreaterThan(70);
      const hasVerifiedSignal = result.signals.some(
        s => s.type === 'verified_account' && s.direction === 'authentic'
      );
      expect(hasVerifiedSignal).toBe(true);
    });

    it('penalizes new accounts', async () => {
      const newAuthor: ExtractedAuthor = {
        identifier: 'newuser',
        platform: 'twitter',
        metadata: { accountAge: 5 } // 5 days old
      };
      const content = 'Some regular content here.';
      const result = await classifyAuthor(newAuthor, content);

      const hasNewAccountSignal = result.signals.some(
        s => s.type === 'new_account' && s.direction === 'suspicious'
      );
      expect(hasNewAccountSignal).toBe(true);
    });

    it('classifies highly suspicious content with low authenticity', async () => {
      const content = `
        BREAKING! Share now before deleted! [name] {{template}}
        BREAKING! Share now before deleted! [name] {{template}}
        BREAKING! Share now before deleted! [name] {{template}}
        Buy now! Limited time! amzn.to/abc123 Click here!
      `;
      const result = await classifyAuthor(baseAuthor, content);

      // Should have low authenticity due to repetition and templates
      expect(result.authenticity).toBeLessThan(60);
    });

    it('sets appropriate data quality', async () => {
      // Minimal content
      const shortContent = 'Hi';
      const minResult = await classifyAuthor(baseAuthor, shortContent);
      expect(minResult.dataQuality).toBe('minimal');
    });

    it('returns all required fields in classification', async () => {
      const content = 'Test content for structure validation.';
      const result = await classifyAuthor(baseAuthor, content);

      // Check required fields exist
      expect(typeof result.authenticity).toBe('number');
      expect(typeof result.coordination).toBe('number');
      expect(result.intent).toBeDefined();
      expect(result.intent.primary).toBeDefined();
      expect(typeof result.intent.confidence).toBe('number');
      expect(result.intent.breakdown).toBeDefined();
      expect(typeof result.intent.breakdown.organic).toBe('number');
      expect(typeof result.intent.breakdown.troll).toBe('number');
      expect(typeof result.intent.breakdown.bot).toBe('number');
      expect(typeof result.intent.breakdown.stateSponsored).toBe('number');
      expect(typeof result.intent.breakdown.commercial).toBe('number');
      expect(typeof result.intent.breakdown.activist).toBe('number');
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.dataQuality).toBeDefined();
      expect(result.authorId).toBe('testuser');
      expect(result.platform).toBe('twitter');

      // Check score ranges
      expect(result.authenticity).toBeGreaterThanOrEqual(0);
      expect(result.authenticity).toBeLessThanOrEqual(100);
      expect(result.coordination).toBeGreaterThanOrEqual(0);
      expect(result.coordination).toBeLessThanOrEqual(100);
      expect(result.intent.confidence).toBeGreaterThanOrEqual(0);
      expect(result.intent.confidence).toBeLessThanOrEqual(1);
    });

    it('handles different platforms consistently', async () => {
      const platforms: ExtractedAuthor['platform'][] = ['twitter', 'reddit', 'facebook', 'article', 'comment', 'unknown'];
      const content = 'Standard content for platform testing.';

      for (const platform of platforms) {
        const author: ExtractedAuthor = {
          identifier: 'testuser',
          platform,
          metadata: {}
        };
        const result = await classifyAuthor(author, content);

        expect(result.platform).toBe(platform);
        expect(result.authorId).toBe('testuser');
      }
    });
  });
});

describe('Content Signal Analysis Edge Cases', () => {
  describe('Emotional Language Detection', () => {
    const emotionalWords = [
      'outrage', 'disgusting', 'horrific', 'unbelievable', 'shocking',
      'pathetic', 'idiotic', 'insane', 'radical', 'extremist'
    ];

    it('detects multiple emotional words', () => {
      const content = emotionalWords.slice(0, 5).join(' ');
      const signals = analyzeContentSignals(content);

      expect(signals.emotionalLanguageDensity).toBeGreaterThan(0);
    });

    it('handles empty content', () => {
      const signals = analyzeContentSignals('');

      expect(signals.emotionalLanguageDensity).toBe(0);
      expect(signals.personalAttacks).toBe(0);
    });
  });

  describe('Whataboutism Detection', () => {
    it('detects various whataboutism patterns', () => {
      const patterns = [
        'What about when they did it?',
        'But what about the other side?',
        'Yeah, but they also did it',
        'But how about considering their actions?'
      ];

      for (const pattern of patterns) {
        const signals = analyzeContentSignals(pattern);
        expect(signals.whataboutismDensity).toBeGreaterThan(0);
      }
    });
  });

  describe('Affiliate Link Detection', () => {
    it('detects various affiliate patterns', () => {
      const links = [
        'example.com?ref=me',
        'example.com?aff=123',
        'example.com?tag=affiliate',
        'amzn.to/abc123',
        'bit.ly/shortlink',
        'tinyurl.com/xyz',
        'linktr.ee/myprofile'
      ];

      for (const link of links) {
        const signals = analyzeContentSignals(`Check this: ${link}`);
        expect(signals.affiliateLinkCount).toBeGreaterThan(0);
      }
    });
  });
});

describe('Edge Cases', () => {
  const baseAuthor: ExtractedAuthor = {
    identifier: 'testuser',
    platform: 'twitter',
    metadata: {}
  };

  it('handles empty content', async () => {
    const result = await classifyAuthor(baseAuthor, '');

    expect(result.dataQuality).toBe('minimal');
    expect(result.intent.primary).toBe('organic');
  });

  it('handles very long content', async () => {
    const longContent = 'This is a test sentence. '.repeat(1000);
    const result = await classifyAuthor(baseAuthor, longContent);

    expect(result).toBeDefined();
    expect(result.authenticity).toBeGreaterThanOrEqual(0);
  });

  it('handles special characters in content', async () => {
    const content = '🔥🔥🔥 AMAZING!!! $$$ @user #hashtag <script>alert("xss")</script>';
    const result = await classifyAuthor(baseAuthor, content);

    expect(result).toBeDefined();
    expect(result.authenticity).toBeGreaterThanOrEqual(0);
  });

  it('handles content with URLs', async () => {
    const content = 'Check this out: https://example.com/path?param=value&other=123';
    const result = await classifyAuthor(baseAuthor, content);

    expect(result).toBeDefined();
  });

  it('handles non-English content gracefully', async () => {
    const content = 'これは日本語のテストです。中文测试。Тест на русском языке.';
    const result = await classifyAuthor(baseAuthor, content);

    expect(result).toBeDefined();
    expect(result.dataQuality).toBe('minimal'); // Limited signals for non-English
  });

  it('handles missing author identifier', async () => {
    const author: ExtractedAuthor = {
      identifier: '',
      platform: 'unknown',
      metadata: {}
    };
    const result = await classifyAuthor(author, 'Some content');

    expect(result).toBeDefined();
    expect(result.authorId).toBe('');
  });

  it('handles whitespace-only content', async () => {
    const result = await classifyAuthor(baseAuthor, '   \n\t   ');

    expect(result).toBeDefined();
    expect(result.dataQuality).toBe('minimal');
  });

  it('handles content with only punctuation', async () => {
    const result = await classifyAuthor(baseAuthor, '!!! ... ??? ---');

    expect(result).toBeDefined();
  });
});
