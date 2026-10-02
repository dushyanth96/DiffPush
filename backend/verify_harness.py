"""Verify worker harness: dynamic end-to-end + static dispatch coverage for all 369."""
import json, re, ast, base64, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
worker = (ROOT / 'frontend' / 'src' / 'workers' / 'pyodide.worker.js').read_text()
harness = re.search(r'const HARNESS = `(.*?)`;', worker, re.S).group(1)

def run_harness(code, tests):
    b64 = lambda s: base64.b64encode(s.encode('utf-8')).decode()
    src = (harness.replace('__USER_CODE_B64__', b64(code))
           .replace('__TESTS_B64__', b64(json.dumps(tests)))
           .replace('__FN_B64__', b64(json.dumps(None))))
    tmp = ROOT / 'backend' / 'harness_dbg.py'
    tmp.write_text(src + '\nprint("DBG-OUT:" + json.dumps(out))\n', encoding='utf-8')
    r = subprocess.run(['python', str(tmp)], capture_output=True, text=True)
    line = next((ln for ln in (r.stdout or '').splitlines() if ln.startswith('DBG-OUT:')), '')
    tmp.unlink()
    assert r.returncode == 0, (r.stderr or '')[-800:]
    return json.loads(line[len('DBG-OUT:'):])

def norm(s):
    return ''.join(c for c in str(s).lower() if c.isalnum())

LENGTH_NAMES = {'n', 'm', 'len', 'length', 'size', 'sz', 'num'}

def cls_info(tree):
    """(class_node, methods_excl_init, init_required_params) for Solution or sole class."""
    classes = [n for n in tree.body if isinstance(n, ast.ClassDef)]
    sol = next((c for c in classes if c.name == 'Solution'), None)
    cls = sol or (classes[0] if len(classes) == 1 else None)
    if cls is None:
        return None, [], []
    methods = [n.name for n in cls.body if isinstance(n, ast.FunctionDef) and not n.name.startswith('_')]
    init = next((n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == '__init__'), None)
    req = []
    if init is not None:
        args = init.args
        pos = list(args.args[1:]) + list(args.posonlyargs)
        nodefault = len(pos) - len(args.defaults)
        req = [a.arg for a in pos[:nodefault]]
    return cls, methods, req

def module_functions(tree):
    return [n for n in tree.body if isinstance(n, ast.FunctionDef) and not n.name.startswith('_')]

def fn_params(fn):
    return [a.arg for a in fn.args.args]

def bind_ok(params, inputs):
    """Mirror harness bind_args with real values (length-fill needs bound lists)."""
    keys = list(inputs.keys()) if isinstance(inputs, dict) else ['<scalar>']
    if not isinstance(inputs, dict):
        return len(params) <= 1
    rem = dict(inputs)
    bound = {}
    for p in params:
        hit = next((k for k in rem if norm(k) == norm(p)), None)
        if hit is not None:
            bound[p] = rem.pop(hit)
    bound_vals = []
    fills_used = 0
    for p in params:
        if p in bound:
            bound_vals.append(bound[p])
        elif rem:
            k = next(iter(rem))
            bound_vals.append(rem.pop(k))
        elif norm(p) in LENGTH_NAMES:
            lists = sum(isinstance(v, (list, tuple, str)) for v in bound_vals)
            if fills_used < lists:
                fills_used += 1
                bound_vals.append(None)
            else:
                return False
        else:
            return False
    return True

# ---------- dynamic end-to-end ----------
P = ROOT / 'frontend' / 'public' / 'problems'
prob = json.loads((P / '01.Arrays' / '1.Easy' / '01.Largest_element_in_array.json').read_text())
good = 'class Solution:\n    def largestElement(self, arr, n):\n        return max(arr)'
assert [x['passed'] for x in run_harness(good, prob['testCases'])['results']] == [True, True, True]
bad = 'class Solution:\n    def largestElement(self, arr, n):\n        return 0'
assert [x['passed'] for x in run_harness(bad, prob['testCases'])['results']] == [False, False, False]
ms = json.loads((P / '07.Stack_and_Queues' / '1.Learning' / '07.Implement_min_stack.json').read_text())
ms_code = ms['starterCode']['python']  # starter ships a complete implementation
r = run_harness('class MinStack:\n' + '\n'.join(ms_code.split('\n')[1:]), ms['testCases'])
assert [x['passed'] for x in r['results']] == [True, True, True], r
kl = json.loads((P / '09.Heaps' / '3.Hard_Problems' / '03.Kth_largest_element_in_stream.json').read_text())
r = run_harness(kl['starterCode']['python'], kl['testCases'])
assert [x['passed'] for x in r['results']] == [True] * len(kl['testCases']), r
print('dynamic: single-call, ops-replay (min-stack), ctor-repeat (kth-largest) all pass')

def _mparams(cls, method):
    for n in cls.body:
        if isinstance(n, ast.FunctionDef) and n.name == method:
            return [a.arg for a in n.args.args if a.arg != 'self']
    return []

# ---------- static coverage: all 369 ----------
unbound = []
for f in sorted((ROOT / 'curriculum').rglob('*.json')):
    d = json.loads(f.read_text(encoding='utf-8'))
    pid = d.get('id')
    starter = (d.get('starterCode') or {}).get('python')
    tcs = d.get('testCases') or []
    if not starter or not tcs:
        unbound.append((pid, 'no-starter-or-tests'))
        continue
    try:
        tree = ast.parse(starter)
    except SyntaxError:
        unbound.append((pid, 'starter-syntax'))
        continue
    inp = tcs[0].get('input')
    keys = list(inp.keys()) if isinstance(inp, dict) else ['<scalar>']
    opsk = next((k for k in keys if norm(k) in {'operations', 'ops'}), None)
    cls, methods, req = cls_info(tree)
    fns = module_functions(tree)
    if opsk is not None and cls is not None:
        ops = inp[opsk]
        names = {norm(m) for m in methods}
        bad_ops = [op[0] for op in ops if op and norm(op[0]) not in names and len(op) > 1]
        if bad_ops:
            unbound.append((pid, f'ops-unresolved={bad_ops}'))
    elif cls is not None and req:
        if len(methods) != 1:
            unbound.append((pid, f'ctor-repeat-methods={methods}'))
        elif not bind_ok(req, inp):
            unbound.append((pid, f'ctor-bind req={req} keys={keys}'))
        else:
            # one leftover list for repeats?
            rem = list(keys)
            for p in req:
                hit = next((k for k in rem if norm(k) == norm(p)), None)
                rem.remove(hit if hit else rem[0])
            leftovers = [k for k in rem if isinstance(inp[k], list)]
            if len(leftovers) != 1:
                unbound.append((pid, f'ctor-repeat-lists={leftovers}'))
    else:
        # single-call: Solution method, else module-level function, else fail
        params = _mparams(cls, methods[0]) if (cls is not None and methods) else None
        if params is None:
            params = fn_params(fns[0]) if fns else None
        if params is None:
            unbound.append((pid, 'no-callable'))
        elif not bind_ok(params, inp):
            unbound.append((pid, f'single params={params} keys={keys}'))

print(f'static dispatch coverage: {369 - len(unbound)}/369')
for u in unbound:
    print('  UNBOUND:', u)
assert not unbound, f'{len(unbound)} unbound'
print('ALL HARNESS CHECKS PASSED')
