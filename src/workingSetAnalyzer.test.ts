import { describe, it, expect } from 'vitest';
import { WorkingSetAnalyzer } from './workingSetAnalyzer';
import { buildCommandContext } from './piAdapter';

describe('WorkingSetAnalyzer', () => {
  describe('analyze', () => {
    it('returns empty working set for empty context', () => {
      const analyzer = new WorkingSetAnalyzer();
      const context = buildCommandContext([]);
      const workingSet = analyzer.analyze(context);

      expect(workingSet.files.length).toBe(0);
      expect(workingSet.commands.length).toBe(0);
      expect(workingSet.errors.length).toBe(0);
    });

    it('analyzes files from context', () => {
      const analyzer = new WorkingSetAnalyzer();
      const context = buildCommandContext([], {
        filesRead: ['test.ts', 'app.ts']
      });
      const workingSet = analyzer.analyze(context);

      expect(workingSet.files.length).toBe(2);
      expect(workingSet.files[0].path).toContain('.ts');
    });

    it('analyzes commands from context', () => {
      const analyzer = new WorkingSetAnalyzer();
      const context = buildCommandContext([], {
        commandOutputs: ['npm test\npass', 'npm build\nsuccess']
      });
      const workingSet = analyzer.analyze(context);

      expect(workingSet.commands.length).toBe(2);
    });
  });
});
