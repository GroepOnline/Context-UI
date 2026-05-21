"""Grid search for optimal chars-per-token ratios."""
from autoresearch import load_test_corpus, count_tokens, test_config
import itertools

corpus = load_test_corpus()
items = list(corpus.items())

print('Grid search for optimal ratios...')
print()

best = None

code_ratios = [2.8, 3.0, 3.2, 3.4, 3.6]
json_ratios = [3.0, 3.2, 3.4, 3.6, 3.8]
log_ratios = [2.4, 2.6, 2.8, 3.0]
text_ratios = [3.8, 4.0, 4.2, 4.4, 4.6]

total = len(code_ratios) * len(json_ratios) * len(log_ratios) * len(text_ratios)
count = 0

for cr, jr, lr, tr in itertools.product(code_ratios, json_ratios, log_ratios, text_ratios):
    result = test_config(items, cr, jr, 4.5, lr, 3.8, tr, use_content_detection=True)
    count += 1
    
    if best is None or result['mape'] < best['mape']:
        best = dict(result)
        best['params'] = {'code': cr, 'json': jr, 'log': lr, 'text': tr}

print(f'Tested {count} configurations')
print(f'Best MAPE: {best["mape"]}%')
print(f'Params: code={best["params"]["code"]}, json={best["params"]["json"]}, '
      f'log={best["params"]["log"]}, text={best["params"]["text"]}')
print(f'MAE: {best["mae"]}, Bias: {best["bias"]}')
print()
print('Top 10 configurations:')
all_results = []
for cr, jr, lr, tr in itertools.product(code_ratios, json_ratios, log_ratios, text_ratios):
    result = test_config(items, cr, jr, 4.5, lr, 3.8, tr, use_content_detection=True)
    all_results.append((result['mape'], cr, jr, lr, tr))
all_results.sort()
for mape, cr, jr, lr, tr in all_results[:10]:
    print(f'  MAPE={mape:5.2f}%  code={cr} json={jr} log={lr} text={tr}')
