// Test-page sections: FY cards, parameter ranking, yearly progress, sequence-wise
// results (all-time + latest) with colour rules and historic graphs, element / bay
// pop-ups, norms drawer and admin cell editing.
import { DB, TESTS, recs, groupBy, unitName, bayTitle, kvOf, isTF, fmt, fmtDate, sortUnits, done, years, addMonths, toDate, population, refresh, ELEM } from './data.js?v=20261125.1848';
import { LIM, SEV, SEV_LABEL, statusOf, laWindow } from './rules.js?v=20261125.1848';
import { esc, chem, pill, phase, $, $$, lineChart, bandsFrom, PHASE_COLOR, circularBtn, modal, avgRefs, niceStep, trendLine } from './ui.js?v=20261125.1848';
import { isAdmin, toggleAdmin, setCell, addRow, deleteNewRow, targets, setTarget } from './edit.js?v=20261125.1848';
import { art } from './art.js?v=20261125.1848';
import { IC } from './icons.js?v=20261125.1848';

let CTX = {};                     // callbacks from app.js: rerun(), rerender(), clauseCard(), standardsCard()
export const bindResults = (c) => { CTX = c; };

// ------------------------------------------------------------------ vocabulary
export const NOUN = {
  ct: ['CT', 'CTs'], bushing: ['bushing', 'bushings'], winding: ['winding insulation', 'winding insulations'], dga: ['oil sampling point', 'oil sampling points'],
  cb_crm: ['CB pole', 'CB poles'], cb_timing: ['CB pole', 'CB poles'], la: ['LA', 'LAs'],
};
const HOLDER = { ct: 'bay', cb_crm: 'bay', cb_timing: 'bay', la: 'bay', bushing: 'transformer / reactor', winding: 'transformer', dga: 'transformer / reactor' };
const subOf = (t, r) => ELEM[t](r).split('|').slice(1).join('|');
const subLabel = (t, sub) => { const [a, b] = sub.split('|'); if (t === 'bushing') return `${a || 'Bushing'}${b && b !== '-' ? ' · ' + b + '-ph' : ''}`; if (t === 'winding') return `${a !== '-' ? a + '-ph · ' : ''}${b}`; if (t === 'dga') return `${a !== '-' ? a + '-ph · ' : ''}${b}`; return a === '-' ? 'Single' : `${a}-phase`; };
const phOf = (t, sub) => { const p = t === 'bushing' ? sub.split('|')[1] : sub.split('|')[0]; return /^[RYBN]$/.test(p) ? p : '-'; };

// ------------------------------------------------------------------ financial year
export function fyRange(fy) { const y = parseInt(fy, 10); return [new Date(y, 3, 1), new Date(y + 1, 2, 31, 23, 59)]; }
export const curFY = () => DB.site.substation.fy;
const inFY = (iso, fy) => { const [a, b] = fyRange(fy), d = toDate(iso); return d >= a && d <= b; };
const months = (t, u) => t === 'ct' ? (kvOf(u) === 220 ? 12 : 24) : { bushing: 12, winding: 24, dga: 6, la: 6, cb_crm: 24, cb_timing: 24 }[t];

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
    case 'Icorr': case 'Ith': return g(v, [[350, 'critical'], [150, 'alert']]);
    case 'BDV': return v < (oltc ? 40 : 50) ? 'alert' : !oltc && v < 60 ? 'watch' : 'ok';
    case 'H2O': return oltc ? (v > 40 ? 'watch' : 'ok') : v > 20 ? 'alert' : v > 15 ? 'watch' : 'ok';
    case 'TDCG': return oltc ? '' : g(v, [[4630, 'critical'], [1920, 'alert'], [720, 'watch']]);
    default: if (t === 'dga' && !oltc && LIM.dga[k] != null) return v > LIM.dga[k] ? (k === 'C2H2' ? 'alert' : 'watch') : 'ok';
  }
  return '';
}

// ------------------------------------------------------------------ columns per test (as in the sheet)
const C = (k, label, dp = 2, o = {}) => ({ k, label, dp, ...o });
const TANCOLS = (iu, pu) => [C('C', 'C (pF)', 1), C('tand', 'Tan δ %', 3), C('U', 'U (kV)', 2), C('I', `I (${iu})`, 2), C('phi', 'Ø°', 2), C('P', `P (${pu})`, 2), C('F', 'F (Hz)', 2), C('temp', 'Temp °C', 0),
  C('tand20', 'Corr. tan δ % @20 °C', 3, { f: 1 }), C('dTand', 'Tan δ ↑ (< 0.1 %)', 3, { f: 1 }), C('dC', 'C ↑ % (−5 … +10)', 2, { f: 1 })];
export const COLS = {
  ct: [C('mode', 'Mode', 0, { txt: 1 }), ...TANCOLS('µA', 'mW')],
  bushing: [C('mode', 'Mode', 0, { txt: 1 }), ...TANCOLS('mA', 'W')],
  winding: TANCOLS('mA', 'W'),
  cb_crm: [C('R', 'CB CRM (µΩ)', 1), C('I', 'Applied current (A)', 1), C('mV', 'Volts appeared (mV)', 2, { f: 1 })],
  cb_timing: [C('open1', 'tOpen TC1 (ms)', 2), C('co1', 'tClose-Open TC1 (ms)', 2), C('close', 'tClose (ms)', 2), C('open2', 'tOpen TC2 (ms)', 2), C('co2', 'tClose-Open TC2 (ms)', 2)],
  la: [C('season', 'Season', 0, { txt: 1 }), C('Ith', 'Ith (µA)', 1), C('Icorr', 'Icorr (µA)', 1), C('Itotal', 'Itotal (µA)', 1), C('IRt', 'IR top MΩ', 0), C('IRm', 'IR mid MΩ', 0), C('IRb', 'IR bottom MΩ', 0), C('IRtot', 'IR total MΩ', 0)],
  dga: ['H2', 'CH4', 'CO', 'CO2', 'C2H4', 'C2H6', 'C2H2'].map(x => C(x, `${chem(x)}${LIM.dga[x] ? ` (<${LIM.dga[x]})` : ''}`, 1)).concat([C('O2', 'O₂', 0), C('N2', 'N₂', 0), C('TDCG', 'TDCG (<720)', 1, { f: 1 }), C('BDV', 'BDV (>50 kV)', 0), C('H2O', 'Water ppm', 1), C('acidity', 'Acidity', 4), C('DDF', 'DDF @90 °C', 5), C('resistivity', 'Resistivity', 1)]),
};
const cellVal = (r, c) => c.k === 'mode' ? (r.mode || 'UST') : c.k === 'season' ? (r.season || '') : r.v[c.k];

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
function model(t) {
  CRM_MED = {};
  if (t === 'cb_crm') for (const kv of [400, 220]) CRM_MED[kv] = med(latestOf(recs('cb_crm').filter(done), r => r.unit + r.ph).filter(r => kvOf(r.unit) === kv).map(r => r.v.R));
  const pop = population(t);
  const all = recs(t);
  const el = new Map(pop.map(([u, sub]) => [u + '|' + sub, { u, sub, rows: [] }]));
  for (const r of all) { const k = ELEM[t](r); if (!el.has(k)) el.set(k, { u: r.unit, sub: subOf(t, r), rows: [] }); el.get(k).rows.push(r); }
  for (const e of el.values()) { e.rows.sort((a, b) => a.date.localeCompare(b.date)); e.done = e.rows.filter(done); e.L = e.done.at(-1); e.health = elemHealth(t, e.L); e.ph = phOf(t, e.sub); }
  const units = [...groupBy([...el.values()], e => e.u)].sort((a, b) => sortUnits(a[0], b[0])).map(([u, es]) => ({ u, es: es.sort((a, b) => subSort(t, a.sub, b.sub)) }));
  return { units, elements: [...el.values()] };
}
const PHO = { R: 1, Y: 2, B: 3, N: 4, '-': 0 };
function subSort(t, a, b) {
  if (t === 'bushing') { const [pa, qa] = a.split('|'), [pb, qb] = b.split('|'); return (PHO[qa] - PHO[qb]) || pa.localeCompare(pb); }
  if (t === 'winding') { const o = ['C(HV-LV)', 'C(HV)', 'C(HV)+C(HV-LV)', 'C(LV-HV)', 'C(LV)', 'C(LV)+C(HV-LV)', 'C(HV-E)']; const [pa, qa] = a.split('|'), [pb, qb] = b.split('|'); return (PHO[pa] - PHO[pb]) || (o.indexOf(qa) - o.indexOf(qb)); }
  if (t === 'dga') { const o = ['Top', 'Bottom', 'OLTC']; const [pa, qa] = a.split('|'), [pb, qb] = b.split('|'); return (PHO[pa] - PHO[pb]) || (o.indexOf(qa) - o.indexOf(qb)); }
  return (PHO[a] ?? 9) - (PHO[b] ?? 9);
}
const latestOf = (rs, key) => [...groupBy(rs, key).values()].map(s => s.sort((a, b) => a.date.localeCompare(b.date)).at(-1));

// ------------------------------------------------------------------ yearly progress
function progress(t, M, fy) {
  const [, end] = fyRange(fy), [start] = fyRange(fy), TG = targets();
  const rows = M.units.map(({ u, es }) => {
    let pop = es.length, target = 0, prog = 0, extra = 0, last = null, next = null, overdue = 0;
    for (const e of es) {
      const m = months(t, u), dts = e.done.map(r => r.date);
      const before = dts.filter(d => toDate(d) < start).pop(), inside = dts.filter(d => inFY(d, fy));
      if (m < 12) {                                  // DGA / LA: several per year
        const need = 12 / m; target += need;
        const got = t === 'la' ? new Set(e.done.filter(r => inFY(r.date, fy)).map(r => laWindow(r.date)[0])).size : inside.length;
        prog += Math.min(got, need); extra += Math.max(0, got - need);
      } else {
        const due = before ? addMonths(before, m) : start;  // never tested → due from the start of the FY
        if (due <= end) { target++; if (inside.length) prog++; } else if (inside.length) extra++;
        if (!inside.length && due < DB.today) overdue++;
      }
      const l = dts.at(-1); if (l && (!last || l > last)) last = l;
      if (l) { const nd = t === 'la' ? laWindow(l)[1] : addMonths(l, m); if (!next || nd < next) next = nd; } else next = start;
    }
    const ov = TG[`${t}|${fy}|${u}`];
    return { u, pop, target: ov ?? target, auto: target, prog, extra, last, next, overdue, pct: (ov ?? target) ? Math.min(100, Math.round(prog / (ov ?? target) * 100)) : null, override: ov != null };
  });
  const tot = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const totOv = TG[`${t}|${fy}|*`];
  const T = { pop: tot('pop'), target: totOv ?? tot('target'), autoTarget: tot('target'), prog: tot('prog'), extra: tot('extra'), override: totOv != null };
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
  series.forEach((se, i) => {
    const ps = se.pts.map(p => [X(+toDate(p[0])), Y(p[1]), p]);
    if (!ps.length) return;
    const col = se.color || 'var(--brand-2)';
    const tr = trendLine(se.pts.map(p => ({ x: p[0], y: p[1] })));
    if (o.bars) { const bw = Math.max(5, Math.min(20, (W - L - R) / (ps.length * series.length + 2))); ps.forEach(([x, y, p]) => { s += `<rect class="pt" data-date="${p[0]}" x="${x - bw * series.length / 2 + i * bw}" y="${Math.min(y, Y(Math.max(y0, 0)))}" width="${bw - 1}" height="${Math.abs(Y(Math.max(y0, 0)) - y)}" rx="2" fill="${p[2] && p[2] !== 'ok' ? SC[p[2]] : col}" opacity=".85"><title>${esc(se.name)} ${fmtDate(p[0])}: ${fmt(p[1], o.dp ?? 2)}</title></rect>`; }); }
    else {
      const d = ps.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
      if (i === 0 && ps.length > 1) s += `<path d="${d}L${ps.at(-1)[0].toFixed(1)} ${H - B}L${ps[0][0].toFixed(1)} ${H - B}Z" fill="url(#${id})"/>`;
      s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    if (tr) {
      const [a, b] = tr.pts; s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="${col}" stroke-width="1.6" stroke-dasharray="1.5 4" stroke-linecap="round" opacity=".9"/>`;
      if (series.length === 1) s += `<text x="${W - R}" y="${Math.min(H - B - 3, Math.max(T + 8, Y(b.y) + 12))}" text-anchor="end" class="mc-tr" fill="${col}">trend ${tr.perYear >= 0 ? '+' : ''}${+tr.perYear.toPrecision(2)}/yr</text>`;
    }
    if (!o.bars) ps.forEach(([x, y, p], j) => {
      const c = p[2] && p[2] !== 'ok' ? SC[p[2]] : col;
      s += `<circle class="pt" data-date="${p[0]}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p[2] && p[2] !== 'ok' ? 4.6 : 3.4}" fill="var(--panel)" stroke="${c}" stroke-width="2"><title>${esc(se.name)} · ${fmtDate(p[0])}: ${fmt(p[1], o.dp ?? 3)}</title></circle>`;
      if (series.length === 1 && (j === ps.length - 1 || ps.length <= 4)) s += `<text x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" class="mc-v" fill="${c}">${fmt(p[1], o.dp ?? 3)}</text>`;
    });
  });
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
function elemChartSvg(t, e, i) {
  const [k, label, unit, dp] = CHARTP[t][i];
  const pts = e.done.filter(r => r.v[k] != null).map(r => [r.date, r.v[k], cellSev(t, k, r.v[k], r)]);
  const col = GASCOL[k] || (k === 'C' ? '#0f766e' : 'var(--brand-2)');
  return `<div class="mc-t2">${label} <span class="dim">${unit}</span></div>${svgChart([{ name: label, color: col, pts }], { dp, h: 190, bars: t === 'la' || t === 'cb_crm', zero: t === 'la' || t === 'cb_crm', limits: LIMS(t, k, e.u, e.sub.split('|').pop()) })}
    <div class="mc-note">grid lines at a round step ≈ 20 % of this ${NOUN[t][0]}'s average · dotted line = trend</div>`;
}
function elemChart(t, e) {
  const key = `${t}#${e.u}|${e.sub}`; EREG.set(key, e);
  const P = CHARTP[t], i = Math.min(ESEL[key] ?? 0, P.length - 1);
  const chips = P.length > 1 ? `<div class="mc-chips">${P.map((p, j) => `<button class="${j === i ? 'on' : ''}" data-ck="${esc(key)}" data-ci="${j}">${p[1]}</button>`).join('')}</div>` : '';
  return `${chips}<div class="mc-box" data-cbox="${esc(key)}">${elemChartSvg(t, e, i)}</div>`;
}
function wireChartChips(root) {
  $$('[data-ck]', root).forEach(b => b.onclick = (ev) => {
    ev.stopPropagation(); const key = b.dataset.ck, i = +b.dataset.ci, e = EREG.get(key), t = key.split('#')[0]; ESEL[key] = i;
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    const box = root.querySelector(`[data-cbox="${CSS.escape(key)}"]`); if (box) box.innerHTML = elemChartSvg(t, e, i);
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
  return `<div class="card mt tank-card" data-tank="${id}"><div class="card-h"><h3>Same tank · Top vs Bottom sample${ph !== '-' ? ` · ${ph}-phase` : ''}</h3><span class="sub">both points sample one tank, so they should agree — a large gap means a sampling issue or a localised fault near one valve (IEC 60567)</span></div>
    <div class="card-b"><div class="mc-chips" data-tchips="${id}">${TANKG.map((g, i) => `<button class="${i ? '' : 'on'}" data-g="${g}">${chem(g)}</button>`).join('')}</div>
    <div class="chart-box" style="height:260px"><canvas data-tcv="${id}"></canvas></div>
    <div class="tbl-wrap"><table class="t seq"><thead><tr><th>Date</th>${TANKG.map(g => `<th class="r">${chem(g)} T / B</th>`).join('')}</tr></thead><tbody>
    ${P.slice().reverse().map(p => `<tr><td>${fmtDate(p.d)}</td>${TANKG.map(g => { const sv = diffSev(g, p.T.v[g], p.B.v[g]); return `<td class="r ${sv ? 'c-' + sv : ''}">${fmt(p.T.v[g], 1)} / ${fmt(p.B.v[g], 1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
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
    const th = ev.target.closest('table.seq th[data-sort]'); if (!th) return; ev.stopPropagation();
    const table = th.closest('table'), tb = table.tBodies[0], idx = [...th.parentElement.children].indexOf(th);
    const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc'; $$('th', table).forEach(x => { delete x.dataset.dir; const s = x.querySelector('.srt'); if (s) s.remove(); });
    th.dataset.dir = dir; th.insertAdjacentHTML('beforeend', `<span class="srt">${dir === 'asc' ? '▴' : '▾'}</span>`);
    const val = (tr) => { const c = tr.children[idx]; if (!c) return ''; if (th.dataset.sort === 'date') return tr.dataset.date; const n = parseFloat(c.textContent.replace(/,/g, '')); return isNaN(n) ? c.textContent : n; };
    [...tb.rows].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'asc' ? 1 : -1); }).forEach(r => tb.appendChild(r));
  });
}

// ------------------------------------------------------------------ tables
function cellHtml(t, r, c) {
  const v = cellVal(r, c), sev = c.txt ? '' : cellSev(t, c.k, v, r);
  const ed = r.edited?.[c.k], err = r.err?.[c.k];
  const title = [r.f?.[c.k] ? `Formula: ${r.f[c.k]}` : '', ed ? `Edited ${fmtDate(ed.at.slice(0, 10))}${!ed.raw.startsWith('=') && r.v0?.[c.k] != null ? ` · was ${r.v0[c.k]}` : ''}` : '', err ? `Error: ${err}` : ''].filter(Boolean).join('\n');
  const txt = c.txt ? esc(v || '') : err ? '#ERR' : fmt(v, c.dp);
  return `<td class="r c-${sev} ${c.f ? 'fx' : ''} ${ed ? 'edited' : ''} ${isAdmin() ? 'ed' : ''}" data-src="${esc(r.src)}" data-k="${c.k}" ${title ? `title="${esc(title)}"` : ''}>${txt}</td>`;
}
function seqTable(t, e, latestOnly) {
  const cols = COLS[t], rows = latestOnly ? (e.L ? [e.L] : []) : e.rows;
  const head = `<thead><tr><th data-sort="ses">Session</th><th data-sort="date">Date of test <span class="srt">▾</span></th>${cols.map(c => `<th class="r" data-sort="${c.k}">${c.label}</th>`).join('')}<th>Remarks</th>${isAdmin() && !latestOnly ? '<th></th>' : ''}</tr></thead>`;
  const body = rows.map(r => `<tr data-date="${r.date}" class="${done(r) ? '' : 'nd'} ${r.excluded ? 'xcl' : ''} ${r.src.startsWith('new!') ? 'newrow' : ''}" ${r.excluded ? `title="${esc(r.excluded)}"` : ''}><td>${esc(r.ses || '')}</td><td class="${isAdmin() ? 'ed' : ''} ${inFY(r.date, curFY()) ? 'c-fy' : ''}" data-src="${esc(r.src)}" data-k="date">${fmtDate(r.date)}</td>${cols.map(c => cellHtml(t, r, c)).join('')}<td class="rem ${isAdmin() ? 'ed' : ''} ${r.edited?.rem ? 'edited' : ''}" data-src="${esc(r.src)}" data-k="rem">${r.excluded ? '<span class="tag chg">copied row · excluded</span> ' : ''}${esc(r.rem || (done(r) || r.excluded ? '' : 'Not recorded'))}</td>${isAdmin() && !latestOnly ? `<td>${r.src.startsWith('new!') ? `<button class="btn sm ghost" data-del="${esc(r.src)}" title="Delete added row">✕</button>` : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${cols.length + 3}" class="dim">No test on record — counted as pending.</td></tr>`;
  return `<table class="t seq">${head}<tbody>${body}</tbody></table>${isAdmin() && !latestOnly ? `<button class="btn sm" data-add="${esc(t + '|' + e.u + '|' + e.sub)}">＋ Add test row</button>` : ''}`;
}
function elementBlock(t, e, latestOnly) {
  const sch = e.L ? (t === 'la' ? laWindow(e.L.date)[1] : addMonths(e.L.date, months(t, e.u))) : null;
  const st = e.L ? statusOf(e.L) : 'none', od = sch && sch < DB.today;
  return `<div class="el" data-ph="${e.ph}" data-el="${esc(e.u + '|' + e.sub)}">
    <div class="el-h" data-open="${esc(e.u)}" data-sub="${esc(e.sub)}" title="Open this ${NOUN[t][0]} with full history">
      ${e.ph !== '-' ? phase(e.ph) : ''}<b>${esc(subLabel(t, e.sub))}</b>${hChip(e.health)}${pill(st)}
      <span class="el-due ${od ? 'od' : ''}">${sch ? `${od ? 'Overdue · ' : 'Next due '}${fmtDate(sch)}` : 'Never tested'}</span>
      ${t === 'bushing' && e.rows[0]?.mk ? `<span class="dim el-mk">${esc(e.rows[0].mk.replace(/\n/g, ' '))}</span>` : ''}<span class="el-open">${IC.arrow}</span></div>
    ${t === 'dga' ? tankStrip(e) : ''}<div class="el-b"><div class="el-tbl">${seqTable(t, e, latestOnly)}</div><div class="el-ch" data-open="${esc(e.u)}" data-sub="${esc(e.sub)}">${elemChart(t, e)}</div></div></div>`;
}
function unitBlock(t, U, latestOnly) {
  const hs = U.es.map(e => e.health).filter(x => x != null), worstH = hs.length ? Math.min(...hs) : null;
  return `<section class="ub" data-unit="${esc(U.u)}"><header class="ub-h" data-open="${esc(U.u)}" title="Open all ${NOUN[t][1]} of this ${HOLDER[t].split(' ')[0]}">
    <div><div class="ub-k">${isTF(U.u) ? esc(DB.site.units[U.u].rating) : `${kvOf(U.u)} kV · Bay ${esc(U.u)}`}</div><div class="ub-n">${esc(unitName(U.u, true))}</div></div>
    <div class="ub-s"><span class="dim">${U.es.length} ${NOUN[t][U.es.length === 1 ? 0 : 1]}</span><span title="Weakest element health">${hChip(worstH)}</span><span class="btn sm">Open ${IC.arrow}</span></div></header>
    ${U.es.map(e => elementBlock(t, e, latestOnly)).join('')}</section>`;
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
    addRow({ t, unit: u, pos: L?.pos ?? (t === 'bushing' || t === 'dga' ? s.split('|')[t === 'bushing' ? 0 : 1] : ''), ph: L?.ph ?? phOf(t, s), acting: L?.acting, mode: L?.mode, date: today, ses: '', v: {}, rem: '' });
    refresh(); CTX.rerun(); CTX.rerender();
  });
  $$('[data-del]', root).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); if (confirm('Delete this added row?')) { deleteNewRow(b.dataset.del); refresh(); CTX.rerun(); CTX.rerender(); } });
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
    ${card('c-teal', IC.schedule, `FY ${fy} progress`, `${pr.T.pct ?? '—'}<small>%</small>`, `${pr.T.prog} of ${pr.T.target} ${N[1]} due this FY${pr.T.override ? ' (admin target)' : ''}`, `<div class="fc-bar"><span style="width:${ringPct}%"></span></div>`)}
    ${card(bad ? 'c-red' : 'c-green', IC.findings, 'Outside circular limit', `${bad}<small> ${bad === 1 ? N[0] : N[1]}</small>`, `${watch} more on watch · ${latest.length - bad - watch} normal`)}
    ${card('c-violet', IC.equipment, `Average ${N[0]} health`, `${avgH ?? '—'}<small>/100</small>`, weakest ? `weakest: ${unitName(weakest.u)} · ${subLabel(t, weakest.sub)} (${weakest.health})` : '—')}
  </section>

  <details class="sec" id="secRank"><summary><span class="sec-t">${IC.standards} Fleet ranking</span><span class="dim">${N[1]} of the same voltage class / rating ranked by any circular parameter</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="rank-class"><span class="note">Comparable class</span><div class="seg" id="classSeg"></div></div><div class="seg" id="rankSeg">${RANKP[t].map((p, i) => `<button class="${(RANK_SEL[t] ?? 0) === i ? 'on' : ''}" data-i="${i}">${p.label}</button>`).join('')}</div>
    <div class="rank-wrap"><canvas id="rankCv2"></canvas></div><p class="note" id="rankNote"></p></div></details>

  <details class="sec" open><summary><span class="sec-t">${IC.schedule} Yearly progress · ${esc(T.name)}</span><span class="dim">target = ${N[1]} falling due in the FY (incl. overdue & never tested); admin can set the annual target</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="toolbar"><a class="btn pri" href="#/targets?t=${t}">${IC.schedule} Set FY targets</a><div class="seg" id="fySeg">${FYS().map(f => `<button class="${f === fy ? 'on' : ''}" data-fy="${f}">FY ${f}${f === nextFY() ? ' (next)' : ''}</button>`).join('')}</div><span class="note">${months(t, 'x') < 12 || t === 'ct' ? `Frequency: ${t === 'ct' ? '400 kV 2-yearly · 220 kV yearly' : t === 'la' ? 'pre- and post-monsoon (2 per year)' : t === 'dga' ? '½-yearly (2 per year)' : ''}` : `Frequency: every ${months(t, 'x') / 12 === 1 ? 'year' : months(t, 'x') / 12 + ' years'}`}</span></div>
    ${progressTable(t, pr, fy)}</div></details>

  <details class="sec" open id="secAll"><summary><span class="sec-t">${IC.norms} Detailed test results · sequence-wise</span><span class="dim">every test of every ${N[0]}, as in the sheet — click a ${HOLDER[t].split(' ')[0]} or ${N[0]} to open it</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="toolbar">${filterUI(t, M)}<span class="legend">${legend(t)}</span></div><div id="seqAll"></div></div></details>

  <details class="sec" open id="secLatest"><summary><span class="sec-t">${IC.findings} Latest test results</span><span class="dim">same format · latest completed test of each ${N[0]} · graphs show full history</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div id="seqLatest"></div></div></details>`;
  mount.innerHTML = html;
  const drawSeq = () => {
    const sel = FILTER[t], us = M.units.filter(U => !sel || sel.has(U.u));
    $('#seqAll', mount).innerHTML = us.map(U => unitBlock(t, U, false)).join('') || '<div class="empty">Nothing selected — use the filter.</div>';
    $('#seqLatest', mount).innerHTML = us.map(U => unitBlock(t, U, true)).join('') || '<div class="empty">Nothing selected.</div>';
    $$('[data-open]', mount).forEach(el => el.onclick = (ev) => { if (ev.target.closest('td.ed, input, button[data-add], button[data-del]')) return; openElement(t, el.dataset.open, el.dataset.sub || null); });
    wireEditing(mount); wireChartChips(mount);
  };
  drawSeq();
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

function progressTable(t, pr, fy) {
  const adm = isAdmin(), [, end] = fyRange(fy);
  const dueCls = (d) => !d ? '' : d < DB.today ? 'd-od' : d <= end ? 'd-fy' : 'd-ok';
  return `<div class="tbl-wrap"><table class="t prog"><thead><tr><th>${HOLDER[t].includes('bay') ? 'Bay' : 'Unit'}</th><th class="r">${NOUN[t][0].toUpperCase() === NOUN[t][0] ? NOUN[t][0] : NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1)} population</th><th class="r">Target FY ${fy}</th><th class="r">Progress FY ${fy}</th><th style="min-width:140px">%</th><th class="r">Last tested</th><th class="r">Next due</th><th class="r">Pending</th></tr></thead><tbody>
  ${pr.rows.map(r => `<tr><td><a href="#/eq/${r.u}?t=${t}"><b>${esc(unitName(r.u))}</b></a> <span class="dim">${esc(isTF(r.u) ? '' : bayTitle(r.u))}</span></td><td class="r">${r.pop}</td>
    <td class="r">${adm ? `<input class="tgt" type="number" min="0" data-tgt="${t}|${fy}|${esc(r.u)}" value="${r.override ? r.target : ''}" placeholder="${r.auto}">` : `${r.target}${r.override ? ' <span class="tag ver" title="Set by admin">set</span>' : ''}`}</td>
    <td class="r">${r.prog}${r.extra ? ` <span class="dim" title="Tested though not due">+${r.extra}</span>` : ''}</td>
    <td>${r.pct == null ? '<span class="dim">not due</span>' : `<div class="pbar"><span style="width:${r.pct}%" class="${r.pct >= 100 ? 'full' : ''}"></span></div><span class="pnum">${r.pct}%</span>`}</td>
    <td class="r ${r.last && inFY(r.last, fy) ? 'c-fy' : ''}">${r.last ? fmtDate(r.last) : '<span class="dim">never</span>'}</td><td class="r ${dueCls(r.next)}">${r.next ? fmtDate(r.next) : '—'}</td><td class="r"><b>${Math.max(0, r.target - r.prog)}</b></td></tr>`).join('')}
  </tbody><tfoot><tr><td><b>Total</b></td><td class="r"><b>${pr.T.pop}</b></td><td class="r">${adm ? `<input class="tgt" type="number" min="0" data-tgt="${t}|${fy}|*" value="${pr.T.override ? pr.T.target : ''}" placeholder="${pr.T.autoTarget}" title="Annual target population (overrides the sum)">` : `<b>${pr.T.target}</b>`}</td><td class="r"><b>${pr.T.prog}</b></td><td>${pr.T.pct == null ? '' : `<div class="pbar big"><span style="width:${pr.T.pct}%"></span></div><span class="pnum"><b>${pr.T.pct}%</b></span>`}</td><td></td><td></td><td class="r"><b>${Math.max(0, pr.T.target - pr.T.prog)}</b></td></tr></tfoot></table></div>
  <p class="note">Next-due colours: <span class="lg d-od">overdue</span> <span class="lg d-fy">due within FY ${fy}</span> <span class="lg d-ok">due later</span> · <span class="lg c-fy">tested in FY ${fy}</span>. ${adm ? 'Type a number in "Target" to declare the annual target (leave blank for the calculated value).' : 'Admin can declare the annual target.'}</p>`;
}

// Comparable class of an element: same voltage class, rating and position (make where known).
export function classOf(t, e) {
  if (isTF(e.u)) {
    const rating = e.u === 'BUS_REACTOR' ? '125 MVAr reactor' : e.u === 'SPARE_ICT' ? '167 MVA 1-ph ICT' : '501 MVA ICT (167 MVA 1-ph units)';
    const make = DB.site.units[e.u]?.make ? ` · ${DB.site.units[e.u].make}` : '';
    if (t === 'bushing') return `${e.sub.split('|')[0] || 'Bushing'} bushings · ${rating}`;
    if (t === 'winding') return `${e.sub.split('|')[1]} · ${rating}${make}`;
    if (t === 'dga') return `${e.sub.split('|')[1] === 'OLTC' ? 'OLTC' : 'Main tank'} · ${rating}${make}`;
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
  new Chart(cv, { type: 'bar', data: { labels: rows.map(r => `${unitName(r.e.u)} · ${subLabel(t, r.e.sub)}`), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => col[r.sev] + (r.sev === 'ok' ? '99' : '')), borderRadius: 4, barThickness: 13 }] },
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
  const es = sub ? U.es.filter(e => e.sub === sub) : U.es;
  const big = BIG[t] || [], colors = PHASE_COLOR();
  const kind = isTF(u) ? (u === 'BUS_REACTOR' ? 'reactor' : 'transformer') : t === 'ct' ? 'ct' : t === 'la' ? 'la' : kvOf(u) === 400 ? 'breaker2' : 'breaker1';
  const sr = t === 'ct' ? (kvOf(u) === 220 ? 19 : 18) : T.sr;
  const one = es.length === 1 ? es[0] : null;
  const k = RANKP[t][0];
  const stats = es.map(e => { const L = e.L, Pv = e.done.at(-2), B = e.done[0]; const v = L ? k.get(L) : null, pv = Pv ? k.get(Pv) : null, bv = B ? k.get(B) : null, dy = Pv ? years(Pv.date, L.date) : 0;
    return `<a class="ph-card hc-${L ? statusOf(L) : 'none'}" href="${elHref(t, u, e.sub)}"><div class="k">${e.ph !== '-' ? phase(e.ph) : ''} ${esc(subLabel(t, e.sub))} ${hChip(e.health)}</div><div class="v num">${fmt(v, k.dp)} <span class="u">${k.unit}</span></div>
      <div class="d">${pv != null ? `${v > pv ? '▲' : v < pv ? '▼' : '='} ${fmt(Math.abs(v - pv), k.dp)} since ${fmtDate(Pv.date)}${t !== 'la' && dy > 0.3 ? ` · ${fmt((v - pv) / dy, k.dp)}/yr` : ''}` : L ? 'single test' : 'never tested'}</div>
      <div class="d dim">${B && B !== L ? `first ${fmt(bv, k.dp)} (${fmtDate(B.date)}) · ` : ''}${e.done.length} test${e.done.length === 1 ? '' : 's'}</div></a>`; }).join('');
  const charts = (e, n) => big.slice(0, n ?? big.length).map(([key, label]) => `<div class="chart-card"><div class="card-h"><h3>${label}</h3><span class="sub">${esc(subLabel(t, e.sub))}</span></div><div class="chart-box" style="height:270px"><canvas data-k="${key}" data-e="${esc(e.sub)}"></canvas></div><div class="legend-note">grid at a round step ≈ 20 % of this ${NOUN[t][0]}'s average · dotted line = trend · dashed = circular / industry limit · hover a point or a table row</div></div>`).join('');
  const tanks = t === 'dga' ? [...new Set(es.filter(e => !e.sub.endsWith('OLTC')).map(e => e.sub.split('|')[0]))] : [];
  mount.innerHTML = `
    <section class="el-hero"><div class="eh-art">${art(kind, { photo: one ? `${u}-${one.ph}` : u, alt: T.name })}</div>
      <div class="eh-body"><div class="eyebrow">${esc(T.name)} · ${isTF(u) ? esc(DB.site.units[u].rating) : `${kvOf(u)} kV bay`} · circular Sr ${sr}</div>
        <h1>${esc(unitName(u, true))}${one ? ` · ${esc(subLabel(t, one.sub))}` : ''}</h1>
        <p class="lede">${one ? `This ${NOUN[t][0]} is an independent unit: its own history, its own health, judged only against the MSETCL circular and industry standards.` : `${U.es.length} ${NOUN[t][1]} — each an independent unit. Open one to see it alone.`}</p>
        <div class="row-flex mt">${circularBtn(sr, 'Circular scan')}<button class="btn" data-norms>${IC.standards}Norms & standards</button><a class="btn" href="#/test/${t}">${IC.arrow} All ${NOUN[t][1]}</a></div></div></section>
    <nav class="tabs el-tabs"><a class="${sub ? '' : 'on'}" href="${elHref(t, u, null)}">All ${NOUN[t][1]} (${U.es.length})</a>${U.es.map(e => `<a class="${e.sub === sub ? 'on' : ''}" href="${elHref(t, u, e.sub)}">${e.ph !== '-' ? `<span class="dot-ph ph-${e.ph}"></span>` : ''}${esc(subLabel(t, e.sub))}</a>`).join('')}</nav>
    <div class="ph-cards">${stats}</div>
    ${tanks.map(ph => tankSection(u, ph)).join('')}
    ${es.map(e => `<section class="el-sec el" data-ph="${e.ph}"><div class="row-flex mt"><h2 style="margin:0">${e.ph !== '-' ? phase(e.ph) : ''} ${esc(subLabel(t, e.sub))}</h2>${hChip(e.health)}${e.L ? pill(statusOf(e.L)) : pill('none', 'never tested')}${!one ? `<a class="btn sm" href="${elHref(t, u, e.sub)}">Open this ${NOUN[t][0]} only ${IC.arrow}</a>` : ''}</div>
      <div class="grid g2 mt">${charts(e, one ? null : 2)}</div>
      <div class="card mt"><div class="card-h"><h3>Test history</h3><span class="sub">click a column header to sort · hover a row to find it on the graphs</span><div class="sp"></div><span class="note">${e.rows.length} rows</span></div><div class="tbl-wrap">${seqTable(t, e, false)}</div></div></section>`).join('')}`;
  $$('[data-norms]', mount).forEach(b => b.onclick = () => openNorms(t));
  $$('canvas[data-k]', mount).forEach(cv => { const e = es.find(x => x.sub === cv.dataset.e); const def = big.find(b => b[0] === cv.dataset.k); if (!def) return; const lim = typeof def[2] === 'function' ? def[2](u) : def[2];
    const pts = e.done.filter(r => r.v[cv.dataset.k] != null).map(r => ({ x: r.date, y: +r.v[cv.dataset.k].toFixed(4), meta: r.season || (r.v.temp != null ? `${r.v.temp} °C` : '') }));
    if (!pts.length) { cv.parentElement.innerHTML = '<div class="empty">No readings</div>'; return; }
    const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(); const sc = { alert: c('--alert'), critical: c('--crit'), watch: c('--watch') };
    const col = e.ph !== '-' && ['ct', 'cb_crm', 'cb_timing', 'la', 'bushing'].includes(t) ? colors[e.ph] : '#1a6fc2';
    const ch = lineChart(cv, { series: [{ label: subLabel(t, e.sub), color: col, points: pts }], limits: lim.map(l => ({ ...l, color: sc[l.sev] })), bands: bandsFrom(lim), fill: true, stepRef: true, zero: ['la', 'cb_crm'].includes(t),
      sevOf: (y) => cellSev(t, cv.dataset.k, y, { unit: u, pos: e.sub.split('|').pop(), v: {} }) });
    cv.closest('.chart-card').dataset.dates = pts.map(p => p.x).join(',');
    cv.__chart = ch; });
  // table row ↔ Chart.js point: highlight the point for the hovered row
  mount.addEventListener('mouseover', (ev) => { const tr = ev.target.closest('tr[data-date]'); if (!tr) return; const sec = tr.closest('.el-sec'); if (!sec) return;
    $$('canvas[data-k]', sec).forEach(cv => { const ch = cv.__chart; if (!ch) return; const i = ch.data.datasets[0].data.findIndex(p => new Date(p.x).toISOString().slice(0, 10) === tr.dataset.date);
      if (i < 0) { ch.setActiveElements([]); ch.tooltip.setActiveElements([], { x: 0, y: 0 }); } else { ch.setActiveElements([{ datasetIndex: 0, index: i }]); ch.tooltip.setActiveElements([{ datasetIndex: 0, index: i }], { x: 0, y: 0 }); } ch.update('none'); }); });
  wireTank(mount, u); wireEditing(mount); wireInteractive(mount);
}

// ------------------------------------------------------------------ FY targets page
const FREQ_TXT = { ct: '400 kV every 2 years · 220 kV every year', bushing: 'every year', winding: 'every 2 years', dga: 'half-yearly (2 per year)', la: 'pre- & post-monsoon (2 per year)', cb_crm: 'every 2 years', cb_timing: 'every 2 years' };
export function targetsPage(mount, focusT) {
  const fyC = curFY(), fyN = nextFY(), adm = isAdmin(), TG = targets();
  const cards = Object.values(TESTS).map(T => {
    const t = T.key, M = model(t), pc = progress(t, M, fyC), pn = progress(t, M, fyN);
    const row = (fy, p, label) => `<tr><td><b>FY ${fy}</b> <span class="dim">${label}</span></td><td class="r">${p.T.pop}</td><td class="r">${p.T.autoTarget}</td>
      <td class="r">${adm ? `<input class="tgt big" type="number" min="0" data-tgt="${t}|${fy}|*" value="${p.T.override ? p.T.target : ''}" placeholder="${p.T.autoTarget}">` : `<b>${p.T.target}</b>${p.T.override ? ' <span class="tag ver">declared</span>' : ' <span class="dim">(calculated)</span>'}`}</td>
      <td class="r">${p.T.prog}</td><td>${p.T.pct == null ? '<span class="dim">—</span>' : `<div class="pbar big"><span style="width:${p.T.pct}%"></span></div><span class="pnum">${p.T.pct}%</span>`}</td></tr>`;
    return `<section class="card tgt-card ${focusT === t ? 'focus' : ''}" id="tg-${t}"><div class="card-h"><span class="tc-ic">${IC[t]}</span><h2>${esc(T.name)}</h2><span class="sub">${NOUN[t][1]} · ${FREQ_TXT[t]} · circular Sr ${T.sr}</span><div class="sp"></div><a class="btn sm" href="#/test/${t}">Open test ${IC.arrow}</a></div>
      <div class="tbl-wrap"><table class="t prog"><thead><tr><th>Financial year</th><th class="r">${NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1)} population</th><th class="r">Calculated target</th><th class="r">Declared annual target</th><th class="r">Done</th><th style="min-width:160px">Progress</th></tr></thead>
      <tbody>${row(fyC, pc, '(current)')}${row(fyN, pn, '(next)')}</tbody></table></div>
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
