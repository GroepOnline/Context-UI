/**
 * Context Estimator - Token estimation logic
 * 
 * Uses a chars/4 approximation for token counting.
 * This can be replaced with actual tokenizer when available.
 */

import {
  TokenEstimate,
  ContextBreakdown,
  ContextStatus,
  RiskLevel,
  TokenType
} from './types';

export class ContextEstimator {
  private readonly maxTokens: number;
  private readonly codeWeight: number;
  private readonly logThreshold: number;
  private readonly diffThreshold: number;

  constructor(
    maxTokens: number = 200000,
    codeWeight: number = 1.2,
    logThreshold: number = 5000,
    diffThreshold: number = 3000
  ) {
    this.maxTokens = maxTokens;
    this.codeWeight = codeWeight;
    this.logThreshold = logThreshold;
    this.diffThreshold = diffThreshold;
  }

  /**
   * Estimate tokens from text using chars/4 approximation
   */
  estimateFromText(text: string, isCode: boolean = false): TokenEstimate {
    if (!text || text.length === 0) {
      return { count: 0, type: 'estimated' };
    }

    let estimate = text.length / 4;
    
    // Code is typically more token-dense
    if (isCode) {
      estimate *= this.codeWeight;
    }

    return {
      count: Math.round(estimate),
      type: 'estimated',
      source: 'chars/4 approximation'
    };
  }

  /**
   * Estimate tokens from an object (recursively)
   */
  estimateFromObject(obj: unknown): TokenEstimate {
    if (!obj) {
      return { count: 0, type: 'estimated' };
    }

    const text = JSON.stringify(obj);
    return this.estimateFromText(text, false);
  }

  /**
   * Estimate tokens from file content
   */
  estimateFromFile(content: string, filePath: string): TokenEstimate {
    const isCode = this.isCodeFile(filePath);
    const estimate = this.estimateFromText(content, isCode);
    estimate.source = `file:${filePath}`;
    return estimate;
  }

  /**
   * Detect if file is code
   */
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c',
      '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt'
    ];
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Estimate command output tokens
   */
  estimateCommandOutput(output: string): TokenEstimate {
    const estimate = this.estimateFromText(output, false);
    estimate.source = 'command-output';
    return estimate;
  }

  /**
   * Calculate risk level based on fill percentage
   */
  calculateRisk(fillPercentage: number): RiskLevel {
    if (fillPercentage < 50) return 'LOW';
    if (fillPercentage < 75) return 'MEDIUM';
    if (fillPercentage < 90) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Build complete context breakdown from available data
   */
  estimateBreakdown(
    messages?: unknown[],
    filesRead?: Array<{ path: string; content: string }>,
    toolOutputs?: unknown[],
    commandOutputs?: string[],
    diffs?: string[],
    logs?: string[],
    errors?: unknown[]
  ): ContextBreakdown {
    const messagesEst = messages 
      ? this.estimateFromObject(messages) 
      : this.createEmptyEstimate('messages');

    const filesEst = filesRead && filesRead.length > 0
      ? this.sumEstimates(
          filesRead.map(f => this.estimateFromFile(f.content, f.path)),
          'files'
        )
      : this.createEmptyEstimate('files');

    const toolsEst = toolOutputs 
      ? this.estimateFromObject(toolOutputs) 
      : this.createEmptyEstimate('tool-outputs');

    const commandsEst = commandOutputs && commandOutputs.length > 0
      ? this.sumEstimates(
          commandOutputs.map(c => this.estimateCommandOutput(c)),
          'command-outputs'
        )
      : this.createEmptyEstimate('command-outputs');

    const diffsEst = diffs && diffs.length > 0
      ? this.sumEstimates(
          diffs.map(d => this.estimateFromText(d, true)),
          'diffs'
        )
      : this.createEmptyEstimate('diffs');

    const logsEst = logs && logs.length > 0
      ? this.sumEstimates(
          logs.map(l => this.estimateFromText(l, false)),
          'logs'
        )
      : this.createEmptyEstimate('logs');

    const errorsEst = errors 
      ? this.estimateFromObject(errors) 
      : this.createEmptyEstimate('errors');

    const total = this.sumEstimates([
      messagesEst,
      filesEst,
      toolsEst,
      commandsEst,
      diffsEst,
      logsEst,
      errorsEst
    ], 'total');

    return {
      messages: messagesEst,
      files: filesEst,
      toolOutputs: toolsEst,
      commandOutputs: commandsEst,
      diffs: diffsEst,
      logs: logsEst,
      errors: errorsEst,
      total
    };
  }

  /**
   * Build context status from breakdown
   */
  buildStatus(breakdown: ContextBreakdown): ContextStatus {
    const used = breakdown.total.count;
    const remaining = Math.max(0, this.maxTokens - used);
    const fillPercentage = (used / this.maxTokens) * 100;
    const risk = this.calculateRisk(fillPercentage);

    return {
      used,
      total: this.maxTokens,
      remaining,
      fillPercentage,
      risk,
      breakdown
    };
  }

  /**
   * Helper: Create empty estimate
   */
  private createEmptyEstimate(source: string): TokenEstimate {
    return {
      count: 0,
      type: 'estimated',
      source
    };
  }

  /**
   * Helper: Sum multiple estimates
   */
  private sumEstimates(estimates: TokenEstimate[], source: string): TokenEstimate {
    const total = estimates.reduce((sum, est) => sum + est.count, 0);
    
    // Determine type: if any is estimated, result is estimated
    const types = new Set(estimates.map(e => e.type));
    const type: TokenType = types.has('estimated') ? 'estimated' 
      : types.has('api-derived') ? 'api-derived' 
      : 'exact';

    return {
      count: total,
      type,
      source
    };
  }
}
