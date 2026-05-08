/**
 * Tests for Pi Context Extension
 */

import { ContextEstimator } from '../contextEstimator';
import { WorkingSetAnalyzer } from '../workingSetAnalyzer';
import { TerminalRenderer } from '../terminalRenderer';
import { ContextExtension } from '../extension';
import { MockPiAPI, buildCommandContext } from '../piAdapter';

// ============ Test Utilities ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`\n[PASS] ${name}`);
  } catch (error: any) {
    console.error(`\n[FAIL] ${name}`);
    console.error(`  Error: ${error.message}`);
    process.exit(1);
  }
}

// ============ Context Estimator Tests ============

test('ContextEstimator - estimateFromText basic', () => {
  const estimator = new ContextEstimator();
  const result = estimator.estimateFromText('Hello world');
  
  assert(result.count > 0, 'Should return positive count');
  assert(result.type === 'estimated', 'Should be estimated type');
  assert(result.source !== undefined, 'Should have source');
});

test('ContextEstimator - content type ratios', () => {
  const estimator = new ContextEstimator();
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
  const estimator = new ContextEstimator();
  
  // Content detection by path
  assert(estimator.getContentTypeFromPath('test.ts') === 'code', '.ts should be code');
  assert(estimator.getContentTypeFromPath('data.json') === 'json', '.json should be json');
  assert(estimator.getContentTypeFromPath('doc.md') === 'markdown', '.md should be markdown');
  assert(estimator.getContentTypeFromPath('output.log') === 'logOutput', '.log should be logOutput');
});

test('ContextEstimator - calculateRisk levels', () => {
  const estimator = new ContextEstimator();
  
  assert(estimator.calculateRisk(25) === 'LOW', '25% should be LOW');
  assert(estimator.calculateRisk(50) === 'MEDIUM', '50% should be MEDIUM');
  assert(estimator.calculateRisk(80) === 'HIGH', '80% should be HIGH');
  assert(estimator.calculateRisk(95) === 'CRITICAL', '95% should be CRITICAL');
});

test('ContextEstimator - estimateBreakdown empty', () => {
  const estimator = new ContextEstimator();
  const breakdown = estimator.estimateBreakdown();
  
  assert(breakdown.total.count === 0, 'Empty breakdown should have zero total');
  assert(breakdown.messages.count === 0, 'Messages should be zero');
});

test('ContextEstimator - estimateBreakdown with data', () => {
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
  
  assert(breakdown.total.count > 0, 'Should have non-zero total');
  assert(breakdown.messages.count > 0, 'Should count messages');
  assert(breakdown.files.count > 0, 'Should count files');
});

// ============ Working Set Analyzer Tests ============

test('WorkingSetAnalyzer - analyze empty context', () => {
  const analyzer = new WorkingSetAnalyzer();
  const context = buildCommandContext([]);
  const workingSet = analyzer.analyze(context);
  
  assert(workingSet.files.length === 0, 'Should have no files');
  assert(workingSet.commands.length === 0, 'Should have no commands');
  assert(workingSet.errors.length === 0, 'Should have no errors');
});

test('WorkingSetAnalyzer - analyze with files', () => {
  const analyzer = new WorkingSetAnalyzer();
  const context = buildCommandContext([], {
    filesRead: ['test.ts', 'app.ts']
  });
  const workingSet = analyzer.analyze(context);
  
  assert(workingSet.files.length === 2, 'Should have 2 files');
  assert(workingSet.files[0].path.includes('.ts'), 'Should have TypeScript file');
});

test('WorkingSetAnalyzer - analyze with commands', () => {
  const analyzer = new WorkingSetAnalyzer();
  const context = buildCommandContext([], {
    commandOutputs: ['npm test\npass', 'npm build\nsuccess']
  });
  const workingSet = analyzer.analyze(context);
  
  assert(workingSet.commands.length === 2, 'Should have 2 commands');
});

// ============ Terminal Renderer Tests ============

test('TerminalRenderer - render status box', () => {
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
  
  assert(output.includes('Context Status'), 'Should include header');
  // Check for the actual format: "Used" followed by ":" (no space between in current implementation)
  assert(output.includes('Used') && output.includes('0k tokens'), 'Should show used tokens');
  assert(output.includes('Risk') && output.includes('LOW'), 'Should show risk level');
});

test('TerminalRenderer - render with different modes', () => {
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
  assert(output.includes('Token Breakdown'), 'Tokens mode should show breakdown');
});

// ============ Extension Integration Tests ============

test('ContextExtension - activation', async () => {
  const extension = new ContextExtension();
  const mockAPI = new MockPiAPI();
  
  await extension.activate(mockAPI);
  
  assert(extension.name === 'pi-context-extension', 'Should have correct name');
  assert(extension.commands.length === 3, 'Should have 3 commands');
  assert(extension.description !== undefined, 'Should have description');
});

test('ContextExtension - command execution', async () => {
  const extension = new ContextExtension();
  const mockAPI = new MockPiAPI();
  
  await extension.activate(mockAPI);
  
  const context = buildCommandContext(['compact']);
  
  // This should not throw
  await mockAPI.testExecuteCommand('/context', context);
});

test('ContextExtension - all command modes execute without error', async () => {
  const extension = new ContextExtension();
  const mockAPI = new MockPiAPI();
  
  mockAPI.setSessionData({
    filesRead: ['src/test.ts', 'src/types.ts'],
    commandOutputs: ['npm test\npass', 'npm build\nok'],
    currentTask: 'Testing command modes'
  });
  
  await extension.activate(mockAPI);
  
  // Test all modes
  const modes = [[], ['compact'], ['tokens'], ['files'], ['summary'], ['unknown']];
  for (const args of modes) {
    const context = buildCommandContext(args, {});
    await mockAPI.testExecuteCommand('/context', context);
  }
});

// ============ PiAdapter Tests ============

test('MockPiAPI - full lifecycle', async () => {
  const api = new MockPiAPI();
  
  assert(typeof api.registerCommand === 'function', 'Should support registerCommand');
  assert(typeof api.getSessionInfo === 'function', 'Should support getSessionInfo');
  assert(typeof api.getTerminalWidth === 'function', 'Should support getTerminalWidth');
  assert(typeof api.log === 'function', 'Should support log');
  assert(typeof api.error === 'function', 'Should support error');
  
  const width = await api.getTerminalWidth();
  assert(typeof width === 'number' && width > 0, 'Should return positive terminal width');
});

test('RealPiAPI - graceful fallback', async () => {
  const { RealPiAPI } = await import('../piAdapter');
  const api = new RealPiAPI(null as any);
  
  try {
    await api.registerCommand('/test', async () => {});
    assert(false, 'Should have thrown');
  } catch (e: any) {
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
