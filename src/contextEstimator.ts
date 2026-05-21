/**
 * Context Estimator — Token estimation engine for Pi.dev context tracking.
 *
 * Estimates token counts from text, files, messages, commands,
 * and tool outputs. Uses content-type–aware character-to-token
 * ratios to approximate LLM token consumption.
 */

import {
  TokenEstimate,
  TokenType,
  ContentType,
  ContextBreakdown,
  ContextStatus,
  RiskLevel,
} from './types';

const DEFAULT_WINDOW_TOKENS = 200_000;

/**
 * Characters-per-token ratios by content type.
 * Lower ratio = tighter packing = more tokens per character.
 */
const CHARS_PER_TOKEN: Record<ContentType, number> = {
  code: 4.0,
  json: 3.5,
  markdown: 3.8,
  text: 4.0,
  logOutput: 2.6,
  diff: 4.5,
  commandOutput: 3.0,
  error: 4.0,
  messages: 3.8,
  unknown: 4.0,
};

const EXTENSION_MAP: Record<string, ContentType> = {
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  py: 'code',
  rb: 'code',
  go: 'code',
  rs: 'code',
  java: 'code',
  cs: 'code',
  cpp: 'code',
  c: 'code',
  h: 'code',
  swift: 'code',
  kt: 'code',
  php: 'code',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  log: 'logOutput',
  diff: 'diff',
  patch: 'diff',
  txt: 'text',
};

export class ContextEstimator {
  private readonly maxTokens: number;

  constructor(maxTokens: number = DEFAULT_WINDOW_TOKENS) {
    this.maxTokens = maxTokens;
  }

  // ==================================================================
  //  PUBLIC API
  // ==================================================================

  /**
   * Estimate token count from raw text, optionally specifying a content
   * type to use the appropriate character-to-token ratio.
   */
  estimateFromText(text: string, contentType?: string): TokenEstimate {
    const type = contentType
      ? this.resolveContentType(contentType)
      : this.detectContentType(text);
    const ratio = this.getCharsPerToken(type);
    const count = this.computeTokens(text.length, ratio);

    return {
      count,
      type: 'estimated',
      source: `${type}-${ratio}`,
    };
  }

  /**
   * Detect the content type category for a file path based on its extension.
   */
  getContentTypeFromPath(filePath: string): ContentType {
    const parts = filePath.split('.');
    if (parts.length < 2) return 'unknown';

    const ext = parts[parts.length - 1].toLowerCase();
    return EXTENSION_MAP[ext] ?? 'unknown';
  }

  /**
   * Return the characters-per-token ratio for a given content type.
   */
  getCharsPerToken(contentType: string): number {
    const resolved = this.resolveContentType(contentType);
    return CHARS_PER_TOKEN[resolved];
  }

  /**
   * Classify context risk from a fill percentage.
   */
  calculateRisk(fillPercentage: number): RiskLevel {
    if (fillPercentage < 50) return 'LOW';
    if (fillPercentage < 80) return 'MEDIUM';
    if (fillPercentage < 95) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Estimate a full breakdown of context usage by category.
   * Accepts up to 7 positional args for fine-grained estimation;
   * extra args beyond the first 4 are treated as diffs, logs, errors.
   */
  estimateBreakdown(
    messages?: unknown[],
    files?: Array<{ path: string; content: string }>,
    toolOutputs?: unknown[],
    commandOutputs?: string[],
    diffs?: string[],
    logs?: string[],
    errors?: unknown[],
  ): ContextBreakdown {
    const messagesEst = this.estimateList(messages, 'messages');
    const filesEst = this.estimateFiles(files);
    const toolOutputsEst = this.estimateList(toolOutputs, 'json');
    const commandOutputsEst = this.estimateTextList(commandOutputs, 'commandOutput');
    const diffsEst = this.estimateTextList(diffs, 'diff');
    const logsEst = this.estimateTextList(logs, 'logOutput');
    const errorsEst = this.estimateList(errors, 'error');

    const totalCount =
      messagesEst.count +
      filesEst.count +
      toolOutputsEst.count +
      commandOutputsEst.count +
      diffsEst.count +
      logsEst.count +
      errorsEst.count;

    const total: TokenEstimate = {
      count: totalCount,
      type: 'estimated',
      source: 'breakdown-sum',
    };

    return {
      messages: messagesEst,
      files: filesEst,
      toolOutputs: toolOutputsEst,
      commandOutputs: commandOutputsEst,
      diffs: diffsEst,
      logs: logsEst,
      errors: errorsEst,
      total,
    };
  }

  /**
   * Build a ContextStatus from a breakdown.
   */
  buildStatus(breakdown: ContextBreakdown): ContextStatus {
    const used = breakdown.total.count;
    const total = this.maxTokens;
    const remaining = Math.max(0, total - used);
    const fillPercentage = total > 0
      ? parseFloat(((used / total) * 100).toFixed(1))
      : 0;
    const risk = this.calculateRisk(fillPercentage);

    return {
      used,
      total,
      remaining,
      fillPercentage,
      risk,
      breakdown,
    };
  }

  // ==================================================================
  //  INTERNAL HELPERS
  // ==================================================================

  /**
   * Derive a content type heuristically from text content.
   */
  private detectContentType(text: string): ContentType {
    const sample = text.slice(0, 500).trim();

    if (this.looksLikeCode(sample)) return 'code';
    if (this.looksLikeJson(sample)) return 'json';
    if (this.looksLikeMarkdown(sample)) return 'markdown';
    if (this.looksLikeLogOutput(sample)) return 'logOutput';
    if (this.looksLikeDiff(sample)) return 'diff';
    if (this.looksLikeCommandOutput(sample)) return 'commandOutput';
    if (this.looksLikeError(sample)) return 'error';

    return 'text';
  }

  private looksLikeCode(text: string): boolean {
    const codeSig = /^(const|let|var|function|class|import|export|def )|(if\s*\()|(^[{};])/m;
    return codeSig.test(text);
  }

  private looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  private looksLikeMarkdown(text: string): boolean {
    return /^#{1,6}\s+/m.test(text) || text.includes('```');
  }

  private looksLikeLogOutput(text: string): boolean {
    return /^\[?\d{4}[-/]\d{2}[-/]\d{2}/m.test(text) &&
           /(INFO|WARN|ERROR|DEBUG|TRACE)/i.test(text);
  }

  private looksLikeDiff(text: string): boolean {
    return /^diff --git/m.test(text) ||
           /^@@ -\d+,\d+ \+\d+,\d+ @@/m.test(text);
  }

  private looksLikeCommandOutput(text: string): boolean {
    return text.includes('$ ') ||
           /^\s*\[[\w./]+\][$#]/m.test(text) ||
           /^> /m.test(text);
  }

  private looksLikeError(text: string): boolean {
    return /error|exception|traceback/i.test(text) &&
           (text.includes('at ') || text.includes('File "') || /:\d+:\d+/.test(text));
  }

  /** Resolve a loose content-type string to a canonical ContentType. */
  private resolveContentType(type: string): ContentType {
    const key = type as ContentType;
    if (CHARS_PER_TOKEN[key] !== undefined) return key;
    return 'unknown';
  }

  /** Compute token count from character count and ratio. */
  private computeTokens(charCount: number, ratio: number): number {
    if (charCount <= 0 || ratio <= 0) return 0;
    const tokens = Math.ceil(charCount / ratio);
    return Math.max(1, tokens);
  }

  /** Estimate tokens for a list of flat items (strings or objects). */
  private estimateList(items: unknown[] | undefined, contentType: string): TokenEstimate {
    if (!items || items.length === 0) return this.emptyEstimate();

    let charCount = 0;
    for (const item of items) {
      if (typeof item === 'string') {
        charCount += item.length;
      } else if (item !== null && item !== undefined) {
        charCount += this.safeStringify(item).length;
      }
    }

    const ratio = this.getCharsPerToken(contentType);
    return {
      count: this.computeTokens(charCount, ratio),
      type: 'estimated',
      source: contentType,
    };
  }

  /** Estimate tokens for a list of text strings with a specified content type. */
  private estimateTextList(
    items: string[] | undefined,
    contentType: string,
  ): TokenEstimate {
    if (!items || items.length === 0) return this.emptyEstimate();

    let charCount = 0;
    for (const item of items) {
      charCount += item.length;
    }

    const ratio = this.getCharsPerToken(contentType);
    return {
      count: this.computeTokens(charCount, ratio),
      type: 'estimated',
      source: contentType,
    };
  }

  /** Estimate tokens for files, using per-file content type detection. */
  private estimateFiles(
    files: Array<{ path: string; content: string }> | undefined,
  ): TokenEstimate {
    if (!files || files.length === 0) return this.emptyEstimate();

    let tokenSum = 0;
    for (const file of files) {
      const contentType = this.getContentTypeFromPath(file.path);
      const ratio = this.getCharsPerToken(contentType);
      const chars = file.content.length;
      tokenSum += this.computeTokens(chars, ratio);
    }

    return {
      count: tokenSum,
      type: 'estimated',
      source: 'files',
    };
  }

  /** Safe JSON.stringify that handles circular references. */
  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[unserializable]';
    }
  }

  /** Return a zeroed-out token estimate. */
  private emptyEstimate(): TokenEstimate {
    return { count: 0, type: 'estimated', source: 'none' };
  }
}
