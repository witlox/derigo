/**
 * Classifier unit tests
 */

import {
  getTruthIndicator,
  formatAxisLabel,
  getScoreColor,
  getAuthenticityColor,
  getCoordinationColor,
  getIntentIndicator,
  formatFilterReason,
  determineFilterAction
} from '../../src/lib/classifier';
import type { ClassificationResult, UserPreferences, AuthorClassification, FilterReason } from '../../src/types/index';

describe('Classifier utilities', () => {
  describe('getTruthIndicator', () => {
    it('returns high indicator for scores >= 80', () => {
      const result = getTruthIndicator(85);
      expect(result.class).toBe('truth-high');
      expect(result.label).toBe('Highly credible');
    });

    it('returns medium-high indicator for scores 60-79', () => {
      const result = getTruthIndicator(70);
      expect(result.class).toBe('truth-medium-high');
      expect(result.label).toBe('Generally reliable');
    });

    it('returns medium indicator for scores 40-59', () => {
      const result = getTruthIndicator(50);
      expect(result.class).toBe('truth-medium');
      expect(result.label).toBe('Mixed/unverified');
    });

    it('returns low indicator for scores < 40', () => {
      const result = getTruthIndicator(25);
      expect(result.class).toBe('truth-low');
      expect(result.label).toBe('Low credibility');
    });
  });

  describe('formatAxisLabel', () => {
    it('returns Left for negative economic scores', () => {
      expect(formatAxisLabel('economic', -50)).toBe('Left');
    });

    it('returns Right for positive economic scores', () => {
      expect(formatAxisLabel('economic', 50)).toBe('Right');
    });

    it('returns Center for moderate scores', () => {
      expect(formatAxisLabel('economic', 0)).toBe('Center');
      expect(formatAxisLabel('economic', 20)).toBe('Center');
      expect(formatAxisLabel('economic', -20)).toBe('Center');
    });

    it('handles social axis labels', () => {
      expect(formatAxisLabel('social', -50)).toBe('Progressive');
      expect(formatAxisLabel('social', 50)).toBe('Conservative');
    });

    it('handles authority axis labels', () => {
      expect(formatAxisLabel('authority', -50)).toBe('Libertarian');
      expect(formatAxisLabel('authority', 50)).toBe('Authoritarian');
    });

    it('handles globalism axis labels', () => {
      expect(formatAxisLabel('globalism', -50)).toBe('Nationalist');
      expect(formatAxisLabel('globalism', 50)).toBe('Globalist');
    });
  });

  describe('getScoreColor', () => {
    it('returns strong blue for far left scores', () => {
      expect(getScoreColor(-70)).toBe('#2563eb');
    });

    it('returns light blue for moderate left scores', () => {
      expect(getScoreColor(-40)).toBe('#60a5fa');
    });

    it('returns gray for center scores', () => {
      expect(getScoreColor(0)).toBe('#9ca3af');
    });

    it('returns light red for moderate right scores', () => {
      expect(getScoreColor(40)).toBe('#f87171');
    });

    it('returns strong red for far right scores', () => {
      expect(getScoreColor(70)).toBe('#dc2626');
    });
  });

  describe('getAuthenticityColor', () => {
    it('returns green for high authenticity (>= 80)', () => {
      expect(getAuthenticityColor(85)).toBe('#22c55e');
      expect(getAuthenticityColor(100)).toBe('#22c55e');
    });

    it('returns light green for likely authentic (60-79)', () => {
      expect(getAuthenticityColor(60)).toBe('#84cc16');
      expect(getAuthenticityColor(79)).toBe('#84cc16');
    });

    it('returns yellow for uncertain (40-59)', () => {
      expect(getAuthenticityColor(40)).toBe('#eab308');
      expect(getAuthenticityColor(59)).toBe('#eab308');
    });

    it('returns orange for suspicious (20-39)', () => {
      expect(getAuthenticityColor(20)).toBe('#f97316');
      expect(getAuthenticityColor(39)).toBe('#f97316');
    });

    it('returns red for likely bot/fake (< 20)', () => {
      expect(getAuthenticityColor(0)).toBe('#ef4444');
      expect(getAuthenticityColor(19)).toBe('#ef4444');
    });
  });

  describe('getCoordinationColor', () => {
    it('returns green for organic (<= 20)', () => {
      expect(getCoordinationColor(0)).toBe('#22c55e');
      expect(getCoordinationColor(20)).toBe('#22c55e');
    });

    it('returns light green for likely organic (21-40)', () => {
      expect(getCoordinationColor(21)).toBe('#84cc16');
      expect(getCoordinationColor(40)).toBe('#84cc16');
    });

    it('returns yellow for some coordination (41-60)', () => {
      expect(getCoordinationColor(41)).toBe('#eab308');
      expect(getCoordinationColor(60)).toBe('#eab308');
    });

    it('returns orange for likely coordinated (61-80)', () => {
      expect(getCoordinationColor(61)).toBe('#f97316');
      expect(getCoordinationColor(80)).toBe('#f97316');
    });

    it('returns red for orchestrated campaign (> 80)', () => {
      expect(getCoordinationColor(81)).toBe('#ef4444');
      expect(getCoordinationColor(100)).toBe('#ef4444');
    });
  });

  describe('getIntentIndicator', () => {
    it('returns correct indicator for organic', () => {
      const result = getIntentIndicator('organic');
      expect(result.icon).toBe('👤');
      expect(result.label).toBe('Organic User');
      expect(result.color).toBe('#22c55e');
    });

    it('returns correct indicator for troll', () => {
      const result = getIntentIndicator('troll');
      expect(result.icon).toBe('🧌');
      expect(result.label).toBe('Troll Account');
      expect(result.color).toBe('#f97316');
    });

    it('returns correct indicator for bot', () => {
      const result = getIntentIndicator('bot');
      expect(result.icon).toBe('🤖');
      expect(result.label).toBe('Bot Account');
      expect(result.color).toBe('#ef4444');
    });

    it('returns correct indicator for stateSponsored', () => {
      const result = getIntentIndicator('stateSponsored');
      expect(result.icon).toBe('🏛️');
      expect(result.label).toBe('State-Sponsored');
      expect(result.color).toBe('#dc2626');
    });

    it('returns correct indicator for commercial', () => {
      const result = getIntentIndicator('commercial');
      expect(result.icon).toBe('💰');
      expect(result.label).toBe('Commercial');
      expect(result.color).toBe('#eab308');
    });

    it('returns correct indicator for activist', () => {
      const result = getIntentIndicator('activist');
      expect(result.icon).toBe('📢');
      expect(result.label).toBe('Activist');
      expect(result.color).toBe('#8b5cf6');
    });

    it('returns default indicator for unknown intent', () => {
      const result = getIntentIndicator('unknown_type');
      expect(result.icon).toBe('?');
      expect(result.label).toBe('Unknown');
    });
  });

  describe('formatFilterReason', () => {
    it('formats content filter reasons', () => {
      expect(formatFilterReason('economic')).toBe('Economic bias outside your range');
      expect(formatFilterReason('social')).toBe('Social bias outside your range');
      expect(formatFilterReason('authority')).toBe('Authority bias outside your range');
      expect(formatFilterReason('globalism')).toBe('Globalism bias outside your range');
      expect(formatFilterReason('truthfulness')).toBe('Below truthfulness threshold');
    });

    it('formats author filter reasons', () => {
      expect(formatFilterReason('authenticity')).toBe('Author authenticity below minimum');
      expect(formatFilterReason('coordination')).toBe('Author coordination above maximum');
      expect(formatFilterReason('authorIntent')).toBe('Author intent type is blocked');
    });
  });
});

describe('Filter Action Determination', () => {
  // Helper to create a base classification result
  const createBaseResult = (overrides?: Partial<ClassificationResult>): ClassificationResult => ({
    economic: 0,
    social: 0,
    authority: 0,
    globalism: 0,
    truthScore: 70,
    confidence: 0.8,
    source: 'local',
    timestamp: Date.now(),
    ...overrides
  });

  // Helper to create base preferences
  const createBasePrefs = (overrides?: Partial<UserPreferences>): UserPreferences => ({
    economicRange: null,
    socialRange: null,
    authorityRange: null,
    globalismRange: null,
    minTruthScore: 0,
    minAuthenticity: 0,
    maxCoordination: 100,
    blockedIntents: [],
    displayMode: 'badge',
    enabled: true,
    whitelistedDomains: [],
    ...overrides
  });

  // Helper to create author classification
  const createAuthor = (overrides?: Partial<AuthorClassification>): AuthorClassification => ({
    authenticity: 70,
    coordination: 20,
    intent: {
      primary: 'organic',
      confidence: 0.8,
      breakdown: {
        organic: 70,
        troll: 10,
        bot: 5,
        stateSponsored: 5,
        commercial: 5,
        activist: 5
      }
    },
    signals: [],
    dataQuality: 'medium',
    ...overrides
  });

  describe('Content-based filtering', () => {
    it('returns none when display mode is off', () => {
      const result = createBaseResult();
      const prefs = createBasePrefs({ displayMode: 'off' });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('none');
    });

    it('filters based on economic range', () => {
      const result = createBaseResult({ economic: 80 });
      const prefs = createBasePrefs({
        economicRange: [-50, 50],
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('overlay');
      expect(action.reason).toBe('economic');
    });

    it('filters based on social range', () => {
      const result = createBaseResult({ social: -80 });
      const prefs = createBasePrefs({
        socialRange: [-50, 50],
        displayMode: 'block'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('block');
      expect(action.reason).toBe('social');
    });

    it('filters based on authority range', () => {
      const result = createBaseResult({ authority: 90 });
      const prefs = createBasePrefs({
        authorityRange: [-100, 50],
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('authority');
    });

    it('filters based on globalism range', () => {
      const result = createBaseResult({ globalism: -90 });
      const prefs = createBasePrefs({
        globalismRange: [-50, 100],
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('globalism');
    });

    it('filters based on truth score', () => {
      const result = createBaseResult({ truthScore: 30 });
      const prefs = createBasePrefs({
        minTruthScore: 50,
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('truthfulness');
    });

    it('allows content within all ranges', () => {
      const result = createBaseResult({
        economic: 0,
        social: 0,
        authority: 0,
        globalism: 0,
        truthScore: 80
      });
      const prefs = createBasePrefs({
        economicRange: [-50, 50],
        socialRange: [-50, 50],
        authorityRange: [-50, 50],
        globalismRange: [-50, 50],
        minTruthScore: 50,
        displayMode: 'badge'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('badge');
      expect(action.reason).toBeUndefined();
    });
  });

  describe('Author-based filtering', () => {
    it('filters based on low authenticity', () => {
      const author = createAuthor({ authenticity: 20 });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        minAuthenticity: 50,
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('overlay');
      expect(action.reason).toBe('authenticity');
    });

    it('filters based on high coordination', () => {
      const author = createAuthor({ coordination: 80 });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        maxCoordination: 50,
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('coordination');
    });

    it('filters based on blocked intent - troll', () => {
      const author = createAuthor({
        intent: {
          primary: 'troll',
          confidence: 0.8,
          breakdown: { organic: 10, troll: 70, bot: 10, stateSponsored: 0, commercial: 5, activist: 5 }
        }
      });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        blockedIntents: ['troll'],
        displayMode: 'block'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('block');
      expect(action.reason).toBe('authorIntent');
    });

    it('filters based on blocked intent - bot', () => {
      const author = createAuthor({
        intent: {
          primary: 'bot',
          confidence: 0.9,
          breakdown: { organic: 5, troll: 5, bot: 80, stateSponsored: 5, commercial: 5, activist: 0 }
        }
      });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        blockedIntents: ['bot', 'stateSponsored'],
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('authorIntent');
    });

    it('filters based on blocked intent - stateSponsored', () => {
      const author = createAuthor({
        intent: {
          primary: 'stateSponsored',
          confidence: 0.85,
          breakdown: { organic: 5, troll: 5, bot: 10, stateSponsored: 70, commercial: 5, activist: 5 }
        }
      });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        blockedIntents: ['stateSponsored'],
        displayMode: 'block'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('authorIntent');
    });

    it('allows organic author when only bots blocked', () => {
      const author = createAuthor({
        intent: {
          primary: 'organic',
          confidence: 0.9,
          breakdown: { organic: 80, troll: 5, bot: 5, stateSponsored: 5, commercial: 5, activist: 0 }
        }
      });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        blockedIntents: ['bot', 'stateSponsored'],
        displayMode: 'badge'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.action).toBe('badge');
      expect(action.reason).toBeUndefined();
    });

    it('allows content without author data when author filters set', () => {
      const result = createBaseResult(); // No author field
      const prefs = createBasePrefs({
        minAuthenticity: 50,
        maxCoordination: 50,
        blockedIntents: ['bot', 'troll'],
        displayMode: 'badge'
      });

      const action = determineFilterAction(result, prefs);

      // Should not trigger author filters since no author data
      expect(action.action).toBe('badge');
      expect(action.reason).toBeUndefined();
    });
  });

  describe('Combined filtering', () => {
    it('content filters take precedence over author filters', () => {
      const author = createAuthor({ authenticity: 20 }); // Would trigger author filter
      const result = createBaseResult({
        economic: 90, // Will trigger content filter first
        author
      });
      const prefs = createBasePrefs({
        economicRange: [-50, 50],
        minAuthenticity: 50,
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      // Content filter should trigger first
      expect(action.reason).toBe('economic');
    });

    it('truthfulness filter triggers before author filters', () => {
      const author = createAuthor({ authenticity: 20 });
      const result = createBaseResult({
        truthScore: 20,
        author
      });
      const prefs = createBasePrefs({
        minTruthScore: 50,
        minAuthenticity: 50,
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('truthfulness');
    });

    it('authenticity filter triggers before coordination', () => {
      const author = createAuthor({
        authenticity: 20,
        coordination: 90
      });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        minAuthenticity: 50,
        maxCoordination: 50,
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('authenticity');
    });

    it('coordination filter triggers before intent', () => {
      const author = createAuthor({
        authenticity: 70,
        coordination: 90,
        intent: {
          primary: 'troll',
          confidence: 0.8,
          breakdown: { organic: 10, troll: 70, bot: 10, stateSponsored: 0, commercial: 5, activist: 5 }
        }
      });
      const result = createBaseResult({ author });
      const prefs = createBasePrefs({
        minAuthenticity: 0,
        maxCoordination: 50,
        blockedIntents: ['troll'],
        displayMode: 'overlay'
      });

      const action = determineFilterAction(result, prefs);

      expect(action.reason).toBe('coordination');
    });
  });
});
