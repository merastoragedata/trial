import { DB, TESTS, loadAll, recs, groupBy, unitName, bayTitle, kvOf, isTF, fmt, fmtDate, unitsFor, sortUnits, testsForUnit, done, years } from './data.js?v=20261126.1426';
import { run, findings, statusOf, unitStatus, schedule, SEV, SEV_LABEL, LIM, duval1, DUVAL_NAMES, worst } from './rules.js?v=20261126.1426';
import { esc, chem, pill, sevIcon, phase, $, $$, lineChart, barChart, destroyCharts, PHASE_COLOR, circularBtn, modal, drawSnippet, bandsFrom, duvalSVG, setPaletteItems, openPalette } from './ui.js?v=20261126.1426';
import { IC, LOGO } from './icons.js?v=20261126.1426';
import { healthIndex, gaugeSVG, HI_WEIGHTS, HI_BANDS, bindRise, assetHealth } from './health.js?v=20261126.1426';
import { sld400, sld220, SLD_LEGEND } from './sld.js?v=20261126.1426';
import { art, skyline } from './art.js?v=20261126.1426';
import { shareButtons, wireShare } from './report.js?v=20261126.1426';
import { testHeader } from './testviz.js?v=20261126.1426';
import { loadNameplates, nameplateSection, wireNameplates, detailsCard, wireDetails } from './nameplate.js?v=20261126.1426';
import { puCards, puPage } from './pu.js?v=20261126.1426';
import { pendingPage, resultsPage } from './pages.js?v=20261126.1426';
import { renderSections, bindResults, openElement, openNorms, NOUN, renderElementPage, targetsPage, elemLabel, phaseUnitName, fullName, applyView, dueTxt } from './results.js?v=20261126.1426';
import { isAdmin, toggleAdmin, exportEdits, importEdits, resetEdits, editCount, viewPref, setViewPref } from './edit.js?v=20261126.1426';
import { refresh } from './data.js?v=20261126.1426';

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
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Bay no.', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['kV', r => kvOf(r.unit), 'r'], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
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
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Bay no.', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['Trip TC1', r => fmt(r.v.open1, 1), 'r', r => r.v.open1 > LIM.trip[kvOf(r.unit)]], ['Trip TC2', r => fmt(r.v.open2, 1), 'r', r => r.v.open2 > LIM.trip[kvOf(r.unit)]], ['Close', r => fmt(r.v.close, 1), 'r', r => r.v.close > 150], ['C-O TC1', r => fmt(r.v.co1, 1), 'r'], ['C-O TC2', r => fmt(r.v.co2, 1), 'r']],
    note: '<b>Why both trip coils matter.</b> TC1 and TC2 are redundant trip circuits, so a slow TC2 is as serious as a slow TC1. Trip time adds directly to fault-clearing time and erodes the CEA 100 ms clearance margin for 400 kV.',
  },
  la: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'Icorr', label: 'Icorr — 3rd-harmonic resistive (µA)', unit: 'µA', limits: [{ y: 150, label: '150 µA (stack IR)', sev: 'alert' }, { y: 350, label: '350 µA (replace)', sev: 'critical' }] },
      { k: 'Ith', label: 'Ith — uncompensated 3rd harmonic, for reference (µA)', unit: 'µA' },
      { k: 'Itotal', label: 'Itotal — total leakage, mostly capacitive (µA)', unit: 'µA' },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Bay no.', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)], ['Season', r => esc(r.season || '')],
      ['Ith µA', r => fmt(r.v.Ith, 0), 'r'], ['Icorr µA', r => fmt(r.v.Icorr, 0), 'r', r => r.v.Icorr > 150], ['Itotal µA', r => fmt(r.v.Itotal, 0), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]],
    note: '<b>Method.</b> ZnO block degradation shows up in the <i>resistive</i> component; total leakage is about 90 % capacitive and is a trend only. The circular\'s limits (150 / 350 µA) are applied to <b>Icorr</b>, the harmonic-compensated 3rd-harmonic resistive current. Ith and Itotal are stored and plotted for reference. Large pre/post-monsoon swings usually point to surface leakage, not block ageing.',
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
  const valid = rs.filter(done);
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
  lineChart(card.querySelector('canvas'), { series, limits: lim.map(l => ({ ...l, color: sevColor[l.sev] })), bands: bandsFrom(lim), yLabel: m.unit, unit: m.unit, fill: series.length === 1 });
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
  const cols = [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Bay no.', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)], ['CRM µΩ', r => fmt(r.v.R, 1), 'r', r => r.v.R > LIM.crm[kvOf(r.unit)]], ['Current A', r => fmt(r.v.I, 1), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]];
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
  const h = assetHealth(u); if (!h) return '';
  return `<a class="hi" href="#/eq/${u}">${gaugeSVG(h.hi)}<div><div class="n">${esc(unitName(u))}</div><div class="m">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</div>
    <div class="band band-${h.band[1]}">${esc(h.band[2])}</div><div class="m">Governed by ${esc(h.factors[h.governing].label.toLowerCase())}</div></div></a>`;
}

function hiPanel(u) {
  const h = assetHealth(u); if (!h) return '';
  const names = isTF(u) ? { dga: 'Dissolved gases', oil: 'Oil quality', winding: 'Winding insulation', bushing: 'Bushings' } : { cb_crm: 'Breaker contacts', cb_timing: 'Breaker mechanism', ct: 'CT insulation', la: 'Surge arresters' };
  const bar = (k) => { const f = h.factors[k]; if (!f) return `<div class="hi-bar"><span class="dim">${names[k]} <span class="dim">· no data</span></span><div class="track"></div><span class="val dim">n/a</span></div>`;
    const bb = HI_BANDS.find(b => f.score >= b[0]); return `<div class="hi-bar" title="${esc(chem(f.why))}"><span>${esc(f.label)} <span class="dim">· ${h.weights[k]}%</span></span><div class="track"><div class="fill bg-${bb[1]}" style="width:${Math.max(2, f.score)}%"></div></div><span class="val">${Math.round(f.score)}</span></div><div class="note hi-why">${esc(chem(f.why))}</div>`; };
  return `<div class="hi-panel">
    <div style="text-align:center">${gaugeSVG(h.hi, 120)}<div class="band band-${h.band[1]}" style="font-weight:650">${esc(h.band[2])}</div></div>
    <div class="hi-bars">${Object.keys(names).map(bar).join('')}</div></div>
    <p class="note mt" style="margin-bottom:0"><b>${isTF(u) ? 'Health Index' : 'Bay Health'} ${h.hi}/100</b> · ${esc(h.band[3])}. Weighted-factor index (CIGRE TB 761 style): each factor is scored from its latest reading, and the worst factor caps the total so a single bad component cannot be averaged away.${isTF(u) ? '' : ' Breaker contact resistance is scored against the healthy-fleet median of the same voltage class.'}</p>`;
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
  const bh = bays.map(u => [u, assetHealth(u)]).filter(x => x[1]).sort((a, b) => a[1].hi - b[1].hi);
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const tfh = tfs.map(u => assetHealth(u)?.hi).filter(x => x != null);
  view().innerHTML = `<section class="hero">${skyline()}<div class="hero-in"><div class="eyebrow">Condition monitoring · 400 / 220 kV · MSETCL</div><h1>${esc(DB.site.substation.name)}</h1>
      <p class="lede">Diagnostic health for FY ${esc(DB.site.substation.fy)}, as of <b>${fmtDate(DB.today)}</b>. Each reading is evaluated against MSETCL circular 06961 (18 Oct 2024) and cross-checked with IEC / IEEE practice.</p>
      <div class="hero-stats"><div><span>Transformer fleet HI</span><b>${avg(tfh)}</b></div><div><span>Bay fleet health</span><b>${avg(bh.map(x => x[1].hi))}</b></div><div><span>Weakest bay</span><b>${bh[0] ? unitName(bh[0][0]) + ' · ' + bh[0][1].hi : '—'}</b></div><div><span>Tests overdue</span><b>${od.length}</b></div></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:16px">${printBtn}<a class="btn pri" href="#/findings">${IC.findings}Review findings</a></div></div></section>
    <section class="kpis" aria-label="Key figures">
      ${kpi('crit', '#/findings?sev=critical', '◆ Critical', n('critical'), 'act immediately')}
      ${kpi('alert', '#/findings?sev=alert', '▲ Alerts', n('alert'), 'circular limit breached')}
      ${kpi('watch', '#/findings?sev=watch', '● Watch-list', n('watch'), 'adverse trend / industry flag')}
      ${kpi('crit', '#/schedule?f=overdue', 'Overdue tests', od.length, `${due.length} more due ≤ 120 days`)}
      ${kpi('', '#/equipment', 'Equipment monitored', units.length, `${tfs.length} transformers/reactor · ${bays.length} bays`)}
      ${kpi('', '#/data', 'Test records', DB.records.length.toLocaleString('en-IN'), `${DB.site.issues.length} data-quality notes`)}</section>
    <div class="sec-h" style="margin-top:6px"><h2>Transformer & reactor health index</h2><span class="note">0–100 · DGA, oil, winding & bushing condition · worst factor governs</span></div>
    <div class="hi-grid">${TF_UNITS.map(hiCard).join('')}</div>
    <div class="grid g-7-5 mt-l">
      <div class="card sld-card"><div class="card-h"><span style="width:18px;color:var(--brand-2)">${IC.sld}</span><h2>400 kV switchyard</h2><span class="sub">breakers coloured by test health</span><div class="sp"></div><a class="btn sm" href="#/sld">Full SLD ${IC.arrow}</a></div>
        <div class="card-b"><div class="sld-wrap">${sld400()}</div>${SLD_LEGEND}</div></div>
      <div class="card"><div class="card-h"><h2>Bay health</h2><span class="sub">weakest first · CB, CT, LA</span><div class="sp"></div><a class="btn sm ghost" href="#/equipment">All ${IC.arrow}</a></div>
        <div class="bay-rank">${bh.slice(0, 12).map(([u, h]) => `<a href="#/eq/${u}"><span class="b">${esc(unitName(u))}</span><span class="dim nm">${esc(bayTitle(u))}</span><span class="track"><span class="fill bg-${h.band[1]}" style="width:${h.hi}%"></span></span><span class="num band-${h.band[1]}">${h.hi}</span></a>`).join('')}</div></div>
    </div>
    <div class="grid g-7-5 mt">
      <div class="card"><div class="card-h"><h2>Needs attention</h2><span class="sub">critical & alert</span><div class="sp"></div><a class="btn sm ghost" href="#/findings">All findings ${IC.arrow}</a></div>${findingList(fs.filter(f => SEV[f.sev] >= 3), 6)}</div>
      <div class="card"><div class="card-h"><h2>Test schedule</h2><span class="sub">per equipment · overdue & next 120 days</span><div class="sp"></div><a class="btn sm ghost" href="#/schedule">Full schedule ${IC.arrow}</a></div>${schedTable([...od, ...due].slice(0, 12), true)}</div>
    </div>
    <div class="card mt"><div class="card-h"><h2>Health matrix</h2><span class="sub">worst open finding per equipment & test · ✓ = normal (ISA-101: colour only for abnormal)</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Equipment</th><th class="r">Health</th>${tests.map(t => `<th><a href="#/test/${t}">${esc(TESTS[t].short)}</a></th>`).join('')}</tr></thead><tbody>
      <tr class="grp"><td colspan="${tests.length + 2}">Transformers & reactor</td></tr>
      ${tfs.map(u => row(u)).join('')}<tr class="grp"><td colspan="${tests.length + 2}">400 kV bays</td></tr>${bays.filter(b => kvOf(b) === 400).map(row).join('')}
      <tr class="grp"><td colspan="${tests.length + 2}">220 kV bays</td></tr>${bays.filter(b => kvOf(b) === 220).map(row).join('')}
      </tbody></table></div></div>`;
  function row(u) { const h = assetHealth(u); return `<tr><td><a href="#/eq/${u}"><b>${esc(unitName(u))}</b></a> <span class="dim">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</span></td><td class="r">${h ? `<span class="band-${h.band[1]}" style="font-weight:600">${h.hi}</span>` : '<span class="dim">—</span>'}</td>${tests.map(t => `<td>${cell(u, t)}</td>`).join('')}</tr>`; }
}

function schedTable(list, compact) {
  if (!list.length) return `<div class="empty">${pill('ok', 'Nothing overdue or due in the next 120 days')}</div>`;
  const lagTxt = (s) => s.lag.length ? s.lag.map(l => l.never ? `${l.k} never tested` : `${l.k} last ${fmtDate(l.last)}`).join(" · ") : "";
  return `<div class="tbl-wrap"><table class="t nw"><thead><tr><th>Test</th><th>Equipment</th>${compact ? '' : '<th>Circular</th><th class="r">Last completed</th>'}<th class="r">Next due</th><th>Status</th>${compact ? '' : '<th>Not covered in last campaign</th>'}</tr></thead><tbody>
  ${list.map(s => `<tr><td><a href="#/test/${s.t}">${esc(TESTS[s.t].short)}</a></td><td><a href="#/eq/${s.unit}?t=${s.t}">${esc(unitName(s.unit))}</a>${compact && s.lag.length ? ` <span class="tag ver" title="${esc(lagTxt(s))}">${s.lag.length} lagging</span>` : ''}</td>
  ${compact ? '' : `<td><button class="btn sm btn-doc" data-circ="${s.sr}">Sr ${s.sr} · ${esc(s.freq)}</button></td><td class="r">${fmtDate(s.last)}</td>`}
  <td class="r" title="Last completed ${fmtDate(s.last)}">${dueTxt(s.due)}</td>
  <td>${s.status === 'overdue' ? pill('watch', `Overdue ${-s.days} d`) : s.status === 'due' ? pill('watch', `In ${s.days} d`) : pill('ok', `In ${s.days} d`)}${s.by && (!s.last || s.by.last !== s.last) ? `<div class="due-by">${esc(s.by.k)} · ${s.by.last ? 'last ' + fmtDate(s.by.last) : 'never tested'}</div>` : ''}</td>
  ${compact ? '' : `<td style="white-space:normal">${s.lag.length ? `<span class="note">${esc(lagTxt(s))}</span>` : '<span class="dim">—</span>'}</td>`}</tr>`).join('')}</tbody></table></div>`;
}

function vSchedule(q) {
  setCrumbs([['Overview', '#/'], ['Test schedule']]);
  const f = q.get('f') || 'open';
  const list = SCHED.filter(s => f === 'all' || (f === 'open' ? s.status !== 'ok' : s.status === f));
  view().innerHTML = heroHead('Planning', 'Test schedule', 'One due date per equipment and test, counted from its <b>latest completed</b> test. A test done in 2025 and repeated in 2026 is due from the 2026 date. A row with a date but no measurement (e.g. "Rain, couldn\'t be tested") does not count as done. LA follows the circular\'s pre-monsoon (by 31 May) and post-monsoon (by 30 Nov) windows. "Due" = within 120 days.', printBtn)
    + `<div class="toolbar"><div class="chips">${[['open', 'Overdue + due'], ['overdue', 'Overdue'], ['due', 'Due ≤ 120 d'], ['all', 'All']].map(([k, l]) => `<a class="chip ${f === k ? 'on' : ''}" href="#/schedule?f=${k}">${l} <span class="num">${SCHED.filter(s => k === 'all' || (k === 'open' ? s.status !== 'ok' : s.status === k)).length}</span></a>`).join('')}</div></div>
    <div class="card">${schedTable(list, false)}</div>
    <p class="note mt">"Not covered in last campaign" lists phases or sampling points whose last completed test is more than 60 days older than that equipment's latest campaign. They should be picked up in the next outage. 220 kV CTs are taken as "Major/Important S/s" (Sr 19, yearly), matching the sheet; per Note 2 the zonal CE confirms this classification.</p>`;
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
    const ts = testsForUnit(u), st = ts.length ? unitStatus(u) : 'none', last = DB.records.filter(r => r.unit === u && done(r)).map(r => r.date).sort().pop();
    const h = assetHealth(u);
    return `<a class="tile media sev-${st} ${ts.length ? '' : 'off'}" href="#/eq/${u}">${art(artKind(u), { photo: u, alt: unitName(u) })}
      <div class="tile-b"><div class="row"><span class="n">${esc(unitName(u))}</span><span style="flex:1"></span>${h?.hi != null ? `<span class="tag band-${h.band[1]}" title="Health index">HI ${h.hi}</span>` : ''}${pill(st)}</div>
      <div class="m">${esc(isTF(u) ? DB.site.units[u].rating + (DB.site.units[u].make ? ' · ' + DB.site.units[u].make : '') : bayTitle(u))}</div>
      <div class="row">${ts.map(t => `<span class="tag">${esc(TESTS[t].short)}</span>`).join('') || '<span class="note">no tests recorded</span>'}</div>
      ${last ? `<div class="m">Last completed test ${fmtDate(last)}</div>` : ''}</div></a>`;
  };
  view().innerHTML = heroHead('Equipment register', 'Equipment', 'Transformers and the reactor are listed by unit; switchyard equipment (CT, CB, LA) by bay. The left edge carries the worst open finding, and the HI tag shows the health index. Drop a site photo in <code>assets/photos/</code> named after the equipment (e.g. <code>ICT1.jpg</code>, <code>403.jpg</code>) and it replaces the illustration.', `<a class="btn" href="#/sld">${IC.sld}View on SLD</a>`)
    + `<div class="sec-h" style="margin-top:0"><h2>Transformers & reactor</h2></div><div class="tiles media-tiles">${TF_UNITS.map(tile).join('')}</div>
    <div class="sec-h"><h2>400 kV bays</h2><span class="note">one-and-a-half breaker</span></div><div class="tiles media-tiles">${allBays.filter(b => kvOf(b) === 400).map(tile).join('')}</div>
    <div class="sec-h"><h2>220 kV bays</h2><span class="note">double main + transfer</span></div><div class="tiles media-tiles">${allBays.filter(b => kvOf(b) === 220).map(tile).join('')}</div>`;
}

function bayPosition(u) {
  const i = DIAS.findIndex(d => d.includes(u));
  if (i < 0) return kvOf(u) === 220 ? (u === '207' ? 'Bus coupler (Main I ↔ Main II)' : u === '208' ? 'Transfer bus coupler' : 'Double main + transfer bus') : 'Spare unit bay';
  const k = DIAS[i].indexOf(u);
  return `Diameter ${i + 1} · ${['main breaker to Bus-I', 'tie breaker', 'main breaker to Bus-II'][k]}`;
}

function vUnit(u, q) {
  const ts = testsForUnit(u);
  setCrumbs([['Equipment', '#/equipment'], [unitName(u)]]);
  const info = isTF(u) ? DB.site.units[u] : null;
  const fs = findings().filter(f => f.unit === u || (f.unit === '*' && f.recIds.some(id => DB.byId.get(id)?.unit === u)));
  const sch = SCHED.filter(s => s.unit === u);
  const st = ts.length ? unitStatus(u) : 'none';
  const h = assetHealth(u);
  const bushMake = info ? [...new Set(recs('bushing', { unit: u }).map(r => (r.mk || '').replace(/\n/g, ' ')).filter(Boolean))][0] : '';
  const plate = info
    ? [['Rating', info.rating], ['Make', info.make || '—'], ['Commissioned', info.commissioned ? fmtDate(info.commissioned) : '—'], ['HV bay', info.bay ? `Bay ${info.bay}` : '—'], ...(info.serials ? [['Serial nos.', Object.entries(info.serials).map(([p, s]) => `${p}: ${s}`).join(' · ')]] : []), ...(bushMake ? [['Bushings', bushMake.replace('MAKE : ', '').replace(/SNO\. - \S+/, '').trim() || bushMake]] : [])]
    : [['Voltage', `${kvOf(u)} kV`], ['Bay no.', bayTitle(u) || '—'], ['Scheme position', bayPosition(u)], ['Tests on record', String(ts.length)]];
  const artPlate = info ? [['MAKE', info.make || '—'], ['RATING', info.rating], ['SR. NO.', info.serials ? Object.values(info.serials)[0] + (Object.keys(info.serials).length > 1 ? ' …' : '') : '—']] : [['BAY', u], ['VOLTAGE', `${kvOf(u)} kV`]];
  view().innerHTML = `<section class="asset has-art"><div><div class="eyebrow">${info ? (u === 'BUS_REACTOR' ? 'Shunt reactor' : 'Power transformer · auto-transformer') : `${kvOf(u)} kV bay · ${bayPosition(u)}`}</div><div class="row-flex"><h1>${esc(unitName(u, !info))}</h1>${pill(st)}${h ? `<span class="tag band-${h.band[1]}" style="font-size:12.5px">${isTF(u) ? 'HI' : 'Bay health'} ${h.hi} · ${h.band[2]}</span>` : ''}</div>
      <div class="plate">${plate.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
      <div class="actions" style="display:flex;gap:8px;margin-top:14px">${printBtn}${!info ? `<a class="btn" href="#/sld">${IC.sld}Locate on SLD</a>` : ''}</div></div>
      <div class="asset-art">${art(artKind(u), { photo: u, plate: artPlate, alt: unitName(u, true) })}</div></section>
    ${ts.length ? `<div class="sec-h" style="margin-top:4px"><h2>Diagnostic tests</h2><span class="note">click a test for full results, graphs and history</span></div>
    <div class="test-cards">${ts.map(t => testCard(u, t)).join('')}</div>
    <div class="grid g-7-5 mt">${h ? `<div class="card"><div class="card-h"><h2>${isTF(u) ? 'Health index' : 'Bay health'}</h2><span class="sub">what drives the score</span></div><div class="card-b">${hiPanel(u)}</div></div>` : '<div></div>'}
      <div class="card"><div class="card-h"><h2>Schedule</h2><span class="sub">per test, from the latest completed test</span></div>${schedTable(sch, true)}</div></div>
    <div class="card mt"><div class="card-h"><h2>Findings</h2><span class="sub">${fs.length}</span></div>${findingList(fs)}</div>`
    : '<div class="card empty">No test records for this bay in the sheet yet. It is probably a future bay.</div>'}`;
  $$('[data-detail]').forEach(b => b.onclick = (e) => { e.preventDefault(); openElement(b.dataset.detail, u, null); });  // navigates to #/el/…
  $$('.finding a.btn[href*="?t="]').forEach(a => a.onclick = (e) => { const t = a.getAttribute('href').split('?t=')[1]; if (a.getAttribute('href').startsWith('#/eq/' + u)) { e.preventDefault(); openElement(t, u, null); } });
  if (q.get('t') && ts.includes(q.get('t'))) { location.replace(`#/el/${q.get('t')}/${encodeURIComponent(u)}`); return; }
  { const h1 = $('.asset h1'); if (h1) { h1.parentElement.insertAdjacentHTML('afterend', `<div class="row-flex mt">${shareButtons(u, null, !['SPARE_ICT', 'BUS_REACTOR'].includes(u))}</div>`); wireShare(view()); } }
  { const as = $('.asset'); if (as && isTF(u)) { as.insertAdjacentHTML('afterend', puCards(u) + detailsCard(u) + `<div class="np-wrap">${nameplateSection(u, null)}</div>`); wireDetails(view(), () => route({ keepScroll: true })); wireNameplates(view()); } }
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
  const A = analytics(t, recs(t));
  const heroArt = art(t === 'cb_crm' || t === 'cb_timing' ? 'breaker2' : t === 'ct' ? 'ct' : t === 'la' ? 'la' : 'transformer', { alt: T.name });
  view().innerHTML = `${testHeader(t, heroArt, `${circularBtn(t === 'ct' ? 18 : T.sr, 'Circular scan')}<button class="btn" data-norms>${IC.standards}Norms & standards</button>${printBtn}`)}
    <div id="v4"></div>
    <div class="sec-h mt-l"><h2>More analysis</h2><span class="note">reference · click to expand</span></div>
    <details class="sec"><summary><span class="sec-t">Circular clause & industry practice</span><span class="caret">▾</span></summary><div class="sec-b"><div class="grid g2">${clauseCard(t === 'ct' ? 18 : T.sr, t)}${standardsCard(t)}</div></div></details>
    <details class="sec"><summary><span class="sec-t">Findings</span><span class="dim">${fs.length}</span><span class="caret">▾</span></summary><div class="sec-b"><div class="card">${findingList(fs)}</div></div></details>
`;
  renderSections(t, $('#v4'));
  $$('[data-norms]').forEach(b => b.onclick = () => openNorms(t));
  normsFab(t);

}

function vTests() {
  setCrumbs([['Tests']]);
  view().innerHTML = pageHead('Diagnostics', 'Tests', 'Test-wise view across all equipment, each with its governing circular clause and the industry comparison.')
    + `<div class="tiles">${Object.values(TESTS).map(T => { const fs = findings().filter(f => f.t === T.key); const w = fs.length ? worst(fs.map(f => f.sev)) : 'ok'; return `<a class="tile sev-${w}" href="#/test/${T.key}"><div class="row"><span style="width:22px;height:22px;color:var(--brand-2);display:grid">${IC[T.key]}</span><span class="n">${esc(T.name)}</span><span style="flex:1"></span>${pill(w)}</div><div class="m">${esc(T.eq)} · circular Sr ${T.sr}</div><div class="m">${recs(T.key).length} records · ${unitsFor(T.key).length} ${T.key === 'ct' || T.key.startsWith('cb') || T.key === 'la' ? 'bays' : 'units'} · ${fs.length} findings</div></a>`; }).join('')}</div>`;
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
    + `<div class="callout warn mb"><b>Five gaps between the circular and current practice.</b><ol style="margin:6px 0 0;padding-left:20px"><li>Fixed absolute limits, where the industry trends each piece of equipment against its own baseline and its sister phases.</li><li>A generic temperature correction applied to bushings.</li><li>DGA still on the IEEE C57.104-<b>2008</b> table, with no rate-of-change rule and no OLTC-specific method.</li><li>No pole-discrepancy limit for breakers.</li><li>A 400 kV CRM limit that every healthy breaker here fails (per-break vs per-pole).</li></ol></div>
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

function vElement(t, u, sub) {
  const T = TESTS[t]; if (!T) return vNotFound();
  const ph = sub && sub.split('|')[0];
  const pu = sub && /^[RYB]$/.test(ph) && /^(ICT1|ICT2)$/.test(u) && ['bushing', 'winding', 'dga'].includes(t);
  setCrumbs([['Tests', '#/tests'], [T.name, `#/test/${t}`], [unitName(u), `#/el/${t}/${encodeURIComponent(u)}`], ...(pu ? [[`${ph}-phase unit`, `#/el/${t}/${encodeURIComponent(u)}/${ph}`]] : []), ...(sub && sub.includes('|') ? [[fullName(t, u, sub, true)]] : [])]);
  if (!sub) $('#crumbs').lastElementChild.outerHTML = `<b>${esc(unitName(u))}</b>`;
  renderElementPage(t, u, sub, view());
  normsFab(t);
}
function vTargets(q) {
  setCrumbs([['FY targets']]);
  targetsPage(view(), q.get('t'));
}
// Accessibility menu: one floating button (bottom-right, draggable) that opens a small panel —
// norms & standards, graphs on / off, full history rows (admin), text size. A tap outside closes it.
let A11Y_T = null;
function normsFab(t) { A11Y_T = t; a11yMenu(); }
function a11yMenu() {
  let w = $('#a11y');
  if (!w) {
    w = document.createElement('div'); w.id = 'a11y'; w.className = 'a11y';
    w.innerHTML = `<div class="a11y-panel" role="dialog" aria-label="Accessibility and view"></div><button class="a11y-fab" aria-expanded="false" title="Accessibility & view · drag to move · double-click to return to the corner">${IC.norms}<span>Accessibility</span></button>`;
    document.body.appendChild(w);
    const fab = w.querySelector('.a11y-fab'), panel = w.querySelector('.a11y-panel');
    // position: anchored to the bottom-right by default; a dragged position is kept as a share of the screen
    // Placement follows the VISIBLE window (visualViewport): bottom-right of what is on screen, constant
    // size even when a phone is pinch-zoomed. A dragged position is kept as a share of the visible window.
    const getPos = () => { try { return JSON.parse(localStorage.getItem('ehv-a11y-pos2')); } catch { return null; } };
    const put = () => { const vv = window.visualViewport, p = getPos();
      const vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight, ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0, s = vv ? 1 / vv.scale : 1;
      const bw = w.offsetWidth * s, bh = w.offsetHeight * s, m = 18 * s;
      const x = ox + (p ? Math.min(vw - bw - m, Math.max(m, vw * p.x)) : vw - bw - m), y = oy + (p ? Math.min(vh - bh - m, Math.max(m, vh * p.y)) : vh - bh - m);
      w.style.left = '0px'; w.style.top = '0px'; w.style.right = 'auto'; w.style.bottom = 'auto'; w.style.transformOrigin = '0 0';
      w.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`; };
    put(); requestAnimationFrame(put);
    if (window.visualViewport) { visualViewport.addEventListener('resize', put); visualViewport.addEventListener('scroll', put); }
    addEventListener('resize', put); addEventListener('scroll', put, { passive: true });
    new ResizeObserver(put).observe(w);
    let drag = null, moved = false;
    fab.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; moved = false; fab.setPointerCapture(e.pointerId); });
    fab.addEventListener('pointermove', (e) => { if (!drag) return; if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return; moved = true; w.classList.add('dragging');
      const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight, ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0, s = vv ? 1 / vv.scale : 1;
      const r = fab.getBoundingClientRect();
      try { localStorage.setItem('ehv-a11y-pos2', JSON.stringify({ x: (e.clientX - ox - r.width * s / 2) / vw, y: (e.clientY - oy - (w.offsetHeight - fab.offsetHeight / 2) * s) / vh })); } catch { }
      put(); });
    fab.addEventListener('pointerup', () => { drag = null; w.classList.remove('dragging'); });
    fab.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; return; } const open = !w.classList.contains('open'); w.classList.toggle('open', open); fab.setAttribute('aria-expanded', open); if (open) drawA11y(); });
    fab.addEventListener('dblclick', () => { try { localStorage.removeItem('ehv-a11y-pos2'); } catch { } put(); });
    document.addEventListener('pointerdown', (e) => { if (w.classList.contains('open') && !w.contains(e.target)) { w.classList.remove('open'); fab.setAttribute('aria-expanded', false); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') w.classList.remove('open'); });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const act = b.dataset.a;
      if (act === 'norms') { w.classList.remove('open'); A11Y_T ? openNorms(A11Y_T) : (location.hash = '#/norms'); return; }
      if (act === 'graphs') setViewPref('graphs', !viewPref('graphs'));
      if (act === 'history') { if (!isAdmin()) return; setViewPref('history', !viewPref('history')); }
      if (act === 'show5') { if (!isAdmin()) return; setViewPref('show5', !viewPref('show5')); applyView(); drawA11y(); route({ keepScroll: true }); return; }
      if (act.startsWith('ts')) setViewPref('text', +act.slice(2));
      applyView(); drawA11y(); stickHeads();
    });
  }
  w.classList.remove('open'); applyView();
}
function drawA11y() {
  const p = $('#a11y .a11y-panel'); if (!p) return; const adm = isAdmin();
  const sw = (on) => `<i class="sw ${on ? 'on' : ''}"></i>`;
  p.innerHTML = `<div class="a11y-h"><b>Accessibility & view</b><span class="dim">tap outside to close</span></div>
    <button class="a11y-i" data-a="norms">${IC.standards}<span><b>Norms & standards</b><small>${A11Y_T ? 'circular clause + industry practice for this test' : 'MSETCL circular and industry standards'}</small></span></button>
    <button class="a11y-i" data-a="graphs">${IC.trend}<span><b>Graphs</b><small>show or hide every graph in the results</small></span>${sw(viewPref('graphs'))}</button>
    <button class="a11y-i ${adm ? '' : 'locked'}" data-a="show5" ${adm ? '' : 'aria-disabled="true"'}>${IC.equipment}<span><b>5 kV results</b><small>${adm ? 'kept hidden; switch on only on special occasions (shows the 10 / 5 kV selector)' : 'hidden — admin only'}</small></span>${sw(viewPref('show5'))}</button>
    <button class="a11y-i ${adm ? '' : 'locked'}" data-a="history" ${adm ? '' : 'aria-disabled="true"'}>${IC.schedule}<span><b>Latest results: full comparison</b><small>${adm ? 'off = Latest test results show only the latest test row; previous, first and change rows are hidden' : 'set by the admin — sign in as admin to change'}</small></span>${sw(viewPref('history'))}</button>
    <div class="a11y-i ts"><span class="ts-a">A</span><span><b>Text size</b><small>larger text for easier reading</small></span><span class="seg">${['A', 'A+', 'A++'].map((l, i) => `<button data-a="ts${i}" class="${viewPref('text') === i ? 'on' : ''}">${l}</button>`).join('')}</span></div>`;
}

// Frozen table headers: a table's header row slides down under the frozen section / bay headings while
// the table scrolls past (works inside horizontally scrolling tables, where CSS sticky cannot).
function stickHeads() {
  const topBar = $('.top')?.getBoundingClientRect().bottom || 56;
  for (const tb of $$('table.seq, table.prog, table.never-t, table.wl')) {
    const th = tb.tHead; if (!th) continue;
    const r = tb.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) { if (th.style.transform) th.style.transform = ''; continue; }
    let off = topBar;
    const sum = tb.closest('details.sec:not(.inner)')?.querySelector(':scope>summary'); if (sum) off = Math.max(off, sum.getBoundingClientRect().bottom);
    const ub = tb.closest('.ub')?.querySelector(':scope>.ub-h'); if (ub) off = Math.max(off, ub.getBoundingClientRect().bottom);
    const eh = tb.closest('section.el-sec')?.querySelector(':scope>.row-flex'); if (eh) off = Math.max(off, eh.getBoundingClientRect().bottom);
    const hh = th.getBoundingClientRect().height, y = Math.max(0, Math.min(off - r.top, r.height - hh - 30));
    th.style.transform = y > 0 ? `translateY(${y}px)` : ''; th.classList.toggle('stuck', y > 0);
  }
}
let SH_RAF = 0; const stickSoon = () => { cancelAnimationFrame(SH_RAF); SH_RAF = requestAnimationFrame(stickHeads); };
addEventListener('scroll', stickSoon, { passive: true }); addEventListener('resize', stickSoon);
document.addEventListener('toggle', stickSoon, true);

function vNotFound() { setCrumbs([['Not found']]); view().innerHTML = '<div class="empty">Page not found. <a href="#/">Go to overview</a></div>'; }


// ============================================================ asset helpers, analytics, pop-up
function artKind(u) {
  if (u === 'BUS_REACTOR') return 'reactor';
  if (isTF(u)) return 'transformer';
  return kvOf(u) === 400 ? 'bay400' : 'bay220';
}
const heroHead = (eyebrow, title, lede, actions = '') => `<section class="hero hero-s">${skyline()}<div class="hero-in"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}${actions ? `<div class="actions" style="display:flex;gap:8px;margin-top:14px">${actions}</div>` : ''}</div></section>`;
const TEST_ABOUT = {
  bushing: 'Capacitance C₁ and dissipation factor of condenser bushings. Moisture or partial-discharge damage in the paper raises tan δ, and shorted foil layers step C₁ up. Bushings are the leading cause of catastrophic transformer failures.',
  winding: 'Overall insulation of the windings (HV–LV, HV–earth, LV–earth) by UST/GST/GSTg modes. Rising tan δ points to moisture, oil ageing or contamination; a capacitance shift points to winding movement.',
  dga: 'Gases dissolved in the oil reveal the energy and nature of internal faults: H₂ for partial discharge, C₂H₂ for arcing, C₂H₄ for hot spots, CO/CO₂ for paper. Paired with the oil-quality tests (BDV, water).',
  ct: 'Capacitance and tan δ of oil-paper CT insulation through the test tap. CT explosions in the yard are usually preceded by a steady tan δ rise.',
  cb_crm: 'Micro-ohm resistance of each pole\'s main current path at about 100 A DC. Contact wear, erosion or a loose terminal palm raise resistance and heating.',
  cb_timing: 'Open and close times of each pole for both trip coils. Slowing mechanisms extend fault-clearing time, and pole spread raises switching over-voltages.',
  la: 'Third-harmonic resistive leakage of ZnO arresters (Icorr), measured before and after the monsoon. A rising resistive current signals block degradation before thermal runaway.',
};
// key metric per test, used for ranking, heat map and movers
const KM = {
  bushing: { label: 'corrected tan δ', unit: '%', dp: 3, get: r => r.v.tand20, sub: r => `${r.pos} ${r.ph !== '-' ? r.ph : ''}`.trim() || 'Bushing', th: [[1.0, 'critical'], [0.7, 'alert'], [0.5, 'watch']], limitNote: 'Circular: 0.7 % follow-up, 1.0 % replace immediately. Industry: 0.5 % for a new OIP bushing (IEEE C57.19.01).' },
  winding: { label: 'tan δ @20 °C', unit: '%', dp: 3, get: r => r.v.tand20, sub: r => `${r.ph}-ph ${r.acting}`, th: [[1.0, 'critical'], [0.7, 'alert'], [0.5, 'watch']], limitNote: 'Circular: 0.7 %. IEEE C57.152: ≤ 0.5 % for a new unit.' },
  ct: { label: 'corrected tan δ', unit: '%', dp: 3, get: r => r.v.tand20, sub: r => `${r.ph}-ph`, th: [[1.0, 'critical'], [0.7, 'alert'], [0.5, 'watch']], limitNote: 'Circular: 0.7 % with 0.1 %/yr maximum rise. IEC 61869-1 routine limit 0.5 %.' },
  cb_crm: { label: 'contact resistance', unit: 'µΩ', dp: 1, get: r => r.v.R, sub: r => `${r.ph}-ph`, th: r => [[LIM.crm[kvOf(r.unit)], 'alert']], limitNote: 'Circular: 400 kV 50 µΩ, 220 kV 100 µΩ. Every 400 kV pole exceeds 50 µΩ, which suggests a per-break figure (see findings).' },
  cb_timing: { label: 'trip time', unit: 'ms', dp: 1, get: r => Math.max(r.v.open1 ?? 0, r.v.open2 ?? 0) || null, sub: r => `${r.ph}-ph`, th: r => [[LIM.trip[kvOf(r.unit)], 'alert'], [LIM.trip[kvOf(r.unit)] * 0.92, 'watch']], limitNote: 'Circular trip limit: 400 kV 25 ms, 220 kV 35 ms (max of TC1 / TC2 shown). Watch from 92 % of limit.' },
  la: { label: 'Icorr', unit: 'µA', dp: 0, get: r => r.v.Icorr, sub: r => `${r.ph}-ph`, th: [[350, 'critical'], [150, 'alert']], limitNote: 'Circular: up to 150 µA normal · 150–350 µA stack-wise IR test · beyond 350 µA replace.' },
  dga: { label: 'TDCG (main tank)', unit: 'ppm', dp: 0, get: r => r.pos === 'OLTC' ? null : r.v.TDCG, sub: r => `${r.ph !== '-' ? r.ph + '-ph ' : ''}${r.pos}`, th: [[4630, 'critical'], [1920, 'alert'], [720, 'watch']], limitNote: 'TDCG recomputed from the six combustible gases. IEEE C57.104-2008 conditions: 720 / 1920 / 4630 ppm.' },
};
function sevVal(t, r, v) {
  if (v == null) return 'none';
  const th = typeof KM[t].th === 'function' ? KM[t].th(r) : KM[t].th;
  for (const [lim, sev] of th) if (v > lim) return sev;
  return 'ok';
}
function analytics(t, all) {
  const k = KM[t], rs = all.filter(done).filter(r => k.get(r) != null);
  const series = [...groupBy(rs, r => r.unit + '|' + k.sub(r))].map(([key, s]) => { s.sort((a, b) => a.date.localeCompare(b.date)); return { key, s, L: s.at(-1), P: s.at(-2) }; });
  const rank = series.map(x => ({ label: `${unitName(x.L.unit)} · ${k.sub(x.L)}`.replace(/\s+/g, ' ').trim(), v: k.get(x.L), sev: sevVal(t, x.L, k.get(x.L)), unit: x.L.unit })).sort((a, b) => b.v - a.v);
  const movers = series.filter(x => x.P).map(x => { const a = k.get(x.P), b = k.get(x.L), dy = years(x.P.date, x.L.date); return { label: `${unitName(x.L.unit)} · ${k.sub(x.L)}`, unit: x.L.unit, a, b, d: b - a, pct: a ? (b - a) / Math.abs(a) * 100 : null, rate: dy > 0 ? (b - a) / dy : null, from: x.P.date, to: x.L.date }; })
    .filter(m => m.pct != null).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 8);
  const fys = [...new Set(rs.map(r => r.ses))].sort();
  const heat = [...groupBy(rs, r => r.unit)].sort((a, b) => sortUnits(a[0], b[0])).map(([u, s]) => ({ u, cells: fys.map(fy => { const x = s.filter(r => r.ses === fy); if (!x.length) return null; const w = x.reduce((m, r) => k.get(r) > k.get(m) ? r : m); return { v: k.get(w), sev: sevVal(t, w, k.get(w)), n: x.length }; }) }));
  const latest = series.map(x => x.L);
  const within = latest.length ? Math.round(latest.filter(r => SEV[sevVal(t, r, k.get(r))] < 3).length / latest.length * 100) : 100;
  return { assets: new Set(rs.map(r => r.unit)).size, series: series.length, lastDate: rs.map(r => r.date).sort().pop(), within, overdue: SCHED.filter(s => s.t === t && s.status === 'overdue').length, worst: rank[0], rank, movers, fys, heat };
}
function rankChart(cv, t, rank) {
  if (!cv || !rank.length) return;
  const c = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const col = { ok: c('--ink-4'), watch: c('--watch'), alert: c('--alert'), critical: c('--crit'), none: c('--line-2') };
  const top = rank.slice(0, 26);
  const ch = new Chart(cv, { type: 'bar', data: { labels: top.map(r => r.label), datasets: [{ data: top.map(r => r.v), backgroundColor: top.map(r => col[r.sev]), borderRadius: 3, barThickness: 12 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${fmt(it.raw, KM[t].dp)} ${KM[t].unit} · ${SEV_LABEL[top[it.dataIndex].sev]}` } } },
      onClick: (_e, els) => { if (els[0]) location.hash = `#/eq/${top[els[0].index].unit}?t=${t}`; },
      scales: { x: { grid: { color: c('--line') }, ticks: { color: c('--ink-3') }, title: { display: true, text: KM[t].unit, color: c('--ink-3') } }, y: { grid: { display: false }, ticks: { color: c('--ink-2'), font: { size: 11 } } } } } });
  return ch;
}
function moversTable(m, t) {
  const dp = KM[t].dp;
  if (!m.length) return '<div class="empty">Needs at least two completed tests per series.</div>';
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>Series</th><th class="r">Previous</th><th class="r">Latest</th><th class="r">Change</th><th class="r">Per year</th></tr></thead><tbody>${m.map(x => `<tr><td><a href="#/eq/${x.unit}">${esc(x.label)}</a><div class="dim" style="font-size:11.5px">${fmtDate(x.from)} → ${fmtDate(x.to)}</div></td><td class="r">${fmt(x.a, dp)}</td><td class="r">${fmt(x.b, dp)}</td><td class="r ${x.pct > 0 ? 'up' : 'down'}">${x.pct > 0 ? '▲' : '▼'} ${fmt(Math.abs(x.pct), 0)}%</td><td class="r">${t !== 'la' && x.rate != null ? (x.rate > 0 ? '+' : '') + fmt(x.rate, dp) : '<span class="dim" title="Seasonal test: an annual rate is not meaningful">—</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function heatmap(t, A) {
  if (!A.heat.length) return '<div class="empty">No data</div>';
  return `<div class="tbl-wrap"><table class="t heat"><thead><tr><th>Equipment</th>${A.fys.map(f => `<th class="r">FY ${f}</th>`).join('')}</tr></thead><tbody>${A.heat.map(h => `<tr><td><a href="#/eq/${h.u}?t=${t}">${esc(unitName(h.u))}</a> <span class="dim">${esc(isTF(h.u) ? '' : bayTitle(h.u))}</span></td>${h.cells.map(c => c ? `<td class="r hc-${c.sev}" title="${c.n} readings">${fmt(c.v, KM[t].dp)}</td>` : '<td class="r dim">·</td>').join('')}</tr>`).join('')}</tbody></table></div>`;
}
function testCard(u, t) {
  const rs = recs(t, { unit: u }).filter(done), k = KM[t];
  const s = unitStatus(u, t), sch = SCHED.find(x => x.unit === u && x.t === t);
  const latest = [...groupBy(rs.filter(r => k.get(r) != null), k.sub).values()].map(x => x.sort((a, b) => a.date.localeCompare(b.date)).at(-1));
  const worstL = latest.sort((a, b) => k.get(b) - k.get(a))[0];
  const spark = sparkline(rs.filter(r => k.get(r) != null), k);
  return `<a class="test-card sev-${s}" href="#/eq/${u}?t=${t}" data-detail="${t}"><div class="tc-h"><span class="tc-ic">${IC[t]}</span><span class="n">${esc(TESTS[t].name)}</span><span style="flex:1"></span>${pill(s)}</div>
    <div class="tc-v"><span class="num">${worstL ? fmt(k.get(worstL), k.dp) : '—'}</span><span class="u">${k.unit}</span><span class="dim">worst latest ${esc(k.label)}${worstL ? ' · ' + esc(k.sub(worstL)) : ''}</span></div>${spark}
    <div class="tc-f"><span>Last ${sch ? fmtDate(sch.last) : '—'}</span><span>${sch ? (sch.status === 'overdue' ? `<b style="color:var(--watch)">Overdue ${-sch.days} d</b>` : `Due ${fmtDate(sch.due)}`) : ''}${sch?.by && sch.by.last !== sch.last ? `<small class="due-by">${esc(sch.by.k)} · ${sch.by.last ? 'last ' + fmtDate(sch.by.last) : 'never tested'}</small>` : ''}</span></div></a>`;
}
function sparkline(rs, k) {
  const pts = [...groupBy(rs, r => r.date)].map(([d, x]) => [d, Math.max(...x.map(k.get))]).sort((a, b) => a[0].localeCompare(b[0]));
  if (pts.length < 2) return '<div class="spark"></div>';
  const W = 240, H = 40, xs = pts.map(p => +new Date(p[0])), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys) || 1;
  const X = (x) => 4 + (x - x0) / (x1 - x0 || 1) * (W - 8), Y = (y) => H - 5 - (y - y0) / ((y1 - y0) || 1) * (H - 10);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(+new Date(p[0])).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="var(--brand-2)" stroke-width="1.8"/>${pts.map(p => `<circle cx="${X(+new Date(p[0])).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.2" fill="var(--brand-2)"/>`).join('')}</svg>`;
}

const FIELD = { C: 'C pF', tand: 'Tan δ %', tand20: 'Tan δ @20 °C', U: 'U kV', I: 'I', P: 'P', F: 'F Hz', temp: 'Temp °C', R: 'CRM µΩ', mV: 'mV', open1: 'Trip TC1 ms', open2: 'Trip TC2 ms', close: 'Close ms', co1: 'C-O TC1 ms', co2: 'C-O TC2 ms', Ith: 'Ith µA', Icorr: 'Icorr µA', Itotal: 'Itotal µA', IRt: 'IR top MΩ', IRm: 'IR mid MΩ', IRb: 'IR bottom MΩ', IRtot: 'IR total MΩ', H2: 'H₂', CH4: 'CH₄', CO: 'CO', CO2: 'CO₂', C2H4: 'C₂H₄', C2H6: 'C₂H₆', C2H2: 'C₂H₂', O2: 'O₂', N2: 'N₂', TDCG: 'TDCG', TGC: 'TGC', BDV: 'BDV kV', H2O: 'H₂O ppm', acidity: 'Acidity', DDF: 'DDF', resistivity: 'Resistivity', TDCG_sheet: 'TDCG (sheet)' };

/** Full-detail pop-up for one asset × one test. */
function openDetail(u, t) {
  const T = TESTS[t], cfg = TV[t], k = KM[t];
  const all = recs(t, { unit: u }).sort((a, b) => b.date.localeCompare(a.date));
  const rs = all.filter(done);
  const s = unitStatus(u, t), sch = SCHED.find(x => x.unit === u && x.t === t);
  const fs = findings().filter(f => f.t === t && (f.unit === u || (f.unit === '*' && f.recIds.some(id => DB.byId.get(id)?.unit === u))));
  const sr = t === 'ct' && kvOf(u) === 220 ? 19 : (t === 'ct' ? 18 : T.sr);
  const ser = [...groupBy(rs.filter(r => k.get(r) != null), k.sub)].map(([key, x]) => { x.sort((a, b) => a.date.localeCompare(b.date)); const L = x.at(-1), P = x.at(-2), B = x[0]; return { key, L, P, B }; }).sort((a, b) => a.key.localeCompare(b.key));
  const keys = [...new Set(all.flatMap(r => Object.keys(r.v)))].filter(x => FIELD[x] && x !== 'TDCG_sheet');
  const groups = cfg ? groupBy(rs, cfg.group) : new Map();
  const gkeys = [...groups.keys()];
  const body = `
    <div class="dt-head">${art(artKind(u) === 'reactor' || artKind(u) === 'transformer' ? artKind(u) : (t === 'ct' ? 'ct' : t === 'la' ? 'la' : kvOf(u) === 400 ? 'breaker2' : 'breaker1'), { photo: `${u}-${t}`, alt: T.name })}
      <div><div class="row-flex">${pill(s)}${sch ? (sch.status === 'overdue' ? pill('watch', `Overdue ${-sch.days} d${sch.by && sch.by.last !== sch.last ? ' · ' + sch.by.k : ''}`) : pill('ok', `Next due ${fmtDate(sch.due)}`)) : ''}${circularBtn(sr, 'Circular scan')}</div>
      <p class="lede" style="margin-top:8px">${esc(TEST_ABOUT[t])}</p>
      <div class="stat-strip">
        <div><span>Last completed</span><b>${sch ? fmtDate(sch.last) : '—'}</b></div><div><span>Completed tests</span><b>${new Set(rs.map(r => r.date)).size}</b></div>
        <div><span>Records</span><b>${rs.length}</b></div><div><span>Findings</span><b>${fs.length}</b></div>
        ${sch?.lag.length ? `<div><span>Not covered last time</span><b style="color:var(--watch)">${esc(sch.lag.map(l => l.k).join(', '))}</b></div>` : ''}</div></div></div>
    <h3 class="mt">Latest by ${t === 'dga' ? 'sampling point' : t === 'winding' ? 'insulation' : t === 'bushing' ? 'bushing' : 'phase'} · ${esc(k.label)}</h3>
    <div class="ph-cards">${ser.map(x => { const v = k.get(x.L), pv = x.P ? k.get(x.P) : null, bv = k.get(x.B), sv = sevVal(t, x.L, v); return `<div class="ph-card hc-${sv}"><div class="k">${esc(x.key)}</div><div class="v num">${fmt(v, k.dp)} <span class="u">${k.unit}</span></div>
      <div class="d">${pv != null ? `${v > pv ? '▲' : v < pv ? '▼' : '='} ${fmt(Math.abs(v - pv), k.dp)} vs ${fmtDate(x.P.date)}` : 'single test'}</div>${x.B !== x.L ? `<div class="d dim">baseline ${fmt(bv, k.dp)} (${fmtDate(x.B.date)})</div>` : ''}</div>`; }).join('')}</div>
    ${t === 'dga' ? duvalCard(rs) : ''}
    ${t === 'cb_crm' ? `<div class="card mt"><div class="card-b"><div style="height:240px;position:relative"><canvas id="dtCrm"></canvas></div></div></div>` : `
    <div class="row-flex mt"><h3 style="margin:0">Trends</h3>${gkeys.length > 1 ? `<div class="seg" id="dtGroups">${gkeys.map((g, i) => `<button class="${i ? '' : 'on'}" data-g="${esc(g)}">${esc(cfg.groupLabel(groups.get(g)[0]).replace(unitName(u) + ' · ', ''))}</button>`).join('')}</div>` : ''}</div>
    <div class="grid g2 mt" id="dtCharts"></div>`}
    ${fs.length ? `<h3 class="mt-l">Findings</h3><div class="card">${findingList(fs)}</div>` : ''}
    <div class="grid g2 mt-l">${clauseCard(sr, t)}${standardsCard(t)}</div>
    <div class="row-flex mt-l"><h3 style="margin:0">Complete test history</h3><span class="note">${all.length} rows · newest first · includes rows logged without a measurement</span></div>
    <div class="card mt"><div class="tbl-wrap" style="max-height:420px"><table class="t"><thead><tr><th>Date</th><th>FY</th><th>Ph</th>${t === 'bushing' || t === 'dga' ? '<th>Point</th>' : ''}${t === 'winding' ? '<th>Mode</th><th>Insulation</th>' : ''}${t === 'la' ? '<th>Season</th>' : ''}${keys.map(x => `<th class="r">${FIELD[x]}</th>`).join('')}<th>Status</th><th>Remark</th><th>Source</th></tr></thead><tbody>
      ${all.map(r => `<tr class="${done(r) ? '' : 'dim'}"><td class="num">${fmtDate(r.date)}</td><td>${esc(r.ses)}</td><td>${phase(r.ph)}</td>${t === 'bushing' || t === 'dga' ? `<td>${esc(r.pos)}</td>` : ''}${t === 'winding' ? `<td>${esc(r.mode)}</td><td>${esc(r.acting)}</td>` : ''}${t === 'la' ? `<td>${esc(r.season || '')}</td>` : ''}${keys.map(x => `<td class="r">${fmt(r.v[x], x === 'tand' || x === 'tand20' ? 3 : 2)}</td>`).join('')}<td>${done(r) ? pill(statusOf(r)) : pill('none', 'not done')}</td><td class="dim" style="white-space:normal;min-width:120px">${esc(r.rem)}</td><td class="mono dim" style="font-size:11px">${esc(r.src)}</td></tr>`).join('')}</tbody></table></div></div>`;
  modal(`${esc(unitName(u, true))} — ${esc(T.name)}`, body, (root) => {
    root.querySelector('.modal').classList.add('xl');
    if (t === 'cb_crm') { const c = PHASE_COLOR(); const lat = ser.map(x => x.L); barChart(root.querySelector('#dtCrm'), { labels: ['R', 'Y', 'B'], yLabel: 'µΩ', limits: [{ y: LIM.crm[kvOf(u)], label: `Circular ${LIM.crm[kvOf(u)]} µΩ` }], series: [{ label: 'Contact resistance', color: c['-'], data: ['R', 'Y', 'B'].map(p => lat.find(r => r.ph === p)?.v.R ?? null) }] }); return; }
    const draw = (g) => {
      const box = root.querySelector('#dtCharts'); const grs = groups.get(g) || rs;
      box.innerHTML = cfg.metrics.map((m, i) => `<div class="chart-card" data-mi="${i}"><div class="card-h"><h3>${esc(m.label)}</h3></div><div class="chart-box" style="height:260px"><canvas></canvas></div><div class="legend-note" data-lbl></div></div>`).join('');
      $$('[data-mi]', box).forEach(card => drawChart(card, grs, cfg, Number(card.dataset.mi)));
    };
    draw(gkeys.sort((a, b) => SEV[worst(groups.get(b).map(statusOf))] - SEV[worst(groups.get(a).map(statusOf))])[0]);
    const sg = root.querySelector('#dtGroups');
    if (sg) { const first = gkeys[0]; $$('button', sg).forEach(b => { b.classList.toggle('on', b.dataset.g === first); b.onclick = () => { $$('button', sg).forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.g); }; }); }
  });
}

// ============================================================ router & shell
function route(opt = {}) {
  destroyCharts();
  if (!opt.keepModal) $$('.modal-bg, .drawer').forEach(m => m.remove());
  A11Y_T = null;
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?'); const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  { const sec = ['test', 'el', 'results', 'tests'].includes(p[0]) ? 'tests' : p[0] === 'pending' ? 'pending' : !p[0] ? 'home' : '';
    $$('.tnav .tn').forEach(x => x.classList.toggle('on', (sec === 'home' && x.getAttribute('href') === '#/') || (sec === 'pending' && x.getAttribute('href') === '#/pending') || (sec === 'tests' && x.id === 'tnTests'))); }
  $$('.nav a').forEach(a => { const href = a.getAttribute('href'); a.classList.toggle('on', href === '#/' + (p[0] || '') || (p[0] === 'test' && href === '#/test/' + p[1]) || (p[0] === 'eq' && href === '#/equipment')); });
  $('#sb').classList.remove('open');
  const V = { '': vOverview, equipment: vEquipment, sld: vSld, tests: vTests, findings: vFindings, schedule: vSchedule, norms: vNorms, standards: vStandards, data: vData, about: vAbout };
  if (p[0] === 'eq') vUnit(decodeURIComponent(p[1]), q);
  else if (p[0] === 'pu') puPage(decodeURIComponent(p[1]), p[2], view(), { setCrumbs, rerender: () => route({ keepScroll: true }) });
  else if (p[0] === 'el') vElement(p[1], decodeURIComponent(p[2] || ''), p[3] ? decodeURIComponent(p[3]) : null);
  else if (p[0] === 'targets') vTargets(q);
  else if (p[0] === 'pending') { setCrumbs([['Pending tests']]); pendingPage(view(), q, heroHead); }
  else if (p[0] === 'results') { setCrumbs([['Results by date']]); resultsPage(view(), q, heroHead); }
  else if (p[0] === 'test') vTest(p[1], q);
  else (V[p[0] || ''] || vNotFound)(q);
  if (!opt.keepScroll) window.scrollTo(0, 0);
  adminBar(); a11yMenu(); setTimeout(stickHeads, 80);
}

function shell() {
  $('#logo').innerHTML = LOGO;
  $$('.nav a[data-ic] .ic').forEach(el => el.innerHTML = IC[el.parentElement.dataset.ic] || '');
  $('#menuBtn').innerHTML = IC.menu; $('#printBtn').innerHTML = IC.print; $('#themeBtn').innerHTML = IC.theme; $('#searchIc').innerHTML = IC.search;
  $('#menuBtn').onclick = () => $('#sb').classList.toggle('open');
  $('#sbClose').onclick = $('#sbBack').onclick = () => $('#sb').classList.toggle('open', false);
  $$('.tnav [data-ic] .ic').forEach(el => el.innerHTML = IC[el.parentElement.dataset.ic] || ''); $$('.tnav [data-icn]').forEach(el => el.innerHTML = IC[el.dataset.icn] || '');
  const dd = $('#tnTests'), ddm = $('#tnTestsMenu');
  dd.onclick = (e) => { e.stopPropagation(); const o = !ddm.classList.contains('open'); ddm.classList.toggle('open', o); dd.setAttribute('aria-expanded', o); };
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.tn-dd')) { ddm.classList.toggle('open', false); dd.setAttribute('aria-expanded', false); } });
  ddm.addEventListener('click', (e) => { if (e.target.closest('a')) ddm.classList.toggle('open', false); });
  $('#printBtn').onclick = () => window.print();
  setupPrint();
  $('#searchBtn').onclick = openPalette;
  const ab = document.createElement('button'); ab.className = 'icon-btn admin-btn'; ab.id = 'adminBtn'; ab.title = 'Admin: edit results, remarks and targets'; ab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span>Admin</span>`;
  $('#themeBtn').before(ab); ab.onclick = () => { toggleAdmin(); rerenderInPlace(); };
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
  $('#site-name').textContent = DB.site.substation.name; $('#site-name2').textContent = DB.site.substation.name;
  $('#tnav-tests').innerHTML = Object.values(TESTS).map(T => `<a href="#/test/${T.key}" role="menuitem"><span class="ic">${IC[T.key]}</span><b>${esc(T.name)}</b></a>`).join('');
  $('#site-fy').textContent = `FY ${DB.site.substation.fy} · ${DB.records.length.toLocaleString('en-IN')} records`;
  // command palette index
  const items = [
    ...[['#/', 'Overview', 'overview'], ['#/findings', 'Findings', 'findings'], ['#/schedule', 'Test schedule', 'schedule'], ['#/targets', 'FY targets', 'schedule'], ['#/sld', 'Single-line diagram', 'sld'], ['#/equipment', 'Equipment', 'equipment'], ['#/norms', 'MSETCL norms 2024', 'norms'], ['#/norms?tab=errata', 'Corrections to old JSON', 'norms'], ['#/standards', 'Industry standards', 'standards'], ['#/data', 'Data & sources', 'data'], ['#/about', 'Roadmap', 'roadmap']].map(([href, label, ic]) => ({ href, label, kind: 'page', icon: IC[ic] })),
    ...TF_UNITS.map(u => ({ href: '#/eq/' + u, label: unitName(u), sub: DB.site.units[u].rating, kind: 'equipment', icon: IC.equipment })),
    ...Object.keys(DB.site.bays).map(u => ({ href: '#/eq/' + u, label: unitName(u), sub: bayTitle(u), kind: `${kvOf(u)} kV bay`, icon: IC.sld })),
    ...Object.values(TESTS).map(T => ({ href: '#/test/' + T.key, label: T.name, sub: T.eq, kind: 'test', icon: IC[T.key] })),
    ...DB.norms.rows.map(r => ({ href: `#/norms?q=${encodeURIComponent(r.activity)}`, label: `Sr ${r.sr} · ${r.activity}`, sub: r.equipment, kind: 'circular', icon: IC.norms })),
  ];
  items.forEach(i => i.hay = `${i.label} ${i.sub || ''} ${i.kind}`.toLowerCase());
  setPaletteItems(items);
}

// ============================================================ admin
function rerun() { run(); SCHED = schedule(); afterLoad(); }
function rerenderInPlace() {
  const y = window.scrollY, openSecs = $$('details.sec').map(d => d.open);
  route({ keepModal: true, keepScroll: true });
  $$('details.sec').forEach((d, i) => { if (openSecs[i] != null) d.open = openSecs[i]; });
  window.scrollTo(0, y);
  if ($('.modal-bg') && RESULTS_CTX.onModalRerender) RESULTS_CTX.onModalRerender();
}
const RESULTS_CTX = { rerun, rerender: rerenderInPlace, clauseCard: (sr, t) => clauseCard(sr, t), standardsCard: (t) => standardsCard(t) };
function adminBar() {
  let bar = $('#adminBar');
  if (!isAdmin()) { if (bar) bar.remove(); $('#adminBtn')?.classList.remove('on'); return; }
  $('#adminBtn')?.classList.add('on');
  if (!bar) { bar = document.createElement('div'); bar.id = 'adminBar'; bar.className = 'admin-bar'; $('.main').insertBefore(bar, $('#view')); }
  bar.innerHTML = `<b>Admin mode</b><span>Click any result, remark or date in the sequence-wise tables to edit it. Type a value or a formula such as <code>=tand/K(temp)</code> or <code>=(C-prev.C)/prev.C*100</code>. ${editCount()} change(s) saved in this browser.</span><span class="sp"></span>
    <button class="btn sm" id="exEd">Export changes</button><label class="btn sm">Import<input type="file" accept=".json" id="imEd" hidden></label><button class="btn sm" id="rsEd">Discard all</button><button class="btn sm pri" id="exitAd">Exit admin</button>`;
  $('#exEd').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportEdits()], { type: 'application/json' })); a.download = `diagnostic-edits-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
  $('#imEd').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { importEdits(await f.text()); refresh(); rerun(); rerenderInPlace(); } catch (er) { alert('Could not import: ' + er.message); } };
  $('#rsEd').onclick = () => { if (confirm('Discard every change made in this browser and return to the sheet values?')) { resetEdits(); refresh(); rerun(); rerenderInPlace(); } };
  $('#exitAd').onclick = () => { toggleAdmin(); rerenderInPlace(); };
}

(async function main() {
  shell();
  bindResults(RESULTS_CTX);
  try {
    await loadAll(); await loadNameplates();
    run(); SCHED = schedule();
    bindRise((u) => findings().some(f => f.t === 'bushing' && f.unit === u && /rising/i.test(f.title)));
    afterLoad();
    window.addEventListener('hashchange', () => route());
    route();
  } catch (e) {
    view().innerHTML = `<div class="callout warn"><b>Could not load data.</b> ${esc(e.message)}<br>Open the portal through a web server (GitHub Pages, or <code>python3 -m http.server</code> in this folder), not directly as a file.</div>`;
    console.error(e);
  }
})();


// ------------------------------------------------------------------ printing: choose portrait / landscape, always fit to paper width
function setupPrint() {
  if (!window.__nativePrint) window.__nativePrint = window.print.bind(window);   // keep the browser's own print before wrapping it
  window.print = () => {
    document.querySelector('.print-ask')?.remove();
    const d = document.createElement('div'); d.className = 'print-ask';
    d.innerHTML = `<div class="pa-in" role="dialog" aria-label="Print"><b>Print / save as PDF</b><span>The page is scaled to fit the paper width.</span>
      <div class="pa-b"><button class="btn pri" data-o="portrait">▯ Portrait</button><button class="btn pri" data-o="landscape">▭ Landscape</button><button class="btn" data-o="">Cancel</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = (e) => { const b = e.target.closest('[data-o]'); if (!b && e.target !== d) return; d.remove(); if (b && b.dataset.o) fitPrint(b.dataset.o); };
  };
}
function fitPrint(orient) {
  // Readable scale for the paper, and the page laid out at exactly that width: tables wrap instead of
  // being cut off at the right edge or shrunk to unreadable size.
  let st = document.getElementById('print-style'); if (!st) { st = document.createElement('style'); st.id = 'print-style'; document.head.appendChild(st); }
  const usable = (orient === 'landscape' ? 277 : 190) * 96 / 25.4, z = orient === 'landscape' ? 0.85 : 0.64;
  const W = Math.floor(usable / z);   // the whole document is laid out at this width; the browser then scales it once to the paper
  st.textContent = `@page{size:A4 ${orient};margin:10mm}@media print{html,body,.shell,.main,.view{width:${W}px!important;min-width:0!important;max-width:${W}px!important}.view{padding:0!important}}`;
  document.querySelectorAll('table.seq thead').forEach(t => { t.style.transform = ''; });
  setTimeout(() => window.__nativePrint(), 60);
}
