import { describe, it, expect } from 'vitest';
import { TerminalRenderer } from './terminalRenderer';
import { ContextEstimator } from './contextEstimator';

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*m/g, '');
}

describe('TerminalRenderer', () => {
  describe('render', () => {
    it('renders status box in compact mode', () => {
      const renderer = new TerminalRenderer();
      const estimator = new ContextEstimator();

      const status = estimator.buildStatus(
        estimator.estimateBreakdown()
      );

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

      expect(output).toContain('Context Status');
      expect(output).toContain('Used');
      expect(output).toContain('0');
      expect(output).toContain('Risk');
      expect(output).toContain('LOW');
    });

    it('renders token breakdown in tokens mode', () => {
      const renderer = new TerminalRenderer();
      const estimator = new ContextEstimator();

      const status = estimator.buildStatus(
        estimator.estimateBreakdown()
      );

      const report = {
        status,
        workingSet: { files: [], commands: [], errors: [], largeConsumers: [] },
        recommendation: {
          action: 'continue' as const,
          message: 'Test',
          priority: 'low' as const
        },
        mode: 'tokens' as const,
        timestamp: Date.now()
      };

      const output = renderer.render(report);
      expect(output).toContain('Token Breakdown');
    });

    it('keeps consistent line width with ANSI colors', () => {
      const renderer = new TerminalRenderer(80);
      const estimator = new ContextEstimator();

      const status = estimator.buildStatus(
        estimator.estimateBreakdown(
          [{ role: 'user', content: 'hello '.repeat(200) }],
          [{ path: 'very/long/path/file.ts', content: 'const x = 1;\n'.repeat(300) }],
          [],
          ['npm run test -- --watch --very-long-option '.repeat(30)],
          ['diff --git a/x b/x\n+line\n'.repeat(200)],
          ['[2026-05-08 12:00:00] log line\n'.repeat(200)],
          [{ message: 'Some long error message '.repeat(40) }]
        )
      );

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
      expect(boxLines.every(l => l.length === 80)).toBe(true);
    });
  });
});
