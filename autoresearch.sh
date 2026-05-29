#!/usr/bin/env python3
"""
Benchmark runner: outputs METRIC name=value lines.
Works on Windows (Python) and Unix.
"""
import subprocess
import sys

def run_cmd(cmd, timeout=60):
    """Run a command and return stdout, stderr, returncode."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, shell=True)
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "TIMEOUT", -1
    except Exception as e:
        return "", str(e), -1

# 1. TypeScript syntax check
stdout, stderr, rc = run_cmd("node node_modules/typescript/bin/tsc --noEmit", timeout=30)
if rc != 0:
    print("[CHECK] TypeScript syntax FAILED")
    print(stdout[:500])
    print(stderr[:500])
    sys.exit(1)
print("[CHECK] TypeScript syntax OK")

# 2. Token accuracy benchmark (with optimized params + char density)
stdout, stderr, rc = run_cmd("python3 autoresearch.py test 4.0 3.6 4.2 2.0 3.4 3.6 true true", timeout=60)
if rc != 0:
    print("[ERROR] Benchmark failed")
    print(stdout[:500])
    print(stderr[:500])
    sys.exit(1)

# Print METRIC lines
for line in stdout.split("\n"):
    if line.startswith("METRIC "):
        print(line)
