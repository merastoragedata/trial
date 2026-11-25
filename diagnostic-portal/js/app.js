import { DB, TESTS, loadAll, recs, groupBy, unitName, bayTitle, kvOf, isTF, fmt, fmtDate, unitsFor, sortUnits, testsForUnit, years } from './data.js';
import { run, findings, statusOf, unitStatus, schedule, SEV, SEV_LABEL, LIM, duval1, DUVAL_NAMES, worst } from './rules.js';
import { esc, pill, phase, $, $$, lineChart, barChart, destroyCharts, PHASE_COLOR, circularBtn, openCircular, modal, drawSnippet } from './ui.js';

const view = () => $('#view');
const setCrumbs = (parts) => { $('#crumbs').innerHTML = parts.map((p, i) => i === parts.length - 1 ? `<b>${esc(p[0])}</b>` : `<a href="${p[1]}">${esc(p[0])}</a><span>›</span>`).join(''); };
const ph = (r) => r.ph && r.ph !== '-' ? r.ph : '';
let SCHED = [];

// ============================================================ test view config
const SHORT = { tand: 'Tan δ meas.', tand20: 'Tan δ @20 °C', dC: 'ΔC %', C: 'C pF', open1: 'Trip TC1', open2: 'Trip TC2', close: 'Close', co1: 'C-O', Icorr: 'Icorr', Ith: 'Ith', Itotal: 'Itotal', hc: 'H₂ + HCs', cox: 'CO / CO₂', C2H2: 'C₂H₂', BDV: 'BDV', H2O: 'Water' };
const pctC = (s) => { const b = s.find(r => r.v.C != null); return (r) => (b && r.v.C != null) ? +((r.v.C - b.v.C) / b.v.C * 100).toFixed(2) : null; };
const TV = {
  bushing: {
    group: r => `${r.unit}|${r.pos}`, groupLabel: r => `${unitName(r.unit)} · ${r.pos || 'Bushings'}`, series: r => r.ph,
    metrics: [
      { k: 'tand', label: 'Tan δ % (measured)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }, { y: 1.0, label: 'Replace 1.0 %', sev: 'critical' }] },
      { k: 'tand20', label: 'Tan δ % (sheet-corrected 20 °C)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }] },
      { k: 'dC', label: 'ΔC % vs first test', unit: '%', derived: pctC, limits: [{ y: 10, label: '+10 %', sev: 'alert' }, { y: -5, label: '−5 %', sev: 'alert' }] },
    ],
    cols: [['Equipment', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Bushing', r => esc(r.pos || '—')], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['C pF', r => fmt(r.v.C, 1), 'r'], ['Tan δ %', r => fmt(r.v.tand, 3), 'r', r => r.v.tand > 0.7], ['Temp °C', r => fmt(r.v.temp, 0), 'r'], ['Tan δ @20 °C', r => fmt(r.v.tand20, 3), 'r'], ['ΔC %', (r, s) => fmt(pctC(s)(r), 1), 'r']],
    note: 'Judged on measured tan δ. The sheet\'s generic K-factor (÷1.61 at 42 °C) is meant for winding insulation. OIP bushings stay nearly flat from 20 to 60 °C, so the "corrected" value understates the real one.',
  },
  winding: {
    group: r => `${r.unit}|${r.ph}`, groupLabel: r => `${unitName(r.unit)}${ph(r) ? ' · ' + r.ph + '-phase' : ''}`, series: r => `${r.mode} ${r.acting}`,
    metrics: [
      { k: 'tand20', label: 'Tan δ % @ 20 °C', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }, { y: 0.5, label: 'IEEE 0.5 %', sev: 'watch' }] },
      { k: 'tand', label: 'Tan δ % (measured)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }] },
      { k: 'dC', label: 'ΔC % vs first test', unit: '%', derived: pctC, limits: [{ y: 10, label: '+10 %', sev: 'alert' }, { y: -5, label: '−5 %', sev: 'alert' }] },
    ],
    cols: [['Equipment', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Ph', r => phase(r.ph)], ['Mode', r => `<span class="tag">${esc(r.mode)}</span>`], ['Insulation', r => esc(r.acting)], ['Tested', r => fmtDate(r.date)],
      ['C pF', r => fmt(r.v.C, 1), 'r'], ['Tan δ %', r => fmt(r.v.tand, 3), 'r'], ['Temp', r => fmt(r.v.temp, 0), 'r'], ['@20 °C', r => fmt(r.v.tand20, 3), 'r', r => r.v.tand20 > 0.7], ['ΔC %', (r, s) => fmt(pctC(s)(r), 1), 'r']],
    seriesKey: r => `${r.unit}|${r.ph}|${r.acting}`,
  },
  ct: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'tand', label: 'Tan δ % (measured)', unit: '%', limits: [{ y: 0.7, label: 'Circular 0.7 %', sev: 'alert' }, { y: 0.5, label: 'IEC 0.5 %', sev: 'watch' }] },
      { k: 'C', label: 'Capacitance pF', unit: 'pF' },
      { k: 'dC', label: 'ΔC % vs first test', unit: '%', derived: pctC, limits: [{ y: 10, label: '+10 %', sev: 'alert' }, { y: -5, label: '−5 %', sev: 'alert' }] },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['kV', r => kvOf(r.unit)], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['C pF', r => fmt(r.v.C, 1), 'r'], ['Tan δ %', r => fmt(r.v.tand, 3), 'r', r => r.v.tand > 0.7], ['Temp', r => fmt(r.v.temp, 0), 'r'], ['ΔC %', (r, s) => fmt(pctC(s)(r), 1), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]],
  },
  cb_timing: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'open1', label: 'Trip time TC1 (ms)', unit: 'ms', limits: r => [{ y: LIM.trip[kvOf(r.unit)], label: `Circular ${LIM.trip[kvOf(r.unit)]} ms`, sev: 'alert' }] },
      { k: 'open2', label: 'Trip time TC2 (ms)', unit: 'ms', limits: r => [{ y: LIM.trip[kvOf(r.unit)], label: `Circular ${LIM.trip[kvOf(r.unit)]} ms`, sev: 'alert' }] },
      { k: 'close', label: 'Close time (ms)', unit: 'ms', limits: [{ y: 150, label: 'Circular 150 ms', sev: 'alert' }] },
      { k: 'co1', label: 'Close-Open (ms)', unit: 'ms' },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)],
      ['Trip TC1', r => fmt(r.v.open1, 1), 'r', r => r.v.open1 > LIM.trip[kvOf(r.unit)]], ['Trip TC2', r => fmt(r.v.open2, 1), 'r', r => r.v.open2 > LIM.trip[kvOf(r.unit)]], ['Close', r => fmt(r.v.close, 1), 'r', r => r.v.close > 150], ['C-O TC1', r => fmt(r.v.co1, 1), 'r'], ['C-O TC2', r => fmt(r.v.co2, 1), 'r']],
  },
  la: {
    group: r => r.unit, groupLabel: r => unitName(r.unit, true), series: r => r.ph,
    metrics: [
      { k: 'Icorr', label: 'Icorr — 3rd harmonic resistive (µA)', unit: 'µA', limits: [{ y: 150, label: '150 µA', sev: 'alert' }, { y: 350, label: '350 µA replace', sev: 'critical' }] },
      { k: 'Ith', label: 'Ith (µA)', unit: 'µA', limits: [{ y: 150, label: '150 µA', sev: 'alert' }, { y: 350, label: '350 µA', sev: 'critical' }] },
      { k: 'Itotal', label: 'Itotal — total leakage (µA)', unit: 'µA' },
    ],
    cols: [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)], ['Season', r => esc(r.season || '')],
      ['Ith µA', r => fmt(r.v.Ith, 0), 'r', r => r.v.Ith > 150], ['Icorr µA', r => fmt(r.v.Icorr, 0), 'r', r => r.v.Icorr > 150], ['Itotal µA', r => fmt(r.v.Itotal, 0), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]],
    note: 'The circular judges the third-harmonic resistive current. The sheet records Ith and Icorr (harmonic-compensated), so the portal evaluates the higher of the two. Total current is mostly capacitive and serves as a trend only.',
  },
  dga: {
    group: r => `${r.unit}|${r.ph}|${r.pos}`, groupLabel: r => `${unitName(r.unit)}${ph(r) ? ' · ' + r.ph + '-ph' : ''} · ${r.pos}`,
    multi: true,
    metrics: [
      { k: 'hc', label: 'H₂ & hydrocarbons (ppm)', unit: 'ppm', gases: ['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2'] },
      { k: 'cox', label: 'CO & CO₂ (ppm)', unit: 'ppm', gases: ['CO', 'CO2'] },
      { k: 'C2H2', label: 'Acetylene C₂H₂ (ppm)', unit: 'ppm', gases: ['C2H2'], limits: [{ y: 1, label: 'Cond-1 1 ppm', sev: 'alert' }] },
      { k: 'BDV', label: 'BDV (kV)', unit: 'kV', gases: ['BDV'], limits: [{ y: 50, label: '50 kV', sev: 'alert' }, { y: 60, label: 'IEC good 60', sev: 'watch' }] },
      { k: 'H2O', label: 'Water (ppm)', unit: 'ppm', gases: ['H2O'], limits: [{ y: 20, label: '20 ppm', sev: 'alert' }] },
    ],
    cols: [['Equipment', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Ph', r => phase(r.ph)], ['Sample', r => esc(r.pos)], ['Date', r => fmtDate(r.date)],
      ...['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2'].map(g => [g.replace(/(\d)/g, '<sub>$1</sub>'), r => fmt(r.v[g], 0), 'r', r => r.pos !== 'OLTC' && r.v[g] > LIM.dga[g]]),
      ['BDV', r => fmt(r.v.BDV, 0), 'r', r => r.v.BDV < 50], ['H₂O', r => fmt(r.v.H2O, 0), 'r', r => r.pos !== 'OLTC' && r.v.H2O > 20],
      ['Duval', r => { if (r.pos === 'OLTC') return '<span class="dim">n/a</span>'; const d = duval1(r.v); const big = ['CH4', 'C2H4', 'C2H2'].some(g => r.v[g] > LIM.dga[g]); return d ? `<span class="tag" title="${esc(DUVAL_NAMES[d.zone])}${big ? '' : ' (gases below typical — indicative only)'}">${d.zone}${big ? '' : '*'}</span>` : '<span class="dim">—</span>'; }]],
    note: 'OLTC samples are listed for record only. Diverter oil arcs in normal service, so main-tank limits and Duval Triangle 1 do not apply to it. Duval zones marked * are indicative only: IEC 60599 applies ratios only after gases exceed typical values.',
  },
};

// ============================================================ shared renderers
function clauseCard(sr, t) {
  const r = DB.normsBySr[sr]; if (!r) return '';
  const extra = t === 'ct' ? [19, 20] : [];
  return `<div class="card"><div class="card-h"><h3>MSETCL circular — Sr ${sr}${extra.length ? ' / ' + extra.join(' / ') : ''}</h3><div class="sp"></div>${circularBtn(sr)}</div>
    <div class="card-b"><dl class="kv"><dt>Activity</dt><dd>${esc(r.activity)}</dd><dt>Frequency</dt><dd>${esc(r.existing)}${r.changed ? ` → <b>${esc(r.revised)}</b>` : ' <span class="dim">(no change in 2024)</span>'}</dd><dt>Done by</dt><dd>${esc(r.by)}</dd></dl>
    ${extra.map(s => { const x = DB.normsBySr[s]; return `<div class="note mt">Sr ${s}: ${esc(x.activity)} — <b>${esc(x.existing)}</b> by ${esc(x.by)} ${circularBtn(s, 'scan')}</div>`; }).join('')}
    ${r.limits.length ? `<div class="clause mt"><b>Limiting values & actions</b><ol>${r.limits.map(l => `<li>${esc(l)}</li>`).join('')}</ol></div>` : '<p class="note mt">Circular gives no limiting values. Per Note 1, they are to be decided with S.E., PAC.</p>'}</div></div>`;
}
function standardsCard(t) {
  const key = t === 'dga' ? ['dga', 'oil'] : [t];
  const blocks = key.map(k => DB.standards.tests[k]).filter(Boolean);
  if (!blocks.length) return '';
  return `<div class="card"><div class="card-h"><h3>Industry standards comparison</h3><div class="sp"></div><a class="btn sm" href="#/standards">All standards</a></div><div class="card-b">
    ${blocks.map(b => `<div class="note" style="font-weight:600;margin-bottom:4px">${esc(b.title)}</div>${b.items.map(stdRow).join('')}`).join('<div class="mt"></div>')}
    <p class="note mt">${esc(DB.standards.disclaimer)}</p></div></div>`;
}
const stdRow = (i) => `<div class="std-row"><div><div class="s">${esc(i.std)}</div><div class="c">${esc(i.topic)}</div></div><div><div class="v">${esc(i.value)} ${i.verify ? '<span class="tag" title="Confirm against licensed copy">verify</span>' : ''}</div><div class="cmp">vs circular: ${esc(i.vsCircular)}</div></div></div>`;

function latestTable(t, rs) {
  const cfg = TV[t];
  const sk = cfg.seriesKey || (r => `${r.unit}|${r.pos}|${r.ph}`);
  const valid = ['bushing', 'winding', 'ct'].includes(t) ? rs.filter(r => r.v.tand != null || r.v.C != null) : rs;
  const ser = groupBy(valid, sk);
  const rows = [...ser.values()].map(s => { s.sort((a, b) => a.date.localeCompare(b.date)); return { r: s[s.length - 1], s }; })
    .sort((a, b) => sortUnits(a.r.unit, b.r.unit) || (a.r.pos || '').localeCompare(b.r.pos || '') || a.r.ph.localeCompare(b.r.ph));
  return `<div class="tbl-wrap"><table class="t"><thead><tr>${cfg.cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}<th>Status</th></tr></thead><tbody>
    ${rows.map(({ r, s }) => `<tr>${cfg.cols.map(c => `<td class="${c[2] || ''} ${c[3] && c[3](r) ? 'bad' : ''}">${c[1](r, s)}</td>`).join('')}<td>${pill(statusOf(r))}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function chartCard(t, key, rs, cfg) {
  const id = 'c' + Math.random().toString(36).slice(2, 9);
  return `<div class="chart-card" data-chart="${id}" data-t="${t}" data-g="${esc(key)}"><div class="card-h"><h3>${esc(cfg.groupLabel(rs[0]))}</h3><div class="sp"></div>${pill(worst(rs.map(statusOf)))}
    <div class="seg">${cfg.metrics.map((m, i) => `<button class="${i ? '' : 'on'}" data-m="${i}" title="${esc(m.label)}">${esc(SHORT[m.k] || m.label)}</button>`).join('')}</div></div>
    <div class="chart-box"><canvas></canvas></div><div class="legend-note" data-lbl></div></div>`;
}

function drawChart(card, rs, cfg, mi) {
  const m = cfg.metrics[mi];
  card.querySelector('[data-lbl]').textContent = m.label;
  const old = Chart.getChart(card.querySelector('canvas')); if (old) old.destroy();
  const colors = PHASE_COLOR();
  let series;
  if (cfg.multi) {
    const s = [...rs].sort((a, b) => a.date.localeCompare(b.date));
    series = m.gases.map(g => ({ label: g, points: s.filter(r => r.v[g] != null).map(r => ({ x: r.date, y: r.v[g] })) }));
  } else {
    series = [...groupBy(rs, cfg.series)].map(([k, s]) => {
      s.sort((a, b) => a.date.localeCompare(b.date));
      const f = m.derived ? m.derived(s) : (r => r.v[m.k]);
      return { label: k, color: colors[k], points: s.map(r => ({ x: r.date, y: f(r), meta: r.season || (r.v.temp != null ? `${r.v.temp} °C` : '') })).filter(p => p.y != null) };
    }).sort((a, b) => 'RYBN'.indexOf(a.label) - 'RYBN'.indexOf(b.label));
  }
  series = series.filter(s => s.points.length);
  if (!series.length) { card.querySelector('.chart-box').innerHTML = '<div class="empty">No values for this metric</div>'; return; }
  const lim = typeof m.limits === 'function' ? m.limits(rs[0]) : (m.limits || []);
  const sevColor = { alert: getComputedStyle(document.documentElement).getPropertyValue('--alert'), critical: getComputedStyle(document.documentElement).getPropertyValue('--crit'), watch: getComputedStyle(document.documentElement).getPropertyValue('--watch') };
  lineChart(card.querySelector('canvas'), { series, limits: lim.map(l => ({ ...l, color: sevColor[l.sev] })), yLabel: m.unit, unit: m.unit });
}

function wireCharts(root, t, groups) {
  const cfg = TV[t];
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); const g = groups.get(e.target.dataset.g); drawChart(e.target, g, cfg, 0); }
  }, { rootMargin: '200px' });
  $$('[data-chart]', root).forEach(card => {
    io.observe(card);
    $$('.seg button', card).forEach(b => b.onclick = () => {
      $$('.seg button', card).forEach(x => x.classList.toggle('on', x === b));
      const c = card.querySelector('.chart-box'); if (!c.querySelector('canvas')) c.innerHTML = '<canvas></canvas>';
      drawChart(card, groups.get(card.dataset.g), cfg, Number(b.dataset.m));
    });
  });
}

function crmSection(rs) {
  const out = [];
  for (const [kv, g] of [...groupBy(rs.filter(r => r.v.R != null), r => kvOf(r.unit))].sort((a, b) => b[0] - a[0])) {
    const bays = [...new Set(g.map(r => r.unit))].sort(sortUnits);
    out.push({ kv, bays, g, id: 'crm' + kv });
  }
  return out;
}

function findingList(fs, max) {
  if (!fs.length) return '<div class="empty">No findings — all evaluated values within limits.</div>';
  const list = max ? fs.slice(0, max) : fs;
  return list.map(f => `<div class="finding"><div>${pill(f.sev)}</div><div><div class="ttl">${esc(f.title)}</div><div class="det">${esc(f.where)}${f.detail ? ' — ' + esc(f.detail) : ''}</div>
    ${f.action ? `<div class="act">${esc(f.action)}</div>` : ''}
    <div class="meta"><span class="tag b">${esc(TESTS[f.t]?.short || f.t)}</span><span class="tag">${esc(f.basis)}</span><span class="tag">${fmtDate(f.date)}</span></div></div>
    <div>${f.unit && f.unit !== '*' ? `<a class="btn sm" href="#/eq/${f.unit}">Open</a>` : `<a class="btn sm" href="#/test/${f.t}">Open</a>`}</div></div>`).join('')
    + (max && fs.length > max ? `<div class="card-b"><a href="#/findings">View all ${fs.length} findings →</a></div>` : '');
}

function renderTestBody(t, rs, scoped) {
  const cfg = TV[t];
  let html = '';
  if (cfg?.note) html += `<div class="callout mb">${esc(cfg.note)}</div>`;
  if (t === 'cb_crm') {
    const secs = crmSection(rs);
    html += `<div class="grid ${scoped ? '' : 'g2'} mb">${secs.map(s => `<div class="chart-card"><div class="card-h"><h3>${s.kv} kV breakers — contact resistance per pole</h3></div><div class="chart-box" style="height:${scoped ? 230 : 280}px"><canvas id="${s.id}"></canvas></div><div class="legend-note">Dashed line: circular limit ${LIM.crm[s.kv]} µΩ (Sr 24). Test current ≈ ${fmt(Math.round(s.g.reduce((a, r) => a + (r.v.I || 0), 0) / s.g.length), 0)} A DC.</div></div>`).join('')}</div>`;
    const cols = [['Bay', r => `<a href="#/eq/${r.unit}">${unitName(r.unit)}</a>`], ['Feeder', r => `<span class="dim">${esc(bayTitle(r.unit))}</span>`], ['Ph', r => phase(r.ph)], ['Tested', r => fmtDate(r.date)], ['CRM µΩ', r => fmt(r.v.R, 1), 'r', r => r.v.R > LIM.crm[kvOf(r.unit)]], ['Current A', r => fmt(r.v.I, 1), 'r'], ['Remark', r => `<span class="dim">${esc(r.rem)}</span>`]];
    const rows = [...rs].sort((a, b) => sortUnits(a.unit, b.unit) || a.ph.localeCompare(b.ph));
    html += `<div class="card"><div class="card-h"><h3>Latest readings</h3></div><div class="tbl-wrap"><table class="t"><thead><tr>${cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}<th>Status</th></tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c[2] || ''} ${c[3] && c[3](r) ? 'bad' : ''}">${c[1](r)}</td>`).join('')}<td>${pill(statusOf(r))}</td></tr>`).join('')}</tbody></table></div></div>`;
    return { html, after: (root) => secs.forEach(s => { const c = PHASE_COLOR(); barChart(root.querySelector('#' + s.id), { labels: s.bays, yLabel: 'µΩ', limits: [{ y: LIM.crm[s.kv], label: `Circular ${LIM.crm[s.kv]} µΩ` }], series: ['R', 'Y', 'B'].map(p => ({ label: p, color: c[p], data: s.bays.map(b => s.g.find(r => r.unit === b && r.ph === p)?.v.R ?? null) })) }); }) };
  }
  const groups = groupBy(rs, cfg.group);
  const keys = [...groups.keys()].sort((a, b) => { const A = groups.get(a)[0], B = groups.get(b)[0]; return sortUnits(A.unit, B.unit) || a.localeCompare(b); });
  html += `<div class="card mb"><div class="card-h"><h3>Latest results</h3><div class="sp"></div><span class="note">${rs.length} records · ${keys.length} ${keys.length === 1 ? 'group' : 'groups'}</span></div>${latestTable(t, rs)}</div>`;
  html += `<h2 class="mt">Trends</h2><div class="grid gauto">${keys.map(k => chartCard(t, k, groups.get(k), cfg)).join('')}</div>`;
  return { html, after: (root) => wireCharts(root, t, groups) };
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
  const cell = (u, t) => DB.records.some(r => r.unit === u && r.t === t) ? `<a href="#/eq/${u}?t=${t}">${pill(unitStatus(u, t), SEV_LABEL[unitStatus(u, t)])}</a>` : '<span class="dim">·</span>';
  const covered = new Set(Object.values(TESTS).map(x => x.sr).concat([19]));
  const sub = DB.norms.rows.filter(r => !['LINE'].includes(r.eq) && !(r.activity.includes('132 kV') || r.activity.includes('HV Breaker') || r.activity.includes('Power Transformer')));
  view().innerHTML = `
    <h1>${esc(DB.site.substation.name)}</h1>
    <p class="lede">Diagnostic test health for FY ${esc(DB.site.substation.fy)}, as of ${fmtDate(DB.today)}. Results are evaluated against MSETCL circular No. 06961 (18 Oct 2024) and cross-checked with IEC / IEEE practice.</p>
    <div class="kpis">
      <div class="kpi crit"><a href="#/findings?sev=critical"><div class="l">Critical</div><div class="v">${n('critical')}</div><div class="d">act immediately</div></a></div>
      <div class="kpi alert"><a href="#/findings?sev=alert"><div class="l">Alerts</div><div class="v">${n('alert')}</div><div class="d">beyond circular limit</div></a></div>
      <div class="kpi watch"><a href="#/findings?sev=watch"><div class="l">Watch-list</div><div class="v">${n('watch')}</div><div class="d">trend / industry flags</div></a></div>
      <div class="kpi"><a href="#/schedule"><div class="l">Overdue tests</div><div class="v" style="color:var(--crit)">${od.length}</div><div class="d">${due.length} more due ≤ 120 days</div></a></div>
      <div class="kpi"><a href="#/equipment"><div class="l">Equipment monitored</div><div class="v">${units.length}</div><div class="d">${tfs.length} transformers/reactor · ${bays.length} bays</div></a></div>
      <div class="kpi"><a href="#/data"><div class="l">Test records</div><div class="v">${DB.records.length.toLocaleString('en-IN')}</div><div class="d">${DB.site.issues.length} data-quality notes</div></a></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h2>Needs attention</h2><div class="sp"></div><a class="btn sm" href="#/findings">All findings</a></div>${findingList(fs.filter(f => SEV[f.sev] >= 3), 7)}</div>
      <div class="card"><div class="card-h"><h2>Test schedule</h2><div class="sp"></div><a class="btn sm" href="#/schedule">Full schedule</a></div>${schedTable([...od, ...due].slice(0, 12), true)}</div>
    </div>
    <div class="card mt"><div class="card-h"><h2>Health matrix</h2><div class="sp"></div><span class="note">worst open finding per equipment & test · click a cell</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Equipment</th>${tests.map(t => `<th><a href="#/test/${t}">${esc(TESTS[t].short)}</a></th>`).join('')}</tr></thead><tbody>
      ${[...tfs, ...bays].map(u => `<tr><td><a href="#/eq/${u}"><b>${esc(unitName(u))}</b></a> <span class="dim">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</span></td>${tests.map(t => `<td>${cell(u, t)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="card mt"><div class="card-h"><h2>Circular coverage</h2><div class="sp"></div><span class="note">which substation tests from the circular already have data here</span></div>
      <div class="card-b"><div class="chips">${sub.map(r => `<span class="tag ${covered.has(r.sr) ? 'b' : ''}" title="${esc(r.existing)}">${covered.has(r.sr) ? '✓ ' : ''}Sr ${r.sr} ${esc(r.activity)}</span>`).join('')}</div>
      <p class="note mt">Highlighted = data in this portal. The rest (IR/PI, SFRA, DFR, winding resistance, PT, CVT, DCRM, SF₆ dew point, relays, battery, thermovision, earth resistance) are not yet in the Google Sheet. Each needs a data-entry form once the database is connected.</p></div></div>`;
}

function schedTable(list, compact) {
  if (!list.length) return '<div class="empty">Nothing overdue or due in the next 120 days.</div>';
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>Test</th><th>Equipment</th>${compact ? '' : '<th>Ph / sample</th><th>Circular</th>'}<th>Last done</th><th>Due</th><th>Status</th></tr></thead><tbody>
  ${list.map(s => `<tr><td><a href="#/test/${s.t}">${esc(TESTS[s.t].short)}</a></td><td><a href="#/eq/${s.unit}">${esc(unitName(s.unit))}</a>${compact && (s.ph || s.pos) ? ` <span class="dim">${esc([s.ph && s.ph !== '-' ? s.ph : '', s.pos].filter(Boolean).join(' '))}</span>` : ''}</td>
  ${compact ? '' : `<td>${phase(s.ph)} ${esc(s.pos)}</td><td><button class="btn sm" data-circ="${s.sr}">Sr ${s.sr} · ${s.months} mo</button></td>`}
  <td class="num">${fmtDate(s.last)}</td><td class="num">${fmtDate(s.due)}</td>
  <td>${s.status === 'overdue' ? pill('critical', `Overdue ${-s.days} d`) : s.status === 'due' ? pill('watch', `In ${s.days} d`) : pill('ok', 'Scheduled')}</td></tr>`).join('')}</tbody></table></div>`;
}

function vSchedule(q) {
  setCrumbs([['Overview', '#/'], ['Schedule']]);
  const f = q.get('f') || 'open';
  const list = SCHED.filter(s => f === 'all' || (f === 'open' ? s.status !== 'ok' : s.status === f));
  view().innerHTML = `<h1>Test schedule</h1><p class="lede">Next due date = last test date + circular frequency (Sr 1 bushing yearly · Sr 3 winding 2-yearly · Sr 8 DGA ½-yearly · Sr 17 LA ½-yearly · Sr 18/19 CT 2-yearly at 400 kV, yearly at 220 kV · Sr 24/26 CB 2-yearly). "Due" means within 120 days, the same window as the sheet's Pending Tests tab.</p>
    <div class="row-flex mb"><div class="chips">${[['open', 'Overdue + due'], ['overdue', 'Overdue'], ['due', 'Due ≤ 120 d'], ['all', 'All']].map(([k, l]) => `<a class="chip ${f === k ? 'on' : ''}" href="#/schedule?f=${k}">${l}</a>`).join('')}</div><span class="note">${list.length} items</span></div>
    <div class="card">${schedTable(list, false)}</div>
    <p class="note mt">CT 220 kV bays are taken as "Major/Important S/s" (Sr 19, yearly), matching the sheet's due dates. Per Note 2, the zonal CE confirms this classification.</p>`;
}

function vEquipment() {
  setCrumbs([['Equipment']]);
  const units = [...new Set(DB.records.map(r => r.unit))];
  const allBays = Object.keys(DB.site.bays).sort(sortUnits);
  const tile = (u) => {
    const ts = testsForUnit(u), st = unitStatus(u), last = DB.records.filter(r => r.unit === u).map(r => r.date).sort().pop();
    return `<div class="tile ${ts.length ? '' : 'off'}" onclick="location.hash='#/eq/${u}'"><div class="row"><span class="n">${esc(unitName(u))}</span><span style="flex:1"></span>${ts.length ? pill(st) : pill('none')}</div>
      <div class="m">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</div>
      <div class="row">${ts.map(t => `<span class="tag">${esc(TESTS[t].short)}</span>`).join('') || '<span class="note">no tests recorded</span>'}</div>
      ${last ? `<div class="m">Last test ${fmtDate(last)}</div>` : ''}</div>`;
  };
  const tfs = ['ICT1', 'ICT2', 'SPARE_ICT', 'BUS_REACTOR'];
  view().innerHTML = `<h1>Equipment</h1><p class="lede">Transformers and the reactor are listed by unit; switchyard equipment (CT, CB, LA) by bay. Bays without records are dimmed. Future bays appear as reserved in the sheet.</p>
    <h2>Transformers & reactor</h2><div class="tiles mb">${tfs.map(tile).join('')}</div>
    <h2 class="mt">400 kV bays</h2><div class="tiles mb">${allBays.filter(b => kvOf(b) === 400).map(tile).join('')}</div>
    <h2 class="mt">220 kV bays</h2><div class="tiles">${allBays.filter(b => kvOf(b) === 220).map(tile).join('')}</div>`;
}

function vUnit(u, q) {
  const ts = testsForUnit(u); const sel = q.get('t') && ts.includes(q.get('t')) ? q.get('t') : ts[0];
  setCrumbs([['Equipment', '#/equipment'], [unitName(u)]]);
  const info = isTF(u) ? DB.site.units[u] : null;
  const fs = findings().filter(f => f.unit === u || (f.unit === '*' && f.recIds.some(id => DB.records[id].unit === u)));
  const sch = SCHED.filter(s => s.unit === u);
  view().innerHTML = `<div class="row-flex"><h1>${esc(unitName(u, true))}</h1>${pill(unitStatus(u))}</div>
    <p class="lede">${info ? `${esc(info.rating)} · Make ${esc(info.make || '—')} · Commissioned ${info.commissioned ? fmtDate(info.commissioned) : '—'}${info.serials ? ' · Sr. ' + Object.entries(info.serials).map(([p, s]) => `${p}: ${esc(s)}`).join(', ') : ''}` : `${kvOf(u)} kV bay`}</p>
    ${ts.length ? `<div class="grid g2 mb"><div class="card"><div class="card-h"><h2>Findings</h2></div>${findingList(fs)}</div><div class="card"><div class="card-h"><h2>Schedule</h2></div>${schedTable(sch, true)}</div></div>
    <div class="row-flex mb"><div class="chips">${ts.map(t => `<a class="chip ${t === sel ? 'on' : ''}" href="#/eq/${u}?t=${t}">${esc(TESTS[t].name)} ${SEV[unitStatus(u, t)] >= 2 ? '●' : ''}</a>`).join('')}</div><div style="flex:1"></div>${circularBtn(sel === 'ct' && kvOf(u) === 220 ? 19 : TESTS[sel].sr)}</div>
    <div id="tb"></div>` : '<div class="card empty">No test records for this bay in the sheet yet.</div>'}`;
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
  view().innerHTML = `<h1>${esc(T.name)}</h1><p class="lede">${esc(T.eq)} · ${units.length} ${units.length === 1 ? 'unit' : 'units'} · ${recs(t).length} records</p>
    <div class="grid g2 mb">${clauseCard(t === 'ct' ? 18 : T.sr, t)}${standardsCard(t)}</div>
    ${fs.length ? `<div class="card mb"><div class="card-h"><h2>Findings</h2><div class="sp"></div><span class="note">${fs.length}</span></div>${findingList(fs, 6)}</div>` : ''}
    <div class="row-flex mb"><div class="chips">${t === 'dga' ? '' : `<a class="chip ${f === 'all' ? 'on' : ''}" href="#/test/${t}">All</a>`}${kvChips ? `<a class="chip ${f === '400' ? 'on' : ''}" href="#/test/${t}?u=400">400 kV</a><a class="chip ${f === '220' ? 'on' : ''}" href="#/test/${t}?u=220">220 kV</a>` : ''}
      ${units.map(u => `<a class="chip ${f === u ? 'on' : ''}" href="#/test/${t}?u=${u}">${esc(unitName(u))}</a>`).join('')}</div></div>
    <div id="tb"></div>`;
  const body = renderTestBody(t, rs, false);
  $('#tb').innerHTML = body.html; body.after($('#tb'));
}

function vTests() {
  setCrumbs([['Tests']]);
  view().innerHTML = `<h1>Tests</h1><p class="lede">Test-wise view across all equipment, with the governing circular clause and the industry comparison.</p>
    <div class="tiles">${Object.values(TESTS).map(T => { const fs = findings().filter(f => f.t === T.key); return `<div class="tile" onclick="location.hash='#/test/${T.key}'"><div class="row"><span style="font-size:18px">${T.icon}</span><span class="n">${esc(T.name)}</span><span style="flex:1"></span>${pill(fs.length ? worst(fs.map(f => f.sev)) : 'ok')}</div><div class="m">${esc(T.eq)} · circular Sr ${T.sr}</div><div class="m">${recs(T.key).length} records · ${unitsFor(T.key).length} units · ${fs.length} findings</div></div>`; }).join('')}</div>`;
}

function vFindings(q) {
  setCrumbs([['Findings']]);
  const sev = q.get('sev') || 'all', tt = q.get('t') || 'all';
  const fs = findings().filter(f => (sev === 'all' || f.sev === sev) && (tt === 'all' || f.t === tt));
  const link = (k, v) => { const p = new URLSearchParams(q); p.set(k, v); return '#/findings?' + p; };
  view().innerHTML = `<h1>Engineering findings</h1><p class="lede">Generated automatically from the test data. <b>Critical / Alert</b> means a circular limit is breached. <b>Watch</b> means an industry benchmark or an adverse trend, still inside the circular. <b>Info</b> marks a measurement or data-quality check. Each finding names its basis.</p>
    <div class="row-flex mb"><div class="chips">${['all', 'critical', 'alert', 'watch', 'info'].map(s => `<a class="chip ${sev === s ? 'on' : ''}" href="${link('sev', s)}">${s === 'all' ? 'All' : SEV_LABEL[s]} (${findings().filter(f => s === 'all' || f.sev === s).length})</a>`).join('')}</div>
    <select class="sel" onchange="location.hash='${link('t', '__')}'.replace('__',this.value)"><option value="all">All tests</option>${Object.values(TESTS).map(T => `<option value="${T.key}" ${tt === T.key ? 'selected' : ''}>${esc(T.name)}</option>`).join('')}</select></div>
    <div class="card">${findingList(fs)}</div>`;
}

function vNorms(q) {
  setCrumbs([['MSETCL norms']]);
  const eq = q.get('eq') || 'all', tab = q.get('tab') || 'rows', s = (q.get('q') || '').toLowerCase();
  const eqs = [...new Map(DB.norms.rows.map(r => [r.eq, r.equipment]))];
  const rows = DB.norms.rows.filter(r => (eq === 'all' || r.eq === eq) && (!s || JSON.stringify(r).toLowerCase().includes(s)));
  const m = DB.norms.meta;
  const link = (k, v) => { const p = new URLSearchParams(q); p.set(k, v); return '#/norms?' + p; };
  view().innerHTML = `<h1>MSETCL test-frequency norms</h1>
    <p class="lede">Circular ${esc(m.circularNo)} dated ${fmtDate(m.date)} — ${esc(m.title)}. Supersedes ${esc(m.ref)}. Every row is transcribed from the scanned original and links back to it.</p>
    <div class="row-flex mb"><div class="seg">${[['rows', 'All 51 activities'], ['notes', 'Notes'], ['errata', `Corrections to old JSON (${DB.norms.errata.length})`]].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="location.hash='${link('tab', k)}'">${l}</button>`).join('')}</div>
      <div style="flex:1"></div><button class="btn sm" data-cover>📄 Covering letter</button></div>
    <div id="nb"></div>`;
  const nb = $('#nb');
  $('[data-cover]').onclick = () => modal('Circular — covering letter', '<div class="scan-wrap"><img src="assets/circular/page-1.jpg" alt="Circular page 1"></div>');
  if (tab === 'notes') {
    nb.innerHTML = `<div class="card"><div class="card-b"><ol>${DB.norms.notes.map(n => `<li style="margin:6px 0">${esc(n)}</li>`).join('')}</ol><div class="scan-wrap mt"><canvas id="notesCv"></canvas></div></div></div>`;
    const n = m.notesScan; drawSnippet($('#notesCv'), { scan: { page: n.page, hy0: 106, hy1: 135, gy0: n.y0, gy1: n.y1, y0: n.y0, y1: n.y1 } });
    return;
  }
  if (tab === 'errata') {
    nb.innerHTML = `<div class="callout warn mb">The <code>msetcl_test_frequency_2024.json</code> handed over earlier has ${DB.norms.errata.length} mismatches against the signed circular. This portal uses the corrected transcription.</div>
      <div class="card"><table class="t"><thead><tr><th>Sr</th><th>Activity</th><th>Correction</th><th></th></tr></thead><tbody>${DB.norms.errata.map(e => `<tr><td class="num">${e.sr}</td><td>${esc(DB.normsBySr[e.sr].activity)}</td><td>${esc(e.issue)}</td><td>${circularBtn(e.sr, 'Verify')}</td></tr>`).join('')}</tbody></table></div>`;
    return;
  }
  nb.innerHTML = `<div class="row-flex mb"><div class="chips"><a class="chip ${eq === 'all' ? 'on' : ''}" href="${link('eq', 'all')}">All</a>${eqs.map(([k, n]) => `<a class="chip ${eq === k ? 'on' : ''}" href="${link('eq', k)}">${esc(n)}</a>`).join('')}</div>
    <input class="search" placeholder="Search activity, limit, team…" value="${esc(q.get('q') || '')}" onchange="location.hash='${link('q', '__')}'.replace('__',encodeURIComponent(this.value))"></div>
    <div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th>Sr</th><th>Activity</th><th>Frequency</th><th>Done by</th><th style="min-width:340px">Limiting values & actions</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="num"><b>${r.sr}</b></td><td><b>${esc(r.activity)}</b><div class="dim" style="font-size:12px">${esc(r.equipment)}</div>${r.test ? `<a class="tag b" href="#/test/${r.test}">data in portal →</a>` : ''}</td>
      <td>${r.changed ? `<s class="dim">${esc(r.existing)}</s><br><b>${esc(r.revised)}</b> <span class="tag chg">revised</span>` : esc(r.existing)}${r.remarkAdded ? ' <span class="tag chg">remark added</span>' : ''}</td>
      <td>${esc(r.by)}</td><td>${r.limits.length ? `<ol style="margin:0;padding-left:18px">${r.limits.map(l => `<li>${esc(l)}</li>`).join('')}</ol>` : '<span class="dim">— (decide with S.E., PAC)</span>'}</td>
      <td>${circularBtn(r.sr, 'Scan')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No match</td></tr>'}</tbody></table></div></div>`;
}

function vStandards() {
  setCrumbs([['Industry standards']]);
  const tmap = { bushing: 1, winding: 3, ct: 18, cb_crm: 24, cb_timing: 26, la: 17, dga: 8, oil: 10 };
  view().innerHTML = `<h1>Circular vs industry standards</h1><p class="lede">${esc(DB.standards.disclaimer)}</p>
    <div class="callout warn mb"><b>Biggest gaps vs present industry practice.</b> (1) Fixed absolute limits, where the industry trends each asset against its own baseline and its sister phases. (2) Generic temperature correction applied to bushings. (3) DGA still on the IEEE C57.104-<b>2008</b> table, with no rate-of-change rule and no OLTC-specific method. (4) No pole-discrepancy limit for breakers. (5) A 400 kV CRM limit that every healthy breaker here fails.</div>
    <div class="grid g2">${Object.entries(DB.standards.tests).map(([k, b]) => `<div class="card"><div class="card-h"><h3>${esc(b.title)}</h3><div class="sp"></div>${tmap[k] ? circularBtn(tmap[k], 'Circular') : ''}</div><div class="card-b">${b.items.map(stdRow).join('')}</div></div>`).join('')}</div>`;
}

function vData() {
  setCrumbs([['Data & sources']]);
  const s = DB.site.substation;
  const cf = DB.site.tempCorrection;
  const counts = Object.keys(TESTS).map(t => [t, recs(t).length]);
  view().innerHTML = `<h1>Data & sources</h1><p class="lede">Source: <code>${esc(s.source)}</code>, extracted ${fmtDate(s.extracted)} by <code>tools/extract_workbook.py</code>. To refresh, export the Google Sheet as .xlsx and re-run the script. Nothing is typed by hand.</p>
    <div class="grid g2 mb"><div class="card"><div class="card-h"><h2>Records by test</h2></div><table class="t"><tbody>${counts.map(([t, n]) => `<tr><td><a href="#/test/${t}">${esc(TESTS[t].name)}</a></td><td class="r num">${n}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><div class="card-h"><h2>Temperature correction in the sheet</h2></div><div class="card-b"><p class="note">Hidden "Correction Factor" tab: tan δ₂₀ = tan δ ÷ K. Example: K = ${cf.find(x => x[0] === 40)?.[1] ?? '—'} at 40 °C and ${cf.find(x => x[0] === 50)?.[1] ?? '—'} at 50 °C.</p>
      <div class="callout warn">The sheet uses one table for everything. IEEE C57.152 accepts a generic table for <i>winding</i> insulation only, and even there prefers individual-temperature-response correction (DFR-based). For bushings, use the maker's curve: for an OIP bushing at 42 °C the generic K removes about 38 % of the reading. The portal therefore judges bushings and CTs on the measured value.</div></div></div></div>
    <div class="card"><div class="card-h"><h2>Data-quality notes (${DB.site.issues.length})</h2><div class="sp"></div><span class="note">text found in numeric cells</span></div>
    <table class="t"><thead><tr><th>Sheet ! row</th><th>Field</th><th>Text</th></tr></thead><tbody>${DB.site.issues.map(i => `<tr><td class="mono">${esc(i.src)}</td><td>${esc(i.field)}</td><td>${esc(i.text)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card mt"><div class="card-b"><h3>Also noticed in the workbook</h3><ul class="note">
      <li>"PT Tan D Results" and the bushing columns in "Pending Tests" show <code>#REF!</code>: their source ranges were deleted.</li>
      <li>"220 kV LA LCM Results" is empty. The 220 kV LA readings sit in an unnamed sheet "w" (only bay 204 has data).</li>
      <li>Placeholder remarks ("hello", stray numbers like "130") are left in the CRM remark columns.</li>
      <li>Corrected tan δ is stored as a fraction (0.0021 = 0.21 %) beside measured values in %. The portal normalises everything to %.</li></ul></div></div>`;
}

function vAbout() {
  setCrumbs([['Roadmap']]);
  view().innerHTML = `<h1>About & roadmap</h1><div class="grid g2"><div class="card pad"><h2>What this is</h2><p>A static web portal (no server) over the Karjat diagnostic sheet. It brings together the corrected MSETCL 2024 circular (with scanned extracts), an industry-standards comparison, and a rule engine that turns readings into findings.</p>
    <h3 class="mt">Layout</h3><pre class="mono note" style="white-space:pre-wrap">data/karjat.json     ← tools/extract_workbook.py (xlsx)
data/norms.json      ← circular, transcribed + scan coordinates
data/standards.json  ← IEC / IEEE / CIGRE references
js/data.js           ← data layer (swap JSON → database here)
js/rules.js          ← engineering rules (each cites its basis)
js/app.js, js/ui.js  ← views, charts, circular viewer</pre></div>
    <div class="card pad"><h2>Next steps</h2><ol>
    <li><b>Database</b> (Supabase/Postgres): tables <code>substation, equipment, test_record, attachment</code>. <code>js/data.js</code> already isolates loading.</li>
    <li><b>Data-entry forms</b> per test, with live limit checks, and attach the test-kit PDF report to each record.</li>
    <li><b>Remaining circular tests</b>: IR/PI, SFRA, DFR, winding resistance, PT, CVT, DCRM, SF₆ dew point, relays, battery, thermovision, earth resistance.</li>
    <li><b>Multi-substation</b>: one data file per S/s, then circle/zone roll-ups.</li>
    <li><b>Rule settings</b> editable by S.E. PAC (Note 1 of the circular), with versioning.</li>
    <li>DGA: IEEE C57.104-2019 Level 1/2/3 tables with rate-of-change, Duval Triangle 2 for OLTC, Duval Pentagon.</li></ol></div></div>`;
}

function vNotFound() { setCrumbs([['Not found']]); view().innerHTML = '<div class="empty">Page not found. <a href="#/">Go to overview</a></div>'; }

// ============================================================ router
function route() {
  destroyCharts();
  $$('.modal-bg').forEach(m => m.remove());
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?'); const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  $$('.nav a').forEach(a => a.classList.toggle('on', (a.getAttribute('href') === '#/' + (p[0] || '')) || (p[0] === 'test' && a.getAttribute('href') === '#/test/' + p[1])));
  $('#sb').classList.remove('open');
  if (!p.length) vOverview();
  else if (p[0] === 'equipment') vEquipment();
  else if (p[0] === 'eq') vUnit(decodeURIComponent(p[1]), q);
  else if (p[0] === 'tests') vTests();
  else if (p[0] === 'test') vTest(p[1], q);
  else if (p[0] === 'findings') vFindings(q);
  else if (p[0] === 'schedule') vSchedule(q);
  else if (p[0] === 'norms') vNorms(q);
  else if (p[0] === 'standards') vStandards();
  else if (p[0] === 'data') vData();
  else if (p[0] === 'about') vAbout();
  else vNotFound();
  window.scrollTo(0, 0);
}

function navCounts() {
  const fs = findings();
  $('#nc-find').textContent = fs.filter(f => SEV[f.sev] >= 3).length || '';
  $('#nc-sched').textContent = SCHED.filter(s => s.status === 'overdue').length || '';
  $('#nav-tests').innerHTML = Object.values(TESTS).map(T => `<a href="#/test/${T.key}"><span class="ic">${T.icon}</span>${esc(T.short)}</a>`).join('');
  $('#site-name').textContent = DB.site.substation.name;
  $('#site-fy').textContent = 'FY ' + DB.site.substation.fy + ' · ' + DB.records.length + ' records';
}

function theme() {
  const k = 'ehv-theme'; let t = null; try { t = localStorage.getItem(k); } catch { }
  if (t) document.documentElement.dataset.theme = t;
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx;
    try { localStorage.setItem(k, nx); } catch { }
    route();
  };
}

(async function main() {
  theme();
  $('#menuBtn').onclick = () => $('#sb').classList.toggle('open');
  try {
    await loadAll();
    run(); SCHED = schedule();
    navCounts();
    window.addEventListener('hashchange', route);
    route();
  } catch (e) {
    view().innerHTML = `<div class="callout warn"><b>Could not load data.</b> ${esc(e.message)}<br>Open the portal through a web server (GitHub Pages, or <code>python3 -m http.server</code> in this folder), not directly as a file.</div>`;
    console.error(e);
  }
})();
