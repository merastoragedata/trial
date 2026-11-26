// Small DOM, chart and circular-viewer helpers.
import { DB, fmtDate, toDate } from './data.js?v=20261126.1152';
import { SEV_LABEL } from './rules.js?v=20261126.1152';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Shape-coded status (readable without colour): ◆ critical · ▲ alert · ● watch · ✓ normal · i info · – no data
export const SEV_ICON = { critical: '◆', alert: '▲', watch: '●', ok: '✓', info: 'i', none: '–' };
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const chem = (s) => String(s ?? '').replace(/\b(C2H2|C2H4|C2H6|CH4|CO2|H2O|H2)\b/g, m => m.replace(/\d/g, d => SUB[d]));
export const pill = (sev, text) => `<span class="pill s-${sev}"><i aria-hidden="true">${SEV_ICON[sev] || ''}</i>${esc(text ?? SEV_LABEL[sev])}</span>`;
export const sevIcon = (sev) => `<span class="sev-ic s-${sev}" title="${SEV_LABEL[sev]}">${SEV_ICON[sev]}</span>`;
export const phase = (p) => p && p !== '-' ? `<span class="ph ${/^[RYBN]$/.test(p) ? p : 'x'}">${esc(p)}</span>` : '<span class="dim">—</span>';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------- charts
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export const PHASE_COLOR = () => ({ R: css('--R'), Y: css('--Y'), B: css('--B'), N: css('--N'), '-': css('--brand-2') });
const EXTRA = ['#0f766e', '#7c3aed', '#c2410c', '#be185d', '#4d7c0f', '#0369a1', '#a16207', '#475569'];
let charts = [];
export function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }

/**
 * lineChart(canvas, {series:[{label, color, points:[{x:iso,y,meta}]}], limits:[{y,label,color}], yLabel, bars})
 */
// Shades limit zones behind the data (ISA-101 style: plain normal band, tinted abnormal bands).
const zonePlugin = {
  id: 'zones',
  beforeDatasetsDraw(chart) {
    const z = chart.options.plugins.zones?.bands; if (!z?.length) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    ctx.save();
    for (const b of z) {
      const y0 = y.getPixelForValue(b.to ?? y.max), y1 = y.getPixelForValue(b.from ?? y.min);
      const t = Math.max(a.top, Math.min(y0, y1)), bt = Math.min(a.bottom, Math.max(y0, y1));
      if (bt <= t) continue;
      ctx.fillStyle = b.color; ctx.fillRect(a.left, t, a.right - a.left, bt - t);
    }
    ctx.restore();
  },
};
if (window.Chart) Chart.register(zonePlugin);
const hexA = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
/** Zone bands from limits: upper limits shade above, lower limits ({lo:true}) shade below. */
export function bandsFrom(limits) {
  const col = { watch: css('--watch'), alert: css('--alert'), critical: css('--crit') };
  const up = limits.filter(l => !l.lo).sort((a, b) => a.y - b.y), lo = limits.filter(l => l.lo);
  const out = up.map((l, i) => ({ from: l.y, to: up[i + 1]?.y, color: hexA(col[l.sev] || col.alert, 0.09) }));
  lo.forEach(l => out.push({ to: l.y, color: hexA(col[l.sev] || col.alert, 0.09) }));
  return out;
}

/** A round step near 20 % of the average (1, 2, 2.5, 5 × 10^n). */
export function niceStep(x) {
  if (!(x > 0) || !isFinite(x)) return null;
  const e = Math.floor(Math.log10(x)), f = x / 10 ** e;
  const n = [1, 2, 2.5, 5, 10].reduce((a, b) => Math.abs(b - f) < Math.abs(a - f) ? b : a);
  return n * 10 ** e;
}
/** Least-squares trend through (date, value) points; returns [{x,y},{x,y}] and slope per year. */
export function trendLine(pts) {
  if (pts.length < 3) return null;
  const xs = pts.map(p => +toDate(p.x) / 864e5), ys = pts.map(p => p.y), n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); if (!sxx) return null;
  const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx, a = my - b * mx;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return { pts: [{ x: x0 * 864e5, y: a + b * x0 }, { x: x1 * 864e5, y: a + b * x1 }], perYear: b * 365.25 };
}
/** Average-reference lines: mean of the readings to date and ±20 % steps of it.
 *  ±20 % is always shown; further steps (±40, 60, 80, 100 % …) wherever the data reaches. */
export function avgRefs(ys, limits = []) {
  ys = ys.filter(y => y != null && isFinite(y));
  if (!ys.length) return [];
  const avg = ys.reduce((a, b) => a + b, 0) / ys.length, base = Math.abs(avg);
  if (base < 1e-9) return [];
  const lo = Math.min(...ys), hi = Math.max(...ys), out = [{ k: 0, y: avg, label: `avg ${+avg.toFixed(Math.abs(avg) < 1 ? 3 : 1)}` }];
  for (let k = 1; k <= 25; k++) {
    const up = avg + base * 0.2 * k, dn = avg - base * 0.2 * k;
    if (k === 1 || up <= hi) out.push({ k, y: up, label: `+${20 * k}%` });
    if (k === 1 || dn >= lo) out.push({ k: -k, y: dn, label: `−${20 * k}%` });
    if (up > hi && dn < lo) break;
  }
  return out;
}

// Draws limit labels at the right end of each limit line and the value of the latest point.
const labelPlugin = {
  id: 'labels',
  afterDatasetsDraw(chart) {
    if (chart.config.type !== 'line') return;
    const { ctx, chartArea: a } = chart; ctx.save();
    ctx.font = '600 11.5px Inter, sans-serif';
    const boxes = [], hit = (b) => boxes.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
    chart.data.datasets.forEach((d, i) => {
      const meta = chart.getDatasetMeta(i); if (meta.hidden) return;
      if (d.isLimit) { const p = meta.data[1]; if (!p || p.y < a.top || p.y > a.bottom) return; ctx.fillStyle = d.borderColor; ctx.textAlign = 'right'; const w = ctx.measureText(d.label).width; ctx.fillText(d.label, a.right - 4, p.y - 4); boxes.push({ x0: a.right - 6 - w, x1: a.right, y0: p.y - 16, y1: p.y }); return; }
      if (d.isTrend) { const p = meta.data[1]; if (!p) return; ctx.save(); ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = d.borderColor; ctx.textAlign = 'right'; ctx.fillText(d.label, Math.min(p.x, a.right - 2), Math.min(a.bottom - 4, p.y + 14 + (d.trendIdx || 0) * 13)); ctx.restore(); return; }
      if (d.isRef) { const p = meta.data[0]; if (!p || p.y < a.top || p.y > a.bottom) return; ctx.save(); ctx.font = (d.refK === 0 ? '600 ' : '500 ') + '9.5px Inter, sans-serif'; ctx.fillStyle = d.refK === 0 ? css('--ink-2') : d.borderColor; ctx.textAlign = 'left'; ctx.fillText(d.label, a.left + 4, p.y - 3); ctx.restore(); return; }
      if (chart.data.datasets.filter(x => !x.isLimit && !x.isRef).length > 3) return;
      const p = meta.data.at(-1), raw = d.data.at(-1); if (!p || !raw) return;
      const t = String(+(+raw.y).toFixed(3)), w = ctx.measureText(t).width + 4;
      const align = p.x + w / 2 > a.right ? 'right' : p.x - w / 2 < a.left ? 'left' : 'center', bx = align === 'right' ? p.x - w - 2 : align === 'left' ? p.x + 2 : p.x - w / 2;
      for (const dy of [-10, 20, -24, 34]) { const ty = p.y + dy, b = { x0: bx, x1: bx + w, y0: ty - 12, y1: ty + 2 };
        if (ty - 10 < a.top || ty > a.bottom - 2 || hit(b)) continue;
        boxes.push(b); ctx.fillStyle = d.borderColor; ctx.textAlign = align; ctx.fillText(t, align === 'right' ? p.x - 4 : align === 'left' ? p.x + 4 : p.x, ty); break; }
    });
    ctx.restore();
  },
};
if (window.Chart) Chart.register(labelPlugin);

export function lineChart(canvas, o) {
  const ink3 = css('--ink-3'), line = css('--line');
  const xs = o.series.flatMap(s => s.points.map(p => toDate(p.x).getTime()));
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const pad = Math.max((xmax - xmin) * 0.06, 45 * 864e5);
  const sc = { watch: css('--watch'), alert: css('--alert'), critical: css('--crit') };
  const ds = o.series.map((s, i) => {
    const col = s.color || EXTRA[i % EXTRA.length];
    const sev = (p) => o.sevOf ? o.sevOf(p.y) : '';
    return {
      label: s.label, data: s.points.map(p => ({ x: toDate(p.x).getTime(), y: p.y, meta: p.meta })),
      borderColor: col, backgroundColor: (ctx) => {           // gradient area under a single series
        if (!(o.fill && i === 0)) return col;
        const { chart } = ctx; const a = chart.chartArea; if (!a) return col;
        const g = chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00'); return g;
      },
      fill: o.fill && i === 0 ? 'start' : false,
      borderWidth: 2.2, tension: 0.3, cubicInterpolationMode: 'monotone', spanGaps: true, pointHoverRadius: 7, pointBorderWidth: 2,
      pointRadius: s.points.map(p => ['alert', 'critical'].includes(sev(p)) ? 5.5 : 3.8),
      pointBackgroundColor: s.points.map(p => sc[sev(p)] || css('--panel')),
      pointBorderColor: s.points.map(p => sc[sev(p)] || col),
    };
  });
  // round grid step near 20 % of the element's own average
  let ystep = null, ymin, ymax;
  if (o.stepRef && o.series.length >= 1) {
    const ys0 = o.series[0].points.map(p => p.y).filter(y => y != null), ys = o.series.flatMap(se => se.points.map(p => p.y)).filter(y => y != null);
    const avg = ys0.reduce((a, b) => a + b, 0) / ys0.length;
    ystep = niceStep(Math.abs(avg) * 0.2) || niceStep((Math.max(...ys) - Math.min(...ys)) / 5 || 1);
    const near = (o.limits || []).map(l => l.y).filter(l => l <= Math.max(...ys) * 1.6 + ystep && l >= Math.min(...ys) * 0.6 - ystep);
    let lo = Math.min(...ys, ...near), hi = Math.max(...ys, ...near);
    while ((hi - lo) / ystep > 9) ystep = niceStep(ystep * 2.2);
    ymin = Math.floor(lo / ystep) * ystep - (lo % ystep === 0 ? ystep : 0); ymax = Math.ceil(hi / ystep) * ystep + (hi % ystep === 0 ? ystep : 0);
    if (o.zero && ymin < 0 && Math.min(...ys) >= 0) ymin = 0;
  }
  for (const l of o.limits || []) {
    ds.push({ label: l.label, data: [{ x: xmin - pad, y: l.y }, { x: xmax + pad, y: l.y }], borderColor: l.color || css('--crit'),
      borderDash: [5, 4], borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 0, fill: false, isLimit: true, pointStyle: 'line' });
  }
  const c = new Chart(canvas, {
    type: 'line', data: { datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, parsing: false,
      layout: { padding: { top: 14, right: 6 } },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', min: xmin - pad, max: xmax + pad, grid: { color: line, drawTicks: false }, border: { display: false }, ticks: { color: ink3, maxTicksLimit: 6, padding: 6, callback: v => new Date(v).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) } },
        y: ystep ? { min: ymin, max: ymax, grid: { color: line, drawTicks: false }, border: { display: false, dash: [2, 4] }, ticks: { color: ink3, padding: 6, stepSize: ystep }, title: { display: !!o.yLabel, text: o.yLabel, color: ink3, font: { size: 11 } } }
          : { grid: { color: line, drawTicks: false }, border: { display: false }, ticks: { color: ink3, padding: 6 }, title: { display: !!o.yLabel, text: o.yLabel, color: ink3, font: { size: 11 } }, suggestedMin: o.yMin, suggestedMax: o.yMax, beginAtZero: !!o.zero, grace: '8%' },
      },
      plugins: {
        zones: { bands: o.bands || [] },
        legend: { position: 'bottom', labels: { color: css('--ink-2'), boxWidth: 8, boxHeight: 8, font: { size: 11, family: 'Inter' }, usePointStyle: true, filter: (it, d) => !d.datasets[it.datasetIndex].isLimit && !d.datasets[it.datasetIndex].isRef } },
        tooltip: { backgroundColor: 'rgba(11,23,38,.92)', padding: 10, cornerRadius: 8, titleFont: { weight: '600' }, filter: (it) => !it.dataset.isLimit && !it.dataset.isRef, callbacks: {
          title: (it) => it.length ? fmtDate(new Date(it[0].raw.x)) : '',
          label: (it) => `${it.dataset.label}: ${it.raw.y}${o.unit ? ' ' + o.unit : ''}${it.raw.meta ? ' · ' + it.raw.meta : ''}`,
        } },
      },
    },
  });
  charts.push(c); return c;
}

export function barChart(canvas, o) {
  const ink3 = css('--ink-3'), line = css('--line');
  const ds = o.series.map((s, i) => ({ type: 'bar', label: s.label, data: s.data, backgroundColor: s.color || EXTRA[i], borderRadius: 3, maxBarThickness: 18 }));
  for (const l of o.limits || []) ds.push({ type: 'line', label: l.label, data: o.labels.map(() => l.y), borderColor: l.color || css('--crit'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, isLimit: true });
  const c = new Chart(canvas, { data: { labels: o.labels, datasets: ds }, options: {
    responsive: true, maintainAspectRatio: false, animation: false,
    scales: { x: { grid: { display: false }, ticks: { color: ink3, font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: line }, ticks: { color: ink3 }, title: { display: !!o.yLabel, text: o.yLabel, color: ink3 } } },
    plugins: { legend: { position: 'bottom', labels: { color: css('--ink-2'), boxWidth: 10, font: { size: 11 } } }, tooltip: { filter: it => !it.dataset.isLimit } },
  } });
  charts.push(c); return c;
}

// ---------------------------------------------------------------- modal + circular viewer
export function modal(title, bodyHtml, onMount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="card-h"><h2>${title}</h2><div class="sp"></div><button class="x" aria-label="Close">×</button></div><div class="card-b">${bodyHtml}</div></div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.classList.contains('x')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  onMount && onMount(bg);
  return close;
}

const imgCache = {};
function pageImg(n) {
  if (!imgCache[n]) imgCache[n] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `assets/circular/page-${n}.jpg`; });
  return imgCache[n];
}

/** Draw the circular's table header + the row band (expanded to merged cells) onto a canvas. */
export async function drawSnippet(canvas, row) {
  const meta = DB.norms.meta, s = row.scan, im = await pageImg(s.page);
  const x0 = meta.x0, x1 = meta.x1, w = x1 - x0;
  const hh = s.hy1 - s.hy0, rh = s.gy1 - s.gy0;
  const k = 2;
  canvas.width = w * k; canvas.height = (hh + rh + 2) * k;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(im, x0, s.hy0 - 1, w, hh + 2, 0, 0, w * k, (hh + 2) * k);
  g.drawImage(im, x0, s.gy0 - 1, w, rh + 2, 0, (hh + 2) * k, w * k, (rh + 2) * k);
  if (s.gy0 !== s.y0 || s.gy1 !== s.y1) {          // highlight the exact row inside a merged group
    g.fillStyle = 'rgba(255,200,0,.22)';
    g.fillRect(0, (hh + 2 + s.y0 - s.gy0) * k, w * k, (s.y1 - s.y0 + 2) * k);
  }
}

export function openCircular(sr) {
  const row = DB.normsBySr[sr]; if (!row) return;
  const m = DB.norms.meta;
  const body = `
    <div class="row-flex mb">
      <span class="tag b">Sr ${row.sr}</span><span class="tag">${esc(row.equipment)}</span>
      ${row.changed ? '<span class="tag chg">Frequency revised</span>' : ''}
      <span class="note">Circular ${esc(m.circularNo)} · ${fmtDate(m.date)} · page ${row.scan.page} of ${m.pages}</span>
      <div class="sp" style="flex:1"></div>
      <div class="seg"><button class="on" data-v="row">Row extract</button><button data-v="page">Full page</button><button data-v="cover">Covering letter</button></div>
    </div>
    <div class="scan-wrap" data-pane="row"><canvas aria-label="Circular row extract"></canvas></div>
    <div class="scan-wrap hide" data-pane="page"><div class="page-wrap"><img alt="Circular page ${row.scan.page}" src="assets/circular/page-${row.scan.page}.jpg"><div class="hl"></div></div></div>
    <div class="scan-wrap hide" data-pane="cover"><img alt="Circular covering letter" src="assets/circular/page-1.jpg" loading="lazy"></div>
    <p class="note mt">Scanned original, rotated upright. The highlighted band is Sr ${row.sr}; merged cells (limits shared across rows) are included. <a href="assets/circular/page-${row.scan.page}.jpg" target="_blank" rel="noopener">Open image ↗</a></p>`;
  modal(`Circular extract — ${esc(row.activity)}`, body, async (root) => {
    await drawSnippet($('canvas', root), row);
    const W = 1650, H = 1275;
    Object.assign($('.hl', root).style, { left: (m.x0 / W * 100) + '%', width: ((m.x1 - m.x0) / W * 100) + '%', top: (row.scan.y0 / H * 100) + '%', height: ((row.scan.y1 - row.scan.y0) / H * 100) + '%' });
    $$('.seg button', root).forEach(b => b.onclick = () => {
      $$('.seg button', root).forEach(x => x.classList.toggle('on', x === b));
      $$('[data-pane]', root).forEach(p => p.classList.toggle('hide', p.dataset.pane !== b.dataset.v));
      if (b.dataset.v === 'page') { const hl = $('.hl', root); setTimeout(() => hl.scrollIntoView({ block: 'center' }), 50); }
    });
  });
}

export function circularBtn(sr, label = 'View circular') {
  return `<button class="btn sm btn-doc" data-circ="${sr}" title="Show the scanned circular row for Sr ${sr}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/></svg>${esc(label)} · Sr ${sr}</button>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-circ]'); if (b) { e.preventDefault(); openCircular(Number(b.dataset.circ)); } });


// ---------------------------------------------------------------- Duval Triangle 1 (IEC 60599 Annex B)
// Ternary coordinates (%CH4, %C2H4, %C2H2). CH4 apex top, C2H4 bottom-right, C2H2 bottom-left.
export const DUVAL_ZONES = {
  PD: [[98, 2, 0], [100, 0, 0], [98, 0, 2]],
  T1: [[98, 2, 0], [80, 20, 0], [76, 20, 4], [96, 0, 4], [98, 0, 2]],
  T2: [[80, 20, 0], [50, 50, 0], [46, 50, 4], [76, 20, 4]],
  T3: [[50, 50, 0], [0, 100, 0], [0, 85, 15], [35, 50, 15], [46, 50, 4]],
  D1: [[87, 0, 13], [64, 23, 13], [0, 23, 77], [0, 0, 100]],
  D2: [[64, 23, 13], [47, 40, 13], [31, 40, 29], [0, 71, 29], [0, 23, 77]],
  DT: [[96, 0, 4], [87, 0, 13], [64, 23, 13], [47, 40, 13], [31, 40, 29], [0, 71, 29], [0, 85, 15], [35, 50, 15], [46, 50, 4]],
};
const ZC = { PD: '#9aa9bd', T1: '#f6d38a', T2: '#f2a65a', T3: '#e0603a', D1: '#8fc1ea', D2: '#4f86c6', DT: '#b79ad6' };
export function duvalSVG(points) {
  const W = 440, H = 410, m = 32, side = W - 2 * m, h = side * Math.sqrt(3) / 2;
  const xy = ([ch4, c2h4]) => [m + (c2h4 + ch4 / 2) / 100 * side, m + 8 + (1 - ch4 / 100) * h];
  const poly = (k) => DUVAL_ZONES[k].map(p => xy(p).map(v => v.toFixed(1)).join(',')).join(' ');
  const lbl = { D1: [30, 8], D2: [20, 46], DT: [46, 30], T1: [86, 10], T2: [62, 35], T3: [20, 74] };
  let g = Object.keys(DUVAL_ZONES).map(k => `<polygon class="z" points="${poly(k)}" fill="${ZC[k]}" fill-opacity=".55"><title>${k}</title></polygon>`).join('');
  g += Object.entries(lbl).map(([k, p]) => { const [x, y] = xy(p); return `<text class="zl" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${k}</text>`; }).join('');
  const [A, B, C] = [xy([100, 0]), xy([0, 100]), xy([0, 0])];
  g += `<text class="zl" x="${A[0] + 16}" y="${A[1] + 6}">PD</text>`;
  g += `<polygon points="${[A, B, C].map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--ink-3)" stroke-width="1.2"/>`;
  g += `<text class="ax" x="${A[0]}" y="${A[1] - 10}" text-anchor="middle">% CH₄</text><text class="ax" x="${B[0]}" y="${B[1] + 20}" text-anchor="end">% C₂H₄</text><text class="ax" x="${C[0]}" y="${C[1] + 20}">% C₂H₂</text>`;
  points.forEach(p => { const [x, y] = xy([p.CH4, p.C2H4]); g += `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.big ? 7.5 : 5}" fill="${p.color}" ${p.big ? '' : 'fill-opacity=".55"'}><title>${esc(p.label)} — ${p.zone}: CH₄ ${p.CH4.toFixed(0)} % · C₂H₄ ${p.C2H4.toFixed(0)} % · C₂H₂ ${p.C2H2.toFixed(0)} %</title></circle>`; });
  return `<svg class="duval" viewBox="0 0 ${W} ${H}" role="img" aria-label="Duval triangle 1">${g}</svg>`;
}

// ---------------------------------------------------------------- command palette (Ctrl/Cmd+K or /)
let PAL_ITEMS = [];
export function setPaletteItems(items) { PAL_ITEMS = items; }
export function openPalette() {
  if ($('.pal')) return;
  const close = modal('', `<input aria-label="Search" placeholder="Search bays, equipment, tests, circular Sr. No., pages…" autocomplete="off"><ul role="listbox"></ul><div class="foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">Enter</span> open</span><span><span class="kbd">Esc</span> close</span></div>`, (root) => {
    const md = $('.modal', root); md.classList.add('pal'); $('.card-h', md).style.display = 'none';
    $('.card-b', md).style.padding = '0';
    const inp = $('input', md), ul = $('ul', md); let sel = 0, list = [];
    const draw = () => {
      const q = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      list = PAL_ITEMS.filter(it => q.every(w => it.hay.includes(w))).slice(0, 40);
      sel = Math.min(sel, Math.max(0, list.length - 1));
      ul.innerHTML = list.map((it, i) => `<li><a href="${it.href}" class="${i === sel ? 'sel' : ''}"><span style="width:16px;height:16px;display:grid;color:var(--ink-3)">${it.icon || ''}</span><span>${esc(it.label)}</span>${it.sub ? `<span class="dim" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.sub)}</span>` : ''}<span class="k">${esc(it.kind)}</span></a></li>`).join('') || '<li class="empty">No match</li>';
      $$('a', ul).forEach(a => a.onclick = () => close());
    };
    inp.oninput = () => { sel = 0; draw(); };
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, list.length - 1); draw(); e.preventDefault(); $('.sel', ul)?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); $('.sel', ul)?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter' && list[sel]) { location.hash = list[sel].href; close(); }
    };
    draw(); setTimeout(() => inp.focus(), 10);
  });
}
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openPalette(); }
});
