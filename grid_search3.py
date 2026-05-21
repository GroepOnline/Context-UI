"""Grid search over density formula parameters."""
from autoresearch import load_test_corpus, count_tokens, test_config
from autoresearch import analyze_char_density
import itertools

corpus = load_test_corpus()
items = list(corpus.items())

print('Grid search over density formula + ratios...')
print()

# First, try different density formula coefficients
density_coeffs = [
    # (symbol_ratio_coeff, letter_ratio_coeff, whitespace_coeff)
    (0.8, -0.2, -0.1),  # original
    (0.7, -0.15, -0.1),
    (0.9, -0.25, -0.15),
    (0.6, -0.1, -0.05),
    (1.0, -0.3, -0.2),
    (0.8, -0.25, -0.15),
    (0.75, -0.2, -0.1),
    (0.85, -0.3, -0.1),
    (0.9, -0.2, -0.15),
    (0.65, -0.15, -0.05),
]

def analyze_char_density_custom(text, sym_coeff, letter_coeff, ws_coeff):
    """Customizable density function."""
    if not text or len(text) < 10:
        return 1.0
    letters = sum(1 for c in text if c.isalpha())
    whitespace = sum(1 for c in text if c in ' \t\n\r')
    digits = sum(1 for c in text if c.isdigit())
    symbols = len(text) - letters - whitespace - digits
    total = len(text)
    density = 1.0
    density += (symbols / total) * sym_coeff
    density -= (letters / total) * abs(letter_coeff)
    density -= (whitespace / total) * abs(ws_coeff)
    return max(0.7, min(1.5, density))

best_overall = None

for sym_c, let_c, ws_c in density_coeffs:
    for cr in [3.6, 3.8, 4.0, 4.2]:
        for jr in [3.6, 3.8, 4.0]:
            for lr in [2.0, 2.2, 2.4, 2.6]:
                # Override analyze_char_density temporarily
                import autoresearch as ar
                original_func = ar.analyze_char_density
                ar.analyze_char_density = lambda t, sc=sym_c, lc=let_c, wc=ws_c: analyze_char_density_custom(t, sc, lc, wc)
                
                result = test_config(items, cr, jr, 4.2, lr, 3.4, 3.6, 
                                     use_content_detection=True, use_char_density=True)
                
                ar.analyze_char_density = original_func
                
                if best_overall is None or result['mape'] < best_overall[0]:
                    best_overall = (result['mape'], result['mae'], result['bias'], 
                                    sym_c, let_c, ws_c, cr, jr, lr)

print(f'Best: MAPE={best_overall[0]}% MAE={best_overall[1]} bias={best_overall[2]}')
print(f'Density: symbol_coeff={best_overall[3]}, letter_coeff={best_overall[4]}, ws_coeff={best_overall[5]}')
print(f'Ratios: code={best_overall[6]}, json={best_overall[7]}, log={best_overall[8]}')
print()

# Test the best config
ar.analyze_char_density = lambda t, sc=best_overall[3], lc=best_overall[4], wc=best_overall[5]: analyze_char_density_custom(t, sc, lc, wc)
result = test_config(items, best_overall[6], best_overall[7], 4.2, best_overall[8], 3.4, 3.6,
                     use_content_detection=True, use_char_density=True)
print('Per-file breakdown:')
for fname, true_c, est, err, ratio, adj_ratio in sorted(result['file_results'], key=lambda x: -x[3]):
    pct = (err / true_c * 100) if true_c > 0 else 0
    print(f'  {fname:30s} true={true_c:6d} est={est:6d} err={err:5d} ({pct:+.1f}%) ratio={ratio} adj={adj_ratio:.2f}')
