/**
 * Pi.dev API Adapter
 * 
 * This module provides an abstraction layer between the extension
 * and Pi.dev's extension API. When Pi.dev's actual API is available,
 * implement the methods in this adapter.
 */

import {
  PiExtensionAPI,
  PiCommandContext
} from './types';

/**
 * Mock Pi API for development and testing
 */
export class MockPiAPI implements PiExtensionAPI {
  private commands: Map<string, (ctx: PiCommandContext) => Promise<void>> = new Map();
  private sessionData: any = {};

  async registerCommand(
    command: string,
    handler: (ctx: PiCommandContext) => Promise<void>
  ): Promise<void> {
    this.commands.set(command, handler);
    console.log(`[MockPiAPI] Registered command: ${command}`);
  }

  async getSessionInfo(): Promise<unknown> {
    return this.sessionData;
  }

  log(message: string): void {
    console.log(`[Pi] ${message}`);
  }

  error(message: string): void {
    console.error(`[Pi Error] ${message}`);
  }

  /**
   * Test helper: simulate command execution
   */
  async testExecuteCommand(command: string, context: PiCommandContext): Promise<void> {
    const handler = this.commands.get(command);
    if (!handler) {
      throw new Error(`Command not found: ${command}`);
    }
    await handler(context);
  }

  /**
   * Test helper: set mock session data
   */
  setSessionData(data: any): void {
    this.sessionData = data;
  }
}

/**
 * Real Pi API wrapper
 * 
 * This will be implemented when Pi.dev provides the actual extension API.
 * For now, this is a placeholder that wraps the expected Pi.dev API.
 */
export class RealPiAPI implements PiExtensionAPI {
  private piGlobal: any;

  constructor(piGlobal?: any) {
    // When Pi.dev provides the global API object, it will be injected here
    this.piGlobal = piGlobal || (global as any).pi;
  }

  async registerCommand(
    command: string,
    handler: (ctx: PiCommandContext) => Promise<void>
  ): Promise<void> {
    if (!this.piGlobal) {
      throw new Error('Pi.dev API not available. Are you running inside Pi.dev?');
    }

    // Expected Pi.dev API: pi.registerCommand(command, handler)
    // Adjust this to match actual Pi.dev API when available
    if (typeof this.piGlobal.registerCommand === 'function') {
      await this.piGlobal.registerCommand(command, handler);
    } else {
      throw new Error('Pi.dev API does not support registerCommand');
    }
  }

  async getSessionInfo(): Promise<unknown> {
    if (!this.piGlobal) {
      return {};
    }

    // Expected Pi.dev API: pi.getSessionInfo()
    if (typeof this.piGlobal.getSessionInfo === 'function') {
      return await this.piGlobal.getSessionInfo();
    }

    return {};
  }

  log(message: string): void {
    if (this.piGlobal && typeof this.piGlobal.log === 'function') {
      this.piGlobal.log(message);
    } else {
      console.log(message);
    }
  }

  error(message: string): void {
    if (this.piGlobal && typeof this.piGlobal.error === 'function') {
      this.piGlobal.error(message);
    } else {
      console.error(message);
    }
  }
}

/**
 * Create appropriate Pi API instance
 */
export function createPiAPI(): PiExtensionAPI {
  // Check if running in Pi.dev environment
  const piGlobal = (global as any).pi;
  
  if (piGlobal) {
    return new RealPiAPI(piGlobal);
  }
  
  // Fallback to mock for development/testing
  return new MockPiAPI();
}

/**
 * Helper: Build PiCommandContext from session data
 * This adapts whatever Pi.dev provides to our standard context format
 */
export function buildCommandContext(
  args: string[],
  sessionInfo?: any
): PiCommandContext {
  // Normalize filesRead to always be string array
  let filesRead = sessionInfo?.filesRead || [];
  if (Array.isArray(filesRead)) {
    filesRead = filesRead.map((f: any) => {
      if (typeof f === 'string') return f;
      if (f && typeof f === 'object' && f.path) return f.path;
      return String(f);
    });
  }

  return {
    args,
    sessionHistory: sessionInfo?.history || [],
    recentMessages: sessionInfo?.recentMessages || [],
    filesRead,
    toolOutputs: sessionInfo?.toolOutputs || [],
    commandOutputs: sessionInfo?.commandOutputs || [],
    currentTask: sessionInfo?.currentTask
  };
}
