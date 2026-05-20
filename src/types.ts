/**
 * Type definitions for Pi Context Extension
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ContextMode = 'default' | 'compact' | 'tokens' | 'files' | 'summary' | 'fun';

export type TokenType = 'exact' | 'api-derived' | 'estimated';

/** Content type categories for token estimation ratios */
export type ContentType =
  | 'code'
  | 'json'
  | 'markdown'
  | 'text'
  | 'logOutput'
  | 'diff'
  | 'commandOutput'
  | 'error'
  | 'messages'
  | 'unknown';

export interface TokenEstimate {
  count: number;
  type: TokenType;
  source?: string;
}

export interface ContextBreakdown {
  messages: TokenEstimate;
  files: TokenEstimate;
  toolOutputs: TokenEstimate;
  commandOutputs: TokenEstimate;
  diffs: TokenEstimate;
  logs: TokenEstimate;
  errors: TokenEstimate;
  total: TokenEstimate;
}

export interface WorkingSetFile {
  path: string;
  lastAccess?: number;
  size?: number;
  tokenEstimate?: number;
  reason: string;
}

export interface WorkingSetCommand {
  command: string;
  timestamp?: number;
  outputSize?: number;
}

export interface WorkingSetError {
  message: string;
  file?: string;
  line?: number;
  timestamp?: number;
}

export interface WorkingSet {
  task?: string;
  files: WorkingSetFile[];
  commands: WorkingSetCommand[];
  errors: WorkingSetError[];
  largeConsumers: string[];
  todos?: string[];
}

export interface ContextStatus {
  used: number;
  total: number;
  remaining: number;
  fillPercentage: number;
  risk: RiskLevel;
  breakdown: ContextBreakdown;
}

export interface Recommendation {
  action: 'continue' | 'compact' | 'trim-logs' | 'summarize' | 'new-session';
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ContextReport {
  status: ContextStatus;
  workingSet: WorkingSet;
  recommendation: Recommendation;
  mode: ContextMode;
  timestamp: number;
}

export interface PiCommandContext {
  args: string[];
  sessionHistory?: unknown[];
  recentMessages?: unknown[];
  filesRead?: string[];
  toolOutputs?: unknown[];
  commandOutputs?: string[];
  currentTask?: string;
}

export interface PiExtensionAPI {
  registerCommand(command: string, handler: (ctx: PiCommandContext) => Promise<void>): Promise<void>;
  getSessionInfo(): Promise<unknown>;
  getTerminalWidth(): Promise<number>;
  log(message: string): void;
  error(message: string): void;
}

export interface PiExtension {
  name: string;
  version: string;
  description?: string;
  commands: string[];
  activate(api: PiExtensionAPI): Promise<void>;
  deactivate(): void;
}
