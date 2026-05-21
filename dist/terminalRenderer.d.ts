/**
 * Terminal Renderer - Renders context status in terminal UI
 * Professional box-drawing with ANSI colors, progress bar, and risk indicators.
 */
import { ContextReport } from './types';
export declare class TerminalRenderer {
    private readonly terminalWidth;
    private readonly boxWidth;
    constructor(terminalWidth?: number);
    /**
     * Render full context report
     */
    render(report: ContextReport): string;
    private renderStatusBox;
    private renderWorkingSetBox;
    private renderRecommendationBox;
    private renderCompact;
    private renderTokens;
    private renderFiles;
    private renderSummary;
    private renderFun;
    private renderDefault;
    private makeHeader;
    private makeFooter;
    private makeSep;
    private makeLine;
    /**
     * ████████░░░░░░  visual progress bar (compact)
     */
    private makeProgressBar;
    /**
     * Mini in-line bar for breakdown view (e.g. ████░░)
     */
    private miniBar;
    /**
     * Colored risk badge text
     */
    private riskBadge;
    /**
     * Human-readable label for risk level
     */
    private riskLabel;
    /**
     * Icon per recommendation action
     */
    private actionIcon;
    private formatk;
    private formatTokens;
    private stripAnsi;
    private visibleLength;
    private truncateVisible;
}
