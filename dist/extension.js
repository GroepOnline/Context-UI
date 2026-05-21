"use strict";
/**
 * Pi.dev Context Extension - Main Entry Point
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextExtension = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const contextEstimator_1 = require("./contextEstimator");
const workingSetAnalyzer_1 = require("./workingSetAnalyzer");
const terminalRenderer_1 = require("./terminalRenderer");
const piAdapter_1 = require("./piAdapter");
class ContextExtension {
    name = 'pi-context-extension';
    version = '1.0.0';
    description = 'Context status, token estimation and working set overview (/context, /ctx, /tokens) with a fun twist (/context fun)';
    commands = ['/context', '/ctx', '/tokens'];
    api = null;
    estimator;
    analyzer;
    renderer;
    constructor(terminalWidth) {
        this.estimator = new contextEstimator_1.ContextEstimator();
        this.analyzer = new workingSetAnalyzer_1.WorkingSetAnalyzer(this.estimator);
        this.renderer = new terminalRenderer_1.TerminalRenderer(terminalWidth);
    }
    /**
     * Activate extension - register commands with Pi
     */
    async activate(api) {
        this.api = api;
        // Detect terminal width from Pi API
        try {
            const width = await api.getTerminalWidth();
            if (width > 0) {
                this.renderer = new terminalRenderer_1.TerminalRenderer(width);
            }
        }
        catch {
            // Use default
        }
        // Register all command variants
        for (const cmd of this.commands) {
            await api.registerCommand(cmd, this.handleCommand.bind(this));
        }
        api.log(`Context extension v${this.version} activated — commands: ${this.commands.join(', ')}`);
    }
    /**
     * Deactivate extension
     */
    deactivate() {
        this.api?.log('Context extension deactivated');
        this.api = null;
    }
    /**
     * Main command handler
     */
    async handleCommand(ctx) {
        try {
            const mode = this.parseMode(ctx.args);
            const report = await this.generateReport(ctx, mode);
            const output = this.renderer.render(report);
            // Output to terminal
            console.log('\n' + output + '\n');
            // Also log through Pi API if available
            this.api?.log(output);
        }
        catch (error) {
            const errorMsg = `Error executing /context: ${error}`;
            console.error(errorMsg);
            this.api?.error(errorMsg);
        }
    }
    /**
     * Parse mode from command arguments
     */
    parseMode(args) {
        if (args.length === 0 || !args[0]) {
            return 'default';
        }
        const mode = args[0].toLowerCase();
        switch (mode) {
            case 'compact':
                return 'compact';
            case 'tokens':
                return 'tokens';
            case 'files':
                return 'files';
            case 'summary':
                return 'summary';
            case 'fun':
                return 'fun';
            default:
                return 'default';
        }
    }
    /**
     * Generate context report
     */
    async generateReport(ctx, mode) {
        // Get session info if available
        let sessionInfo = {};
        if (this.api && typeof this.api.getSessionInfo === 'function') {
            try {
                sessionInfo = await this.api.getSessionInfo();
            }
            catch (error) {
                // Continue with empty session info
                this.api?.log('Could not retrieve session info, using estimates');
            }
        }
        // Build full context
        const fullContext = (0, piAdapter_1.buildCommandContext)(ctx.args, sessionInfo);
        // Estimate tokens
        const breakdown = this.estimator.estimateBreakdown(fullContext.sessionHistory, fullContext.filesRead?.map((f) => ({
            path: typeof f === 'string' ? f : f.path,
            content: typeof f === 'string' ? '' : f.content || ''
        })), fullContext.toolOutputs, fullContext.commandOutputs);
        // Build status
        const status = this.estimator.buildStatus(breakdown);
        // Analyze working set
        const workingSet = this.analyzer.analyze(fullContext);
        // Generate recommendation
        const recommendation = this.generateRecommendation(status.risk, workingSet);
        return {
            status,
            workingSet,
            recommendation,
            mode,
            timestamp: Date.now()
        };
    }
    /**
     * Generate recommendation based on risk and working set
     */
    generateRecommendation(risk, workingSet) {
        switch (risk) {
            case 'LOW':
                return {
                    action: 'continue',
                    message: 'Continue normally. No compaction needed yet.',
                    priority: 'low'
                };
            case 'MEDIUM':
                return {
                    action: 'trim-logs',
                    message: 'Consider trimming large logs or outputs to free context.',
                    priority: 'medium'
                };
            case 'HIGH':
                if (workingSet.largeConsumers.length > 0) {
                    return {
                        action: 'compact',
                        message: 'High context usage. Consider compacting or summarizing session.',
                        priority: 'high'
                    };
                }
                return {
                    action: 'summarize',
                    message: 'Context nearing limit. Consider generating summary for new session.',
                    priority: 'high'
                };
            case 'CRITICAL':
                return {
                    action: 'new-session',
                    message: 'CRITICAL: Start a new session with summary handoff to avoid overflow.',
                    priority: 'high'
                };
            default:
                return {
                    action: 'continue',
                    message: 'Unable to assess context state.',
                    priority: 'low'
                };
        }
    }
}
exports.ContextExtension = ContextExtension;
// ============ Extension Activation ============
/**
 * Export for Pi.dev extension loader
 * Pi.dev calls this when the extension is loaded.
 */
function activate(api) {
    // Try to detect terminal width up front, pass to constructor
    const width = typeof api.getTerminalWidth === 'function'
        ? undefined // will be resolved inside activate()
        : process.stdout?.columns ?? 80;
    const extension = new ContextExtension(width);
    return extension.activate(api);
}
/**
 * Export for testing
 */
function deactivate() {
    // Cleanup if needed
}
/**
 * Default export - extension instance
 */
exports.default = new ContextExtension();
