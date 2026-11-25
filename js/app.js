import { DB, TESTS, loadAll, recs, groupBy, unitName, bayTitle, kvOf, isTF, fmt, fmtDate, unitsFor, sortUnits, testsForUnit } from './data.js';
import { run, findings, statusOf, unitStatus, schedule, SEV, SEV_LABEL, LIM, duval1, DUVAL_NAMES, worst } from './rules.js';
import { esc, chem, pill, sevIcon, phase, $, $$, lineChart, barChart, destroyCharts, PHASE_COLOR, circularBtn, modal, drawSnippet, bandsFrom, duvalSVG, setPaletteItems, openPalette } from './ui.js';
import { IC, LOGO } from './icons.js';
import { healthIndex, gaugeSVG, HI_WEIGHTS, HI_BANDS, bindRise } from './health.js';
import { sld400, sld220, SLD_LEGEND } from './sld.js';

const view = () => $('#view');
const setCrumbs = (parts) => { $('#crumbs').innerHTML = parts.map((p, i) => i === parts.length - 1 ? `<b>${esc(p[0])}</b>` : `<a href="${p[1]}">${esc(p[0])}</a><span class="sep">/</span>`).join(''); document.title = `${parts.at(-1)[0]} · EHV Diagnostic Portal`; };
const ph = (r) => r.ph && r.ph !== '-' ? r.ph : '';
const TF_UNITS = ['ICT1', 'ICT2', 'SPARE_ICT', 'BUS_REACTOR'];
const DIAS = [['401', '402', '403'], ['404', '405', '406'], ['407', '408', '409'], ['410', '411', '412'], ['413', '414', '415']];
let SCHED = [];
const pageHead = (eyebrow, title, lede, actions = '', meta = '') => `<header class="page-h"><div class="grow"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}${meta}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</header>`;
const printBtn = `<button class="btn" onclick="window.print()">${IC.print}Print / PDF</button>`;

// ============================================================ test view config
const SHORT = { tand: 'Tan δ meas.', tand20: 'Tan δ @20 °C', dC: 'ΔC %', C: 'C pF', open1: 'Trip TC1', open2: 'Trip TC2', close: 'Close', co1: 'C-O', Icorr: 'Icorr', Ith: 'Ith', Itotal: 'Itotal', hc: 'H₂ + HCs', cox: 'CO / CO₂', C2H2: 'C₂H₂', BDV: 'BDV', H2O: 'Water' };
const pctC = (s) => { const b = s.find(r => r.v.C != null); return (r) => (b && r.v.C != null) ? +((r.v.C - b.v.C) / b.v.C * 100).toFixed(2) : null; };
const DC_LIM = [{ y: 10, label: '+10 % (circular)', sev: 'alert' }, { y: -5, label: '−5 % (circular)', sev: 'alert', lo: true }];
const TV = {
  bushing: {
    group: r => `${r.unit}|${r.pos}`, groupLabel: r => `${unitName(r.unit)} · ${r.pos ? r.pos + ' bushing' : 'Bushings'}`, series: r => r.ph,
    metrics: [
      { k: 'tand', label: 'Tan δ % (measured)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }, { y: 1.0, label: 'Replace 1.0 %', sev: 'critical' }] },
      { k: 'tand20', label: 'Tan δ % (sheet-corrected 20 °C)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }] },
      { k: 'dC', label: 'ΔC₁ % vs first test', unit: '%', derived: pctC, limits: DC_LIM },
    ],
    cols: [['Equipment', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Bushing', r => esc(r.pos || '—')], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['C₁ pF', r => fmt(r.v.C, 1), 'r'], ['Tan δ %', r => fmt(r.v.tand, 3), 'r', r => r.v.tand > 0.7], ['Oil °C', r => fmt(r.v.temp, 0), 'r'], ['@20 °C', r => fmt(r.v.tand20, 3), 'r'], ['ΔC₁ %', (r, s) => fmt(pctC(s)(r), 1), 'r']],
    note: '<b>Engineering note.</b> Bushings are judged on <i>measured</i> tan δ. The sheet\'s generic K-factor (÷1.61 at 42 °C) belongs to winding insulation; OIP bushings stay almost flat from 20 to 60 °C, so the "corrected" value understates the real one by about 38 %.',
  },
  winding: {
    group: r => `${r.unit}|${r.ph}`, groupLabel: r => `${unitName(r.unit)}${ph(r) ? ' · ' + r.ph + '-phase' : ''}`, series: r => `${r.mode} ${r.acting}`,
    metrics: [
      { k: 'tand20', label: 'Tan δ % @ 20 °C', unit: '%', limits: [{ y: 0.5, label: 'IEEE C57.152 0.5 %', sev: 'watch' }, { y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }] },
      { k: 'tand', label: 'Tan δ % (measured)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }] },
      { k: 'dC', label: 'ΔC % vs first test', unit: '%', derived: pctC, limits: DC_LIM },
    ],
    cols: [['Equipment', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Ph', r => phase(r.ph)], ['Mode', r => `<span class="tag">${esc(r.mode)}</span>`], ['Insulation', r => esc(r.acting)], ['Tested', r => fmtDate(r.date)],
      ['C pF', r => fmt(r.v.C, 1), 'r'], ['Tan δ %', r => fmt(r.v.tand, 3), 'r'], ['Oil °C', r => fmt(r.v.temp, 0), 'r'], ['@20 °C', r => fmt(r.v.tand20, 3), 'r', r => r.v.tand20 > 0.7], ['ΔC %', (r, s) => fmt(pctC(s)(r), 1), 'r']],
    seriesKey: r => `${r.unit}|${r.ph}|${r.acting}`,
    note: '<b>Reading the modes.</b> UST measures C<sub>HL</sub> (inter-winding) and excludes earth paths. GSTg isolates C<sub>H</sub> or C<sub>L</sub> to earth. GST = GSTg + UST, which is used as a cross-check on test leads. A rising C<sub>H</sub> with a steady C<sub>HL</sub> points at HV-to-tank insulation or the HV bushings.',
  },
  ct: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'tand', label: 'Tan δ % (measured)', unit: '%', limits: [{ y: 0.5, label: 'IEC 61869 0.5 %', sev: 'watch' }, { y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }] },
      { k: 'C', label: 'Capacitance pF', unit: 'pF' },
      { k: 'dC', label: 'ΔC % vs first test', unit: '%', derived: pctC, limits: DC_LIM },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['kV', r => kvOf(r.unit), 'r'], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['C pF', r => fmt(r.v.C, 1), 'r'], ['Tan δ %', r => fmt(r.v.tand, 3), 'r', r => r.v.tand > 0.7], ['Amb °C', r => fmt(r.v.temp, 0), 'r'], ['ΔC %', (r, s) => fmt(pctC(s)(r), 1), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]],
  },
  cb_timing: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'open1', label: 'Trip time, TC1 (ms)', unit: 'ms', limits: r => [{ y: LIM.trip[kvOf(r.unit)], label: `Circular ${LIM.trip[kvOf(r.unit)]} ms`, sev: 'alert' }] },
      { k: 'open2', label: 'Trip time, TC2 (ms)', unit: 'ms', limits: r => [{ y: LIM.trip[kvOf(r.unit)], label: `Circular ${LIM.trip[kvOf(r.unit)]} ms`, sev: 'alert' }] },
      { k: 'close', label: 'Close time (ms)', unit: 'ms', limits: [{ y: 150, label: 'Circular 150 ms', sev: 'alert' }] },
      { k: 'co1', label: 'Close–Open (ms)', unit: 'ms' },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['Trip TC1', r => fmt(r.v.open1, 1), 'r', r => r.v.open1 > LIM.trip[kvOf(r.unit)]], ['Trip TC2', r => fmt(r.v.open2, 1), 'r', r => r.v.open2 > LIM.trip[kvOf(r.unit)]], ['Close', r => fmt(r.v.close, 1), 'r', r => r.v.close > 150], ['C-O TC1', r => fmt(r.v.co1, 1), 'r'], ['C-O TC2', r => fmt(r.v.co2, 1), 'r']],
    note: '<b>Why both trip coils matter.</b> TC1 and TC2 are redundant trip circuits, so a slow TC2 is as serious as a slow TC1. Trip time adds directly to fault-clearing time and erodes the CEA 100 ms clearance margin for 400 kV.',
  },
  la: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'Icorr', label: 'Icorr — 3rd-harmonic resistive (µA)', unit: 'µA', limits: [{ y: 150, label: '150 µA (stack IR)', sev: 'alert' }, { y: 350, label: '350 µA (replace)', sev: 'critical' }] },
      { k: 'Ith', label: 'Ith (µA)', unit: 'µA', limits: [{ y: 150, label: '150 µA', sev: 'alert' }, { y: 350, label: '350 µA', sev: 'critical' }] },
      { k: 'Itotal', label: 'Itotal — total leakage, mostly capacitive (µA)', unit: 'µA' },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)], ['Season', r => esc(r.season || '')],
      ['Ith µA', r => fmt(r.v.Ith, 0), 'r', r => r.v.Ith > 150], ['Icorr µA', r => fmt(r.v.Icorr, 0), 'r', r => r.v.Icorr > 150], ['Itotal µA', r => fmt(r.v.Itotal, 0), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]],
    note: '<b>Method.</b> ZnO block degradation shows up in the <i>resistive</i> component; total leakage is about 90 % capacitive and is a trend only. The circular judges the 3rd-harmonic resistive current, so the portal evaluates the higher of Ith and Icorr. Large pre/post-monsoon swings usually point to surface leakage, not block ageing.',
  },
  dga: {
    group: r => `${r.unit}|${r.ph}|${r.pos}`, groupLabel: r => `${unitName(r.unit)}${ph(r) ? ' · ' + r.ph + '-ph' : ''} · ${r.pos}`,
    multi: true,
    metrics: [
      { k: 'hc', label: 'H₂ & hydrocarbons (ppm)', unit: 'ppm', gases: ['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2'] },
      { k: 'cox', label: 'CO & CO₂ — cellulose indicators (ppm)', unit: 'ppm', gases: ['CO', 'CO2'] },
      { k: 'C2H2', label: 'Acetylene C₂H₂ — arcing indicator (ppm)', unit: 'ppm', gases: ['C2H2'], limits: [{ y: 1, label: 'Cond-1 1 ppm', sev: 'alert' }] },
      { k: 'BDV', label: 'Breakdown voltage (kV)', unit: 'kV', gases: ['BDV'], limits: [{ y: 60, label: 'IEC 60422 good ≥ 60', sev: 'watch', lo: true }, { y: 50, label: '50 kV (sheet)', sev: 'alert', lo: true }] },
      { k: 'H2O', label: 'Water content (ppm)', unit: 'ppm', gases: ['H2O'], limits: [{ y: 15, label: 'IEC 60422 15 ppm', sev: 'watch' }, { y: 20, label: '20 ppm (sheet)', sev: 'alert' }] },
    ],
    cols: [['Equipment', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Ph', r => phase(r.ph)], ['Sample', r => esc(r.pos)], ['Date', r => fmtDate(r.date)],
      ...['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2'].map(g => [g.replace(/(\d)/g, '<sub>$1</sub>'), r => fmt(r.v[g], 0), 'r', r => r.pos !== 'OLTC' && r.v[g] > LIM.dga[g]]),
      ['BDV', r => fmt(r.v.BDV, 0), 'r', r => r.v.BDV < 50], ['H₂O', r => fmt(r.v.H2O, 0), 'r', r => r.pos !== 'OLTC' && r.v.H2O > 20],
      ['Duval', r => { if (r.pos === 'OLTC') return '<span class="dim">n/a</span>'; const d = duval1(r.v); const big = ['CH4', 'C2H4', 'C2H2'].some(g => r.v[g] > LIM.dga[g]); return d ? `<span class="tag ${big ? 'chg' : ''}" title="${esc(DUVAL_NAMES[d.zone])}${big ? '' : ' (gases below typical — indicative only)'}">${d.zone}${big ? '' : '*'}</span>` : '<span class="dim">—</span>'; }]],
    note: '<b>Interpretation rules.</b> OLTC samples are for record only: diverter oil arcs in normal service, so main-tank limits and Duval Triangle 1 do not apply (use Triangle 2). Zones marked * are indicative only, because IEC 60599 applies ratios only after gases exceed typical values.',
  },
};

// ============================================================ shared renderers
function clauseCard(sr, t) {
  const r = DB.normsBySr[sr]; if (!r) return '';
  const extra = t === 'ct' ? [19, 20] : [];
  return `<div class="card"><div class="card-h"><span style="width:18px;color:var(--brand-2)">${IC.norms}</span><h3>MSETCL circular · Sr ${sr}${extra.length ? ' / ' + extra.join(' / ') : ''}</h3><div class="sp"></div>${circularBtn(sr, 'Scan')}</div>
    <div class="card-b"><dl class="kv"><dt>Activity</dt><dd>${esc(r.activity)}</dd><dt>Frequency</dt><dd><b>${esc(r.changed ? r.revised : r.existing)}</b>${r.changed ? ` <span class="tag chg">revised from ${esc(r.existing)}</span>` : ' <span class="dim">· unchanged in 2024</span>'}</dd><dt>Done by</dt><dd>${esc(r.by)}</dd></dl>
    ${extra.map(s => { const x = DB.normsBySr[s]; return `<div class="note mt">Sr ${s}: ${esc(x.activity)} · <b>${esc(x.existing)}</b> · ${esc(x.by)} ${circularBtn(s, 'Scan')}</div>`; }).join('')}
    ${r.limits.length ? `<div class="clause mt"><b>Limiting values & actions</b><ol>${r.limits.map(l => `<li>${esc(l)}</li>`).join('')}</ol></div>` : '<p class="note mt">The circular gives no limiting values here. Per Note 1, they are to be decided with S.E., PAC.</p>'}</div></div>`;
}
function standardsCard(t) {
  const key = t === 'dga' ? ['dga', 'oil'] : [t];
  const blocks = key.map(k => DB.standards.tests[k]).filter(Boolean);
  if (!blocks.length) return '';
  return `<div class="card"><div class="card-h"><span style="width:18px;color:var(--brand-2)">${IC.standards}</span><h3>Industry practice</h3><div class="sp"></div><a class="btn sm ghost" href="#/standards">All standards ${IC.arrow}</a></div><div class="card-b">
    ${blocks.map(b => `<div class="note" style="font-weight:600;margin-bottom:2px">${esc(b.title)}</div>${b.items.map(stdRow).join('')}`).join('<div class="mt"></div>')}</div></div>`;
}
const stdRow = (i) => `<div class="std-row"><div><div class="s">${esc(i.std)}</div><div class="c">${esc(i.topic)}</div></div><div><div class="v">${esc(i.value)} ${i.verify ? '<span class="tag ver" title="Confirm against licensed copy">verify</span>' : ''}</div><div class="cmp">vs circular: ${esc(i.vsCircular)}</div></div></div>`;

function latestTable(t, rs) {
  const cfg = TV[t];
  const sk = cfg.seriesKey || (r => `${r.unit}|${r.pos}|${r.ph}`);
  const valid = ['bushing', 'winding', 'ct'].includes(t) ? rs.filter(r => r.v.tand != null || r.v.C != null) : rs;
  const rows = [...groupBy(valid, sk).values()].map(s => { s.sort((a, b) => a.date.localeCompare(b.date)); return { r: s[s.length - 1], s }; })
    .sort((a, b) => sortUnits(a.r.unit, b.r.unit) || (a.r.pos || '').localeCompare(b.r.pos || '') || a.r.ph.localeCompare(b.r.ph));
  return `<div class="tbl-wrap"><table class="t"><thead><tr>${cfg.cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}<th>Status</th></tr></thead><tbody>
    ${rows.map(({ r, s }) => `<tr>${cfg.cols.map(c => `<td class="${c[2] || ''} ${c[3] && c[3](r) ? 'bad' : ''}">${c[1](r, s)}</td>`).join('')}<td>${pill(statusOf(r))}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function chartCard(t, key, rs, cfg) {
  return `<div class="chart-card" data-chart data-g="${esc(key)}"><div class="card-h"><h3>${esc(cfg.groupLabel(rs[0]))}</h3>${pill(worst(rs.map(statusOf)))}<div class="sp"></div>
    <div class="seg" role="tablist">${cfg.metrics.map((m, i) => `<button role="tab" class="${i ? '' : 'on'}" data-m="${i}" title="${esc(m.label)}">${esc(SHORT[m.k] || m.label)}</button>`).join('')}</div></div>
    <div class="chart-box"><canvas></canvas></div><div class="legend-note" data-lbl></div></div>`;
}

function drawChart(card, rs, cfg, mi) {
  const m = cfg.metrics[mi];
  card.querySelector('[data-lbl]').textContent = m.label + (m.limits ? ' · shaded = outside limit' : '');
  const old = Chart.getChart(card.querySelector('canvas')); if (old) old.destroy();
  const colors = PHASE_COLOR();
  let series;
  if (cfg.multi) {
    const s = [...rs].sort((a, b) => a.date.localeCompare(b.date));
    series = m.gases.map(g => ({ label: g.replace(/(\d)/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]), points: s.filter(r => r.v[g] != null).map(r => ({ x: r.date, y: r.v[g] })) }));
  } else {
    series = [...groupBy(rs, cfg.series)].map(([k, s]) => {
      s.sort((a, b) => a.date.localeCompare(b.date));
      const f = m.derived ? m.derived(s) : (r => r.v[m.k]);
      return { label: k, color: colors[k], points: s.map(r => ({ x: r.date, y: f(r), meta: r.season || (r.v.temp != null ? `${r.v.temp} °C` : '') })).filter(p => p.y != null) };
    }).sort((a, b) => 'RYBN'.indexOf(a.label) - 'RYBN'.indexOf(b.label));
  }
  series = series.filter(s => s.points.length);
  if (!series.length) { card.querySelector('.chart-box').innerHTML = '<div class="empty">No values recorded for this metric</div>'; return; }
  const lim = typeof m.limits === 'function' ? m.limits(rs[0]) : (m.limits || []);
  const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const sevColor = { alert: c('--alert'), critical: c('--crit'), watch: c('--watch') };
  lineChart(card.querySelector('canvas'), { series, limits: lim.map(l => ({ ...l, color: sevColor[l.sev] })), bands: bandsFrom(lim), yLabel: m.unit, unit: m.unit });
}

function wireCharts(root, t, groups) {
  const cfg = TV[t];
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); drawChart(e.target, groups.get(e.target.dataset.g), cfg, 0); }
  }, { rootMargin: '200px' });
  $$('[data-chart]', root).forEach(card => {
    io.observe(card);
    $$('.seg button', card).forEach(b => b.onclick = () => {
      $$('.seg button', card).forEach(x => x.classList.toggle('on', x === b));
      const box = card.querySelector('.chart-box'); if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
      drawChart(card, groups.get(card.dataset.g), cfg, Number(b.dataset.m));
    });
  });
}

function findingList(fs, max) {
  if (!fs.length) return `<div class="empty">${pill('ok', 'All evaluated values within limits')}</div>`;
  const list = max ? fs.slice(0, max) : fs;
  return list.map(f => `<article class="finding">${sevIcon(f.sev)}<div><div class="ttl">${esc(chem(f.title))}</div><div class="where">${esc(f.where)}</div>${f.detail ? `<div class="det">${esc(chem(f.detail))}</div>` : ''}
    ${f.action ? `<div class="act"><b>Recommended:</b> ${esc(chem(f.action))}</div>` : ''}
    <div class="meta"><span class="tag b">${esc(TESTS[f.t]?.short || f.t)}</span><span class="tag">Basis: ${esc(f.basis)}</span><span class="tag">${fmtDate(f.date)}</span></div></div>
    <div>${f.unit && f.unit !== '*' ? `<a class="btn sm" href="#/eq/${f.unit}?t=${f.t}">Open ${IC.arrow}</a>` : `<a class="btn sm" href="#/test/${f.t}">Open ${IC.arrow}</a>`}</div></article>`).join('')
    + (max && fs.length > max ? `<div class="card-b" style="border-top:1px solid var(--line)"><a href="#/findings">View all ${fs.length} findings →</a></div>` : '');
}

function crmBody(rs, scoped) {
  const secs = [...groupBy(rs.filter(r => r.v.R != null), r => kvOf(r.unit))].sort((a, b) => b[0] - a[0]).map(([kv, g]) => ({ kv, g, bays: [...new Set(g.map(r => r.unit))].sort(sortUnits), id: 'crm' + kv }));
  let html = `<div class="grid ${scoped || secs.length < 2 ? '' : 'g2'} mb">${secs.map(s => `<div class="chart-card"><div class="card-h"><h3>${s.kv} kV breakers · main-contact resistance per pole</h3></div><div class="chart-box" style="height:${scoped ? 240 : 290}px"><canvas id="${s.id}"></canvas></div><div class="legend-note">Shaded = above circular limit ${LIM.crm[s.kv]} µΩ (Sr 24) · test current ≈ ${fmt(Math.round(s.g.reduce((a, r) => a + (r.v.I || 0), 0) / s.g.length), 0)} A DC (IEC 62271-1 requires ≥ 50 A)</div></div>`).join('')}</div>`;
  const cols = [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)], ['CRM µΩ', r => fmt(r.v.R, 1), 'r', r => r.v.R > LIM.crm[kvOf(r.unit)]], ['Current A', r => fmt(r.v.I, 1), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]];
  const rows = [...rs].sort((a, b) => sortUnits(a.unit, b.unit) || a.ph.localeCompare(b.ph));
  html += `<div class="card"><div class="card-h"><h3>Latest readings</h3></div><div class="tbl-wrap"><table class="t"><thead><tr>${cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}<th>Status</th></tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c[2] || ''} ${c[3] && c[3](r) ? 'bad' : ''}">${c[1](r)}</td>`).join('')}<td>${pill(statusOf(r))}</td></tr>`).join('')}</tbody></table></div></div>`;
  return { html, after: (root) => secs.forEach(s => { const c = PHASE_COLOR(); const ch = barChart(root.querySelector('#' + s.id), { labels: s.bays, yLabel: 'µΩ', limits: [{ y: LIM.crm[s.kv], label: `Circular ${LIM.crm[s.kv]} µΩ` }], series: ['R', 'Y', 'B'].map(p => ({ label: p, color: c[p], data: s.bays.map(b => s.g.find(r => r.unit === b && r.ph === p)?.v.R ?? null) })) }); ch.options.plugins.zones = { bands: bandsFrom([{ y: LIM.crm[s.kv], sev: 'alert' }]) }; ch.update(); }) };
}

function duvalCard(rs) {
  const main = rs.filter(r => r.pos !== 'OLTC');
  const latest = [...groupBy(main, r => r.unit + r.ph + r.pos).values()].map(s => s.sort((a, b) => a.date.localeCompare(b.date)).at(-1));
  const col = PHASE_COLOR();
  const pts = main.map(r => { const d = duval1(r.v); if (!d) return null; const isL = latest.includes(r); return { ...d, big: isL, color: col[r.ph] || col['-'], label: `${unitName(r.unit)} ${ph(r)} ${r.pos} ${r.date}` }; }).filter(Boolean);
  const counts = {}; latest.forEach(r => { const d = duval1(r.v); if (d) counts[d.zone] = (counts[d.zone] || 0) + 1; });
  return `<div class="card mb"><div class="card-h"><h3>Duval Triangle 1 · main-tank samples</h3><span class="sub">IEC 60599 Annex B</span><div class="sp"></div></div><div class="card-b"><div class="grid g-7-5" style="align-items:center">
    <div>${duvalSVG(pts)}</div>
    <div><p class="note" style="margin-top:0">Large dots are the latest sample of each tank location (coloured by phase); faint dots are history. A cluster drifting from T1 toward T2/T3, or any point in D1/D2, is the pattern to act on.</p>
    <table class="t"><tbody>${Object.entries(DUVAL_NAMES).map(([k, n]) => `<tr><td><b>${k}</b></td><td>${esc(n)}</td><td class="r">${counts[k] || ''}</td></tr>`).join('')}</tbody></table>
    <p class="note">Applies to the relative proportion of CH₄ / C₂H₄ / C₂H₂ only. Read it together with absolute levels and their rate of rise.</p></div></div></div></div>`;
}

function renderTestBody(t, rs, scoped) {
  const cfg = TV[t];
  let html = cfg?.note ? `<div class="callout mb">${cfg.note}</div>` : '';
  if (t === 'cb_crm') { const b = crmBody(rs, scoped); return { html: html + b.html, after: b.after }; }
  if (t === 'dga') html += duvalCard(rs);
  const groups = groupBy(rs, cfg.group);
  const keys = [...groups.keys()].sort((a, b) => { const A = groups.get(a)[0], B = groups.get(b)[0]; return sortUnits(A.unit, B.unit) || a.localeCompare(b); });
  html += `<div class="card mb"><div class="card-h"><h3>Latest results</h3><div class="sp"></div><span class="note">${rs.length} records · ${keys.length} ${keys.length === 1 ? 'group' : 'groups'}</span></div>${latestTable(t, rs)}</div>`;
  html += `<div class="sec-h"><h2>Trends</h2><span class="note">Shaded bands mark readings outside the limit · hover a point for its date & temperature</span></div><div class="grid gauto">${keys.map(k => chartCard(t, k, groups.get(k), cfg)).join('')}</div>`;
  return { html, after: (root) => wireCharts(root, t, groups) };
}

// ============================================================ Health index widgets
function hiCard(u) {
  const h = healthIndex(u); if (!h) return '';
  return `<a class="hi" href="#/eq/${u}">${gaugeSVG(h.hi)}<div><div class="n">${esc(unitName(u))}</div><div class="m">${esc(DB.site.units[u].rating)}</div>
    <div class="band band-${h.band[1]}">${esc(h.band[2])}</div><div class="m">Governed by ${esc(h.factors[h.governing].label.toLowerCase())}</div></div></a>`;
}
function hiPanel(u) {
  const h = healthIndex(u); if (!h) return '';
  const bar = (k) => { const f = h.factors[k]; if (!f) return `<div class="hi-bar"><span class="dim">${{ dga: 'Dissolved gases', oil: 'Oil quality', winding: 'Winding insulation', bushing: 'Bushings' }[k]}</span><div class="track"></div><span class="val dim">n/a</span></div>`;
    const bb = HI_BANDS.find(b => f.score >= b[0]); return `<div class="hi-bar" title="${esc(f.why)}"><span>${esc(f.label)} <span class="dim">· ${HI_WEIGHTS[k]}%</span></span><div class="track"><div class="fill bg-${bb[1]}" style="width:${Math.max(2, f.score)}%"></div></div><span class="val">${Math.round(f.score)}</span></div><div class="note hi-why">${esc(chem(f.why))}</div>`; };
  return `<div style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center">
    <div style="text-align:center">${gaugeSVG(h.hi, 110)}<div class="band band-${h.band[1]}" style="font-weight:650">${esc(h.band[2])}</div></div>
    <div class="hi-bars">${['dga', 'oil', 'winding', 'bushing'].map(bar).join('')}</div></div>
    <p class="note mt" style="margin-bottom:0"><b>Health Index ${h.hi}/100</b> · ${esc(h.band[3])}. A weighted-factor index in the CIGRE TB 761 style. Bushings and DGA carry the most weight because they dominate catastrophic transformer failures in CIGRE A2 surveys. The index is indicative: thresholds are visible and can be tuned by S.E. PAC.</p>`;
}

// ============================================================ views
function vOverview() {
  setCrumbs([['Overview']]);
  const fs = findings();
  const n = (s) => fs.filter(f => f.sev === s).length;
  const od = SCHED.filter(s => s.status === 'overdue'), due = SCHED.filter(s => s.status === 'due');
  const units = [...new Set(DB.records.map(r => r.unit))];
  const tfs = units.filter(isTF).sort(sortUnits), bays = units.filter(u => !isTF(u)).sort(sortUnits);
  const tests = Object.keys(TESTS);
  const cell = (u, t) => { if (!DB.records.some(r => r.unit === u && r.t === t)) return '<span class="dim">·</span>'; const s = unitStatus(u, t); return `<a href="#/eq/${u}?t=${t}" title="${SEV_LABEL[s]}">${s === 'ok' ? '<span class="dim">✓</span>' : pill(s)}</a>`; };
  const kpi = (cls, href, l, v, d) => `<a class="kpi ${cls} ${v ? 'hot' : ''}" href="${href}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></a>`;
  view().innerHTML = pageHead('Condition monitoring · 400 / 220 kV', esc(DB.site.substation.name),
    `Diagnostic health for FY ${esc(DB.site.substation.fy)}, as of <b>${fmtDate(DB.today)}</b>. Every reading is evaluated against MSETCL circular 06961 (18 Oct 2024) and cross-checked with IEC / IEEE practice.`, printBtn + `<a class="btn pri" href="#/findings">${IC.findings}Review findings</a>`)
    + `<section class="kpis" aria-label="Key figures">
      ${kpi('crit', '#/findings?sev=critical', '◆ Critical', n('critical'), 'act immediately')}
      ${kpi('alert', '#/findings?sev=alert', '▲ Alerts', n('alert'), 'circular limit breached')}
      ${kpi('watch', '#/findings?sev=watch', '● Watch-list', n('watch'), 'adverse trend / industry flag')}
      ${kpi('crit', '#/schedule?f=overdue', 'Overdue tests', od.length, `${due.length} more due ≤ 120 days`)}
      ${kpi('', '#/equipment', 'Assets monitored', units.length, `${tfs.length} transformers/reactor · ${bays.length} bays`)}
      ${kpi('', '#/data', 'Test records', DB.records.length.toLocaleString('en-IN'), `${DB.site.issues.length} data-quality notes`)}</section>
    <div class="sec-h" style="margin-top:6px"><h2>Transformer & reactor health index</h2><span class="note">0–100 · weighted DGA, oil, winding & bushing condition</span></div>
    <div class="hi-grid">${TF_UNITS.map(hiCard).join('')}</div>
    <div class="card sld-card mt-l"><div class="card-h"><span style="width:18px;color:var(--brand-2)">${IC.sld}</span><h2>400 kV switchyard</h2><span class="sub">one-and-a-half breaker scheme · breakers coloured by test health</span><div class="sp"></div><a class="btn sm" href="#/sld">Full SLD incl. 220 kV ${IC.arrow}</a></div>
      <div class="card-b"><div class="sld-wrap">${sld400()}</div>${SLD_LEGEND}</div></div>
    <div class="grid g-7-5 mt">
      <div class="card"><div class="card-h"><h2>Needs attention</h2><span class="sub">critical & alert</span><div class="sp"></div><a class="btn sm ghost" href="#/findings">All findings ${IC.arrow}</a></div>${findingList(fs.filter(f => SEV[f.sev] >= 3), 6)}</div>
      <div class="card"><div class="card-h"><h2>Test schedule</h2><span class="sub">overdue & next 120 days</span><div class="sp"></div><a class="btn sm ghost" href="#/schedule">Full schedule ${IC.arrow}</a></div>${schedTable([...od, ...due].slice(0, 12), true)}</div>
    </div>
    <div class="card mt"><div class="card-h"><h2>Health matrix</h2><span class="sub">worst open finding per asset & test · ✓ = normal (ISA-101: colour only for abnormal)</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Asset</th>${tests.map(t => `<th><a href="#/test/${t}">${esc(TESTS[t].short)}</a></th>`).join('')}</tr></thead><tbody>
      <tr class="grp"><td colspan="${tests.length + 1}">Transformers & reactor</td></tr>
      ${tfs.map(u => row(u)).join('')}<tr class="grp"><td colspan="${tests.length + 1}">400 kV bays</td></tr>${bays.filter(b => kvOf(b) === 400).map(row).join('')}
      <tr class="grp"><td colspan="${tests.length + 1}">220 kV bays</td></tr>${bays.filter(b => kvOf(b) === 220).map(row).join('')}
      </tbody></table></div></div>`;
  function row(u) { return `<tr><td><a href="#/eq/${u}"><b>${esc(unitName(u))}</b></a> <span class="dim">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</span></td>${tests.map(t => `<td>${cell(u, t)}</td>`).join('')}</tr>`; }
}

function schedTable(list, compact) {
  if (!list.length) return `<div class="empty">${pill('ok', 'Nothing overdue or due in the next 120 days')}</div>`;
  return `<div class="tbl-wrap"><table class="t nw"><thead><tr><th>Test</th><th>Asset</th>${compact ? '' : '<th>Ph / sample</th><th>Circular</th>'}${compact ? '' : '<th class="r">Last done</th>'}<th class="r">Due</th><th>Status</th></tr></thead><tbody>
  ${list.map(s => `<tr><td><a href="#/test/${s.t}">${esc(TESTS[s.t].short)}</a></td><td><a href="#/eq/${s.unit}">${esc(unitName(s.unit))}</a>${compact && (s.ph || s.pos) ? ` <span class="dim">${esc([s.ph && s.ph !== '-' ? s.ph : '', s.pos].filter(Boolean).join(' '))}</span>` : ''}</td>
  ${compact ? '' : `<td>${phase(s.ph)} ${esc(s.pos)}</td><td><button class="btn sm btn-doc" data-circ="${s.sr}">Sr ${s.sr} · every ${s.months} mo</button></td>`}
  ${compact ? '' : `<td class="r">${fmtDate(s.last)}</td>`}<td class="r" title="Last done ${fmtDate(s.last)}">${fmtDate(s.due)}</td>
  <td>${s.status === 'overdue' ? pill('critical', `Overdue ${-s.days} d`) : s.status === 'due' ? pill('watch', `In ${s.days} d`) : pill('ok', 'Scheduled')}</td></tr>`).join('')}</tbody></table></div>`;
}

function vSchedule(q) {
  setCrumbs([['Overview', '#/'], ['Test schedule']]);
  const f = q.get('f') || 'open';
  const list = SCHED.filter(s => f === 'all' || (f === 'open' ? s.status !== 'ok' : s.status === f));
  view().innerHTML = pageHead('Planning', 'Test schedule', 'Next due = last test + circular frequency (bushing yearly · winding 2-yearly · DGA ½-yearly · LA ½-yearly · CT 2-yearly at 400 kV, yearly at 220 kV · CB 2-yearly). "Due" = within 120 days, the same window as the sheet\'s Pending Tests tab.', printBtn)
    + `<div class="toolbar"><div class="chips">${[['open', 'Overdue + due'], ['overdue', 'Overdue'], ['due', 'Due ≤ 120 d'], ['all', 'All']].map(([k, l]) => `<a class="chip ${f === k ? 'on' : ''}" href="#/schedule?f=${k}">${l} <span class="num">${SCHED.filter(s => k === 'all' || (k === 'open' ? s.status !== 'ok' : s.status === k)).length}</span></a>`).join('')}</div></div>
    <div class="card">${schedTable(list, false)}</div>
    <p class="note mt">220 kV CTs are taken as "Major/Important S/s" (Sr 19, yearly), matching the sheet's due dates. Per Note 2 of the circular, the zonal CE confirms this classification.</p>`;
}

function vSld() {
  setCrumbs([['Single-line diagram']]);
  view().innerHTML = pageHead('Switchyard', 'Single-line diagram', 'Breaker boxes are coloured by CB test health (contact resistance + timing). The dot on each feeder shows CT / LA health, and transformer symbols show the unit\'s worst finding. Click anything to open it.', printBtn)
    + `<div class="card sld-card mb"><div class="card-h"><h2>400 kV · one-and-a-half breaker scheme</h2><span class="sub">5 diameters · 2 bays share 3 breakers between Bus-I and Bus-II</span></div><div class="card-b"><div class="sld-wrap">${sld400()}</div>${SLD_LEGEND}</div></div>
    <div class="card sld-card"><div class="card-h"><h2>220 kV · double main + transfer bus</h2><span class="sub">bus coupler 207 · transfer bus coupler 208</span></div><div class="card-b"><div class="sld-wrap">${sld220()}</div>${SLD_LEGEND}</div></div>
    <p class="note mt">Schematic built from the bay register in the sheet. Isolators, earth switches and CVTs are omitted for clarity. ICT 1 links bay 403 (400 kV) to bay 204 (220 kV), and ICT 2 links bay 406 to bay 203.</p>`;
}

function vEquipment() {
  setCrumbs([['Equipment']]);
  const allBays = Object.keys(DB.site.bays).sort(sortUnits);
  const tile = (u) => {
    const ts = testsForUnit(u), st = ts.length ? unitStatus(u) : 'none', last = DB.records.filter(r => r.unit === u).map(r => r.date).sort().pop();
    const h = isTF(u) ? healthIndex(u) : null;
    return `<a class="tile sev-${st} ${ts.length ? '' : 'off'}" href="#/eq/${u}"><div class="row"><span class="n">${esc(unitName(u))}</span><span style="flex:1"></span>${h ? `<span class="tag" title="Health index">HI ${h.hi}</span>` : ''}${pill(st)}</div>
      <div class="m">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</div>
      <div class="row">${ts.map(t => `<span class="tag">${esc(TESTS[t].short)}</span>`).join('') || '<span class="note">no tests recorded</span>'}</div>
      ${last ? `<div class="m">Last test ${fmtDate(last)}</div>` : ''}</a>`;
  };
  view().innerHTML = pageHead('Asset register', 'Equipment', 'Transformers and the reactor are listed by unit; switchyard equipment (CT, CB, LA) by bay. The left edge carries the worst open finding. Future bays are dimmed.', `<a class="btn" href="#/sld">${IC.sld}View on SLD</a>`)
    + `<div class="sec-h" style="margin-top:0"><h2>Transformers & reactor</h2></div><div class="tiles">${TF_UNITS.map(tile).join('')}</div>
    <div class="sec-h"><h2>400 kV bays</h2><span class="note">one-and-a-half breaker</span></div><div class="tiles">${allBays.filter(b => kvOf(b) === 400).map(tile).join('')}</div>
    <div class="sec-h"><h2>220 kV bays</h2><span class="note">double main + transfer</span></div><div class="tiles">${allBays.filter(b => kvOf(b) === 220).map(tile).join('')}</div>`;
}

function bayPosition(u) {
  const i = DIAS.findIndex(d => d.includes(u));
  if (i < 0) return kvOf(u) === 220 ? (u === '207' ? 'Bus coupler (Main I ↔ Main II)' : u === '208' ? 'Transfer bus coupler' : 'Double main + transfer bus') : 'Spare unit bay';
  const k = DIAS[i].indexOf(u);
  return `Diameter ${i + 1} · ${['main breaker to Bus-I', 'tie breaker', 'main breaker to Bus-II'][k]}`;
}

function vUnit(u, q) {
  const ts = testsForUnit(u); const sel = q.get('t') && ts.includes(q.get('t')) ? q.get('t') : ts[0];
  setCrumbs([['Equipment', '#/equipment'], [unitName(u)]]);
  const info = isTF(u) ? DB.site.units[u] : null;
  const fs = findings().filter(f => f.unit === u || (f.unit === '*' && f.recIds.some(id => DB.records[id].unit === u)));
  const sch = SCHED.filter(s => s.unit === u);
  const st = ts.length ? unitStatus(u) : 'none';
  const plate = info
    ? [['Rating', info.rating], ['Make', info.make || '—'], ['Commissioned', info.commissioned ? fmtDate(info.commissioned) : '—'], ['HV bay', info.bay ? `Bay ${info.bay}` : '—'], ...(info.serials ? [['Serial nos.', Object.entries(info.serials).map(([p, s]) => `${p}: ${s}`).join(' · ')]] : [])]
    : [['Voltage', `${kvOf(u)} kV`], ['Feeder', bayTitle(u) || '—'], ['Scheme position', bayPosition(u)], ['Tests on record', String(ts.length)]];
  view().innerHTML = `<section class="asset"><div><div class="eyebrow">${info ? 'Power transformer / reactor' : `${kvOf(u)} kV bay`}</div><div class="row-flex"><h1>${esc(unitName(u, !info))}</h1>${pill(st)}</div>
      <div class="plate">${plate.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div>
      <div class="actions" style="display:flex;gap:8px;align-items:flex-start">${printBtn}</div></section>
    ${info && healthIndex(u) ? `<div class="grid g-7-5 mb"><div class="card"><div class="card-h"><h2>Health index</h2><span class="sub">what drives the score</span></div><div class="card-b">${hiPanel(u)}</div></div>
      <div class="card"><div class="card-h"><h2>Schedule</h2></div>${schedTable(sch, true)}</div></div>` : ''}
    ${ts.length ? `<div class="grid ${info ? '' : 'g-7-5'} mb"><div class="card"><div class="card-h"><h2>Findings</h2><span class="sub">${fs.length}</span></div>${findingList(fs)}</div>${info ? '' : `<div class="card"><div class="card-h"><h2>Schedule</h2></div>${schedTable(sch, true)}</div>`}</div>
    <nav class="tabs" aria-label="Tests">${ts.map(t => { const s = unitStatus(u, t); return `<a class="${t === sel ? 'on' : ''}" href="#/eq/${u}?t=${t}"><span style="width:16px;height:16px;display:grid">${IC[t]}</span>${esc(TESTS[t].name)} ${SEV[s] >= 2 ? `<span class="dot ${s}"></span>` : ''}</a>`; }).join('')}</nav>
    <div class="toolbar"><span class="note">Governing clause</span>${circularBtn(sel === 'ct' && kvOf(u) === 220 ? 19 : TESTS[sel].sr, 'Circular scan')}<div class="sp"></div><a class="btn sm ghost" href="#/test/${sel}">Compare all ${esc(TESTS[sel].short)} ${IC.arrow}</a></div>
    <div id="tb"></div>` : '<div class="card empty">No test records for this bay in the sheet yet. It is probably a future bay.</div>'}`;
  if (!ts.length) return;
  const body = renderTestBody(sel, recs(sel, { unit: u }), true);
  $('#tb').innerHTML = body.html; body.after($('#tb'));
}

function vTest(t, q) {
  const T = TESTS[t]; if (!T) return vNotFound();
  setCrumbs([['Tests', '#/tests'], [T.name]]);
  const units = unitsFor(t);
  const f = q.get('u') || (t === 'dga' ? 'ICT1' : 'all');
  const rs = recs(t).filter(r => f === 'all' || r.unit === f || (f === '400' && kvOf(r.unit) === 400) || (f === '220' && kvOf(r.unit) === 220));
  const kvChips = !['bushing', 'winding', 'dga'].includes(t) && units.some(u => kvOf(u) === 220) && units.some(u => kvOf(u) === 400);
  const fs = findings().filter(x => x.t === t);
  const chip = (k, l) => { const s = ['all', '400', '220'].includes(k) ? null : unitStatus(k, t); return `<a class="chip ${f === k ? 'on' : ''}" href="#/test/${t}${k === 'all' ? '' : '?u=' + k}">${s && SEV[s] >= 2 ? `<span class="dot ${s}"></span>` : ''}${esc(l)}</a>`; };
  view().innerHTML = pageHead(`${esc(T.eq)} · circular Sr ${T.sr}`, `<span style="display:inline-flex;gap:10px;align-items:center"><span style="width:26px;height:26px;color:var(--brand-2);display:grid">${IC[t]}</span>${esc(T.name)}</span>`, `${units.length} ${units.length === 1 ? 'asset' : 'assets'} · ${recs(t).length} records · ${fs.length} findings`, printBtn)
    + `<div class="grid g2 mb">${clauseCard(t === 'ct' ? 18 : T.sr, t)}${standardsCard(t)}</div>
    ${fs.length ? `<div class="card mb"><div class="card-h"><h2>Findings</h2><span class="sub">${fs.length}</span><div class="sp"></div><a class="btn sm ghost" href="#/findings?t=${t}">All ${IC.arrow}</a></div>${findingList(fs, 5)}</div>` : ''}
    <div class="toolbar"><div class="chips">${t === 'dga' ? '' : chip('all', 'All')}${kvChips ? chip('400', '400 kV') + chip('220', '220 kV') : ''}${units.map(u => chip(u, unitName(u))).join('')}</div></div>
    <div id="tb"></div>`;
  const body = renderTestBody(t, rs, false);
  $('#tb').innerHTML = body.html; body.after($('#tb'));
}

function vTests() {
  setCrumbs([['Tests']]);
  view().innerHTML = pageHead('Diagnostics', 'Tests', 'Test-wise view across all assets, each with its governing circular clause and the industry comparison.')
    + `<div class="tiles">${Object.values(TESTS).map(T => { const fs = findings().filter(f => f.t === T.key); const w = fs.length ? worst(fs.map(f => f.sev)) : 'ok'; return `<a class="tile sev-${w}" href="#/test/${T.key}"><div class="row"><span style="width:22px;height:22px;color:var(--brand-2);display:grid">${IC[T.key]}</span><span class="n">${esc(T.name)}</span><span style="flex:1"></span>${pill(w)}</div><div class="m">${esc(T.eq)} · circular Sr ${T.sr}</div><div class="m">${recs(T.key).length} records · ${unitsFor(T.key).length} assets · ${fs.length} findings</div></a>`; }).join('')}</div>`;
}

function vFindings(q) {
  setCrumbs([['Findings']]);
  const sev = q.get('sev') || 'all', tt = q.get('t') || 'all';
  const fs = findings().filter(f => (sev === 'all' || f.sev === sev) && (tt === 'all' || f.t === tt));
  const link = (k, v) => { const p = new URLSearchParams(q); p.set(k, v); return '#/findings?' + p; };
  view().innerHTML = pageHead('Engineering review', 'Findings', '<b>◆ Critical / ▲ Alert</b>: a circular limit is breached. <b>● Watch</b>: an industry benchmark or adverse trend, still inside the circular. <b>i Info</b>: a measurement or data-quality check. Every finding names its basis and a recommended action.', printBtn)
    + `<div class="toolbar"><div class="chips">${['all', 'critical', 'alert', 'watch', 'info'].map(s => `<a class="chip ${sev === s ? 'on' : ''}" href="${link('sev', s)}">${s === 'all' ? 'All' : SEV_LABEL[s]} <span class="num">${findings().filter(f => (s === 'all' || f.sev === s) && (tt === 'all' || f.t === tt)).length}</span></a>`).join('')}</div><div class="sp"></div>
    <select class="sel" aria-label="Filter by test" onchange="location.hash='${link('t', '__')}'.replace('__',this.value)"><option value="all">All tests</option>${Object.values(TESTS).map(T => `<option value="${T.key}" ${tt === T.key ? 'selected' : ''}>${esc(T.name)}</option>`).join('')}</select></div>
    <div class="card">${findingList(fs)}</div>`;
}

function vNorms(q) {
  setCrumbs([['MSETCL norms 2024']]);
  const eq = q.get('eq') || 'all', tab = q.get('tab') || 'rows', s = (q.get('q') || '').toLowerCase();
  const eqs = [...new Map(DB.norms.rows.map(r => [r.eq, r.equipment]))];
  const rows = DB.norms.rows.filter(r => (eq === 'all' || r.eq === eq) && (!s || JSON.stringify(r).toLowerCase().includes(s)));
  const m = DB.norms.meta;
  const link = (k, v) => { const p = new URLSearchParams(q); p.set(k, v); return '#/norms?' + p; };
  view().innerHTML = pageHead('Reference · governing document', 'MSETCL test-frequency norms',
    `Circular <b>${esc(m.circularNo)}</b> dated ${fmtDate(m.date)}: ${esc(m.title)}. Supersedes ${esc(m.ref)}. Each row is transcribed from the signed scan and links back to it.`,
    `<button class="btn" data-cover>${IC.doc}Covering letter</button>${printBtn}`)
    + `<nav class="tabs">${[['rows', 'All 51 activities'], ['notes', 'Notes'], ['errata', `Corrections to old JSON · ${DB.norms.errata.length}`]].map(([k, l]) => `<a class="${tab === k ? 'on' : ''}" href="${link('tab', k)}">${l}</a>`).join('')}</nav><div id="nb"></div>`;
  const nb = $('#nb');
  $('[data-cover]').onclick = () => modal('Circular · covering letter', '<div class="scan-wrap"><img src="assets/circular/page-1.jpg" alt="Circular page 1"></div>');
  if (tab === 'notes') {
    nb.innerHTML = `<div class="card"><div class="card-b"><ol>${DB.norms.notes.map(n => `<li style="margin:6px 0">${esc(n)}</li>`).join('')}</ol><div class="scan-wrap mt"><canvas id="notesCv"></canvas></div></div></div>`;
    const n = m.notesScan; drawSnippet($('#notesCv'), { scan: { page: n.page, hy0: 106, hy1: 135, gy0: n.y0, gy1: n.y1, y0: n.y0, y1: n.y1 } });
    return;
  }
  if (tab === 'errata') {
    nb.innerHTML = `<div class="callout warn mb">The <code>msetcl_test_frequency_2024.json</code> handed over earlier has <b>${DB.norms.errata.length} mismatches</b> against the signed circular. This portal uses the corrected transcription; click "Verify" to see the scan.</div>
      <div class="card"><table class="t"><thead><tr><th class="r">Sr</th><th>Activity</th><th>Correction</th><th></th></tr></thead><tbody>${DB.norms.errata.map(e => `<tr><td class="r">${e.sr}</td><td>${esc(DB.normsBySr[e.sr].activity)}</td><td>${esc(e.issue)}</td><td>${circularBtn(e.sr, 'Verify')}</td></tr>`).join('')}</tbody></table></div>`;
    return;
  }
  nb.innerHTML = `<div class="toolbar"><div class="chips"><a class="chip ${eq === 'all' ? 'on' : ''}" href="${link('eq', 'all')}">All</a>${eqs.map(([k, n]) => `<a class="chip ${eq === k ? 'on' : ''}" href="${link('eq', k)}">${esc(n)}</a>`).join('')}</div><div class="sp"></div>
    <input class="search" type="search" placeholder="Search activity, limit, team…" value="${esc(q.get('q') || '')}" onchange="location.hash='${link('q', '__')}'.replace('__',encodeURIComponent(this.value))"></div>
    <div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th class="r">Sr</th><th>Activity</th><th>Frequency</th><th>Done by</th><th style="min-width:340px">Limiting values & actions</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr style="vertical-align:top"><td class="r"><b>${r.sr}</b></td><td><b>${esc(r.activity)}</b><div class="dim" style="font-size:12px">${esc(r.equipment)}</div>${r.test ? `<a class="tag b" href="#/test/${r.test}" style="margin-top:4px">data in portal →</a>` : ''}</td>
      <td>${r.changed ? `<s class="dim">${esc(r.existing)}</s><br><b>${esc(r.revised)}</b> <span class="tag chg">revised</span>` : esc(r.existing)}${r.remarkAdded ? ' <span class="tag chg">remark added</span>' : ''}</td>
      <td>${esc(r.by)}</td><td>${r.limits.length ? `<ol style="margin:0;padding-left:18px">${r.limits.map(l => `<li>${esc(l)}</li>`).join('')}</ol>` : '<span class="dim">— decide with S.E., PAC (Note 1)</span>'}</td>
      <td>${circularBtn(r.sr, 'Scan')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No match</td></tr>'}</tbody></table></div></div>`;
}

function vStandards() {
  setCrumbs([['Industry standards']]);
  const tmap = { bushing: 1, winding: 3, ct: 18, cb_crm: 24, cb_timing: 26, la: 17, dga: 8, oil: 10 };
  view().innerHTML = pageHead('Reference · benchmarking', 'Circular vs industry standards', esc(DB.standards.disclaimer), printBtn)
    + `<div class="callout warn mb"><b>Five gaps between the circular and current practice.</b><ol style="margin:6px 0 0;padding-left:20px"><li>Fixed absolute limits, where the industry trends each asset against its own baseline and its sister phases.</li><li>A generic temperature correction applied to bushings.</li><li>DGA still on the IEEE C57.104-<b>2008</b> table, with no rate-of-change rule and no OLTC-specific method.</li><li>No pole-discrepancy limit for breakers.</li><li>A 400 kV CRM limit that every healthy breaker here fails (per-break vs per-pole).</li></ol></div>
    <div class="grid g2">${Object.entries(DB.standards.tests).map(([k, b]) => `<div class="card"><div class="card-h"><span style="width:18px;color:var(--brand-2)">${IC[k] || IC.standards}</span><h3>${esc(b.title)}</h3><div class="sp"></div>${tmap[k] ? circularBtn(tmap[k], 'Circular') : ''}</div><div class="card-b">${b.items.map(stdRow).join('')}</div></div>`).join('')}</div>`;
}

function vData() {
  setCrumbs([['Data & sources']]);
  const s = DB.site.substation, cf = DB.site.tempCorrection;
  const counts = Object.keys(TESTS).map(t => [t, recs(t).length]);
  view().innerHTML = pageHead('Data governance', 'Data & sources', `Source <code>${esc(s.source)}</code>, extracted ${fmtDate(s.extracted)} by <code>tools/extract_workbook.py</code>. To refresh, export the Google Sheet as .xlsx and re-run the script. Nothing is typed by hand.`)
    + `<div class="grid g2 mb"><div class="card"><div class="card-h"><h2>Records by test</h2></div><table class="t"><tbody>${counts.map(([t, n]) => `<tr><td><a href="#/test/${t}">${esc(TESTS[t].name)}</a></td><td class="r">${n}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><div class="card-h"><h2>Temperature correction in the sheet</h2></div><div class="card-b"><p class="note" style="margin-top:0">Hidden "Correction Factor" tab: tan δ₂₀ = tan δ ÷ K, with K = ${cf.find(x => x[0] === 40)?.[1] ?? '—'} at 40 °C and ${cf.find(x => x[0] === 50)?.[1] ?? '—'} at 50 °C.</p>
      <div class="callout warn">One table is used for everything. IEEE C57.152 accepts a generic table for <i>winding</i> insulation only, and even there prefers individual-temperature-response (DFR-based) correction. For bushings, use the maker's curve: for an OIP bushing at 42 °C the generic K removes about 38 % of the reading. The portal therefore judges bushings and CTs on the measured value.</div></div></div></div>
    <div class="card"><div class="card-h"><h2>Data-quality log</h2><span class="sub">${DB.site.issues.length} items · text in numeric cells and rejected rows</span></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Sheet ! row</th><th>Field</th><th>Finding</th></tr></thead><tbody>${DB.site.issues.map(i => `<tr><td class="mono">${esc(i.src)}</td><td>${esc(i.field)}</td><td>${i.rejected ? pill('info', 'rejected') + ' ' : ''}${esc(i.text)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card mt"><div class="card-b"><h3>Also noticed in the workbook</h3><ul class="note">
      <li>"PT Tan D Results" and the bushing columns in "Pending Tests" show <code>#REF!</code>: their source ranges were deleted.</li>
      <li>"220 kV LA LCM Results" is empty. The 220 kV LA readings sit in an unnamed sheet "w" (only bay 204 has data).</li>
      <li>Future bays 412 / 415 contain drag-filled CT rows (negative tan δ, 180–228 °C, 1960s dates). These are rejected above.</li>
      <li>Placeholder remarks ("hello", stray numbers like "130") are left in the CRM remark columns.</li>
      <li>Corrected tan δ is stored as a fraction (0.0021 = 0.21 %) beside measured values in %. The portal normalises everything to %.</li></ul></div></div>`;
}

function vAbout() {
  setCrumbs([['Roadmap']]);
  view().innerHTML = pageHead('Product', 'About & roadmap', '')
    + `<div class="grid g2"><div class="card pad"><h2>What this is</h2><p>A static web portal (no server, works offline on an intranet) over the Karjat diagnostic sheet. It brings together the corrected MSETCL 2024 circular with scanned extracts, an industry-standards comparison, a rule engine that turns readings into findings, a transformer health index and a live single-line diagram.</p>
    <h3 class="mt">Design principles</h3><ul class="note"><li><b>ISA-101 high-performance HMI</b>: normal is grey, colour is reserved for abnormal conditions.</li><li><b>Redundant coding</b>: each status has its own shape (◆ ▲ ● ✓), so it reads without colour and in print.</li><li><b>Traceability</b>: every finding names its basis, and every rule links to the scanned clause.</li><li>Tabular numerals, SI units with spaces, IS phase colours (R / Y / B).</li><li>Keyboard first: <span class="kbd">Ctrl K</span> or <span class="kbd">/</span> jumps to any bay, test or Sr. No.</li></ul>
    <h3 class="mt">Layout</h3><pre class="mono note" style="white-space:pre-wrap">data/karjat.json     ← tools/extract_workbook.py (xlsx)
data/norms.json      ← circular, transcribed + scan coordinates
data/standards.json  ← IEC / IEEE / CIGRE references
js/data.js           ← data layer (swap JSON → database here)
js/rules.js          ← engineering rules (each cites its basis)
js/health.js         ← transformer health index
js/sld.js            ← single-line diagrams
js/app.js, js/ui.js  ← views, charts, Duval, palette, circular viewer</pre></div>
    <div class="card pad"><h2>Next steps</h2><ol>
    <li><b>Database</b> (Supabase/Postgres): tables <code>substation, equipment, test_record, attachment</code>. <code>js/data.js</code> already isolates loading.</li>
    <li><b>Data-entry forms</b> per test with live limit checks, and the test-kit PDF report attached to each record.</li>
    <li><b>Remaining circular tests</b>: IR/PI, SFRA, DFR, winding resistance, PT, CVT, DCRM, SF₆ dew point, relays, battery, thermovision, earth resistance.</li>
    <li><b>Multi-substation</b>: one data set per S/s, then circle / zone roll-ups and fleet health-index ranking.</li>
    <li><b>Rule settings</b> editable by S.E. PAC (Note 1 of the circular), with versioning.</li>
    <li>DGA: IEEE C57.104-2019 Level 1/2/3 with rate-of-change, Duval Triangle 2 for OLTC, Duval Pentagon.</li></ol></div></div>`;
}

function vNotFound() { setCrumbs([['Not found']]); view().innerHTML = '<div class="empty">Page not found. <a href="#/">Go to overview</a></div>'; }

// ============================================================ router & shell
function route() {
  destroyCharts();
  $$('.modal-bg').forEach(m => m.remove());
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?'); const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  $$('.nav a').forEach(a => { const href = a.getAttribute('href'); a.classList.toggle('on', href === '#/' + (p[0] || '') || (p[0] === 'test' && href === '#/test/' + p[1]) || (p[0] === 'eq' && href === '#/equipment')); });
  $('#sb').classList.remove('open');
  const V = { '': vOverview, equipment: vEquipment, sld: vSld, tests: vTests, findings: vFindings, schedule: vSchedule, norms: vNorms, standards: vStandards, data: vData, about: vAbout };
  if (p[0] === 'eq') vUnit(decodeURIComponent(p[1]), q);
  else if (p[0] === 'test') vTest(p[1], q);
  else (V[p[0] || ''] || vNotFound)(q);
  window.scrollTo(0, 0);
}

function shell() {
  $('#logo').innerHTML = LOGO;
  $$('.nav a[data-ic] .ic').forEach(el => el.innerHTML = IC[el.parentElement.dataset.ic] || '');
  $('#menuBtn').innerHTML = IC.menu; $('#printBtn').innerHTML = IC.print; $('#themeBtn').innerHTML = IC.theme; $('#searchIc').innerHTML = IC.search;
  $('#menuBtn').onclick = () => $('#sb').classList.toggle('open');
  $('#printBtn').onclick = () => window.print();
  $('#searchBtn').onclick = openPalette;
  const k = 'ehv-theme'; let t = null; try { t = localStorage.getItem(k); } catch { }
  if (t) document.documentElement.dataset.theme = t;
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx;
    try { localStorage.setItem(k, nx); } catch { }
    route();
  };
}

function afterLoad() {
  const fs = findings();
  $('#nc-find').textContent = fs.filter(f => SEV[f.sev] >= 3).length || '';
  $('#nc-sched').textContent = SCHED.filter(s => s.status === 'overdue').length || '';
  $('#nav-tests').innerHTML = Object.values(TESTS).map(T => { const w = worst(fs.filter(f => f.t === T.key).map(f => f.sev)); return `<a href="#/test/${T.key}"><span class="ic">${IC[T.key]}</span>${esc(T.short)}${SEV[w] >= 3 ? `<span class="ct" title="${SEV_LABEL[w]}" style="background:var(--${w === 'critical' ? 'crit' : 'alert'});color:#fff">!</span>` : ''}</a>`; }).join('');
  $('#site-name').textContent = DB.site.substation.name;
  $('#site-fy').textContent = `FY ${DB.site.substation.fy} · ${DB.records.length.toLocaleString('en-IN')} records`;
  // command palette index
  const items = [
    ...[['#/', 'Overview', 'overview'], ['#/findings', 'Findings', 'findings'], ['#/schedule', 'Test schedule', 'schedule'], ['#/sld', 'Single-line diagram', 'sld'], ['#/equipment', 'Equipment', 'equipment'], ['#/norms', 'MSETCL norms 2024', 'norms'], ['#/norms?tab=errata', 'Corrections to old JSON', 'norms'], ['#/standards', 'Industry standards', 'standards'], ['#/data', 'Data & sources', 'data'], ['#/about', 'Roadmap', 'roadmap']].map(([href, label, ic]) => ({ href, label, kind: 'page', icon: IC[ic] })),
    ...TF_UNITS.map(u => ({ href: '#/eq/' + u, label: unitName(u), sub: DB.site.units[u].rating, kind: 'asset', icon: IC.equipment })),
    ...Object.keys(DB.site.bays).map(u => ({ href: '#/eq/' + u, label: `Bay ${u}`, sub: bayTitle(u), kind: `${kvOf(u)} kV bay`, icon: IC.sld })),
    ...Object.values(TESTS).map(T => ({ href: '#/test/' + T.key, label: T.name, sub: T.eq, kind: 'test', icon: IC[T.key] })),
    ...DB.norms.rows.map(r => ({ href: `#/norms?q=${encodeURIComponent(r.activity)}`, label: `Sr ${r.sr} · ${r.activity}`, sub: r.equipment, kind: 'circular', icon: IC.norms })),
  ];
  items.forEach(i => i.hay = `${i.label} ${i.sub || ''} ${i.kind}`.toLowerCase());
  setPaletteItems(items);
}

(async function main() {
  shell();
  try {
    await loadAll();
    run(); SCHED = schedule();
    bindRise((u) => findings().some(f => f.t === 'bushing' && f.unit === u && /rising/i.test(f.title)));
    afterLoad();
    window.addEventListener('hashchange', route);
    route();
  } catch (e) {
    view().innerHTML = `<div class="callout warn"><b>Could not load data.</b> ${esc(e.message)}<br>Open the portal through a web server (GitHub Pages, or <code>python3 -m http.server</code> in this folder), not directly as a file.</div>`;
    console.error(e);
  }
})();
