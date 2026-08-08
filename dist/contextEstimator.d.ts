/**
 * Context Estimator — Token estimation engine for Pi.dev context tracking.
 *
 * Estimates token counts from text, files, messages, commands,
 * and tool outputs. Uses content-type–aware character-to-token
 * ratios to approximate LLM token consumption.
 */
import { TokenEstimate, ContentType, ContextBreakdown, ContextStatus, RiskLevel } from './types';
export declare class ContextEstimator {
    private readonly maxTokens;
    constructor(maxTokens?: number);
    /**
     * Estimate token count from raw text, optionally specifying a content
     * type to use the appropriate character-to-token ratio.
     */
    estimateFromText(text: string, contentType?: string): TokenEstimate;
    /**
     * Detect the content type category for a file path based on its extension.
     */
    getContentTypeFromPath(filePath: string): ContentType;
    /**
     * Return the characters-per-token ratio for a given content type.
     */
    getCharsPerToken(contentType: string): number;
    /**
     * Classify context risk from a fill percentage.
     */
    calculateRisk(fillPercentage: number): RiskLevel;
    /**
     * Estimate a full breakdown of context usage by category.
     * Accepts up to 7 positional args for fine-grained estimation;
     * extra args beyond the first 4 are treated as diffs, logs, errors.
     */
    estimateBreakdown(messages?: unknown[], files?: Array<{
        path: string;
        content: string;
    }>, toolOutputs?: unknown[], commandOutputs?: string[], diffs?: string[], logs?: string[], errors?: unknown[]): ContextBreakdown;
    /**
     * Build a ContextStatus from a breakdown.
     */
    buildStatus(breakdown: ContextBreakdown): ContextStatus;
    /**
     * Derive a content type heuristically from text content.
     */
    private detectContentType;
    private looksLikeCode;
    private looksLikeJson;
    private looksLikeMarkdown;
    private looksLikeLogOutput;
    private looksLikeDiff;
    private looksLikeCommandOutput;
    private looksLikeError;
    /** Resolve a loose content-type string to a canonical ContentType. */
    private resolveContentType;
    /** Compute token count from character count and ratio. */
    private computeTokens;
    /** Estimate tokens for a list of flat items (strings or objects). */
    private estimateList;
    /** Estimate tokens for a list of text strings with a specified content type. */
    private estimateTextList;
    /** Estimate tokens for files, using per-file content type detection. */
    private estimateFiles;
    /** Safe JSON.stringify that handles circular references. */
    private safeStringify;
    /** Return a zeroed-out token estimate. */
    private emptyEstimate;
}
