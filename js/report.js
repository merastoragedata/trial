// Shareable consolidated test report for one phase unit / bay (or one phase of a bay), laid out like a
// signed field report: header, one section per diagnostic test (latest test, previous test, change,
// status, history graph), engineering observations, conclusion, verification block. Exported as PNG
// (image) or PDF; on phones the system share sheet is offered.
import { DB, TESTS, fmt, fmtDate, kvOf, isTF, unitName, bayTitle } from './data.js?v=20261126.0647';
import { findingsFor, statusOf, SEV } from './rules.js?v=20261126.0647';
import { model, fullName, cellSev, COLS, svgChart, phaseUnitName, windingChecks, elemHealth, NOUN } from './results.js?v=20261126.0647';
import { esc } from './ui.js?v=20261126.0647';

const KEYC = { ct: ['C', 'tand', 'temp', 'tand20', 'dTand', 'dC'], bushing: ['C', 'tand', 'temp', 'tand20', 'dTand', 'dC'], winding: ['C', 'tand', 'temp', 'tand20', 'dTand', 'dC'],
  cb_crm: ['R', 'I'], cb_timing: ['open1', 'co1', 'close', 'open2', 'co2'], la: ['Ith', 'Icorr', 'Itotal', 'IRtot'], dga: ['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2', 'TDCG', 'BDV', 'H2O'] };
const MAIN = { ct: 'tand20', bushing: 'tand20', winding: 'tand20', cb_crm: 'R', cb_timing: 'open1', la: 'Icorr', dga: 'TDCG' };
const MAINL = { tand20: 'Corrected tan δ % @20 °C', R: 'Contact resistance µΩ', open1: 'Trip time TC1 ms', Icorr: 'Icorr µA', TDCG: 'TDCG ppm' };
const PAL = ['#1a6fc2', '#c2410c', '#0f766e', '#7c3aed', '#a16207', '#be185d', '#0891b2', '#4d7c0f', '#334155', '#b91c1c', '#2563eb', '#9333ea'];
const SEVTXT = { ok: 'Normal', watch: 'Watch', alert: 'Beyond circular', critical: 'Critical', none: 'Normal' };

/** Scope of a report: a transformer phase unit, a whole unit, a bay, or one phase of a bay. */
export function reportScope(u, ph) {
  const tf = isTF(u);
  const tests = tf ? ['bushing', 'winding', 'dga'] : ['ct', 'cb_crm', 'cb_timing', 'la'];
  const title = tf ? `${unitName(u)}${ph ? ` — ${ph}-phase unit` : ''}` : `Bay ${u} — ${bayTitle(u)}${ph ? ` · ${ph}-phase` : ''}`;
  return { u, ph, tf, tests, title };
}

function section(t, S, n) {
  const M = model(t), U = M.units.find(x => x.u === S.u); if (!U) return null;
  const es = U.es.filter(e => !S.ph || e.ph === S.ph);
  if (!es.length) return null;
  const cols = KEYC[t].map(k => COLS[t].find(c => c.k === k)).filter(Boolean);
  const main = MAIN[t];
  const rows = es.map(e => {
    const L = e.L, P = e.done.length > 1 ? e.done.filter(r => r.date < (L?.date || '')).filter(r => (r.pos || '') === (L?.pos || '')).at(-1) : null;
    const sev = L ? (statusOf(L) === 'none' ? 'ok' : statusOf(L)) : 'none';
    const chg = L && P && L.v[main] != null && P.v[main] != null ? L.v[main] - P.v[main] : null;
    return `<tr><td class="l"><b>${esc(fullName(t, S.u, e.sub, true))}</b>${t === 'dga' && L && L.pos !== 'OLTC' ? ` <i>(${esc((L.pos || '').toLowerCase())} sample)</i>` : ''}</td><td>${L ? fmtDate(L.date) : '<i>never tested</i>'}</td>
      ${cols.map(c => { const v = L?.v[c.k], s = L ? cellSev(t, c.k, v, L) : ''; return `<td class="${s ? 'c-' + s : ''}">${fmt(v, c.dp)}</td>`; }).join('')}
      <td>${P ? `${fmtDate(P.date)}<br><i>${fmt(P.v[main], 3)}</i>` : '—'}</td><td>${chg == null ? '—' : (chg > 0 ? '+' : '') + fmt(chg, 3)}</td><td class="st st-${sev}">${L ? SEVTXT[sev] : '—'}</td></tr>`;
  }).join('');
  const series = es.filter(e => e.done.length).map((e, i) => ({ name: fullName(t, S.u, e.sub, true), color: PAL[i % PAL.length], pts: e.done.filter(r => r.v[main] != null).map(r => [r.date, r.v[main], cellSev(t, main, r.v[main], r)]) })).filter(s => s.pts.length);
  const chart = series.length ? svgChart(series, { dp: 3, w: 900, h: 230, zero: t === 'la' || t === 'cb_crm' }) : '';
  let extra = '';
  if (t === 'winding') {
    const L = {}; for (const e of es) if (e.L) L[e.sub.split('|')[1]] = e.L;
    const ck = windingChecks(L);
    if (ck.length) extra = `<table class="rt"><thead><tr><th>Cross-check (as in the sheet)</th><th>Calculated</th><th>Measured</th><th>Deviation</th><th>Result</th></tr></thead><tbody>${ck.map(c => `<tr><td class="l">${esc(c.k)}</td><td>${fmt(c.calc, c.dp)}</td><td>${fmt(c.meas, c.dp)}</td><td>${(c.d > 0 ? '+' : '') + fmt(c.d, 2)} %</td><td class="st st-${c.sev}">${c.sev === 'ok' ? 'consistent' : c.sev === 'watch' ? 'check set-up' : 're-test'}</td></tr>`).join('')}</tbody></table>`;
  }
  return { t, html: `<section class="rblk"><h2>${n}. ${esc(TESTS[t].name)}</h2>
    <p class="rnote">Latest completed test of each ${esc(NOUN[t][0])}, previous test of the same ${esc(NOUN[t][0])} and the change in ${esc(MAINL[main] || main)}; coloured against the MSETCL circular (Oct 2024) and industry limits.</p>
    <table class="rt"><thead><tr><th class="l">${esc(NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1))}</th><th>Date of test</th>${cols.map(c => `<th>${c.label}</th>`).join('')}<th>Previous test<br>(${esc(MAINL[main] || main)})</th><th>Change</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>${extra}
    ${chart ? `<div class="rchart"><div class="rch-t">History · ${esc(MAINL[main] || main)}</div>${chart}</div>` : ''}</section>`, es };
}

export function buildReport(S) {
  const secs = [];
  let n = 2; for (const t of S.tests) { const s = section(t, S, n); if (s) { secs.push(s); n++; } }
  const info = DB.site.units[S.u];
  const fs = S.tests.flatMap(t => findingsFor({ t, unit: S.u })).filter(f => !S.ph || !f.ph || f.ph === S.ph || f.ph === '-').sort((a, b) => (SEV[b.sev] ?? 0) - (SEV[a.sev] ?? 0));
  const dates = secs.flatMap(s => s.es.map(e => e.L?.date)).filter(Boolean).sort();
  const hs = secs.flatMap(s => s.es.map(e => elemHealth(s.t, e.L))).filter(x => x != null);
  const bad = fs.filter(f => SEV[f.sev] >= 3), watch = fs.filter(f => f.sev === 'watch');
  const kv = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  return `<div class="rpt">
    <header class="rblk rhead"><div class="rorg">${esc(DB.site.substation.org)} · ${esc(DB.site.substation.name)}</div><h1>CONSOLIDATED TEST REPORT</h1><div class="rsub">${esc(S.title)}</div>
      <table class="rkv">${kv('Equipment / unit', esc(S.tf ? `${unitName(S.u, true)}${S.ph ? ` · ${phaseUnitName(S.u, S.ph)}` : ''}` : `${unitName(S.u, true)}${S.ph ? ` · ${S.ph}-phase` : ''}`))}
        ${info ? kv('Rating / make', esc(`${info.rating}${info.make ? ' · ' + info.make : ''}${info.commissioned ? ' · commissioned ' + fmtDate(info.commissioned) : ''}`)) : kv('Voltage class', `${kvOf(S.u)} kV`)}
        ${kv('Diagnostic tests covered', secs.map(s => esc(TESTS[s.t].name)).join(' · ') || '—')}
        ${kv('Latest test dates', dates.length ? `${fmtDate(dates[0])}${dates.length > 1 && dates.at(-1) !== dates[0] ? ' to ' + fmtDate(dates.at(-1)) : ''}` : '—')}
        ${kv('Lowest element health', hs.length ? `${Math.min(...hs)} / 100` : '—')}
        ${kv('Report generated', `${fmtDate(new Date())} · EHV O&M Diagnostic Portal (data: ${esc(DB.site.substation.source || 'diagnostic sheet')})`)}</table></header>
    <section class="rblk"><h2>1. Objective and scope</h2><p>This report consolidates the latest diagnostic results on record for ${esc(S.title)}, compares each with the previous test of the same element, and evaluates them against MSETCL circular 06961 (18 Oct 2024) and the industry standards referenced in the portal (IEC 60599, IEEE C57.104 / C57.152, IEC 60137, CIGRE). Each phase, bushing, sampling point and pole is assessed as an independent unit.</p></section>
    ${secs.map(s => s.html).join('')}
    <section class="rblk"><h2>${n}. Observations and engineering review</h2>${fs.length ? `<ul class="robs">${fs.map(f => `<li class="o-${f.sev}"><b>${esc(SEVTXT[f.sev] || f.sev)} · ${esc(f.where || '')}</b> — ${esc(f.title)}. ${esc(f.detail || '')} <i>Action: ${esc(f.action || '—')}</i> <span class="rbasis">[${esc(f.basis || '')}]</span></li>`).join('')}</ul>` : '<p>No finding is open for this equipment: every latest result is within the circular and industry limits.</p>'}</section>
    <section class="rblk"><h2>${n + 1}. Conclusion</h2><p>${bad.length ? `${bad.length} result${bad.length > 1 ? 's are' : ' is'} beyond the circular limit and need${bad.length > 1 ? '' : 's'} the action listed above${watch.length ? `; ${watch.length} more ${watch.length > 1 ? 'are' : 'is'} on the watch-list` : ''}.` : watch.length ? `All latest results are within the circular limits; ${watch.length} item${watch.length > 1 ? 's are' : ' is'} on the watch-list (industry threshold or adverse trend) for closer follow-up.` : 'All latest results are within the circular and industry limits; the equipment is fit for continued service on the basis of these diagnostic tests.'} Readings are as recorded in the diagnostic sheet; any entry flagged for verification should be confirmed against the field test sheet before final sign-off.</p></section>
    <section class="rblk"><h2>${n + 2}. Verification / approval</h2><table class="rsign"><tr><th>Prepared by</th><th>Checked by</th><th>Approved by</th></tr>
      <tr>${[0, 1, 2].map(() => '<td>Name / designation: ____________________<br><br>Signature: ________________________<br><br>Date: ____________________________</td>').join('')}</tr></table>
      <p class="rsrc">Source: diagnostic test records of ${esc(DB.site.substation.name)} as held in the portal; values are not altered except where the portal recalculates a formula (corrected tan δ, TDCG). Generated ${new Date().toLocaleString('en-GB')}.</p></section></div>`;
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
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), PW = 210, PH = 297, M = 10, W = PW - 2 * M;
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
export const shareButtons = (u, ph, chooser) => `<span class="share" data-share-u="${esc(u)}" data-share-ph="${esc(ph || '')}"><span class="share-k">Share report</span>${chooser ? `<select class="share-sel" data-share-sel aria-label="Report scope"><option value="">${isTF(u) ? 'Whole unit' : 'Whole bay'}</option>${['R', 'Y', 'B'].map(p => `<option value="${p}">${p}-phase${isTF(u) ? ' unit' : ''} only</option>`).join('')}</select>` : ''}<button class="btn sm" data-share="png">Image</button><button class="btn sm" data-share="pdf">PDF</button><button class="btn sm ghost" data-share="view">Preview</button></span>`;
export function wireShare(root) {
  root.querySelectorAll('[data-share]').forEach(b => b.onclick = (ev) => {
    ev.preventDefault(); ev.stopPropagation(); const w = b.closest('[data-share-u]'); const sel = w.querySelector('[data-share-sel]'); const S = reportScope(w.dataset.shareU, (sel ? sel.value : w.dataset.sharePh) || null);
    if (b.dataset.share === 'view') { const bg = document.createElement('div'); bg.className = 'modal-bg rpt-prev'; bg.innerHTML = `<div class="rpt-prev-in"><button class="x" aria-label="Close">×</button>${buildReport(S)}</div>`; document.body.appendChild(bg); resolveVars(bg);
      bg.onclick = (e) => { if (e.target === bg || e.target.classList.contains('x')) bg.remove(); }; return; }
    shareReport(S, b.dataset.share, b);
  });
}
