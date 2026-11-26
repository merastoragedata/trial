// Test-page sections: FY cards, parameter ranking, yearly progress, sequence-wise
// results (all-time + latest) with colour rules and historic graphs, element / bay
// pop-ups, norms drawer and admin cell editing.
import { DB, TESTS, recs, groupBy, unitName, bayTitle, kvOf, isTF, fmt, fmtDate, sortUnits, done, years, addMonths, toDate, population, refresh, ELEM, codOf, VIEW, setTestVoltage, TANT } from './data.js?v=20261126.1456';
import { LIM, SEV, SEV_LABEL, statusOf, laWindow, oltcCorrelation, shortUnit, intervalMonths, dueFrom, codDue, elemDue, lastRowDate, schedule } from './rules.js?v=20261126.1456';
import { esc, chem, pill, phase, $, $$, lineChart, bandsFrom, PHASE_COLOR, circularBtn, modal, avgRefs, niceStep, trendLine } from './ui.js?v=20261126.1456';
import { isAdmin, toggleAdmin, setCell, addRow, deleteNewRow, targets, setTarget, viewPref, setViewPref, setCod } from './edit.js?v=20261126.1456';
import { art } from './art.js?v=20261126.1456';
import { nameplateSection, wireNameplates } from './nameplate.js?v=20261126.1456';
import { dgaAnalysis } from './dga.js?v=20261126.1456';
import { shareButtons, wireShare } from './report.js?v=20261126.1456';
import { IC } from './icons.js?v=20261126.1456';

let CTX = {};                     // callbacks from app.js: rerun(), rerender(), clauseCard(), standardsCard()
export const bindResults = (c) => { CTX = c; };

// ------------------------------------------------------------------ vocabulary
export const NOUN = {
  ct: ['CT', 'CTs'], bushing: ['bushing', 'bushings'], winding: ['winding insulation', 'winding insulations'], dga: ['oil sampling point', 'oil sampling points'],
  cb_crm: ['CB pole', 'CB poles'], cb_timing: ['CB pole', 'CB poles'], la: ['LA', 'LAs'],
};
const HOLDER = { ct: 'bay', cb_crm: 'bay', cb_timing: 'bay', la: 'bay', bushing: 'transformer / reactor', winding: 'transformer', dga: 'transformer / reactor' };
const subOf = (t, r) => ELEM[t](r).split('|').slice(1).join('|');
const WMODE = { 'C(HV-LV)': 'UST', 'C(HV)': 'GSTg', 'C(HV)+C(HV-LV)': 'GST', 'C(LV-HV)': 'UST', 'C(LV)': 'GSTg', 'C(LV)+C(HV-LV)': 'GST', 'C(HV-E)': 'GSTg' };
// element label within its phase unit (ICT 1 → R-phase unit → HV bushing)
const subLabel = (t, sub) => {
  const [a, b] = sub.split('|');
  if (t === 'bushing') return b ? `${b} bushing` : a === 'N' ? 'Neutral bushing' : /^[RYB]$/.test(a) ? `${a}-phase bushing` : 'Bushing';
  if (t === 'winding') return `${b} · ${WMODE[b] || ''}`;
  if (t === 'dga') return b === 'OLTC' ? 'OLTC compartment' : 'Main tank (top & bottom)';
  return a === '-' ? 'Single unit' : `${a}-phase`;
};
const PH_UNIT = (u, ph) => /^(ICT1|ICT2)$/.test(u) && /^[RYB]$/.test(ph);
export const phaseUnitName = (u, ph) => `${ph}-phase unit${DB.site.units[u]?.serials?.[ph] ? ' · Sr ' + DB.site.units[u].serials[ph] : ''}`;
/** Full name of an element, e.g. "R-phase unit · HV bushing". */
export const elemLabel = (t, u, sub) => { const ph = sub.split('|')[0]; return (['bushing', 'winding', 'dga'].includes(t) && PH_UNIT(u, ph) ? `${ph}-phase unit · ` : '') + subLabel(t, sub); };
/** Full nomenclature of an element: "ICT1, Yph, LV Bushing 3.1" · "Bay 404, Rph, CT" · "ICT2, Bph, OLTC". */
export function fullName(t, u, sub, noUnit) {
  const [a, b] = sub.split('|'); const ph = /^[RYB]$/.test(a) ? `${a}ph` : '';
  const part = t === 'bushing' ? (a === 'N' ? 'Neutral Bushing' : b ? (b.startsWith('LV-') ? `LV Bushing ${b.slice(3)}` : `${b} Bushing`) : 'Bushing')
    : t === 'winding' ? `${b} ${WMODE[b] || ''}`.trim() : t === 'dga' ? (b === 'OLTC' ? 'OLTC' : 'Main tank') : t === 'ct' ? 'CT' : t === 'la' ? 'LA' : 'CB pole';
  if (noUnit || isTF(u)) return [noUnit ? '' : shortUnit(u), ph, part].filter(Boolean).join(', ');
  return [`${shortUnit(u)} ${part}`, ph].filter(Boolean).join(', ');   // bay equipment: "400 kV Karjat - Girawali Ckt 1 CT, Rph"
}
const phOf = (t, sub) => { const p = sub.split('|')[0]; return /^[RYBN]$/.test(p) ? p : '-'; };

// ------------------------------------------------------------------ financial year
export function fyRange(fy) { const y = parseInt(fy, 10); return [new Date(y, 3, 1), new Date(y + 1, 2, 31, 23, 59)]; }
export const curFY = () => DB.site.substation.fy;
const inFY = (iso, fy) => { const [a, b] = fyRange(fy), d = toDate(iso); return d >= a && d <= b; };
export { codDue };
/** Next-due colour: red = overdue, yellow = due within 30 days, green = not yet due. */
export const dueCls = (d) => !d ? '' : d < DB.today ? 'due-red' : (d - DB.today) / 864e5 <= 30 ? 'due-yel' : 'due-grn';
export const dueTxt = (d) => !d ? '—' : `<b class="due ${dueCls(d)}">${fmtDate(d)}</b>`;
const months = (t, u) => intervalMonths(t, u === 'x' ? '404' : u);

// ------------------------------------------------------------------ colour rules (cell → severity)
const g = (v, th) => { for (const [lim, s] of th) if (v > lim) return s; return 'ok'; };
const TAN = [[1.0, 'critical'], [0.7, 'alert'], [0.5, 'watch']];
export function cellSev(t, k, v, r) {
  if (v == null || Number.isNaN(v)) return '';
  const kv = kvOf(r.unit), oltc = r.pos === 'OLTC';
  switch (k) {
    case 'tand': return '';                         // measured value shown for record; judged on corrected
    case 'tand20': return g(v, TAN);
    case 'dTand': return g(v, [[0.1, 'alert'], [0.07, 'watch']]);
    case 'dC': return v > 10 || v < -5 ? 'alert' : v > 8 || v < -4 ? 'watch' : 'ok';
    case 'R': return v > LIM.crm[kv] ? 'alert' : 'ok';
    case 'open1': case 'open2': return v > LIM.trip[kv] ? 'alert' : v > LIM.trip[kv] * 0.92 ? 'watch' : 'ok';
    case 'close': return v > 150 ? 'alert' : v > 130 ? 'watch' : 'ok';
    case 'Icorr': return g(v, [[350, 'critical'], [150, 'alert']]);
    case 'BDV': return v < (oltc ? 40 : 50) ? 'alert' : !oltc && v < 60 ? 'watch' : 'ok';
    case 'H2O': return oltc ? (v > 40 ? 'watch' : 'ok') : v > 20 ? 'alert' : v > 15 ? 'watch' : 'ok';
    case 'TDCG': return oltc ? '' : g(v, [[4630, 'critical'], [1920, 'alert'], [720, 'watch']]);
    default: if (t === 'dga' && !oltc && LIM.dga[k] != null) return v > LIM.dga[k] ? (k === 'C2H2' ? 'alert' : 'watch') : 'ok';
  }
  return '';
}

// quantities that have no circular / industry limit: watched for change (> 5 % since the previous test)
export const NONORM = { ct: ['I', 'P'], bushing: ['I', 'P'], winding: ['I', 'P'], la: ['Ith', 'Itotal', 'IRt', 'IRm', 'IRb', 'IRtot'], cb_timing: ['co1', 'co2'], cb_crm: [], dga: ['acidity', 'DDF', 'resistivity'] };
const chg5 = (t, k, v, p) => (NONORM[t] || []).includes(k) && v != null && p != null && p !== 0 && Math.abs((v - p) / p * 100) > 5 ? (v - p) / Math.abs(p) * 100 : null;

// ------------------------------------------------------------------ columns per test (as in the sheet)
const C = (k, label, dp = 2, o = {}) => ({ k, label, dp, ...o });
const TANCOLS = (iu, pu) => [C('C', 'C (pF)', 1), C('tand', 'Tan δ %', 3), C('U', 'U (kV)', 2), C('I', `I (${iu})`, 2), C('phi', 'Ø°', 2), C('P', `P (${pu})`, 2), C('F', 'F (Hz)', 2), C('temp', 'Temp °C', 0),
  C('tand20', 'Corr. tan δ % @20 °C', 3, { f: 1 }), C('dTand', 'Tan δ rise (≤ 0.1)', 3, { f: 1 }), C('dC', 'C change % (−5 … +10)', 2, { f: 1 })];
export const COLS = {
  ct: [C('mode', 'Mode', 0, { txt: 1 }), ...TANCOLS('µA', 'mW')],
  bushing: [C('mode', 'Mode', 0, { txt: 1 }), ...TANCOLS('mA', 'W')],
  winding: TANCOLS('mA', 'W'),
  cb_crm: [C('R', 'CB CRM (µΩ)', 1), C('I', 'Applied current (A)', 1), C('mV', 'Volts appeared (mV)', 2, { f: 1 })],
  cb_timing: [C('open1', 'tOpen TC1 (ms)', 2), C('co1', 'tClose-Open TC1 (ms)', 2), C('close', 'tClose (ms)', 2), C('open2', 'tOpen TC2 (ms)', 2), C('co2', 'tClose-Open TC2 (ms)', 2)],
  la: [C('season', 'Season', 0, { txt: 1 }), C('Ith', 'Ith (µA)', 1), C('Icorr', 'Icorr (µA)', 1), C('Itotal', 'Itotal (µA)', 1), C('IRt', 'IR top MΩ', 0), C('IRm', 'IR mid MΩ', 0), C('IRb', 'IR bottom MΩ', 0), C('IRtot', 'IR total MΩ', 0)],
  dga: [C('pos', 'Sample', 0, { txt: 1 })].concat(['H2', 'CH4', 'CO', 'CO2', 'C2H4', 'C2H6', 'C2H2'].map(x => C(x, `${chem(x)}${LIM.dga[x] ? ` (<${LIM.dga[x]})` : ''}`, 1)).concat([C('O2', 'O₂', 0), C('N2', 'N₂', 0), C('TDCG', 'TDCG (<720)', 1, { f: 1 }), C('BDV', 'BDV (>50 kV)', 0), C('H2O', 'Water ppm', 1), C('acidity', 'Acidity', 4), C('DDF', 'DDF @90 °C', 5), C('resistivity', 'Resistivity', 1)])),
};
const cellVal = (r, c) => c.k === 'mode' ? (r.mode || 'UST') : c.k === 'season' ? (r.season || '') : c.k === 'pos' ? (r.pos || '') : r.v[c.k];

// ------------------------------------------------------------------ ranking parameters (circular-relevant)
const P = (k, label, unit, dp, get, o = {}) => ({ k, label, unit, dp, get, ...o });
export const RANKP = {
  ct: [P('tand20', 'Corrected tan δ @20 °C', '%', 3, r => r.v.tand20), P('dTand', 'Tan δ rise since last', '%', 3, r => r.v.dTand), P('dC', 'C change since last', '%', 2, r => r.v.dC, { abs: 1 }), P('C', 'Capacitance', 'pF', 1, r => r.v.C)],
  bushing: [P('tand20', 'Corrected tan δ @20 °C', '%', 3, r => r.v.tand20), P('dTand', 'Tan δ rise since last', '%', 3, r => r.v.dTand), P('dC', 'C₁ change since last', '%', 2, r => r.v.dC, { abs: 1 })],
  winding: [P('tand20', 'Corrected tan δ @20 °C', '%', 3, r => r.v.tand20), P('dTand', 'Tan δ rise since last', '%', 3, r => r.v.dTand), P('dC', 'C change since last', '%', 2, r => r.v.dC, { abs: 1 })],
  cb_crm: [P('R', 'Contact resistance', 'µΩ', 1, r => r.v.R)],
  cb_timing: [P('open1', 'Trip time TC1', 'ms', 2, r => r.v.open1), P('open2', 'Trip time TC2', 'ms', 2, r => r.v.open2), P('close', 'Close time', 'ms', 2, r => r.v.close), P('co1', 'Close-Open TC1', 'ms', 2, r => r.v.co1)],
  la: [P('Icorr', 'Icorr (3rd-harmonic resistive)', 'µA', 1, r => r.v.Icorr), P('Ith', 'Ith', 'µA', 1, r => r.v.Ith), P('Itotal', 'Itotal', 'µA', 0, r => r.v.Itotal)],
  dga: [P('TDCG', 'TDCG', 'ppm', 0, r => r.v.TDCG), ...['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2'].map(x => P(x, chem(x), 'ppm', 1, r => r.v[x])), P('BDV', 'BDV (lowest first)', 'kV', 0, r => r.v.BDV, { asc: 1 }), P('H2O', 'Water', 'ppm', 1, r => r.v.H2O)],
};

// ------------------------------------------------------------------ element health (each phase is its own entity)
const lerp = (x, pts) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, b] = pts[i - 1], [c, d] = pts[i]; return b + (d - b) * (x - a) / (c - a); } return pts.at(-1)[1]; };
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
let CRM_MED = {};
export function elemHealth(t, L) {
  if (!L) return null; const v = L.v; let s = 100;
  if (['ct', 'bushing', 'winding'].includes(t)) {
    const x = v.tand20; if (x == null) return null;
    s = lerp(x, [[0.3, 100], [0.5, 85], [0.7, 60], [1.0, 20], [1.2, 0]]);
    if (v.dTand > 0.1) s = Math.min(s, 60); if (v.dC != null && (v.dC > 10 || v.dC < -5)) s = Math.min(s, 40);
  } else if (t === 'cb_crm') { if (v.R == null) return null; s = lerp(v.R / LIM.crm[kvOf(L.unit)], [[0.8, 100], [1.0, 80], [1.2, 60], [1.5, 30], [2, 0]]); }
  else if (t === 'cb_timing') { const tr = LIM.trip[kvOf(L.unit)], op = Math.max(v.open1 ?? 0, v.open2 ?? 0); s = Math.min(lerp(op / tr, [[0.8, 100], [0.9, 90], [1, 65], [1.2, 25], [1.5, 0]]), v.close ? lerp(v.close / 150, [[0.7, 100], [0.85, 90], [1, 60], [1.5, 10], [2, 0]]) : 100); }
  else if (t === 'la') { if (v.Icorr == null) return null; s = lerp(v.Icorr, [[30, 100], [100, 85], [150, 65], [350, 25], [500, 0]]); }
  else if (t === 'dga') {
    if (L.pos === 'OLTC') return v.H2O != null ? lerp(v.H2O, [[20, 100], [30, 85], [40, 60], [60, 20]]) : null;
    const rs = Object.entries(LIM.dga).filter(([k]) => v[k] != null && k !== 'TDCG').map(([k, l]) => v[k] / l);
    s = lerp(Math.max(0, ...rs), [[0.5, 100], [1, 70], [2, 40], [4, 10], [8, 0]]);
    if (v.BDV != null && v.BDV < 50) s = Math.min(s, 40);
  }
  return Math.round(s);
}
const hBand = (s) => s == null ? 'none' : s >= 85 ? 'b1' : s >= 70 ? 'b2' : s >= 50 ? 'b3' : s >= 30 ? 'b4' : 'b5';
const hChip = (s) => `<span class="hchip ${hBand(s)}" title="Element health index">${s == null ? '—' : s}</span>`;

// ------------------------------------------------------------------ model: elements grouped by bay / unit
export function model(t) {
  CRM_MED = {};
  if (t === 'cb_crm') for (const kv of [400, 220]) CRM_MED[kv] = med(latestOf(recs('cb_crm').filter(done), r => r.unit + r.ph).filter(r => kvOf(r.unit) === kv).map(r => r.v.R));
  const pop = population(t);
  const all = recs(t);
  const el = new Map(pop.map(([u, sub]) => [u + '|' + sub, { u, sub, rows: [] }]));
  const live = (u) => isTF(u) || (DB.site.bays[u] && !/FUTURE/i.test(DB.site.bays[u]));   // future / unregistered bays are never listed
  for (const r of all) { if (!live(r.unit)) continue; const k = ELEM[t](r); if (!el.has(k)) el.set(k, { u: r.unit, sub: subOf(t, r), rows: [] }); el.get(k).rows.push(r); }
  for (const e of el.values()) { e.rows.sort((a, b) => a.date.localeCompare(b.date)); e.done = e.rows.filter(done); e.L = e.done.at(-1); e.health = elemHealth(t, e.L); e.ph = phOf(t, e.sub); }
  if (VIEW.tv === 5 && TANT.includes(t)) for (const [k, e] of [...el]) if (!e.rows.length) el.delete(k);   // 5 kV view: only elements tested at 5 kV
  const units = [...groupBy([...el.values()], e => e.u)].sort((a, b) => sortUnits(a[0], b[0])).map(([u, es]) => ({ u, es: es.sort((a, b) => subSort(t, a.sub, b.sub)) }));
  return { units, elements: [...el.values()] };
}
const PHO = { R: 1, Y: 2, B: 3, N: 4, '-': 0 };
function subSort(t, a, b) {
  if (t === 'bushing') { const o = ['HV', 'IV', 'LV-3.1', 'LV-3.2', '']; const [pa, qa] = a.split('|'), [pb, qb] = b.split('|'); return (PHO[pa] - PHO[pb]) || (o.indexOf(qa) - o.indexOf(qb)); }
  if (t === 'winding') { const o = ['C(HV-LV)', 'C(HV)', 'C(HV)+C(HV-LV)', 'C(LV-HV)', 'C(LV)', 'C(LV)+C(HV-LV)', 'C(HV-E)']; const [pa, qa] = a.split('|'), [pb, qb] = b.split('|'); return (PHO[pa] - PHO[pb]) || (o.indexOf(qa) - o.indexOf(qb)); }
  if (t === 'dga') { const o = ['Main tank', 'OLTC']; const [pa, qa] = a.split('|'), [pb, qb] = b.split('|'); return (PHO[pa] - PHO[pb]) || (o.indexOf(qa) - o.indexOf(qb)); }
  return (PHO[a] ?? 9) - (PHO[b] ?? 9);
}
const latestOf = (rs, key) => [...groupBy(rs, key).values()].map(s => s.sort((a, b) => a.date.localeCompare(b.date)).at(-1));

// ------------------------------------------------------------------ yearly progress
// Yearly progress. Policy: every year at least one more than half of the population is tested
// (⌊N/2⌋ + 1); LAs: all of them every year and half of them by the end of the first half-year (30 Sep).
// Per bay the calculated figure is what falls due under the circular; the admin may declare any target.
export const policyTarget = (t, pop) => t === 'la' ? pop : Math.floor(pop / 2) + 1;
export const prevFY = (fy) => { const y = parseInt(fy, 10) - 1; return `${y}-${String(y + 1).slice(2)}`; };
function progress(t, M, fy) {
  const [start, end] = fyRange(fy), TG = targets(), SCH = new Map(schedule().filter(x => x.t === t).map(x => [x.unit, x]));
  const h1End = new Date(start.getFullYear(), 8, 30, 23, 59);
  const rows = M.units.map(({ u, es }) => {
    let pop = es.length, due = 0, prog = 0, h1 = 0, extra = 0, last = null;
    for (const e of es) {
      const m = months(t, u), dts = e.done.map(r => r.date);
      const before = dts.filter(d => toDate(d) < start).pop(), inside = dts.filter(d => inFY(d, fy));
      const isDue = m < 12 ? true : (before ? dueFrom(t, u, before) : dts.length ? start : (codDue(t, u) ?? start)) <= end;
      if (isDue) due++;
      if (inside.length) { prog++; if (!isDue) extra++; }
      if (inside.some(d => toDate(d) <= h1End)) h1++;
      const l = dts.at(-1); if (l && (!last || l > last)) last = l;
    }
    const ov = TG[`${t}|${fy}|${u}`], target = ov ?? due;
    return { u, pop, target, auto: due, prog, h1, extra, last, next: SCH.get(u)?.due ?? null, by: SCH.get(u)?.by, pct: target ? Math.min(100, Math.round(prog / target * 100)) : null, override: ov != null };
  });
  const tot = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const pop = tot('pop'), policy = policyTarget(t, pop), totOv = TG[`${t}|${fy}|*`];
  const T = { pop, policy, due: tot('auto'), target: totOv ?? policy, autoTarget: policy, prog: tot('prog'), extra: tot('extra'), h1: tot('h1'), h1Target: Math.ceil(pop / 2), override: totOv != null };
  T.pct = T.target ? Math.min(100, Math.round(T.prog / T.target * 100)) : null;
  return { rows, T };
}

// ------------------------------------------------------------------ SVG historic chart
const SC = { ok: 'var(--brand-2)', watch: 'var(--watch)', alert: 'var(--alert)', critical: 'var(--crit)', '': 'var(--brand-2)' };
export function svgChart(series, o = {}) {
  const W = o.w || 360, H = o.h || 150, L = 40, R = 30, T = 16, B = 24;
  const pts = series.flatMap(s => s.pts);
  if (!pts.length) return `<div class="mc-empty">No readings yet</div>`;
  const xs = pts.map(p => +toDate(p[0])), ys = pts.map(p => p[1]), lims = (o.limits || []).map(l => l.y);
  const avg = series[0].pts.reduce((a, p) => a + p[1], 0) / series[0].pts.length;
  let lo = Math.min(...ys, ...(o.zero ? [0] : [])), hi = Math.max(...ys);
  let step = niceStep(Math.abs(avg) * 0.2) || niceStep((hi - lo) / 5) || 1;
  const near = lims.filter(l => l <= hi * 1.6 + step && l >= lo * 0.6 - step); lo = Math.min(lo, ...near); hi = Math.max(hi, ...near);
  while ((hi - lo) / step > 7) step = niceStep(step * 2.2);
  let y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  if (y1 - hi < step * 0.25) y1 += step; if (lo - y0 < step * 0.25 && !(o.zero && y0 === 0)) y0 -= step;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), X = (x) => L + (x1 === x0 ? (W - L - R) / 2 : (x - x0) / (x1 - x0) * (W - L - R)), Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  const dp = Math.max(0, -Math.floor(Math.log10(step)) + (step / 10 ** Math.floor(Math.log10(step)) === 2.5 ? 1 : 0));
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${series[0].color || 'var(--brand-2)'}" stop-opacity=".25"/><stop offset="1" stop-color="${series[0].color || 'var(--brand-2)'}" stop-opacity="0"/></linearGradient></defs>`;
  for (let v = y0, k = 0; v <= y1 + step / 1e6 && k < 12; v += step, k++) {       // dotted grid at round steps
    const yy = Y(v);
    s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="mc-grid"/><text x="${L - 4}" y="${yy + 3}" text-anchor="end" class="mc-t">${(+v.toFixed(6)).toFixed(dp)}</text>`;
  }
  for (const l of o.limits || []) if (l.y >= y0 && l.y <= y1) {
    const yy = Y(l.y), band = l.lo ? [yy, H - B] : [T, yy];
    s += `<rect x="${L}" y="${band[0]}" width="${W - L - R}" height="${Math.max(0, band[1] - band[0])}" fill="${SC[l.sev]}" opacity=".07"/><line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${SC[l.sev]}" stroke-dasharray="5 3" stroke-width="1.2"/><text x="${W - R - 2}" y="${yy - 3}" text-anchor="end" class="mc-lim" fill="${SC[l.sev]}">${esc(l.label)}</text>`;
  }
  s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="mc-ax"/>`;
  const dates = [...new Set(pts.map(p => p[0]))].sort();
  const tickD = dates.length <= 5 ? dates : [dates[0], dates[Math.floor(dates.length / 2)], dates.at(-1)];
  s += tickD.map(d => `<text x="${X(+toDate(d))}" y="${H - 8}" text-anchor="middle" class="mc-t">${toDate(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</text>`).join('');
  const LBL = [];
  series.forEach((se, i) => {
    const ps = se.pts.map(p => [X(+toDate(p[0])), Y(p[1]), p]);
    if (!ps.length) return;
    const col = se.color || 'var(--brand-2)';
    if (o.bars) { const bw = Math.max(5, Math.min(20, (W - L - R) / (ps.length * series.length + 2))); ps.forEach(([x, y, p]) => { s += `<rect class="pt" data-date="${p[0]}" x="${x - bw * series.length / 2 + i * bw}" y="${Math.min(y, Y(Math.max(y0, 0)))}" width="${bw - 1}" height="${Math.abs(Y(Math.max(y0, 0)) - y)}" rx="2" fill="${p[2] && p[2] !== 'ok' ? SC[p[2]] : col}" opacity=".85"><title>${esc(se.name)} ${fmtDate(p[0])}: ${fmt(p[1], o.dp ?? 2)}</title></rect>`; }); }
    else {
      const d = ps.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
      if (i === 0 && ps.length > 1) s += `<path d="${d}L${ps.at(-1)[0].toFixed(1)} ${H - B}L${ps[0][0].toFixed(1)} ${H - B}Z" fill="url(#${id})"/>`;
      s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    if (!o.bars) ps.forEach(([x, y, p], j) => {
      const c = p[2] && p[2] !== 'ok' ? SC[p[2]] : col;
      s += `<circle class="pt" data-date="${p[0]}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p[2] && p[2] !== 'ok' ? 4.6 : 3.4}" fill="var(--panel)" stroke="${c}" stroke-width="2"><title>${esc(se.name)} · ${fmtDate(p[0])}: ${fmt(p[1], o.dp ?? 3)}</title></circle>`;
      if (series.length === 1 && (j === ps.length - 1 || ps.length <= 4)) LBL.push({ x, y, t: fmt(p[1], o.dp ?? 3), c, last: j === ps.length - 1 });
    });
  });
  // value labels: placed without touching the axis numbers, limit labels or each other (latest point first)
  const boxes = (o.limits || []).filter(l => l.y >= y0 && l.y <= y1).map(l => ({ x0: W - R - 46, x1: W - R, y0: Y(l.y) - 14, y1: Y(l.y) }));
  const hit = (b) => boxes.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
  for (const lb of LBL.sort((a, b) => b.last - a.last)) {
    const w = lb.t.length * 7.2 + 4, anchor = lb.x - w / 2 < L + 2 ? 'start' : lb.x + w / 2 > W - R + 26 ? 'end' : 'middle';
    const bx = anchor === 'start' ? lb.x + 2 : anchor === 'end' ? lb.x - w - 2 : lb.x - w / 2;
    for (const dy of [-9, 17, -22]) {
      const ty = lb.y + dy, b = { x0: bx, x1: bx + w, y0: ty - 10, y1: ty + 2 };
      if (ty < T - 2 || ty > H - B - 2 || hit(b)) continue;
      boxes.push(b); s += `<text x="${(anchor === 'start' ? lb.x + 3 : anchor === 'end' ? lb.x - 3 : lb.x).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" class="mc-v" fill="${lb.c}">${lb.t}</text>`; break;
    }
  }
  const leg = series.length > 1 ? `<div class="mc-leg">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>` : '';
  return `<svg class="mchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${s}</svg>${leg}`;
}
const GASCOL = { H2: '#2f6fd0', CH4: '#0f766e', C2H4: '#c2410c', C2H6: '#7c3aed', C2H2: '#c4161c', CO: '#a16207', CO2: '#64748b' };
// parameters charted per element (one at a time — each phase / point is its own unit)
const CHARTP = {
  ct: [['tand20', 'Corrected tan δ @20 °C', '%', 3], ['C', 'Capacitance', 'pF', 1], ['dTand', 'Tan δ rise', '%', 3], ['dC', 'C change', '%', 2]],
  cb_crm: [['R', 'Contact resistance', 'µΩ', 1]],
  cb_timing: [['open1', 'Trip TC1', 'ms', 1], ['open2', 'Trip TC2', 'ms', 1], ['close', 'Close', 'ms', 1], ['co1', 'Close-Open', 'ms', 1]],
  la: [['Icorr', 'Icorr', 'µA', 0], ['Ith', 'Ith', 'µA', 0], ['Itotal', 'Itotal', 'µA', 0]],
  dga: [['TDCG', 'TDCG', 'ppm', 0], ...['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2'].map(x => [x, chem(x), 'ppm', 1]), ['BDV', 'BDV', 'kV', 0], ['H2O', 'Water', 'ppm', 1]],
};
CHARTP.bushing = CHARTP.ct; CHARTP.winding = CHARTP.ct;
const LIMS = (t, k, u, pos) => {
  const kv = kvOf(u);
  return ({ tand20: [{ y: 0.5, sev: 'watch', label: '0.5 %' }, { y: 0.7, sev: 'alert', label: '0.7 %' }], dTand: [{ y: 0.1, sev: 'alert', label: '0.1 %' }], dC: [{ y: 10, sev: 'alert', label: '+10 %' }, { y: -5, sev: 'alert', label: '−5 %', lo: 1 }],
    R: [{ y: LIM.crm[kv], sev: 'alert', label: `${LIM.crm[kv]} µΩ` }], open1: [{ y: LIM.trip[kv], sev: 'alert', label: `${LIM.trip[kv]} ms` }], open2: [{ y: LIM.trip[kv], sev: 'alert', label: `${LIM.trip[kv]} ms` }], close: [{ y: 150, sev: 'alert', label: '150 ms' }],
    Icorr: [{ y: 150, sev: 'alert', label: '150' }, { y: 350, sev: 'critical', label: '350' }], Ith: [{ y: 150, sev: 'alert', label: '150' }, { y: 350, sev: 'critical', label: '350' }],
    TDCG: pos === 'OLTC' ? [] : [{ y: 720, sev: 'watch', label: '720' }], BDV: [{ y: pos === 'OLTC' ? 40 : 50, sev: 'alert', label: pos === 'OLTC' ? '40 kV' : '50 kV', lo: 1 }], H2O: [{ y: pos === 'OLTC' ? 40 : 20, sev: 'alert', label: pos === 'OLTC' ? '40' : '20' }],
  })[k] || (t === 'dga' && pos !== 'OLTC' && LIM.dga[k] ? [{ y: LIM.dga[k], sev: k === 'C2H2' ? 'alert' : 'watch', label: String(LIM.dga[k]) }] : []);
};
const EREG = new Map();     // element key -> element (for the chart selectors)
const ESEL = {};            // element key -> selected parameter index
const CHARTG = { ct: [[0, 2], [1, 3]], bushing: [[0, 2], [1, 3]], winding: [[0, 2], [1, 3]] };
function elemChartSvg(t, e, i, two) {
  const [k, label, unit, dp] = CHARTP[t][i];
  const pts = e.done.filter(r => r.v[k] != null).map(r => [r.date, r.v[k], cellSev(t, k, r.v[k], r)]);
  const col = GASCOL[k] || (k === 'C' ? '#0f766e' : 'var(--brand-2)');
  const main = t === 'dga' && !e.sub.endsWith('OLTC');
  const series = main ? [['Top', '#2f6fd0'], ['Bottom', '#a16207']].map(([p, c]) => ({ name: `${p} sample`, color: c, pts: e.done.filter(r => r.pos === p && r.v[k] != null).map(r => [r.date, r.v[k], cellSev(t, k, r.v[k], r)]) })).filter(x => x.pts.length) : [{ name: label, color: col, pts }];
  return `<div class="mc-t2">${label} <span class="dim">${unit}</span></div>${svgChart(series.length ? series : [{ name: label, color: col, pts }], { dp, w: two ? 600 : 720, h: two ? 240 : 230, bars: t === 'la' || t === 'cb_crm', zero: t === 'la' || t === 'cb_crm', limits: LIMS(t, k, e.u, e.sub.split('|').pop()) })}
    <div class="mc-note">grid lines at a round step ≈ 20 % of this ${NOUN[t][0]}'s average</div>`;
}
function elemChart(t, e) {
  const key = `${t}#${e.u}|${e.sub}`; EREG.set(key, e);
  const P = CHARTP[t], G = CHARTG[t] || [P.map((_, j) => j)], two = G.length > 1;
  return `<div class="ch-row ${two ? 'two' : ''}">${G.map((g, gi) => { const gk = `${key}#${gi}`, i = g.includes(ESEL[gk]) ? ESEL[gk] : g[0];
    const chips = g.length > 1 ? `<div class="mc-chips">${g.map(j => `<button class="${j === i ? 'on' : ''}" data-ck="${esc(gk)}" data-ci="${j}">${P[j][1]}</button>`).join('')}</div>` : '';
    return `<div class="ch-cell">${chips}<div class="mc-box" data-cbox="${esc(gk)}">${elemChartSvg(t, e, i, two)}</div></div>`; }).join('')}</div>`;
}
function wireChartChips(root) {
  $$('[data-ck]', root).forEach(b => b.onclick = (ev) => {
    ev.stopPropagation(); const key = b.dataset.ck, i = +b.dataset.ci, e = EREG.get(key.replace(/#\d+$/, '')), t = key.split('#')[0]; ESEL[key] = i;
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    const box = root.querySelector(`[data-cbox="${CSS.escape(key)}"]`); if (box) box.innerHTML = elemChartSvg(t, e, i, !!CHARTG[t]);
  });
}

// ------------------------------------------------------------------ DGA: same tank, two sampling points
// Top and bottom samples come from the same tank. Dissolved gases are normally near-uniform in a
// tank with circulating oil, so the two are compared with each other (and only with each other):
// a large difference points to a sampling / handling problem, a dead-leg valve or a localised fault.
const TANKG = ['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2', 'H2O', 'BDV'];
export function tankPair(u, ph) {
  const rs = recs('dga', { unit: u }).filter(r => r.ph === ph && done(r));
  const top = rs.filter(r => r.pos === 'Top'), bot = rs.filter(r => r.pos === 'Bottom');
  const dates = [...new Set(top.map(r => r.date))].filter(d => bot.some(b => b.date === d)).sort();
  return dates.map(d => ({ d, T: top.find(r => r.date === d), B: bot.find(r => r.date === d) }));
}
const diffSev = (g, a, b) => { if (a == null || b == null) return ''; const d = Math.abs(a - b), m = Math.max(Math.abs(a), Math.abs(b));
  if (g === 'C2H2') return (a > 0) !== (b > 0) ? 'alert' : ''; if (g === 'BDV') return d > 10 ? 'watch' : ''; if (g === 'H2O') return d > 8 ? 'watch' : '';
  return m >= 20 && d / m > 0.5 ? 'alert' : m >= 10 && d / m > 0.3 ? 'watch' : ''; };
function tankStrip(e) {
  const [ph, pos] = e.sub.split('|'); if (pos === 'OLTC') return '';
  const P = tankPair(e.u, ph); if (!P.length) return '';
  const L = P.at(-1), other = pos === 'Top' ? 'Bottom' : 'Top';
  return `<div class="tank"><span class="tank-k">Same tank · ${pos} vs ${other} · ${fmtDate(L.d)}</span>${TANKG.map(g => { const a = L[pos[0]].v[g], b = L[other[0]].v[g]; const sv = diffSev(g, a, b);
    return `<span class="tk ${sv ? 'c-' + sv : ''}" title="${chem(g)}: ${pos} ${fmt(a, 1)} · ${other} ${fmt(b, 1)}"><b>${chem(g)}</b> ${fmt(a, 0)} <i>/</i> ${fmt(b, 0)}</span>`; }).join('')}</div>`;
}
function tankSection(u, ph) {
  const P = tankPair(u, ph); if (!P.length) return '';
  const id = 'tk' + Math.random().toString(36).slice(2, 7);
  return `<div class="card mt tank-card" data-tank="${id}"><div class="card-h"><h3>Main tank · top vs bottom sample${ph !== '-' ? ` · ${ph}-phase unit` : ''}</h3><span class="sub">both points sample one tank, so they should agree — a large gap means a sampling issue or a localised fault near one valve (IEC 60567)</span></div>
    <div class="card-b"><div class="tbl-wrap"><table class="t seq"><thead><tr><th>Date</th>${TANKG.map(g => `<th class="r">${chem(g)} T / B</th>`).join('')}</tr></thead><tbody>
    ${P.slice().reverse().map(p => `<tr><td>${fmtDate(p.d)}</td>${TANKG.map(g => { const sv = diffSev(g, p.T.v[g], p.B.v[g]); return `<td class="r ${sv ? 'c-' + sv : ''}">${fmt(p.T.v[g], 1)} / ${fmt(p.B.v[g], 1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="mc-chips mt" data-tchips="${id}">${TANKG.map((g, i) => `<button class="${i ? '' : 'on'}" data-g="${g}">${chem(g)}</button>`).join('')}</div>
    <div class="chart-box" style="height:260px"><canvas data-tcv="${id}"></canvas></div></div></div>`;
}
function wireTank(root, u) {
  $$('[data-tank]', root).forEach(card => {
    const id = card.dataset.tank, ph = card.querySelector('h3').textContent.match(/· ([RYB])-phase/)?.[1] || '-';
    const draw = (g) => { const P = tankPair(u, ph), cv = card.querySelector('canvas'); const old = Chart.getChart(cv); if (old) old.destroy();
      lineChart(cv, { series: [{ label: 'Top', color: '#2f6fd0', points: P.filter(p => p.T.v[g] != null).map(p => ({ x: p.d, y: p.T.v[g] })) }, { label: 'Bottom', color: '#a16207', points: P.filter(p => p.B.v[g] != null).map(p => ({ x: p.d, y: p.B.v[g] })) }], stepRef: true, unit: g === 'BDV' ? 'kV' : 'ppm', yLabel: g === 'BDV' ? 'kV' : 'ppm' }); };
    $$('button', card.querySelector('.mc-chips')).forEach(b => b.onclick = () => { $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.g); });
    draw(TANKG[0]);
  });
}

// ------------------------------------------------------------------ interactive tables ↔ graphs
export function wireInteractive(root) {
  root.addEventListener('mouseover', (ev) => {
    const tr = ev.target.closest('tr[data-date]'), pt = ev.target.closest('.pt');
    if (!tr && !pt) return;
    const el = (tr || pt).closest('.el, .el-sec'); if (!el) return;
    const d = tr ? tr.dataset.date : pt.dataset.date;
    $$('.hl', el).forEach(x => x.classList.remove('hl'));
    $$(`[data-date="${d}"]`, el).forEach(x => x.classList.add('hl'));
  });
  root.addEventListener('mouseout', (ev) => { const el = ev.target.closest('.el, .el-sec'); if (el && !el.contains(ev.relatedTarget)) $$('.hl', el).forEach(x => x.classList.remove('hl')); });
  root.addEventListener('click', (ev) => {
    const gl = ev.target.closest('[data-gl]');
    if (gl) { ev.preventDefault(); ev.stopPropagation(); const el = gl.closest('.el, .el-sec'); const on = !el.classList.contains('gx-local'); el.classList.toggle('gx-local', on); gl.classList.toggle('on', on); gl.textContent = on ? '📈 Hide graph' : '📈 Graph'; return; }
    const xt = ev.target.closest('[data-xtoggle]');
    if (xt) { ev.stopPropagation(); const tb = xt.closest('table'); tb.classList.toggle('show-x'); xt.textContent = xt.textContent.replace(/— (show|hide)$/, tb.classList.contains('show-x') ? '— hide' : '— show'); return; }
    const th = ev.target.closest('table.seq th[data-sort]'); if (!th) return; ev.stopPropagation();
    const table = th.closest('table'), tb = table.tBodies[0], idx = [...th.parentElement.children].indexOf(th);
    const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc'; $$('th', table).forEach(x => { delete x.dataset.dir; const s = x.querySelector('.srt'); if (s) s.remove(); });
    th.dataset.dir = dir; th.insertAdjacentHTML('beforeend', `<span class="srt">${dir === 'asc' ? '▴' : '▾'}</span>`);
    const val = (tr) => { const c = tr.children[idx]; if (!c) return ''; if (th.dataset.sort === 'date') return tr.dataset.date; const n = parseFloat(c.textContent.replace(/,/g, '')); return isNaN(n) ? c.textContent : n; };
    [...tb.rows].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'asc' ? 1 : -1); }).forEach(r => tb.appendChild(r));
  });
}

// ------------------------------------------------------------------ tables
function cellHtml(t, r, c, prev) {
  const v = cellVal(r, c), sev = c.txt ? '' : cellSev(t, c.k, v, r);
  const ch = !c.txt && prev ? chg5(t, c.k, v, prev.v[c.k]) : null;
  const ed = r.edited?.[c.k], err = r.err?.[c.k];
  const title = [r.f?.[c.k] ? `Formula: ${r.f[c.k]}` : '', ed ? `Edited ${fmtDate(ed.at.slice(0, 10))}${!ed.raw.startsWith('=') && r.v0?.[c.k] != null ? ` · was ${r.v0[c.k]}` : ''}` : '', err ? `Error: ${err}` : ''].filter(Boolean).join('\n');
  const txt = c.txt ? esc(v || '') : err ? '#ERR' : fmt(v, c.dp);
  const tt = [title, ch != null ? `${ch > 0 ? '+' : ''}${fmt(ch, 1)} % since the previous test — no limit exists for this quantity, so a change above 5 % is marked for attention` : ''].filter(Boolean).join('\n');
  return `<td class="r c-${ch != null && !sev ? 'watch chg5' : sev} ${c.f ? 'fx' : ''} ${['dTand', 'dC'].includes(c.k) ? 'chgc' : ''} ${ed ? 'edited' : ''} ${isAdmin() ? 'ed' : ''}" data-src="${esc(r.src)}" data-k="${c.k}" ${tt ? `title="${esc(tt)}"` : ''}>${txt}${ch != null ? `<sup class="c5">${ch > 0 ? '▲' : '▼'}${fmt(Math.abs(ch), 0)}%</sup>` : ''}</td>`;
}
// width of a column = enough for its longest header word and for its numbers, so headers wrap at most once
function colW(c) {
  const words = String(c.label).replace(/<[^>]+>/g, '').split(/\s+/);
  const longest = Math.max(...words.map(w => w.length));
  return Math.round(Math.min(118, Math.max(58, longest * 8.2 + 18, (c.dp ?? 2) * 9 + 46)));
}
const remW = (rows) => { const L = Math.max(0, ...rows.map(r => (r.rem || '').length)); return Math.round(Math.min(460, Math.max(180, Math.ceil(L / 3) * 7.6 + 28))); };
function seqTable(t, e, latestOnly) {
  const cols = COLS[t], rows = latestOnly ? (e.L ? [e.L] : []) : e.rows;
  const head = `<thead><tr><th data-sort="ses" style="min-width:70px">Session</th><th data-sort="date" style="min-width:112px">Date of test <span class="srt">▾</span></th>${cols.map(c => `<th class="r ${['dTand', 'dC'].includes(c.k) ? 'chgc' : ''}" data-sort="${c.k}" style="min-width:${colW(c)}px">${c.label}</th>`).join('')}<th class="remh" style="min-width:${remW(rows)}px">Remarks</th>${isAdmin() && !latestOnly ? '<th></th>' : ''}</tr></thead>`;
  // the latest two tests stay visible; the admin may fold older history away (accessibility menu)
  const ds = [...new Set(e.done.map(r => r.date))], cut = ds.length > 2 ? ds.at(-2) : '';   // latest two tests + any later attempt stay
  const keep = { has: (d) => d >= cut };
  const prevOf = (r) => { const i = e.done.indexOf(r); return i > 0 ? e.done.slice(0, i).reverse().find(x => (x.pos || '') === (r.pos || '')) : null; };
  const nOld = rows.filter(r => !keep.has(r.date) && !r.excluded).length;
  const body = rows.map(r => `<tr data-date="${r.date}" class="${done(r) ? '' : 'nd'} ${r.excluded ? 'xcl' : ''} ${!keep.has(r.date) && !r.excluded ? 'old' : ''} ${r.src.startsWith('new!') ? 'newrow' : ''}" ${r.excluded ? `title="${esc(r.excluded)}"` : ''}><td>${esc(r.ses || '')}</td><td class="dt ${isAdmin() ? 'ed' : ''} ${inFY(r.date, curFY()) ? 'c-fy' : ''}" data-src="${esc(r.src)}" data-k="date">${fmtDate(r.date)}</td>${cols.map(c => cellHtml(t, r, c, done(r) ? prevOf(r) : null)).join('')}<td class="rem ${isAdmin() ? 'ed' : ''} ${r.edited?.rem ? 'edited' : ''}" data-src="${esc(r.src)}" data-k="rem">${r.excluded ? '<span class="tag chg">hidden template row · not in PDF</span> ' : ''}${r.note ? `<span class="tag ver" title="${esc(r.note)}">same readings in other bays · verify</span> ` : ''}${esc(r.rem || (done(r) || r.excluded ? '' : 'Not recorded'))}</td>${isAdmin() && !latestOnly ? `<td>${r.src.startsWith('new!') ? `<button class="btn sm ghost" data-del="${esc(r.src)}" title="Delete added row">✕</button>` : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${cols.length + 3}" class="dim">No test on record — counted as pending.</td></tr>`;
  const nx = rows.filter(r => r.excluded).length;
  const xrow = nx ? `<tr class="xtoggle"><td colspan="${cols.length + 3}"><button class="btn sm ghost" data-xtoggle>${nx} copied / template row${nx === 1 ? '' : 's'} not printed in the sheet PDF (excluded) — show</button></td></tr>` : '';
  const orow = '';
  return `<table class="t seq">${head}<tbody>${orow}${body}${xrow}</tbody></table>${isAdmin() && !latestOnly ? `<button class="btn sm" data-add="${esc(t + '|' + e.u + '|' + e.sub)}">＋ Add test row</button>` : ''}`;
}
// Latest results: the latest test with everything needed to verify it — previous and first test of the
// same element, and the change since each (absolute and %), coloured by the circular's change rules.
const NODIFF = new Set(['dTand', 'dC', 'F', 'U', 'I', 'P', 'phi', 'temp', 'O2', 'N2', 'mV']);
function latestTable(t, e) {
  const cols = COLS[t], dates = [...new Set(e.done.map(r => r.date))];
  if (!dates.length) return `<div class="lt-none">No test on record since commissioning (${fmtDate(codOf(e.u))}).</div>`;
  const at = (d) => e.done.filter(r => r.date === d).sort((a, b) => (a.pos || '').localeCompare(b.pos || '')).reverse();
  const Ld = dates.at(-1), Pd = dates.at(-2), Fd = dates.length > 2 ? dates[0] : null;
  const L = at(Ld), P = Pd ? at(Pd) : [], F = Fd ? at(Fd) : [];
  const twin = (r, set) => set.find(x => (x.pos || '') === (r.pos || '')) || (set.length === 1 ? set[0] : null);
  const plain = (r, c) => `<td class="r">${c.txt ? esc(cellVal(r, c) || '') : fmt(cellVal(r, c), c.dp)}</td>`;
  const row = (cls, tag, r) => `<tr class="${cls}" data-date="${r.date}"><td class="lt-tag">${tag}</td><td class="dt ${cls === 'lt-l' && inFY(r.date, curFY()) ? 'c-fy' : ''}">${fmtDate(r.date)}</td>${cols.map(c => cls === 'lt-l' ? cellHtml(t, r, c, twin(r, P)) : plain(r, c)).join('')}<td class="rem">${esc(r.rem || '')}</td></tr>`;
  const diff = (tag, a, b, pct) => !b ? '' : `<tr class="lt-d ${pct ? 'pct' : ''}"><td class="lt-tag">${tag}</td><td class="dim rng">${fmtDate(b.date)} →<br>${fmtDate(a.date)}</td>${cols.map(c => {
      if (c.txt) return `<td>${c.k === 'pos' ? esc(a.pos || '') : ''}</td>`;
      if (NODIFF.has(c.k)) return '<td class="r dim">·</td>';
      const x = a.v[c.k], y = b.v[c.k]; if (x == null || y == null) return '<td class="r dim">—</td>';
      const d = pct ? (y ? (x - y) / Math.abs(y) * 100 : null) : x - y;
      const sv = !pct && c.k === 'tand20' ? cellSev(t, 'dTand', d, a) : pct && c.k === 'C' ? cellSev(t, 'dC', d, a) : pct && (NONORM[t] || []).includes(c.k) && d != null && Math.abs(d) > 5 ? 'watch' : '';
      return `<td class="r ${sv ? 'c-' + sv : ''}">${d == null ? '—' : (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d), pct ? 2 : Math.max(c.dp, 1))}${pct && d != null ? ' %' : ''}</td>`; }).join('')}<td></td></tr>`;
  const head = `<thead><tr><th style="min-width:128px">Row</th><th style="min-width:116px">Date of test</th>${cols.map(c => `<th class="r ${['dTand', 'dC'].includes(c.k) ? 'chgc' : ''}" style="min-width:${colW(c)}px">${c.label}</th>`).join('')}<th class="remh" style="min-width:${remW([...L, ...P, ...F])}px">Remarks</th></tr></thead>`;
  const body = L.map(r => row('lt-l', 'Latest test', r)).join('')
    + P.map(r => row('lt-p', 'Previous test', r)).join('')
    + L.map(r => diff('Change since previous', r, twin(r, P), false) + diff('% change since previous', r, twin(r, P), true)).join('')
    + F.map(r => row('lt-p lt-f', 'First test (baseline)', r)).join('')
    + L.map(r => diff('Change since first', r, twin(r, F), false) + diff('% change since first', r, twin(r, F), true)).join('');
  return `<table class="t seq lt">${head}<tbody>${body}</tbody></table>`;
}
// latest values of sister phases side by side (same bay / unit, same design) — a cross-check, not a pass/fail rule
const PCP = { ct: ['tand20', 'C'], bushing: ['tand20', 'C'], winding: ['tand20', 'C'], cb_crm: ['R'], cb_timing: ['open1', 'open2', 'close'], la: ['Icorr', 'Ith', 'Itotal'], dga: ['TDCG', 'H2', 'C2H2', 'CO', 'H2O', 'BDV'] };
const PCL = { tand20: ['Corr. tan δ @20 °C', '%', 3], C: ['Capacitance', 'pF', 1], R: ['Contact resistance', 'µΩ', 1], open1: ['Trip TC1', 'ms', 2], open2: ['Trip TC2', 'ms', 2], close: ['Close', 'ms', 2], Icorr: ['Icorr', 'µA', 1], Ith: ['Ith', 'µA', 1], Itotal: ['Itotal', 'µA', 1], TDCG: ['TDCG', 'ppm', 0], H2: ['H₂', 'ppm', 1], C2H2: ['C₂H₂', 'ppm', 1], CO: ['CO', 'ppm', 0], H2O: ['Water', 'ppm', 1], BDV: ['BDV', 'kV', 0] };
function phaseCompare(t, U) {
  const groups = [...groupBy(U.es.filter(e => e.L && /^[RYB]$/.test(e.ph)), e => e.sub.split('|').slice(1).join('|'))].filter(([, es]) => es.length >= 2);
  if (!groups.length) return '';
  const rows = groups.flatMap(([k, es]) => es.sort((a, b) => PHO[a.ph] - PHO[b.ph]) && PCP[t].map(p => {
    const vals = ['R', 'Y', 'B'].map(ph => es.find(e => e.ph === ph)), nums = vals.map(e => e?.L?.v[p]).filter(x => x != null);
    if (nums.length < 2) return '';
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length, dev = mean ? Math.max(...nums.map(x => Math.abs(x - mean) / Math.abs(mean) * 100)) : 0;
    const dates = new Set(vals.filter(Boolean).map(e => e.L.date));
    const [lab, unit, dp] = PCL[p];
    return `<tr><td>${esc(k ? fullName(t, U.u, 'R|' + k, true).replace(/^Rph, /, '') : NOUN[t][0].toUpperCase())}</td><td>${lab} <span class="dim">${unit}</span></td>${vals.map(e => `<td class="r">${e?.L?.v[p] != null ? fmt(e.L.v[p], dp) + (dates.size > 1 ? `<div class="dim sm">${fmtDate(e.L.date)}</div>` : '') : '—'}</td>`).join('')}<td class="r">${fmt(mean, dp)}</td><td class="r">${fmt(dev, 1)} %</td></tr>`; })).join('');
  if (!rows) return '';
  return `<div class="pcmp"><div class="pcmp-h"><b>Phase comparison · latest values</b><span class="dim">sister phases of the same ${HOLDER[t].includes('bay') ? 'bay' : 'unit'} side by side, to verify the readings — judgement stays with the circular limits above</span></div>
    <div class="el-tbl"><table class="t seq pc"><thead><tr><th style="min-width:150px">Element</th><th style="min-width:170px">Parameter</th><th class="r" style="min-width:96px"><span class="ph R">R</span></th><th class="r" style="min-width:96px"><span class="ph Y">Y</span></th><th class="r" style="min-width:96px"><span class="ph B">B</span></th><th class="r" style="min-width:90px">Mean</th><th class="r" style="min-width:150px">Largest deviation from mean</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function elementBlock(t, e, latestOnly) {
  if (latestOnly && !e.done.length) return '';
  const sch = elemDue(t, e.u, lastRowDate(e.rows));
  const st = e.L ? statusOf(e.L) : 'none', od = sch && sch < DB.today;
  return `<div class="el" data-ph="${e.ph}" data-el="${esc(e.u + '|' + e.sub)}">
    <div class="el-h" data-open="${esc(e.u)}" data-sub="${esc(e.sub)}" title="Open this ${NOUN[t][0]} with full history">
      ${e.ph !== '-' && !(PH_UNIT(e.u, e.ph) && ['bushing', 'winding', 'dga'].includes(t)) ? phase(e.ph) : ''}<b>${esc(fullName(t, e.u, e.sub))}</b>${hChip(e.health)}${pill(st)}
      <span class="el-due">${e.L ? 'Next due' : 'Never tested · due'} ${dueTxt(sch)}</span>
      ${t === 'bushing' && e.rows[0]?.mk ? `<span class="dim el-mk">${esc(e.rows[0].mk.replace(/\n/g, ' '))}</span>` : ''}<button class="gl-btn" data-gl title="Show the graphs of this element only (until the page is reloaded)">📈 Graph</button><span class="el-open">${IC.arrow}</span></div>
    <div class="el-b"><div class="el-tbl">${latestOnly ? latestTable(t, e) : seqTable(t, e, false)}</div>${e.done.length ? `<div class="el-ch gx ${CHARTG[t] ? 'two' : ''}">${elemChart(t, e)}</div>` : ''}</div></div>`;
}
function unitBlock(t, U, latestOnly) {
  const hs = U.es.map(e => e.health).filter(x => x != null), worstH = hs.length ? Math.min(...hs) : null;
  return `<section class="ub" data-unit="${esc(U.u)}"><header class="ub-h" data-open="${esc(U.u)}" title="Open all ${NOUN[t][1]} of this ${HOLDER[t].split(' ')[0]}">
    <div><div class="ub-k">${isTF(U.u) ? esc(DB.site.units[U.u].rating) : `${kvOf(U.u)} kV · Bay ${esc(U.u)}`}</div><div class="ub-n">${esc(unitName(U.u))}</div></div>
    <div class="ub-s"><span class="dim">${U.es.length} ${NOUN[t][U.es.length === 1 ? 0 : 1]}</span><span title="Weakest element health">${hChip(worstH)}</span><span class="btn sm">Open ${IC.arrow}</span></div></header>
    ${groupPU(t, U).map(([ph, es]) => (ph ? `<div class="pu-h"><span class="ph ${ph}">${ph}</span><b>${esc(phaseUnitName(U.u, ph))}</b><span class="dim">${es.length} ${NOUN[t][es.length === 1 ? 0 : 1]}</span><a class="btn sm ghost" href="${elHref(t, U.u, ph)}">Open phase unit ${IC.arrow}</a></div>` : '') + es.map(e => elementBlock(t, e, latestOnly)).join('') + (t === 'dga' && ph ? oltcStrip(U.u, ph) : '') + (t === 'dga' && !latestOnly && es.some(e => !e.sub.endsWith('OLTC') && e.done.length) ? dgaAnalysis(U.u, ph || '-') : '')).join('')}${latestOnly && t !== 'winding' ? phaseCompare(t, U) : ''}</section>`;
}
// ICTs: R / Y / B single-phase units each hold their own bushings, windings and tank
function groupPU(t, U) {
  if (!['bushing', 'winding', 'dga'].includes(t) || !/^(ICT1|ICT2)$/.test(U.u)) return [[null, U.es]];
  return [...groupBy(U.es, e => e.ph)];
}
function oltcStrip(u, ph) {
  const c = oltcCorrelation(u, ph); if (!c) return '';
  return `<div class="oltc-strip c-${c.verdict}"><b>OLTC ↔ main tank</b><span>${esc(c.text)}</span>${c.lag ? `<span class="dim">${esc(c.lag)}</span>` : ''}</div>`;
}
function oltcSection(u, ph) {
  const c = oltcCorrelation(u, ph); if (!c) return '';
  return `<div class="card mt"><div class="card-h"><h3>OLTC ↔ main tank${ph !== '-' ? ` · ${ph}-phase unit` : ''}</h3><span class="sub">the OLTC is a separate compartment of the same unit — its arcing gases must not appear in the main tank</span></div>
    <div class="card-b"><div class="oltc-strip c-${c.verdict}" style="margin:0 0 12px"><b>${c.verdict === 'ok' ? 'Contained' : c.verdict === 'alert' ? 'Suspect leakage' : 'Watch'}</b><span>${esc(c.text)}</span>${c.lag ? `<span class="dim">${esc(c.lag)}</span>` : ''}</div>
    <div class="tbl-wrap"><table class="t seq"><thead><tr><th>Main-tank sample</th><th class="r">Main C₂H₂</th><th class="r">Main H₂</th><th class="r">Main C₂H₂ / H₂</th><th>OLTC sample used</th><th class="r">OLTC C₂H₂</th><th class="r">OLTC H₂</th></tr></thead><tbody>
    ${c.rows.slice().reverse().map(r => `<tr><td>${fmtDate(r.d)}</td><td class="r ${r.mC2H2 > 0 ? 'c-watch' : ''}">${fmt(r.mC2H2, 1)}</td><td class="r">${fmt(r.mH2, 0)}</td><td class="r ${r.ratio > 2 ? 'c-alert' : ''}">${r.ratio == null ? '—' : fmt(r.ratio, 2)}</td><td>${r.oDate ? fmtDate(r.oDate) : '<span class="dim">none before</span>'}</td><td class="r">${fmt(r.oC2H2, 1)}</td><td class="r">${fmt(r.oH2, 0)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">IEC 60599: in a main tank, C₂H₂/H₂ above 2–3 together with acetylene in the OLTC oil indicates OLTC oil reaching the main tank (barrier or seal leak) rather than a fault inside the main tank.</p></div></div>`;
}

// ------------------------------------------------------------------ filter state
const FILTER = {};   // t -> Set of units (null = all)
function filterUI(t, M) {
  const sel = FILTER[t], all = M.units.map(x => x.u), on = (u) => !sel || sel.has(u);
  const kvs = [400, 220, 132, 33, 11];
  const cnt = sel ? sel.size : all.length;
  return `<details class="dd" id="flt"><summary>${IC.equipment}<span>${cnt === all.length ? `All ${HOLDER[t].includes('bay') ? 'bays' : 'units'} (${all.length})` : `${cnt} of ${all.length} selected`}</span><span class="caret">▾</span></summary>
    <div class="dd-m"><div class="dd-row"><button class="btn sm" data-f="all">Check all</button><button class="btn sm" data-f="none">Uncheck all</button></div>
      <div class="dd-g">${kvs.map(kv => { const n = all.filter(u => kvOf(u) === kv && !isTF(u)).length; return `<label class="${n ? '' : 'dis'}"><input type="checkbox" data-kv="${kv}" ${n ? '' : 'disabled'} ${n && all.filter(u => kvOf(u) === kv && !isTF(u)).every(on) ? 'checked' : ''}> ${kv} kV bays <span class="dim">${n || 'none'}</span></label>`; }).join('')}</div>
      <div class="dd-l">${all.map(u => `<label><input type="checkbox" data-u="${esc(u)}" ${on(u) ? 'checked' : ''}> <b>${esc(unitName(u))}</b> <span class="dim">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</span></label>`).join('')}</div></div></details>`;
}
function wireFilter(root, t, M, rerender) {
  const all = M.units.map(x => x.u), set = () => FILTER[t] || new Set(all);
  $$('[data-f]', root).forEach(b => b.onclick = () => { FILTER[t] = b.dataset.f === 'all' ? null : new Set(); rerender(); });
  $$('[data-kv]', root).forEach(c => c.onchange = () => { const s = set(); all.filter(u => kvOf(u) === +c.dataset.kv && !isTF(u)).forEach(u => c.checked ? s.add(u) : s.delete(u)); FILTER[t] = s.size === all.length ? null : s; rerender(); });
  $$('[data-u]', root).forEach(c => c.onchange = () => { const s = set(); c.checked ? s.add(c.dataset.u) : s.delete(c.dataset.u); FILTER[t] = s.size === all.length ? null : s; rerender(); });
}

// ------------------------------------------------------------------ admin inline editing
function wireEditing(root) {
  $$('td.ed', root).forEach(td => td.onclick = (ev) => {
    if (td.querySelector('input')) return; ev.stopPropagation();
    const src = td.dataset.src, k = td.dataset.k, r = DB.records.find(x => x.src === src); if (!r) return;
    const cur = r.edited?.[k]?.raw ?? (k === 'rem' ? r.rem || '' : k === 'date' ? r.date : r.f?.[k] && !r.edited?.[k] ? r.f[k] : (r.v[k] ?? ''));
    const inp = document.createElement('input'); inp.className = 'cell-in'; inp.value = cur; inp.placeholder = k === 'date' ? 'YYYY-MM-DD' : 'value or =formula';
    td.textContent = ''; td.appendChild(inp); inp.focus(); inp.select();
    const save = (keep) => { if (keep) { const raw = inp.value.trim(); const orig = k === 'rem' ? r.rem0 : k === 'date' ? r.date0 : r.v0?.[k]; setCell(src, k, raw === String(orig ?? '') ? null : raw); refresh(); CTX.rerun(); } CTX.rerender(); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') save(true); if (e.key === 'Escape') save(false); };
    inp.onblur = () => save(true);
  });
  $$('[data-add]', root).forEach(b => b.onclick = (ev) => {
    ev.stopPropagation(); const [t, u, ...sub] = b.dataset.add.split('|'); const s = sub.join('|'), L = DB.records.filter(r => r.t === t && r.unit === u && ELEM[t](r) === `${u}|${s}`).at(-1);
    const today = new Date().toISOString().slice(0, 10);
    addRow({ t, ...(TANT.includes(t) && VIEW.tv === 5 ? { tv: 5 } : {}), unit: u, pos: L?.pos ?? (t === 'bushing' || t === 'dga' ? s.split('|')[t === 'bushing' ? 0 : 1] : ''), ph: L?.ph ?? phOf(t, s), acting: L?.acting, mode: L?.mode, date: today, ses: '', v: {}, rem: '' });
    refresh(); CTX.rerun(); CTX.rerender();
  });
  $$('[data-del]', root).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); if (confirm('Delete this added row?')) { deleteNewRow(b.dataset.del); refresh(); CTX.rerun(); CTX.rerender(); } });
}

// ------------------------------------------------------------------ test voltage (tan δ tests): 10 kV default, 5 kV on request
export const tvSwitch = (t) => TANT.includes(t) && viewPref('show5') ? `<div class="seg tvseg" title="Tan δ / capacitance results at the chosen test voltage; 10 kV is the default and is used for every judgement">${[10, 5].map(v => `<button class="${VIEW.tv === v ? 'on' : ''}" data-tv="${v}">${v} kV${v === 10 ? ' (default)' : ''}</button>`).join('')}</div>` : '';
const tvBanner = (t) => TANT.includes(t) && VIEW.tv === 5 ? `<div class="tv-ban">Showing <b>5 kV</b> results (${DB.r5.filter(r => r.t === t).length} on record). Health, findings, due dates and targets always use the 10 kV results.</div>` : '';
function wireTV(root) { $$('[data-tv]', root).forEach(b => b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); setTestVoltage(+b.dataset.tv); CTX.rerender({ keepScroll: true }); }); }

// ------------------------------------------------------------------ admin view toggles
export const applyView = () => { const h = document.documentElement; if (!viewPref('show5') && VIEW.tv === 5) setTestVoltage(10); h.classList.toggle('no-graphs', !viewPref('graphs')); h.classList.toggle('no-history', !viewPref('history')); h.dataset.ts = viewPref('text') || 0; };
const gBtn = () => isAdmin() ? `<button class="tg-btn ${viewPref('graphs') ? 'on' : ''}" data-gtog title="Admin: show or hide all graphs in the results">${IC.trend || ''}<span>Graphs ${viewPref('graphs') ? 'on' : 'off'}</span><i></i></button>` : '';
function wireToggles(root) {
  $$('[data-gtog]', root).forEach(b => b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); setViewPref('graphs', !viewPref('graphs')); applyView();
    $$('[data-gtog]').forEach(x => { x.classList.toggle('on', viewPref('graphs')); x.querySelector('span').textContent = `Graphs ${viewPref('graphs') ? 'on' : 'off'}`; }); });
  $$('[data-btog]', root).forEach(b => b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); setViewPref('blank', !viewPref('blank')); CTX.rerender({ keepScroll: true }); });
  $$('[data-cod]', root).forEach(i => i.onchange = () => { setCod(i.dataset.cod, i.value || null); CTX.rerender({ keepScroll: true }); });
}

// ------------------------------------------------------------------ never tested since commissioning
function neverPanel(t, M) {
  const N = NOUN[t], holder = HOLDER[t].includes('bay') ? 'bays' : 'units';
  if (VIEW.tv === 5 && TANT.includes(t)) return '';
  const blank = M.elements.filter(e => !e.done.length); if (!blank.length) return '';
  const blankUnits = M.units.filter(U => U.es.every(e => !e.done.length));
  const interval = t === 'la' ? 'first monsoon window' : t === 'ct' ? '12 / 24 months' : `${months(t, 'x')} months`;
  const tog = isAdmin() ? `<button class="tg-btn ${viewPref('blank') ? 'on' : ''}" data-btog title="Admin: show or hide ${holder} with no test at all in the results below"><span>Blank ${holder} ${viewPref('blank') ? 'shown' : 'hidden'} (${blankUnits.length})</span><i></i></button>`
    : !viewPref('blank') && blankUnits.length ? `<span class="note">${blankUnits.length} blank ${holder} hidden by admin</span>` : '';
  return `<section class="card never mt"><div class="card-h"><span class="nv-ic">${IC.schedule}</span><h3>Never tested since commissioning</h3>
      <span class="sub">${blank.length} ${N[blank.length === 1 ? 0 : 1]} in ${new Set(blank.map(e => e.u)).size} ${holder} have no result on record · due = commissioning date + circular interval (${interval})</span><div class="sp"></div>${tog}</div>
    <div class="tbl-wrap"><table class="t never-t"><thead><tr><th style="min-width:230px">${holder === 'bays' ? 'Bay' : 'Unit'}</th><th style="min-width:300px">Never-tested ${N[1]}</th><th class="r" style="min-width:140px">Commissioned</th><th class="r" style="min-width:170px">Due (commissioning + interval)</th><th style="min-width:110px">Status</th></tr></thead><tbody>
    ${[...groupBy(blank, e => e.u)].map(([u, es]) => { const cod = codOf(u), due = codDue(t, u), od = due && due < DB.today, all = es.length === M.units.find(x => x.u === u)?.es.length;
      return `<tr><td><a href="${elHref(t, u)}"><b>${esc(unitName(u))}</b></a> <span class="dim">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</span>${all ? ' <span class="tag">blank</span>' : ''}</td>
        <td>${all ? `all ${es.length} ${N[es.length === 1 ? 0 : 1]}` : es.map(e => esc(fullName(t, u, e.sub, true))).join(' · ')}</td>
        <td class="r">${isAdmin() ? `<input type="date" class="cod-in" data-cod="${esc(u)}" value="${cod || ''}" title="Admin: commissioning date">` : fmtDate(cod)}</td>
        <td class="r">${dueTxt(due)}</td><td>${od ? 'overdue' : 'due'}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
}

// ------------------------------------------------------------------ winding: latest results cross-checked (as the sheet's "Last Test Results")
// The six capacitances of one two-winding unit are not independent: C(HV-LV) measured from either end must agree,
// and each GST reading must equal the sum of its GSTg and UST parts (C, and the capacitance-weighted tan δ).
const WG = [['HV-LV', ['C(HV-LV)', 'C(HV)', 'C(HV)+C(HV-LV)']], ['LV-HV', ['C(LV-HV)', 'C(LV)', 'C(LV)+C(HV-LV)']]];
const cSev = (d) => d == null ? '' : Math.abs(d) > 2 ? 'alert' : Math.abs(d) > 1 ? 'watch' : 'ok';
const tSev = (d) => d == null ? '' : Math.abs(d) > 25 ? 'alert' : Math.abs(d) > 10 ? 'watch' : 'ok';
const CHK = { ok: 'consistent', watch: 'check set-up', alert: 're-test / verify connections', '': '' };
export function windingChecks(L) {
  const v = (a, k) => L[a]?.v[k], out = [];
  if (L['C(HV-LV)'] && L['C(LV-HV)']) { const a = v('C(HV-LV)', 'C'), b = v('C(LV-HV)', 'C'), d = (a - b) / a * 100;
    out.push({ k: 'Inter-winding C from both ends (UST)', f: '[C(HV-LV) − C(LV-HV)] ÷ C(HV-LV)', calc: a, meas: b, cl: 'C(HV-LV)', ml: 'C(LV-HV)', d, u: 'pF', dp: 1, sev: cSev(d) }); }
  for (const [side, [ust, gstg, gst]] of WG) if (L[ust] && L[gstg] && L[gst]) {
    const calc = v(gstg, 'C') + v(ust, 'C'), meas = v(gst, 'C'), d = (calc - meas) / meas * 100;
    out.push({ k: `${side}: ${gstg} + ${ust} = GST`, f: '(GSTg + UST − GST) ÷ GST', calc, meas, cl: 'calculated', ml: 'measured GST', d, u: 'pF', dp: 1, sev: cSev(d) });
    const tc = (v(gstg, 'C') * v(gstg, 'tand') + v(ust, 'C') * v(ust, 'tand')) / calc, tm = v(gst, 'tand'), dt = tm ? (tc - tm) / tm * 100 : null;
    out.push({ k: `${side}: GST tan δ = C-weighted tan δ of its parts`, f: '(C·tanδ GSTg + C·tanδ UST) ÷ (C GSTg + C UST)', calc: tc, meas: tm, cl: 'calculated', ml: 'measured GST', d: dt, u: '%', dp: 3, sev: tSev(dt) });
  }
  return out;
}
function windingLatest(M) {
  const blocks = [];
  for (const U of M.units) {
    const pus = groupPU('winding', U).filter(([, es]) => es.some(e => e.L)); if (!pus.length) continue;
    const cards = pus.map(([ph, es]) => {
      const L = {}; for (const e of es) if (e.L) L[e.sub.split('|')[1]] = e.L;
      const name = ph ? `${shortUnit(U.u)}, ${ph}ph` : shortUnit(U.u);
      const groups = U.u === 'BUS_REACTOR' ? [['HV-E', Object.keys(L)]] : WG;
      const dates = new Set(Object.values(L).map(r => r.date));
      const REA = U.u === 'BUS_REACTOR';
      const IP = Object.values(L).some(r => r.v.I != null || r.v.P != null);   // the sheet leaves I and P blank for windings
      const rows = groups.map(([side, acts]) => acts.filter(a => L[a]).map((a, i, arr) => { const r = L[a], x = r.v;
        return `<tr data-date="${r.date}">${i === 0 && !REA ? `<td rowspan="${arr.length}" class="wl-side">${side}</td>` : ''}<td>${esc(r.mode || WMODE[a] || '')}</td><td><b>${esc(a)}</b></td><td>${esc(r.ses || '')}</td><td>${fmtDate(r.date)}</td>
          <td class="r">${fmt(x.C, 1)}</td><td class="r">${fmt(x.tand, 3)}</td><td class="r">${fmt(x.U, 2)}</td>${IP ? `<td class="r">${fmt(x.I, 2)}</td><td class="r">${fmt(x.P, 2)}</td>` : ''}<td class="r">${fmt(x.F, 2)}</td><td class="r">${fmt(x.temp, 0)}</td>
          <td class="r c-${cellSev('winding', 'tand20', x.tand20, r)}"><b>${fmt(x.tand20, 3)}</b></td><td class="r c-${cellSev('winding', 'dTand', x.dTand, r)}">${fmt(x.dTand, 3)}</td><td class="r c-${cellSev('winding', 'dC', x.dC, r)}">${fmt(x.dC, 2)}</td></tr>`; }).join('')).join('');
      const ck = windingChecks(L);
      return `<div class="wl-pu" data-ph="${ph || '-'}"><div class="wl-h">${ph ? `<span class="ph ${ph}">${ph}</span>` : ''}<b>${esc(name)}</b>${ph && DB.site.units[U.u]?.serials?.[ph] ? `<span class="dim">Sr ${esc(DB.site.units[U.u].serials[ph])}</span>` : ''}${dates.size > 1 ? `<span class="lg d-fy">readings from ${dates.size} different dates</span>` : ''}<a class="btn sm ghost" href="${elHref('winding', U.u, ph || null)}">Open ${IC.arrow}</a></div>
        <div class="el-tbl"><table class="t seq wl"><thead><tr>${REA ? '' : '<th style="min-width:70px">Winding</th>'}<th style="min-width:56px">Mode</th><th style="min-width:128px">C (acting)</th><th style="min-width:68px">Session</th><th style="min-width:100px">Date of test</th><th class="r" style="min-width:90px">C (pF)</th><th class="r" style="min-width:78px">Tan δ %</th><th class="r" style="min-width:62px">U (kV)</th>${IP ? '<th class="r" style="min-width:62px">I (mA)</th><th class="r" style="min-width:62px">P (W)</th>' : ''}<th class="r" style="min-width:62px">F (Hz)</th><th class="r" style="min-width:60px">Temp °C</th><th class="r" style="min-width:100px">Corr. tan δ % @20 °C</th><th class="r" style="min-width:92px">Tan δ ↑ vs previous</th><th class="r" style="min-width:92px">C change % vs previous</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${ck.length ? `<div class="wl-ck">${ck.map(c => `<div class="ck c-${c.sev}"><div class="ck-k">${esc(c.k)}</div><div class="ck-v"><span>${c.cl} <b>${fmt(c.calc, c.dp)}</b></span><span>${c.ml} <b>${fmt(c.meas, c.dp)}</b></span><span class="ck-d">${c.d > 0 ? '+' : c.d < 0 ? '−' : ''}${fmt(Math.abs(c.d), 2)} %</span></div><div class="ck-f">${esc(c.f)} · <b>${CHK[c.sev]}</b></div></div>`).join('')}</div>` : ''}</div>`;
    });
    // sister phase units side by side
    const sis = pus.length > 1 ? (() => { const acts = WG.flatMap(([, a]) => a);
      const rows = acts.map(a => { const es = ['R', 'Y', 'B'].map(ph => U.es.find(e => e.ph === ph && e.sub.endsWith('|' + a))?.L); if (es.filter(Boolean).length < 2) return '';
        const cs = es.filter(Boolean).map(r => r.v.C), m = cs.reduce((x, y) => x + y, 0) / cs.length, dev = Math.max(...cs.map(c => Math.abs(c - m) / m * 100));
        const ts = es.filter(Boolean).map(r => r.v.tand20), spread = Math.max(...ts) - Math.min(...ts);
        return `<tr><td><b>${esc(a)}</b> <span class="dim">${WMODE[a] || ''}</span></td>${es.map(r => `<td class="r">${r ? fmt(r.v.C, 1) : '—'}</td>`).join('')}<td class="r ${dev > 3 ? 'c-watch' : ''}">${fmt(dev, 2)} %</td>${es.map(r => `<td class="r c-${r ? cellSev('winding', 'tand20', r.v.tand20, r) : ''}">${r ? fmt(r.v.tand20, 3) : '—'}</td>`).join('')}<td class="r ${spread > 0.1 ? 'c-watch' : ''}">${fmt(spread, 3)}</td></tr>`; }).join('');
      return rows ? `<div class="wl-pu wl-sis"><div class="wl-h"><b>${esc(shortUnit(U.u))} · R / Y / B phase units compared</b><span class="dim">identical single-phase units — capacitance within ~3 % and corrected tan δ within 0.1 % of each other is expected</span></div>
        <div class="el-tbl"><table class="t seq"><thead><tr><th style="min-width:170px">C (acting)</th><th class="r" style="min-width:90px">C Rph (pF)</th><th class="r" style="min-width:90px">C Yph (pF)</th><th class="r" style="min-width:90px">C Bph (pF)</th><th class="r" style="min-width:110px">C largest dev. from mean</th><th class="r" style="min-width:90px">tan δ20 Rph</th><th class="r" style="min-width:90px">tan δ20 Yph</th><th class="r" style="min-width:90px">tan δ20 Bph</th><th class="r" style="min-width:100px">tan δ20 spread</th></tr></thead><tbody>${rows}</tbody></table></div></div>` : ''; })() : '';
    blocks.push(`<section class="ub" data-unit="${esc(U.u)}"><header class="ub-h" data-open="${esc(U.u)}"><div><div class="ub-k">${esc(DB.site.units[U.u]?.rating || '')}</div><div class="ub-n">${esc(unitName(U.u))}</div></div><div class="ub-s"><span class="btn sm">Open ${IC.arrow}</span></div></header>${cards.join('')}${sis}</section>`);
  }
  return blocks.join('');
}

// ------------------------------------------------------------------ sections
const FYS = () => { const y = parseInt(curFY(), 10); return [-1, 0, 1, 2].map(i => `${y - i}-${String(y - i + 1).slice(2)}`); };
export const nextFY = () => { const y = parseInt(curFY(), 10) + 1; return `${y}-${String(y + 1).slice(2)}`; };
let FY_SEL = null, RANK_SEL = {}, CLASS_SEL = {};

export function renderSections(t, mount) {
  const T = TESTS[t], M = model(t), fy = FY_SEL || curFY(), N = NOUN[t];
  const pr = progress(t, M, fy);
  const latest = M.elements.filter(e => e.L);
  const sevs = latest.map(e => statusOf(e.L));
  const testedFY = M.elements.filter(e => e.done.some(r => inFY(r.date, fy))).length;
  const unitsFY = new Set(M.elements.filter(e => e.done.some(r => inFY(r.date, fy))).map(e => e.u)).size;
  const bad = sevs.filter(s => SEV[s] >= 3).length, watch = sevs.filter(s => s === 'watch').length;
  const hs = latest.map(e => e.health).filter(x => x != null), avgH = hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : null;
  const weakest = latest.filter(e => e.health != null).sort((a, b) => a.health - b.health)[0];
  const holder = HOLDER[t].includes('bay') ? 'bays' : 'units';
  const card = (cls, ic, k, v, d, extra = '') => `<div class="fcard ${cls}"><div class="fc-ic">${ic}</div><div class="fc-k">${k}</div><div class="fc-v">${v}</div><div class="fc-d">${d}</div>${extra}</div>`;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const ringPct = pr.T.pct ?? 0;
  const html = `
  <section class="fcards">
    ${card('c-blue', IC[t], `${cap(N[1])} tested in FY ${fy}`, `${testedFY}<small> / ${M.elements.length}</small>`, `across ${unitsFY} ${unitsFY === 1 ? holder.replace(/s$/, '') : holder} · population ${M.elements.length} ${N[1]}`)}
    ${card('c-teal', IC.schedule, `FY ${fy} progress`, `${pr.T.pct ?? '—'}<small>%</small>`, `${pr.T.prog} of ${pr.T.target} ${N[1]} targeted this FY (${pr.T.override ? 'declared' : 'policy 50 % + 1'})`, `<div class="fc-bar"><span style="width:${ringPct}%"></span></div>`)}
    ${card(bad ? 'c-amber' : 'c-green', IC.findings, 'Outside circular limit', `${bad}<small> ${bad === 1 ? N[0] : N[1]}</small>`, `${watch} more on watch · ${latest.length - bad - watch} normal`)}
    ${card('c-violet', IC.equipment, `Average ${N[0]} health`, `${avgH ?? '—'}<small>/100</small>`, weakest ? `weakest: ${fullName(t, weakest.u, weakest.sub)} (${weakest.health})` : '—')}
  </section>
  ${neverPanel(t, M)}

  <details class="sec" id="secRank"><summary><span class="sec-t">${IC.standards} Fleet ranking</span><span class="dim">${N[1]} of the same voltage class / rating ranked by any circular parameter</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="rank-class"><span class="note">Comparable class</span><div class="seg" id="classSeg"></div></div><div class="seg" id="rankSeg">${RANKP[t].map((p, i) => `<button class="${(RANK_SEL[t] ?? 0) === i ? 'on' : ''}" data-i="${i}">${p.label}</button>`).join('')}</div>
    <div class="rank-wrap"><canvas id="rankCv2"></canvas></div><p class="note" id="rankNote"></p></div></details>

  <details class="sec" open><summary><span class="sec-t">${IC.schedule} Yearly progress · ${esc(T.name)}</span><span class="dim">target policy: one more than half the population every year${t === 'la' ? ' (LA: all every year, half by 30 Sep)' : ''} · admin can declare the target</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="toolbar"><a class="btn pri" href="#/targets?t=${t}">${IC.schedule} Set FY targets</a><div class="seg" id="fySeg">${FYS().map(f => `<button class="${f === fy ? 'on' : ''}" data-fy="${f}">FY ${f}${f === nextFY() ? ' (next)' : ''}</button>`).join('')}</div><span class="note">${months(t, 'x') < 12 || t === 'ct' ? `Frequency: ${t === 'ct' ? '400 kV 2-yearly · 220 kV yearly' : t === 'la' ? 'pre- and post-monsoon (2 per year)' : t === 'dga' ? '½-yearly (2 per year)' : ''}` : `Frequency: every ${months(t, 'x') / 12 === 1 ? 'year' : months(t, 'x') / 12 + ' years'}`}</span></div>
    ${lastFyStrip(t, M, fy, pr)}${progressTable(t, pr, fy)}</div></details>

  ${t === 'winding' ? `<details class="sec" open id="secWL"><summary><span class="sec-t">${IC.findings} Latest tan δ results · cross-checked</span><span class="dim">latest test of each phase unit with the sheet's checks — C(HV-LV) from both ends, GST = GSTg + UST (C and tan δ), and R / Y / B compared</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div id="secWLb">${windingLatest(M)}</div><p class="note">Checks are measurement-consistency rules used in practice (Doble / IEEE C57.152 test-set-up checks): within 1 % consistent, 1–2 % check the set-up, over 2 % re-test. They validate the readings; the insulation itself is judged on corrected tan δ against the circular.</p></div></details>` : ''}

  <details class="sec" open id="secLatest"><summary><span class="sec-t">${IC.findings} Latest test results</span><span class="dim">latest completed test of each ${N[0]} with previous & first test and the change since each · graphs always show the full history</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="toolbar">${tvSwitch(t)}</div>${tvBanner(t)}<div id="seqLatest"></div></div></details>

  <details class="sec" open id="secAll"><summary><span class="sec-t">${IC.norms} Detailed test results · sequence-wise</span><span class="dim">every test of every ${N[0]}, as in the sheet — click a ${HOLDER[t].split(' ')[0]} or ${N[0]} to open it</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="toolbar">${filterUI(t, M)}${tvSwitch(t)}<span class="legend">${legend(t)}</span></div>${tvBanner(t)}<div id="seqAll"></div></div></details>

`;
  mount.innerHTML = html;
  const drawSeq = () => {
    const sel = FILTER[t], us = M.units.filter(U => (!sel || sel.has(U.u)) && (viewPref('blank') || U.es.some(e => e.done.length)));
    $('#seqAll', mount).innerHTML = us.map(U => unitBlock(t, U, false)).join('') || '<div class="empty">Nothing selected — use the filter.</div>';
    $('#seqLatest', mount).innerHTML = us.map(U => unitBlock(t, U, true)).join('') || '<div class="empty">Nothing selected.</div>';
    $$('[data-open]', mount).forEach(el => el.onclick = (ev) => { if (ev.target.closest('td.ed, input, button[data-add], button[data-del], [data-gl]')) return; openElement(t, el.dataset.open, el.dataset.sub || null); });
    wireEditing(mount); wireChartChips(mount);
  };
  drawSeq();
  applyView(); wireToggles(mount); wireTV(mount);
  $$('#secWLb [data-open]', mount).forEach(el => el.onclick = () => openElement('winding', el.dataset.open));
  wireInteractive(mount);
  wireFilter(mount, t, M, () => CTX.rerender({ keepScroll: true }));
  $$('#fySeg button', mount).forEach(b => b.onclick = () => { FY_SEL = b.dataset.fy; CTX.rerender({ keepScroll: true }); });
  $$('[data-tgt]', mount).forEach(inp => inp.onchange = () => { setTarget(inp.dataset.tgt, inp.value === '' ? null : inp.value); CTX.rerender({ keepScroll: true }); });
  // ranking (drawn when opened)
  const drawRank = () => rankChart(t, M, RANK_SEL[t] ?? 0, mount);
  $('#secRank', mount).addEventListener('toggle', (e) => { if (e.target.open) drawRank(); });
  $$('#rankSeg button', mount).forEach(b => b.onclick = () => { RANK_SEL[t] = +b.dataset.i; $$('#rankSeg button', mount).forEach(x => x.classList.toggle('on', x === b)); drawRank(); });
}

function legend(t) {
  return `<span class="lg c-ok">within limit</span><span class="lg c-watch">watch</span><span class="lg c-alert">beyond circular</span><span class="lg c-critical">critical</span><span class="lg fxl">ƒ formula</span><span class="lg c-fy">tested this FY</span>`;
}

function lastFyStrip(t, M, fy, pr) {
  const pf = prevFY(fy), pp = progress(t, M, pf);
  const chip = (k, v, d = '') => `<div class="ly-c"><span>${k}</span><b>${v}</b>${d ? `<small>${d}</small>` : ''}</div>`;
  return `<div class="ly">
    <div class="ly-g"><div class="ly-h">FY ${pf} <span class="dim">last year</span></div>${chip('Target', pp.T.target, pp.T.override ? 'declared' : 'policy')}${chip('Achieved', pp.T.prog, `${pp.T.pct ?? 0} %`)}</div>
    <div class="ly-g cur"><div class="ly-h">FY ${fy} <span class="dim">selected</span></div>${chip('Target', pr.T.target, pr.T.override ? 'declared' : 'policy')}${chip('Achieved', pr.T.prog, `${pr.T.pct ?? 0} %`)}${t === 'la' ? chip('By 30 Sep', `${pr.T.h1} / ${pr.T.h1Target}`, 'half-year: 50 %') : ''}${chip('Pending', Math.max(0, pr.T.target - pr.T.prog))}</div></div>`;
}
function progressTable(t, pr, fy) {
  const adm = isAdmin(), [, end] = fyRange(fy);
  return `<div class="tbl-wrap"><table class="t prog"><thead><tr><th>${HOLDER[t].includes('bay') ? 'Bay' : 'Unit'}</th><th class="r">${NOUN[t][0].toUpperCase() === NOUN[t][0] ? NOUN[t][0] : NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1)} population</th><th class="r">Target FY ${fy}</th><th class="r">Progress FY ${fy}</th><th style="min-width:140px">%</th><th class="r">Last tested</th><th class="r">Next due</th><th class="r">Pending</th></tr></thead><tbody>
  ${pr.rows.map(r => `<tr><td><a href="#/eq/${r.u}?t=${t}"><b>${esc(unitName(r.u))}</b></a> <span class="dim">${esc(isTF(r.u) ? '' : bayTitle(r.u))}</span></td><td class="r">${r.pop}</td>
    <td class="r">${adm ? `<input class="tgt" type="number" min="0" data-tgt="${t}|${fy}|${esc(r.u)}" value="${r.override ? r.target : ''}" placeholder="${r.auto}">` : `${r.target}${r.override ? ' <span class="tag ver" title="Set by admin">set</span>' : ''}`}</td>
    <td class="r">${r.prog}${r.extra ? ` <span class="dim" title="Tested though not due">+${r.extra}</span>` : ''}</td>
    <td>${r.pct == null ? '<span class="dim">not due</span>' : `<div class="pbar"><span style="width:${r.pct}%" class="${r.pct >= 100 ? 'full' : ''}"></span></div><span class="pnum">${r.pct}%</span>`}</td>
    <td class="r ${r.last && inFY(r.last, fy) ? 'c-fy' : ''}">${r.last ? fmtDate(r.last) : '<span class="dim">never</span>'}</td><td class="r">${dueTxt(r.next)}${r.by && r.next && (!r.last || r.by.last !== r.last) ? `<div class="due-by">${esc(r.by.k)} · ${r.by.last ? 'last ' + fmtDate(r.by.last) : 'never tested'}</div>` : ''}</td><td class="r"><b>${Math.max(0, r.target - r.prog)}</b></td></tr>`).join('')}
  </tbody><tfoot><tr><td><b>Total</b></td><td class="r"><b>${pr.T.pop}</b></td><td class="r">${adm ? `<input class="tgt" type="number" min="0" data-tgt="${t}|${fy}|*" value="${pr.T.override ? pr.T.target : ''}" placeholder="${pr.T.autoTarget}" title="Annual target (blank = policy ⌊N/2⌋+1${t === 'la' ? ', LA 100 %' : ''})">` : `<b>${pr.T.target}</b>`}</td><td class="r"><b>${pr.T.prog}</b></td><td>${pr.T.pct == null ? '' : `<div class="pbar big"><span style="width:${pr.T.pct}%"></span></div><span class="pnum"><b>${pr.T.pct}%</b></span>`}</td><td></td><td></td><td class="r"><b>${Math.max(0, pr.T.target - pr.T.prog)}</b></td></tr></tfoot></table></div>
  <p class="note"><b>Target policy:</b> ${t === 'la' ? `all ${pr.T.pop} LAs every year (100 %) and half of them (${pr.T.h1Target}) by 30 Sep` : `one more than half of the population every year — ⌊${pr.T.pop} ÷ 2⌋ + 1 = <b>${pr.T.policy}</b>`}; per ${HOLDER[t].includes('bay') ? 'bay' : 'unit'} the calculated figure is what falls due under the circular (${pr.T.due} in total). </p>
  <p class="note">Next due: <b class="due due-red">overdue</b> <b class="due due-yel">within a month</b> <b class="due due-grn">not yet due</b> · <span class="lg c-fy">tested in FY ${fy}</span>. ${adm ? 'Type a number in "Target" to declare the annual target (leave blank for the calculated value).' : 'Admin can declare the annual target.'}</p>`;
}

// Comparable class of an element: same voltage class, rating and position (make where known).
export function classOf(t, e) {
  if (isTF(e.u)) {
    const rating = e.u === 'BUS_REACTOR' ? '125 MVAr reactor' : e.u === 'SPARE_ICT' ? '167 MVA 1-ph ICT' : '501 MVA ICT (167 MVA 1-ph units)';
    const make = DB.site.units[e.u]?.make ? ` · ${DB.site.units[e.u].make}` : '';
    if (t === 'bushing') return `${e.sub.split('|')[1] || 'Phase'} bushings · ${rating}`;
    if (t === 'winding') return `${e.sub.split('|')[1]} · ${rating}${make}`;
    if (t === 'dga') return `${e.sub.split('|')[1] === 'OLTC' ? 'OLTC compartments' : 'Main tanks'} · ${rating}${make}`;
    return rating;
  }
  return `${kvOf(e.u)} kV ${NOUN[t][1]}`;
}
function rankChart(t, M, i, mount) {
  const p = RANKP[t][i], cv = $('#rankCv2', mount); if (!cv) return;
  const classes = [...new Set(M.elements.filter(e => e.L).map(e => classOf(t, e)))].sort();
  const cls = classes.includes(CLASS_SEL[t]) ? CLASS_SEL[t] : classes[0];
  const cs = $('#classSeg', mount);
  if (cs) { cs.innerHTML = classes.map(c => `<button class="${c === cls ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join(''); $$('button', cs).forEach(b => b.onclick = () => { CLASS_SEL[t] = b.dataset.c; rankChart(t, M, RANK_SEL[t] ?? 0, mount); }); }
  const rows = M.elements.filter(e => e.L && p.get(e.L) != null && classOf(t, e) === cls).map(e => ({ e, v: p.get(e.L), sev: cellSev(t, p.k, p.get(e.L), e.L) || 'ok' }))
    .sort((a, b) => p.asc ? a.v - b.v : (p.abs ? Math.abs(b.v) - Math.abs(a.v) : b.v - a.v)).slice(0, 40);
  const old = Chart.getChart(cv); if (old) old.destroy();
  cv.parentElement.style.height = Math.max(160, 40 + rows.length * 19) + 'px';
  const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const col = { ok: c('--brand-2'), watch: c('--watch'), alert: c('--alert'), critical: c('--crit') };
  new Chart(cv, { type: 'bar', data: { labels: rows.map(r => fullName(t, r.e.u, r.e.sub)), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => col[r.sev] + (r.sev === 'ok' ? '99' : '')), borderRadius: 4, barThickness: 13 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${fmt(it.raw, p.dp)} ${p.unit} · ${fmtDate(rows[it.dataIndex].e.L.date)}` } } },
      onClick: (_e, els) => { if (els[0]) { const r = rows[els[0].index]; openElement(t, r.e.u, r.e.sub); } },
      scales: { x: { grid: { color: c('--line') }, ticks: { color: c('--ink-3') }, title: { display: true, text: `${p.label} (${p.unit})`, color: c('--ink-3') } }, y: { grid: { display: false }, ticks: { color: c('--ink-2'), font: { size: 11 } } } } } });
  $('#rankNote', mount).textContent = `Compared only within one class — same voltage class, rating and position (make where recorded). Latest completed test of each ${NOUN[t][0]}; colours follow the circular / industry rule; click a bar to open it.`;
}

// ------------------------------------------------------------------ pop-up: a bay / unit with its elements
const BIG = {
  ct: [['tand20', 'Corrected tan δ % @20 °C', [{ y: 0.5, label: 'IEC 0.5 %', sev: 'watch' }, { y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }]], ['dTand', 'Tan δ rise since previous test (%)', [{ y: 0.1, label: '0.1 %', sev: 'alert' }]], ['C', 'Capacitance (pF)', []], ['dC', 'C change since previous test (%)', [{ y: 10, label: '+10 %', sev: 'alert' }, { y: -5, label: '−5 %', sev: 'alert', lo: true }]]],
  cb_crm: [['R', 'Contact resistance (µΩ)', u => [{ y: LIM.crm[kvOf(u)], label: `Circular ${LIM.crm[kvOf(u)]} µΩ`, sev: 'alert' }]], ['I', 'Applied current (A)', []]],
  cb_timing: [['open1', 'Trip time TC1 (ms)', u => [{ y: LIM.trip[kvOf(u)], label: `${LIM.trip[kvOf(u)]} ms`, sev: 'alert' }]], ['open2', 'Trip time TC2 (ms)', u => [{ y: LIM.trip[kvOf(u)], label: `${LIM.trip[kvOf(u)]} ms`, sev: 'alert' }]], ['close', 'Close time (ms)', [{ y: 150, label: '150 ms', sev: 'alert' }]], ['co1', 'Close-Open TC1 (ms)', []]],
  la: [['Icorr', 'Icorr — 3rd-harmonic resistive (µA)', [{ y: 150, label: '150 µA', sev: 'alert' }, { y: 350, label: '350 µA', sev: 'critical' }]], ['Ith', 'Ith (µA)', []], ['Itotal', 'Itotal (µA)', []]],
  dga: [['H2', 'H₂ (ppm)', [{ y: 100, label: '100', sev: 'watch' }]], ['CH4', 'CH₄ (ppm)', [{ y: 120, label: '120', sev: 'watch' }]], ['C2H4', 'C₂H₄ (ppm)', [{ y: 50, label: '50', sev: 'watch' }]], ['C2H2', 'C₂H₂ (ppm)', [{ y: 1, label: '1', sev: 'alert' }]], ['CO', 'CO (ppm)', [{ y: 350, label: '350', sev: 'watch' }]], ['TDCG', 'TDCG (ppm)', [{ y: 720, label: '720', sev: 'watch' }]], ['BDV', 'BDV (kV)', [{ y: 50, label: '50 kV', sev: 'alert', lo: true }]], ['H2O', 'Water (ppm)', [{ y: 20, label: '20 ppm', sev: 'alert' }]]],
};
BIG.bushing = BIG.ct.map(x => x[0] === 'C' ? ['C', 'Capacitance C₁ (pF)', []] : x);
BIG.winding = BIG.ct.map(x => x);

export const elHref = (t, u, sub) => `#/el/${t}/${encodeURIComponent(u)}${sub ? '/' + encodeURIComponent(sub) : ''}`;
export function openElement(t, u, sub) { location.hash = elHref(t, u, sub); }

/** Dedicated page for one bay / unit (all its elements) or one element (phase, bushing, point…). */
export function renderElementPage(t, u, sub, mount) {
  const M = model(t), U = M.units.find(x => x.u === u);
  const T = TESTS[t];
  if (!U) { mount.innerHTML = '<div class="empty">No such equipment for this test.</div>'; return; }
  const isPU = sub && !sub.includes('|') && groupPU(t, U)[0][0] !== null;          // a whole phase unit (R / Y / B)
  const es = !sub ? U.es : isPU ? U.es.filter(e => e.ph === sub) : U.es.filter(e => e.sub === sub);
  const one = es.length === 1 ? es[0] : null;
  const big = BIG[t] || [], colors = PHASE_COLOR();
  const kind = isTF(u) ? (u === 'BUS_REACTOR' ? 'reactor' : 'transformer') : t === 'ct' ? 'ct' : t === 'la' ? 'la' : kvOf(u) === 400 ? 'breaker2' : 'breaker1';
  const sr = t === 'ct' ? (kvOf(u) === 220 ? 19 : 18) : T.sr;
  const k = RANKP[t][0];
  const pus = groupPU(t, U);
  const title = one ? fullName(t, u, one.sub, true) : isPU ? phaseUnitName(u, sub) : '';
  const stats = es.map(e => { const L = e.L, Pv = e.done.at(-2), B = e.done[0]; const v = L ? k.get(L) : null, pv = Pv ? k.get(Pv) : null, bv = B ? k.get(B) : null;
    return `<a class="ph-card hc-${L ? statusOf(L) : 'none'}" href="${elHref(t, u, e.sub)}"><div class="k">${e.ph !== '-' ? phase(e.ph) : ''} ${esc(fullName(t, u, e.sub))} ${hChip(e.health)}</div><div class="v num">${fmt(v, k.dp)} <span class="u">${k.unit}</span></div>
      <div class="d">${pv != null ? `${v > pv ? '▲' : v < pv ? '▼' : '='} ${fmt(Math.abs(v - pv), k.dp)} since ${fmtDate(Pv.date)}` : L ? 'single test' : 'never tested'}</div>
      <div class="d dim">${B && B !== L ? `first ${fmt(bv, k.dp)} (${fmtDate(B.date)}) · ` : ''}${e.done.length} test${e.done.length === 1 ? '' : 's'}</div></a>`; }).join('');
  const GRP = ['ct', 'bushing', 'winding'].includes(t) ? [['tand20', 'dTand'], ['C', 'dC']] : big.map(b => [b[0]]);
  const bl = (k) => big.find(b => b[0] === k)?.[1] || k;
  const charts = (e, n) => GRP.slice(0, n ?? GRP.length).map((g) => `<div class="chart-card gx"><div class="card-h"><h3>${g.length > 1 ? (g[0] === 'tand20' ? 'Tan δ' : 'Capacitance') : bl(g[0])}</h3><span class="sub">${esc(fullName(t, u, e.sub))}</span>${g.length > 1 ? `<div class="mc-chips sm">${g.map((k, j) => `<button class="${j ? '' : 'on'}" data-bk="${k}">${bl(k)}</button>`).join('')}</div>` : ''}</div><div class="chart-box" style="height:270px"><canvas data-k="${g[0]}" data-e="${esc(e.sub)}"></canvas></div><div class="legend-note">grid at a round step ≈ 20 % of this ${NOUN[t][0]}'s average · dashed = circular / industry limit · hover a table row to find it here</div></div>`).join('');
  const tabs = `${TANT.includes(t) ? `<div class="row-flex mb">${tvSwitch(t)}${tvBanner(t)}</div>` : ''}<nav class="tabs el-tabs"><a class="${sub ? '' : 'on'}" href="${elHref(t, u, null)}">All ${NOUN[t][1]} (${U.es.length})</a>${pus[0][0] !== null
      ? pus.map(([ph, list]) => `<a class="${sub === ph || (one && one.ph === ph) ? 'on' : ''}" href="${elHref(t, u, ph)}"><span class="dot-ph ph-${ph}"></span>${ph}-phase unit <span class="dim">(${list.length})</span></a>`).join('')
      : U.es.map(e => `<a class="${e.sub === sub ? 'on' : ''}" href="${elHref(t, u, e.sub)}">${e.ph !== '-' ? `<span class="dot-ph ph-${e.ph}"></span>` : ''}${esc(subLabel(t, e.sub))}</a>`).join('')}</nav>
    ${(isPU || (one && pus[0][0] !== null)) ? `<nav class="tabs el-tabs sub">${pus.find(p => p[0] === (isPU ? sub : one.ph))[1].map(e => `<a class="${one && e.sub === one.sub ? 'on' : ''}" href="${elHref(t, u, e.sub)}">${esc(subLabel(t, e.sub))}</a>`).join('')}</nav>` : ''}`;
  const dgaPanels = t === 'dga' ? [...new Set(es.map(e => e.ph))].map(ph => (es.some(e => e.ph === ph && !e.sub.endsWith('OLTC')) ? tankSection(u, ph) + dgaAnalysis(u, ph) : '') + oltcSection(u, ph)).join('') : '';
  mount.innerHTML = `
    <section class="el-hero"><div class="eh-art">${art(kind, { photo: one ? `${u}-${one.ph}` : u, alt: T.name })}</div>
      <div class="eh-body"><div class="eyebrow">${esc(T.name)} · ${isTF(u) ? esc(DB.site.units[u].rating) : `${kvOf(u)} kV bay`} · circular Sr ${sr}</div>
        <h1>${esc(unitName(u, true))}${title ? `<span class="h1-sub">${esc(title)}</span>` : ''}</h1>
        <p class="lede">${one ? `An independent unit with its own history and health, judged only against the MSETCL circular and industry standards.` : isPU ? `The ${sub}-phase single-phase unit of ${esc(unitName(u))} — ${es.length} ${NOUN[t][1]}, each monitored on its own.` : `${U.es.length} ${NOUN[t][1]} — each monitored on its own. Open a ${pus[0][0] !== null ? 'phase unit' : NOUN[t][0]} to see it alone.`}</p>
        <div class="row-flex mt">${circularBtn(sr, 'Circular scan')}<button class="btn" data-norms>${IC.standards}Norms & standards</button><a class="btn" href="#/test/${t}">${IC.arrow} All ${NOUN[t][1]}</a></div>
        <div class="row-flex mt">${shareButtons(u, isPU ? sub : one && one.ph !== '-' && one.ph !== 'N' ? one.ph : null)}</div></div></section>
    ${tabs}
    <div class="ph-cards">${stats}</div>
    ${es.map(e => `<section class="el-sec el" data-ph="${e.ph}"><div class="row-flex"><h2 style="margin:0">${e.ph !== '-' ? phase(e.ph) : ''} ${esc(fullName(t, u, e.sub))}</h2>${hChip(e.health)}${e.L ? pill(statusOf(e.L)) : pill('none', `never tested · due ${fmtDate(codDue(t, u))}`)}${!one ? `<a class="btn sm" href="${elHref(t, u, e.sub)}">Open this ${NOUN[t][0]} only ${IC.arrow}</a>` : ''}<button class="gl-btn" data-gl title="Show the graphs of this element only (until the page is reloaded)">📈 Graph</button></div>
      <div class="card mt"><div class="card-h"><h3>Test results</h3><span class="sub">click a column header to sort · hover a row to find it on the graphs</span><div class="sp"></div><span class="note">${e.rows.length} rows</span></div><div class="tbl-wrap">${seqTable(t, e, false)}</div></div>
      <div class="grid g2 mt">${charts(e, one ? null : 2)}</div></section>`).join('')}
    ${dgaPanels}`;
  $$('[data-norms]', mount).forEach(b => b.onclick = () => openNorms(t));
  const drawBig = (cv) => { Chart.getChart(cv)?.destroy(); const e = es.find(x => x.sub === cv.dataset.e); const def = big.find(b => b[0] === cv.dataset.k); if (!def) return; const lim = typeof def[2] === 'function' ? def[2](u) : def[2];
    const key = cv.dataset.k, mk = (rs) => rs.filter(r => r.v[key] != null).map(r => ({ x: r.date, y: +r.v[key].toFixed(4), meta: r.season || (r.v.temp != null ? `${r.v.temp} °C` : r.pos || '') }));
    const mainTank = t === 'dga' && !e.sub.endsWith('OLTC');
    const col = e.ph !== '-' && ['ct', 'cb_crm', 'cb_timing', 'la', 'bushing'].includes(t) ? colors[e.ph] : '#1a6fc2';
    const series = mainTank ? [['Top', '#2f6fd0'], ['Bottom', '#a16207']].map(([p, c]) => ({ label: `${p} sample`, color: c, points: mk(e.done.filter(r => r.pos === p)) })).filter(x => x.points.length) : [{ label: fullName(t, u, e.sub), color: col, points: mk(e.done) }];
    if (!series.length || !series[0].points.length) { cv.parentElement.innerHTML = '<div class="empty">No readings</div>'; return; }
    const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(); const sc = { alert: c('--alert'), critical: c('--crit'), watch: c('--watch') };
    cv.__chart = lineChart(cv, { series, limits: lim.map(l => ({ ...l, color: sc[l.sev] })), bands: bandsFrom(lim), fill: series.length === 1, stepRef: true, zero: ['la', 'cb_crm'].includes(t),
      sevOf: (y) => cellSev(t, key, y, { unit: u, pos: e.sub.split('|').pop(), v: {} }) }); };
  $$('canvas[data-k]', mount).forEach(drawBig);
  $$('[data-bk]', mount).forEach(b => b.onclick = () => { const card = b.closest('.chart-card'), cv = card.querySelector('canvas'); $$('[data-bk]', card).forEach(x => x.classList.toggle('on', x === b)); cv.dataset.k = b.dataset.bk; drawBig(cv); });
  applyView(); wireToggles(mount);
  mount.addEventListener('mouseover', (ev) => { const tr = ev.target.closest('tr[data-date]'); if (!tr) return; const sec = tr.closest('.el-sec'); if (!sec) return;
    $$('canvas[data-k]', sec).forEach(cv => { const ch = cv.__chart; if (!ch) return; const act = [];
      ch.data.datasets.forEach((ds, di) => { if (ds.isLimit || ds.isRef) return; const i = ds.data.findIndex(p => new Date(p.x).toISOString().slice(0, 10) === tr.dataset.date); if (i >= 0) act.push({ datasetIndex: di, index: i }); });
      ch.setActiveElements(act); ch.tooltip.setActiveElements(act, { x: 0, y: 0 }); ch.update('none'); }); });
  { const npPh = isPU ? sub : (one && PH_UNIT(u, one.ph) ? one.ph : null);   // nameplate of the phase unit / reactor / spare ICT
    const np = isTF(u) ? (npPh ? nameplateSection(u, npPh) : (!/^(ICT1|ICT2)$/.test(u) ? nameplateSection(u, null) : '')) : '';
    if (np) { $('.ph-cards', mount)?.insertAdjacentHTML('afterend', `<div class="np-wrap">${np}</div>`); wireNameplates(mount); } }
  wireTank(mount, u); wireEditing(mount); wireInteractive(mount); wireShare(mount); wireTV(mount);
}

// ------------------------------------------------------------------ FY targets page
const FREQ_TXT = { ct: '400 kV every 2 years · 220 kV every year', bushing: 'every year', winding: 'every 2 years', dga: 'half-yearly (2 per year)', la: 'pre- & post-monsoon (2 per year)', cb_crm: 'every 2 years', cb_timing: 'every 2 years' };
export function targetsPage(mount, focusT) {
  const fyC = curFY(), fyN = nextFY(), adm = isAdmin(), TG = targets();
  const cards = Object.values(TESTS).map(T => {
    const t = T.key, M = model(t), pc = progress(t, M, fyC), pn = progress(t, M, fyN), pl = progress(t, M, prevFY(fyC));
    const row = (fy, p, label) => `<tr><td><b>FY ${fy}</b> <span class="dim">${label}</span></td><td class="r">${p.T.pop}</td><td class="r">${p.T.autoTarget}</td>
      <td class="r">${adm ? `<input class="tgt big" type="number" min="0" data-tgt="${t}|${fy}|*" value="${p.T.override ? p.T.target : ''}" placeholder="${p.T.autoTarget}">` : `<b>${p.T.target}</b>${p.T.override ? ' <span class="tag ver">declared</span>' : ' <span class="dim">(calculated)</span>'}`}</td>
      <td class="r">${p.T.prog}</td><td>${p.T.pct == null ? '<span class="dim">—</span>' : `<div class="pbar big"><span style="width:${p.T.pct}%"></span></div><span class="pnum">${p.T.pct}%</span>`}</td></tr>`;
    return `<section class="card tgt-card ${focusT === t ? 'focus' : ''}" id="tg-${t}"><div class="card-h"><span class="tc-ic">${IC[t]}</span><h2>${esc(T.name)}</h2><span class="sub">${NOUN[t][1]} · ${FREQ_TXT[t]} · circular Sr ${T.sr}</span><div class="sp"></div><a class="btn sm" href="#/test/${t}">Open test ${IC.arrow}</a></div>
      <div class="tbl-wrap"><table class="t prog"><thead><tr><th>Financial year</th><th class="r">${NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1)} population</th><th class="r">Calculated target</th><th class="r">Declared annual target</th><th class="r">Done</th><th style="min-width:160px">Progress</th></tr></thead>
      <tbody>${row(prevFY(fyC), pl, '(last year)')}${row(fyC, pc, '(current)')}${row(fyN, pn, '(next)')}</tbody></table></div>
      <details class="sec inner" ${focusT === t ? 'open' : ''}><summary><span class="sec-t">${HOLDER[t].includes('bay') ? 'Bay' : 'Unit'}-wise targets</span><span class="dim">calculated from last completed test + circular frequency; overwrite any of them</span><span class="caret">▾</span></summary>
        <div class="sec-b"><div class="stack">${[[fyC, pc], [fyN, pn]].map(([fy, p]) => `<div><h3 class="mb">FY ${fy}</h3>${progressTable(t, p, fy)}</div>`).join('')}</div></div></details></section>`;
  }).join('');
  mount.innerHTML = `<section class="hero hero-s"><div class="hero-in"><div class="eyebrow">Planning · annual targets</div><h1>FY targets — ${fyC} and ${fyN}</h1>
      <p class="lede">For every diagnostic test, the calculated target is the number of phase units (CTs, CB poles, LAs, bushings, winding insulations, oil sampling points) falling due in the financial year (overdue and never-tested included; LA and DGA count each season / half-year). Admin can declare the annual target for the whole test or per bay; progress is measured against the declared figure.</p>
      <div class="actions" style="display:flex;gap:8px;margin-top:14px">${adm ? '<span class="tag ver" style="font-size:12.5px">Admin mode · type a number to declare, clear it to return to the calculated target</span>' : '<button class="btn pri" id="tgAdmin">Sign in as admin to set targets</button>'}</div></div></section>
    <div class="stack">${cards}</div>`;
  $$('[data-tgt]', mount).forEach(inp => inp.onchange = () => { setTarget(inp.dataset.tgt, inp.value === '' ? null : inp.value); CTX.rerender({ keepScroll: true }); });
  const ab = $('#tgAdmin', mount); if (ab) ab.onclick = () => { if (toggleAdmin()) CTX.rerender({ keepScroll: true }); };
  if (focusT) setTimeout(() => $(`#tg-${focusT}`)?.scrollIntoView({ block: 'start' }), 50);
}

// ------------------------------------------------------------------ norms drawer (accessibility)
export function openNorms(t) {
  $$('.drawer').forEach(d => d.remove());
  const d = document.createElement('aside'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Norms and standards');
  d.innerHTML = `<div class="dr-h"><span style="width:20px;display:grid">${IC.norms}</span><h2>Norms for ${esc(TESTS[t].name)}</h2><div class="sp"></div><button class="x" aria-label="Close">×</button></div>
    <div class="dr-b"><div class="callout mb"><b>How results are coloured here.</b> Each cell is judged against the MSETCL circular first; amber marks an industry-practice threshold or adverse trend inside the circular limit. <span class="lg c-ok">ok</span> <span class="lg c-watch">watch</span> <span class="lg c-alert">beyond circular</span> <span class="lg c-critical">critical</span></div>
    ${CTX.clauseCard(t === 'ct' ? 18 : TESTS[t].sr, t)}<div class="mt"></div>${CTX.standardsCard(t)}</div>`;
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('open'));
  const close = () => { d.classList.remove('open'); setTimeout(() => d.remove(), 200); };
  d.querySelector('.x').onclick = close;
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
}
