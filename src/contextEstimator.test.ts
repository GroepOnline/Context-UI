import { describe, it, expect } from 'vitest';
import { ContextEstimator } from './contextEstimator';

describe('ContextEstimator', () => {
  describe('estimateFromText', () => {
    it('returns positive count for basic text', () => {
      const estimator = new ContextEstimator();
      const result = estimator.estimateFromText('Hello world');

      expect(result.count).toBeGreaterThan(0);
      expect(result.type).toBe('estimated');
      expect(result.source).toBeDefined();
    });

    it('uses different content type ratios', () => {
      const estimator = new ContextEstimator();
      const text = 'const x = 42;';

      const normalEst = estimator.estimateFromText(text);
      const codeEst = estimator.estimateFromText(text, 'code');
      const logEst = estimator.estimateFromText(text, 'logOutput');

      // Log output uses ratio 2.6 (tighter) >> default detection
      // Code uses ratio 4.0
      expect(logEst.count).toBeGreaterThan(normalEst.count);
      expect(codeEst.count).toBeGreaterThan(0);
    });
  });

  describe('getContentTypeFromPath', () => {
    it('detects content types by file extension', () => {
      const estimator = new ContextEstimator();

      expect(estimator.getContentTypeFromPath('test.ts')).toBe('code');
      expect(estimator.getContentTypeFromPath('data.json')).toBe('json');
      expect(estimator.getContentTypeFromPath('doc.md')).toBe('markdown');
      expect(estimator.getContentTypeFromPath('output.log')).toBe('logOutput');
    });
  });

  describe('calculateRisk', () => {
    it('returns correct risk levels', () => {
      const estimator = new ContextEstimator();

      expect(estimator.calculateRisk(25)).toBe('LOW');
      expect(estimator.calculateRisk(50)).toBe('MEDIUM');
      expect(estimator.calculateRisk(80)).toBe('HIGH');
      expect(estimator.calculateRisk(95)).toBe('CRITICAL');
    });
  });

  describe('estimateBreakdown', () => {
    it('returns zero total for empty data', () => {
      const estimator = new ContextEstimator();
      const breakdown = estimator.estimateBreakdown();

      expect(breakdown.total.count).toBe(0);
      expect(breakdown.messages.count).toBe(0);
    });

    it('returns non-zero total with data', () => {
      const estimator = new ContextEstimator();

      const messages = [{ role: 'user', content: 'Hello' }];
      const files = [{ path: 'test.ts', content: 'const x = 42;' }];
      const commands = ['npm test\noutput here'];

      const breakdown = estimator.estimateBreakdown(
        messages,
        files,
        [],
        commands
      );

      expect(breakdown.total.count).toBeGreaterThan(0);
      expect(breakdown.messages.count).toBeGreaterThan(0);
      expect(breakdown.files.count).toBeGreaterThan(0);
    });
  });
});
