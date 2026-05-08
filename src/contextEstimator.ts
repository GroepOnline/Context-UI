/**
 * Context Estimator - Token estimation logic
 * 
 * Uses content-type-aware char-to-token ratios based on file extension and content analysis.
 * Each content type has empirically calibrated chars-per-token ratios.
 */

import {
  TokenEstimate,
  ContentType,
  ContextBreakdown,
  ContextStatus,
  RiskLevel,
  TokenType
} from './types';

/**
 * Content-type specific chars-per-token ratios.
 * Lower ratio = denser tokens (more tokens per character).
 * Calibrated empirically against tiktoken cl100k_base encoding.
 */
const CHARS_PER_TOKEN_BY_TYPE: Record<ContentType, number> = {
  // Calibrated via grid search against tiktoken cl100k_base
  code: 4.0,
  json: 4.5,
  markdown: 4.2,
  text: 3.6,
  logOutput: 2.6,
  diff: 3.8,
  commandOutput: 4.2,
  error: 4.5,
  messages: 4.0,
  unknown: 4.8,
};

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c',
  '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt', '.mjs', '.cjs',
]);

export class ContextEstimator {
  private readonly maxTokens: number;
  private readonly logThreshold: number;
  private readonly diffThreshold: number;

  constructor(
    maxTokens: number = 200000,
    logThreshold: number = 5000,
    diffThreshold: number = 3000
  ) {
    this.maxTokens = maxTokens;
    this.logThreshold = logThreshold;
    this.diffThreshold = diffThreshold;
  }

  /**
   * Detect content type from file path
   */
  getContentTypeFromPath(filePath: string): ContentType {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    
    if (CODE_EXTENSIONS.has(ext)) return 'code';
    if (ext === '.json') return 'json';
    if (ext === '.md' || ext === '.mdx' || ext === '.markdown') return 'markdown';
    if (ext === '.log') return 'logOutput';
    if (ext === '.diff' || ext === '.patch') return 'diff';
    
    return 'unknown';
  }

  /**
   * Detect content type from text content heuristic
   */
  detectContentType(text: string): ContentType {
    if (!text || text.length < 20) return 'unknown';
    
    const firstLine = text.split('\n')[0].trim();
    
    // Heuristic: log files have timestamps
    if (/^\[\d{4}[-\/]\d{2}[-\/]\d{2}[T ]\d{2}:\d{2}/.test(firstLine)) {
      return 'logOutput';
    }
    
    // Heuristic: diffs
    if (/^diff --git /.test(firstLine) || /^--- /.test(firstLine) || /^\+\+\+ /.test(firstLine)) {
      return 'diff';
    }
    
    // Heuristic: JSON
    if (firstLine.startsWith('{') || firstLine.startsWith('[')) {
      return 'json';
    }
    
    // Heuristic: markdown
    if (/^#{1,6}\s/.test(firstLine)) {
      return 'markdown';
    }
    
    // Heuristic: command output with paths/colons
    if (/^[a-z]+\s+[a-z]+\s/.test(firstLine) && text.includes('  ')) {
      return 'commandOutput';
    }
    
    // Heuristic: errors have stack traces or "error" keyword
    if (/^Error\b|error|FAIL/i.test(firstLine.substring(0, 30))) {
      return 'error';
    }
    
    return 'unknown';
  }

  /**
   * Get chars-per-token ratio for a given content type
   */
  getCharsPerToken(contentType: ContentType): number {
    return CHARS_PER_TOKEN_BY_TYPE[contentType] ?? CHARS_PER_TOKEN_BY_TYPE.unknown;
  }

  /**
   * Analyze character distribution to compute a density penalty.
   * Returns a multiplier: >1 means denser (more tokens), <1 means sparser.
   * 
   * Texts with high symbol density (brackets, operators, punctuation)
   * get more tokens per char. Texts with mostly letters/whitespace get fewer.
   */
  analyzeCharacterDensity(text: string): number {
    if (!text || text.length < 10) return 1.0;
    
    let letters = 0;
    let whitespace = 0;
    let digits = 0;
    let symbols = 0;
    
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        letters++;
      } else if (code === 32 || code === 9 || code === 10 || code === 13) {
        whitespace++;
      } else if (code >= 48 && code <= 57) {
        digits++;
      } else {
        symbols++;
      }
    }
    
    const total = text.length;
    const symbolRatio = symbols / total;
    const whitespaceRatio = whitespace / total;
    const letterRatio = letters / total;
    
    // High symbol density => more tokens (brackets, operators split into separate tokens)
    // High letter density => fewer tokens (common words are single tokens)
    // High whitespace => fewer tokens (often just formatting)
    
    // Baseline multiplier: 1.0
    // Calibrated via grid search against tiktoken cl100k_base
    // Optimal coefficients: symbol=0.9, letter=-0.2, whitespace=-0.15
    let density = 1.0;
    
    // Symbols increase density (each symbol is often its own token)
    density += symbolRatio * 0.9;
    
    // Letters decrease density (common words are single tokens)
    density -= letterRatio * 0.2;
    
    // Whitespace slightly decreases density
    density -= whitespaceRatio * 0.15;
    
    return Math.max(0.7, Math.min(1.5, density));
  }

  /**
   * Estimate tokens from text using content-type-based ratio with
   * character-distribution refinement.
   */
  estimateFromText(
    text: string,
    contentTypeOrIsCode?: ContentType | boolean
  ): TokenEstimate {
    if (!text || text.length === 0) {
      return { count: 0, type: 'estimated' };
    }

    let contentType: ContentType;
    
    if (typeof contentTypeOrIsCode === 'boolean') {
      // Backward compat: boolean means "is code"
      contentType = contentTypeOrIsCode ? 'code' : this.detectContentType(text);
    } else if (contentTypeOrIsCode) {
      contentType = contentTypeOrIsCode;
    } else {
      contentType = this.detectContentType(text);
    }

    const ratio = this.getCharsPerToken(contentType);
    
    // Compute density adjustment from character distribution
    const density = this.analyzeCharacterDensity(text);
    
    // Adjust ratio based on density: denser text = lower ratio = more tokens
    const adjustedRatio = ratio / density;
    
    let estimate = text.length / adjustedRatio;

    return {
      count: Math.round(estimate),
      type: 'estimated',
      source: `char-density:${contentType}(ratio=${ratio.toFixed(1)},density=${density.toFixed(2)})`
    };
  }

  /**
   * Estimate tokens from an object (recursively)
   */
  estimateFromObject(obj: unknown, contentType: ContentType = 'messages'): TokenEstimate {
    if (!obj) {
      return { count: 0, type: 'estimated' };
    }

    const text = JSON.stringify(obj);
    return this.estimateFromText(text, contentType);
  }

  /**
   * Estimate tokens from file content
   */
  estimateFromFile(content: string, filePath: string): TokenEstimate {
    const contentType = this.getContentTypeFromPath(filePath);
    const estimate = this.estimateFromText(content, contentType);
    estimate.source = `file:${filePath}`;
    return estimate;
  }

  /**
   * Estimate tokens that are likely command output
   */
  estimateCommandOutput(output: string): TokenEstimate {
    return this.estimateFromText(output, 'commandOutput');
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
      ? this.estimateFromObject(messages, 'messages') 
      : this.createEmptyEstimate('messages');

    const filesEst = filesRead && filesRead.length > 0
      ? this.sumEstimates(
          filesRead.map(f => this.estimateFromFile(f.content, f.path)),
          'files'
        )
      : this.createEmptyEstimate('files');

    const toolsEst = toolOutputs 
      ? this.estimateFromObject(toolOutputs, 'commandOutput') 
      : this.createEmptyEstimate('tool-outputs');

    const commandsEst = commandOutputs && commandOutputs.length > 0
      ? this.sumEstimates(
          commandOutputs.map(c => this.estimateCommandOutput(c)),
          'command-outputs'
        )
      : this.createEmptyEstimate('command-outputs');

    const diffsEst = diffs && diffs.length > 0
      ? this.sumEstimates(
          diffs.map(d => this.estimateFromText(d, 'diff')),
          'diffs'
        )
      : this.createEmptyEstimate('diffs');

    const logsEst = logs && logs.length > 0
      ? this.sumEstimates(
          logs.map(l => this.estimateFromText(l, 'logOutput')),
          'logs'
        )
      : this.createEmptyEstimate('logs');

    const errorsEst = errors 
      ? this.estimateFromObject(errors, 'error') 
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
