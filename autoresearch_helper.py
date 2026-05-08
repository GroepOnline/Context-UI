#!/usr/bin/env python3
"""
Helper script for autoresearch loop - init, log, evaluate, status, summary.
Minimal dependencies: json + standard library only.
"""
import json
import math
import os
import sys
import time
from statistics import median, stdev


def load_jsonl(path: str) -> list[dict]:
    """Load all entries from a JSONL file."""
    entries = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
    return entries


def save_jsonl(path: str, entries: list[dict]):
    """Save entries to a JSONL file (append mode, but rewrites entire file)."""
    with open(path, "w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def get_best(entries: list[dict], direction: str) -> float:
    """Get the best metric value from keep entries."""
    keeps = [e for e in entries if e.get("status") == "keep" and "metric" in e]
    if not keeps:
        return float("inf") if direction == "lower" else float("-inf")
    values = [e["metric"] for e in keeps]
    return min(values) if direction == "lower" else max(values)


def compute_confidence(entries: list[dict], current: float, direction: str) -> float:
    """Compute confidence score using MAD from baseline."""
    keeps = [e for e in entries if e.get("status") == "keep" and "metric" in e]
    if len(keeps) < 2:
        return 0.0
    values = [e["metric"] for e in keeps]
    med = median(values)
    abs_devs = [abs(v - med) for v in values]
    mad = median(abs_devs) if abs_devs else 0
    if mad == 0:
        return 0.0
    
    delta = abs(current - med)
    if direction == "lower":
        # positive delta means regression
        return delta / mad if current < med else -delta / mad
    else:
        return delta / mad if current > med else -delta / mad


def cmd_init(args: list[str]):
    """Initialize a new experiment log."""
    path = None
    name = None
    metric_name = None
    direction = "lower"
    
    i = 0
    while i < len(args):
        if args[i] == "--jsonl" and i + 1 < len(args):
            path = args[i + 1]
            i += 2
        elif args[i] == "--name" and i + 1 < len(args):
            name = args[i + 1]
            i += 2
        elif args[i] == "--metric-name" and i + 1 < len(args):
            metric_name = args[i + 1]
            i += 2
        elif args[i] == "--direction" and i + 1 < len(args):
            direction = args[i + 1]
            i += 2
        else:
            i += 1
    
    if not all([path, name, metric_name]):
        print("Usage: init --jsonl <path> --name <name> --metric-name <name> --direction <lower|higher>")
        sys.exit(1)
    
    config = {
        "type": "config",
        "name": name,
        "metricName": metric_name,
        "metricUnit": "percentage",
        "bestDirection": direction,
        "created": int(time.time() * 1000)
    }
    
    entries = [config]
    save_jsonl(path, entries)
    print(f"Initialized {path} with config: {name} / {metric_name} ({direction} is better)")


def cmd_log(args: list[str]):
    """Log an experiment result to JSONL."""
    path = None
    commit = None
    metric = None
    status = None
    description = ""
    asi = {}
    metrics = {}
    direction = "lower"
    
    i = 0
    while i < len(args):
        if args[i] == "--jsonl" and i + 1 < len(args):
            path = args[i + 1]; i += 2
        elif args[i] == "--commit" and i + 1 < len(args):
            commit = args[i + 1]; i += 2
        elif args[i] == "--metric" and i + 1 < len(args):
            metric = float(args[i + 1]); i += 2
        elif args[i] == "--status" and i + 1 < len(args):
            status = args[i + 1]; i += 2
        elif args[i] == "--description" and i + 1 < len(args):
            description = args[i + 1]; i += 2
        elif args[i] == "--asi" and i + 1 < len(args):
            asi = json.loads(args[i + 1]); i += 2
        elif args[i] == "--metrics" and i + 1 < len(args):
            metrics = json.loads(args[i + 1]); i += 2
        elif args[i] == "--direction" and i + 1 < len(args):
            direction = args[i + 1]; i += 2
        else:
            i += 1
    
    if not all([path, metric is not None, status]):
        print("Usage: log --jsonl <path> --metric <value> --status <keep|discard|crash|checks_failed> [--commit <hash>] [--description <text>] [--asi <json>] [--metrics <json>] [--direction <lower|higher>]")
        sys.exit(1)
    
    entries = load_jsonl(path)
    
    # Count existing experiment runs
    run_count = sum(1 for e in entries if e.get("type") != "config")
    run_num = run_count + 1
    
    # Compute confidence
    best = get_best(entries, direction)
    baseline_metric = None
    baseline_entries = [e for e in entries if e.get("type") != "config" and e.get("description") == "baseline"]
    if baseline_entries:
        baseline_metric = baseline_entries[0].get("metric")
    
    delta_str = ""
    if baseline_metric is not None:
        delta = metric - baseline_metric
        delta_pct = (delta / baseline_metric * 100) if baseline_metric != 0 else 0
        if direction == "lower":
            delta_str = f" ({delta_pct:+.2f}% vs baseline, {'improved' if delta < 0 else 'regressed'})"
        else:
            delta_str = f" ({delta_pct:+.2f}% vs baseline, {'improved' if delta > 0 else 'regressed'})"
    
    entry = {
        "run": run_num,
        "commit": commit or "0000000",
        "metric": metric,
        "metrics": metrics,
        "status": status,
        "description": description,
        "timestamp": int(time.time() * 1000),
        "segment": 0,
        "asi": asi
    }
    
    entries.append(entry)
    save_jsonl(path, entries)
    
    # Also compute confidence for display
    confidence = compute_confidence(entries, metric, direction) if status == "keep" else 0
    
    print(f"Exp #{run_num}: {status} | metric={metric}{delta_str}")
    if confidence:
        print(f"  Confidence: {confidence:.2f}x noise floor")
    print(f"  Description: {description}")


def cmd_evaluate(args: list[str]):
    """Evaluate a metric value against best so far."""
    path = None
    metric = None
    direction = "lower"
    
    i = 0
    while i < len(args):
        if args[i] == "--jsonl" and i + 1 < len(args):
            path = args[i + 1]; i += 2
        elif args[i] == "--metric" and i + 1 < len(args):
            metric = float(args[i + 1]); i += 2
        elif args[i] == "--direction" and i + 1 < len(args):
            direction = args[i + 1]; i += 2
        else:
            i += 1
    
    if not all([path, metric is not None]):
        print("Usage: evaluate --jsonl <path> --metric <value> --direction <lower|higher>")
        sys.exit(1)
    
    entries = load_jsonl(path)
    best = get_best(entries, direction)
    baseline = None
    for e in entries:
        if e.get("description") == "baseline" and "metric" in e:
            baseline = e["metric"]
            break
    
    if best == float("inf") or best == float("-inf"):
        print("KEEP (first result)")
        return
    
    delta = ((metric - best) / best * 100) if best != 0 else 0
    baseline_delta = ((metric - baseline) / baseline * 100) if baseline and baseline != 0 else 0
    
    if direction == "lower":
        is_improvement = metric < best * 0.999  # 0.1% threshold to ignore noise
        threshold = "improved" if is_improvement else ("equal/worse" if metric == best else "worse")
    else:
        is_improvement = metric > best * 1.001
        threshold = "improved" if is_improvement else ("equal/worse" if metric == best else "worse")
    
    confidence = compute_confidence(entries, metric, direction)
    
    print(f"Verdict: {'KEEP' if is_improvement else 'DISCARD'} ({threshold})")
    print(f"  Current:  {metric}")
    print(f"  Best:     {best}")
    print(f"  Delta:    {delta:+.2f}% vs best")
    if baseline_delta:
        print(f"  vs baseline: {baseline_delta:+.2f}%")
    print(f"  Conf:     {confidence:.2f}x noise floor" if confidence else "  Conf:     N/A (< 2 keeps)")


def cmd_status(args: list[str]):
    """Print current status summary."""
    path = None
    for i, a in enumerate(args):
        if a == "--jsonl" and i + 1 < len(args):
            path = args[i + 1]
    
    if not path:
        print("Usage: status --jsonl <path>")
        sys.exit(1)
    
    entries = load_jsonl(path)
    config = next((e for e in entries if e.get("type") == "config"), {})
    keeps = [e for e in entries if e.get("status") == "keep"]
    discards = [e for e in entries if e.get("status") in ("discard", "crash", "checks_failed")]
    total_exp = sum(1 for e in entries if e.get("type") != "config")
    
    print(f"Experiment: {config.get('name', 'unknown')}")
    print(f"Metric:     {config.get('metricName', '?')} ({config.get('bestDirection', 'lower')} is better)")
    print(f"Total runs: {total_exp}")
    print(f"Kept:       {len(keeps)}")
    print(f"Discarded:  {len(discards)}")
    if keeps:
        best_val = get_best(keeps, config.get('bestDirection', 'lower'))
        best_run = min((e for e in keeps if "metric" in e), key=lambda x: abs(x["metric"] - best_val))
        print(f"Best:       {best_val} (run #{best_run.get('run', '?')})")
    else:
        print("Best:       No keeps yet")


def cmd_summary(args: list[str]):
    """Print detailed summary of all experiments."""
    path = None
    for i, a in enumerate(args):
        if a == "--jsonl" and i + 1 < len(args):
            path = args[i + 1]
    
    if not path:
        print("Usage: summary --jsonl <path>")
        sys.exit(1)
    
    entries = load_jsonl(path)
    config = next((e for e in entries if e.get("type") == "config"), {})
    direction = config.get("bestDirection", "lower")
    
    print(f"\n{'='*60}")
    print(f"  Autoresearch Summary: {config.get('name', 'unknown')}")
    print(f"{'='*60}")
    print(f"  Metric: {config.get('metricName', '?')} ({direction} is better)")
    print(f"  Total:  {sum(1 for e in entries if e.get('type') != 'config')} experiments")
    print(f"{'='*60}")
    print()
    
    for entry in entries:
        if entry.get("type") == "config":
            continue
        run = entry.get("run", "?")
        status = entry.get("status", "?")
        metric = entry.get("metric", "?")
        desc = entry.get("description", "")
        asi = entry.get("asi", {})
        hypo = asi.get("hypothesis", "")
        print(f"  #{run:3d} | {status:14s} | metric={metric:>8s} | {desc}")
        if hypo:
            print(f"       | hypothesis: {hypo}")
    
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: autoresearch_helper.py <init|log|evaluate|status|summary> [args...]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    args = sys.argv[2:]
    
    commands = {
        "init": cmd_init,
        "log": cmd_log,
        "evaluate": cmd_evaluate,
        "status": cmd_status,
        "summary": cmd_summary,
    }
    
    if cmd in commands:
        commands[cmd](args)
    else:
        print(f"Unknown command: {cmd}")
        print("Available: init, log, evaluate, status, summary")
        sys.exit(1)
