"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const workingSetAnalyzer_1 = require("./workingSetAnalyzer");
const piAdapter_1 = require("./piAdapter");
(0, vitest_1.describe)('WorkingSetAnalyzer', () => {
    (0, vitest_1.describe)('analyze', () => {
        (0, vitest_1.it)('returns empty working set for empty context', () => {
            const analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer();
            const context = (0, piAdapter_1.buildCommandContext)([]);
            const workingSet = analyzer.analyze(context);
            (0, vitest_1.expect)(workingSet.files.length).toBe(0);
            (0, vitest_1.expect)(workingSet.commands.length).toBe(0);
            (0, vitest_1.expect)(workingSet.errors.length).toBe(0);
        });
        (0, vitest_1.it)('analyzes files from context', () => {
            const analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer();
            const context = (0, piAdapter_1.buildCommandContext)([], {
                filesRead: ['test.ts', 'app.ts']
            });
            const workingSet = analyzer.analyze(context);
            (0, vitest_1.expect)(workingSet.files.length).toBe(2);
            (0, vitest_1.expect)(workingSet.files[0].path).toContain('.ts');
        });
        (0, vitest_1.it)('analyzes commands from context', () => {
            const analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer();
            const context = (0, piAdapter_1.buildCommandContext)([], {
                commandOutputs: ['npm test\npass', 'npm build\nsuccess']
            });
            const workingSet = analyzer.analyze(context);
            (0, vitest_1.expect)(workingSet.commands.length).toBe(2);
        });
    });
});
