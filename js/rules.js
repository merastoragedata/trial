// Engineering rule engine. Every finding records its basis (MSETCL circular Sr./clause
// or an industry reference) so the reasoning stays auditable.
import { DB, recs, groupBy, years, kvOf, unitName, addMonths, TESTS, fmt, isTF, done, toDate } from './data.js?v=20261125.1811';

export const SEV = { critical: 4, alert: 3, watch: 2, info: 1, ok: 0, none: -1 };
export const SEV_LABEL = { critical: 'Critical', alert: 'Alert', watch: 'Watch', info: 'Info', ok: 'Normal', none: 'No data' };

const LIM = {
  tand: 0.7, tandHard: 1.0, rise: 0.1, cLo: -5, cHi: 10,
  crm: { 400: 50, 220: 100 }, trip: { 400: 25, 220: 35 }, close: 150,
  la: { normal: 150, replace: 350 },
  dga: { H2: 100, CH4: 120, CO: 350, CO2: 2500, C2H4: 50, C2H6: 65, C2H2: 1, TDCG: 720 },
};
export { LIM };

let FINDINGS = [];
const recSev = new Map();       // record id -> worst severity
const mark = (ids, sev) => ids.forEach(id => { if ((SEV[recSev.get(id)] ?? -1) < SEV[sev]) recSev.set(id, sev); });

function add(f) {
  f.id = FINDINGS.length;
  FINDINGS.push(f);
  mark(f.recIds || [], f.sev);
}
const sorted = (a) => [...a].sort((x, y) => x.date.localeCompare(y.date));
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const pctChange = (a, b) => (b - a) / a * 100;
const label = (r) => [unitName(r.unit), r.pos, r.ph && r.ph !== '-' ? r.ph + '-ph' : '', r.acting].filter(Boolean).join(' · ');

// ---------------------------------------------------------------- tan δ family
function tandSeries(t, keyFn, opt) {
  const all = recs(t).filter(r => r.v.tand != null || r.v.C != null);
  for (const [, s0] of groupBy(all, keyFn)) {
    const s = sorted(s0); const L = s[s.length - 1]; const B = s[0];
    const P = [...s].reverse().find(r => r !== L && years(r.date, L.date) >= 0.5 && r.v[opt.metric] != null);
    const v = L.v[opt.metric];
    mark(s.map(r => r.id), 'ok');
    const base = { t, unit: L.unit, pos: L.pos, ph: L.ph, date: L.date, recIds: [L.id], where: label(L) };
    if (v != null) {
      if (opt.hard && v > opt.hard) add({ ...base, sev: 'critical', title: `Tan δ ${fmt(v, 3)} % exceeds ${opt.hard} %`, detail: `${label(L)} measured ${fmt(v, 3)} % on ${L.date}.`, action: opt.hardAction, basis: opt.basis + ' cl.5' });
      else if (v > LIM.tand) add({ ...base, sev: 'alert', title: `Tan δ ${fmt(v, 3)} % above 0.7 % limit`, detail: `${label(L)} — ${opt.metricLabel} ${fmt(v, 3)} %.`, action: opt.overAction, basis: opt.basis + ' cl.2' });
      else if (opt.watchAbs && v > opt.watchAbs) add({ ...base, sev: 'watch', title: `Tan δ ${fmt(v, 3)} % above ${opt.watchAbs} % industry benchmark`, detail: `Within the circular's 0.7 % but above ${opt.watchStd}.`, action: 'Keep on watch-list; compare with next test.', basis: opt.watchStd });
      if (P && P.v[opt.metric] != null) {
        const dy = years(P.date, L.date), rate = (v - P.v[opt.metric]) / dy;
        if (opt.rate && rate > LIM.rise) add({ ...base, sev: 'alert', recIds: [P.id, L.id], title: `Tan δ rising ${fmt(rate, 3)} %/yr (limit 0.1 %/yr)`, detail: `${label(L)}: ${fmt(P.v[opt.metric], 3)} % (${P.date}) → ${fmt(v, 3)} % (${L.date}).`, action: 'Follow-up measurement for next two quarters; decide on replacement from the observed rate of change.', basis: opt.basis + ' cl.3' });
        else if (opt.doubling && v >= 0.3 && v / P.v[opt.metric] >= 1.8) add({ ...base, sev: 'watch', recIds: [P.id, L.id], title: `Tan δ up ${fmt(v / P.v[opt.metric], 1)}× since last test`, detail: `${label(L)}: ${fmt(P.v[opt.metric], 3)} % → ${fmt(v, 3)} % (at 20 °C). Still inside 0.7 %, but the step change matters more than the absolute value.`, action: 'Correlate with oil moisture/DGA; schedule DFR (Sr 14) to separate moisture from contamination.', basis: 'IEEE C57.152 · trend' });
      }
    }
    if (L.v.C != null && B.v.C != null && L !== B) {
      const dc = pctChange(B.v.C, L.v.C);
      if (dc < LIM.cLo || dc > LIM.cHi) add({ ...base, sev: 'alert', recIds: [B.id, L.id], title: `Capacitance changed ${dc > 0 ? '+' : ''}${fmt(dc, 1)} % from baseline`, detail: `${label(L)}: ${fmt(B.v.C, 1)} pF (${B.date}) → ${fmt(L.v.C, 1)} pF.`, action: 'Outside −5/+10 % band. Repeat test; for bushings/CTs a C1 step points to shorted capacitor layers.', basis: opt.basis + ' cl.1' });
      else if (opt.cWatch && Math.abs(dc) >= 5) add({ ...base, sev: 'watch', recIds: [B.id, L.id], title: `Capacitance +${fmt(dc, 1)} % — inside circular band, beyond IEEE ±5 %`, detail: `${label(L)}: ${fmt(B.v.C, 1)} → ${fmt(L.v.C, 1)} pF.`, action: 'Industry practice investigates at ±5 %. Verify with next test.', basis: 'IEEE C57.152 practice' });
    }
  }
}

function sisterCheck(t, L, opt) {
  const peers = recs(t, { unit: L.unit, pos: L.pos }).filter(r => r.date === L.date && r.ph !== L.ph && r.ph !== 'N' && r.v[opt.metric] != null && (r.acting || '') === (L.acting || ''));
  if (peers.length < 2 || L.ph === 'N') return;
  const m = median(peers.map(r => r.v[opt.metric])); const v = L.v[opt.metric];
  if (v > 1.5 * m && v - m > 0.1) add({ t, unit: L.unit, pos: L.pos, ph: L.ph, date: L.date, recIds: [L.id], sev: 'watch', where: label(L),
    title: `Tan δ ${fmt(v / m, 1)}× sister phases`, detail: `${label(L)} ${fmt(v, 3)} % vs ${fmt(m, 3)} % on the other phases (same day, same temperature).`, action: 'Same-day sister-phase comparison removes temperature error — strongest early indicator. Clean/dry the porcelain and re-test; if it persists, increase test frequency.', basis: 'Field practice (sister-unit comparison)' });
}

function windingCross() {
  const all = recs('winding');
  for (const [, g] of groupBy(all, r => `${r.unit}|${r.ph}|${r.date}`)) {
    const c = (a) => g.find(r => r.acting === a)?.v.C;
    for (const [side, ust, gstg, gst] of [['HV', 'C(HV-LV)', 'C(HV)', 'C(HV)+C(HV-LV)'], ['LV', 'C(LV-HV)', 'C(LV)', 'C(LV)+C(HV-LV)']]) {
      const a = c(ust), b = c(gstg), m = c(gst);
      if (a == null || b == null || m == null) continue;
      const dev = (m - (a + b)) / m * 100;
      if (Math.abs(dev) > 1.0) {
        const r = g[0];
        add({ t: 'winding', unit: r.unit, ph: r.ph, pos: side, date: r.date, sev: 'info', recIds: g.map(x => x.id), where: `${unitName(r.unit)} · ${r.ph}-ph · ${side}`,
          title: `GST cross-check off by ${fmt(dev, 1)} %`, detail: `GST ${fmt(m, 0)} pF vs GSTg+UST ${fmt(a + b, 0)} pF.`, action: 'Usually a lead/guard connection issue during the test rather than insulation. Re-check test connections before drawing conclusions.', basis: 'Doble practice (GST ≈ GSTg + UST)' });
      }
    }
  }
}

// ---------------------------------------------------------------- breakers
function crm() {
  const all = recs('cb_crm');
  const byKv = groupBy(all.filter(r => r.v.R != null), r => kvOf(r.unit));
  for (const [kv, rs] of byKv) {
    const lim = LIM.crm[kv];
    const over = rs.filter(r => r.v.R > lim);
    mark(rs.map(r => r.id), 'ok');
    mark(over.map(r => r.id), 'alert');
    const bays = [...new Set(over.map(r => r.unit))];
    if (over.length && over.length / rs.length > 0.5) {
      add({ t: 'cb_crm', unit: '*', date: rs.map(r => r.date).sort().pop(), sev: 'alert', recIds: over.map(r => r.id), where: `${kv} kV breakers (${bays.length} bays)`,
        title: `${over.length}/${rs.length} poles above circular ${lim} µΩ — systemic`, detail: `${kv} kV pole readings range ${fmt(Math.min(...rs.map(r => r.v.R)), 0)}–${fmt(Math.max(...rs.map(r => r.v.R)), 0)} µΩ. When nearly every healthy breaker "fails", the criterion usually doesn't match the measurement. Most likely the 50 µΩ is per interrupter (break), while Karjat measures across the full 2-break pole.`,
        action: 'Clarify basis with S.E. PAC. Adopt IEC 62271-1: ≤ 1.2 × manufacturer\'s value per pole, measured at ≥ 50 A DC (Karjat uses ~100 A ✓).', basis: 'MSETCL Sr 24 vs IEC 62271-1' });
    } else over.forEach(r => add({ t: 'cb_crm', unit: r.unit, ph: r.ph, date: r.date, sev: 'alert', recIds: [r.id], where: label(r), title: `CRM ${fmt(r.v.R, 1)} µΩ > ${lim} µΩ`, detail: '', action: 'Inspect / clean main contacts; re-measure.', basis: 'MSETCL Sr 24' }));
  }
  all.filter(r => r.v.R == null).forEach(r => add({ t: 'cb_crm', unit: r.unit, ph: r.ph, date: r.date, sev: 'info', recIds: [r.id], where: label(r), title: 'Test logged without a value', detail: `Remark: "${r.rem}".`, action: 'Enter the measured µΩ value in the source sheet.', basis: 'Data quality' }));
}

function timing() {
  const all = recs('cb_timing');
  for (const [, s0] of groupBy(all, r => r.unit + '|' + r.ph)) {
    const s = sorted(s0), L = s[s.length - 1], B = s[0], kv = kvOf(L.unit), trip = LIM.trip[kv];
    mark(s.map(r => r.id), 'ok');
    const op = Math.max(L.v.open1 ?? 0, L.v.open2 ?? 0);
    if (op > trip) add({ t: 'cb_timing', unit: L.unit, ph: L.ph, date: L.date, sev: 'alert', recIds: [L.id], where: label(L), title: `Trip time ${fmt(op, 1)} ms > ${trip} ms`, detail: `TC1 ${fmt(L.v.open1, 1)} ms · TC2 ${fmt(L.v.open2, 1)} ms.`, action: 'Check trip-coil voltage at coil terminals, latch/linkage lubrication and operating-mechanism energy.', basis: 'MSETCL Sr 26' });
    if (L.v.close > LIM.close) {
      const peers = s0.length ? recs('cb_timing', { unit: L.unit }).filter(r => r.date === L.date && r.ph !== L.ph).map(r => r.v.close) : [];
      const m = median(peers);
      add({ t: 'cb_timing', unit: L.unit, ph: L.ph, date: L.date, sev: 'alert', recIds: [L.id], where: label(L), title: `Close time ${fmt(L.v.close, 1)} ms > 150 ms`, detail: peers.length ? `Other poles same day: ${peers.map(x => fmt(x, 1)).join(', ')} ms (${fmt(L.v.close / m, 1)}× median). Either a data-entry error or a sticking closing mechanism on this pole.` : '', action: 'First verify the raw test-kit record. If genuine, inspect closing latch/coil and spring charging; repeat timing.', basis: 'MSETCL Sr 26' });
    }
    if (B !== L && B.v.open1 && L.v.open1) {
      const d = pctChange(B.v.open1, L.v.open1);
      if (d >= 15 && op <= trip) add({ t: 'cb_timing', unit: L.unit, ph: L.ph, date: L.date, sev: 'watch', recIds: [B.id, L.id], where: label(L), title: `Trip time drifting +${fmt(d, 0)} % (${fmt(B.v.open1, 1)} → ${fmt(L.v.open1, 1)} ms)`, detail: `Still within ${trip} ms but trending toward it.`, action: 'Mechanism slowing — lubricate and check coil current trace (DCRM/coil-current signature).', basis: 'Trend vs commissioning' });
    }
  }
  for (const [, g] of groupBy(all, r => r.unit + '|' + r.date)) {
    if (g.length < 3) continue;
    const L = g[0];
    const spread = (k) => { const v = g.map(r => r.v[k]).filter(x => x != null); return v.length >= 2 ? Math.max(...v) - Math.min(...v) : 0; };
    const sc = spread('close'), so = spread('open1');
    if (sc > 5 || so > 3.33) add({ t: 'cb_timing', unit: L.unit, date: L.date, sev: 'watch', recIds: g.map(r => r.id), where: unitName(L.unit, true),
      title: `Pole discrepancy: close ${fmt(sc, 1)} ms · open ${fmt(so, 1)} ms`, detail: `Limits used: close ≤ 5 ms, open ≤ 3.33 ms between poles.`, action: 'Not covered by the circular. Large close-pole spread raises switching over-voltages on lines/reactors. Verify the CBIP value, then adjust the mechanism.', basis: 'CBIP / POWERGRID practice (verify)' });
  }
}

// ---------------------------------------------------------------- LA
function la() {
  const all = recs('la').filter(r => r.v.Icorr != null);
  for (const [, s0] of groupBy(all, r => r.unit + '|' + r.ph)) {
    const s = sorted(s0), L = s[s.length - 1];
    mark(s.map(r => r.id), 'ok');
    for (const r of s) {
      const v = r.v.Icorr;
      if (v > LIM.la.replace) mark([r.id], 'critical'); else if (v > LIM.la.normal) mark([r.id], 'alert');
    }
    const v = L.v.Icorr;
    const base = { t: 'la', unit: L.unit, ph: L.ph, date: L.date, recIds: [L.id], where: label(L) };
    if (v > LIM.la.replace) add({ ...base, sev: 'critical', title: `Icorr ${fmt(v, 0)} µA > 350 µA`, detail: `${L.season || ''} ${L.date}: Ith ${fmt(L.v.Ith, 0)} · Icorr ${fmt(L.v.Icorr, 0)} µA.`, action: 'Complete LA should be replaced.', basis: 'MSETCL Sr 17 (c)' });
    else if (v > LIM.la.normal) add({ ...base, sev: 'alert', title: `Icorr ${fmt(v, 0)} µA (150–350 µA band)`, detail: `Ith ${fmt(L.v.Ith, 0)} · Icorr ${fmt(L.v.Icorr, 0)} µA.`, action: 'Take stack-wise IR values; replace the low stack. Gantry LAs: during TF outage by removing jumper.', basis: 'MSETCL Sr 17 (b)' });
    const past = s.filter(r => r !== L && r.v.Icorr != null && r.date < L.date);
    const hist = past.filter(r => r.v.Icorr > LIM.la.normal);
    if (v <= LIM.la.normal && hist.length) add({ ...base, sev: 'watch', recIds: hist.map(r => r.id).concat(L.id), title: `Was in 150–350 µA band ${hist.length}× in history, now ${fmt(v, 0)} µA`, detail: hist.map(r => `${r.date} (${r.season}): Icorr ${fmt(r.v.Icorr, 0)} µA`).join(' · '), action: 'Seasonal swing this large usually means surface leakage or moisture rather than block ageing. Check whether stack-wise IR was taken after each exceedance as the circular requires.', basis: 'MSETCL Sr 17 · IEC 60099-5' });
  }
}

// ---------------------------------------------------------------- DGA
export function duval1(v) {
  const a = v.CH4 ?? 0, b = v.C2H4 ?? 0, c = v.C2H2 ?? 0, s = a + b + c;
  if (s <= 0) return null;
  const CH4 = a / s * 100, C2H4 = b / s * 100, C2H2 = c / s * 100;
  let z;
  if (CH4 >= 98) z = 'PD';
  else if (C2H2 < 4 && C2H4 < 20) z = 'T1';
  else if (C2H2 < 4 && C2H4 < 50) z = 'T2';
  else if (C2H2 < 15 && C2H4 >= 50) z = 'T3';
  else if (C2H2 >= 13 && C2H4 < 23) z = 'D1';
  else if (C2H2 >= 13 && ((C2H4 >= 23 && C2H4 < 40) || (C2H4 >= 40 && C2H2 >= 29))) z = 'D2';
  else z = 'DT';
  return { zone: z, CH4, C2H4, C2H2 };
}
export const DUVAL_NAMES = { PD: 'Partial discharge', T1: 'Thermal fault < 300 °C', T2: 'Thermal fault 300–700 °C', T3: 'Thermal fault > 700 °C', D1: 'Low-energy discharge', D2: 'High-energy discharge', DT: 'Mixed thermal & electrical' };

function dga() {
  const all = recs('dga');
  for (const [, s0] of groupBy(all, r => `${r.unit}|${r.ph}|${r.pos}`)) {
    const s = sorted(s0), L = s[s.length - 1], P = s[s.length - 2];
    mark(s.map(r => r.id), 'ok');
    const base = { t: 'dga', unit: L.unit, ph: L.ph, pos: L.pos, date: L.date, recIds: [L.id], where: label(L) };
    const v = L.v;
    if (L.pos === 'OLTC') {
      if (v.H2O > 40) add({ ...base, sev: 'watch', title: `OLTC oil water ${fmt(v.H2O, 0)} ppm (> 40)`, detail: '', action: 'Filter/replace diverter oil.', basis: 'Karjat sheet OLTC limit' });
      if (v.BDV != null && v.BDV < 40) add({ ...base, sev: 'alert', title: `OLTC oil BDV ${fmt(v.BDV, 0)} kV`, detail: '', action: 'Diverter oil replacement.', basis: 'Practice' });
      continue;
    }
    const over = Object.entries(LIM.dga).filter(([g, lim]) => v[g] != null && v[g] > lim);
    if (over.length) {
      const ac = over.find(([g]) => g === 'C2H2');
      const dv = duval1(v);
      const ratio = v.CO > 0 ? v.CO2 / v.CO : null;
      add({ ...base, sev: ac ? 'alert' : 'watch', title: `${over.map(([g]) => g).join(', ')} above IEEE C57.104 Condition-1`, detail: over.map(([g, lim]) => `${g} ${fmt(v[g], 0)} ppm (limit ${lim})`).join(' · ') + (dv ? ` · Duval T1: ${dv.zone} — ${DUVAL_NAMES[dv.zone]}` : '') + (ratio != null ? ` · CO₂/CO ${fmt(ratio, 1)}` : ''),
        action: ac ? 'Acetylene in main tank: re-sample within 1 month; check rate of rise; correlate with through-faults and OLTC-to-main-tank leakage.' : 'Re-sample to confirm trend; evaluate rate of rise (IEEE C57.104-2019 approach).', basis: 'IEEE C57.104 · IEC 60599' });
    }
    if (P && v.C2H2 > 0 && (P.v.C2H2 ?? 0) === 0 && v.C2H2 <= 1) add({ ...base, sev: 'watch', recIds: [P.id, L.id], title: `Acetylene appeared (${fmt(v.C2H2, 1)} ppm)`, detail: `Previous sample ${P.date}: 0 ppm.`, action: 'Any new C₂H₂ in a main tank is worth a confirmatory sample.', basis: 'IEC 60599' });
    if (v.BDV != null && v.BDV < 50) add({ ...base, sev: 'alert', title: `Oil BDV ${fmt(v.BDV, 0)} kV < 50 kV`, detail: '', action: 'Filtration / dehydration.', basis: 'Karjat sheet · IEC 60422 (poor)' });
    else if (v.BDV != null && v.BDV < 60) add({ ...base, sev: 'watch', title: `Oil BDV ${fmt(v.BDV, 0)} kV — IEC 60422 "fair"`, detail: 'Passes the sheet limit of 50 kV.', action: 'Trend; filter if declining.', basis: 'IEC 60422 cat. A/O (verify)' });
    if (v.H2O != null && v.H2O > 20) add({ ...base, sev: 'alert', title: `Water ${fmt(v.H2O, 0)} ppm > 20 ppm`, detail: '', action: 'Dry out oil; check breather/silica gel and gasket leaks.', basis: 'Karjat sheet · IEC 60422' });
    else if (v.H2O != null && v.H2O > 15) add({ ...base, sev: 'watch', title: `Water ${fmt(v.H2O, 0)} ppm — IEC 60422 "fair"`, detail: '', action: 'Check breather; correlate with DFR moisture-in-paper.', basis: 'IEC 60422 (verify)' });
  }
}

// ---------------------------------------------------------------- schedule
// One due date per ASSET per TEST, counted from the asset's latest COMPLETED test
// (all phases / sampling points of one campaign count together). Components that
// were missed in the latest campaign are reported as "lagging" instead of getting
// their own due date. LA follows the circular's pre- / post-monsoon windows.
const MONTHS = { bushing: 12, winding: 24, dga: 6, cb_crm: 24, cb_timing: 24 };
const SUBKEY = { bushing: r => `${r.pos} ${r.ph}`, winding: r => `${r.ph}-ph`, dga: r => `${r.ph !== '-' ? r.ph + '-ph ' : ''}${r.pos}`, ct: r => `${r.ph}-ph`, cb_crm: r => `${r.ph}-ph`, cb_timing: r => `${r.ph}-ph`, la: r => `${r.ph}-ph` };
export function laWindow(iso) {             // returns [season just done, due date of next season]
  const d = toDate(iso), y = d.getFullYear(), m = d.getMonth() + 1;
  if (m >= 3 && m <= 7) return ['Pre-monsoon', new Date(y, 10, 30)];            // next: post-monsoon by 30 Nov
  return ['Post-monsoon', new Date(m <= 2 ? y : y + 1, 4, 31)];                 // next: pre-monsoon by 31 May
}
export function schedule() {
  const out = [];
  for (const t of Object.keys(TESTS)) {
    for (const [unit, g0] of groupBy(recs(t).filter(done), r => r.unit)) {
      const last = g0.map(r => r.date).sort().pop();
      const kv = kvOf(unit);
      let months = t === 'ct' ? (kv === 220 ? 12 : 24) : MONTHS[t], due, freq;
      const sr = t === 'ct' ? (kv === 220 ? 19 : 18) : TESTS[t].sr;
      if (t === 'la') { const [season, nx] = laWindow(last); due = nx; freq = `½-yearly · ${season.toLowerCase()} done`; months = 6; }
      else { due = addMonths(last, months); freq = months === 12 ? 'yearly' : months === 6 ? '½-yearly' : `${months / 12}-yearly`; }
      // components not covered in the latest campaign (more than 60 days older)
      const sub = [...groupBy(g0, SUBKEY[t])].map(([k, s]) => [k, s.map(r => r.date).sort().pop()]);
      const lag = sub.filter(([, d]) => years(d, last) > 60 / 365).map(([k, d]) => ({ k: k.trim(), last: d }));
      const days = Math.round((due - DB.today) / 864e5);
      out.push({ t, key: unit, unit, last, due, days, months, freq, sr, lag, n: new Set(g0.map(r => r.date)).size,
        status: days < 0 ? 'overdue' : days <= 120 ? 'due' : 'ok' });
    }
  }
  return out.sort((a, b) => a.due - b.due);
}

export function run() {
  FINDINGS = []; recSev.clear();
  tandSeries('bushing', r => `${r.unit}|${r.pos}|${r.ph}`, { metric: 'tand20', metricLabel: 'corrected tan δ @20 °C', basis: 'MSETCL Sr 1', hard: LIM.tandHard, hardAction: 'Replace bushing immediately (circular Sr 1 cl.5).', overAction: 'Follow-up measurement for next two quarters; replacement on rate of change.', rate: true, cWatch: true });
  tandSeries('winding', r => `${r.unit}|${r.ph}|${r.acting}`, { metric: 'tand20', metricLabel: 'tan δ at 20 °C', basis: 'MSETCL Sr 3', overAction: 'Decide with transformer test results & oil test results — S.E. TCC & S.E. EHV (O&M) jointly.', watchAbs: 0.5, watchStd: 'IEEE C57.152 new-unit 0.5 %', doubling: true });
  tandSeries('ct', r => `${r.unit}|${r.ph}`, { metric: 'tand20', metricLabel: 'corrected tan δ @20 °C', basis: 'MSETCL Sr 18/19', hard: LIM.tandHard, hardAction: 'Industry practice: replace CT at ≥ 1.0 % (CEA/POWERGRID); circular: follow-up two quarters.', overAction: 'Follow-up measurement for next two quarters; decide on rate of change & oil DGA.', rate: true, watchAbs: 0.5, watchStd: 'IEC 61869-1 routine 0.5 %' });
  windingCross(); crm(); timing(); la(); dga();
  FINDINGS.sort((a, b) => SEV[b.sev] - SEV[a.sev] || b.date.localeCompare(a.date));
  return FINDINGS;
}
export const findings = () => FINDINGS;
export const statusOf = (rec) => recSev.get(rec.id) || 'none';
export function worst(list) { let w = 'none'; for (const s of list) if ((SEV[s] ?? -1) > SEV[w]) w = s; return w; }
export function unitStatus(u, t) {
  const ids = new Set(DB.records.filter(r => r.unit === u && (!t || r.t === t)).map(r => r.id));
  if (!ids.size) return 'none';
  const fs = FINDINGS.filter(f => (!t || f.t === t) && (f.unit === u || (f.recIds || []).some(i => ids.has(i))));
  return fs.length ? worst(fs.map(f => f.sev)) : 'ok';
}
export function findingsFor(f) { return FINDINGS.filter(x => (!f.t || x.t === f.t) && (!f.unit || x.unit === f.unit)); }
export { isTF };
