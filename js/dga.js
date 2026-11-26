// DGA analysis report for one tank (an ICT phase unit's main tank, the spare ICT or the reactor):
// every recognised interpretation method applied to the samples on record, oil quality, paper
// condition, top/bottom and OLTC cross-checks, and correlation with the same unit's electrical tests.
import { DB, recs, fmt, fmtDate, toDate, done, unitName } from './data.js?v=20261126.1914';
import { duval1, oltcCorrelation, LIM } from './rules.js?v=20261126.1914';
import { duvalSVG, esc, chem } from './ui.js?v=20261126.1914';
import { svgChart } from './results.js?v=20261126.1914';

const GASES = ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO', 'CO2'];
const GC = { H2: '#2f6fd0', CH4: '#0f766e', C2H4: '#c2410c', C2H6: '#7c3aed', C2H2: '#c4161c', CO: '#a16207', CO2: '#64748b', TDCG: '#0b3d6e' };
const C1 = { H2: 100, CH4: 120, C2H6: 65, C2H4: 50, C2H2: 1, CO: 350, CO2: 2500 };                 // IEEE C57.104 Condition 1
const C2 = { H2: 700, CH4: 400, C2H6: 100, C2H4: 100, C2H2: 9, CO: 570, CO2: 4000 };                // IEEE C57.104 Condition 2 upper
const TDCGC = [[720, 1, 'Condition 1 — normal'], [1920, 2, 'Condition 2 — above normal, investigate'], [4630, 3, 'Condition 3 — high decomposition'], [Infinity, 4, 'Condition 4 — excessive decomposition']];
const SEVW = { ok: 0, watch: 1, alert: 2, critical: 3 };
const tag = (s, t) => `<span class="dg-t dg-${s}">${t}</span>`;
const worse = (a, b) => SEVW[a] >= SEVW[b] ? a : b;

/** Samples of one tank merged per date: top & bottom together (worst gas, lowest BDV). */
function tankSamples(u, ph) {
  const rs = recs('dga', { unit: u }).filter(r => r.ph === ph && r.pos !== 'OLTC' && done(r) && !r.excluded);
  const by = new Map(); for (const r of rs) { if (!by.has(r.date)) by.set(r.date, []); by.get(r.date).push(r); }
  return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([d, xs]) => {
    const v = {}, mx = (k) => { const a = xs.map(r => r.v[k]).filter(x => x != null); return a.length ? Math.max(...a) : null; };
    for (const k of [...GASES, 'O2', 'N2', 'H2O', 'acidity', 'DDF', 'TDCG']) v[k] = mx(k);
    const b = xs.map(r => r.v.BDV).filter(x => x != null); v.BDV = b.length ? Math.min(...b) : null;
    const rho = xs.map(r => r.v.resistivity).filter(x => x != null); v.resistivity = rho.length ? Math.min(...rho) : null;
    if (v.TDCG == null && ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO'].every(k => v[k] != null)) v.TDCG = ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO'].reduce((a, k) => a + v[k], 0);
    return { d: xs[0].date, v, pos: xs.map(r => r.pos).join(' + '), n: xs.length };
  });
}
// IEC 60599 ratio code (three basic gas ratios)
function iecRatios(v) {
  const R1 = v.C2H4 > 0 ? v.C2H2 / v.C2H4 : null, R2 = v.H2 > 0 ? v.CH4 / v.H2 : null, R3 = v.C2H6 > 0 ? v.C2H4 / v.C2H6 : null;
  let dx = 'No IEC 60599 fault pattern';
  if (R2 != null && R3 != null) {
    if (R2 < 0.1 && R3 < 0.2) dx = 'PD — partial discharges';
    else if (R1 != null && R1 > 1 && R2 >= 0.1 && R2 <= 0.5 && R3 > 1) dx = 'D1 — discharges of low energy';
    else if (R1 != null && R1 >= 0.6 && R1 <= 2.5 && R2 >= 0.1 && R2 <= 1 && R3 > 2) dx = 'D2 — discharges of high energy';
    else if ((R1 == null || R1 < 0.1) && R2 > 1 && R3 < 1) dx = 'T1 — thermal fault < 300 °C';
    else if ((R1 == null || R1 < 0.1) && R2 > 1 && R3 >= 1 && R3 <= 4) dx = 'T2 — thermal fault 300–700 °C';
    else if ((R1 == null || R1 < 0.2) && R2 > 1 && R3 > 4) dx = 'T3 — thermal fault > 700 °C';
  }
  return { R1, R2, R3, dx };
}
const DUVALTXT = { PD: 'partial discharges', T1: 'thermal fault below 300 °C', T2: 'thermal fault 300–700 °C', T3: 'thermal fault above 700 °C', D1: 'low-energy discharges (sparking)', D2: 'high-energy discharges (arcing)', DT: 'mixture of thermal and electrical faults' };

/** Full analysis report of a tank as a collapsed section. */
export function dgaAnalysis(u, ph = '-') {
  const S = tankSamples(u, ph); if (!S.length) return '';
  const L = S.at(-1), P = S.at(-2), v = L.v;
  const name = `${unitName(u)}${ph !== '-' ? `, ${ph}-phase unit` : ''} — main tank`;
  // 1 · gas levels vs IEEE C57.104 Condition 1
  const gasRows = GASES.map(g => { const x = v[g]; const s = x == null ? '' : x > C2[g] ? 'alert' : x > C1[g] ? 'watch' : 'ok';
    return { g, x, s, pct: x == null ? null : x / C1[g] * 100 }; });
  const over = gasRows.filter(r => r.s && r.s !== 'ok');
  const tc = TDCGC.find(([lim]) => (v.TDCG ?? 0) <= lim);
  let sev = over.some(r => r.s === 'alert') || tc[1] >= 3 ? 'alert' : over.length || tc[1] === 2 ? 'watch' : 'ok';
  // 2 · generation rates
  const days = P ? Math.max(1, Math.round((toDate(L.d) - toDate(P.d)) / 864e5)) : null;
  const rate = (g) => P && v[g] != null && P.v[g] != null ? (v[g] - P.v[g]) / days : null;
  const tr = rate('TDCG'), trS = tr == null ? '' : tr > 30 ? 'alert' : tr > 10 ? 'watch' : 'ok';
  if (trS) sev = worse(sev, trS);
  // 3 · key gas (relative share of the combustibles)
  const comb = ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO'], tot = comb.reduce((a, g) => a + (v[g] || 0), 0);
  const share = comb.map(g => [g, tot ? (v[g] || 0) / tot * 100 : 0]).sort((a, b) => b[1] - a[1]);
  const KEYTXT = { CO: 'overheated cellulose (paper insulation)', H2: 'partial discharge / corona in oil', C2H4: 'overheated oil', C2H2: 'arcing', CH4: 'low-temperature overheating of oil', C2H6: 'low-temperature overheating of oil' };
  // 4 · Duval & IEC ratios — meaningful only when some gas is above its normal (Condition-1) value
  const applicable = over.length > 0;
  const dv = duval1(v), ir = iecRatios(v);
  const dpts = S.map((s, i) => { const r = duval1(s.v); return r ? { ...r, color: i === S.length - 1 ? '#c4161c' : '#1a6fc2', big: i === S.length - 1 } : null; }).filter(Boolean);
  // 5 · paper & oil
  const coRatio = v.CO > 0 && v.CO2 != null ? v.CO2 / v.CO : null;
  const coTxt = coRatio == null ? '—' : coRatio < 3 && v.CO > C1.CO ? 'below 3 with CO above normal — paper is likely involved in a fault' : coRatio < 3 ? 'below 3 but CO is still low — no paper involvement indicated' : coRatio > 10 ? 'above 10 — mild, general overheating / normal ageing of paper' : '3–10 — normal ageing of cellulose';
  const coS = coRatio != null && coRatio < 3 && v.CO > C1.CO ? 'alert' : coRatio > 10 ? 'watch' : 'ok';
  const o2n2 = v.O2 != null && v.N2 > 0 ? v.O2 / v.N2 : null;
  const OIL = [['BDV', 'Breakdown voltage', 'kV', '≥ 50 kV (IS 1866, > 170 kV)', (x) => x < 50 ? 'alert' : x < 60 ? 'watch' : 'ok', 0], ['H2O', 'Water content', 'ppm', '≤ 20 ppm (IS 1866, > 170 kV)', (x) => x > 20 ? 'alert' : x > 15 ? 'watch' : 'ok', 1], ['acidity', 'Neutralisation value', 'mg KOH/g', '≤ 0.2 (IS 1866)', (x) => x > 0.2 ? 'alert' : x > 0.1 ? 'watch' : 'ok', 3], ['DDF', 'Dielectric dissipation factor @90 °C', '', '≤ 0.2 (IS 1866)', (x) => x > 0.2 ? 'alert' : x > 0.1 ? 'watch' : 'ok', 4], ['resistivity', 'Resistivity @90 °C', '×10¹² Ω·cm', '≥ 0.1 (IS 1866)', (x) => x < 0.1 ? 'alert' : 'ok', 2]];
  const oil = OIL.map(([k, l, un, lim, f, dp]) => ({ k, l, un, lim, x: v[k], s: v[k] == null ? '' : f(v[k]), dp, p: P?.v[k] }));
  for (const o of oil) if (o.s === 'alert' && ['BDV', 'H2O'].includes(o.k)) sev = worse(sev, 'watch');
  // 6 · electrical tests of the same unit
  const wind = recs('winding', { unit: u }).filter(r => (ph === '-' || r.ph === ph) && done(r));
  const bush = recs('bushing', { unit: u }).filter(r => (ph === '-' || r.ph === ph) && done(r));
  const lastBy = (rs, key) => { const m = new Map(); for (const r of rs.sort((a, b) => a.date.localeCompare(b.date))) m.set(key(r), r); return [...m.values()]; };
  const wl = lastBy(wind, r => r.acting), bl = lastBy(bush, r => r.pos || r.ph);
  const wmax = wl.length ? Math.max(...wl.map(r => r.v.tand20 ?? 0)) : null, bmax = bl.length ? Math.max(...bl.map(r => r.v.tand20 ?? 0)) : null;
  const wrise = wl.some(r => (r.v.dTand ?? 0) > 0.1);
  const elec = [];
  if (wl.length) elec.push(`Winding insulation: highest corrected tan δ ${fmt(wmax, 3)} % (${fmtDate(wl.map(r => r.date).sort().at(-1))})${wrise ? ' with a rise above 0.1 % since the previous test' : ''} — ${wmax > 0.7 ? 'beyond the circular limit' : wmax > 0.5 ? 'above the IEC watch value' : 'healthy'}.`);
  if (bl.length) elec.push(`Bushings: highest corrected tan δ ${fmt(bmax, 3)} % — ${bmax > 0.7 ? 'beyond the circular limit' : bmax > 0.5 ? 'above the IEC watch value' : 'healthy'}.`);
  if (coS === 'alert' && wrise) elec.push('CO₂/CO below 3 together with a rising winding tan δ points to deterioration of the solid (paper) insulation — plan DFR / FDS and furan analysis.');
  else if ((v.H2O ?? 0) > 15 && wrise) elec.push('Higher water in oil together with a rising winding tan δ suggests moisture migrating from the paper — consider DFR moisture assessment and oil reconditioning.');
  else if (elec.length) elec.push('The electrical tests do not contradict the oil analysis.');
  // 7 · OLTC & top/bottom
  const oc = ph !== '-' ? oltcCorrelation(u, ph) : null;
  if (oc && oc.verdict === 'alert') sev = worse(sev, 'watch');
  // conclusion
  const VERD = { ok: 'Normal', watch: 'Caution — closer monitoring', alert: 'Abnormal — investigate' };
  const reco = sev === 'alert' ? 'Re-sample within one month (top and bottom, with the OLTC on the same day), confirm the gas generation rate, and plan further diagnostics (DFR, winding resistance, SFRA as indicated by the fault type).' : sev === 'watch' ? 'Re-sample within three months and watch the rate of the gases above Condition 1; keep sampling top and bottom together with the OLTC.' : 'Continue routine half-yearly sampling as per the circular.';
  const facts = [`${S.length} sample date${S.length > 1 ? 's' : ''} on record (${fmtDate(S[0].d)} to ${fmtDate(L.d)}); latest ${fmtDate(L.d)} from ${L.pos.toLowerCase()} sample${L.n > 1 ? 's' : ''}.`,
    `TDCG ${fmt(v.TDCG, 0)} ppm — IEEE C57.104 ${tc[2]}.`,
    over.length ? `Above Condition 1: ${over.map(r => `${chem(r.g)} ${fmt(r.x, 1)} ppm (limit ${C1[r.g]})`).join(', ')}.` : 'Every gas is within the IEEE C57.104 Condition 1 values.',
    tr == null ? 'Only one sample — no generation rate yet.' : `TDCG changed by ${fmt(tr * 30, 1)} ppm per month since ${fmtDate(P.d)} (${days} days).`,
    applicable && dv ? `Duval Triangle 1: zone ${dv.zone} — ${DUVALTXT[dv.zone]}.` : 'Gas levels are normal, so fault-type methods (Duval, IEC ratios) are shown for reference only.'];

  // graphs
  const gasSeries = ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO'].map(g => ({ name: chem(g), color: GC[g], pts: S.filter(s => s.v[g] != null).map(s => [s.d, s.v[g], '']) })).filter(s => s.pts.length);
  const tdcgSeries = [{ name: 'TDCG', color: GC.TDCG, pts: S.filter(s => s.v.TDCG != null).map(s => [s.d, s.v.TDCG, s.v.TDCG > 720 ? 'watch' : 'ok']) }];
  const bars = `<svg viewBox="0 0 420 ${share.length * 30 + 10}" class="dg-bars">${share.map(([g, p], i) => `<text x="0" y="${i * 30 + 21}" class="bl">${chem(g)}</text><rect x="60" y="${i * 30 + 6}" width="${Math.max(1, p * 3.2).toFixed(1)}" height="20" rx="4" fill="${GC[g]}" fill-opacity="${i === 0 ? 1 : .55}"/><text x="${66 + p * 3.2}" y="${i * 30 + 21}" class="bv">${fmt(p, 1)} %</text>`).join('')}</svg>`;

  const r2 = (x) => x == null ? '—' : fmt(x, 2);
  return `<details class="sec inner dga-an"><summary><span class="sec-t"><span class="dg-ic">⚗</span> DGA analysis report · ${esc(name)}</span><span class="dim">IEEE C57.104 · key gas · Duval · IEC 60599 ratios · paper & oil condition · OLTC · electrical tests — ${VERD[sev]}</span><span class="caret">▾</span></summary>
  <div class="sec-b dg">
    <div class="dg-verdict dg-v-${sev}"><div class="dg-vh"><span>Overall assessment</span><b>${VERD[sev]}</b></div><ul>${facts.map(f => `<li>${f}</li>`).join('')}</ul><div class="dg-reco"><b>Recommendation.</b> ${reco}</div></div>

    <h4>1 · Gas concentrations against IEEE C57.104 limits</h4>
    <p class="dg-p">Each dissolved gas of the latest sample (top and bottom merged, the higher value taken) is compared with the IEEE C57.104 Condition-1 value — the level below which a transformer is considered to be operating normally — and with the Condition-2 ceiling. Values in ppm (µL/L).</p>
    <div class="dg-grid"><table class="t dg-t2"><thead><tr><th>Gas</th><th>Latest ${fmtDate(L.d)}</th>${P ? `<th>Previous ${fmtDate(P.d)}</th>` : ''}<th>Condition 1</th><th>% of Condition 1</th><th>Assessment</th></tr></thead><tbody>
      ${gasRows.map(r => `<tr><td><b>${chem(r.g)}</b></td><td class="r c-${r.s}">${fmt(r.x, 1)}</td>${P ? `<td class="r">${fmt(P.v[r.g], 1)}</td>` : ''}<td class="r">${C1[r.g]}</td><td><div class="dg-pb"><span style="width:${Math.min(100, r.pct ?? 0)}%" class="${r.s}"></span></div><small>${r.pct == null ? '—' : fmt(r.pct, 0) + ' %'}</small></td><td>${r.s ? tag(r.s, r.s === 'ok' ? 'normal' : r.s === 'watch' ? 'above Condition 1' : 'above Condition 2') : '—'}</td></tr>`).join('')}
      <tr class="dg-tot"><td><b>TDCG</b></td><td class="r"><b>${fmt(v.TDCG, 0)}</b></td>${P ? `<td class="r">${fmt(P.v.TDCG, 0)}</td>` : ''}<td class="r">720</td><td><div class="dg-pb"><span style="width:${Math.min(100, (v.TDCG ?? 0) / 7.2)}%" class="${tc[1] > 1 ? 'watch' : 'ok'}"></span></div></td><td>${tag(tc[1] > 2 ? 'alert' : tc[1] > 1 ? 'watch' : 'ok', tc[2])}</td></tr></tbody></table>
      <div class="dg-ch"><div class="dg-ch-t">Combustible gases — every sample</div>${svgChart(gasSeries, { dp: 1, w: 560, h: 240, zero: true })}</div></div>

    <h4>2 · Rate of gas generation</h4>
    <p class="dg-p">A steady concentration matters less than a rising one. IEEE C57.104 treats a TDCG rise below 10 ppm/day as normal, 10–30 ppm/day as a reason to shorten the sampling interval, and above 30 ppm/day as abnormal.</p>
    ${P ? `<div class="dg-grid"><table class="t dg-t2"><thead><tr><th>Gas</th><th>Change since ${fmtDate(P.d)}</th><th>ppm / day</th><th>ppm / month</th></tr></thead><tbody>
      ${[...GASES, 'TDCG'].map(g => { const r = rate(g); return `<tr><td><b>${chem(g)}</b></td><td class="r">${v[g] != null && P.v[g] != null ? (v[g] - P.v[g] > 0 ? '+' : '') + fmt(v[g] - P.v[g], 1) : '—'}</td><td class="r ${g === 'TDCG' ? 'c-' + trS : ''}">${r == null ? '—' : fmt(r, 2)}</td><td class="r">${r == null ? '—' : fmt(r * 30, 1)}</td></tr>`; }).join('')}</tbody></table>
      <div class="dg-ch"><div class="dg-ch-t">TDCG trend (720 ppm = Condition 1)</div>${svgChart(tdcgSeries, { dp: 0, w: 560, h: 220, zero: true, limits: [{ y: 720, sev: 'watch', label: '720' }] })}</div></div>
      <p class="dg-p">${days} days between the last two samples · TDCG rate ${tr == null ? '—' : fmt(tr, 2)} ppm/day → ${tag(trS || 'ok', trS === 'alert' ? 'abnormal' : trS === 'watch' ? 'shorten the interval' : 'normal')}</p>` : '<p class="dg-p">Only one sample on record; a rate needs two.</p>'}

    <h4>3 · Key-gas method</h4>
    <p class="dg-p">The relative share of each combustible gas points to the material and the kind of stress: CO → paper, H₂ → partial discharge, C₂H₄ → hot oil, C₂H₂ → arcing. Dominant gas here: <b>${chem(share[0][0])}</b> (${fmt(share[0][1], 1)} %) — typical of ${KEYTXT[share[0][0]]}${share[0][0] === 'CO' && (v.CO ?? 0) <= C1.CO ? ', at a level consistent with normal ageing of the paper' : ''}.</p>
    <div class="dg-bars-w">${bars}</div>

    <h4>4 · Duval Triangle 1 and IEC 60599 gas ratios</h4>
    <p class="dg-p">${applicable ? 'At least one gas is above its normal value, so the fault-identification methods apply.' : 'IEC 60599 applies these methods only when at least one gas exceeds its typical value; here all gases are normal, so the result below is <b>indicative only</b> and is not a fault diagnosis.'}</p>
    <div class="dg-grid"><div class="dg-duval">${dpts.length ? duvalSVG(dpts) : '<div class="dim">CH₄, C₂H₄ and C₂H₂ all zero — the triangle cannot be used.</div>'}<div class="dg-note">red = latest sample, blue = earlier samples</div></div>
      <div><table class="t dg-t2"><thead><tr><th>Method</th><th>Value</th><th>Reading</th></tr></thead><tbody>
        <tr><td>Duval 1 (%CH₄ · %C₂H₄ · %C₂H₂)</td><td class="r">${dv ? `${fmt(dv.CH4, 0)} · ${fmt(dv.C2H4, 0)} · ${fmt(dv.C2H2, 0)}` : '—'}</td><td>${dv ? `<b>${dv.zone}</b> — ${DUVALTXT[dv.zone]}` : '—'}</td></tr>
        <tr><td>IEC R1 = C₂H₂ / C₂H₄</td><td class="r">${r2(ir.R1)}</td><td rowspan="3">${esc(ir.dx)}</td></tr>
        <tr><td>IEC R2 = CH₄ / H₂</td><td class="r">${r2(ir.R2)}</td></tr><tr><td>IEC R3 = C₂H₄ / C₂H₆</td><td class="r">${r2(ir.R3)}</td></tr></tbody></table>
        <p class="dg-p small">IEC 60599 codes: PD (R2 &lt; 0.1, R3 &lt; 0.2) · D1 (R1 &gt; 1, R2 0.1–0.5, R3 &gt; 1) · D2 (R1 0.6–2.5, R2 0.1–1, R3 &gt; 2) · T1 (R2 &gt; 1, R3 &lt; 1) · T2 (R1 &lt; 0.1, R2 &gt; 1, R3 1–4) · T3 (R1 &lt; 0.2, R2 &gt; 1, R3 &gt; 4).</p></div></div>

    <h4>5 · Paper (cellulose) insulation</h4>
    <p class="dg-p">Paper ageing produces CO and CO₂. A CO₂/CO ratio below 3 with high CO points to paper involved in a fault; 3–10 is normal ageing; above 10 indicates mild, general overheating. Latest: CO ${fmt(v.CO, 0)} ppm, CO₂ ${fmt(v.CO2, 0)} ppm → CO₂/CO = <b>${r2(coRatio)}</b> — ${coTxt}. ${tag(coS, coS === 'ok' ? 'normal' : coS === 'watch' ? 'watch' : 'investigate')}</p>

    <h4>6 · Oil quality</h4>
    <table class="t dg-t2"><thead><tr><th>Property</th><th>Latest</th>${P ? '<th>Previous</th>' : ''}<th>Limit (in service)</th><th>Assessment</th></tr></thead><tbody>
      ${oil.map(o => `<tr><td>${o.l}${o.un ? ` <span class="dim">${o.un}</span>` : ''}</td><td class="r c-${o.s}">${fmt(o.x, o.dp)}</td>${P ? `<td class="r">${fmt(o.p, o.dp)}</td>` : ''}<td>${o.lim}</td><td>${o.s ? tag(o.s, o.s === 'ok' ? 'within limit' : o.s === 'watch' ? 'approaching limit' : 'outside limit') : '<span class="dim">not measured</span>'}</td></tr>`).join('')}
      <tr><td>O₂ / N₂ ratio</td><td class="r">${r2(o2n2)}</td>${P ? `<td class="r">${r2(P.v.O2 != null && P.v.N2 > 0 ? P.v.O2 / P.v.N2 : null)}</td>` : ''}<td>≈ 0.5 free-breathing · &lt; 0.3 sealed / O₂ consumed</td><td>${o2n2 == null ? '—' : o2n2 < 0.3 ? 'oxygen consumed (sealed / oxidation) — note when reading CO, CO₂' : 'air-saturated oil, normal for a conservator unit'}</td></tr></tbody></table>

    <h4>7 · Same tank, other compartments</h4>
    <ul class="dg-ul"><li><b>Top vs bottom sample.</b> ${L.n > 1 ? 'Both sampling points were drawn on the latest date and merged above; the per-gas comparison is in the table "Main tank · top vs bottom sample" — they should agree, a large gap means a sampling issue or a localised fault near one valve (IEC 60567).' : `Only the ${L.pos.toLowerCase()} sample is available for the latest date — draw both next time.`}</li>
      ${oc ? `<li><b>OLTC compartment.</b> ${esc(oc.text)}${oc.lag ? ' ' + esc(oc.lag) : ''}</li>` : ''}</ul>

    <h4>8 · Correlation with the electrical tests of this unit</h4>
    ${elec.length ? `<ul class="dg-ul">${elec.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="dg-p">No winding or bushing tan δ result is on record for this unit.</p>'}

    <h4>9 · Conclusion</h4>
    <p class="dg-p"><b>${VERD[sev]}.</b> ${sev === 'ok' ? 'Gas levels, generation rate, paper indicators and oil quality are all within their normal ranges; no incipient fault is indicated.' : sev === 'watch' ? `Some indicators are above their normal values (${[...over.map(r => chem(r.g)), trS === 'watch' ? 'TDCG rate' : '', coS !== 'ok' ? 'CO₂/CO' : ''].filter(Boolean).join(', ') || 'see above'}), but none shows an active fault; the trend decides.` : `The analysis indicates an active fault process (${[...over.filter(r => r.s === 'alert').map(r => chem(r.g)), tc[1] >= 3 ? 'TDCG' : '', trS === 'alert' ? 'TDCG rate' : ''].filter(Boolean).join(', ')}).`} ${reco}</p>
    <p class="dg-src">Methods: IEEE C57.104 (gas limits, TDCG conditions and rates) · IEC 60599 (key gas, gas ratios, Duval Triangle 1) · IEC 60567 (sampling) · IS 1866 (oil in service). Values exactly as recorded in the DGA sheets; copied template rows not in the PDF are left out.</p>
  </div></details>`;
}
