# Ideas Backlog

## Next Experiments

### High Priority
- [ ] **Exp7: Substring token counting** - Instead of char density, count actual subword patterns (common prefixes, suffixes, word boundaries) for better estimation
- [ ] **Exp8: Content sampling** - Only analyze first N chars of very large files to save time, with size-based extrapolation
- [ ] **Exp9: JSON structure analysis** - Detect array-heavy vs object-heavy JSON and adjust ratio accordingly (arrays are more token-efficient than deeply nested objects)

### Medium Priority
- [ ] **Exp10: Cache density results** - Cache character-density analysis per file (hash-based) to avoid repeated O(n) scans
- [ ] **Exp11: Multi-line mode detection** - For command output, detect if output is tabular vs free text and adjust ratio
- [ ] **Exp12: Whitespace ratio tuning** - Grid search over a wider range of whitespace coefficients (-0.1 to -0.3)

### Low Priority
- [ ] **Exp13: Bundle size reduction** - Check if `contextEstimator.ts` can be optimized for smaller compiled size
- [ ] **Exp14: Test speed optimization** - Reduce test execution time
- [ ] **Exp15: Dynamic ratio adjustment** - Learn from past estimation errors: if a file type was consistently off by X%, adjust its ratio dynamically
