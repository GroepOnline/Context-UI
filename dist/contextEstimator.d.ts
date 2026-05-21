/**
 * Context Estimator - Token estimation logic
 *
 * Uses content-type-aware char-to-token ratios based on file extension and content analysis.
 * Each content type has empirically calibrated chars-per-token ratios.
 */
import { TokenEstimate, ContentType, ContextBreakdown, ContextStatus, RiskLevel } from './types';
export declare class ContextEstimator {
    private readonly maxTokens;
    private readonly logThreshold;
    private readonly diffThreshold;
    constructor(maxTokens?: number, logThreshold?: number, diffThreshold?: number);
    /**
     * Detect content type from file path
     */
    getContentTypeFromPath(filePath: string): ContentType;
    /**
     * Detect content type from text content heuristic
     */
    detectContentType(text: string): ContentType;
    /**
     * Get chars-per-token ratio for a given content type
     */
    getCharsPerToken(contentType: ContentType): number;
    /**
     * Analyze character distribution to compute a density penalty.
     * Returns a multiplier: >1 means denser (more tokens), <1 means sparser.
     *
     * Texts with high symbol density (brackets, operators, punctuation)
     * get more tokens per char. Texts with mostly letters/whitespace get fewer.
     */
    analyzeCharacterDensity(text: string): number;
    /**
     * Estimate tokens from text using content-type-based ratio with
     * character-distribution refinement.
     */
    estimateFromText(text: string, contentTypeOrIsCode?: ContentType | boolean): TokenEstimate;
    /**
     * Estimate tokens from an object (recursively)
     */
    estimateFromObject(obj: unknown, contentType?: ContentType): TokenEstimate;
    /**
     * Estimate tokens from file content
     */
    estimateFromFile(content: string, filePath: string): TokenEstimate;
    /**
     * Estimate tokens that are likely command output
     */
    estimateCommandOutput(output: string): TokenEstimate;
    /**
     * Calculate risk level based on fill percentage
     */
    calculateRisk(fillPercentage: number): RiskLevel;
    /**
     * Build complete context breakdown from available data
     */
    estimateBreakdown(messages?: unknown[], filesRead?: Array<{
        path: string;
        content: string;
    }>, toolOutputs?: unknown[], commandOutputs?: string[], diffs?: string[], logs?: string[], errors?: unknown[]): ContextBreakdown;
    /**
     * Build context status from breakdown
     */
    buildStatus(breakdown: ContextBreakdown): ContextStatus;
    /**
     * Helper: Create empty estimate
     */
    private createEmptyEstimate;
    /**
     * Helper: Sum multiple estimates
     */
    private sumEstimates;
}
