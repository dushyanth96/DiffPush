// Java (Wandbox) driver: user code + reflection harness in ONE prog.java.
// Mirrors the Pyodide harness models: ops-replay / single-call / ctor-repeat,
// two-pass (name, then positional) arg binding, serialize-then-compare.
// User-facing public classes are demoted (file is prog.java).

const DRIVER = `
import java.util.*;
import java.io.*;
import java.lang.reflect.*;

class __BdJson {
    final String s; int i;
    __BdJson(String s) { this.s = s; }
    static Object parse(String s) {
        __BdJson p = new __BdJson(s);
        p.ws();
        Object v = p.val();
        p.ws();
        return v;
    }
    void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    char ch() { return i < s.length() ? s.charAt(i) : 0; }
    Object val() {
        ws();
        char c = ch();
        if (c == '{') return obj();
        if (c == '[') return arr();
        if (c == '"') return str();
        if (c == 't') { i += 4; return Boolean.TRUE; }
        if (c == 'f') { i += 5; return Boolean.FALSE; }
        if (c == 'n') { i += 4; return null; }
        int j = i;
        while (i < s.length() && "-+0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        String num = s.substring(j, i);
        try {
            if (num.indexOf('.') < 0 && num.indexOf('e') < 0 && num.indexOf('E') < 0)
                return Long.valueOf(num);
            return Double.valueOf(num);
        } catch (Exception e) { throw new RuntimeException("bad number: " + num); }
    }
    Map<String, Object> obj() {
        Map<String, Object> m = new LinkedHashMap<>();
        i++; // {
        ws();
        if (ch() == '}') { i++; return m; }
        while (true) {
            ws();
            String k = str();
            ws();
            i++; // :
            m.put(k, val());
            ws();
            char c = ch();
            i++;
            if (c == '}') break;
        }
        return m;
    }
    List<Object> arr() {
        List<Object> l = new ArrayList<>();
        i++; // [
        ws();
        if (ch() == ']') { i++; return l; }
        while (true) {
            l.add(val());
            ws();
            char c = ch();
            i++;
            if (c == ']') break;
        }
        return l;
    }
    String str() {
        StringBuilder b = new StringBuilder();
        i++; // "
        while (true) {
            char c = s.charAt(i++);
            if (c == '"') break;
            if (c == '\\\\') {
                char e = s.charAt(i++);
                if (e == 'n') b.append('\\n');
                else if (e == 't') b.append('\\t');
                else if (e == 'r') b.append('\\r');
                else if (e == 'b') b.append('\\b');
                else if (e == 'f') b.append('\\f');
                else if (e == 'u') { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                else b.append(e);
            } else b.append(c);
        }
        return b.toString();
    }
}

class __Bd {
    static String norm(String s) {
        StringBuilder b = new StringBuilder();
        for (int k = 0; k < s.length(); k++) {
            char c = Character.toLowerCase(s.charAt(k));
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) b.append(c);
        }
        return b.toString();
    }
    static final Set<String> LEN_NAMES = new HashSet<>(Arrays.asList("n","m","len","length","size","sz","num"));
    static final Set<String> OPS_KEYS = new HashSet<>(Arrays.asList("operations","ops"));

    static String b64dec(String b) {
        return new String(Base64.getDecoder().decode(b), java.nio.charset.StandardCharsets.UTF_8);
    }

    // ---------- canonical serializer
    static String canon(Object v) { return canon(v, new java.util.IdentityHashMap<>()); }
    @SuppressWarnings("unchecked")
    static String canon(Object v, java.util.IdentityHashMap<Object, Boolean> seen) {
        if (v == null) return "null";
        if (v instanceof Double) {
            double d = (Double) v;
            if (Double.isNaN(d) || Double.isInfinite(d)) return "null";
            if (d == Math.rint(d) && Math.abs(d) < 9e15) return String.valueOf((long) d);
            return String.valueOf(d);
        }
        if (v instanceof Float) {
            float f = (Float) v;
            if (Float.isNaN(f) || Float.isInfinite(f)) return "null";
            if (f == Math.rint(f)) return String.valueOf((long) f);
            return String.valueOf(f);
        }
        if (v instanceof Number || v instanceof Boolean) return String.valueOf(v);
        if (v instanceof Character) return quote(String.valueOf(v));
        if (v instanceof String) return quote((String) v);
        if (v instanceof Map) {
            List<String> ks = new ArrayList<>();
            for (Object k : ((Map<?, ?>) v).keySet()) ks.add(String.valueOf(k));
            Collections.sort(ks);
            StringBuilder b = new StringBuilder("{");
            for (int k = 0; k < ks.size(); k++) {
                if (k > 0) b.append(",");
                b.append(quote(ks.get(k))).append(":").append(canon(((Map<?, ?>) v).get(ks.get(k)), seen));
            }
            return b.append("}").toString();
        }
        if (v.getClass().isArray()) {
            int n = Array.getLength(v);
            StringBuilder b = new StringBuilder("[");
            for (int k = 0; k < n; k++) {
                if (k > 0) b.append(",");
                b.append(canon(Array.get(v, k), seen));
            }
            return b.append("]").toString();
        }
        if (v instanceof Collection) {
            StringBuilder b = new StringBuilder("[");
            boolean first = true;
            for (Object x : (Collection<?>) v) {
                if (!first) b.append(",");
                first = false;
                b.append(canon(x, seen));
            }
            return b.append("]").toString();
        }
        if (seen.containsKey(v)) return quote("<cycle>");
        seen.put(v, Boolean.TRUE);
        String out;
        try {
            String t = treeSer(v);
            if (t != null) out = t;
            else {
                String l = listSer(v);
                out = (l != null) ? l : quote(String.valueOf(v));
            }
        } finally { seen.remove(v); }
        return out;
    }
    static String quote(String s) {
        StringBuilder b = new StringBuilder("\\"");
        for (int k = 0; k < s.length(); k++) {
            char c = s.charAt(k);
            if (c == '"') b.append("\\\\\\"");
            else if (c == '\\\\') b.append("\\\\\\\\");
            else if (c == '\\n') b.append("\\\\n");
            else if (c == '\\r') b.append("\\\\r");
            else if (c == '\\t') b.append("\\\\t");
            else if (c < 32) b.append(String.format("\\\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append("\\"").toString();
    }
    // linked node {val|data, next} -> JSON array
    static String listSer(Object v) {
        try {
            Field vf = valField(v.getClass());
            Field nf = nextField(v.getClass());
            if (vf == null || nf == null) return null;
            vf.setAccessible(true); nf.setAccessible(true);
            StringBuilder b = new StringBuilder("[");
            Object cur = v;
            boolean first = true;
            int guard = 0;
            while (cur != null && guard++ < 100000) {
                if (!first) b.append(",");
                first = false;
                b.append(canon(vf.get(cur)));
                cur = nf.get(cur);
            }
            return b.append("]").toString();
        } catch (Exception e) { return null; }
    }
    // binary tree {val, left, right} -> trimmed level order
    static String treeSer(Object v) {
        try {
            Field vf = valField(v.getClass());
            Field lf = namedField(v.getClass(), new String[]{"left", "l"});
            Field rf = namedField(v.getClass(), new String[]{"right", "r"});
            if (vf == null || lf == null || rf == null) return null;
            vf.setAccessible(true); lf.setAccessible(true); rf.setAccessible(true);
            List<Object> lvl = new ArrayList<>();
            lvl.add(v);
            List<String> vals = new ArrayList<>();
            int guard = 0;
            for (int k = 0; k < lvl.size() && guard++ < 100000; k++) {
                Object n = lvl.get(k);
                if (n == null) { vals.add("null"); continue; }
                vals.add(canon(vf.get(n)));
                lvl.add(lf.get(n)); lvl.add(rf.get(n));
            }
            while (!vals.isEmpty() && vals.get(vals.size() - 1).equals("null")) vals.remove(vals.size() - 1);
            return "[" + String.join(",", vals) + "]";
        } catch (Exception e) { return null; }
    }
    static Field valField(Class<?> c) {
        Field f = namedField(c, new String[]{"val", "data", "key", "x"});
        if (f != null) return f;
        for (Field x : c.getDeclaredFields()) {
            int m = x.getModifiers();
            if (Modifier.isStatic(m)) continue;
            Class<?> t = x.getType();
            if (t == int.class || t == Integer.class || t == long.class || t == Long.class
                    || t == String.class || t == char.class || t == Character.class) return x;
        }
        return null;
    }
    static Field nextField(Class<?> c) {
        Field f = namedField(c, new String[]{"next", "nxt"});
        if (f != null) return f;
        for (Field x : c.getDeclaredFields()) {
            int m = x.getModifiers();
            if (Modifier.isStatic(m)) continue;
            if (x.getType().isAssignableFrom(c) || c.isAssignableFrom(x.getType())) return x;
        }
        return null;
    }
    static Field namedField(Class<?> c, String[] names) {
        for (String n : names) {
            try {
                Field f = c.getDeclaredField(n);
                if (!Modifier.isStatic(f.getModifiers())) return f;
            } catch (Exception e) { /* next */ }
        }
        return null;
    }

    // ---------- JSON -> Java conversion
    static long numL(Object v) {
        if (v instanceof Number) return ((Number) v).longValue();
        return Long.parseLong(String.valueOf(v));
    }
    static Object toType(Class<?> t, Type g, Object v) throws Exception {
        if (v == null) return null;
        if (t == int.class || t == Integer.class) return (int) numL(v);
        if (t == long.class || t == Long.class) return numL(v);
        if (t == double.class || t == Double.class)
            return (v instanceof Number) ? ((Number) v).doubleValue() : Double.parseDouble(String.valueOf(v));
        if (t == float.class || t == Float.class)
            return (v instanceof Number) ? ((Number) v).floatValue() : Float.parseFloat(String.valueOf(v));
        if (t == boolean.class || t == Boolean.class)
            return (v instanceof Boolean) ? v : Boolean.parseBoolean(String.valueOf(v));
        if (t == char.class || t == Character.class) {
            String s = String.valueOf(v);
            if (s.length() == 1) return s.charAt(0);
            return (char) numL(v);
        }
        if (t == byte.class || t == Byte.class) return (byte) numL(v);
        if (t == short.class || t == Short.class) return (short) numL(v);
        if (t == String.class) return (v instanceof String) ? v : canon(v);
        if (t.isArray()) {
            Class<?> ct = t.getComponentType();
            List<?> l = (List<?>) v;
            Object a = Array.newInstance(ct, l.size());
            for (int k = 0; k < l.size(); k++) Array.set(a, k, toType(ct, null, l.get(k)));
            return a;
        }
        if (List.class.isAssignableFrom(t)) {
            Class<?> elem = null;
            if (g instanceof ParameterizedType) {
                Type[] at = ((ParameterizedType) g).getActualTypeArguments();
                if (at.length == 1 && at[0] instanceof Class) elem = (Class<?>) at[0];
            }
            List<Object> in = (List<Object>) v;
            List<Object> out = t == LinkedList.class ? new LinkedList<>() : new ArrayList<>();
            for (Object x : in) out.add(elem != null ? toType(elem, null, x) : numDefault(x));
            return out;
        }
        if (v instanceof List) {
            if (isTreeish(t)) return buildTree(t, (List<Object>) v);
            if (isListish(t)) return buildList(t, (List<Object>) v);
        }
        if (v instanceof Map && Map.class.isAssignableFrom(t)) return v;
        throw new IllegalArgumentException("cannot convert " + shortName(v) + " to " + t.getName());
    }
    static Object numDefault(Object x) {
        if (x instanceof Long) {
            long l = (Long) x;
            if (l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE) return (int) l;
        }
        return x;
    }
    static boolean isTreeish(Class<?> c) {
        return !c.isPrimitive() && !c.getName().startsWith("java.")
                && valField(c) != null && namedField(c, new String[]{"left", "l"}) != null
                && namedField(c, new String[]{"right", "r"}) != null;
    }
    static boolean isListish(Class<?> c) {
        return !c.isPrimitive() && !c.getName().startsWith("java.")
                && valField(c) != null && nextField(c) != null && !isTreeish(c);
    }
    static String shortName(Object v) {
        if (v == null) return "null";
        if (v instanceof List) return "list[" + ((List<?>) v).size() + "]";
        return v.getClass().getSimpleName() + ":" + String.valueOf(v);
    }
    static Object newNode(Class<?> c, Object valObj, Object nextObj) throws Exception {
        // prefer (value, next) ctor, then (value), then no-arg + fields
        for (Constructor<?> k : c.getDeclaredConstructors()) {
            Class<?>[] ps = k.getParameterTypes();
            if (ps.length == 2 && !ps[1].isPrimitive()) {
                k.setAccessible(true);
                try {
                    Object vv = toType(ps[0], null, valObj);
                    return k.newInstance(vv, nextObj);
                } catch (Exception e) { /* try next */ }
            }
        }
        for (Constructor<?> k : c.getDeclaredConstructors()) {
            Class<?>[] ps = k.getParameterTypes();
            if (ps.length == 1) {
                k.setAccessible(true);
                try {
                    return k.newInstance(toType(ps[0], null, valObj));
                } catch (Exception e) { /* try next */ }
            }
        }
        Object o;
        try {
            Constructor<?> k = c.getDeclaredConstructor();
            k.setAccessible(true);
            o = k.newInstance();
        } catch (Exception e) {
            throw new IllegalArgumentException("node class " + c.getSimpleName() + " needs a (value), (value,next), or no-arg constructor");
        }
        Field vf = valField(c);
        if (vf != null && valObj != null) {
            vf.setAccessible(true);
            vf.set(o, toType(vf.getType(), null, valObj));
        }
        return o;
    }
    static Object buildList(Class<?> c, List<Object> a) throws Exception {
        Field nf = nextField(c);
        if (nf == null) throw new IllegalArgumentException("no next field on " + c.getSimpleName());
        nf.setAccessible(true);
        Object head = null, tail = null;
        for (Object x : a) {
            Object node = newNode(c, x, null);
            if (head == null) head = node;
            else nf.set(tail, node);
            tail = node;
        }
        return head;
    }
    static Object buildTree(Class<?> c, List<Object> a) throws Exception {
        if (a.isEmpty()) return null;
        Field lf = namedField(c, new String[]{"left", "l"});
        Field rf = namedField(c, new String[]{"right", "r"});
        lf.setAccessible(true); rf.setAccessible(true);
        List<Object> nodes = new ArrayList<>();
        for (Object x : a) nodes.add(x == null ? null : newNode(c, x, null));
        for (int i = 0; i < nodes.size(); i++) {
            Object n = nodes.get(i);
            if (n == null) continue;
            int li = 2 * i + 1, ri = 2 * i + 2;
            if (li < nodes.size()) lf.set(n, nodes.get(li));
            if (ri < nodes.size()) rf.set(n, nodes.get(ri));
        }
        return nodes.get(0);
    }

    // ---------- method / ctor resolution
    static List<Method> publicMethods(Class<?> c) {
        List<Method> out = new ArrayList<>();
        for (Method m : c.getDeclaredMethods()) {
            int mod = m.getModifiers();
            if (Modifier.isPublic(mod) && !m.isSynthetic() && !m.isBridge()) out.add(m);
        }
        return out;
    }
    static Method findMethod(Object inst, String name) {
        Class<?> c = (inst instanceof Class) ? (Class<?>) inst : inst.getClass();
        try { return c.getMethod(name); } catch (Exception e) { /* fuzzy */ }
        String want = norm(name);
        for (Method m : c.getMethods()) {
            if (norm(m.getName()).equals(want)) return m;
        }
        return null;
    }
    static String opsKey(Map<?, ?> inputs) {
        for (Object k : inputs.keySet()) {
            if (OPS_KEYS.contains(norm(String.valueOf(k))) && inputs.get(k) instanceof List) return String.valueOf(k);
        }
        return null;
    }
    static boolean numLike(String s) {
        s = s.trim();
        if (s.isEmpty()) return false;
        int i = (s.charAt(0) == '-' || s.charAt(0) == '+') ? 1 : 0;
        boolean dot = false, dig = false;
        for (; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '0' && c <= '9') dig = true;
            else if (c == '.' && !dot) dot = true;
            else return false;
        }
        return dig;
    }
    static boolean canConvert(Class<?> t, Object v) {
        if (v == null) return !t.isPrimitive();
        if (t == int.class || t == Integer.class || t == long.class || t == Long.class
                || t == double.class || t == Double.class || t == float.class || t == Float.class
                || t == byte.class || t == Byte.class || t == short.class || t == Short.class)
            return (v instanceof Number) || (v instanceof String && numLike((String) v));
        if (t == boolean.class || t == Boolean.class)
            return (v instanceof Boolean) || (v instanceof String
                    && (((String) v).equalsIgnoreCase("true") || ((String) v).equalsIgnoreCase("false")));
        if (t == char.class || t == Character.class)
            return (v instanceof String && ((String) v).length() == 1) || (v instanceof Number);
        if (t == String.class)
            return (v instanceof String) || (v instanceof Number) || (v instanceof Boolean);
        if (t.isArray() || List.class.isAssignableFrom(t)) return (v instanceof List);
        if (Map.class.isAssignableFrom(t)) return (v instanceof Map);
        if (!t.isPrimitive() && !t.getName().startsWith("java.")) return (v instanceof List) || (v instanceof Map);
        return true;
    }
    // Unified binder: pass 1 name-match (needs -parameters), pass 2
    // type-compatible positional in declaration order, pass 3 len-fill.
    static Object[] bindTypes(Class<?>[] ts, Type[] gs, List<String> pns, Map<String, Object> inputs) throws Exception {
        Map<String, Object> rem = new LinkedHashMap<>(inputs);
        Object[] raw = new Object[ts.length];
        boolean[] has = new boolean[ts.length];
        for (int k = 0; k < ts.length; k++) {
            String pn = (pns != null && k < pns.size()) ? pns.get(k) : null;
            if (pn == null) continue;
            for (String key : new ArrayList<>(rem.keySet())) {
                if (norm(key).equals(norm(pn))) { raw[k] = rem.remove(key); has[k] = true; break; }
            }
        }
        List<Object> boundLists = new ArrayList<>();
        for (int k = 0; k < ts.length; k++) if (has[k]) {
            Object x = raw[k];
            if (x instanceof List || x instanceof String) boundLists.add(x);
        }
        int li = 0;
        for (int k = 0; k < ts.length; k++) {
            if (has[k]) continue;
            String hit = null;
            for (String key : rem.keySet()) {
                if (canConvert(ts[k], rem.get(key))) { hit = key; break; }
            }
            if (hit != null) { raw[k] = rem.remove(hit); has[k] = true; continue; }
            boolean integral = ts[k] == int.class || ts[k] == Integer.class || ts[k] == long.class || ts[k] == Long.class;
            if (integral && li < boundLists.size()) {
                Object bl = boundLists.get(li++);
                raw[k] = (long) (bl instanceof List ? ((List<?>) bl).size() : ((String) bl).length());
                has[k] = true;
            }
        }
        Object[] args = new Object[ts.length];
        for (int k = 0; k < ts.length; k++) {
            if (!has[k]) throw new IllegalArgumentException("missing argument for parameter " + k);
            args[k] = toType(ts[k], (gs != null && k < gs.length) ? gs[k] : null, raw[k]);
        }
        return args;
    }
    static List<String> paramNames(AccessibleObject ao, int n) {
        Parameter[] ps;
        try { ps = ((Executable) ao).getParameters(); } catch (Exception e) { ps = new Parameter[0]; }
        List<String> out = new ArrayList<>();
        for (int k = 0; k < n; k++) out.add(k < ps.length && ps[k].isNamePresent() ? ps[k].getName() : null);
        return out;
    }
    static Object[] bindArgs(Method m, Map<String, Object> inputs) throws Exception {
        return bindTypes(m.getParameterTypes(), m.getGenericParameterTypes(), paramNames(m, m.getParameterTypes().length), inputs);
    }
    static Object construct(Class<?> c, Map<String, Object> other) throws Exception {
        if (other.isEmpty()) {
            for (Constructor<?> k : c.getDeclaredConstructors()) {
                if (k.getParameterCount() == 0 && !Modifier.isPrivate(k.getModifiers())) {
                    k.setAccessible(true);
                    return k.newInstance();
                }
            }
        }
        List<Constructor<?>> cs = new ArrayList<>();
        for (Constructor<?> k : c.getDeclaredConstructors()) if (!Modifier.isPrivate(k.getModifiers())) cs.add(k);
        cs.sort((a, b) -> Integer.compare(b.getParameterCount(), a.getParameterCount()));
        Exception last = null;
        for (Constructor<?> k : cs) {
            try {
                Object[] args = bindTypes(k.getParameterTypes(), k.getGenericParameterTypes(),
                        paramNames(k, k.getParameterTypes().length), other);
                k.setAccessible(true);
                return k.newInstance(args);
            } catch (Exception e) { last = e; }
        }
        throw new IllegalArgumentException("no usable constructor on " + c.getSimpleName()
                + (last != null ? ": " + last.getMessage() : ""));
    }

    // ---------- models
    static List<Object> opsReplay(Class<?> c, List<Object> ops, Map<String, Object> other) throws Exception {
        Object inst = construct(c, other);
        List<Object> out = new ArrayList<>();
        for (Object o : ops) {
            List<?> op = (List<?>) o;
            String name = op.isEmpty() ? "" : String.valueOf(op.get(0));
            List<Object> rawArgs = op.size() > 1 ? new ArrayList<>(op.subList(1, op.size())) : new ArrayList<>();
            Method m = findMethod(inst, name);
            if (m == null) {
                if (rawArgs.isEmpty()) { out.add(null); continue; }
                throw new IllegalArgumentException("unknown operation: " + name);
            }
            Class<?>[] ts = m.getParameterTypes();
            Object[] args = new Object[ts.length];
            for (int k = 0; k < ts.length; k++) args[k] = toType(ts[k], null, k < rawArgs.size() ? rawArgs.get(k) : null);
            Object r = m.invoke(Modifier.isStatic(m.getModifiers()) ? null : inst, args);
            out.add(m.getReturnType() == void.class ? null : r);
        }
        return out;
    }
    static boolean listsMatch(Object actual, Object exp) {
        if (canon(actual).equals(canon(exp))) return true;
        if (exp instanceof List) {
            boolean noNulls = true;
            for (Object e : (List<?>) exp) if (e == null) { noNulls = false; break; }
            if (noNulls && actual instanceof List) {
                List<Object> compact = new ArrayList<>();
                for (Object x : (List<?>) actual) if (x != null) compact.add(x);
                return canon(compact).equals(canon(exp));
            }
        }
        return false;
    }
    static List<Object> ctorRepeat(Class<?> c, Map<String, Object> inputs) throws Exception {
        List<Method> methods = publicMethods(c);
        if (methods.size() != 1) throw new IllegalArgumentException("constructor-repeat needs exactly one public method");
        Constructor<?>[] ks = c.getDeclaredConstructors();
        Constructor<?> init = null;
        for (Constructor<?> k : ks) {
            if (Modifier.isPrivate(k.getModifiers())) continue;
            if (init == null || k.getParameterCount() > init.getParameterCount()) init = k;
        }
        if (init == null) throw new IllegalArgumentException("no public constructor");
        Class<?>[] ts = init.getParameterTypes();
        Type[] gs = init.getGenericParameterTypes();
        List<String> pns = paramNames(init, ts.length);
        Map<String, Object> rem = new LinkedHashMap<>(inputs);
        Set<String> consumed = new HashSet<>();
        Object[] raw = new Object[ts.length];
        boolean[] bhas = new boolean[ts.length];
        for (int k = 0; k < ts.length; k++) {
            String pn = pns.get(k);
            if (pn == null) continue;
            for (String key : new ArrayList<>(rem.keySet())) {
                if (norm(key).equals(norm(pn))) { raw[k] = rem.remove(key); consumed.add(key); bhas[k] = true; break; }
            }
        }
        for (int k = 0; k < ts.length; k++) {
            if (bhas[k]) continue;
            String hit = null;
            for (String key : rem.keySet()) {
                if (canConvert(ts[k], rem.get(key))) { hit = key; break; }
            }
            if (hit == null) throw new IllegalArgumentException("missing constructor arg " + k);
            consumed.add(hit);
            raw[k] = rem.remove(hit);
            bhas[k] = true;
        }
        Object[] args = new Object[ts.length];
        for (int k = 0; k < ts.length; k++) args[k] = toType(ts[k], k < gs.length ? gs[k] : null, raw[k]);
        init.setAccessible(true);
        Object inst = init.newInstance(args);
        String leftover = null;
        for (String key : inputs.keySet()) {
            if (!consumed.contains(key) && inputs.get(key) instanceof List) {
                if (leftover != null) throw new IllegalArgumentException("constructor-repeat needs exactly one leftover list");
                leftover = key;
            }
        }
        if (leftover == null) throw new IllegalArgumentException("constructor-repeat needs exactly one leftover list");
        Method m = methods.get(0);
        List<Object> out = new ArrayList<>();
        for (Object x : (List<?>) inputs.get(leftover)) {
            Object r = m.invoke(inst, toType(m.getParameterTypes()[0], null, x));
            out.add(r);
        }
        return out;
    }

    // ---------- entry
    static String esc(String s) {
        return quote(s);
    }
    // Entrypoint class: prefer Solution, else the classes found in user code.
    static Class<?> resolveCls() {
        try { return Class.forName("Solution"); } catch (Exception e) { /* fall through */ }
        try {
            Object parsed = __BdJson.parse(b64dec("__CLS_HINT__"));
            if (parsed instanceof List) for (Object n : (List<?>) parsed) {
                try { return Class.forName(String.valueOf(n)); } catch (Exception e2) { /* next */ }
            }
        } catch (Exception e) { /* none */ }
        return null;
    }
    @SuppressWarnings("unchecked")
    static String runAll(String testsJson) {
        Object parsed = __BdJson.parse(testsJson);
        List<Object> tests = (List<Object>) parsed;
        Class<?> cls = resolveCls();
        StringBuilder out = new StringBuilder("{\\"results\\":[");
        boolean first = true;
        PrintStream realOut = System.out;
        PrintStream realErr = System.err;
        for (Object t : tests) {
            Map<String, Object> tc = (Map<String, Object>) t;
            Object rawIn = tc.get("input");
            Object exp = tc.get("expected");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            PrintStream ps = new PrintStream(buf, true);
            System.setOut(ps);
            System.setErr(ps);
            long t0 = System.nanoTime();
            Object actual = null;
            boolean passed = false;
            boolean threw = false;
            try {
                Map<String, Object> inMap = (rawIn instanceof Map) ? (Map<String, Object>) rawIn : null;
                String opKey = (inMap != null) ? opsKey(inMap) : null;
                if (opKey != null && cls != null) {
                    Map<String, Object> other = new LinkedHashMap<>(inMap);
                    Object ops = other.remove(opKey);
                    actual = opsReplay(cls, (List<Object>) ops, other);
                    passed = listsMatch(actual, exp);
                } else if (cls != null && needsCtor(cls)) {
                    actual = ctorRepeat(cls, inMap);
                    passed = (actual instanceof List) ? listsMatch(actual, exp) : canon(actual).equals(canon(exp));
                } else {
                    Method target = null;
                    Object[] callArgs = null;
                    if (cls != null) {
                        List<Method> ms = publicMethods(cls);
                        if (ms.size() == 1) {
                            target = ms.get(0);
                        } else if (!ms.isEmpty()) {
                            int arity = (inMap != null) ? inMap.size() : 1;
                            for (Method m : ms) if (m.getParameterCount() == arity) { target = m; break; }
                            if (target == null) target = ms.get(0);
                        }
                    }
                    if (target == null) throw new IllegalArgumentException("No callable found: define a Solution class with a method.");
                    Object inst = Modifier.isStatic(target.getModifiers()) ? null : construct(cls, new LinkedHashMap<>());
                    callArgs = bindArgs(target, inMap != null ? inMap : new LinkedHashMap<>());
                    actual = target.invoke(inst, callArgs);
                    if (actual instanceof List && exp instanceof List) passed = listsMatch(actual, exp);
                    else passed = canon(actual).equals(canon(exp));
                }
            } catch (Exception e) {
                threw = true;
                Throwable cause = (e instanceof InvocationTargetException) ? e.getCause() : e;
                ps.println(cause == null ? String.valueOf(e) : String.valueOf(cause).split("\\n")[0]);
            } finally {
                System.setOut(realOut);
                System.setErr(realErr);
            }
            double ms = (System.nanoTime() - t0) / 1e6;
            if (!first) out.append(",");
            first = false;
            out.append("{\\"id\\":").append(esc(String.valueOf(tc.get("id"))));
            out.append(",\\"input\\":").append(canon(rawIn));
            out.append(",\\"expected\\":").append(canon(exp));
            out.append(",\\"actual\\":").append(threw ? "null" : canon(actual));
            out.append(",\\"passed\\":").append(passed && !threw);
            String so;
            try { so = buf.toString("UTF-8"); } catch (Exception e) { so = ""; }
            out.append(",\\"stdout\\":").append(esc(so));
            out.append(",\\"runtimeMs\\":").append(String.format(java.util.Locale.US, "%.2f", ms));
            out.append("}");
        }
        out.append("]}");
        return out.toString();
    }
    static boolean needsCtor(Class<?> c) {
        for (Constructor<?> k : c.getDeclaredConstructors()) {
            if (!Modifier.isPrivate(k.getModifiers()) && k.getParameterCount() > 0) return true;
        }
        return false;
    }
}

class prog {
    public static void main(String[] a) throws Exception {
        String tests = __Bd.b64dec("__TESTS_B64__");
        System.out.print("__BD_BEGIN__" + __Bd.runAll(tests));
    }
}
`

export function buildJavaSource(userCode, testsB64) {
  const clean = String(userCode ?? '')
    .replace(/^package\s+[\w.]+;/gm, '')
    .replace(/^public\s+(class|interface|enum|record)\s/gm, '$1 ')
  // imports must precede all type declarations — hoist the user's to the top
  const imports = []
  const body = clean.split('\n').filter((line) => {
    if (/^\s*import\s+(static\s+)?[\w.*]+;/.test(line)) { imports.push(line.trim()); return false }
    return true
  }).join('\n')
  const seen = new Set()
  const names = []
  const re = /(^|\n)\s*(?:public\s+)?(?:final\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re.exec(clean)) !== null) {
    if (['__BdJson', '__Bd', 'prog'].includes(m[2]) || seen.has(m[2])) continue
    seen.add(m[2])
    names.push(m[2])
  }
  names.sort((a, b) => (a === 'Solution' ? -1 : b === 'Solution' ? 1 : 0))
  const hintB64 = typeof btoa === 'function'
    ? btoa(JSON.stringify(names))
    : Buffer.from(JSON.stringify(names)).toString('base64')
  const uniqImports = [...new Set(imports)]
  const head = uniqImports.length ? uniqImports.join('\n') + '\n' : ''
  return head + DRIVER.replace('__TESTS_B64__', testsB64).replace('__CLS_HINT__', hintB64) + '\n' + body
}
