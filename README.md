# Pi.dev Context Extension

A Pi.dev extension that provides Claude Code-like `/context` command for monitoring token usage and context status.

## Installation

1. Copy this extension to your Pi.dev extensions directory
2. Run `npm install`
3. Run `npm run build`
4. Restart Pi.dev

## Commands

- `/context` - Full context status view
- `/context compact` - Compact status box only
- `/context tokens` - Token breakdown and major consumers
- `/context files` - Files likely in context
- `/context summary` - Session summary for handoff

## Architecture

- `extension.ts` - Pi.dev entry point and command registration
- `piAdapter.ts` - Pi API abstraction layer (adapt to actual Pi.dev API)
- `contextEstimator.ts` - Token estimation logic
- `workingSetAnalyzer.ts` - Working set detection
- `terminalRenderer.ts` - Terminal UI rendering
- `types.ts` - Type definitions

## Limitations

- Token counts are estimates (chars/4 approximation)
- Actual context access depends on Pi.dev API support
- File tracking requires Pi.dev session hooks
