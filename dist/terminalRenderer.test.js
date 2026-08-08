"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const terminalRenderer_1 = require("./terminalRenderer");
const contextEstimator_1 = require("./contextEstimator");
function stripAnsi(text) {
    return text.replace(/\x1B\[[0-9;]*m/g, '');
}
(0, vitest_1.describe)('TerminalRenderer', () => {
    (0, vitest_1.describe)('render', () => {
        (0, vitest_1.it)('renders status box in compact mode', () => {
            const renderer = new terminalRenderer_1.TerminalRenderer();
            const estimator = new contextEstimator_1.ContextEstimator();
            const status = estimator.buildStatus(estimator.estimateBreakdown());
            const output = renderer.render({
                status,
                workingSet: { files: [], commands: [], errors: [], largeConsumers: [] },
                recommendation: {
                    action: 'continue',
                    message: 'Test',
                    priority: 'low'
                },
                mode: 'compact',
                timestamp: Date.now()
            });
            (0, vitest_1.expect)(output).toContain('Context Status');
            (0, vitest_1.expect)(output).toContain('Used');
            (0, vitest_1.expect)(output).toContain('0');
            (0, vitest_1.expect)(output).toContain('Risk');
            (0, vitest_1.expect)(output).toContain('LOW');
        });
        (0, vitest_1.it)('renders token breakdown in tokens mode', () => {
            const renderer = new terminalRenderer_1.TerminalRenderer();
            const estimator = new contextEstimator_1.ContextEstimator();
            const status = estimator.buildStatus(estimator.estimateBreakdown());
            const report = {
                status,
                workingSet: { files: [], commands: [], errors: [], largeConsumers: [] },
                recommendation: {
                    action: 'continue',
                    message: 'Test',
                    priority: 'low'
                },
                mode: 'tokens',
                timestamp: Date.now()
            };
            const output = renderer.render(report);
            (0, vitest_1.expect)(output).toContain('Token Breakdown');
        });
        (0, vitest_1.it)('keeps consistent line width with ANSI colors', () => {
            const renderer = new terminalRenderer_1.TerminalRenderer(80);
            const estimator = new contextEstimator_1.ContextEstimator();
            const status = estimator.buildStatus(estimator.estimateBreakdown([{ role: 'user', content: 'hello '.repeat(200) }], [{ path: 'very/long/path/file.ts', content: 'const x = 1;\n'.repeat(300) }], [], ['npm run test -- --watch --very-long-option '.repeat(30)], ['diff --git a/x b/x\n+line\n'.repeat(200)], ['[2026-05-08 12:00:00] log line\n'.repeat(200)], [{ message: 'Some long error message '.repeat(40) }]));
            const output = renderer.render({
                status,
                workingSet: {
                    task: 'Very long task title '.repeat(10),
                    files: [{ path: 'a/very/very/very/very/very/long/path/file.ts', reason: 'recent', tokenEstimate: 12345 }],
                    commands: [{ command: 'pnpm --filter app test --reporter verbose --long-args '.repeat(5) }],
                    errors: [{ message: 'Extremely verbose error message '.repeat(20) }],
                    largeConsumers: ['Huge JSON payload '.repeat(10)]
                },
                recommendation: { action: 'compact', message: 'Compact now due to high pressure '.repeat(6), priority: 'high' },
                mode: 'default',
                timestamp: Date.now()
            });
            const lines = stripAnsi(output).split('\n');
            const boxLines = lines.filter(l => l.startsWith('│') || l.startsWith('╭') || l.startsWith('╰'));
            (0, vitest_1.expect)(boxLines.every(l => l.length === 80)).toBe(true);
        });
    });
});
