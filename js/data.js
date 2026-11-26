// Data layer. Today it reads static JSON; later swap `source` for a DB adapter
// (e.g. Supabase) that returns the same shapes: {substation, bays, units, records, issues}.

import { recompute, newRows, ELEM, codOverrides } from './edit.js?v=20261126.1914';
export { ELEM };

export const BUILD = '20261126.1914';  // set by tools/stamp_version.py

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
export const done = (r) => !r.excluded && (KEY[r.t] || []).some(k => r.v[k] != null);

export const DB = { site: null, norms: null, standards: null, today: new Date() };

export async function loadAll(source = JSON_SOURCE) {
  const d = await source.load();
  Object.assign(DB, d);
  refresh();
  DB.normsBySr = Object.fromEntries(d.norms.rows.map(r => [r.sr, r]));
  return DB;
}

/** Re-apply admin edits and recompute derived cells (call after any edit). */
// Test voltage of tan δ / capacitance results: 10 kV is the default (every judgement, schedule and
// target uses it); 5 kV results are stored too and shown when the 5 kV view is chosen.
export const TANT = ['ct', 'bushing', 'winding'];
export const tvOf = (r) => TANT.includes(r.t) ? (r.tv || 10) : 10;
export const VIEW = { tv: 10 };
export function refresh() {
  const all = DB.site.records.map((r, i) => ({ ...r, id: i }));
  for (const n of newRows()) all.push({ ...n, id: all.length });
  const r10 = all.filter(r => tvOf(r) === 10), r5 = all.filter(r => tvOf(r) === 5);
  recompute(r10, DB.site.tempCorrection, done);          // previous-test chains stay within one test voltage
  recompute(r5, DB.site.tempCorrection, done);
  DB.all = all; DB.r10 = r10; DB.r5 = r5; DB.byId = new Map(all.map(r => [r.id, r]));
  DB.records = VIEW.tv === 5 ? [...r10.filter(r => !TANT.includes(r.t)), ...r5] : r10;
}
/** Switch the tan δ results shown between 10 kV (default) and 5 kV. */
export function setTestVoltage(v) { VIEW.tv = v === 5 ? 5 : 10; DB.records = VIEW.tv === 5 ? [...DB.r10.filter(r => !TANT.includes(r.t)), ...DB.r5] : DB.r10; }

/** Equipment population per test: elements present in the sheet's blocks or in the data,
 *  restricted to bays in the register and excluding future bays. */
export function population(t) {
  const set = new Map();
  const add = (u, sub) => { if (!isTF(u) && (!DB.site.bays[u] || /FUTURE/i.test(DB.site.bays[u]))) return; set.set(u + '|' + sub, [u, sub]); };
  for (const [u, ph] of (DB.site.population?.[t] || [])) add(String(u), ph);
  for (const r of DB.records.filter(r => r.t === t)) add(r.unit, ELEM[t](r).split('|').slice(1).join('|'));
  return [...set.values()];
}

export const isTF = (u) => /^(ICT1|ICT2|SPARE_ICT|BUS_REACTOR)$/.test(u);
export const kvOf = (u) => isTF(u) ? 400 : (String(u).startsWith('2') ? 220 : 400);

// Equipment names as used on site: "501 MVA, 400/220/33 kV ICT 1", "400 kV Karjat - Girawali Ckt 1".
const TFNAME = { ICT1: '501 MVA, 400/220/33 kV ICT 1', ICT2: '501 MVA, 400/220/33 kV ICT 2', SPARE_ICT: '167 MVA, 400/220/33 kV Spare ICT', BUS_REACTOR: '125 MVAr, 400 kV Bus Reactor' };
const UPPER = new Set(['MVA', 'ICT', 'TBC', 'IV', 'HV', 'LV', 'CT', 'CB', 'LA', 'OLTC']);
/** Sheet bay title in proper case: "400 kV KARJAT - GIRAWALI CKT 1" → "400 kV Karjat - Girawali Ckt 1". */
export function prettyBay(s) {
  return String(s || '').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s{2,}/g, ' ').trim().split(' ').map(w => {
    const core = w.replace(/[()]/g, ''), up = core.toUpperCase();
    if (!core) return w;
    if (/^\d/.test(core)) return w.replace(/kv$/i, 'kV');
    if (up === 'KV') return w.replace(core, 'kV');
    if (up === 'MVAR') return w.replace(core, 'MVAr');
    if (UPPER.has(up)) return w.replace(core, up);
    if (up === 'CKT') return w.replace(core, 'Ckt');
    return w.replace(core, core[0].toUpperCase() + core.slice(1).toLowerCase());
  }).join(' ');
}
export const bayRaw = (u) => DB.site.bays[u] || '';
// names that the sheet still carries as "future": the planned ICT 3 and the two Pune East circuits
const BAYNAME = {
  '409': '400/220 kV 501 MVA ICT 3 HV (proposed)', '202': '220 kV ICT 3 IV (proposed)',
  '412': '400 kV Karjat - Pune East Ckt 1 (proposed)', '415': '400 kV Karjat - Pune East Ckt 2 (proposed)',
  '408': '400 kV Tie Bay 3 (Girawali 2 - ICT 3)', '411': '400 kV Tie Bay 4 (Lonikand 1 - Pune East 1)', '414': '400 kV Tie Bay 5 (Lonikand 2 - Pune East 2)',
  '400': '400 kV Spare ICT bay (167 MVA, 1-ph)', '200': '220 kV Spare ICT IV',
};
/** Bay name without the number: "400 kV Karjat - Girawali Ckt 1". */
export const bayLabel = (u) => BAYNAME[u] || prettyBay(DB.site.bays[u]) || '';
/** The one name used everywhere: transformers by rating, bays as "Bay 404 - 400 kV Karjat - Girawali Ckt 1". */
export function unitName(u) {
  if (isTF(u)) return TFNAME[u] || DB.site.units[u]?.name || u;
  const n = bayLabel(u);
  return n ? `Bay ${u} - ${n}` : `Bay ${u}`;
}
/** Kept for callers that used to add the bay number beside the name; the number is now part of unitName. */
export function bayTitle(u) { return ''; }

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
/** Commissioning date of a bay / unit: admin correction, else the unit record, else the substation's first commissioning. */
export function codOf(u) {
  const o = codOverrides()[u]; if (o) return o;
  if (DB.site.units[u]?.commissioned) return DB.site.units[u].commissioned;
  return Object.values(DB.site.units).map(x => x.commissioned).filter(Boolean).sort()[0] || null;
}
export function fmtDate(x) {
  if (!x) return '—';
  const d = typeof x === 'string' ? toDate(x) : x;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmt(v, dp = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && a < 0.0005) return v.toExponential(1);
  if (a !== 0 && a < 0.01) return Number(v).toFixed(Math.max(3, Math.min(dp, 4)));
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

// Units that carry each test (for navigation)
export function unitsFor(t) {
  return [...new Set(DB.records.filter(r => r.t === t).map(r => r.unit))].sort(sortUnits);
}
/** Order of equipment everywhere: highest voltage first (400 kV transformers / reactor and 400 kV bays),
 *  then 220 kV, then lower voltage levels; within a level by unit / bay number. */
export function sortUnits(a, b) {
  const o = { ICT1: 1, ICT2: 2, SPARE_ICT: 3, BUS_REACTOR: 4 };
  const kv = (u) => o[u] ? 1000 : kvOf(u);
  return (kv(b) - kv(a)) || ((o[a] || 0) - (o[b] || 0)) || (Number(a) - Number(b)) || String(a).localeCompare(String(b));
}
export function testsForUnit(u) {
  return Object.keys(TESTS).filter(t => DB.records.some(r => r.t === t && r.unit === u));
}
