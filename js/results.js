// Test-page sections: FY cards, parameter ranking, yearly progress, sequence-wise
// results (all-time + latest) with colour rules and historic graphs, element / bay
// pop-ups, norms drawer and admin cell editing.
import { DB, TESTS, recs, groupBy, unitName, bayTitle, kvOf, isTF, fmt, fmtDate, sortUnits, done, years, addMonths, toDate, population, refresh, ELEM } from './data.js?v=20261125.1621';
import { LIM, SEV, SEV_LABEL, statusOf, laWindow } from './rules.js?v=20261125.1621';
import { esc, chem, pill, phase, $, $$, lineChart, bandsFrom, PHASE_COLOR, circularBtn, modal } from './ui.js?v=20261125.1621';
import { isAdmin, setCell, addRow, deleteNewRow, targets, setTarget } from './edit.js?v=20261125.1621';
import { IC } from './icons.js?v=20261125.1621';

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
    case 'tand': case 'tand20': return g(v, TAN);
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
  ct: [P('tand', 'Tan δ (measured)', '%', 3, r => r.v.tand), P('tand20', 'Tan δ @20 °C', '%', 3, r => r.v.tand20), P('dTand', 'Tan δ rise since last', '%', 3, r => r.v.dTand), P('dC', 'C change since last', '%', 2, r => r.v.dC, { abs: 1 }), P('C', 'Capacitance', 'pF', 1, r => r.v.C)],
  bushing: [P('tand', 'Tan δ (measured)', '%', 3, r => r.v.tand), P('tand20', 'Tan δ @20 °C', '%', 3, r => r.v.tand20), P('dTand', 'Tan δ rise since last', '%', 3, r => r.v.dTand), P('dC', 'C₁ change since last', '%', 2, r => r.v.dC, { abs: 1 })],
  winding: [P('tand20', 'Tan δ @20 °C', '%', 3, r => r.v.tand20), P('tand', 'Tan δ (measured)', '%', 3, r => r.v.tand), P('dTand', 'Tan δ rise since last', '%', 3, r => r.v.dTand), P('dC', 'C change since last', '%', 2, r => r.v.dC, { abs: 1 })],
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
    const x = t === 'winding' ? v.tand20 : v.tand; if (x == null) return null;
    s = lerp(x, [[0.3, 100], [0.5, 85], [0.7, 60], [1.0, 20], [1.2, 0]]);
    if (v.dTand > 0.1) s = Math.min(s, 60); if (v.dC != null && (v.dC > 10 || v.dC < -5)) s = Math.min(s, 40);
  } else if (t === 'cb_crm') { if (v.R == null) return null; s = lerp(v.R / (CRM_MED[kvOf(L.unit)] || v.R), [[1, 100], [1.2, 85], [1.5, 55], [2, 20], [3, 0]]); }
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
  const W = o.w || 360, H = o.h || 150, L = 38, R = 26, T = 16, B = 24;
  const pts = series.flatMap(s => s.pts);
  if (!pts.length) return `<div class="mc-empty">No readings yet</div>`;
  const xs = pts.map(p => +toDate(p[0])), lims = (o.limits || []).map(l => l.y);
  let y0 = Math.min(...pts.map(p => p[1]), ...(o.zero ? [0] : [])), y1 = Math.max(...pts.map(p => p[1]));
  const near = lims.filter(l => l <= y1 * 1.6 && l >= y0 * 0.6); y0 = Math.min(y0, ...near); y1 = Math.max(y1, ...near);
  if (y1 === y0) { y1 += Math.abs(y1) * 0.1 || 1; y0 -= Math.abs(y0) * 0.1 || 1; }
  const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), X = (x) => L + (x1 === x0 ? (W - L - R) / 2 : (x - x0) / (x1 - x0) * (W - L - R)), Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${series[0].color || 'var(--brand-2)'}" stop-opacity=".28"/><stop offset="1" stop-color="${series[0].color || 'var(--brand-2)'}" stop-opacity="0"/></linearGradient></defs>`;
  for (const l of o.limits || []) if (l.y >= y0 && l.y <= y1) {
    const yy = Y(l.y), band = l.lo ? [yy, H - B] : [T, yy];
    s += `<rect x="${L}" y="${band[0]}" width="${W - L - R}" height="${Math.max(0, band[1] - band[0])}" fill="${SC[l.sev]}" opacity=".07"/><line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${SC[l.sev]}" stroke-dasharray="4 3" stroke-width="1.1"/><text x="${W - R - 2}" y="${yy - 3}" text-anchor="end" class="mc-lim" fill="${SC[l.sev]}">${esc(l.label)}</text>`;
  }
  s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="mc-ax"/>`;
  s += `<text x="${L - 4}" y="${T + 6}" text-anchor="end" class="mc-t">${fmt(y1 - pad, o.dp ?? 2)}</text><text x="${L - 4}" y="${H - B}" text-anchor="end" class="mc-t">${fmt(y0 + pad, o.dp ?? 2)}</text>`;
  const dates = [...new Set(pts.map(p => p[0]))].sort();
  const tickD = dates.length <= 5 ? dates : [dates[0], dates[Math.floor(dates.length / 2)], dates.at(-1)];
  s += tickD.map(d => `<text x="${X(+toDate(d))}" y="${H - 8}" text-anchor="middle" class="mc-t">${toDate(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</text>`).join('');
  series.forEach((se, i) => {
    const ps = se.pts.map(p => [X(+toDate(p[0])), Y(p[1]), p]);
    if (!ps.length) return;
    if (o.bars) { const bw = Math.max(4, Math.min(18, (W - L - R) / (ps.length * series.length + 2))); ps.forEach(([x, y, p]) => { s += `<rect x="${x - bw * series.length / 2 + i * bw}" y="${y}" width="${bw - 1}" height="${H - B - y}" rx="2" fill="${p[2] && p[2] !== 'ok' ? SC[p[2]] : se.color}" opacity=".85"><title>${esc(se.name)} ${fmtDate(p[0])}: ${fmt(p[1], o.dp ?? 2)}</title></rect>`; }); return; }
    const d = ps.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    if (i === 0 && ps.length > 1) s += `<path d="${d}L${ps.at(-1)[0].toFixed(1)} ${H - B}L${ps[0][0].toFixed(1)} ${H - B}Z" fill="url(#${id})"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.color || 'var(--brand-2)'}" stroke-width="2" stroke-linejoin="round"/>`;
    ps.forEach(([x, y, p], j) => {
      const c = p[2] && p[2] !== 'ok' ? SC[p[2]] : (se.color || 'var(--brand-2)');
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p[2] && p[2] !== 'ok' ? 4.5 : 3.2}" fill="var(--panel)" stroke="${c}" stroke-width="2"><title>${esc(se.name)} · ${fmtDate(p[0])}: ${fmt(p[1], o.dp ?? 3)}</title></circle>`;
      if (series.length === 1 && (j === ps.length - 1 || ps.length <= 4)) s += `<text x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" class="mc-v" fill="${c}">${fmt(p[1], o.dp ?? 3)}</text>`;
    });
  });
  const leg = series.length > 1 ? `<div class="mc-leg">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>` : '';
  return `<svg class="mchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${s}</svg>${leg}`;
}
const GASCOL = { H2: '#2f6fd0', CH4: '#0f766e', C2H4: '#c2410c', C2H6: '#7c3aed', C2H2: '#c4161c', CO: '#a16207', CO2: '#64748b' };
function elemChart(t, e) {
  const rs = e.done, P = (k) => rs.filter(r => r.v[k] != null).map(r => [r.date, r.v[k], cellSev(t, k, r.v[k], r)]);
  const kv = kvOf(e.u);
  if (['ct', 'bushing', 'winding'].includes(t)) {
    const k = t === 'winding' ? 'tand20' : 'tand';
    return `<div class="mc-t2">${t === 'winding' ? 'Tan δ @20 °C' : 'Tan δ'} %</div>${svgChart([{ name: 'tan δ', color: 'var(--brand-2)', pts: P(k) }], { dp: 3, limits: [{ y: 0.7, sev: 'alert', label: '0.7 %' }, { y: 0.5, sev: 'watch', label: '0.5 %' }], h: 120 })}
      <div class="mc-t2">Capacitance pF</div>${svgChart([{ name: 'C', color: '#0f766e', pts: rs.filter(r => r.v.C != null).map(r => [r.date, r.v.C, cellSev(t, 'dC', r.v.dC, r)]) }], { dp: 1, h: 105 })}`;
  }
  if (t === 'cb_crm') return `<div class="mc-t2">Contact resistance µΩ</div>${svgChart([{ name: 'CRM', color: 'var(--brand-2)', pts: P('R') }], { dp: 1, bars: 1, zero: 1, limits: [{ y: LIM.crm[kv], sev: 'alert', label: `${LIM.crm[kv]} µΩ` }] })}`;
  if (t === 'cb_timing') return `<div class="mc-t2">Trip time ms</div>${svgChart([{ name: 'TC1', color: 'var(--brand-2)', pts: P('open1') }, { name: 'TC2', color: '#7c3aed', pts: P('open2') }], { dp: 1, h: 120, limits: [{ y: LIM.trip[kv], sev: 'alert', label: `${LIM.trip[kv]} ms` }] })}<div class="mc-t2">Close time ms</div>${svgChart([{ name: 'Close', color: '#0f766e', pts: P('close') }], { dp: 1, h: 100, limits: [{ y: 150, sev: 'alert', label: '150 ms' }] })}`;
  if (t === 'la') return `<div class="mc-t2">Icorr µA · pre / post monsoon</div>${svgChart([{ name: 'Icorr', color: 'var(--brand-2)', pts: P('Icorr') }], { dp: 0, bars: 1, zero: 1, h: 140, limits: [{ y: 150, sev: 'alert', label: '150' }, { y: 350, sev: 'critical', label: '350' }] })}`;
  if (t === 'dga') {
    if (e.sub.endsWith('OLTC')) return `<div class="mc-t2">OLTC oil · BDV kV / water ppm</div>${svgChart([{ name: 'BDV', color: 'var(--brand-2)', pts: P('BDV') }, { name: 'Water', color: '#0f766e', pts: P('H2O') }], { dp: 0, h: 140 })}`;
    return `<div class="mc-t2">Key gases ppm</div>${svgChart(['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2'].map(x => ({ name: chem(x), color: GASCOL[x], pts: P(x) })), { dp: 0, h: 130 })}<div class="mc-t2">CO / CO₂ ppm</div>${svgChart([{ name: 'CO', color: GASCOL.CO, pts: P('CO') }, { name: 'CO₂', color: GASCOL.CO2, pts: P('CO2') }], { dp: 0, h: 100 })}`;
  }
  return '';
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
  const head = `<tr><th>Session</th><th>Date of test</th>${cols.map(c => `<th class="r">${c.label}</th>`).join('')}<th>Remarks</th>${isAdmin() && !latestOnly ? '<th></th>' : ''}</tr>`;
  const body = rows.map(r => `<tr class="${done(r) ? '' : 'nd'} ${r.src.startsWith('new!') ? 'newrow' : ''}"><td>${esc(r.ses || '')}</td><td class="${isAdmin() ? 'ed' : ''} ${inFY(r.date, curFY()) ? 'c-fy' : ''}" data-src="${esc(r.src)}" data-k="date">${fmtDate(r.date)}</td>${cols.map(c => cellHtml(t, r, c)).join('')}<td class="rem ${isAdmin() ? 'ed' : ''} ${r.edited?.rem ? 'edited' : ''}" data-src="${esc(r.src)}" data-k="rem">${esc(r.rem || (done(r) ? '' : 'Not recorded'))}</td>${isAdmin() && !latestOnly ? `<td>${r.src.startsWith('new!') ? `<button class="btn sm ghost" data-del="${esc(r.src)}" title="Delete added row">✕</button>` : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${cols.length + 3}" class="dim">No test on record — counted as pending.</td></tr>`;
  return `<table class="t seq">${head}${body}</table>${isAdmin() && !latestOnly ? `<button class="btn sm" data-add="${esc(t + '|' + e.u + '|' + e.sub)}">＋ Add test row</button>` : ''}`;
}
function elementBlock(t, e, latestOnly) {
  const sch = e.L ? (t === 'la' ? laWindow(e.L.date)[1] : addMonths(e.L.date, months(t, e.u))) : null;
  const st = e.L ? statusOf(e.L) : 'none', od = sch && sch < DB.today;
  return `<div class="el" data-el="${esc(e.u + '|' + e.sub)}">
    <div class="el-h" data-open="${esc(e.u)}" data-sub="${esc(e.sub)}" title="Open this ${NOUN[t][0]} with full history">
      ${e.ph !== '-' ? phase(e.ph) : ''}<b>${esc(subLabel(t, e.sub))}</b>${hChip(e.health)}${pill(st)}
      <span class="el-due ${od ? 'od' : ''}">${sch ? `${od ? 'Overdue · ' : 'Next due '}${fmtDate(sch)}` : 'Never tested'}</span>
      ${t === 'bushing' && e.rows[0]?.mk ? `<span class="dim el-mk">${esc(e.rows[0].mk.replace(/\n/g, ' '))}</span>` : ''}<span class="el-open">${IC.arrow}</span></div>
    <div class="el-b"><div class="el-tbl">${seqTable(t, e, latestOnly)}</div><div class="el-ch" data-open="${esc(e.u)}" data-sub="${esc(e.sub)}">${elemChart(t, e)}</div></div></div>`;
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
const FYS = () => { const y = parseInt(curFY(), 10); return [0, 1, 2].map(i => `${y - i}-${String(y - i + 1).slice(2)}`); };
let FY_SEL = null, RANK_SEL = {};

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

  <details class="sec" id="secRank"><summary><span class="sec-t">${IC.standards} Fleet ranking</span><span class="dim">every ${N[0]}, ranked by any circular parameter</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="seg" id="rankSeg">${RANKP[t].map((p, i) => `<button class="${(RANK_SEL[t] ?? 0) === i ? 'on' : ''}" data-i="${i}">${p.label}</button>`).join('')}</div>
    <div class="rank-wrap"><canvas id="rankCv2"></canvas></div><p class="note" id="rankNote"></p></div></details>

  <details class="sec" open><summary><span class="sec-t">${IC.schedule} Yearly progress · ${esc(T.name)}</span><span class="dim">target = ${N[1]} falling due in the FY (incl. overdue & never tested); admin can set the annual target</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="toolbar"><div class="seg" id="fySeg">${FYS().map(f => `<button class="${f === fy ? 'on' : ''}" data-fy="${f}">FY ${f}</button>`).join('')}</div><span class="note">${months(t, 'x') < 12 || t === 'ct' ? `Frequency: ${t === 'ct' ? '400 kV 2-yearly · 220 kV yearly' : t === 'la' ? 'pre- and post-monsoon (2 per year)' : t === 'dga' ? '½-yearly (2 per year)' : ''}` : `Frequency: every ${months(t, 'x') / 12 === 1 ? 'year' : months(t, 'x') / 12 + ' years'}`}</span></div>
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
    wireEditing(mount);
  };
  drawSeq();
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

function rankChart(t, M, i, mount) {
  const p = RANKP[t][i], cv = $('#rankCv2', mount); if (!cv) return;
  const rows = M.elements.filter(e => e.L && p.get(e.L) != null).map(e => ({ e, v: p.get(e.L), sev: cellSev(t, p.k, p.get(e.L), e.L) || 'ok' }))
    .sort((a, b) => p.asc ? a.v - b.v : (p.abs ? Math.abs(b.v) - Math.abs(a.v) : b.v - a.v)).slice(0, 40);
  const old = Chart.getChart(cv); if (old) old.destroy();
  cv.parentElement.style.height = Math.max(160, 40 + rows.length * 19) + 'px';
  const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const col = { ok: c('--brand-2'), watch: c('--watch'), alert: c('--alert'), critical: c('--crit') };
  new Chart(cv, { type: 'bar', data: { labels: rows.map(r => `${unitName(r.e.u)} · ${subLabel(t, r.e.sub)}`), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => col[r.sev] + (r.sev === 'ok' ? '99' : '')), borderRadius: 4, barThickness: 13 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${fmt(it.raw, p.dp)} ${p.unit} · ${fmtDate(rows[it.dataIndex].e.L.date)}` } } },
      onClick: (_e, els) => { if (els[0]) { const r = rows[els[0].index]; openElement(t, r.e.u, r.e.sub); } },
      scales: { x: { grid: { color: c('--line') }, ticks: { color: c('--ink-3') }, title: { display: true, text: `${p.label} (${p.unit})`, color: c('--ink-3') } }, y: { grid: { display: false }, ticks: { color: c('--ink-2'), font: { size: 11 } } } } } });
  $('#rankNote', mount).textContent = `Latest completed test of each ${NOUN[t][0]}. Bars are coloured by the circular / industry rule; click a bar to open that ${NOUN[t][0]}.`;
}

// ------------------------------------------------------------------ pop-up: a bay / unit with its elements
const BIG = {
  ct: [['tand', 'Tan δ % (measured)', [{ y: 0.5, label: 'IEC 0.5 %', sev: 'watch' }, { y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }]], ['tand20', 'Corrected tan δ % @20 °C', [{ y: 0.7, label: '0.7 %', sev: 'alert' }]], ['dTand', 'Tan δ rise since previous test (%)', [{ y: 0.1, label: '0.1 %', sev: 'alert' }]], ['C', 'Capacitance (pF)', []], ['dC', 'C change since previous test (%)', [{ y: 10, label: '+10 %', sev: 'alert' }, { y: -5, label: '−5 %', sev: 'alert', lo: true }]]],
  cb_crm: [['R', 'Contact resistance (µΩ)', u => [{ y: LIM.crm[kvOf(u)], label: `Circular ${LIM.crm[kvOf(u)]} µΩ`, sev: 'alert' }]], ['I', 'Applied current (A)', []]],
  cb_timing: [['open1', 'Trip time TC1 (ms)', u => [{ y: LIM.trip[kvOf(u)], label: `${LIM.trip[kvOf(u)]} ms`, sev: 'alert' }]], ['open2', 'Trip time TC2 (ms)', u => [{ y: LIM.trip[kvOf(u)], label: `${LIM.trip[kvOf(u)]} ms`, sev: 'alert' }]], ['close', 'Close time (ms)', [{ y: 150, label: '150 ms', sev: 'alert' }]], ['co1', 'Close-Open TC1 (ms)', []]],
  la: [['Icorr', 'Icorr — 3rd-harmonic resistive (µA)', [{ y: 150, label: '150 µA', sev: 'alert' }, { y: 350, label: '350 µA', sev: 'critical' }]], ['Ith', 'Ith (µA)', []], ['Itotal', 'Itotal (µA)', []]],
  dga: [['H2', 'H₂ (ppm)', [{ y: 100, label: '100', sev: 'watch' }]], ['CH4', 'CH₄ (ppm)', [{ y: 120, label: '120', sev: 'watch' }]], ['C2H4', 'C₂H₄ (ppm)', [{ y: 50, label: '50', sev: 'watch' }]], ['C2H2', 'C₂H₂ (ppm)', [{ y: 1, label: '1', sev: 'alert' }]], ['CO', 'CO (ppm)', [{ y: 350, label: '350', sev: 'watch' }]], ['TDCG', 'TDCG (ppm)', [{ y: 720, label: '720', sev: 'watch' }]], ['BDV', 'BDV (kV)', [{ y: 50, label: '50 kV', sev: 'alert', lo: true }]], ['H2O', 'Water (ppm)', [{ y: 20, label: '20 ppm', sev: 'alert' }]]],
};
BIG.bushing = BIG.ct.map(x => x[0] === 'C' ? ['C', 'Capacitance C₁ (pF)', []] : x);
BIG.winding = [BIG.ct[1], BIG.ct[0], BIG.ct[2], BIG.ct[3], BIG.ct[4]];

export function openElement(t, u, sub) {
  const M = model(t), U = M.units.find(x => x.u === u); if (!U) return;
  const T = TESTS[t];
  let cur = sub;
  const body = `<div class="row-flex mb"><div class="seg" id="elTabs"><button data-s="">All ${NOUN[t][1]} (${U.es.length})</button>${U.es.map(e => `<button data-s="${esc(e.sub)}">${e.ph !== '-' && t !== 'winding' && t !== 'dga' ? '' : ''}${esc(subLabel(t, e.sub))}</button>`).join('')}</div><div style="flex:1"></div>${circularBtn(t === 'ct' && kvOf(u) === 220 ? 19 : (t === 'ct' ? 18 : T.sr), 'Circular')}<button class="btn sm" id="elNorms">${IC.standards} Norms & standards</button></div><div id="elBody"></div>`;
  modal(`${esc(unitName(u, true))} — ${esc(T.name)}`, body, (root) => {
    root.querySelector('.modal').classList.add('xl');
    $('#elNorms', root).onclick = () => openNorms(t);
    const draw = () => {
      $$('#elTabs button', root).forEach(b => b.classList.toggle('on', (b.dataset.s || null) === (cur || null)));
      const es = cur ? U.es.filter(e => e.sub === cur) : U.es;
      const box = $('#elBody', root);
      const big = BIG[t] || [];
      const multi = !cur;
      const colors = PHASE_COLOR(), palette = ['#2f6fd0', '#c2410c', '#0f766e', '#7c3aed', '#be185d', '#a16207', '#475569', '#4d7c0f', '#0369a1'];
      const seriesFor = (k) => es.map((e, i) => ({ label: subLabel(t, e.sub), color: (t === 'ct' || t === 'cb_crm' || t === 'cb_timing' || t === 'la') ? colors[e.ph] : palette[i % palette.length], points: e.done.filter(r => r.v[k] != null).map(r => ({ x: r.date, y: +r.v[k].toFixed(4), meta: r.season || (r.v.temp != null ? `${r.v.temp} °C` : '') })) })).filter(s => s.points.length);
      const stats = es.map(e => { const L = e.L, Pv = e.done.at(-2), B = e.done[0], k = RANKP[t][0]; const v = L ? k.get(L) : null, pv = Pv ? k.get(Pv) : null, bv = B ? k.get(B) : null, dy = Pv ? years(Pv.date, L.date) : 0;
        return `<div class="ph-card hc-${L ? statusOf(L) : 'none'}"><div class="k">${e.ph !== '-' ? phase(e.ph) : ''} ${esc(subLabel(t, e.sub))} ${hChip(e.health)}</div><div class="v num">${fmt(v, k.dp)} <span class="u">${k.unit}</span></div>
          <div class="d">${pv != null ? `${v > pv ? '▲' : v < pv ? '▼' : '='} ${fmt(Math.abs(v - pv), k.dp)} since ${fmtDate(Pv.date)}${t !== 'la' && dy > 0.3 ? ` · ${fmt((v - pv) / dy, k.dp)}/yr` : ''}` : 'single test'}</div>
          <div class="d dim">${B && B !== L ? `first ${fmt(bv, k.dp)} (${fmtDate(B.date)}) · ` : ''}${e.done.length} test${e.done.length === 1 ? '' : 's'}</div></div>`; }).join('');
      box.innerHTML = `<div class="ph-cards">${stats}</div>
        <div class="grid g2 mt" id="elCharts">${big.map(([k, label], i) => `<div class="chart-card"><div class="card-h"><h3>${label}</h3><span class="sub">${multi ? 'all ' + NOUN[t][1] : 'history'}</span></div><div class="chart-box" style="height:250px"><canvas data-k="${k}"></canvas></div></div>`).join('')}</div>
        ${es.map(e => `<div class="card mt"><div class="card-h">${e.ph !== '-' ? phase(e.ph) : ''}<h3>${esc(subLabel(t, e.sub))}</h3>${hChip(e.health)}${e.L ? pill(statusOf(e.L)) : pill('none', 'never tested')}<div class="sp"></div><span class="note">${e.rows.length} rows</span></div><div class="tbl-wrap">${seqTable(t, e, false)}</div></div>`).join('')}`;
      $$('#elCharts canvas', box).forEach(cv => { const def = big.find(b => b[0] === cv.dataset.k); const lim = typeof def[2] === 'function' ? def[2](u) : def[2]; const ser = seriesFor(cv.dataset.k); if (!ser.length) { cv.parentElement.innerHTML = '<div class="empty">No readings</div>'; return; }
        const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(); const sc = { alert: c('--alert'), critical: c('--crit'), watch: c('--watch') };
        lineChart(cv, { series: ser, limits: lim.map(l => ({ ...l, color: sc[l.sev] })), bands: bandsFrom(lim), fill: ser.length === 1, sevOf: (y) => { const fake = { unit: u, pos: es[0].sub.split('|').pop(), v: {} }; return cellSev(t, cv.dataset.k, y, fake); } }); });
      wireEditing(box);
    };
    $$('#elTabs button', root).forEach(b => b.onclick = () => { cur = b.dataset.s || null; draw(); });
    CTX.onModalRerender = draw;
    draw();
  });
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
