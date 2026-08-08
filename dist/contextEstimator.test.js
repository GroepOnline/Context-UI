"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const contextEstimator_1 = require("./contextEstimator");
(0, vitest_1.describe)('ContextEstimator', () => {
    (0, vitest_1.describe)('estimateFromText', () => {
        (0, vitest_1.it)('returns positive count for basic text', () => {
            const estimator = new contextEstimator_1.ContextEstimator();
            const result = estimator.estimateFromText('Hello world');
            (0, vitest_1.expect)(result.count).toBeGreaterThan(0);
            (0, vitest_1.expect)(result.type).toBe('estimated');
            (0, vitest_1.expect)(result.source).toBeDefined();
        });
        (0, vitest_1.it)('uses different content type ratios', () => {
            const estimator = new contextEstimator_1.ContextEstimator();
            const text = 'const x = 42;';
            const normalEst = estimator.estimateFromText(text);
            const codeEst = estimator.estimateFromText(text, 'code');
            const logEst = estimator.estimateFromText(text, 'logOutput');
            // Log output uses ratio 2.6 (tighter) >> default detection
            // Code uses ratio 4.0
            (0, vitest_1.expect)(logEst.count).toBeGreaterThan(normalEst.count);
            (0, vitest_1.expect)(codeEst.count).toBeGreaterThan(0);
        });
    });
    (0, vitest_1.describe)('getContentTypeFromPath', () => {
        (0, vitest_1.it)('detects content types by file extension', () => {
            const estimator = new contextEstimator_1.ContextEstimator();
            (0, vitest_1.expect)(estimator.getContentTypeFromPath('test.ts')).toBe('code');
            (0, vitest_1.expect)(estimator.getContentTypeFromPath('data.json')).toBe('json');
            (0, vitest_1.expect)(estimator.getContentTypeFromPath('doc.md')).toBe('markdown');
            (0, vitest_1.expect)(estimator.getContentTypeFromPath('output.log')).toBe('logOutput');
        });
    });
    (0, vitest_1.describe)('calculateRisk', () => {
        (0, vitest_1.it)('returns correct risk levels', () => {
            const estimator = new contextEstimator_1.ContextEstimator();
            (0, vitest_1.expect)(estimator.calculateRisk(25)).toBe('LOW');
            (0, vitest_1.expect)(estimator.calculateRisk(50)).toBe('MEDIUM');
            (0, vitest_1.expect)(estimator.calculateRisk(80)).toBe('HIGH');
            (0, vitest_1.expect)(estimator.calculateRisk(95)).toBe('CRITICAL');
        });
    });
    (0, vitest_1.describe)('estimateBreakdown', () => {
        (0, vitest_1.it)('returns zero total for empty data', () => {
            const estimator = new contextEstimator_1.ContextEstimator();
            const breakdown = estimator.estimateBreakdown();
            (0, vitest_1.expect)(breakdown.total.count).toBe(0);
            (0, vitest_1.expect)(breakdown.messages.count).toBe(0);
        });
        (0, vitest_1.it)('returns non-zero total with data', () => {
            const estimator = new contextEstimator_1.ContextEstimator();
            const messages = [{ role: 'user', content: 'Hello' }];
            const files = [{ path: 'test.ts', content: 'const x = 42;' }];
            const commands = ['npm test\noutput here'];
            const breakdown = estimator.estimateBreakdown(messages, files, [], commands);
            (0, vitest_1.expect)(breakdown.total.count).toBeGreaterThan(0);
            (0, vitest_1.expect)(breakdown.messages.count).toBeGreaterThan(0);
            (0, vitest_1.expect)(breakdown.files.count).toBeGreaterThan(0);
        });
    });
});
