// C++ (Wandbox, gcc-head) driver: source parsing + generated harness.
// Layout: prelude + user code (main renamed) + generated builders + driver main.
// Mirrors the three models; arg binding by (parsed) name, then positional, then len-fill.

const PRELUDE = `
#include <bits/stdc++.h>
using namespace std;

struct JV {
  enum T { NUL, BOOL, NUM, STR, ARR, OBJ } t = NUL;
  bool b = false;
  double num = 0;
  string s;
  vector<JV> a;
  vector<pair<string, JV>> o;
  static JV nul() { return JV(); }
  static JV boolean(bool v) { JV j; j.t = BOOL; j.b = v; return j; }
  static JV number(double v) { JV j; j.t = NUM; j.num = v; return j; }
  static JV str(const string &v) { JV j; j.t = STR; j.s = v; return j; }
  static JV arr(vector<JV> v) { JV j; j.t = ARR; j.a = move(v); return j; }
  static JV obj(vector<pair<string, JV>> v) { JV j; j.t = OBJ; j.o = move(v); return j; }
};

struct __bdJsonP {
  const string &s; size_t i = 0;
  __bdJsonP(const string &s_) : s(s_) {}
  void ws() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
  char ch() { return i < s.size() ? s[i] : 0; }
  JV val() {
    ws();
    char c = ch();
    if (c == '{') return obj();
    if (c == '[') return arr();
    if (c == '"') return JV::str(str());
    if (c == 't') { i += 4; return JV::boolean(true); }
    if (c == 'f') { i += 5; return JV::boolean(false); }
    if (c == 'n') { i += 4; return JV::nul(); }
    size_t j = i;
    while (i < s.size() && string("-+0123456789.eE").find(s[i]) != string::npos) i++;
    return JV::number(stod(s.substr(j, i - j)));
  }
  JV obj() {
    vector<pair<string, JV>> m;
    i++; ws();
    if (ch() == '}') { i++; return JV::obj(move(m)); }
    while (true) {
      ws();
      string k = str();
      ws(); i++;
      m.emplace_back(k, val());
      ws();
      char c = ch(); i++;
      if (c == '}') break;
    }
    return JV::obj(move(m));
  }
  JV arr() {
    vector<JV> l;
    i++; ws();
    if (ch() == ']') { i++; return JV::arr(move(l)); }
    while (true) {
      l.push_back(val());
      ws();
      char c = ch(); i++;
      if (c == ']') break;
    }
    return JV::arr(move(l));
  }
  string str() {
    string b;
    i++;
    while (true) {
      char c = s[i++];
      if (c == '"') break;
      if (c == '\\\\') {
        char e = s[i++];
        if (e == 'n') b += '\\n';
        else if (e == 't') b += '\\t';
        else if (e == 'r') b += '\\r';
        else if (e == 'b') b += '\\b';
        else if (e == 'f') b += '\\f';
        else if (e == 'u') { b += (char)stoi(s.substr(i, i + 4), nullptr, 16); i += 4; }
        else b += e;
      } else b += c;
    }
    return b;
  }
};
static JV __bdParseJson(const string &s) { __bdJsonP p(s); p.ws(); return p.val(); }

static string __bdB64dec(const string &b) {
  static const string T = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  string o;
  int val = 0, bits = 0;
  for (char c : b) {
    if (c == '=') break;
    size_t p = T.find(c);
    if (p == string::npos) continue;
    val = (val << 6) | (int)p;
    bits += 6;
    if (bits >= 8) { bits -= 8; o += (char)((val >> bits) & 0xFF); }
  }
  return o;
}

struct __bdErr : runtime_error { using runtime_error::runtime_error; };

// ---------- converters ----------
static long long __bdInt(const JV &v) {
  if (v.t == JV::NUM) return (long long)v.num;
  if (v.t == JV::STR) return stoll(v.s);
  if (v.t == JV::BOOL) return v.b ? 1 : 0;
  throw __bdErr("cannot convert to int");
}
static double __bdNum(const JV &v) {
  if (v.t == JV::NUM) return v.num;
  if (v.t == JV::STR) return stod(v.s);
  if (v.t == JV::BOOL) return v.b ? 1 : 0;
  throw __bdErr("cannot convert to number");
}
static bool __bdBool(const JV &v) {
  if (v.t == JV::BOOL) return v.b;
  if (v.t == JV::NUM) return v.num != 0;
  if (v.t == JV::STR) return v.s == "true" || v.s == "1";
  throw __bdErr("cannot convert to bool");
}
static char __bdChar(const JV &v) {
  if (v.t == JV::STR && v.s.size() == 1) return v.s[0];
  if (v.t == JV::NUM) return (char)v.num;
  throw __bdErr("cannot convert to char");
}
static string __bdCanonNum(double d) {
  if (!isfinite(d)) return "null";
  long long li = (long long)d;
  if ((double)li == d && fabs(d) < 9e15) return to_string(li);
  ostringstream o; o << setprecision(17) << d;
  return o.str();
}
static string __bdStr(const JV &v) {
  if (v.t == JV::STR) return v.s;
  if (v.t == JV::NUM) return __bdCanonNum(v.num);
  if (v.t == JV::BOOL) return v.b ? "true" : "false";
  if (v.t == JV::NUL) return "null";
  throw __bdErr("cannot convert to string");
}
static vector<int> __bdVecInt(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<int>");
  vector<int> o; for (auto &x : v.a) o.push_back((int)__bdInt(x)); return o;
}
static vector<long long> __bdVecLL(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<long long>");
  vector<long long> o; for (auto &x : v.a) o.push_back(__bdInt(x)); return o;
}
static vector<double> __bdVecDbl(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<double>");
  vector<double> o; for (auto &x : v.a) o.push_back(__bdNum(x)); return o;
}
static vector<string> __bdVecStr(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<string>");
  vector<string> o; for (auto &x : v.a) o.push_back(__bdStr(x)); return o;
}
static vector<char> __bdVecChar(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<char>");
  vector<char> o; for (auto &x : v.a) o.push_back(__bdChar(x)); return o;
}
static vector<vector<int>> __bdVecVecInt(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<vector<int>>");
  vector<vector<int>> o; for (auto &x : v.a) o.push_back(__bdVecInt(x)); return o;
}
static vector<vector<string>> __bdVecVecStr(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<vector<string>>");
  vector<vector<string>> o; for (auto &x : v.a) o.push_back(__bdVecStr(x)); return o;
}
static vector<vector<char>> __bdVecVecChar(const JV &v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<vector<char>>");
  vector<vector<char>> o; for (auto &x : v.a) o.push_back(__bdVecChar(x)); return o;
}

// ---------- canonical serializer ----------
static string __bdJesc(const string &s) {
  string o = "\\"";
  for (char c : s) {
    if (c == '"') o += "\\\\\\"";
    else if (c == '\\\\') o += "\\\\\\\\";
    else if (c == '\\n') o += "\\\\n";
    else if (c == '\\r') o += "\\\\r";
    else if (c == '\\t') o += "\\\\t";
    else o += c;
  }
  return o + "\\"";
}
static string __bdCanon(const JV &v) {
  switch (v.t) {
    case JV::NUL: return "null";
    case JV::BOOL: return v.b ? "true" : "false";
    case JV::NUM: return __bdCanonNum(v.num);
    case JV::STR: return __bdJesc(v.s);
    case JV::ARR: { string o = "["; for (size_t k = 0; k < v.a.size(); k++) { if (k) o += ","; o += __bdCanon(v.a[k]); } return o + "]"; }
    case JV::OBJ: {
      auto ks = v.o;
      sort(ks.begin(), ks.end(), [](auto &x, auto &y){ return x.first < y.first; });
      string o = "{";
      for (size_t k = 0; k < ks.size(); k++) { if (k) o += ","; o += __bdJesc(ks[k].first) + ":" + __bdCanon(ks[k].second); }
      return o + "}";
    }
  }
  return "null";
}
static JV __bdToJV(long long v) { return JV::number((double)v); }
static JV __bdToJV(int v) { return JV::number((double)v); }
static JV __bdToJV(double v) { return JV::number(v); }
static JV __bdToJV(bool v) { return JV::boolean(v); }
static JV __bdToJV(char v) { return JV::str(string(1, v)); }
static JV __bdToJV(const string &v) { return JV::str(v); }
static JV __bdToJV(const vector<int> &v) { vector<JV> o; for (int x : v) o.push_back(JV::number(x)); return JV::arr(move(o)); }
static JV __bdToJV(const vector<long long> &v) { vector<JV> o; for (auto x : v) o.push_back(JV::number((double)x)); return JV::arr(move(o)); }
static JV __bdToJV(const vector<double> &v) { vector<JV> o; for (auto x : v) o.push_back(JV::number(x)); return JV::arr(move(o)); }
static JV __bdToJV(const vector<string> &v) { vector<JV> o; for (auto &x : v) o.push_back(JV::str(x)); return JV::arr(move(o)); }
static JV __bdToJV(const vector<char> &v) { vector<JV> o; for (auto x : v) o.push_back(JV::str(string(1, x))); return JV::arr(move(o)); }
static JV __bdToJV(const vector<bool> &v) { vector<JV> o; for (size_t k = 0; k < v.size(); k++) o.push_back(JV::boolean(v[k])); return JV::arr(move(o)); }
static JV __bdToJV(const vector<vector<int>> &v) { vector<JV> o; for (auto &x : v) o.push_back(__bdToJV(x)); return JV::arr(move(o)); }
static JV __bdToJV(const vector<vector<string>> &v) { vector<JV> o; for (auto &x : v) o.push_back(__bdToJV(x)); return JV::arr(move(o)); }
static JV __bdToJV(const vector<vector<char>> &v) { vector<JV> o; for (auto &x : v) o.push_back(__bdToJV(x)); return JV::arr(move(o)); }

static bool __bdListsMatch(const JV &actual, const JV &exp) {
  if (__bdCanon(actual) == __bdCanon(exp)) return true;
  if (exp.t == JV::ARR) {
    bool noNulls = true;
    for (auto &e : exp.a) if (e.t == JV::NUL) { noNulls = false; break; }
    if (noNulls && actual.t == JV::ARR) {
      vector<JV> c;
      for (auto &x : actual.a) if (x.t != JV::NUL) c.push_back(x);
      return __bdCanon(JV::arr(move(c))) == __bdCanon(exp);
    }
  }
  return false;
}

// ---------- stdout capture ----------
struct __bdCap {
  streambuf *oldOut, *oldErr;
  ostringstream buf;
  __bdCap(string *dst) : dst_(dst) {
    oldOut = cout.rdbuf(buf.rdbuf());
    oldErr = cerr.rdbuf(buf.rdbuf());
  }
  ~__bdCap() { cout.rdbuf(oldOut); cerr.rdbuf(oldErr); *dst_ = buf.str(); }
  string *dst_;
};

static string __bdNorm(string s) {
  string o;
  for (char c : s) {
    char l = tolower((unsigned char)c);
    if ((l >= 'a' && l <= 'z') || (l >= '0' && l <= '9')) o += l;
  }
  return o;
}
static const JV *__bdGetKey(const JV &obj, size_t idx) {
  if (obj.t != JV::OBJ || idx >= obj.o.size()) throw __bdErr("input key index out of range");
  return &obj.o[idx].second;
}
`

// ================= JS-side parsing & codegen =================
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const LEN_NAMES = new Set(['n', 'm', 'len', 'length', 'size', 'sz', 'num'])

// strip comments + string/char literals (keep newlines & length-ish positions)
function stripNoise(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const nx = src[i + 1]
    if (c === '/' && nx === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
    } else if (c === '/' && nx === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      out += '    '
      i += 2
    } else if (c === '"' || c === "'") {
      const q = c
      out += ' '
      i++
      while (i < n) {
        if (src[i] === '\\') { out += '  '; i += 2; continue }
        if (src[i] === '\n') { out += '\n'; i++; if (q === "'") break; continue }
        if (src[i] === q) { out += ' '; i++; break }
        out += ' '
        i++
      }
    } else if (c === 'R' && nx === '"') {
      // raw string R"delim(...)delim"
      const m = src.slice(i).match(/^R"([^\s()\\]{0,16})\(/)
      if (m) {
        const term = ')' + m[1] + '"'
        const end = src.indexOf(term, i + m[0].length)
        const stop = end < 0 ? n : end + term.length
        let k = i
        while (k < stop) { out += src[k] === '\n' ? '\n' : ' '; k++ }
        i = stop
      } else { out += c; i++ }
    } else { out += c; i++ }
  }
  return out
}

function balance(s, openIdx) {
  // s[openIdx] must be '{' -> index of matching '}'
  let d = 0
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') d++
    else if (s[i] === '}') { d--; if (!d) return i }
  }
  return -1
}

function depthAt(s, idx) {
  let d = 0
  for (let i = 0; i < idx; i++) {
    if (s[i] === '{') d++
    else if (s[i] === '}') d--
  }
  return d
}

// top-level classes/structs with bodies
function findTopTypes(stripped) {
  const out = []
  const re = /(class|struct)\s+(\w+)/g
  let m
  while ((m = re.exec(stripped)) !== null) {
    if (depthAt(stripped, m.index) !== 0) continue
    const brace = stripped.indexOf('{', m.index + m[0].length)
    if (brace < 0) continue
    // make sure no ';' between name and brace (forward decl)
    const between = stripped.slice(m.index + m[0].length, brace)
    if (between.includes(';')) continue
    const end = balance(stripped, brace)
    if (end < 0) continue
    out.push({ kind: m[1], name: m[2], body: stripped.slice(brace + 1, end) })
  }
  return out
}

function splitTop(s) {
  const parts = []
  let da = 0, pa = 0, sa = 0, cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '<') da++
    else if (c === '>') da--
    else if (c === '(') pa++
    else if (c === ')') pa--
    else if (c === '[') sa++
    else if (c === ']') sa--
    if (c === ',' && !da && !pa && !sa) { parts.push(cur); cur = '' } else cur += c
  }
  parts.push(cur)
  return parts
}

function parseParams(paramStr) {
  const t = paramStr.trim()
  if (!t || t === 'void') return []
  return splitTop(t).map((p) => {
    p = p.trim()
    if (!p) return null
    // strip default value
    let dd = 0, cut = -1
    for (let i = 0; i < p.length; i++) {
      const c = p[i]
      if (c === '<' || c === '(') dd++
      else if (c === '>' || c === ')') dd--
      else if (c === '=' && !dd) { cut = i; break }
    }
    if (cut >= 0) p = p.slice(0, cut).trim()
    // name = last identifier
    const nm = p.match(/([A-Za-z_]\w*)\s*(\[[^\]]*\])?\s*$/)
    if (!nm) return { type: p, name: '' }
    const name = nm[1]
    let type = p.slice(0, p.length - nm[0].length).trim()
    if (nm[2]) type = (type ? type + ' ' : '') + nm[2].trim()
    if (!type) return { type: name, name: '' } // e.g. lone "int" -> unnamed
    return { type, name }
  }).filter(Boolean)
}

// member methods of a class body; tracks public/private.
// Depth-tracked: declarations are only recognized at class-body depth 0, so
// `return foo(x);` inside a method body can never parse as a method.
function parseMembers(body, clsName) {
  const methods = []
  let access = null // caller applies struct/class default for IMPLICIT
  let i = 0
  let d = 0
  const n = body.length
  const skipWs = () => { while (i < n && /\s/.test(body[i])) i++ }
  while (i < n) {
    skipWs()
    if (i >= n) break
    const c = body[i]
    if (c === '{') { d++; i++; continue }
    if (c === '}') { d--; i++; continue }
    if (d !== 0) { i++; continue }
    // access label
    const lbl = body.slice(i).match(/^(public|private|protected)\s*:/)
    if (lbl) { access = lbl[1]; i += lbl[0].length; continue }
    // nested type or namespace -> skip block (member fns stay hidden inside)
    const nest = body.slice(i).match(/^(class|struct|enum|union|namespace)\b/)
    if (nest) {
      const b = body.indexOf('{', i)
      const sc = body.indexOf(';', i)
      if (b >= 0 && (sc < 0 || b < sc)) {
        const e = balance(body, b)
        i = e < 0 ? n : e + 1
        const semi = body.indexOf(';', i)
        if (semi >= 0 && semi < i + 20) i = semi + 1
        continue
      }
      const s2 = body.indexOf(';', i)
      i = s2 < 0 ? n : s2 + 1
      continue
    }
    // template<...> -> skip the <> part
    if (body.slice(i).startsWith('template')) {
      const lt = body.indexOf('<', i)
      if (lt === i + 8) {
        let dd = 0, k = lt
        for (; k < n; k++) {
          if (body[k] === '<') dd++
          else if (body[k] === '>') { dd--; if (!dd) break }
        }
        i = k + 1
        continue
      }
    }
    // using ...; typedef ...; static_assert(...);
    const usingM = body.slice(i).match(/^(using|typedef|static_assert|friend)\b/)
    if (usingM) {
      // skip to ; or balanced block
      const sc = body.indexOf(';', i)
      const b = body.indexOf('{', i)
      if (b >= 0 && sc >= 0 && b < sc) { const e = balance(body, b); i = e < 0 ? n : e + 1 }
      else i = sc < 0 ? n : sc + 1
      continue
    }
    // method decl/def: anchored match
    const rest = body.slice(i)
    const mm = rest.match(/^([A-Za-z_][\w:<>,\s*&]*?)\s+([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?(?:requires\s+[^{};]+)?(?:->\s*[\w:<>,\s*&]+)?\s*([\{;])/)
    if (mm && !/^(if|for|while|switch|catch|return)$/.test(mm[2])) {
      const [, ret, name, params, term] = mm
      if (name !== clsName) { // ctors recorded separately
        methods.push({ ret: ret.trim(), name, params: parseParams(params), access: access || 'IMPLICIT', def: term === '{' })
      } else {
        methods.push({ ret: '', name, params: parseParams(params), access: access || 'IMPLICIT', def: term === '{', ctor: true })
      }
      i += mm[0].length - 1
      if (term === '{') {
        const e = balance(body, i)
        i = e < 0 ? n : e + 1
      } else i += 1
      continue
    }
    i++
  }
  return { methods, }
}

// struct field info for node builders
function parseStructVars(body) {
  const vars = []
  // member var decls at depth 0: "type a, b;" (no parens)
  let d = 0
  let stmt = ''
  const stmts = []
  for (let k = 0; k < body.length; k++) {
    const c = body[k]
    if (c === '{') d++
    else if (c === '}') d--
    if (d === 0 && c === ';') { stmts.push(stmt); stmt = '' }
    else if (d === 0) stmt += c
    else stmt += ''
  }
  for (let s of stmts) {
    s = s.trim().replace(/^(public|private|protected)\s*:\s*/, '')
    if (!s || /[()]/.test(s) || /^(using|typedef|friend|static_assert|template)\b/.test(s)) continue
    const m = s.match(/^([\w:<>,\s*&]+?)\s+(\w[\w\s,]*)$/)
    if (!m) continue
    const type = m[1].trim()
    if (/^(public|private|protected)$/.test(type)) continue
    for (const nm of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
      if (/^[A-Za-z_]\w*$/.test(nm)) vars.push({ type, name: nm })
    }
  }
  return vars
}

function findCtors(body, clsName) {
  // depth-0 constructor declarations/definitions only (excludes new-expressions
  // inside method bodies and ::-qualified out-of-class spellings)
  const out = []
  const re = new RegExp(clsName + '\\s*\\(([^();{}]*)\\)', 'g')
  let m
  while ((m = re.exec(body)) !== null) {
    if (depthAt(body, m.index) !== 0) continue
    if (/[A-Za-z_0-9:]$/.test(body.slice(0, m.index))) continue
    out.push(parseParams(m[1]))
  }
  return out
}

const canonType = (t) => t.replace(/\s+/g, ' ').replace(/\s*([<>,*&])\s*/g, '$1').trim()

// vector<bool> is bit-packed: dedicated converter + cast helpers + len-fill
const PRELUDE_EXTRA = `
static vector<bool> __bdVecBool(const JV& v) {
  if (v.t != JV::ARR) throw __bdErr("cannot convert to vector<bool>");
  vector<bool> o; for (auto& x : v.a) o.push_back(__bdBool(x)); return o;
}
template <typename T> vector<T> __bdVecCast(const vector<int>& v) { return vector<T>(v.begin(), v.end()); }
template <typename T> vector<T> __bdVecCastD(const vector<double>& v) { return vector<T>(v.begin(), v.end()); }
static int __bdLenOf(const JV& obj) {
  if (obj.t != JV::OBJ) return 0;
  for (auto& kv : obj.o) if (kv.second.t == JV::ARR) return (int)kv.second.a.size();
  return 0;
}
`

const INT_TYPES = new Set(['int', 'short', 'long', 'long long', 'unsigned', 'unsigned int', 'unsigned long', 'unsigned long long', 'size_t'])
const FLOAT_TYPES = new Set(['double', 'float'])

// converter expr for a param type given a JV value expr
function convFor(type, valExpr, structs) {
  const t = canonType(type)
  const base = t.replace(/^const\s+/, '').replace(/\s+const$/, '')
  const noRef = base.replace(/&\s*$/, '').trim()
  const isPtr = /\*$/.test(noRef)
  const core = noRef.replace(/\*$/, '').trim().replace(/^std::/, '')
  if (core === 'void') throw new Error('void parameter')
  if (INT_TYPES.has(core)) return `__bdInt(${valExpr})`
  if (FLOAT_TYPES.has(core)) return `__bdNum(${valExpr})`
  if (core === 'bool') return `__bdBool(${valExpr})`
  if (core === 'char') return `__bdChar(${valExpr})`
  if (core === 'string') return `__bdStr(${valExpr})`
  const vm = core.match(/^vector<(.+)>$/)
  if (vm) {
    const inner = vm[1].trim().replace(/^std::/, '')
    if (inner === 'int') return `__bdVecInt(${valExpr})`
    if (inner === 'long' || inner === 'long long' || inner === 'short' || inner === 'unsigned' || inner === 'unsigned int' || inner === 'size_t') return `__bdVecCast<${inner}>((__bdVecInt(${valExpr})))`
    if (inner === 'double' || inner === 'float') return `__bdVecCast<${inner}>((__bdVecDbl(${valExpr})))`
    if (inner === 'string') return `__bdVecStr(${valExpr})`
    if (inner === 'char') return `__bdVecChar(${valExpr})`
    if (inner === 'bool') return `__bdVecBool(${valExpr})`
    const vvm = inner.match(/^vector<(.+)>$/)
    if (vvm) {
      const ii = vvm[1].trim().replace(/^std::/, '')
      if (ii === 'int') return `__bdVecVecInt(${valExpr})`
      if (ii === 'string') return `__bdVecVecStr(${valExpr})`
      if (ii === 'char') return `__bdVecVecChar(${valExpr})`
    }
    throw new Error(`unsupported vector element type in "${type}"`)
  }
  const st = structs[core]
  if (st) {
    const b = `__bd_build_${core}(${valExpr})`
    return isPtr ? b : `(*${b})`
  }
  throw new Error(`unsupported parameter type "${type}"`)
}

// serializer expr for a return type given a C++ value expr
function serFor(type, valExpr, structs) {
  const t = canonType(type)
  if (t === 'void') return 'JV::nul()'
  const base = t.replace(/^const\s+/, '').replace(/\s+const$/, '')
  const noRef = base.replace(/&\s*$/, '').trim()
  const isPtr = /\*$/.test(noRef)
  const core = noRef.replace(/\*$/, '').trim().replace(/^std::/, '')
  if (INT_TYPES.has(core)) return `__bdToJV((long long)(${valExpr}))`
  if (FLOAT_TYPES.has(core)) return `__bdToJV((double)(${valExpr}))`
  if (core === 'bool') return `__bdToJV((bool)(${valExpr}))`
  if (core === 'char') return `__bdToJV((char)(${valExpr}))`
  if (core === 'string') return `__bdToJV((string)(${valExpr}))`
  if (/^vector</.test(core)) return `__bdToJV(${valExpr})`
  const st = structs[core]
  if (st) return `__bd_ser_${core}(${valExpr})`
  throw new Error(`unsupported return type "${type}"`)
}

// classify a struct for node build/serialize
function structInfo(name, body) {
  const vars = parseStructVars(body)
  const numVal = vars.find((v) => /^(val|data|key)$/.test(v.name) && /int|long|double|float|char|string/.test(v.type))
    || vars.find((v) => /int|long|double|float|char/.test(v.type))
  const selfPtrs = vars.filter((v) => /\*/.test(v.type) && v.type.replace(/\s|\*/g, '').replace(/^struct\s+/, '') === name)
  const valField = numVal || null
  const nextF = selfPtrs.find((v) => /^(next|nxt)$/.test(v.name)) || selfPtrs[0] || null
  const leftF = selfPtrs.find((v) => /^(left|l)$/.test(v.name)) || null
  const rightF = selfPtrs.find((v) => /^(right|r)$/.test(v.name)) || null
  const ctors = findCtors(body, name)
  const hasDefault = ctors.some((p) => p.length === 0)
  const hasIntCtor = ctors.some((p) => p.length >= 1 && /int|long|double|float|char/.test(p[0].type))
  const hasIntPtrCtor = ctors.some((p) => p.length >= 2 && /int|long|double|float|char/.test(p[0].type))
  const isTree = !!(valField && leftF && rightF)
  const isList = !!(valField && nextF && !isTree)
  return { name, vars, valField, nextF, leftF, rightF, hasDefault, hasIntCtor, hasIntPtrCtor, isTree, isList }
}

function builderCode(st) {
  // needs: valField + (nextF | leftF+rightF) + usable ctor
  if (!st.valField) throw new Error(`struct ${st.name}: no numeric value field found`)
  const vt = canonType(st.valField.type).replace(/^std::/, '')
  const elemJV = (expr) => vt === 'string' ? `JV::str(${expr})`
    : vt === 'char' ? `JV::str(string(1, ${expr}))`
    : /double|float/.test(vt) ? `JV::number((double)(${expr}))`
    : /bool/.test(vt) ? `JV::boolean((bool)(${expr}))`
    : `JV::number((double)((long long)(${expr})))`
  const vconv = vt === 'string' || vt === 'std::string' ? '__bdStr'
    : vt === 'char' ? '__bdChar'
    : /double|float/.test(vt) ? '__bdNum' : '__bdInt'
  const valCast = vt === 'string' || vt === 'std::string' ? '' : vt === 'char' ? '' : /long/.test(vt) ? '(long long)' : /double|float/.test(vt) ? '(double)' : '(int)'
  const mk = st.hasIntPtrCtor || st.hasIntCtor
    ? `new ${st.name}(${valCast}${vconv}(x))`
    : st.hasDefault
      ? `(new ${st.name}())`
      : null
  if (!mk) throw new Error(`struct ${st.name}: need a (value), (value,next), or default constructor`)
  const assign = (!st.hasIntPtrCtor && !st.hasIntCtor)
    ? `n->${st.valField.name} = ${valCast}${vconv}(x); ` : ''
  if (st.isList) {
    return `${st.name}* __bd_build_${st.name}(const JV& av) {
  if (av.t != JV::ARR) throw __bdErr("cannot convert to ${st.name}*");
  ${st.name}* h = nullptr; ${st.name}** p = &h;
  for (auto& x : av.a) {
    ${st.name}* n = ${mk}${st.hasIntPtrCtor ? `; n->${st.nextF.name} = nullptr` : ''};
    ${assign}${st.hasIntPtrCtor ? '' : `n->${st.nextF.name} = nullptr; `}
    *p = n; p = &((*p)->${st.nextF.name});
  }
  return h;
}
JV __bd_ser_${st.name}(${st.name}* h) {
  vector<JV> o;
  for (${st.name}* c = h; c; c = c->${st.nextF.name}) {
    o.push_back(${elemJV(`c->${st.valField.name}`)});
  }
  return JV::arr(move(o));
}
`
  }
  if (st.isTree) {
    return `${st.name}* __bd_build_${st.name}(const JV& av) {
  if (av.t != JV::ARR) throw __bdErr("cannot convert to ${st.name}*");
  if (av.a.empty()) return nullptr;
  vector<${st.name}*> nodes;
  for (auto& x : av.a) {
    if (x.t == JV::NUL) { nodes.push_back(nullptr); continue; }
    ${st.name}* n = ${mk};
    ${assign}nodes.push_back(n);
  }
  for (size_t k = 0; k < nodes.size(); k++) {
    if (!nodes[k]) continue;
    size_t li = 2 * k + 1, ri = 2 * k + 2;
    if (li < nodes.size()) nodes[k]->${st.leftF.name} = nodes[li];
    if (ri < nodes.size()) nodes[k]->${st.rightF.name} = nodes[ri];
  }
  return nodes[0];
}
JV __bd_ser_${st.name}(${st.name}* r) {
  if (!r) return JV::arr({});
  vector<${st.name}*> lvl; lvl.push_back(r);
  vector<JV> vals;
  for (size_t k = 0; k < lvl.size(); k++) {
    auto* n = lvl[k];
    if (!n) { vals.push_back(JV::nul()); continue; }
    vals.push_back(${elemJV(`n->${st.valField.name}`)});
    lvl.push_back(n->${st.leftF.name}); lvl.push_back(n->${st.rightF.name});
  }
  while (!vals.empty() && vals.back().t == JV::NUL) vals.pop_back();
  return JV::arr(move(vals));
}
`
  }
  throw new Error(`struct ${st.name}: not a list or tree shape (need value + next, or value + left/right)`)
}

// bind param list to input keys from a reference test: index per param, -2 = len-fill
function bindParams(params, input) {
  const keys = Object.keys(input && typeof input === 'object' ? input : {})
  const used = new Array(keys.length).fill(false)
  const idx = new Array(params.length).fill(-1)
  params.forEach((p, i) => {
    const want = norm(p.name || '')
    if (!want) return
    for (let k = 0; k < keys.length; k++) {
      if (!used[k] && norm(keys[k]) === want) { idx[i] = k; used[k] = true; break }
    }
  })
  params.forEach((p, i) => {
    if (idx[i] >= 0) return
    for (let k = 0; k < keys.length; k++) {
      if (!used[k]) { idx[i] = k; used[k] = true; break }
    }
  })
  params.forEach((p, i) => {
    if (idx[i] >= 0) return
    const t = canonType(p.type).replace(/^std::/, '')
    if (!/^(int|long|long long|short|unsigned|size_t)$/.test(t)) return
    if (params.some((q, j) => idx[j] >= 0 && /vector</.test(q.type))) idx[i] = -2
  })
  return idx
}

function otherOf(input) {
  const o = {}
  for (const k of Object.keys(input || {})) {
    if (k === 'operations' || k === 'ops') continue
    o[k] = input[k]
  }
  return o
}

// arg exprs for a param list: materialize every argument into a named local
// (auto&&) so temporaries can bind to non-const lvalue-ref parameters.
// valExprOf(i) -> JV value expr for param i. Tag must be unique per scope.
function genArgs(params, valExprOf, structs, tag) {
  const decls = []
  const args = params.map((p, i) => {
    const nm = `__bd_${tag}${i}`
    decls.push(`auto&& ${nm} = ${convFor(p.type, valExprOf(i), structs)};`)
    return nm
  })
  return { decls: decls.join(' '), args: args.join(', ') }
}
const keyExpr = (bind, objExpr) => (i) =>
  bind[i] === -2 ? `((int)__bdLenOf(${objExpr}))` : `(*__bdGetKey(${objExpr}, ${bind[i]}))`

// base64 -> utf8 without Node-isms (browser: atob + TextDecoder)
function b64ToUtf8(b64) {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(b64, 'base64').toString('utf8')
  }
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function buildCppSource(userCode, testsB64) {
  const tests = JSON.parse(b64ToUtf8(testsB64))
  const clean = String(userCode ?? '').replace(/\bint\s+main\s*\(/g, 'int __bd_user_main(')
  const stripped = stripNoise(clean)
  const types = findTopTypes(stripped)
  const parsed = types.map((tp) => {
    const { methods } = parseMembers(tp.body, tp.name)
    const defAccess = tp.kind === 'struct' ? 'public' : 'private'
    for (const m of methods) if (m.access === 'IMPLICIT') m.access = defAccess
    return { ...tp, methods }
  })
  // entry: Solution > single class with methods > first class (mirrors resolve_class)
  const withMethods = parsed.filter((t) => t.methods.some((m) => !m.ctor))
  const entry = parsed.find((t) => t.name === 'Solution')
    || (withMethods.length === 1 ? withMethods[0] : null)
    || withMethods[0]
    || parsed[0]
    || null
  let pubMethods = entry ? entry.methods.filter((m) => !m.ctor && m.access === 'public') : []
  if (entry) {
    // out-of-class definitions (declaration-only starters): merge new methods only.
    // A SameName::SameName definition is a constructor, not a method.
    const ooo = new RegExp('([\\w:<>\\s*&~]+?)\\s+(\\w+)::(\\w+)\\s*\\(([^;{}]*?)\\)', 'g')
    let om
    while ((om = ooo.exec(stripped)) !== null) {
      if (om[2] !== entry.name || om[3].startsWith('~')) continue
      const isCtor = om[3] === entry.name
      if (!pubMethods.some((m) => m.name === om[3] && !!m.ctor === isCtor)) {
        pubMethods.push({ ret: isCtor ? '' : om[1].trim(), name: om[3], params: parseParams(om[4]), access: 'public', def: true, ...(isCtor ? { ctor: true } : {}) })
      }
    }
    // in-class constructors (the member regex cannot match ctor syntax)
    for (const cp of findCtors(entry.body, entry.name)) {
      if (!entry.methods.some((m) => m.ctor && m.params.length === cp.length)) {
        entry.methods.push({ ret: '', name: entry.name, params: cp, access: 'public', def: true, ctor: true })
      }
    }
  }
  // struct infos for node types
  const structs = {}
  for (const tp of types) {
    if (tp.kind !== 'struct') continue
    try { structs[tp.name] = structInfo(tp.name, tp.body) } catch { /* not a node shape */ }
  }
  // reference (non-ops) test for arity + binding
  const isOps = (t) => {
    const inp = t.input
    return !!inp && typeof inp === 'object'
      && Object.keys(inp).some((k) => (k === 'operations' || k === 'ops') && Array.isArray(inp[k]))
  }
  const refTest = tests.find((t) => !isOps(t)) || tests[0]
  const refKeys = Object.keys(refTest.input && typeof refTest.input === 'object' ? refTest.input : {})
  // free-function fallback (many curriculum starters are plain functions)
  let freeFn = null
  if (!pubMethods.length) {
    const noPP = stripped.replace(/^#[^\n]*$/gm, '')
    const all = parseMembers(noPP, '').methods
      .filter((m) => !m.ctor && !['main', '__bd_user_main'].includes(m.name))
    const defs = all.filter((m) => m.def)
    const pool = defs.length ? defs : all
    if (!pool.length) throw new Error('No callable found: define a Solution class or a function.')
    freeFn = pool.find((m) => m.params.length === refKeys.length) || pool[0]
  }
  const hasClass = !freeFn
  const single = freeFn || pubMethods.find((m) => m.params.length === refKeys.length) || pubMethods[0]
  // ctor-repeat: entry has a valued ctor and exactly one public method
  const valCtors = hasClass ? entry.methods.filter((m) => m.ctor && m.params.length > 0) : []
  const useCtor = hasClass && valCtors.length > 0 && pubMethods.length === 1
  const ctor = useCtor ? valCtors.slice().sort((a, b) => b.params.length - a.params.length)[0] : null
  const repeatMethod = pubMethods[0]
  if (useCtor && repeatMethod.params.length !== 1) {
    throw new Error('constructor-repeat needs a one-arg method')
  }
  const bindIdx = bindParams(single.params, refTest.input)
  if (bindIdx.some((b) => b < -2 || b >= Math.max(1, refKeys.length))) {
    throw new Error('could not bind test inputs to ' + single.name + ' parameters')
  }
  const ctorBind = ctor ? bindParams(ctor.params, otherOf(refTest.input)) : []
  const ctorConsumed = ctor
    ? [...new Set(ctorBind.filter((b) => b >= 0).map((b) => norm(Object.keys(otherOf(refTest.input))[b] ?? '')))]
    : []
  // bound construction for classes without a default ctor (all three paths)
  const declaredCtors = hasClass ? entry.methods.filter((m) => m.ctor) : []
  const hasDefaultCtor = declaredCtors.length === 0 || declaredCtors.some((c) => c.params.length === 0)
  const bctor = hasDefaultCtor ? null
    : valCtors.slice().sort((a, b) => b.params.length - a.params.length)[0]
  const bctorBind = bctor ? bindParams(bctor.params, otherOf((tests.find((t) => !isOps(t)) || tests[0]).input)) : []
  const objDecl = (objName, otherExpr, tag) => {
    if (hasDefaultCtor) return { pre: '', decl: `${entry.name} ${objName};` }
    const g = genArgs(bctor.params, keyExpr(bctorBind, otherExpr), structs, tag)
    return { pre: g.decls, decl: `${entry.name} ${objName}(${g.args});` }
  }
  // structs referenced by baked signatures
  const needStructs = new Set()
  const scanType = (type) => {
    const core = canonType(type).replace(/^(const\s+)?/, '').replace(/\s+const$/, '').replace(/&\s*$/, '').replace(/\*$/, '').trim().replace(/^std::/, '')
    if (structs[core]) needStructs.add(core)
    const vm = core.match(/^vector<(.+)>$/)
    if (vm && structs[vm[1].trim()]) needStructs.add(vm[1].trim())
  }
  single.params.forEach((p) => scanType(p.type))
  scanType(single.ret)
  pubMethods.forEach((m) => { m.params.forEach((p) => scanType(p.type)); scanType(m.ret) })
  if (ctor) ctor.params.forEach((p) => scanType(p.type))
  if (bctor && bctor !== ctor) bctor.params.forEach((p) => scanType(p.type))
  for (const sn of needStructs) {
    const st = structs[sn]
    if (!st || (!st.isList && !st.isTree)) throw new Error(`struct ${sn}: not a list/tree shape (need value + next, or value + left/right)`)
  }
  // ---- codegen
  const isVoid = canonType(single.ret) === 'void'
  const recv = hasClass ? '__bd_sol.' : ''
  const sg = genArgs(single.params, keyExpr(bindIdx, 'rawIn'), structs, 's')
  const singleObj = hasClass ? objDecl('__bd_sol', '__bd_other', 'so') : { pre: '', decl: '' }
  // NOTE: object declaration is emitted by the caller (driverMain), NOT here.
  const callStmt = `${sg.decls} ${isVoid ? `${recv}${single.name}(${sg.args});` : `auto __bd_r = ${recv}${single.name}(${sg.args});`}`
  const retStmt = isVoid ? 'JV __bd_av = JV::nul();' : `JV __bd_av = ${serFor(single.ret, '__bd_r', structs)};`
  const opsObj = hasClass ? objDecl('__bd_obj', '__bd_other', 'oo') : { pre: '', decl: '' }
  const opsBranches = pubMethods.map((m) => {
    const g = genArgs(m.params, (i) => `args[${i}]`, structs, 'o')
    const mv = canonType(m.ret) === 'void'
    const body = mv
      ? `${g.decls} __bd_obj.${m.name}(${g.args}); out.push_back(JV::nul());`
      : `${g.decls} out.push_back(${serFor(m.ret, `__bd_obj.${m.name}(${g.args})`, structs)});`
    return `else if (__bdNorm(nm) == "${norm(m.name)}" && args.size() == ${m.params.length}) { ${body} }`
  }).join('\n    ')
  let ctorCode = ''
  let ctorCall = 'JV::nul()'
  if (ctor) {
    const rg = genArgs(repeatMethod.params, () => 'x', structs, 'r')
    const rser = serFor(repeatMethod.ret, `__bd_inst.${repeatMethod.name}(${rg.args})`, structs)
    const cobj = objDecl('__bd_inst', 'other', 'co')
    ctorCode = `
static JV __bdDoCtor(const JV& rawIn) {
  JV other = __bdOther(rawIn);
  ${cobj.pre} ${cobj.decl}
  string leftKey;
  int listCount = 0;
  for (auto& kv : rawIn.o) {
    bool skip = false;
    static const char* consumed[] = {${ctorConsumed.map((s) => `"${s}"`).join(', ') || '""'}};
    for (auto c : consumed) if (__bdNorm(kv.first) == c) { skip = true; break; }
    if (skip) continue;
    if (kv.second.t == JV::ARR) { listCount++; leftKey = kv.first; }
  }
  if (listCount != 1) throw __bdErr("constructor-repeat needs exactly one leftover list input");
  const JV* lp = nullptr;
  for (auto& kv : rawIn.o) if (kv.first == leftKey) lp = &kv.second;
  vector<JV> out;
  for (auto& x : lp->a) {
    ${rg.decls}
    out.push_back(${rser});
  }
  return JV::arr(move(out));
}`
    ctorCall = '__bdDoCtor(rawIn)'
  }
  const driverMain = `
static JV __bdOther(const JV& rawIn) {
  JV other = JV::obj({});
  for (auto& kv : rawIn.o) {
    string k = __bdNorm(kv.first);
    if (k == "operations" || k == "ops") continue;
    other.o.push_back(kv);
  }
  return other;
}
static bool __bdHasOps(const JV& rawIn) {
  if (rawIn.t != JV::OBJ) return false;
  for (auto& kv : rawIn.o) {
    string k = __bdNorm(kv.first);
    if ((k == "operations" || k == "ops") && kv.second.t == JV::ARR) return true;
  }
  return false;
}
static JV __bdDoOps(const JV& rawIn) {
  string key;
  for (auto& kv : rawIn.o) {
    string k = __bdNorm(kv.first);
    if ((k == "operations" || k == "ops") && kv.second.t == JV::ARR) { key = kv.first; break; }
  }
  JV __bd_other = __bdOther(rawIn);
  ${opsObj.pre} ${opsObj.decl}
  vector<JV> out;
  const JV* ops = nullptr;
  for (auto& kv : rawIn.o) if (kv.first == key) ops = &kv.second;
  for (auto& op : ops->a) {
    string nm = op.a.empty() ? "" : __bdStr(op.a[0]);
    vector<JV> args(op.a.begin() + (op.a.empty() ? 0 : 1), op.a.end());
    if (false) {}
    ${opsBranches}
    else {
      if (args.empty()) out.push_back(JV::nul());
      else throw __bdErr(string("unknown operation: ") + nm);
    }
  }
  return JV::arr(move(out));
}
${ctorCode}
int main() {
  string testsJson = __bdB64dec("__TESTS_B64__");
  JV tests = __bdParseJson(testsJson);
  string out = "{\\"results\\":[";
  bool first = true;
  for (auto& tc : tests.a) {
    const JV* pin = nullptr; const JV* pexp = nullptr;
    for (auto& kv : tc.o) {
      if (kv.first == "input") pin = &kv.second;
      if (kv.first == "expected") pexp = &kv.second;
    }
    const JV& rawIn = *pin; const JV& exp = *pexp;
    string sout; JV actual = JV::nul(); bool passed = false; bool threw = false;
    auto t0 = chrono::steady_clock::now();
    {
      __bdCap cap(&sout);
      try {
        if (${hasClass ? '__bdHasOps(rawIn)' : 'false'}) {
          actual = __bdDoOps(rawIn);
          passed = __bdListsMatch(actual, exp);
        } else if (${useCtor ? 'true' : 'false'}) {
          actual = ${ctorCall};
          if (actual.t == JV::ARR && exp.t == JV::ARR) passed = __bdListsMatch(actual, exp);
          else passed = __bdCanon(actual) == __bdCanon(exp);
        } else {
          ${!hasDefaultCtor ? 'JV __bd_other = __bdOther(rawIn);' : ''}
          ${singleObj.pre} ${singleObj.decl}
          ${callStmt}
          ${retStmt}
          if (__bd_av.t == JV::ARR && exp.t == JV::ARR) passed = __bdListsMatch(__bd_av, exp);
          else passed = __bdCanon(__bd_av) == __bdCanon(exp);
          actual = __bd_av;
        }
      } catch (exception& e) {
        threw = true;
        sout += string("\\n") + e.what();
      } catch (...) {
        threw = true;
        sout += "\\nunknown error";
      }
    }
    double ms = chrono::duration<double, milli>(chrono::steady_clock::now() - t0).count();
    if (!first) out += ",";
    first = false;
    string tid;
    for (auto& kv : tc.o) if (kv.first == "id") tid = __bdStr(kv.second);
    out += "{\\"id\\":" + __bdJesc(tid);
    out += ",\\"input\\":" + __bdCanon(rawIn);
    out += ",\\"expected\\":" + __bdCanon(exp);
    out += ",\\"actual\\":" + (threw ? "null" : __bdCanon(actual));
    out += ",\\"passed\\":" + string(passed && !threw ? "true" : "false");
    out += ",\\"stdout\\":" + __bdJesc(sout);
    char mb[32]; snprintf(mb, sizeof(mb), "%.2f", ms);
    out += string(",\\"runtimeMs\\":") + mb + "}";
  }
  out += "]}";
  cout << "__BD_BEGIN__" << out;
  cout.flush();
  return 0;
}
`
  const builders = [...needStructs].map((sn) => builderCode(structs[sn])).join('\n')
  return (PRELUDE + PRELUDE_EXTRA + '\n' + clean + '\n' + builders + '\n' + driverMain)
    .replace('__TESTS_B64__', testsB64)
}
