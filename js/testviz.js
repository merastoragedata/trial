// Test page header: engineering facts as compact cards, a test-principle diagram (SVG) per test and
// an at-a-glance strip computed from the data.
import { DB, TESTS, fmt, fmtDate, kvOf, unitName } from './data.js?v=20261126.1917';
import { LIM, schedule, statusOf } from './rules.js?v=20261126.1917';
import { model, RANKP, NOUN, curFY, fyRange, dueTxt, fullName } from './results.js?v=20261126.1917';
import { esc } from './ui.js?v=20261126.1917';
import { IC } from './icons.js?v=20261126.1917';

const SR = '@SR';   // replaced by the test's circular serial number
const F = (ic, k, v, s = '') => ({ ic, k, v, s });
export const FACTS = {
  ct: [F('⚡', 'Test voltage', '10 kV · 50 Hz', '5 kV optional'), F('⎍', 'Mode', 'UST', 'via the test tap'), F('🌡', 'Correction', 'to 20 °C', 'sheet K table'), F('⚑', 'tan δ limit', '≤ 0.7 %', 'circular · 0.5 % IEC watch'),
    F('Δ', 'Change limits', 'Δtan δ ≤ 0.1 % · ΔC −5 % to +10 %', 'vs previous test'), F('⟳', 'Interval', '400 kV 2 yr · 220 kV 1 yr', 'circular Sr 18 / 19')],
  bushing: [F('⚡', 'Test voltage', '10 kV · 50 Hz', '5 kV optional'), F('⎍', 'Mode', 'UST · C₁', 'via the test tap'), F('🌡', 'Correction', 'to 20 °C', 'sheet K table'), F('⚑', 'tan δ limit', '≤ 0.7 %', 'circular · IEC 60137'),
    F('Δ', 'Change limits', 'Δtan δ ≤ 0.1 % · ΔC −5 % to +10 %', 'C change vs previous test'), F('⟳', 'Interval', 'every year', SR)],
  winding: [F('⚡', 'Test voltage', '10 kV · 50 Hz', '5 kV optional'), F('⎍', 'Modes', 'UST · GSTg · GST', 'HV-LV and LV-HV'), F('✓', 'Cross-checks', 'GST = GSTg + UST', 'C(HV-LV) both ends equal'), F('⚑', 'tan δ limit', '≤ 0.7 %', 'circular · IEEE C57.152'),
    F('🌡', 'Correction', 'to 20 °C', 'sheet K table'), F('⟳', 'Interval', 'every 2 years', SR)],
  dga: [F('🧪', 'Samples', 'Top · Bottom · OLTC', 'one main tank per phase unit'), F('⚑', 'Key limits', 'H₂ 100 · C₂H₂ 1 · TDCG 720', 'IEEE C57.104 Cond. 1'), F('◭', 'Fault type', 'Duval · IEC ratios', 'IEC 60599'), F('🛢', 'Oil quality', 'BDV ≥ 50 kV · H₂O ≤ 20 ppm', 'IS 1866'),
    F('📈', 'Rate', 'TDCG ≤ 10 ppm/day', 'IEEE normal'), F('⟳', 'Interval', 'half-yearly', SR)],
  cb_crm: [F('⚡', 'Injection', '≥ 100 A DC', '4-wire (Kelvin)'), F('Ω', 'Limit 400 kV', `≤ ${LIM.crm[400]} µΩ`, 'per break, circular'), F('Ω', 'Limit 220 kV', `≤ ${LIM.crm[220]} µΩ`, 'circular'), F('✓', 'Compare', 'R, Y, B poles', '+ previous test'),
    F('🔧', 'If high', 'clean / tighten / check contacts', 'DCRM for detail'), F('⟳', 'Interval', 'every 2 years', SR)],
  cb_timing: [F('⏱', 'Trip time', `≤ ${LIM.trip[400]} ms (400) · ≤ ${LIM.trip[220]} ms (220)`, 'TC1 and TC2'), F('⏱', 'Close time', `≤ ${LIM.close} ms`, 'circular'), F('≋', 'Pole spread', '≤ 3.3 ms open · 5 ms close', 'IEC 62271-100'), F('⇄', 'C-O time', 'recorded', 'TC1 and TC2'),
    F('🔧', 'If slow', 'lubricate · coil current', 'travel curve'), F('⟳', 'Interval', 'every 2 years', SR)],
  la: [F('∿', 'Measured', 'Itotal · Ith · Icorr', '3rd-harmonic resistive'), F('⚑', 'Icorr', '≤ 150 µA normal', 'circular'), F('⚠', 'Replace', '> 350 µA', 'circular'), F('☂', 'Seasons', 'pre- & post-monsoon', 'Apr–May · Oct–Nov'),
    F('🌡', 'Compare', 'same season, same LA', 'ambient affects Ith'), F('⟳', 'Interval', 'half-yearly', SR)],
};

// ------------------------------------------------------------------ test-principle diagrams (viewBox 420 × 230)
const T = (x, y, t, s = 11, c = '#1d2a36', a = 'middle', w = 700) => `<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${s}" font-weight="${w}" fill="${c}" text-anchor="${a}">${t}</text>`;
const box = (x, y, w, h, t, sub = '', fill = '#eef4fb') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="#34557a" stroke-width="1.4"/>${T(x + w / 2, y + h / 2 + (sub ? -2 : 4), t, 11.5)}${sub ? T(x + w / 2, y + h / 2 + 12, sub, 9.5, '#5b6675', 'middle', 500) : ''}`;
const arrow = (x1, y1, x2, y2, c = '#1a6fc2') => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="2" marker-end="url(#tvArr)"/>`;
const DEF = `<defs><marker id="tvArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1a6fc2"/></marker></defs>`;
function principle(t) {
  if (['ct', 'bushing', 'winding'].includes(t)) return DEF + `
    <g transform="translate(14 14)">${T(96, 10, 'Measuring circuit', 11, '#5b6675', 'middle', 600)}
      ${box(0, 22, 82, 46, '10 kV', 'HV source')}${arrow(82, 45, 118, 45)}
      <rect x="120" y="22" width="70" height="46" rx="8" fill="#fbeccb" stroke="#8a6a1a" stroke-width="1.4"/>${T(155, 42, t === 'winding' ? 'Winding' : t === 'ct' ? 'CT' : 'Bushing', 11)}${T(155, 56, 'insulation', 9.5, '#5b6675', 'middle', 500)}
      ${arrow(190, 45, 226, 45)}${box(228, 22, 104, 46, t === 'winding' ? 'UST / GST' : 'UST · test tap', 'bridge')}
      ${T(166, 90, 'tan δ = I_R / I_C   ·   C = I_C / (ω·U)', 10.5, '#0b3d6e')}</g>
    <g transform="translate(250 112)">${T(70, 8, 'Phasor', 11, '#5b6675', 'middle', 600)}
      <path d="M20 108H150" stroke="#9aa6b1" stroke-width="1"/><path d="M20 108V18" stroke="#9aa6b1" stroke-width="1"/>
      <path d="M20 108L20 26" stroke="#0f766e" stroke-width="3" marker-end="url(#tvArr)"/>${T(10, 30, 'I_C', 10.5, '#0f766e', 'end')}
      <path d="M20 108L46 108" stroke="#c2410c" stroke-width="3"/>${T(46, 124, 'I_R', 10.5, '#c2410c')}
      <path d="M20 108L46 26" stroke="#1a6fc2" stroke-width="3" marker-end="url(#tvArr)"/>${T(54, 34, 'I', 10.5, '#1a6fc2', 'start')}
      <path d="M20 70A38 38 0 0 1 32 72" stroke="#7c3aed" stroke-width="2" fill="none"/>${T(36, 66, 'δ', 13, '#7c3aed', 'start')}
      ${T(100, 70, 'small δ = dry,', 9.5, '#334155', 'start', 500)}${T(100, 84, 'clean insulation', 9.5, '#334155', 'start', 500)}</g>
    <g transform="translate(14 124)">${T(110, 8, 'Judged on', 11, '#5b6675', 'middle', 600)}
      ${[['tan δ @20 °C', '≤ 0.7 %', '#0f766e'], ['Δ tan δ', '≤ 0.1 %', '#1a6fc2'], ['Δ C', '−5 % to +10 %', '#c2410c']].map(([a, b, c], i) => `<rect x="0" y="${20 + i * 30}" width="220" height="24" rx="6" fill="#fff" stroke="${c}" stroke-width="1.3"/>${T(10, 36 + i * 30, a, 10.5, c, 'start')}${T(210, 36 + i * 30, b, 10.5, '#1d2a36', 'end')}`).join('')}</g>`;
  if (t === 'cb_crm') return DEF + `
    <g transform="translate(20 30)"><path d="M60 80H320" stroke="#5b6675" stroke-width="6" stroke-linecap="round"/>
      <rect x="160" y="62" width="60" height="36" rx="6" fill="#e3e8ee" stroke="#34557a" stroke-width="1.5"/>${T(190, 84, 'contacts', 10.5)}
      ${box(150, 140, 80, 40, 'DC ≥ 100 A', 'current source', '#fbeccb')}
      <path d="M150 160H70V86M230 160H310V86" stroke="#c2410c" stroke-width="2.2" fill="none"/>${T(80, 124, 'I →', 10.5, '#c2410c', 'start')}
      <path d="M110 80V20H150M270 80V20H230" stroke="#0f766e" stroke-width="2" fill="none" stroke-dasharray="5 3"/>${box(150, 4, 80, 32, 'mV', 'sense', '#e6f5ec')}
      ${T(190, 205, 'R = V / I   (4-wire Kelvin: leads do not add resistance)', 10.5, '#0b3d6e')}</g>`;
  if (t === 'cb_timing') { const lane = (y, lab, open, c) => `${T(40, y + 4, lab, 10.5, c, 'end')}<path d="M48 ${y}H${48 + open}" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M${48 + open} ${y}H380" stroke="${c}" stroke-width="2" stroke-dasharray="3 4"/>`;
    return DEF + `<g transform="translate(0 10)">${T(210, 14, 'Trip command → main contacts part (open time)', 11, '#5b6675', 'middle', 600)}
      <path d="M48 40H80V28H120V40H380" stroke="#7c3aed" stroke-width="2" fill="none"/>${T(40, 38, 'TC', 10.5, '#7c3aed', 'end')}
      ${lane(80, 'R', 150, '#c4161c')}${lane(112, 'Y', 156, '#b78a00')}${lane(144, 'B', 152, '#1a5fc2')}
      <path d="M${48 + 25 * 7} 56V170" stroke="#c4161c" stroke-width="1.6" stroke-dasharray="5 3"/>${T(48 + 25 * 7 + 4, 186, `limit ${LIM.trip[400]} ms (400 kV)`, 10, '#c4161c', 'start')}
      ${T(170, 205, 'pole spread = latest − earliest pole', 10.5, '#0b3d6e')}</g>`; }
  if (t === 'la') { let tot = '', res = ''; for (let i = 0; i <= 300; i += 4) { const a = i / 300 * Math.PI * 4; tot += `${i ? 'L' : 'M'}${60 + i} ${100 - 46 * Math.cos(a)}`; res += `${i ? 'L' : 'M'}${60 + i} ${100 - (8 * Math.sin(a) + 6 * Math.sin(3 * a))}`; }
    return DEF + `<g transform="translate(0 10)">${T(210, 14, 'LA leakage current: mostly capacitive, small resistive part', 11, '#5b6675', 'middle', 600)}
      <path d="M60 100H370" stroke="#9aa6b1"/><path d="${tot}" stroke="#1a6fc2" stroke-width="2.4" fill="none"/><path d="${res}" stroke="#c2410c" stroke-width="2.4" fill="none"/>
      ${T(372, 60, 'Itotal', 10.5, '#1a6fc2', 'end')}${T(372, 128, 'resistive (3rd harmonic)', 10.5, '#c2410c', 'end')}
      ${[['≤ 150 µA', 'normal', '#0f766e'], ['150–350', 'investigate', '#b45309'], ['> 350 µA', 'replace', '#c4161c']].map(([a, b, c], i) => `<rect x="${40 + i * 118}" y="162" width="108" height="34" rx="7" fill="#fff" stroke="${c}" stroke-width="1.4"/>${T(94 + i * 118, 177, a, 10.5, c)}${T(94 + i * 118, 190, b, 9.5, '#334155', 'middle', 500)}`).join('')}</g>`; }
  // DGA: gas formation vs fault temperature (Halstead)
  const g = [['H₂', 'PD / corona', 62, '#2f6fd0'], ['CH₄ · C₂H₆', '150–300 °C', 136, '#0f766e'], ['C₂H₄', '300–700 °C', 210, '#c2410c'], ['C₂H₂', 'arcing > 700 °C', 284, '#c4161c'], ['CO · CO₂', 'paper', 358, '#a16207']];
  return DEF + `<g transform="translate(0 10)">${T(210, 14, 'Which gas points to which fault (key-gas principle)', 11, '#5b6675', 'middle', 600)}
    <path d="M30 150H410" stroke="#334155" stroke-width="1.5" marker-end="url(#tvArr)"/>${T(405, 170, 'fault energy / temperature →', 10, '#334155', 'end', 600)}
    ${g.map(([n, d, x, c], i) => `<rect x="${x - 34}" y="${142 - (40 + i * 18)}" width="68" height="${40 + i * 18}" rx="6" fill="${c}" fill-opacity=".85"/>${T(x, 142 - (40 + i * 18) - 8, n, 11, c)}${T(x, 190, d, 9.5, '#334155', 'middle', 500)}`).join('')}
    ${T(210, 212, 'Top + bottom samples of one tank should agree · OLTC gas must not reach it', 10, '#0b3d6e')}</g>`;
}

/** At-a-glance numbers from the data. */
function glance(t) {
  const M = model(t), [fs, fe] = fyRange(curFY()), P = RANKP[t][0];
  const L = M.elements.filter(e => e.L), vals = L.map(e => ({ e, v: P.get(e.L) })).filter(x => x.v != null);
  const worst = vals.sort((a, b) => P.asc ? a.v - b.v : b.v - a.v)[0];
  const lastAll = L.map(e => e.L.date).sort().pop();
  const testedFY = M.elements.filter(e => e.done.some(r => r.date >= fs.toISOString().slice(0, 10) && r.date <= fe.toISOString().slice(0, 10))).length;
  const sch = schedule().filter(s => s.t === t), od = sch.filter(s => s.status === 'overdue').length, nx = sch.filter(s => s.due >= DB.today).sort((a, b) => a.due - b.due)[0];
  const med = vals.length ? vals.map(x => x.v).sort((a, b) => a - b)[vals.length >> 1] : null;
  const card = (k, v, s, cls = '') => `<div class="gl ${cls}"><span>${k}</span><b>${v}</b><small>${s}</small></div>`;
  const bad = L.filter(e => ['alert', 'critical'].includes(statusOf(e.L))).length;
  return `<div class="glance g5">
    ${card('Population', M.elements.length, `${NOUN[t][1]} in ${M.units.length} ${['bushing', 'winding', 'dga'].includes(t) ? 'units' : 'bays'}`)}
    ${card(`Tested in FY ${curFY()}`, `${testedFY}`, `${M.elements.length ? Math.round(testedFY / M.elements.length * 100) : 0} % of population · latest ${lastAll ? fmtDate(lastAll) : '—'}`)}
    ${card('Beyond circular limit', bad, bad ? `${bad === 1 ? NOUN[t][0] : NOUN[t][1]} for planned action` : 'all within the circular limit', bad ? 'bad' : 'good')}
    ${card('Overdue', od, `${od === 1 ? 'bay / unit' : 'bays / units'} past the due date${nx ? ` · next ${fmtDate(nx.due)}` : ''}`, od ? 'bad' : 'good')}
    ${card(`Highest ${P.label.replace(/ \(.*\)/, '')}`, worst ? `${fmt(worst.v, P.dp)} <i>${P.unit}</i>` : '—', worst ? esc(fullName(t, worst.e.u, worst.e.sub)) : '', '')}
  </div>`;
}

export function testHeader(t, artHtml, actions) {
  const Tt = TESTS[t];
  return `<section class="th2">
    <div class="th2-art">${artHtml}</div>
    <div class="th2-mid"><div class="eyebrow">${esc(Tt.eq)} · circular Sr ${Tt.sr}</div><h1>${esc(Tt.name)}</h1>
      <div class="facts">${FACTS[t].map(f => `<div class="fact"><span class="fi">${f.ic}</span><div><span class="fk">${f.k}</span><b>${f.v}</b>${f.s ? `<small>${f.s === SR ? `circular Sr ${t === 'ct' ? '18 / 19' : Tt.sr}` : f.s}</small>` : ''}</div></div>`).join('')}</div>
      <div class="th2-act">${actions}</div></div>
  </section>${glance(t)}
  <details class="sec th2-prd"><summary><span class="sec-t">How the test works</span><span class="dim">measuring circuit, what is judged and the limits</span><span class="caret">▾</span></summary><div class="sec-b"><div class="th2-pr"><svg viewBox="0 0 420 230" role="img" aria-label="Test principle">${principle(t)}</svg></div></div></details>`;
}
