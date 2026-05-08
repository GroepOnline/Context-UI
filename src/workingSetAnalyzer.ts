/**
 * Working Set Analyzer - Analyzes active context and working set
 */

import {
  WorkingSet,
  WorkingSetFile,
  WorkingSetCommand,
  WorkingSetError,
  PiCommandContext
} from './types';
import { ContextEstimator } from './contextEstimator';

export class WorkingSetAnalyzer {
  private readonly estimator: ContextEstimator;
  private readonly maxFilesToShow: number;
  private readonly maxCommandsToShow: number;
  private readonly largeConsumerThreshold: number;

  constructor(
    estimator?: ContextEstimator,
    maxFilesToShow: number = 10,
    maxCommandsToShow: number = 5,
    largeConsumerThreshold: number = 5000
  ) {
    this.estimator = estimator || new ContextEstimator();
    this.maxFilesToShow = maxFilesToShow;
    this.maxCommandsToShow = maxCommandsToShow;
    this.largeConsumerThreshold = largeConsumerThreshold;
  }

  /**
   * Analyze working set from Pi command context
   */
  analyze(context: PiCommandContext): WorkingSet {
    const files = this.analyzeFiles(context);
    const commands = this.analyzeCommands(context);
    const errors = this.analyzeErrors(context);
    const largeConsumers = this.findLargeConsumers(context, files, commands);

    return {
      task: context.currentTask,
      files,
      commands,
      errors,
      largeConsumers,
      todos: this.extractTodos(context)
    };
  }

  /**
   * Analyze files that are likely in context
   */
  private analyzeFiles(context: PiCommandContext): WorkingSetFile[] {
    if (!context.filesRead || context.filesRead.length === 0) {
      return [];
    }

    const fileMap = new Map<string, WorkingSetFile>();

    // Deduplicate and categorize
    for (const file of context.filesRead) {
      const path = typeof file === 'string' ? file : String(file);
      
      if (fileMap.has(path)) {
        // Already seen, increment reason
        const existing = fileMap.get(path)!;
        existing.reason = 'Multiple accesses';
      } else {
        fileMap.set(path, {
          path,
          reason: 'Recently accessed',
          tokenEstimate: this.estimateFileTokens(path)
        });
      }
    }

    // Sort by token estimate (descending)
    return Array.from(fileMap.values())
      .sort((a, b) => (b.tokenEstimate || 0) - (a.tokenEstimate || 0))
      .slice(0, this.maxFilesToShow);
  }

  /**
   * Analyze commands executed
   */
  private analyzeCommands(context: PiCommandContext): WorkingSetCommand[] {
    if (!context.commandOutputs || context.commandOutputs.length === 0) {
      return [];
    }

    return context.commandOutputs
      .map(cmd => {
        const outputSize = this.estimateCommandSize(cmd);
        return {
          command: this.extractCommandName(cmd),
          outputSize
        };
      })
      .sort((a, b) => (b.outputSize || 0) - (a.outputSize || 0))
      .slice(0, this.maxCommandsToShow);
  }

  /**
   * Analyze errors from context
   */
  private analyzeErrors(context: PiCommandContext): WorkingSetError[] {
    const errors: WorkingSetError[] = [];

    // Try to extract errors from recent messages
    if (context.recentMessages) {
      for (const msg of context.recentMessages) {
        const errorMsg = this.extractErrorMessage(msg);
        if (errorMsg) {
          errors.push({
            message: errorMsg,
            timestamp: Date.now()
          });
        }
      }
    }

    return errors;
  }

  /**
   * Find large context consumers
   */
  private findLargeConsumers(
    context: PiCommandContext,
    files: WorkingSetFile[],
    commands: WorkingSetCommand[]
  ): string[] {
    const consumers: string[] = [];

    // Check files
    for (const file of files) {
      if ((file.tokenEstimate || 0) > this.largeConsumerThreshold) {
        consumers.push(`Large file: ${this.shortenPath(file.path)}`);
      }
    }

    // Check commands
    for (const cmd of commands) {
      if ((cmd.outputSize || 0) > this.largeConsumerThreshold) {
        consumers.push(`Large output: ${cmd.command}`);
      }
    }

    // Check tool outputs
    if (context.toolOutputs && Array.isArray(context.toolOutputs)) {
      for (let i = 0; i < context.toolOutputs.length; i++) {
        const output = context.toolOutputs[i];
        const size = this.estimateObjectSize(output);
        if (size > this.largeConsumerThreshold) {
          consumers.push(`Large tool output #${i + 1}`);
        }
      }
    }

    return consumers;
  }

  /**
   * Extract TODO items from context
   */
  private extractTodos(context: PiCommandContext): string[] | undefined {
    // Try to find TODOs in recent messages
    const todos: string[] = [];
    const todoPattern = /(?:TODO|FIXME|XXX):\s*(.+)/gi;

    if (context.recentMessages) {
      for (const msg of context.recentMessages) {
        const msgStr = JSON.stringify(msg);
        let match;
        while ((match = todoPattern.exec(msgStr)) !== null) {
          todos.push(match[1].trim());
        }
      }
    }

    return todos.length > 0 ? todos : undefined;
  }

  /**
   * Helper: Estimate file tokens (without reading file)
   */
  private estimateFileTokens(path: string): number {
    // This is a placeholder - actual implementation would read file
    // or use cached information from Pi API
    const extension = path.split('.').pop() || '';
    
    // Rough estimate based on file type
    const avgSizes: Record<string, number> = {
      'ts': 3000,
      'tsx': 3000,
      'js': 2500,
      'jsx': 2500,
      'py': 2000,
      'md': 1500,
      'json': 1000
    };

    return avgSizes[extension] || 2000;
  }

  /**
   * Helper: Estimate command output size
   */
  private estimateCommandSize(cmd: string): number {
    return cmd.length / 4;
  }

  /**
   * Helper: Extract command name from output
   */
  private extractCommandName(output: string): string {
    // Try to find command name in output
    const firstLine = output.split('\n')[0];
    if (firstLine.length < 50) {
      return firstLine;
    }
    return firstLine.substring(0, 47) + '...';
  }

  /**
   * Helper: Extract error message from object
   */
  private extractErrorMessage(obj: unknown): string | null {
    if (!obj || typeof obj !== 'object') return null;
    
    const objAny = obj as any;
    
    // Check common error patterns
    if (objAny.error) return String(objAny.error);
    if (objAny.message && objAny.message.includes('error')) {
      return objAny.message;
    }
    if (objAny.stderr) return String(objAny.stderr).substring(0, 100);

    return null;
  }

  /**
   * Helper: Estimate object size
   */
  private estimateObjectSize(obj: unknown): number {
    if (!obj) return 0;
    return JSON.stringify(obj).length / 4;
  }

  /**
   * Helper: Shorten path for display
   */
  private shortenPath(path: string): string {
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return path;
    return '.../' + parts.slice(-2).join('/');
  }
}
