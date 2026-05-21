import { describe, it, expect } from 'vitest';
import { ContextExtension } from './extension';
import { MockPiAPI, buildCommandContext } from './piAdapter';

describe('ContextExtension', () => {
  describe('activation', () => {
    it('registers correct name and commands', async () => {
      const extension = new ContextExtension();
      const mockAPI = new MockPiAPI();

      await extension.activate(mockAPI);

      expect(extension.name).toBe('pi-context-extension');
      expect(extension.commands.length).toBe(3);
      expect(extension.description).toBeDefined();
    });
  });

  describe('command execution', () => {
    it('executes /context command without error', async () => {
      const extension = new ContextExtension();
      const mockAPI = new MockPiAPI();

      await extension.activate(mockAPI);

      const context = buildCommandContext(['compact']);

      // Should not throw
      await mockAPI.testExecuteCommand('/context', context);
    });

    it('executes all command modes without error', async () => {
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
  });
});

describe('MockPiAPI', () => {
  it('supports full lifecycle API surface', async () => {
    const api = new MockPiAPI();

    expect(typeof api.registerCommand).toBe('function');
    expect(typeof api.getSessionInfo).toBe('function');
    expect(typeof api.getTerminalWidth).toBe('function');
    expect(typeof api.log).toBe('function');
    expect(typeof api.error).toBe('function');

    const width = await api.getTerminalWidth();
    expect(typeof width).toBe('number');
    expect(width).toBeGreaterThan(0);
  });
});

describe('RealPiAPI', () => {
  it('throws with graceful error when Pi.dev is not available', async () => {
    const { RealPiAPI } = await import('./piAdapter');
    const api = new RealPiAPI(null as any);

    await expect(
      api.registerCommand('/test', async () => {})
    ).rejects.toThrow(/not available/);
  });
});
