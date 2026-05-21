"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealPiAPI = exports.MockPiAPI = void 0;
exports.createPiAPI = createPiAPI;
exports.buildCommandContext = buildCommandContext;
// ========== MOCK API (dev / testing) ==========
/**
 * Mock Pi API — used outside Pi.dev for development and testing.
 */
class MockPiAPI {
    commands = new Map();
    sessionData = {};
    async registerCommand(command, handler) {
        this.commands.set(command, handler);
        console.log(`[MockPiAPI] Registered command: ${command}`);
    }
    async getSessionInfo() {
        return this.sessionData;
    }
    async getTerminalWidth() {
        return process.stdout?.columns ?? 80;
    }
    log(message) {
        console.log(`[Pi] ${message}`);
    }
    error(message) {
        console.error(`[Pi Error] ${message}`);
    }
    /** Test helper: simulate command execution */
    async testExecuteCommand(command, context) {
        const handler = this.commands.get(command);
        if (!handler)
            throw new Error(`Command not found: ${command}`);
        await handler(context);
    }
    /** Test helper: inject mock session data */
    setSessionData(data) {
        this.sessionData = data;
    }
}
exports.MockPiAPI = MockPiAPI;
// ========== REAL PI.DEV API ==========
/**
 * Real Pi.dev API wrapper.
 *
 * Maps the expected Pi.dev extension API to our PiExtensionAPI interface.
 * When Pi.dev ships its actual API, adjust the property access patterns below.
 */
class RealPiAPI {
    piGlobal;
    constructor(piGlobal) {
        this.piGlobal = piGlobal ?? global.pi;
    }
    async registerCommand(command, handler) {
        this.ensureApi();
        // Try several possible Pi.dev API shapes
        if (typeof this.piGlobal.registerCommand === 'function') {
            await this.piGlobal.registerCommand(command, handler);
        }
        else if (typeof this.piGlobal.commands?.register === 'function') {
            await this.piGlobal.commands.register(command, handler);
        }
        else if (typeof this.piGlobal.slashCommands?.add === 'function') {
            await this.piGlobal.slashCommands.add(command, handler);
        }
        else {
            throw new Error('Pi.dev API: no registerCommand / commands.register / slashCommands.add found. ' +
                'Update piAdapter.ts to match the actual Pi.dev extension API.');
        }
    }
    async getSessionInfo() {
        this.ensureApi();
        if (typeof this.piGlobal.getSessionInfo === 'function') {
            return await this.piGlobal.getSessionInfo();
        }
        if (typeof this.piGlobal.session?.getInfo === 'function') {
            return await this.piGlobal.session.getInfo();
        }
        if (typeof this.piGlobal.context?.getSession === 'function') {
            return await this.piGlobal.context.getSession();
        }
        return {};
    }
    async getTerminalWidth() {
        this.ensureApi();
        if (typeof this.piGlobal.getTerminalWidth === 'function') {
            return await this.piGlobal.getTerminalWidth();
        }
        if (typeof this.piGlobal.terminal?.width === 'number') {
            return this.piGlobal.terminal.width;
        }
        return process.stdout?.columns ?? 80;
    }
    log(message) {
        if (this.piGlobal && typeof this.piGlobal.log === 'function') {
            this.piGlobal.log(message);
        }
        else {
            console.log(message);
        }
    }
    error(message) {
        if (this.piGlobal && typeof this.piGlobal.error === 'function') {
            this.piGlobal.error(message);
        }
        else {
            console.error(message);
        }
    }
    ensureApi() {
        if (!this.piGlobal) {
            throw new Error('Pi.dev API not available. Run this inside Pi.dev or use MockPiAPI for testing.');
        }
    }
}
exports.RealPiAPI = RealPiAPI;
// ========== FACTORY ==========
/**
 * Create the appropriate Pi API instance based on the runtime environment.
 */
function createPiAPI() {
    const piGlobal = global.pi;
    if (piGlobal) {
        return new RealPiAPI(piGlobal);
    }
    return new MockPiAPI();
}
/**
 * Helper: Build PiCommandContext from session data
 * This adapts whatever Pi.dev provides to our standard context format
 */
function buildCommandContext(args, sessionInfo) {
    // Normalize filesRead to always be string array
    let filesRead = sessionInfo?.filesRead || [];
    if (Array.isArray(filesRead)) {
        filesRead = filesRead.map((f) => {
            if (typeof f === 'string')
                return f;
            if (f && typeof f === 'object' && f.path)
                return f.path;
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
