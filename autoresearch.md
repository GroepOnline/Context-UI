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
- Baseline: ~50% MAPE using chars/4 approximation
- Target: <10% MAPE

## What's Been Tried
*(To be updated as experiments accumulate)*

### Baseline (Experiment #1)
- Simple chars/4 approximation
- Code files weighted 1.2x
- MAPE: ~50% (varies significantly by content type)
- Bias: underestimates dense code, overestimates whitespace-heavy text
- **Key insight**: chars/4 is a very rough approximation. Different content types (code, JSON, markdown, logs) compress differently in token space.
