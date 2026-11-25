// Data layer. Today it reads static JSON; later swap `source` for a DB adapter
// (e.g. Supabase) that returns the same shapes: {substation, bays, units, records, issues}.

export const BUILD = '20261125.1527';  // set by tools/stamp_version.py

const JSON_SOURCE = {
  async load() {
    const get = (p) => fetch(`${p}?v=${BUILD}`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    const [site, norms, standards] = await Promise.all([get('data/karjat.json'), get('data/norms.json'), get('data/standards.json')]);
    return { site, norms, standards };
  }
};

export const TESTS = {
  bushing:   { key: 'bushing',   name: 'Bushing C & Tan δ',      short: 'Bushing tan δ', sr: 1,  eq: 'Transformers & reactors', icon: '◉' },
  winding:   { key: 'winding',   name: 'Winding C & Tan δ',      short: 'Winding tan δ', sr: 3,  eq: 'Transformers & reactors', icon: '◎' },
  dga:       { key: 'dga',       name: 'DGA & oil quality',       short: 'DGA',           sr: 8,  eq: 'Transformers & reactors', icon: '⚗' },
  ct:        { key: 'ct',        name: 'CT C & Tan δ',            short: 'CT tan δ',      sr: 18, eq: 'Current transformers',    icon: '⊙' },
  cb_crm:    { key: 'cb_crm',    name: 'CB contact resistance',   short: 'CB CRM',        sr: 24, eq: 'Circuit breakers',        icon: 'Ω' },
  cb_timing: { key: 'cb_timing', name: 'CB operating time',       short: 'CB timing',     sr: 26, eq: 'Circuit breakers',        icon: '⏱' },
  la:        { key: 'la',        name: 'LA leakage current',      short: 'LA LCM',        sr: 17, eq: 'Lightning arresters',     icon: '↯' },
};

// A record counts as a completed test only if its key measurement is present
// (a row with a date but "Rain! couldn't be tested" / "Crm taken" is not a completed test).
export const KEY = { bushing: ['tand', 'C'], winding: ['tand', 'C'], ct: ['tand', 'C'], cb_crm: ['R'], cb_timing: ['open1', 'open2', 'close'], la: ['Icorr', 'Ith', 'Itotal'], dga: ['H2', 'CH4', 'CO', 'C2H2'] };
export const done = (r) => (KEY[r.t] || []).some(k => r.v[k] != null);

export const DB = { site: null, norms: null, standards: null, today: new Date() };

export async function loadAll(source = JSON_SOURCE) {
  const d = await source.load();
  Object.assign(DB, d);
  DB.records = d.site.records.map((r, i) => ({ ...r, id: i }));
  DB.normsBySr = Object.fromEntries(d.norms.rows.map(r => [r.sr, r]));
  return DB;
}

export const isTF = (u) => /^(ICT1|ICT2|SPARE_ICT|BUS_REACTOR)$/.test(u);
export const kvOf = (u) => isTF(u) ? 400 : (String(u).startsWith('2') ? 220 : 400);

export function unitName(u, long = false) {
  if (isTF(u)) return DB.site.units[u]?.name || u;
  const n = DB.site.bays[u];
  if (!long) return `Bay ${u}`;
  return n ? `Bay ${u} · ${n}` : `Bay ${u}`;
}
export function bayTitle(u) { return DB.site.bays[u] || ''; }

export function recs(t, f = {}) {
  return DB.records.filter(r => r.t === t &&
    (f.unit == null || r.unit === f.unit) && (f.pos == null || r.pos === f.pos) &&
    (f.ph == null || r.ph === f.ph));
}

export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

export const toDate = (s) => new Date(s + 'T00:00:00');
export const years = (a, b) => (toDate(b) - toDate(a)) / (365.25 * 864e5);
export function addMonths(iso, m) { const d = toDate(iso); d.setMonth(d.getMonth() + m); return d; }
export function fmtDate(x) {
  const d = typeof x === 'string' ? toDate(x) : x;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmt(v, dp = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && a < 0.01) return v.toExponential(1);
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

// Units that carry each test (for navigation)
export function unitsFor(t) {
  return [...new Set(DB.records.filter(r => r.t === t).map(r => r.unit))].sort(sortUnits);
}
export function sortUnits(a, b) {
  const o = { ICT1: 1, ICT2: 2, SPARE_ICT: 3, BUS_REACTOR: 4 };
  if (o[a] || o[b]) return (o[a] || 99) - (o[b] || 99);
  return Number(a) - Number(b);
}
export function testsForUnit(u) {
  return Object.keys(TESTS).filter(t => DB.records.some(r => r.t === t && r.unit === u));
}
