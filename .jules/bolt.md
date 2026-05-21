## 2024-05-18 - Fast ANSI parsing in JS
**Learning:** Hardcoding lengths for ANSI codes skips is fragile, as 24-bit codes exceed standard 15-char limits.
**Action:** Use a larger window (e.g., 50 chars) when seeking for 'm' to terminate ansi-escape sequence skips.
