#!/usr/bin/env python3
"""Char-density refined estimator — 1:1 mirror of src/contextEstimator.ts"""
import json, os, re, subprocess, sys
try:
    import tiktoken
    ENC = tiktoken.get_encoding("cl100k_base")
except ImportError:
    print("ERROR: tiktoken not installed"); sys.exit(1)

# 1. TypeScript syntax check
try:
    r = subprocess.run(["node","node_modules/typescript/bin/tsc","--noEmit"], capture_output=True, text=True, timeout=30)
    if r.returncode: print("[CHECK] TS FAILED"); print(r.stdout[:300]); sys.exit(1)
    print("[CHECK] TypeScript syntax OK")
except Exception as e:
    print(f"[CHECK] tsc error: {e}"); sys.exit(1)

# ── Same ratios as contextEstimator.ts ──
RATIOS={'code':4.0,'json':3.8,'markdown':4.2,'text':3.6,'logOutput':2.2,'diff':3.4,'commandOutput':3.8,'error':3.9,'messages':4.0,'unknown':3.6}
CE=frozenset({'.ts','.tsx','.js','.jsx','.py','.java','.cpp','.c','.go','.rs','.rb','.php','.cs','.swift','.kt','.mjs','.cjs'})
SC=frozenset({'git','npm','npx','pnpm','yarn','node','tsc','ls','cd','echo','cat','grep','find','cp','mv','rm','mkdir','pip','docker','curl','ssh','make','ps','top','sudo','apt'})

def tp(fn):
    e=os.path.splitext(fn)[1].lower()
    if e in CE: return 'code'
    if e=='.json': return 'json'
    if e in ('.md','.mdx','.markdown'): return 'markdown'
    if e in ('.log','.txt'): return 'logOutput'
    if e in ('.diff','.patch'): return 'diff'
    return 'unknown'

def dc(t):
    if not t or len(t)<20: return 'unknown'
    ls=[l.strip() for l in t.split('\n') if l.strip()]
    if not ls: return 'unknown'
    f=ls[0]
    if re.match(r'^\[\d{4}[-\/]\d{2}[-\/]\d{2}[T ]\d{2}:\d{2}',f): return 'logOutput'
    if f.startswith('diff --git ') or f.startswith('--- ') or f.startswith('+++ '): return 'diff'
    if f.startswith('{') or f.startswith('['): return 'json'
    if re.match(r'^#{1,6}\s',f): return 'markdown'
    if re.match(r'^Error\b|error|FAIL',f[:30],re.I): return 'error'
    sm=ls[:min(20,len(ls))]; cmd=tbl=path=0
    for l in sm:
        w=l.split(); fw=w[0].lower() if w else ''
        if fw in SC: cmd+=2
        if len(w)>=3 and '  ' in l: tbl+=1
        if re.match(r'^[.]?[/\\][\w\-.\\/]+[/\\]',l) or re.match(r'^[a-zA-Z]:[/\\]',l): path+=2
        if re.match(r'^[a-zA-Z_]\w*\s*[:=]\s',l): cmd+=1
        if re.match(r'^\d+[.:)\]]',l): tbl+=1
    n=len(sm); cs=(cmd+path)/n if n else 0; ts=tbl/n if n else 0
    if cs>=0.5 or ts>=0.6 or cs>=0.3 or ts>=0.4: return 'commandOutput'
    return 'unknown'

def ad(t):
    if not t or len(t)<10: return 1.0
    tl=len(t); le=sum(1 for c in t if c.isalpha())
    ws=sum(1 for c in t if c in ' \t\n\r'); di=sum(1 for c in t if c.isdigit())
    sy=tl-le-ws-di; d=1.0+(sy/tl)*0.9-(le/tl)*0.2-(ws/tl)*0.15
    return max(0.7,min(1.5,d))

def est(tx,ct):
    r=RATIOS.get(ct,RATIOS['unknown']); den=ad(tx)
    return round(len(tx)/(r/den)) if tx else 0

# ── Load corpus ──
d=os.path.join(os.path.dirname(__file__),"test-corpus")
if not os.path.isdir(d): d=os.path.join(os.getcwd(),"test-corpus")
corpus={f:open(os.path.join(d,f),encoding="utf-8",errors="replace").read() for f in os.listdir(d) if os.path.isfile(os.path.join(d,f))}

# ── Benchmark ──
ta=tc=0; sg=[]; rs=[]
for fn,tx in corpus.items():
    tn=len(ENC.encode(tx)); ct=tp(fn)
    if ct=='unknown': ct=dc(tx)
    es=est(tx,ct); er=abs(es-tn); ta+=er; tc+=tn; sg.append(es-tn)
    rs.append((fn,ct,tn,es,er))
n=len(corpus); mape=round(ta/tc*100,2); mae=round(ta/n); bias=round(sum(sg)/n,1)
print(f"METRIC mape={mape}")
print(f"METRIC mae={mae}")
print(f"METRIC bias={bias}")
print(f"METRIC n={n}")
if '--verbose' in sys.argv:
    print(f"\n{'='*65}")
    for fn,ct,tc,es,er in sorted(rs,key=lambda x:-x[4]):
        pct=round(er/tc*100,1) if tc else 0; bar='#'*min(20,round(er/tc*50))
        print(f"  {fn:30s} {ct:14s} true={tc:6d} est={es:6d} err={er:5d} ({pct:+.1f}%) {bar}")
    print(f"{'='*65}")
