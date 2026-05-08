# Autoresearch: Token Estimation Accuracy

## Objective
Improve the token estimation accuracy in `contextEstimator.ts` by minimizing the mean absolute percentage error (MAPE) between our estimate and the ground-truth token count from OpenAI's `tiktoken` library (cl100k_base encoding, used by GPT-4).

## Metrics
- **Primary**: `mape` (percentage points, lower is better) — Mean Absolute Percentage Error between estimate and true tiktoken count
- **Secondary**: `bias` (percentage, negative=underestimate, positive=overestimate) — Systematic bias direction
- **Secondary**: `mae` (tokens, lower is better) — Mean Absolute Error in tokens

## How to Run
`bash autoresearch.sh` — outputs `METRIC name=value` lines with MAPE, bias, and MAE.

## Test Corpus
The benchmark uses a fixed test corpus of diverse texts:
- TypeScript source files (from src/ directory)
- JSON data (package.json, etc.)
- Markdown documentation
- Simulated command outputs
- Simulated logs
- Simulated diffs
- Mixed natural language text
- Large files (>10KB each)

Total: ~100KB of test data spanning all categories the estimator handles.

## Files in Scope
- `src/contextEstimator.ts` — The estimation logic. All modifications go here.
- `src/types.ts` — Only if new configuration parameters are needed.

## Off Limits
- `src/extension.ts` — Extension entry point, not part of estimation
- `src/terminalRenderer.ts` — UI rendering, unrelated
- `src/workingSetAnalyzer.ts` — Working set logic, unrelated
- `src/piAdapter.ts` — API adapter, unrelated
- `src/test/test.ts` — Unit tests (will be updated to match changes)
- `autoresearch.md`, `autoresearch.sh`, `autoresearch.jsonl` — Meta files

## Constraints
- TypeScript must compile (`npm run build` must succeed)
- The `estimateFromText()` API signature must remain backward compatible
- Must not add any runtime dependencies
- Must not degrade performance (each estimate should take <1ms)
- Estimation must remain deterministic (same input = same output)

## Termination
Run until interrupted by the user. No fixed experiment limit.

## Current Best
- Baseline: 18.19% MAPE using chars/4 approximation
- Current best: **5.14% MAPE** with character-density refinement (72% improvement)
- MAE: 41.0 tokens (down from 145.0)
- Bias: -18.9 tokens (near zero)

## What's Been Tried

### Experiment #1 (Baseline) - `cf77692`
- Simple chars/4 approximation with code=1.2x weight
- **MAPE: 18.19%** | MAE: 145 | Bias: -51.4
- **Key insight**: Different content types have vastly different token densities

### Experiment #2 (Content-type aware) - `1699c8c`
- Content-type specific chars-per-token ratios (code=3.2, json=3.1, md=4.5, log=2.6, etc.)
- **MAPE: 12.59%** | MAE: 101 | Bias: +46.2
- **Improvement: 31% vs baseline**
- Grid search over 500+ configs found optimal: code=3.6, json=3.8, log=2.4

### Experiment #3 (Full grid search) - (keep)
- Full 6-parameter grid search (5120 configs): code, json, md, log, diff, text ratios
- **Best found: MAPE 9.18%** with code=4.0, json=3.8, md=4.2, log=2.2, diff=3.4, text=3.6
- **Improvement: 50% vs baseline**

### Experiment #4 (Char density refinement) - (keep)
- Added character-distribution analysis: symbol ratio, letter ratio, whitespace ratio
- Dynamic density adjustment per text chunk
- **MAPE: 6.88%** | MAE: 55 | Bias: -34.1
- **Improvement: 62% vs baseline**

### Experiment #5 (Optimal density + ratios) - `a609be3` (CURRENT BEST)
- Grid search over density coefficients + ratios
- **Best: symbol_coeff=0.9, letter_coeff=-0.2, ws_coeff=-0.15**
- **Final ratios: code=4.0, json=3.6, md=4.2, log=2.0, diff=3.4, text=3.6**
- **MAPE: 5.14%** | MAE: 41 | Bias: -18.9
- **Improvement: 72% vs baseline**
- Best individual file errors: diff=0.3%, array-json=0.5%, logs=0.7%, typescript=1.8%
- Worst: command-output=13.6%, natural-language=14.1%, json=11.8%

## Key Learnings
1. Chars/4 is a very crude approximation (18% error even on diverse corpus)
2. Content-type ratios alone give 31% improvement (18.19% -> 12.59%)
3. Grid searching over all 6 ratios gives 50% (18.19% -> 9.18%)
4. Character-density refinement is the biggest win: 62% (18.19% -> 6.88%)
5. Final tuned density coefficients: symbol=0.9, letter=-0.2, whitespace=-0.15
6. Log output needs the most aggressive ratio (2.0 chars/token)
7. Code (4.0) and JSON (3.6) are less dense than expected due to whitespace/formatting
8. Markdown (4.2) and natural language (3.6) have efficient tokenization
9. Remaining errors are systematic: command output is consistently underestimated (~14%)

## Remaining Challenges
- Command output detection is unreliable; file extension-based detection misses many cases
- Natural language heuristic falls back to 'unknown' ratio (3.6) which isn't always optimal
- Character-density refinement adds computational cost (~O(n) scan of text)
- Per-file errors still up to 14% on some content types
