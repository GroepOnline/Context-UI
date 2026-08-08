"use strict";
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
const vitest_1 = require("vitest");
const extension_1 = require("./extension");
const piAdapter_1 = require("./piAdapter");
(0, vitest_1.describe)('ContextExtension', () => {
    (0, vitest_1.describe)('activation', () => {
        (0, vitest_1.it)('registers correct name and commands', async () => {
            const extension = new extension_1.ContextExtension();
            const mockAPI = new piAdapter_1.MockPiAPI();
            await extension.activate(mockAPI);
            (0, vitest_1.expect)(extension.name).toBe('pi-context-extension');
            (0, vitest_1.expect)(extension.commands.length).toBe(3);
            (0, vitest_1.expect)(extension.description).toBeDefined();
        });
    });
    (0, vitest_1.describe)('command execution', () => {
        (0, vitest_1.it)('executes /context command without error', async () => {
            const extension = new extension_1.ContextExtension();
            const mockAPI = new piAdapter_1.MockPiAPI();
            await extension.activate(mockAPI);
            const context = (0, piAdapter_1.buildCommandContext)(['compact']);
            // Should not throw
            await mockAPI.testExecuteCommand('/context', context);
        });
        (0, vitest_1.it)('executes all command modes without error', async () => {
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
    });
});
(0, vitest_1.describe)('MockPiAPI', () => {
    (0, vitest_1.it)('supports full lifecycle API surface', async () => {
        const api = new piAdapter_1.MockPiAPI();
        (0, vitest_1.expect)(typeof api.registerCommand).toBe('function');
        (0, vitest_1.expect)(typeof api.getSessionInfo).toBe('function');
        (0, vitest_1.expect)(typeof api.getTerminalWidth).toBe('function');
        (0, vitest_1.expect)(typeof api.log).toBe('function');
        (0, vitest_1.expect)(typeof api.error).toBe('function');
        const width = await api.getTerminalWidth();
        (0, vitest_1.expect)(typeof width).toBe('number');
        (0, vitest_1.expect)(width).toBeGreaterThan(0);
    });
});
(0, vitest_1.describe)('RealPiAPI', () => {
    (0, vitest_1.it)('throws with graceful error when Pi.dev is not available', async () => {
        const { RealPiAPI } = await Promise.resolve().then(() => __importStar(require('./piAdapter')));
        const api = new RealPiAPI(null);
        await (0, vitest_1.expect)(api.registerCommand('/test', async () => { })).rejects.toThrow(/not available/);
    });
});
