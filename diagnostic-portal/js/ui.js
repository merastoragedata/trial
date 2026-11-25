// Small DOM, chart and circular-viewer helpers.
import { DB, fmtDate, toDate } from './data.js';
import { SEV_LABEL } from './rules.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pill = (sev, text) => `<span class="pill s-${sev}">${esc(text ?? SEV_LABEL[sev])}</span>`;
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
export function lineChart(canvas, o) {
  const ink3 = css('--ink-3'), line = css('--line');
  const xs = o.series.flatMap(s => s.points.map(p => toDate(p.x).getTime()));
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const pad = Math.max((xmax - xmin) * 0.06, 45 * 864e5);
  const ds = o.series.map((s, i) => ({
    label: s.label, data: s.points.map(p => ({ x: toDate(p.x).getTime(), y: p.y, meta: p.meta })),
    borderColor: s.color || EXTRA[i % EXTRA.length], backgroundColor: s.color || EXTRA[i % EXTRA.length],
    borderWidth: 2, pointRadius: 3.5, pointHoverRadius: 6, tension: 0, spanGaps: true,
  }));
  for (const l of o.limits || []) {
    ds.push({ label: l.label, data: [{ x: xmin - pad, y: l.y }, { x: xmax + pad, y: l.y }], borderColor: l.color || css('--crit'),
      borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false, isLimit: true });
  }
  const c = new Chart(canvas, {
    type: 'line', data: { datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', min: xmin - pad, max: xmax + pad, grid: { color: line }, ticks: { color: ink3, maxTicksLimit: 6, callback: v => new Date(v).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) } },
        y: { grid: { color: line }, ticks: { color: ink3 }, title: { display: !!o.yLabel, text: o.yLabel, color: ink3, font: { size: 11 } }, suggestedMin: o.yMin, suggestedMax: o.yMax, beginAtZero: !!o.zero },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: css('--ink-2'), boxWidth: 10, boxHeight: 10, font: { size: 11 }, filter: (it, d) => true } },
        tooltip: { filter: (it) => !it.dataset.isLimit, callbacks: {
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
  return `<button class="btn sm" data-circ="${sr}" title="Show the scanned circular row for Sr ${sr}">📄 ${esc(label)} · Sr ${sr}</button>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-circ]'); if (b) { e.preventDefault(); openCircular(Number(b.dataset.circ)); } });
