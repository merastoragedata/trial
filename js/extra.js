// Other tests recorded on a unit outside the diagnostic sheet (ratio, OC, SC, winding resistance, IR/PI),
// shown as recorded with the portal's recalculation checks.
import { fmtDate, unitName } from './data.js?v=20261126.1917';
import { esc } from './ui.js?v=20261126.1917';

let X = null;
export async function loadExtra() { if (!X) X = await fetch(`data/extra_tests.json?v=${Date.now() >> 16}`).then(r => r.json()).catch(() => ({})); return X; }
export const extraFor = (u, ph) => X?.[`${u}|${ph}`] || null;
export const extraUnits = () => Object.keys(X || {}).filter(k => k.includes('|')).map(k => { const [u, ph] = k.split('|'); return { u, ph, ...X[k] }; });

const cell = (c) => /does not reconcile/.test(c) ? `<td class="c-watch"><b>${esc(c)}</b></td>` : c === 'reconciles' ? `<td class="c-ok">${esc(c)}</td>` : `<td class="r">${esc(c)}</td>`;
export function extraSection(u, ph, { open = true } = {}) {
  const E = extraFor(u, ph); if (!E) return '';
  const nBad = E.tables.reduce((a, t) => a + t.rows.filter(r => r.some(c => /does not reconcile|not legible/.test(c))).length, 0);
  return `<details class="sec ex-sec" ${open ? 'open' : ''}><summary><span class="sec-t">🧾 Other tests · ${esc(unitName(u))}, ${ph}ph · ${esc(E.title)}</span><span class="dim">${esc(E.work)} · ${E.tables.length} tests${nBad ? ` · ${nBad} entries to verify` : ''}</span><span class="caret">▾</span></summary>
    <div class="sec-b"><p class="note">${esc(X.note || '')}</p>
    ${E.tables.map(t => `<div class="ex-t"><h3>${esc(t.title)}</h3>${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}<div class="el-tbl"><table class="t seq"><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<td><b>${esc(c)}</b></td>` : t.head[i] === 'Note' ? `<td class="ex-note">${esc(c)}</td>` : cell(c)).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}
    </div></details>`;
}
/** Cards for Results by date: other tests recorded within [from, to]. */
export function extraInRange(from, to) {
  return extraUnits().filter(e => e.dates.some(d => d >= from && d <= to)).map(e => `<a class="card ex-card" href="#/pu/${e.u}/${e.ph}"><b>🧾 ${esc(unitName(e.u))}, ${e.ph}ph — ${esc(e.title)}</b><span>${esc(e.work)} · ${e.tables.map(t => t.title.split('·')[0].trim()).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</span><small>Open the ${e.ph}-phase unit page →</small></a>`).join('');
}
