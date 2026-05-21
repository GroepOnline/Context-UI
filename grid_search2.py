"""Grid search over ALL parameters including markdown and diff."""
from autoresearch import load_test_corpus, count_tokens, test_config
import itertools

corpus = load_test_corpus()
items = list(corpus.items())

print('Full grid search...')
print()

best = None

code_ratios = [3.2, 3.4, 3.6, 3.8, 4.0]
json_ratios = [3.4, 3.6, 3.8, 4.0]
md_ratios = [4.0, 4.2, 4.5, 4.8]
log_ratios = [2.2, 2.4, 2.6, 2.8]
diff_ratios = [3.4, 3.6, 3.8, 4.0]
text_ratios = [3.6, 3.8, 4.0, 4.2]

total = len(code_ratios) * len(json_ratios) * len(md_ratios) * len(log_ratios) * len(diff_ratios) * len(text_ratios)
count = 0

for cr, jr, mr, lr, dr, tr in itertools.product(code_ratios, json_ratios, md_ratios, log_ratios, diff_ratios, text_ratios):
    result = test_config(items, cr, jr, mr, lr, dr, tr, use_content_detection=True)
    count += 1
    
    if best is None or result['mape'] < best['mape']:
        best = dict(result)
        best['params'] = {'code': cr, 'json': jr, 'md': mr, 'log': lr, 'diff': dr, 'text': tr}

print(f'Tested {count} configurations')
print(f'Best MAPE: {best["mape"]}%')
params = best['params']
print(f'Params: code={params["code"]}, json={params["json"]}, md={params["md"]}, '
      f'log={params["log"]}, diff={params["diff"]}, text={params["text"]}')
print(f'MAE: {best["mae"]}, Bias: {best["bias"]}')

print()
print('Top 20:')
all_results = []
for cr, jr, mr, lr, dr, tr in itertools.product(code_ratios, json_ratios, md_ratios, log_ratios, diff_ratios, text_ratios):
    result = test_config(items, cr, jr, mr, lr, dr, tr, use_content_detection=True)
    all_results.append((result['mape'], result['mae'], result['bias'], cr, jr, mr, lr, dr, tr))
all_results.sort()
for mape, mae, bias, cr, jr, mr, lr, dr, tr in all_results[:20]:
    print(f'  MAPE={mape:5.2f}% MAE={mae:3.0f} bias={bias:+.0f}  code={cr} json={jr} md={mr} log={lr} diff={dr} text={tr}')
