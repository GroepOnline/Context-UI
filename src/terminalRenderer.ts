/**
 * Terminal Renderer - Renders context status in terminal UI
 */

import {
  ContextReport,
  ContextStatus,
  WorkingSet,
  Recommendation,
  RiskLevel,
  ContextMode
} from './types';

export class TerminalRenderer {
  private readonly terminalWidth: number;
  private readonly boxWidth: number;

  constructor(terminalWidth: number = 80) {
    this.terminalWidth = terminalWidth;
    this.boxWidth = Math.min(terminalWidth, 80);
  }

  /**
   * Render full context report
   */
  render(report: ContextReport): string {
    switch (report.mode) {
      case 'compact':
        return this.renderCompact(report.status);
      case 'tokens':
        return this.renderTokens(report.status);
      case 'files':
        return this.renderFiles(report.workingSet);
      case 'summary':
        return this.renderSummary(report);
      default:
        return this.renderDefault(report);
    }
  }

  /**
   * Render default view with all sections
   */
  private renderDefault(report: ContextReport): string {
    const sections = [
      this.renderStatusBox(report.status),
      '',
      this.renderWorkingSetBox(report.workingSet),
      '',
      this.renderRecommendationBox(report.recommendation)
    ];

    return sections.join('\n');
  }

  /**
   * Render compact view - only status box
   */
  private renderCompact(status: ContextStatus): string {
    return this.renderStatusBox(status);
  }

  /**
   * Render tokens view - detailed breakdown
   */
  private renderTokens(status: ContextStatus): string {
    const lines: string[] = [];
    
    lines.push(this.createBoxHeader('Token Breakdown'));
    
    const b = status.breakdown;
    lines.push(this.createKeyValue('Messages', this.formatTokens(b.messages)));
    lines.push(this.createKeyValue('Files', this.formatTokens(b.files)));
    lines.push(this.createKeyValue('Tool Outputs', this.formatTokens(b.toolOutputs)));
    lines.push(this.createKeyValue('Commands', this.formatTokens(b.commandOutputs)));
    lines.push(this.createKeyValue('Diffs', this.formatTokens(b.diffs)));
    lines.push(this.createKeyValue('Logs', this.formatTokens(b.logs)));
    lines.push(this.createKeyValue('Errors', this.formatTokens(b.errors)));
    
    lines.push(this.createSeparator());
    lines.push(this.createKeyValue('Total Used', this.formatTokens(b.total)));
    lines.push(this.createKeyValue('Remaining', `~${Math.round(status.remaining / 1000)}k tokens`));
    
    lines.push(this.createBoxFooter());

    return lines.map(l => this.padLine(l)).join('\n');
  }

  /**
   * Render files view
   */
  private renderFiles(workingSet: WorkingSet): string {
    const lines: string[] = [];
    
    lines.push(this.createBoxHeader('Files in Context'));

    if (workingSet.files.length === 0) {
      lines.push(this.createLine('No files detected in context'));
    } else {
      for (const file of workingSet.files) {
        const tokenStr = file.tokenEstimate 
          ? ` (~${Math.round(file.tokenEstimate / 1000)}k tokens)` 
          : '';
        lines.push(this.createLine(`${file.path}${tokenStr}`));
      }
    }

    if (workingSet.largeConsumers.length > 0) {
      lines.push(this.createSeparator());
      lines.push(this.createLine('Large Consumers:', true));
      for (const consumer of workingSet.largeConsumers) {
        lines.push(this.createLine(`  • ${consumer}`));
      }
    }

    lines.push(this.createBoxFooter());

    return lines.map(l => this.padLine(l)).join('\n');
  }

  /**
   * Render session summary for handoff
   */
  private renderSummary(report: ContextReport): string {
    const lines: string[] = [];
    
    lines.push(this.createBoxHeader('Session Summary'));
    
    if (report.workingSet.task) {
      lines.push(this.createLine(`Task: ${report.workingSet.task}`));
      lines.push(this.createSeparator());
    }

    // Context stats
    lines.push(this.createLine(`Context Used: ${this.formatTokens(report.status.breakdown.total)}`));
    lines.push(this.createLine(`Risk Level: ${report.status.risk}`));
    lines.push(this.createSeparator());

    // Files
    if (report.workingSet.files.length > 0) {
      lines.push(this.createLine('Key Files:', true));
      for (const file of report.workingSet.files.slice(0, 5)) {
        lines.push(this.createLine(`  • ${file.path}`));
      }
    }

    // Recent commands
    if (report.workingSet.commands.length > 0) {
      lines.push(this.createSeparator());
      lines.push(this.createLine('Recent Commands:', true));
      for (const cmd of report.workingSet.commands.slice(0, 3)) {
        lines.push(this.createLine(`  • ${cmd.command}`));
      }
    }

    // Errors
    if (report.workingSet.errors.length > 0) {
      lines.push(this.createSeparator());
      lines.push(this.createLine('Errors Encountered:', true));
      for (const err of report.workingSet.errors.slice(0, 3)) {
        lines.push(this.createLine(`  • ${err.message}`));
      }
    }

    // TODOs
    if (report.workingSet.todos && report.workingSet.todos.length > 0) {
      lines.push(this.createSeparator());
      lines.push(this.createLine('Outstanding TODOs:', true));
      for (const todo of report.workingSet.todos) {
        lines.push(this.createLine(`  • ${todo}`));
      }
    }

    lines.push(this.createBoxFooter());
    lines.push('');
    lines.push('Copy this summary to continue in a new session.');

    return lines.map(l => this.padLine(l)).join('\n');
  }

  /**
   * Render status box
   */
  private renderStatusBox(status: ContextStatus): string {
    const lines: string[] = [];
    
    lines.push(this.createBoxHeader('Context Status'));
    lines.push(this.createKeyValue('Used', this.formatTokens(status.breakdown.total)));
    lines.push(this.createKeyValue('Remaining', `~${Math.round(status.remaining / 1000)}k tokens`));
    lines.push(this.createKeyValue('Fill', `${Math.round(status.fillPercentage)}%`));
    lines.push(this.createKeyValue('Risk', status.risk, this.getRiskColor(status.risk)));
    lines.push(this.createBoxFooter());

    return lines.map(l => this.padLine(l)).join('\n');
  }

  /**
   * Render working set box
   */
  private renderWorkingSetBox(workingSet: WorkingSet): string {
    const lines: string[] = [];
    
    lines.push(this.createBoxHeader('Active Working Set'));
    
    if (workingSet.task) {
      lines.push(this.createKeyValue('Task', workingSet.task));
    }
    
    lines.push(this.createKeyValue('Files', `${workingSet.files.length} recently touched`));
    
    if (workingSet.commands.length > 0) {
      const cmdList = workingSet.commands
        .slice(0, 2)
        .map(c => c.command)
        .join(', ');
      lines.push(this.createKeyValue('Commands', cmdList));
    }

    if (workingSet.largeConsumers.length > 0) {
      lines.push(this.createKeyValue('Risks', workingSet.largeConsumers[0]));
    }

    lines.push(this.createBoxFooter());

    return lines.map(l => this.padLine(l)).join('\n');
  }

  /**
   * Render recommendation box
   */
  private renderRecommendationBox(recommendation: Recommendation): string {
    const lines: string[] = [];
    
    lines.push(this.createBoxHeader('Recommendation'));
    lines.push(this.createLine(recommendation.message));
    lines.push(this.createBoxFooter());

    return lines.map(l => this.padLine(l)).join('\n');
  }

  // ============ Helper Methods ============

  private createBoxHeader(title: string): string {
    const padding = this.boxWidth - title.length - 4;
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return `╭─${'─'.repeat(leftPad)}${title}${'─'.repeat(rightPad)}─╮`;
  }

  private createBoxFooter(): string {
    return `╰${'─'.repeat(this.boxWidth - 2)}╯`;
  }

  private createSeparator(): string {
    return `│${'─'.repeat(this.boxWidth - 2)}│`;
  }

  private createLine(text: string, bold: boolean = false): string {
    const padded = ` ${text}`.padEnd(this.boxWidth - 2);
    return `│${padded}│`;
  }

  private createKeyValue(key: string, value: string, valueColor?: string): string {
    const colon = ':';
    const space = ' ';
    const maxKeyLen = 13;
    const paddedKey = key.padEnd(maxKeyLen);
    
    const availableSpace = this.boxWidth - 2 - maxKeyLen - colon.length - space.length;
    let displayValue = value;
    
    if (value.length > availableSpace) {
      displayValue = value.substring(0, availableSpace - 3) + '...';
    }
    
    return `│ ${paddedKey}${colon}${space}${displayValue.padEnd(availableSpace)}│`;
  }

  private padLine(line: string): string {
    if (line.length < this.boxWidth) {
      return line + ' '.repeat(this.boxWidth - line.length);
    }
    return line;
  }

  private formatTokens(estimate: { count: number; type: string }): string {
    const k = estimate.count / 1000;
    const rounded = Math.round(k * 10) / 10;
    const typeStr = estimate.type === 'estimated' ? '~' : '';
    return `${typeStr}${rounded}k tokens`;
  }

  private getRiskColor(risk: RiskLevel): string {
    // ANSI color codes (can be stripped for terminals without color support)
    const colors: Record<RiskLevel, string> = {
      'LOW': '\x1b[32m',      // Green
      'MEDIUM': '\x1b[33m',   // Yellow
      'HIGH': '\x1b[35m',     // Magenta
      'CRITICAL': '\x1b[31m'  // Red
    };
    return colors[risk];
  }
}
