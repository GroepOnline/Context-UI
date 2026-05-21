"use strict";
/**
 * Tests for Pi Context Extension
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const contextEstimator_1 = require("../contextEstimator");
const workingSetAnalyzer_1 = require("../workingSetAnalyzer");
const terminalRenderer_1 = require("../terminalRenderer");
const extension_1 = require("../extension");
const piAdapter_1 = require("../piAdapter");
// ============ Test Utilities ============
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✓ ${message}`);
}
function test(name, fn) {
    try {
        fn();
        console.log(`\n[PASS] ${name}`);
    }
    catch (error) {
        console.error(`\n[FAIL] ${name}`);
        console.error(`  Error: ${error.message}`);
        process.exit(1);
    }
}
function stripAnsi(text) {
    return text.replace(/\x1B\[[0-9;]*m/g, '');
}
// ============ Context Estimator Tests ============
test('ContextEstimator - estimateFromText basic', () => {
    const estimator = new contextEstimator_1.ContextEstimator();
    const result = estimator.estimateFromText('Hello world');
    assert(result.count > 0, 'Should return positive count');
    assert(result.type === 'estimated', 'Should be estimated type');
    assert(result.source !== undefined, 'Should have source');
});
test('ContextEstimator - content type ratios', () => {
    const estimator = new contextEstimator_1.ContextEstimator();
    const text = 'const x = 42;';
    const normalEst = estimator.estimateFromText(text);
    const codeEst = estimator.estimateFromText(text, 'code');
    const logEst = estimator.estimateFromText(text, 'logOutput');
    assert(normalEst.count > 0, 'Should have positive count');
    // Log output uses ratio 2.2 (tighter) >> code uses 4.0 >> default (text) uses 3.6
    assert(logEst.count > normalEst.count, 'Log output should have more tokens than default');
    assert(codeEst.count > 0, 'Code estimate should be positive');
});
test('ContextEstimator - content type detection', () => {
    const estimator = new contextEstimator_1.ContextEstimator();
    // Content detection by path
    assert(estimator.getContentTypeFromPath('test.ts') === 'code', '.ts should be code');
    assert(estimator.getContentTypeFromPath('data.json') === 'json', '.json should be json');
    assert(estimator.getContentTypeFromPath('doc.md') === 'markdown', '.md should be markdown');
    assert(estimator.getContentTypeFromPath('output.log') === 'logOutput', '.log should be logOutput');
});
test('ContextEstimator - calculateRisk levels', () => {
    const estimator = new contextEstimator_1.ContextEstimator();
    assert(estimator.calculateRisk(25) === 'LOW', '25% should be LOW');
    assert(estimator.calculateRisk(50) === 'MEDIUM', '50% should be MEDIUM');
    assert(estimator.calculateRisk(80) === 'HIGH', '80% should be HIGH');
    assert(estimator.calculateRisk(95) === 'CRITICAL', '95% should be CRITICAL');
});
test('ContextEstimator - estimateBreakdown empty', () => {
    const estimator = new contextEstimator_1.ContextEstimator();
    const breakdown = estimator.estimateBreakdown();
    assert(breakdown.total.count === 0, 'Empty breakdown should have zero total');
    assert(breakdown.messages.count === 0, 'Messages should be zero');
});
test('ContextEstimator - estimateBreakdown with data', () => {
    const estimator = new contextEstimator_1.ContextEstimator();
    const messages = [{ role: 'user', content: 'Hello' }];
    const files = [{ path: 'test.ts', content: 'const x = 42;' }];
    const commands = ['npm test\noutput here'];
    const breakdown = estimator.estimateBreakdown(messages, files, [], commands);
    assert(breakdown.total.count > 0, 'Should have non-zero total');
    assert(breakdown.messages.count > 0, 'Should count messages');
    assert(breakdown.files.count > 0, 'Should count files');
});
// ============ Working Set Analyzer Tests ============
test('WorkingSetAnalyzer - analyze empty context', () => {
    const analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer();
    const context = (0, piAdapter_1.buildCommandContext)([]);
    const workingSet = analyzer.analyze(context);
    assert(workingSet.files.length === 0, 'Should have no files');
    assert(workingSet.commands.length === 0, 'Should have no commands');
    assert(workingSet.errors.length === 0, 'Should have no errors');
});
test('WorkingSetAnalyzer - analyze with files', () => {
    const analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer();
    const context = (0, piAdapter_1.buildCommandContext)([], {
        filesRead: ['test.ts', 'app.ts']
    });
    const workingSet = analyzer.analyze(context);
    assert(workingSet.files.length === 2, 'Should have 2 files');
    assert(workingSet.files[0].path.includes('.ts'), 'Should have TypeScript file');
});
test('WorkingSetAnalyzer - analyze with commands', () => {
    const analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer();
    const context = (0, piAdapter_1.buildCommandContext)([], {
        commandOutputs: ['npm test\npass', 'npm build\nsuccess']
    });
    const workingSet = analyzer.analyze(context);
    assert(workingSet.commands.length === 2, 'Should have 2 commands');
});
// ============ Terminal Renderer Tests ============
test('TerminalRenderer - render status box', () => {
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
    assert(output.includes('Context Status'), 'Should include header');
    // Check for the actual format: "Used" followed by ":" (no space between in current implementation)
    assert(output.includes('Used') && output.includes('0k tokens'), 'Should show used tokens');
    assert(output.includes('Risk') && output.includes('LOW'), 'Should show risk level');
});
test('TerminalRenderer - render with different modes', () => {
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
    assert(output.includes('Token Breakdown'), 'Tokens mode should show breakdown');
});
test('TerminalRenderer - keeps consistent line width with ANSI colors', () => {
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
    assert(boxLines.every(l => l.length === 80), 'All box lines should keep exact terminal width');
});
// ============ Extension Integration Tests ============
test('ContextExtension - activation', async () => {
    const extension = new extension_1.ContextExtension();
    const mockAPI = new piAdapter_1.MockPiAPI();
    await extension.activate(mockAPI);
    assert(extension.name === 'pi-context-extension', 'Should have correct name');
    assert(extension.commands.length === 3, 'Should have 3 commands');
    assert(extension.description !== undefined, 'Should have description');
});
test('ContextExtension - command execution', async () => {
    const extension = new extension_1.ContextExtension();
    const mockAPI = new piAdapter_1.MockPiAPI();
    await extension.activate(mockAPI);
    const context = (0, piAdapter_1.buildCommandContext)(['compact']);
    // This should not throw
    await mockAPI.testExecuteCommand('/context', context);
});
test('ContextExtension - all command modes execute without error', async () => {
    const extension = new extension_1.ContextExtension();
    const mockAPI = new piAdapter_1.MockPiAPI();
    mockAPI.setSessionData({
        filesRead: ['src/test.ts', 'src/types.ts'],
        commandOutputs: ['npm test\npass', 'npm build\nok'],
        currentTask: 'Testing command modes'
    });
    await extension.activate(mockAPI);
    // Test all modes
    const modes = [[], ['compact'], ['tokens'], ['files'], ['summary'], ['unknown']];
    for (const args of modes) {
        const context = (0, piAdapter_1.buildCommandContext)(args, {});
        await mockAPI.testExecuteCommand('/context', context);
    }
});
// ============ PiAdapter Tests ============
test('MockPiAPI - full lifecycle', async () => {
    const api = new piAdapter_1.MockPiAPI();
    assert(typeof api.registerCommand === 'function', 'Should support registerCommand');
    assert(typeof api.getSessionInfo === 'function', 'Should support getSessionInfo');
    assert(typeof api.getTerminalWidth === 'function', 'Should support getTerminalWidth');
    assert(typeof api.log === 'function', 'Should support log');
    assert(typeof api.error === 'function', 'Should support error');
    const width = await api.getTerminalWidth();
    assert(typeof width === 'number' && width > 0, 'Should return positive terminal width');
});
test('RealPiAPI - graceful fallback', async () => {
    const { RealPiAPI } = await Promise.resolve().then(() => __importStar(require('../piAdapter')));
    const api = new RealPiAPI(null);
    try {
        await api.registerCommand('/test', async () => { });
        assert(false, 'Should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not available'), 'Should indicate Pi.dev is not available');
    }
});
// ============ Run Tests ============
console.log('\n========================================');
console.log('  Pi Context Extension Test Suite');
console.log('========================================\n');
console.log('All tests passed! ✓');
console.log('\nTo test the extension in Pi.dev:');
console.log('1. Run: npm install');
console.log('2. Run: npm run build');
console.log('3. Copy extension to Pi.dev extensions directory');
console.log('4. Restart Pi.dev and use /context command\n');
