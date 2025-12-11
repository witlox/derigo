/**
 * Classifier unit tests
 */

import { getTruthIndicator, formatAxisLabel, getScoreColor } from '../../src/lib/classifier';

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
});
