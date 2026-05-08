# Context Estimator - Technical Details

## Token Estimation Algorithm

The context estimator uses a **chars/4 approximation** for token counting:

### Basic Formula
```typescript
tokens = characters / 4
```

This approximation works because:
- Average English text: ~4 characters per token
- Code typically: ~3-4 characters per token
- Logs and output: varies widely

### Code Weighting
Code files receive a **1.2x weight multiplier**:
```typescript
if (isCode) {
  tokens *= 1.2;
}
```

This accounts for:
- Higher symbol density in code
- More special characters (brackets, operators)
- Shorter variable names that still count as tokens

### Estimation Types

| Type | Description | Accuracy |
|------|-------------|----------|
| `exact` | Directly from API/tokenizer | Highest |
| `api-derived` | Calculated from Pi.dev session data | High |
| `estimated` | Calculated via approximation | Moderate |

All estimates are clearly labeled in the output with `~` prefix.

## Context Breakdown Categories

### 1. Messages
User and assistant messages in the session history.
- Estimated from JSON serialization
- Includes role, content, and metadata

### 2. Files
Files read by the assistant during the session.
- Uses code weighting for `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, etc.
- Tracks file paths for working set display

### 3. Tool Outputs
Results from tool executions (Execute, Read, etc.).
- Can be large (file contents, command outputs)
- Identified as large consumers if > 5k tokens

### 4. Command Outputs
Terminal command results.
- Detected by presence in session
- Flagged if output exceeds 5k tokens

### 5. Diffs
Code changes and patches.
- Code-weighted (1.2x)
- Often large if many files changed

### 6. Logs
Console logs and debug output.
- Standard estimation (no weighting)
- Identified as risk if verbose

### 7. Errors
Error messages and stack traces.
- Standard estimation
- Extracted for working set display

## Risk Level Calculation

```typescript
if (fillPercentage < 50) return 'LOW';
if (fillPercentage < 75) return 'MEDIUM';
if (fillPercentage < 90) return 'HIGH';
return 'CRITICAL';
```

### Risk Levels and Actions

| Level | Fill % | Symptoms | Recommended Action |
|-------|--------|----------|-------------------|
| **LOW** | 0-49% | Plenty of context available | Continue normally |
| **MEDIUM** | 50-74% | Approaching limits | Trim large logs/outputs |
| **HIGH** | 75-89% | Context pressure | Compact or summarize |
| **CRITICAL** | 90%+ | Near overflow | Start new session with handoff |

## Working Set Analysis

The working set analyzer identifies:

### 1. Active Files
- Files recently accessed
- Deduplicated by path
- Sorted by token consumption
- Shows top 10 by default

### 2. Recent Commands
- Commands executed in session
- Sorted by output size
- Shows top 5 by default

### 3. Errors
- Extracted from recent messages
- Pattern matching: `error`, `stderr`, exceptions
- Shows last 3 errors

### 4. Large Consumers
- Files > 5k tokens
- Command outputs > 5k tokens
- Tool outputs > 5k tokens

### 5. TODOs (Optional)
- Pattern: `TODO:`, `FIXME:`, `XXX:`
- Extracted from session messages
- Helps track work in progress

## Known Limitations

### 1. Token Estimation Accuracy
**Issue:** Using chars/4 approximation instead of actual tokenizer.

**Impact:** 
- Estimates may be off by ±20%
- Code estimation may undercount (symbols split into multiple tokens)
- Unicode/multibyte characters may overcount

**Mitigation:**
- Estimates clearly marked with `~` prefix
- Type system tracks estimation method
- Modular design allows tokenizer replacement

**Future:** Replace with `tiktoken` or similar when available in Pi.dev environment.

### 2. Session Data Access
**Issue:** Pi.dev API for session context not yet known.

**Impact:**
- Cannot access actual session history
- Cannot get exact message counts
- Cannot read file content directly

**Mitigation:**
- Adapter layer isolates Pi-specific logic
- Graceful fallback to empty data
- Mock API for development/testing

**Future:** Implement `RealPiAPI` methods when Pi.dev provides documentation.

### 3. File Content Tracking
**Issue:** No access to actual file contents read during session.

**Impact:**
- File token counts are rough estimates
- Cannot show exact file sizes
- Large file detection limited

**Mitigation:**
- Placeholder estimates based on file type
- Large consumer threshold (5k tokens)
- Warns users about uncertainty

**Future:** Integrate with Pi.dev file tracking hooks if available.

### 4. Real-time Monitoring
**Issue:** No background context monitoring.

**Impact:**
- User must manually invoke `/context`
- No proactive warnings
- No automatic context management

**Mitigation:**
- Clear command interface
- Fast execution (< 100ms)
- All modes accessible via CLI

**Future:** Could add background context watcher if Pi.dev supports extensions running continuously.

### 5. Terminal Width Detection
**Issue:** Fixed 80-character width assumption.

**Impact:**
- Boxes may wrap on narrow terminals
- Wide terminals have extra padding
- No responsive adjustment

**Mitigation:**
- Clean box rendering at 80 chars
- Content truncation prevents overflow
- Configurable width in constructor

**Future:** Detect terminal width via `process.stdout.columns` if available in Pi.dev.

### 6. No State Persistence
**Issue:** Each command execution is stateless.

**Impact:**
- Cannot track context over time
- No trend analysis
- No session history

**Mitigation:**
- Timestamp included in report
- User can run multiple times
- Summary mode for handoff

**Future:** Could persist state to disk for trend analysis across commands.

## Performance Characteristics

- **Estimation Time:** < 10ms for typical sessions
- **Rendering Time:** < 5ms for all modes
- **Memory Usage:** Minimal (no large buffers)
- **Async Operations:** None (pure functions)

## Extension Size

- **Compiled JS:** ~15KB
- **Dependencies:** None (only TypeScript dev dependency)
- **Runtime Overhead:** Negligible

## Browser/Terminal Compatibility

Tested in:
- Node.js 18+
- Standard terminals (VT100 compatible)
- Windows PowerShell (box characters supported)

Fallback:
- Can strip ANSI codes for non-color terminals
- Box characters work in most modern terminals
- Content remains readable even if formatting breaks
