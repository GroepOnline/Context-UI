#!/usr/bin/env python3
"""
Ground-truth token counting + benchmark tool for autoresearch.
Uses tiktoken (cl100k_base) to get exact token counts.
"""
import json
import os
import re
import sys

try:
    import tiktoken
except ImportError:
    print("ERROR: tiktoken not installed. Run: pip install tiktoken")
    sys.exit(1)

ENCODING = "cl100k_base"
test_corpus_dir = os.path.join(os.path.dirname(__file__), "test-corpus")


def count_tokens(text: str) -> int:
    """Count tokens using tiktoken cl100k_base (GPT-4 encoding)."""
    enc = tiktoken.get_encoding(ENCODING)
    return len(enc.encode(text))


def load_test_corpus() -> dict[str, str]:
    """Load all files from test-corpus directory."""
    corpus = {}
    corpus_dir = test_corpus_dir
    if not os.path.isdir(corpus_dir):
        # Try relative to CWD
        corpus_dir = os.path.join(os.getcwd(), "test-corpus")
    if not os.path.isdir(corpus_dir):
        print(f"ERROR: test-corpus directory not found at {test_corpus_dir} or {corpus_dir}")
        sys.exit(1)
    
    for fname in os.listdir(corpus_dir):
        fpath = os.path.join(corpus_dir, fname)
        if os.path.isfile(fpath):
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                corpus[fname] = f.read()
    return corpus


def chars4_estimate(text: str, is_code: bool = False, code_weight: float = 1.2) -> int:
    """Current chars/4 estimation method."""
    estimate = len(text) / 4
    if is_code:
        estimate *= code_weight
    return round(estimate)


def is_code_file(fname: str) -> bool:
    code_exts = {'.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c',
                 '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt'}
    _, ext = os.path.splitext(fname)
    return ext.lower() in code_exts


def compute_metrics(corpus: dict[str, str], code_weight: float = 1.2, 
                    chars_per_token: float = 4.0) -> dict:
    """
    Compute accuracy metrics comparing chars/4 estimate to ground truth.
    
    Now uses configurable chars_per_token instead of hardcoded 4.0.
    """
    total_errors = 0
    total_true = 0
    abs_errors = []
    errors = []
    
    for fname, text in corpus:
        true_count = count_tokens(text)
        is_code = is_code_file(fname)
        
        estimate = len(text) / chars_per_token
        if is_code:
            estimate *= code_weight
        
        estimate = round(estimate)
        error = estimate - true_count
        abs_error = abs(error)
        
        abs_errors.append(abs_error)
        errors.append(error)
        total_errors += abs_error
        total_true += true_count
    
    n = len(corpus)
    mape = (total_errors / total_true * 100) if total_true > 0 else 0
    mae = total_errors / n if n > 0 else 0
    bias = sum(errors) / n if n > 0 else 0
    
    return {
        "mape": round(mape, 2),
        "mae": round(mae, 0),
        "bias": round(bias, 1),
        "n": n,
        "total_true": total_true,
        "total_estimated": sum(
            round(len(text) / chars_per_token) * (1.2 if is_code_file(fname) else 1.0)
            for fname, text in corpus
        )
    }


def test_config(corpus_items: list[tuple[str, str]], 
                chars_per_token: float = 4.0,
                code_weight: float = 1.2,
                min_chars: int = 0,
                use_char_binning: bool = False,
                code_bonus: float = 0) -> dict:
    """
    Test a given estimator configuration against ground truth.
    
    Parameters:
        chars_per_token: base chars per token ratio (e.g., 4.0, 3.5)
        code_weight: multiplicative weight for code files (e.g., 1.2, 1.5)
        min_chars: minimum chars for any content type (floor)
        use_char_binning: if True, use separate ratios for different char types
        code_bonus: flat token bonus for code files (additive, not multiplicative)
    """
    total_abs_error = 0
    total_true = 0
    abs_errors = []
    raw_errors = []
    file_results = []
    
    for fname, text in corpus_items:
        true_count = count_tokens(text)
        is_code = is_code_file(fname)
        
        if use_char_binning:
            # Simple binning: separate ratio for code vs non-code
            if is_code:
                base_ratio = chars_per_token * 0.85  # code is denser
            else:
                base_ratio = chars_per_token
        else:
            base_ratio = chars_per_token
        
        estimate = max(len(text) / base_ratio, min_chars)
        if is_code and code_weight != 1.0:
            estimate *= code_weight
        if is_code and code_bonus > 0:
            estimate += code_bonus
        
        estimate = round(estimate)
        abs_error = abs(estimate - true_count)
        
        total_abs_error += abs_error
        total_true += true_count
        abs_errors.append(abs_error)
        raw_errors.append(estimate - true_count)
        file_results.append((fname, true_count, estimate, abs_error))
    
    n = len(corpus_items)
    mape = (total_abs_error / total_true * 100) if total_true > 0 else 0
    mae = total_abs_error / n if n > 0 else 0
    bias = sum(raw_errors) / n if n > 0 else 0
    
    return {
        "mape": round(mape, 2),
        "mae": round(mae, 0),
        "bias": round(bias, 1),
        "n": n,
        "total_true": total_true,
        "file_results": file_results
    }


if __name__ == "__main__":
    corpus = load_test_corpus()
    corpus_items = list(corpus.items())
    
    print(f"Test corpus: {len(corpus_items)} files, "
          f"{sum(len(t) for t in corpus.values())} chars total")
    print()
    
    # Parse config from command line args
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        cpt = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
        cw = float(sys.argv[3]) if len(sys.argv) > 3 else 1.2
        binning = sys.argv[4].lower() == "true" if len(sys.argv) > 4 else False
        bonus = float(sys.argv[5]) if len(sys.argv) > 5 else 0
        
        result = test_config(corpus_items, cpt, cw, use_char_binning=binning, code_bonus=bonus)
        print(f"METRIC mape={result['mape']}")
        print(f"METRIC mae={result['mae']}")
        print(f"METRIC bias={result['bias']}")
        print(f"METRIC n={result['n']}")
    else:
        # Default: show baseline
        result = test_config(corpus_items)
        print(f"MAPE: {result['mape']}%")
        print(f"MAE:  {result['mae']} tokens")
        print(f"Bias: {result['bias']} tokens (negative=underestimate)")
        print(f"Files: {result['n']}")
        print()
        print("--- Per-file breakdown ---")
        for fname, true_c, est, err in sorted(result["file_results"], key=lambda x: -x[3]):
            pct = (err / true_c * 100) if true_c > 0 else 0
            print(f"  {fname:30s} true={true_c:6d} est={est:6d} err={err:5d} ({pct:+.1f}%)")
