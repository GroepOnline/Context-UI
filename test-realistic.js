#!/usr/bin/env node

/**
 * Realistic Context Test
 * Demonstrates the extension with high-context scenario
 */

const { ContextExtension } = require('./dist/extension');
const { MockPiAPI, buildCommandContext } = require('./dist/piAdapter');

// Simulate a session with significant context
function generateLargeContext() {
  const files = [];
  
  // Add many files
  for (let i = 1; i <= 15; i++) {
    files.push({
      path: `src/module${i}.ts`,
      content: `// Module ${i}\nexport class Module${i} {\n`.repeat(50)
    });
  }
  
  // Add large logs
  const logs = [];
  for (let i = 0; i < 5; i++) {
    logs.push('Log output line '.repeat(100));
  }
  
  // Add command outputs
  const commandOutputs = [
    'npm test\n' + 'Test output line '.repeat(80),
    'npm run build\n' + 'Build output '.repeat(60),
    'git status\n' + 'Modified files: '.repeat(40),
    'npm install\n' + 'Package installation '.repeat(30)
  ];
  
  // Add errors
  const errors = [
    { message: 'TypeScript error in module3.ts', file: 'src/module3.ts', line: 42 },
    { message: 'Test failed: expected true but got false', file: 'test/test.ts' }
  ];
  
  return {
    filesRead: files,
    commandOutputs,
    logs,
    errors,
    currentTask: 'Large refactoring - migrating to new API',
    recentMessages: [
      { role: 'user', content: 'Can you help me refactor this code?' },
      { role: 'assistant', content: 'I will help you refactor the code to use the new API...' },
      ...errors.map(e => ({ role: 'system', error: e.message }))
    ]
  };
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Realistic Context Test - High Load Scenario   ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const extension = new ContextExtension();
  const api = new MockPiAPI();
  
  // Set large context
  api.setSessionData(generateLargeContext());
  
  // Activate
  await extension.activate(api);
  
  console.log('Simulated session with:');
  console.log('  - 15 TypeScript files');
  console.log('  - 5 large log outputs');
  console.log('  - 4 command outputs');
  console.log('  - 2 errors\n');
  
  // Test default mode
  console.log('─'.repeat(80));
  console.log('Testing /context (default mode)');
  console.log('─'.repeat(80) + '\n');
  
  const context = buildCommandContext([], await api.getSessionInfo());
  await api.testExecuteCommand('/context', context);
  
  console.log('\n' + '─'.repeat(80));
  console.log('Testing /context files');
  console.log('─'.repeat(80) + '\n');
  
  const filesContext = buildCommandContext(['files'], await api.getSessionInfo());
  await api.testExecuteCommand('/context', filesContext);
  
  console.log('\n' + '─'.repeat(80));
  console.log('Testing /context summary');
  console.log('─'.repeat(80) + '\n');
  
  const summaryContext = buildCommandContext(['summary'], await api.getSessionInfo());
  await api.testExecuteCommand('/context', summaryContext);
  
  console.log('\n✓ Realistic test complete!\n');
  
  extension.deactivate();
}

runTest().catch(console.error);
