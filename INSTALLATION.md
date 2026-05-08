# Pi.dev Context Extension - Installation & Usage

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Install in Pi.dev:**
   Copy the `dist/` directory to your Pi.dev extensions folder:
   - Linux/macOS: `~/.pi/extensions/context-extension/`
   - Windows: `%USERPROFILE%\.pi\extensions\context-extension\`

4. **Restart Pi.dev**

## Usage

Once installed, use any of these commands in the Pi terminal:

### `/context` - Full Status View
Shows complete context overview:
- Token usage and remaining capacity
- Risk level assessment
- Active working set (files, commands)
- Actionable recommendation

### `/context compact` - Compact View
Single status box with essential metrics:
- Token usage
- Fill percentage
- Risk level

### `/context tokens` - Token Breakdown
Detailed token analysis:
- Messages token count
- Files token count
- Tool outputs token count
- Command outputs token count
- Diffs, logs, errors token count
- Total with remaining capacity

### `/context files` - Files in Context
Shows files likely in active context:
- File paths with token estimates
- Large context consumers
- Recently accessed files

### `/context summary` - Session Summary
Generates copyable summary for handoff:
- Current task
- Key files
- Recent commands
- Errors encountered
- Outstanding TODOs

## Command Aliases

- `/ctx` - Alias for `/context`
- `/tokens` - Alias for `/context tokens`

## Risk Levels

| Level | Fill % | Action |
|-------|--------|--------|
| LOW | < 50% | Continue normally |
| MEDIUM | 50-75% | Consider trimming logs |
| HIGH | 75-90% | Compact or summarize |
| CRITICAL | > 90% | Start new session |

## Terminal UI Example

```
╭─ Context Status ─────────────────────────────╮
│ Used:        ~42k tokens                     │
│ Remaining:   ~158k tokens                    │
│ Fill:         21%                            │
│ Risk:         LOW                            │
╰──────────────────────────────────────────────╯

╭─ Active Working Set ─────────────────────────╮
│ Task:        Refactor Pi extension           │
│ Files:       7 recently touched              │
│ Commands:    npm test, pnpm build            │
│ Risks:       Large logs in session           │
╰──────────────────────────────────────────────╯

╭─ Recommendation ─────────────────────────────╮
│ Continue normally. No compaction needed yet. │
╰──────────────────────────────────────────────╯
```

## Testing

Run tests locally:
```bash
npm run build
node dist/test/test.js
```

All tests should pass with ✓ markers.

## Known Limitations

1. **Token Estimation:** Uses chars/4 approximation, not actual tokenizer
   - Estimates are clearly marked as "estimated" or "~"
   - Can be upgraded to real tokenizer when available

2. **Session Access:** Limited by Pi.dev API availability
   - Falls back gracefully when API info unavailable
   - Adapter layer designed for easy API integration

3. **File Tracking:** Requires Pi.dev session hooks
   - Currently estimates file token counts
   - Actual tracking needs Pi.dev integration

4. **Real-time Updates:** Manual command invocation
   - No automatic context monitoring
   - User runs `/context` when needed

5. **Terminal Width:** Fixed at 80 characters
   - Adjustable in TerminalRenderer constructor
   - Responsive width requires terminal size detection

## Extending the Extension

### Add New Mode
1. Add mode type to `types.ts`
2. Add render method to `terminalRenderer.ts`
3. Update mode parser in `extension.ts`

### Improve Token Estimation
1. Implement tokenizer in `contextEstimator.ts`
2. Replace `chars/4` with actual token counting
3. Update `TokenType` to mark exact counts

### Integrate Pi.dev API
1. Update `piAdapter.ts` with actual API methods
2. Map Pi session data to `PiCommandContext`
3. Test with real Pi.dev environment

## Architecture

```
src/
├── extension.ts           # Pi.dev entry point
├── piAdapter.ts           # Pi API abstraction layer
├── contextEstimator.ts    # Token estimation logic
├── workingSetAnalyzer.ts  # Context analysis
├── terminalRenderer.ts    # Terminal UI rendering
├── types.ts               # Type definitions
└── test/
    └── test.ts            # Test suite
```

## Support

- GitHub Issues: Report bugs and feature requests
- Pi.dev Docs: Check extension API documentation
- Adapter Pattern: Easy to adapt to Pi.dev API changes
