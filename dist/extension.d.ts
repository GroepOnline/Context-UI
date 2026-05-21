/**
 * Pi.dev Context Extension - Main Entry Point
 */
import { PiExtension, PiExtensionAPI } from './types';
export declare class ContextExtension implements PiExtension {
    name: string;
    version: string;
    description: string;
    commands: string[];
    private api;
    private estimator;
    private analyzer;
    private renderer;
    constructor(terminalWidth?: number);
    /**
     * Activate extension - register commands with Pi
     */
    activate(api: PiExtensionAPI): Promise<void>;
    /**
     * Deactivate extension
     */
    deactivate(): void;
    /**
     * Main command handler
     */
    private handleCommand;
    /**
     * Parse mode from command arguments
     */
    private parseMode;
    /**
     * Generate context report
     */
    private generateReport;
    /**
     * Generate recommendation based on risk and working set
     */
    private generateRecommendation;
}
/**
 * Export for Pi.dev extension loader
 * Pi.dev calls this when the extension is loaded.
 */
export declare function activate(api: PiExtensionAPI): Promise<void>;
/**
 * Export for testing
 */
export declare function deactivate(): void;
/**
 * Default export - extension instance
 */
declare const _default: ContextExtension;
export default _default;
