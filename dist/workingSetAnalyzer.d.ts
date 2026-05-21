/**
 * Working Set Analyzer - Analyzes active context and working set
 */
import { WorkingSet, PiCommandContext } from './types';
import { ContextEstimator } from './contextEstimator';
export declare class WorkingSetAnalyzer {
    private readonly estimator;
    private readonly maxFilesToShow;
    private readonly maxCommandsToShow;
    private readonly largeConsumerThreshold;
    constructor(estimator?: ContextEstimator, maxFilesToShow?: number, maxCommandsToShow?: number, largeConsumerThreshold?: number);
    /**
     * Analyze working set from Pi command context
     */
    analyze(context: PiCommandContext): WorkingSet;
    /**
     * Analyze files that are likely in context
     */
    private analyzeFiles;
    /**
     * Analyze commands executed
     */
    private analyzeCommands;
    /**
     * Analyze errors from context
     */
    private analyzeErrors;
    /**
     * Find large context consumers
     */
    private findLargeConsumers;
    /**
     * Extract TODO items from context
     */
    private extractTodos;
    /**
     * Helper: Estimate file tokens from path using content-type-aware ratio.
     * Returns a rough token estimate based on the file type and average file sizes.
     */
    private estimateFileTokens;
    /**
     * Helper: Estimate command output size
     */
    private estimateCommandSize;
    /**
     * Helper: Extract command name from output
     */
    private extractCommandName;
    /**
     * Helper: Extract error message from object
     */
    private extractErrorMessage;
    /**
     * Helper: Estimate object size
     */
    private estimateObjectSize;
    /**
     * Helper: Shorten path for display
     */
    private shortenPath;
}
