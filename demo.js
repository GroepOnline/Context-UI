#!/usr/bin/env node

/**
 * Demo: Pi.dev Context Extension
 * 
 * This script demonstrates the extension functionality without Pi.dev.
 * Run with: node demo.js
 */

const { ContextExtension } = require('./dist/extension');
const { MockPiAPI, buildCommandContext } = require('./dist/piAdapter');

async function runDemo() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Pi.dev Context Extension - Demo              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Create extension and mock API
  const extension = new ContextExtension();
  const api = new MockPiAPI();

  // Set some mock session data
  api.setSessionData({
    filesRead: [
      { path: 'src/extension.ts', content: 'export class Extension...' },
      { path: 'src/types.ts', content: 'export interface...' },
      { path: 'package.json', content: '{"name": "..."}' }
    ],
    commandOutputs: [
      'npm test\nAll tests passed\nCoverage: 85%',
      'npm run build\nBuild successful'
    ],
    currentTask: 'Developing Pi.dev context extension'
  });

  // Activate extension
  await extension.activate(api);

  console.log('Extension activated successfully!\n');

  // Test different modes
  const modes = [
    [],
    ['compact'],
    ['tokens'],
    ['files'],
    ['summary']
  ];

  for (const args of modes) {
    const mode = args[0] || 'default';
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Mode: /context ${mode}`);
    console.log('─'.repeat(50));

    const context = buildCommandContext(args, api.getSessionInfo ? await api.getSessionInfo() : {});
    
    try {
      await api.testExecuteCommand('/context', context);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log('Demo complete!');
  console.log('─'.repeat(50) + '\n');

  // Deactivate
  extension.deactivate();
}

runDemo().catch(console.error);
