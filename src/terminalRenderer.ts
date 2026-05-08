/**
 * Terminal Renderer - Renders context status in terminal UI
 * Professional box-drawing with ANSI colors, progress bar, and risk indicators.
 */

import {
  ContextReport,
  ContextStatus,
  WorkingSet,
  Recommendation,
  RiskLevel,
  ContextMode
} from './types';

// ANSI escape codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

function riskColor(risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    LOW: GREEN,
    MEDIUM: YELLOW,
    HIGH: MAGENTA,
    CRITICAL: RED,
  };
  return map[risk];
}

export class TerminalRenderer {
  private readonly terminalWidth: number;
  private readonly boxWidth: number;

  constructor(terminalWidth?: number) {
    // Auto-detect terminal width, fallback to 80
    this.terminalWidth = terminalWidth ?? process.stdout?.columns ?? 80;
    this.boxWidth = Math.max(40, Math.min(this.terminalWidth, 100));
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

  // ================================================================
  //  STATUS BOX — with progress bar + colored risk badge
  // ================================================================

  private renderStatusBox(status: ContextStatus): string {
    const lines: string[] = [];
    const fill = Math.round(status.fillPercentage);
    const bar = this.makeProgressBar(fill);

    lines.push(this.makeHeader('Context Status'));
    lines.push(this.makeLine(` Used    ${this.formatk(status.used)} / ${this.formatk(status.total)} tokens`));
    lines.push(this.makeLine(` Free    ${this.formatk(status.remaining)} tokens (${100 - fill}% remaining)`));
    lines.push(this.makeLine(` ${bar}`));
    lines.push(this.makeLine(` ${BOLD}Risk${RESET}    ${riskColor(status.risk)}${BOLD}${status.risk}${RESET}${GRAY}  —  ${this.riskLabel(status.risk)}${RESET}`));
    lines.push(this.makeLine(` Mode    ${this.formatTokens(status.breakdown.total)} ${GRAY}(${status.breakdown.total.type})${RESET}`));
    lines.push(this.makeFooter());

    return lines.join('\n');
  }

  // ================================================================
  //  WORKING SET BOX
  // ================================================================

  private renderWorkingSetBox(workingSet: WorkingSet): string {
    const lines: string[] = [];

    lines.push(this.makeHeader('Active Working Set'));

    if (workingSet.task) {
      lines.push(this.makeLine(` Task    ${workingSet.task}`));
    }

    lines.push(this.makeLine(` Files   ${workingSet.files.length} recently touched`));

    if (workingSet.commands.length > 0) {
      const cmdStr = workingSet.commands.slice(0, 3).map(c => c.command).join(', ');
      lines.push(this.makeLine(` Cmds    ${cmdStr}`));
    }

    if (workingSet.errors.length > 0) {
      const errStr = workingSet.errors.slice(0, 2).map(e => e.message).join('; ');
      lines.push(this.makeLine(` ${RED}Errors${RESET}  ${errStr}`));
    }

    if (workingSet.largeConsumers.length > 0) {
      lines.push(this.makeLine(` ${YELLOW}Risks${RESET}   ${workingSet.largeConsumers.slice(0, 2).join('; ')}`));
    }

    lines.push(this.makeFooter());
    return lines.join('\n');
  }

  // ================================================================
  //  RECOMMENDATION BOX
  // ================================================================

  private renderRecommendationBox(rec: Recommendation): string {
    const icon = this.actionIcon(rec.action);
    const lines: string[] = [];

    lines.push(this.makeHeader('Recommendation'));
    lines.push(this.makeLine(` ${icon}  ${rec.message}`));
    lines.push(this.makeFooter());
    return lines.join('\n');
  }

  // ================================================================
  //  MODE: compact
  // ================================================================

  private renderCompact(status: ContextStatus): string {
    return this.renderStatusBox(status);
  }

  // ================================================================
  //  MODE: tokens  (breakdown + largest consumers)
  // ================================================================

  private renderTokens(status: ContextStatus): string {
    const lines: string[] = [];
    const b = status.breakdown;

    lines.push(this.makeHeader('Token Breakdown'));

    const rows: Array<{ label: string; est: typeof b.messages }> = [
      { label: 'Messages', est: b.messages },
      { label: 'Files', est: b.files },
      { label: 'Tool Outputs', est: b.toolOutputs },
      { label: 'Commands', est: b.commandOutputs },
      { label: 'Diffs', est: b.diffs },
      { label: 'Logs', est: b.logs },
      { label: 'Errors', est: b.errors },
    ];

    // Sort by count descending for visual weight
    rows.sort((a, b) => b.est.count - a.est.count);

    for (const r of rows) {
      const pct = status.total > 0 ? ((r.est.count / status.total) * 100).toFixed(1) : '0.0';
      const bar = this.miniBar(r.est.count, status.total);
      lines.push(this.makeLine(
        ` ${r.label.padEnd(12)} ${this.formatk(r.est.count)} ${GRAY}(${pct}%)${RESET} ${bar}`
      ));
    }

    lines.push(this.makeSep());
    lines.push(this.makeLine(
      ` ${BOLD}Total${RESET}      ${this.formatk(status.used)} / ${this.formatk(status.total)}  ${GRAY}(${Math.round(status.fillPercentage)}%)${RESET}`
    ));
    lines.push(this.makeLine(
      ` ${BOLD}Remaining${RESET}  ${this.formatk(status.remaining)}`
    ));
    lines.push(this.makeFooter());
    return lines.join('\n');
  }

  // ================================================================
  //  MODE: files
  // ================================================================

  private renderFiles(workingSet: WorkingSet): string {
    const lines: string[] = [];

    lines.push(this.makeHeader('Files in Context'));

    if (workingSet.files.length === 0) {
      lines.push(this.makeLine(' (no files detected in context)'));
    } else {
      for (const file of workingSet.files) {
        const tok = file.tokenEstimate
          ? ` ${GRAY}~${Math.round(file.tokenEstimate / 1000)}k${RESET}`
          : '';
        lines.push(this.makeLine(` ${file.path}${tok}`));
      }
    }

    if (workingSet.largeConsumers.length > 0) {
      lines.push(this.makeSep());
      lines.push(this.makeLine(` ${YELLOW}Large consumers:${RESET}`));
      for (const c of workingSet.largeConsumers) {
        lines.push(this.makeLine(`   ${c}`));
      }
    }

    lines.push(this.makeFooter());
    return lines.join('\n');
  }

  // ================================================================
  //  MODE: summary  (copyable handoff text)
  // ================================================================

  private renderSummary(report: ContextReport): string {
    const lines: string[] = [];
    const ws = report.workingSet;
    const st = report.status;

    lines.push(this.makeHeader('Session Summary'));

    if (ws.task) {
      lines.push(this.makeLine(` ${BOLD}Task${RESET}     ${ws.task}`));
      lines.push(this.makeSep());
    }

    lines.push(this.makeLine(` Used     ${this.formatTokens(st.breakdown.total)}`));
    lines.push(this.makeLine(` Fill     ${Math.round(st.fillPercentage)}%  ${this.riskBadge(st.risk)}`));

    if (ws.files.length > 0) {
      lines.push(this.makeSep());
      lines.push(this.makeLine(` ${BOLD}Key files${RESET}`));
      for (const f of ws.files.slice(0, 6)) {
        lines.push(this.makeLine(`   ${f.path}`));
      }
    }

    if (ws.commands.length > 0) {
      lines.push(this.makeSep());
      lines.push(this.makeLine(` ${BOLD}Recent commands${RESET}`));
      for (const c of ws.commands.slice(0, 4)) {
        lines.push(this.makeLine(`   ${c.command}`));
      }
    }

    if (ws.errors.length > 0) {
      lines.push(this.makeSep());
      lines.push(this.makeLine(` ${RED}Errors${RESET}`));
      for (const e of ws.errors.slice(0, 3)) {
        lines.push(this.makeLine(`   ${e.message}`));
      }
    }

    if (ws.todos && ws.todos.length > 0) {
      lines.push(this.makeSep());
      lines.push(this.makeLine(` ${CYAN}TODOs${RESET}`));
      for (const t of ws.todos) {
        lines.push(this.makeLine(`   ${t}`));
      }
    }

    lines.push(this.makeFooter());
    lines.push('');
    lines.push(`${DIM}Copy this summary to continue in a new session.${RESET}`);

    return lines.join('\n');
  }

  // ================================================================
  //  DEFAULT:  Status + Working Set + Recommendation
  // ================================================================

  private renderDefault(report: ContextReport): string {
    const parts = [
      this.renderStatusBox(report.status),
      '',
      this.renderWorkingSetBox(report.workingSet),
      '',
      this.renderRecommendationBox(report.recommendation),
    ];
    return parts.join('\n');
  }

  // ================================================================
  //  BOX-DRAWING HELPERS
  // ================================================================

  private makeHeader(title: string): string {
    const inner = this.boxWidth - 2;
    const mid = ` ${title} `.padEnd(inner, '─');
    return `╭${mid}╮`;
  }

  private makeFooter(): string {
    return `╰${'─'.repeat(this.boxWidth - 2)}╯`;
  }

  private makeSep(): string {
    return `│${'─'.repeat(this.boxWidth - 2)}│`;
  }

  private makeLine(body: string): string {
    const inner = ` ${body}`.padEnd(this.boxWidth - 2);
    return `│${inner}│`;
  }

  // ================================================================
  //  VISUAL HELPERS
  // ================================================================

  /**
   * ████████░░░░░░  visual progress bar (compact)
   */
  private makeProgressBar(pct: number, width: number = 14): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const segFilled = '█'.repeat(filled);
    const segEmpty = '░'.repeat(empty);

    let color: string;
    if (pct < 50) color = GREEN;
    else if (pct < 75) color = YELLOW;
    else if (pct < 90) color = MAGENTA;
    else color = RED;

    return `${GRAY}[${RESET}${color}${segFilled}${GRAY}${segEmpty}${RESET}${GRAY}]${RESET} ${color}${BOLD}${pct}%${RESET}`;
  }

  /**
   * Mini in-line bar for breakdown view (e.g. ████░░)
   */
  private miniBar(value: number, max: number): string {
    if (max <= 0) return '';
    const w = 6;
    const fill = Math.round((value / max) * w);
    const bar = '█'.repeat(fill) + '░'.repeat(Math.max(0, w - fill));
    return `${GRAY}${bar}${RESET}`;
  }

  /**
   * Colored risk badge text
   */
  private riskBadge(risk: RiskLevel): string {
    return `${riskColor(risk)}${BOLD}${risk}${RESET}`;
  }

  /**
   * Human-readable label for risk level
   */
  private riskLabel(risk: RiskLevel): string {
    const map: Record<RiskLevel, string> = {
      LOW: 'Plenty of space',
      MEDIUM: 'Approaching limit',
      HIGH: 'Context pressure',
      CRITICAL: 'Near overflow',
    };
    return map[risk];
  }

  /**
   * Icon per recommendation action
   */
  private actionIcon(action: string): string {
    const map: Record<string, string> = {
      continue: '✓',
      compact: '↻',
      'trim-logs': '✂',
      summarize: '📋',
      'new-session': '⛔',
    };
    return map[action] ?? '·';
  }

  // ================================================================
  //  FORMATTING HELPERS
  // ================================================================

  private formatk(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
  }

  private formatTokens(est: { count: number; type: string }): string {
    const prefix = est.type === 'estimated' ? '~' : '';
    return `${prefix}${this.formatk(est.count)} tokens`;
  }
}
