/**
 * Pi.dev API Adapter
 *
 * This module provides an abstraction layer between the extension
 * and Pi.dev's extension API. When Pi.dev's actual API is available,
 * implement the methods in this adapter.
 *
 * Expected Pi.dev extension API surface:
 *   pi.registerCommand(name, handler)  — register a slash command
 *   pi.getSessionInfo()                — get current session context
 *   pi.getTerminalWidth()              — detect terminal columns
 *   pi.onActivate() / onDeactivate()   — lifecycle hooks
 *   pi.log(msg) / pi.error(msg)        — logging
 */
import { PiExtensionAPI, PiCommandContext } from './types';
/**
 * Mock Pi API — used outside Pi.dev for development and testing.
 */
export declare class MockPiAPI implements PiExtensionAPI {
    private commands;
    private sessionData;
    registerCommand(command: string, handler: (ctx: PiCommandContext) => Promise<void>): Promise<void>;
    getSessionInfo(): Promise<unknown>;
    getTerminalWidth(): Promise<number>;
    log(message: string): void;
    error(message: string): void;
    /** Test helper: simulate command execution */
    testExecuteCommand(command: string, context: PiCommandContext): Promise<void>;
    /** Test helper: inject mock session data */
    setSessionData(data: any): void;
}
/**
 * Real Pi.dev API wrapper.
 *
 * Maps the expected Pi.dev extension API to our PiExtensionAPI interface.
 * When Pi.dev ships its actual API, adjust the property access patterns below.
 */
export declare class RealPiAPI implements PiExtensionAPI {
    private piGlobal;
    constructor(piGlobal?: any);
    registerCommand(command: string, handler: (ctx: PiCommandContext) => Promise<void>): Promise<void>;
    getSessionInfo(): Promise<unknown>;
    getTerminalWidth(): Promise<number>;
    log(message: string): void;
    error(message: string): void;
    private ensureApi;
}
/**
 * Create the appropriate Pi API instance based on the runtime environment.
 */
export declare function createPiAPI(): PiExtensionAPI;
/**
 * Helper: Build PiCommandContext from session data
 * This adapts whatever Pi.dev provides to our standard context format
 */
export declare function buildCommandContext(args: string[], sessionInfo?: any): PiCommandContext;
