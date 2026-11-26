// Admin editing layer: spreadsheet-style values, remarks and formulas on any cell.
//
// Every record keeps its imported values; admin edits are stored separately as
//   { "<sheet!row>": { field: "raw text", ... } }
// A raw value that starts with "=" is a formula, evaluated like a Google-Sheet cell:
//   =tand/K(temp)           fields of the same row, K() = temperature-correction factor
//   =tand20-prev.tand20     prev.<field> = previous completed test of the same element
//   =ROUND((C-prev.C)/prev.C*100, 2)
// Functions: SUM, AVERAGE, MIN, MAX, ROUND, ABS, SQRT, IF, K.  Operators: + - * / ^ ( ) and
// comparisons < > <= >= = <>.  Derived columns carry DEFAULT formulas, so editing a reading
// recalculates its dependants exactly as the sheet would.
// Storage is the browser (localStorage) until the database is connected; edits can be
// exported / imported as JSON and committed or loaded into the DB later.

const KEY_EDITS = 'ehv-edits-v1', KEY_NEW = 'ehv-new-v1', KEY_PIN = 'ehv-admin-pin', KEY_TGT = 'ehv-targets-v1';
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

export const ELEM = {   // what one monitored element is, per test
  ct: r => `${r.unit}|${r.ph}`, cb_crm: r => `${r.unit}|${r.ph}`, cb_timing: r => `${r.unit}|${r.ph}`, la: r => `${r.unit}|${r.ph}`,
  bushing: r => `${r.unit}|${r.ph}|${r.pos}`, winding: r => `${r.unit}|${r.ph}|${r.acting}`,
  dga: r => `${r.unit}|${r.ph}|${r.pos === 'OLTC' ? 'OLTC' : 'Main tank'}`,   // top & bottom samples = one tank
};
export const DEFAULT_F = {
  bushing: { tand20: '=tand/K(temp)', dTand: '=tand20-prev.tand20', dC: '=(C-prev.C)/prev.C*100' },
  winding: { tand20: '=tand/K(temp)', dTand: '=tand20-prev.tand20', dC: '=(C-prev.C)/prev.C*100' },
  ct: { tand20: '=tand/K(temp)', dTand: '=tand20-prev.tand20', dC: '=(C-prev.C)/prev.C*100' },
  dga: { TDCG: '=H2+CH4+C2H2+C2H4+C2H6+CO' },
  cb_crm: { mV: '=R*I/1000' },
};

// ------------------------------------------------------------------ formula engine
function tokenize(src) {
  const t = [], re = /\s*(\d+\.?\d*(?:[eE][-+]?\d+)?|[A-Za-z_][\w.]*|<=|>=|<>|[-+*/^(),<>=])/y;
  let m, i = 0;
  while (i < src.length) { re.lastIndex = i; m = re.exec(src); if (!m) throw new Error('bad token at ' + i); t.push(m[1]); i = re.lastIndex; while (src[i] === ' ') i++; }
  return t;
}
export function evaluate(expr, ctx) {
  const tk = tokenize(expr.replace(/^=/, '')); let p = 0;
  const peek = () => tk[p], next = () => tk[p++];
  const need = (x) => { if (next() !== x) throw new Error('expected ' + x); };
  const F = {
    SUM: (...a) => a.flat().reduce((s, x) => s + (+x || 0), 0), AVERAGE: (...a) => { a = a.flat().filter(x => x != null); return a.reduce((s, x) => s + x, 0) / a.length; },
    MIN: (...a) => Math.min(...a.flat()), MAX: (...a) => Math.max(...a.flat()), ROUND: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n,
    ABS: Math.abs, SQRT: Math.sqrt, IF: (c, a, b) => (c ? a : b), K: (t) => ctx.K(t),
  };
  const val = (id) => {
    const lo = id.toLowerCase();
    if (lo.startsWith('prev.')) { const f = id.slice(5); const v = ctx.prev ? pick(ctx.prev, f) : null; if (v == null) throw new Error('no previous value'); return v; }
    const v = pick(ctx.row, id); if (v == null) throw new Error(`${id} is empty`); return v;
  };
  const pick = (o, f) => { if (f in o) return o[f]; const k = Object.keys(o).find(k => k.toLowerCase() === f.toLowerCase()); return k ? o[k] : null; };
  function primary() {
    const x = next();
    if (x === '(') { const v = cmp(); need(')'); return v; }
    if (x === '-') return -primary();
    if (x === '+') return primary();
    if (/^\d/.test(x)) return parseFloat(x);
    if (/^[A-Za-z_]/.test(x)) {
      if (peek() === '(') { next(); const args = []; if (peek() !== ')') { args.push(cmp()); while (peek() === ',') { next(); args.push(cmp()); } } need(')'); const f = F[x.toUpperCase()]; if (!f) throw new Error('unknown function ' + x); return f(...args); }
      if (/^(true|false)$/i.test(x)) return /^true$/i.test(x);
      return val(x);
    }
    throw new Error('unexpected ' + x);
  }
  function pow() { let a = primary(); while (peek() === '^') { next(); a = a ** primary(); } return a; }
  function mul() { let a = pow(); while (peek() === '*' || peek() === '/') { const o = next(), b = pow(); a = o === '*' ? a * b : a / b; } return a; }
  function add() { let a = mul(); while (peek() === '+' || peek() === '-') { const o = next(), b = mul(); a = o === '+' ? a + b : a - b; } return a; }
  function cmp() { let a = add(); while (['<', '>', '<=', '>=', '=', '<>'].includes(peek())) { const o = next(), b = add(); a = { '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b, '=': a === b, '<>': a !== b }[o]; } return a; }
  const out = cmp(); if (p < tk.length) throw new Error('unexpected ' + tk[p]); return out;
}

// ------------------------------------------------------------------ store
export const edits = () => ls.get(KEY_EDITS, {});
export const newRows = () => ls.get(KEY_NEW, []);
export function setCell(src, field, raw) {
  const e = edits(); e[src] = e[src] || {};
  if (raw === null) delete e[src][field]; else e[src][field] = { raw: String(raw), at: new Date().toISOString() };
  if (!Object.keys(e[src]).length) delete e[src];
  ls.set(KEY_EDITS, e);
}
export function addRow(rec) { const n = newRows(); rec.src = `new!${Date.now()}`; rec.added = new Date().toISOString(); n.push(rec); ls.set(KEY_NEW, n); return rec.src; }
export function deleteNewRow(src) { ls.set(KEY_NEW, newRows().filter(r => r.src !== src)); const e = edits(); delete e[src]; ls.set(KEY_EDITS, e); }
export function exportEdits() { return JSON.stringify({ exported: new Date().toISOString(), edits: edits(), newRows: newRows(), targets: ls.get(KEY_TGT, {}) }, null, 1); }
export function importEdits(json) { const d = JSON.parse(json); if (d.edits) ls.set(KEY_EDITS, d.edits); if (d.newRows) ls.set(KEY_NEW, d.newRows); if (d.targets) ls.set(KEY_TGT, d.targets); }
export function resetEdits() { ls.set(KEY_EDITS, {}); ls.set(KEY_NEW, []); }
export const editCount = () => Object.values(edits()).reduce((a, o) => a + Object.keys(o).length, 0) + newRows().length;

// annual target overrides: key `${t}|${fy}|${unit}` → number ; `${t}|${fy}|*` = total
export const targets = () => ls.get(KEY_TGT, {});
export function setTarget(k, n) { const t = targets(); if (n === null || n === '') delete t[k]; else t[k] = Number(n); ls.set(KEY_TGT, t); }

// view settings decided by the admin (graphs on/off, blank bays shown / hidden)
const KEY_VIEW = 'ehv-view-v1', KEY_COD = 'ehv-cod-v1';
export const viewPref = (k) => ({ graphs: true, blank: true, history: true, text: 0, show5: false, ...ls.get(KEY_VIEW, {}) })[k];
export function setViewPref(k, v) { const p = ls.get(KEY_VIEW, {}); p[k] = v; ls.set(KEY_VIEW, p); }
// commissioning date of a bay / unit (admin may correct it; default = unit record or substation)
export const codOverrides = () => ls.get(KEY_COD, {});
export function setCod(u, iso) { const c = codOverrides(); if (!iso) delete c[u]; else c[u] = iso; ls.set(KEY_COD, c); }

// admin mode (client-side PIN; real sign-in arrives with the database)
let ADMIN = false;
export const isAdmin = () => ADMIN;
const h = (s) => { let x = 5381; for (const c of s) x = (x * 33) ^ c.charCodeAt(0); return (x >>> 0).toString(36); };
export function toggleAdmin() {
  if (ADMIN) { ADMIN = false; return false; }
  const saved = ls.get(KEY_PIN, null);
  if (!saved) { const p = prompt('Set an admin PIN for this browser (min 4 characters):'); if (!p || p.length < 4) return false; ls.set(KEY_PIN, h(p)); ADMIN = true; return true; }
  const p = prompt('Admin PIN:'); if (p && h(p) === saved) { ADMIN = true; return true; }
  if (p) alert('Wrong PIN'); return false;
}

// ------------------------------------------------------------------ apply + recompute
export function makeK(table) {
  const T = table.map(([t, k]) => [Number(t), Number(k)]).sort((a, b) => a[0] - b[0]);
  return (temp) => {
    if (temp == null) throw new Error('temp is empty');
    const r = Math.round(temp), hit = T.find(x => x[0] === r); if (hit) return hit[1];
    const lo = [...T].reverse().find(x => x[0] < r), hi = T.find(x => x[0] > r);   // gap in table → interpolate
    if (!lo || !hi) throw new Error('no K for ' + temp + ' °C');
    return lo[1] + (hi[1] - lo[1]) * (r - lo[0]) / (hi[0] - lo[0]);
  };
}

/** Apply admin edits / new rows to records and recompute every derived cell (in place). */
export function recompute(records, kTable, isDone) {
  const K = makeK(kTable), E = edits();
  // base values: imported, then non-formula edits
  for (const r of records) {
    if (!r.v0) { r.v0 = { ...r.v }; r.rem0 = r.rem; r.date0 = r.date; }
    r.v = { ...r.v0 }; r.rem = r.rem0; r.date = r.date0; r.f = {}; r.err = {}; r.edited = {};
    const e = E[r.src] || {};
    for (const [k, o] of Object.entries(e)) {
      r.edited[k] = o;
      if (k === 'rem') { r.rem = o.raw; continue; }
      if (k === 'date') { r.date = o.raw; continue; }
      if (o.raw.startsWith('=')) { r.f[k] = o.raw; continue; }
      const n = parseFloat(o.raw); r.v[k] = o.raw === '' ? null : (Number.isNaN(n) ? null : n);
      if (Number.isNaN(n) && o.raw !== '') { r.rem = (r.rem ? r.rem + '; ' : '') + o.raw; }
    }
  }
  // formulas, element by element in date order (prev = previous completed test of the element)
  const by = new Map();
  for (const r of records) { const k = r.t + '#' + ELEM[r.t](r); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  for (const list of by.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    let prev = null;
    for (const r of list) {
      // dependency order, like a spreadsheet: edited input cells first, then derived columns
      const D = DEFAULT_F[r.t] || {};
      const userInputs = Object.entries(r.f).filter(([k]) => !(k in D));
      const derived = Object.keys(D).map(k => [k, r.f[k] || D[k]]);
      for (const [k, f] of [...userInputs, ...derived]) {
        if (r.edited[k] && !r.edited[k].raw.startsWith('=')) continue;      // typed value wins over default formula
        try { const v = evaluate(f, { row: r.v, prev: prev && prev.v, K }); r.v[k] = typeof v === 'number' && isFinite(v) ? +v.toFixed(6) : null; }
        catch (e) { r.v[k] = null; if (r.f[k] || !/empty|previous/.test(e.message)) r.err[k] = e.message; }
        r.f[k] = f;
      }
      if (isDone(r)) prev = r;
    }
  }
  return records;
}
