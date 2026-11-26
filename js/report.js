// Shareable test results of one phase unit / bay (or one phase of a bay) in the portal's own sheet
// format, exported as PNG (image) or PDF; on phones the system share sheet is offered.
import { DB, TESTS, fmt, fmtDate, isTF, unitName, bayTitle } from './data.js?v=20261126.1906';
import { findingsFor, SEV } from './rules.js?v=20261126.1906';
import { model, fullName, cellSev, COLS } from './results.js?v=20261126.1906';
import { esc } from './ui.js?v=20261126.1906';

const SEVTXT = { ok: 'Healthy', watch: 'Monitor', alert: 'Planned action', critical: 'Priority action', none: 'Healthy' };

/** Scope of a report: a transformer phase unit, a whole unit, a bay, or one phase of a bay. */
export function reportScope(u, ph) {
  const tf = isTF(u);
  const tests = tf ? ['bushing', 'winding', 'dga'] : ['ct', 'cb_crm', 'cb_timing', 'la'];
  const title = tf ? `${unitName(u)}${ph ? ` — ${ph}-phase unit` : ''}` : `${unitName(u)}${ph ? ` · ${ph}-phase` : ''}`;
  return { u, ph, tf, tests, title };
}

// Every test is reported in the portal's own sheet format: per element, all its completed tests
// sequence-wise with the same columns, units and colour rules as the detailed results.
function section(t, S, n) {
  const M = model(t), U = M.units.find(x => x.u === S.u); if (!U) return null;
  const es = U.es.filter(e => !S.ph || e.ph === S.ph);
  if (!es.length) return null;
  const cols = COLS[t];
  const head = `<thead><tr><th>Session</th><th>Date of test</th>${cols.map(c => `<th>${c.label}</th>`).join('')}<th class="l">Remarks</th></tr></thead>`;
  const tables = es.map(e => {
    const rows = e.rows.filter(r => !r.excluded);
    const body = rows.map(r => `<tr><td>${esc(r.ses || '')}</td><td>${fmtDate(r.date)}</td>${cols.map(c => {
      const v = c.k === 'mode' ? (r.mode || 'UST') : c.k === 'season' ? (r.season || '') : c.k === 'pos' ? (r.pos || '') : r.v[c.k];
      const s = c.txt ? '' : cellSev(t, c.k, v, r);
      return `<td class="${s ? 'c-' + s : ''}">${c.txt ? esc(v || '') : fmt(v, c.dp)}</td>`; }).join('')}<td class="l">${esc(r.rem || '')}</td></tr>`).join('')
      || `<tr><td colspan="${cols.length + 3}"><i>No test on record</i></td></tr>`;
    return `<div class="rel"><h3>${esc(fullName(t, S.u, e.sub))}</h3><table class="rt">${head}<tbody>${body}</tbody></table></div>`;
  }).join('');
  return { t, html: `<section class="rblk"><h2>${n}. ${esc(TESTS[t].name)}</h2>${tables}</section>`, es };
}

export function buildReport(S, withFindings = !!document.querySelector('details.fnd-sec[open]')) {
  const secs = [];
  let n = 1; for (const t of S.tests) { const s = section(t, S, n); if (s) { secs.push(s); n++; } }
  const fs = S.tests.flatMap(t => findingsFor({ t, unit: S.u })).filter(f => !S.ph || !f.ph || f.ph === S.ph || f.ph === '-').sort((a, b) => (SEV[b.sev] ?? 0) - (SEV[a.sev] ?? 0));
  return `<div class="rpt">
    <header class="rblk rhead"><div class="rorg">${esc(DB.site.substation.org)} · ${esc(DB.site.substation.name)}</div><h1>Diagnostic test results</h1><div class="rsub">${esc(S.title)}</div>
      <p class="rnote" style="text-align:center">Colours: green within limit · yellow watch · orange beyond circular · red critical — MSETCL circular 06961 (18 Oct 2024) and industry practice. Generated ${fmtDate(new Date())}.</p></header>
    ${secs.map(s => s.html).join('')}
    ${withFindings && fs.length ? `<section class="rblk"><h2>${n}. Findings</h2><ul class="robs">${fs.map(f => `<li class="o-${f.sev}"><b>${esc(SEVTXT[f.sev] || f.sev)} · ${esc(f.where || '')}</b> — ${esc(f.title)}. ${esc(f.detail || '')} <i>Action: ${esc(f.action || '—')}</i></li>`).join('')}</ul></section>` : ''}
  </div>`;
}

// ------------------------------------------------------------------ export
const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
const resolveVars = (root) => { const cs = getComputedStyle(document.documentElement);
  root.querySelectorAll('svg [fill*="var("], svg [stroke*="var("], svg [style*="var("]').forEach(el => { for (const a of ['fill', 'stroke', 'style']) { const v = el.getAttribute(a); if (v && v.includes('var(')) el.setAttribute(a, v.replace(/var\((--[\w-]+)\)/g, (_, n) => cs.getPropertyValue(n).trim() || '#555')); } }); };
function stage(S) {
  const host = document.createElement('div'); host.className = 'rpt-host'; host.innerHTML = buildReport(S);
  document.body.appendChild(host); resolveVars(host); return host;
}
const fname = (S, ext) => `${S.title.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;
async function deliver(blob, name, mime) {
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export async function shareReport(S, kind, btn) {
  const old = btn?.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = 'Preparing…'; }
  let host;
  try {
    await loadScript('vendor/html2canvas.min.js');
    host = stage(S); await document.fonts?.ready;
    const shot = (el) => window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    if (kind === 'png') {
      const c = await shot(host.firstElementChild);
      await deliver(await new Promise(r => c.toBlob(r, 'image/png')), fname(S, 'png'), 'image/png');
    } else {
      await loadScript('vendor/jspdf.umd.min.js');
      const land = kind === 'pdf-l', pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' }), PW = land ? 297 : 210, PH = land ? 210 : 297, M = 10, W = PW - 2 * M;
      let y = M, page = 1;
      const foot = () => { pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`${S.title} · consolidated test report · page ${page}`, M, PH - 5); };
      for (const blk of host.querySelectorAll('.rblk')) {
        const c = await shot(blk); const h = c.height * W / c.width;
        if (y + h > PH - 12 && y > M) { foot(); pdf.addPage(); page++; y = M; }
        if (h > PH - 22) {                                    // taller than a page: slice it
          const sliceH = Math.floor(c.width * (PH - 22) / W);
          for (let sy = 0; sy < c.height; sy += sliceH) { const part = document.createElement('canvas'); part.width = c.width; part.height = Math.min(sliceH, c.height - sy); part.getContext('2d').drawImage(c, 0, sy, c.width, part.height, 0, 0, c.width, part.height);
            const ph = part.height * W / c.width; if (y + ph > PH - 12 && y > M) { foot(); pdf.addPage(); page++; y = M; } pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, W, ph); y += ph + 2; }
        } else { pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, W, h); y += h + 3; }
      }
      foot();
      await deliver(pdf.output('blob'), fname(S, 'pdf'), 'application/pdf');
    }
  } catch (e) { alert('Could not prepare the report: ' + e.message); }
  finally { host?.remove(); if (btn) { btn.disabled = false; btn.innerHTML = old; } }
}
/** Buttons to drop on a page: share the report of unit / bay u (optionally one phase). */
export const shareButtons = (u, ph, chooser) => `<span class="share" data-share-u="${esc(u)}" data-share-ph="${esc(ph || '')}"><span class="share-k">Share results</span>${chooser ? `<select class="share-sel" data-share-sel aria-label="Report scope"><option value="">${isTF(u) ? 'Whole unit' : 'Whole bay'}</option>${['R', 'Y', 'B'].map(p => `<option value="${p}">${p}-phase${isTF(u) ? ' unit' : ''} only</option>`).join('')}</select>` : ''}<button class="btn sm" data-share="png">Image</button><button class="btn sm" data-share="pdf-p">PDF portrait</button><button class="btn sm" data-share="pdf-l">PDF landscape</button><button class="btn sm ghost" data-share="view">Preview</button></span>`;
export function wireShare(root) {
  root.querySelectorAll('[data-share]').forEach(b => b.onclick = (ev) => {
    ev.preventDefault(); ev.stopPropagation(); const w = b.closest('[data-share-u]'); const sel = w.querySelector('[data-share-sel]'); const S = reportScope(w.dataset.shareU, (sel ? sel.value : w.dataset.sharePh) || null);
    if (b.dataset.share === 'view') { const bg = document.createElement('div'); bg.className = 'modal-bg rpt-prev'; bg.innerHTML = `<div class="rpt-prev-in"><button class="x" aria-label="Close">×</button>${buildReport(S)}</div>`; document.body.appendChild(bg); resolveVars(bg);
      bg.onclick = (e) => { if (e.target === bg || e.target.classList.contains('x')) bg.remove(); }; return; }
    shareReport(S, b.dataset.share, b);
  });
}
