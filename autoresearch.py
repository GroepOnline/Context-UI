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


# Content-type => chars_per_token mapping (matches TypeScript ContextEstimator)
CONTENT_TYPE_RATIOS = {
    ".ts": 3.2, ".tsx": 3.2, ".js": 3.2, ".jsx": 3.2,
    ".py": 3.2, ".java": 3.2, ".cpp": 3.2, ".c": 3.2,
    ".go": 3.2, ".rs": 3.2, ".rb": 3.2, ".php": 3.2,
    ".cs": 3.2, ".swift": 3.2, ".kt": 3.2, ".mjs": 3.2, ".cjs": 3.2,
    ".json": 3.1,
    ".md": 4.5, ".mdx": 4.5, ".markdown": 4.5,
    ".txt": 4.2,
    ".log": 2.6,
    ".diff": 3.8, ".patch": 3.8,
}

# Fallback content detection by file content heuristics
def detect_content_type(text: str) -> float:
    """Detect content type from text and return the appropriate chars_per_token ratio."""
    if not text:
        return 4.0
    
    first_line = text.split('\n')[0].strip()
    
    if not first_line:
        return 4.0
    
    # Log format: timestamps
    if first_line.startswith("[") and len(first_line) > 15:
        return 2.6
    
    # Diffs
    if first_line.startswith("diff --git"):
        return 3.8
    
    # JSON
    if first_line.startswith("{") or first_line.startswith("["):
        return 3.1
    
    # Markdown headers
    if first_line.startswith("#"):
        return 4.5
    
    # Error output
    if "error" in first_line.lower()[:60]:
        return 3.9
    
    # Command output with structured formatting
    if first_line.startswith("$") or first_line.startswith(">"):
        return 3.8
    
    return 4.0


def analyze_char_density(text: str) -> float:
    """
    Analyze character distribution to compute density multiplier.
    Matches the TypeScript ContextEstimator.analyzeCharacterDensity.
    
    High symbol density => more tokens (brackets, operators).
    High letter density => fewer tokens (common words are efficient).
    """
    if not text or len(text) < 10:
        return 1.0
    
    letters = sum(1 for c in text if c.isalpha())
    whitespace = sum(1 for c in text if c in ' \t\n\r')
    digits = sum(1 for c in text if c.isdigit())
    symbols = len(text) - letters - whitespace - digits
    
    total = len(text)
    symbol_ratio = symbols / total
    letter_ratio = letters / total
    whitespace_ratio = whitespace / total
    
    # Baseline 1.0, adjusted by character distribution
    # Optimal coefficients from grid search: symbol=0.9, letter=-0.2, whitespace=-0.15
    density = 1.0
    density += symbol_ratio * 0.9
    density -= letter_ratio * 0.2
    density -= whitespace_ratio * 0.15
    
    return max(0.7, min(1.5, density))


def test_config(corpus_items: list[tuple[str, str]], 
                code_ratio: float = 4.0,
                json_ratio: float = 3.8,
                md_ratio: float = 4.2,
                log_ratio: float = 2.2,
                diff_ratio: float = 3.4,
                text_ratio: float = 3.6,
                use_content_detection: bool = True,
                use_char_density: bool = False) -> dict:
    """
    Test a content-type-aware estimator configuration against ground truth.
    When use_char_density=True, also applies character-distribution adjustment.
    
    Parameters:
        code_ratio: chars-per-token for code files (.ts, .js, .py, etc.)
        json_ratio: chars-per-token for JSON files
        md_ratio: chars-per-token for markdown files
        log_ratio: chars-per-token for log/output files
        diff_ratio: chars-per-token for diff/patch files
        text_ratio: chars-per-token for plain text / unknown files
        use_content_detection: if True, use file content heuristics as fallback
        use_char_density: if True, apply character-density refinement
    """
    # Build ratio lookup from parameters
    ratio_overrides = {}
    for ext in [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".cpp", ".c",
                ".go", ".rs", ".rb", ".php", ".cs", ".swift", ".kt", ".mjs", ".cjs"]:
        ratio_overrides[ext] = code_ratio
    ratio_overrides[".json"] = json_ratio
    for ext in [".md", ".mdx", ".markdown"]:
        ratio_overrides[ext] = md_ratio
    for ext in [".log"]:
        ratio_overrides[ext] = log_ratio
    for ext in [".diff", ".patch"]:
        ratio_overrides[ext] = diff_ratio
    
    total_abs_error = 0
    total_true = 0
    raw_errors = []
    file_results = []
    
    for fname, text in corpus_items:
        true_count = count_tokens(text)
        _, ext = os.path.splitext(fname)
        ext = ext.lower()
        
        # Use extension-based ratio first, then content heuristic
        if ext in ratio_overrides:
            ratio = ratio_overrides[ext]
        elif use_content_detection:
            ratio = detect_content_type(text)
        else:
            ratio = text_ratio
        
        # Apply character-density refinement
        if use_char_density:
            density = analyze_char_density(text)
            adjusted_ratio = ratio / density
        else:
            adjusted_ratio = ratio
        
        estimate = round(len(text) / adjusted_ratio)
        abs_error = abs(estimate - true_count)
        
        total_abs_error += abs_error
        total_true += true_count
        raw_errors.append(estimate - true_count)
        file_results.append((fname, true_count, estimate, abs_error, ratio, adjusted_ratio))
    
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
        # Args: test [code_ratio] [json_ratio] [md_ratio] [log_ratio] [diff_ratio] [text_ratio] [use_content_detection] [use_char_density]
        cr = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
        jr = float(sys.argv[3]) if len(sys.argv) > 3 else 3.8
        mr = float(sys.argv[4]) if len(sys.argv) > 4 else 4.2
        lr = float(sys.argv[5]) if len(sys.argv) > 5 else 2.2
        dr = float(sys.argv[6]) if len(sys.argv) > 6 else 3.4
        tr = float(sys.argv[7]) if len(sys.argv) > 7 else 3.6
        ucd = (sys.argv[8].lower() == "true") if len(sys.argv) > 8 else True
        ucdensity = (sys.argv[9].lower() == "true") if len(sys.argv) > 9 else False
        
        result = test_config(corpus_items, cr, jr, mr, lr, dr, tr, use_content_detection=ucd, use_char_density=ucdensity)
        print(f"METRIC mape={result['mape']}")
        print(f"METRIC mae={result['mae']}")
        print(f"METRIC bias={result['bias']}")
        print(f"METRIC n={result['n']}")
    else:
        # Default: show full breakdown
        result = test_config(corpus_items)
        print(f"MAPE: {result['mape']}%")
        print(f"MAE:  {result['mae']} tokens")
        print(f"Bias: {result['bias']} tokens (negative=underestimate)")
        print(f"Files: {result['n']}")
        print()
        print("--- Per-file breakdown ---")
        for fname, true_c, est, err, ratio in sorted(result["file_results"], key=lambda x: -x[3]):
            pct = (err / true_c * 100) if true_c > 0 else 0
            print(f"  {fname:30s} true={true_c:6d} est={est:6d} err={err:5d} ({pct:+.1f}%) ratio={ratio}")
