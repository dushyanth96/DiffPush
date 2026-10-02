/* DiffPush Pyodide WASM runner — classic Web Worker (no ESM imports: importScripts only).
 * Bundled by Vite via `new Worker(new URL('./pyodide.worker.js', import.meta.url))`.
 * Contract in:  { type:'run', id, code, testCases, functionName }
 * Contract out: { type:'result', id, status, results, totalTimeMs, error }
 * status: 'passed' | 'failed' | 'error'
 */
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';

let pyodidePromise = null;

// UTF-8-safe base64 (btoa only handles Latin-1).
function toB64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

function ensurePyodide() {
  if (!pyodidePromise) {
    pyodidePromise = new Promise((resolve, reject) => {
      try {
        importScripts(PYODIDE_URL);
        self.loadPyodide().then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }
  return pyodidePromise;
}

// Python harness: execs user code, discovers the entrypoint (Solution method or
// module-level function), then runs each test case with stdout capture + timing.
const HARNESS = `
import json, time, io, traceback, base64, inspect
from contextlib import redirect_stdout

# Payloads arrive base64-encoded: JSON literals (true/false/null) are not valid
# Python, so decode + json.loads at runtime instead of inlining.
USER_CODE = base64.b64decode('__USER_CODE_B64__').decode('utf-8')
TESTS = json.loads(base64.b64decode('__TESTS_B64__').decode('utf-8'))
FN_HINT = json.loads(base64.b64decode('__FN_B64__').decode('utf-8'))

def norm(s):
    return ''.join(c for c in str(s).lower() if c.isalnum())

LENGTH_NAMES = {'n', 'm', 'len', 'length', 'size', 'sz', 'num'}
OPS_KEYS = {'operations', 'ops'}

def bind_args(fn_or_params, inputs):
    """Map an input dict onto params: name-match, then positional leftovers,
    then len() fill for length-style params, then defaults. Raises TypeError."""
    params = fn_or_params
    if callable(fn_or_params) and not isinstance(fn_or_params, list):
        try:
            params = [p for p in inspect.signature(fn_or_params).parameters.values() if p.name != 'self']
        except (ValueError, TypeError):
            return list(inputs.values()), {}
    if not isinstance(inputs, dict):
        return [inputs], {}
    remaining = dict(inputs)
    bound = {}
    for p in params:
        for k in list(remaining):
            if norm(k) == norm(p.name):
                bound[p.name] = remaining.pop(k)
                break
    lists = [v for v in bound.values() if isinstance(v, (list, tuple, str))]
    li = 0
    args = []
    for p in params:
        if p.name in bound:
            args.append(bound[p.name])
        elif remaining:
            args.append(remaining.pop(next(iter(remaining))))
        elif norm(p.name) in LENGTH_NAMES and li < len(lists):
            args.append(len(lists[li]))
            li += 1
        elif p.default is not inspect.Parameter.empty:
            args.append(p.default)
        else:
            raise TypeError(f"missing argument for '{p.name}' (inputs: {list(inputs)})")
    return args, {}

def invoke(target, inputs):
    args, kwargs = bind_args(target, inputs)
    return target(*args, **kwargs)

def public_methods(cls):
    try:
        return [m for m in dir(cls) if not m.startswith('_') and callable(getattr(cls, m))]
    except Exception:
        return []

def resolve_class(g):
    if isinstance(g.get('Solution'), type):
        return g['Solution']
    classes = [v for v in g.values() if isinstance(v, type)]
    with_methods = [c for c in classes if public_methods(c)]
    if len(with_methods) == 1:
        return with_methods[0]
    return classes[0] if classes else None

def required_init_params(cls):
    try:
        return [p for p in inspect.signature(cls.__init__).parameters.values()
                if p.name != 'self' and p.default is inspect.Parameter.empty
                and p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)]
    except (ValueError, TypeError):
        return []

def find_method(inst, name):
    if hasattr(inst, name) and callable(getattr(inst, name)):
        return getattr(inst, name)
    for m in dir(inst):
        if not m.startswith('_') and norm(m) == norm(name) and callable(getattr(inst, m)):
            return getattr(inst, m)
    return None

def ops_key_of(inputs):
    if isinstance(inputs, dict):
        for k, v in inputs.items():
            if norm(k) in OPS_KEYS and isinstance(v, list):
                return k
    return None

def construct(cls, other):
    """Instantiate with other input keys bound to __init__ (no-arg when trivial)."""
    try:
        params = [p for p in inspect.signature(cls.__init__).parameters.values() if p.name != 'self']
    except (ValueError, TypeError):
        return cls()
    if not params:
        return cls()
    args, kwargs = bind_args(params, other if isinstance(other, dict) else {})
    return cls(*args, **kwargs)

def ops_replay(cls, ops, other):
    """LeetCode interaction model: replay [[method, *args]] on one instance,
    collecting every return (None for void ops / constructor placeholders)."""
    inst = construct(cls, other)
    collected = []
    for op in ops:
        name = op[0] if op else ''
        args = op[1:] if len(op) > 1 else []
        meth = find_method(inst, name)
        if meth is None:
            if not args:
                collected.append(None)
                continue
            raise AttributeError(f'unknown operation: {name}')
        collected.append(jsonable(meth(*args)))
    return collected

def lists_match(actual, exp):
    if actual == exp:
        return True
    # void-op convention (push/pop produce nothing): compare compacted list,
    # but only when the spec omits nulls entirely.
    if isinstance(exp, list) and all(e is not None for e in exp):
        return [x for x in actual if x is not None] == exp
    return False

def constructor_repeat(cls, inputs):
    """Constructor-args + one repeated method (e.g. KthLargest(k, nums) + add*)."""
    methods = public_methods(cls)
    if len(methods) != 1 or not isinstance(inputs, dict):
        raise TypeError('constructor-repeat needs exactly one public method')
    init_ps = required_init_params(cls)
    args, _ = bind_args(
        [p for p in inspect.signature(cls.__init__).parameters.values() if p.name != 'self'],
        inputs)
    inst = cls(*args)
    consumed = set()
    try:
        sig = inspect.signature(cls.__init__)
        rem = dict(inputs)
        for p in sig.parameters.values():
            if p.name == 'self':
                continue
            for k in list(rem):
                if norm(k) == norm(p.name):
                    consumed.add(k)
                    rem.pop(k)
                    break
            else:
                if rem:
                    consumed.add(next(iter(rem)))
                    rem.pop(next(iter(rem)))
    except (ValueError, TypeError):
        rem = {}
    repeat_lists = [v for k, v in inputs.items() if k not in consumed and isinstance(v, list)]
    if len(repeat_lists) != 1:
        raise TypeError('constructor-repeat needs exactly one leftover list input')
    meth = getattr(inst, methods[0])
    return [jsonable(meth(x)) for x in repeat_lists[0]]

def jsonable(v):
    try:
        json.dumps(v)
        return v
    except Exception:
        return repr(v)

out = {"results": [], "fatal": None}
try:
    g = {}
    exec(USER_CODE, g)
except Exception:
    out["fatal"] = traceback.format_exc(limit=3)
else:
    # Entrypoint dispatch across three problem models:
    #  1. ops-replay  — input has operations/ops list (design problems)
    #  2. single-call — Solution method / function (standard problems)
    #  3. ctor-repeat — stateful class + one repeated method (stream problems)
    cls = resolve_class(g)
    for tc in TESTS:
        raw_in = tc.get("input")
        exp = tc.get("expected")
        buf = io.StringIO()
        t0 = time.perf_counter()
        try:
            with redirect_stdout(buf):
                OPKEY = ops_key_of(raw_in)
                if OPKEY is not None and cls is not None:
                    other = {k: v for k, v in raw_in.items() if k != OPKEY}
                    actual = ops_replay(cls, raw_in[OPKEY], other)
                    passed = lists_match(actual, exp)
                elif cls is not None and required_init_params(cls) and not (FN_HINT and callable(g.get(FN_HINT))):
                    actual = constructor_repeat(cls, raw_in)
                    passed = lists_match(actual, exp) if isinstance(actual, list) else bool(actual == exp)
                else:
                    target = None
                    if FN_HINT and callable(g.get(FN_HINT)):
                        target = g[FN_HINT]
                    if target is None and cls is not None:
                        methods = public_methods(cls)
                        if methods:
                            target = getattr(cls(), methods[0])
                    if target is None:
                        fns = [v for k, v in g.items() if callable(v) and not k.startswith('_') and not isinstance(v, type)]
                        if fns:
                            target = fns[0]
                    if target is None:
                        raise RuntimeError('No callable found: define a Solution class or a function.')
                    actual = invoke(target, raw_in)
                    passed = bool(actual == exp)
            ms = (time.perf_counter() - t0) * 1000
            out["results"].append({
                "id": tc.get("id"),
                "input": jsonable(tc.get("input")),
                "expected": jsonable(exp),
                "actual": jsonable(actual),
                "passed": bool(passed),
                "stdout": buf.getvalue(),
                "runtimeMs": round(ms, 2),
            })
        except Exception:
                ms = (time.perf_counter() - t0) * 1000
                out["results"].append({
                    "id": tc.get("id"),
                    "input": jsonable(tc.get("input")),
                    "expected": jsonable(tc.get("expected")),
                    "actual": None,
                    "passed": False,
                    "stdout": buf.getvalue() + traceback.format_exc(limit=3),
                    "runtimeMs": round(ms, 2),
                })
json.dumps(out)
`;

self.onmessage = async (e) => {
  const { id, code, testCases, functionName } = e.data ?? {};
  if (e.data?.type === 'warm') {
    try { await ensurePyodide(); self.postMessage({ type: 'ready' }); }
    catch (err) { self.postMessage({ type: 'ready', error: String(err) }); }
    return;
  }
  const t0 = performance.now();
  try {
    const pyodide = await ensurePyodide();
    // Engine is up — execution starts now (the hook budgets 5s from here,
    // so slow CDN loads can never masquerade as infinite loops).
    try { self.postMessage({ type: 'started', id }); } catch {}
    const script = HARNESS
      .replace('__USER_CODE_B64__', toB64(code))
      .replace('__TESTS_B64__', toB64(JSON.stringify(testCases)))
      .replace('__FN_B64__', toB64(JSON.stringify(functionName ?? null)));
    pyodide.setStdout({ batched: () => {} });
    pyodide.setStdout({ batched: () => {} });
    const raw = pyodide.runPython(script);
    // HARNESS evaluates to a JSON string (final expression).
    const payload = JSON.parse(raw ?? '{}');
    if (payload.fatal) {
      self.postMessage({ type: 'result', id, status: 'error', results: payload.results ?? [], totalTimeMs: Math.round(performance.now() - t0), error: payload.fatal });
      return;
    }
    const results = payload.results ?? [];
    const passed = results.filter((r) => r.passed).length;
    self.postMessage({
      type: 'result', id, results,
      status: passed === results.length && results.length > 0 ? 'passed' : 'failed',
      totalTimeMs: Math.round(performance.now() - t0), error: null,
    });
  } catch (err) {
    self.postMessage({ type: 'result', id, status: 'error', results: [], totalTimeMs: Math.round(performance.now() - t0), error: String(err?.message ?? err) });
  }
};
