// ICT phase units (R / Y / B single-phase 167 MVA units): big cards on the ICT page and a dedicated
// phase-unit page bringing bushing, winding and DGA results of one unit together.
import { DB, fmt, fmtDate, unitName } from './data.js?v=20261126.1201';
import { elemDue, lastRowDate, statusOf } from './rules.js?v=20261126.1201';
import { model, fullName, elemHealth, elHref, dueTxt, cellSev } from './results.js?v=20261126.1201';
import { nameplateSection, wireNameplates } from './nameplate.js?v=20261126.1201';
import { shareButtons, wireShare } from './report.js?v=20261126.1201';
import { art } from './art.js?v=20261126.1201';
import { esc, $, pill } from './ui.js?v=20261126.1201';
import { IC } from './icons.js?v=20261126.1201';

const TESTS3 = [['bushing', 'Bushings', 'tand20', 'Corr. tan δ', '%', 3], ['winding', 'Winding insulation', 'tand20', 'Corr. tan δ', '%', 3], ['dga', 'Main tank & OLTC (DGA)', 'TDCG', 'TDCG', 'ppm', 0]];
const PHC = { R: '#c4161c', Y: '#b78a00', B: '#1a5fc2' };
const sevOf = (r) => { const s = r ? statusOf(r) : 'none'; return s === 'none' && r ? 'ok' : s; };
const worse = (a, b) => ({ critical: 4, alert: 3, watch: 2, ok: 1, none: 0 })[a] >= ({ critical: 4, alert: 3, watch: 2, ok: 1, none: 0 })[b] ? a : b;

/** Summary of one phase unit for one test. */
function sum(t, u, ph, key) {
  const es = model(t).elements.filter(e => e.u === u && e.ph === ph);
  const L = es.filter(e => e.L);
  const vals = L.map(e => ({ e, v: e.L.v[key] })).filter(x => x.v != null).sort((a, b) => b.v - a.v);
  const hs = L.map(e => elemHealth(t, e.L)).filter(x => x != null);
  const dues = es.map(e => ({ e, d: elemDue(t, u, lastRowDate(e.rows)) })).filter(x => x.d).sort((a, b) => a.d - b.d);
  const sev = L.reduce((s, e) => worse(sevOf(e.L), s), 'none');
  return { es, L, top: vals[0], health: hs.length ? Math.min(...hs) : null, due: dues[0], last: L.map(e => e.L.date).sort().pop(), sev };
}
const hb = (s) => s == null ? 'none' : s >= 85 ? 'b1' : s >= 70 ? 'b2' : s >= 50 ? 'b3' : s >= 30 ? 'b4' : 'b5';

/** Three big cards (R / Y / B) for an ICT page. */
export function puCards(u) {
  if (!/^(ICT1|ICT2)$/.test(u)) return '';
  const cards = ['R', 'Y', 'B'].map(ph => {
    const sr = DB.site.units[u]?.serials?.[ph] || '—';
    const S = TESTS3.map(([t, lab, key, kl, un, dp]) => ({ t, lab, kl, un, dp, ...sum(t, u, ph, key) }));
    const hs = S.map(s => s.health).filter(x => x != null), h = hs.length ? Math.min(...hs) : null;
    const sev = S.reduce((a, s) => worse(s.sev, a), 'none');
    return `<a class="pu-card" href="#/pu/${u}/${ph}" style="--phc:${PHC[ph]}">
      <div class="puc-h"><span class="puc-ph">${ph}</span><div><div class="puc-t">${ph}-phase unit</div><div class="puc-s">Sr ${esc(sr)} · 167 MVA single-phase</div></div><span class="hchip ${hb(h)} puc-hi" title="Lowest element health of this unit">${h ?? '—'}</span></div>
      <div class="puc-rows">${S.map(s => `<div class="puc-r"><span class="puc-k">${s.lab}</span><b class="sv-${s.sev}">${s.top ? `${fmt(s.top.v, s.dp)} <i>${s.un}</i>` : '—'}</b><small>${s.top ? `highest ${s.kl} · ${esc(fullName(s.t, u, s.top.e.sub, true).replace(/^[RYB]ph, /, ''))}` : 'no result'}</small><span class="puc-d">${s.due ? dueTxt(s.due.d) : '—'}</span></div>`).join('')}</div>
      <div class="puc-f">${pill(sev === 'none' ? 'ok' : sev, sev === 'ok' || sev === 'none' ? 'All normal' : undefined)}<span class="puc-go">Open ${ph}-phase unit ${IC.arrow}</span></div></a>`;
  }).join('');
  return `<section class="pu-sec"><div class="sec-h"><h2>Phase units</h2><span class="note">each single-phase unit is a separate transformer with its own bushings, windings, tank and OLTC — open one to see all its results</span></div><div class="pu-cards">${cards}</div></section>`;
}

/** Dedicated page of one phase unit: every test of that unit. */
export function puPage(u, ph, mount, { setCrumbs, rerender }) {
  const sr = DB.site.units[u]?.serials?.[ph] || '—';
  setCrumbs([['Equipment', '#/equipment'], [unitName(u), `#/eq/${u}`], [`${ph}-phase unit`]]);
  const blocks = TESTS3.map(([t, lab, key, kl, un, dp]) => {
    const S = sum(t, u, ph, key);
    const rows = S.es.map(e => { const L = e.L, d = elemDue(t, u, lastRowDate(e.rows));
      const cols = t === 'dga' ? [['TDCG', 0], ['H2', 1], ['C2H2', 1], ['CO', 0], ['BDV', 0], ['H2O', 1]] : [['C', 1], ['tand20', 3], ['dTand', 3], ['dC', 2]];
      return `<tr><td class="l"><a href="${elHref(t, u, e.sub)}"><b>${esc(fullName(t, u, e.sub, true).replace(/^[RYB]ph, /, ''))}</b></a></td><td>${L ? fmtDate(L.date) : '<span class="dim">never</span>'}</td>
        ${cols.map(([k, dpp]) => { const v = L?.v[k]; const s = L ? cellSev(t, k, v, L) : ''; return `<td class="r ${s ? 'c-' + s : ''}">${fmt(v, dpp)}</td>`; }).join('')}
        <td>${L ? pill(sevOf(L)) : '—'}</td><td class="r">${dueTxt(d)}</td></tr>`; }).join('');
    const head = t === 'dga' ? ['TDCG ppm', 'H₂', 'C₂H₂', 'CO', 'BDV kV', 'Water ppm'] : ['C (pF)', 'Corr. tan δ %', 'Tan δ rise', 'C change %'];
    return `<section class="card pu-blk"><div class="card-h"><span class="tc-ic">${IC[t]}</span><h2>${lab}</h2><span class="sub">latest test of each ${t === 'dga' ? 'compartment' : 'element'} · last ${S.last ? fmtDate(S.last) : '—'}</span><div class="sp"></div><a class="btn pri" href="${elHref(t, u, ph)}">Full results & graphs ${IC.arrow}</a></div>
      <div class="tbl-wrap"><table class="t prog pu-t"><thead><tr><th>${t === 'dga' ? 'Compartment' : t === 'winding' ? 'Insulation (mode)' : 'Bushing'}</th><th>Latest test</th>${head.map(h => `<th class="r">${h}</th>`).join('')}<th>Status</th><th class="r">Next due</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('');
  mount.innerHTML = `<section class="asset has-art pu-hero" style="--phc:${PHC[ph]}"><div><div class="eyebrow">Power transformer · single-phase auto-transformer unit</div>
      <div class="row-flex"><span class="puc-ph big">${ph}</span><h1>${esc(unitName(u))} — ${ph}-phase unit</h1></div>
      <div class="pu-facts"><div><span>Serial no.</span><b>${esc(sr)}</b></div><div><span>Rating</span><b>167 MVA · 400/√3 / 220/√3 / 33 kV</b></div><div><span>Make</span><b>${esc(DB.site.units[u]?.make || '—')}</b></div><div><span>Commissioned</span><b>${DB.site.units[u]?.commissioned ? fmtDate(DB.site.units[u].commissioned) : '—'}</b></div></div>
      <div class="row-flex mt">${['R', 'Y', 'B'].map(p => `<a class="btn ${p === ph ? 'pri' : ''}" href="#/pu/${u}/${p}">${p}-phase unit</a>`).join('')}<a class="btn" href="#/eq/${u}">${IC.arrow} ${esc(unitName(u))}</a></div>
      <div class="row-flex mt">${shareButtons(u, ph)}</div></div>
      <div class="asset-art">${art('transformer', { photo: `${u}-${ph}`, alt: `${unitName(u)} ${ph}-phase unit` })}</div></section>
    <div class="pu-blocks">${blocks}</div>
    <div class="np-wrap">${nameplateSection(u, ph)}</div>`;
  wireNameplates(mount); wireShare(mount);
}
