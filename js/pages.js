// Planning & reporting pages: pending tests by horizon, and results by date.
import { DB, TESTS, fmt, fmtDate, toDate, kvOf, isTF, unitName, bayTitle, done, recs, ELEM, sortUnits } from './data.js?v=20261126.1456';
import { elemDue, lastRowDate, statusOf } from './rules.js?v=20261126.1456';
import { model, fullName, dueTxt, fyRange, curFY, cellSev, NOUN, elHref, COLS } from './results.js?v=20261126.1456';
import { esc, $, $$, pill } from './ui.js?v=20261126.1456';
import { extraInRange } from './extra.js?v=20261126.1456';
import { IC } from './icons.js?v=20261126.1456';

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const days = (d) => Math.round((d - DB.today) / 864e5);
const TKEYS = () => Object.keys(TESTS);
const testChips = (sel, base) => `<div class="seg wrap">${[['all', 'All tests'], ...TKEYS().map(t => [t, TESTS[t].short || TESTS[t].name])].map(([k, l]) => `<a class="${sel === k ? 'on' : ''}" href="${base(k)}">${esc(l)}</a>`).join('')}</div>`;
const qs = (o) => '?' + Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// the value(s) that matter most for each test — shown as the last result in the planning lists
const KEYV = { ct: [['tand20', 'tan δ', '%', 3], ['C', 'C', 'pF', 1]], bushing: [['tand20', 'tan δ', '%', 3], ['C', 'C', 'pF', 1]], winding: [['tand20', 'tan δ', '%', 3], ['C', 'C', 'pF', 1]],
  cb_crm: [['R', 'R', 'µΩ', 1]], cb_timing: [['open1', 'Trip TC1', 'ms', 1], ['open2', 'Trip TC2', 'ms', 1], ['close', 'Close', 'ms', 1]], la: [['Icorr', 'Icorr', 'µA', 0]], dga: [['TDCG', 'TDCG', 'ppm', 0], ['C2H2', 'C₂H₂', 'ppm', 1]] };
export function keyVals(t, L) {
  if (!L) return '<span class="dim">—</span>';
  return KEYV[t].filter(([k]) => L.v[k] != null).map(([k, lab, un, dp]) => { const sv = cellSev(t, k, L.v[k], L); return `<span class="kv1 ${sv && sv !== 'ok' ? 'c-' + sv : ''}"><i>${lab}</i> <b>${fmt(L.v[k], dp)}</b> <small>${un}</small></span>`; }).join('') || '<span class="dim">no reading</span>';
}

// ------------------------------------------------------------------ pending tests
/** Every element whose next due date (from its own latest test, else commissioning) falls on or before the horizon. */
export function pendingPage(mount, q, head) {
  const today = DB.today, fyEnd = fyRange(curFY())[1];
  const h = q.get('h') || '30', tSel = q.get('t') || 'all';
  const horizon = h === 'fy' ? fyEnd : h === 'date' ? (q.get('to') ? toDate(q.get('to')) : addDays(today, 30)) : addDays(today, +h);
  const base = (o) => '#/pending' + qs({ h, to: q.get('to'), t: tSel, ...o });
  const tests = tSel === 'all' ? TKEYS() : [tSel];
  const all = [];
  for (const t of tests) for (const e of model(t).elements) {
    const due = elemDue(t, e.u, lastRowDate(e.rows)); if (!due || due > horizon) continue;
    all.push({ t, e, due });
  }
  const od = all.filter(x => x.due < today).length;
  const card = (t) => { const n = all.filter(x => x.t === t), o = n.filter(x => x.due < today).length;
    return `<a class="pcard ${n.length ? '' : 'zero'}" href="javascript:void 0" data-jump="pend-${t}" title="Show the ${esc(TESTS[t].name)} list below"><span class="pc-ic">${IC[t]}</span><span class="pc-n">${n.length}</span><span class="pc-k">${esc(TESTS[t].name)}</span><span class="pc-d">${o ? `<b class="due due-red">${o} overdue</b>` : '<span class="dim">none overdue</span>'}</span></a>`; };
  const sect = (t) => { const L = all.filter(x => x.t === t).sort((a, b) => a.due - b.due); if (!L.length) return '';
    const byU = new Map(); for (const x of L) { if (!byU.has(x.e.u)) byU.set(x.e.u, []); byU.get(x.e.u).push(x); }
    return `<details class="sec" open id="pend-${t}"><summary><span class="sec-t">${IC[t]} ${esc(TESTS[t].name)}</span><span class="dim">${L.length} ${NOUN[t][L.length === 1 ? 0 : 1]} in ${byU.size} ${byU.size === 1 ? 'bay / unit' : 'bays / units'} · ${L.filter(x => x.due < today).length} overdue</span><span class="caret">▾</span></summary>
      <div class="sec-b"><div class="tbl-wrap"><table class="t prog pend"><thead><tr><th style="min-width:300px">Bay / unit</th><th style="min-width:230px">${esc(NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1))}</th><th class="r">Last tested</th><th class="r" style="min-width:200px">Last result</th><th class="r">Next due</th><th class="r">Days</th><th></th></tr></thead><tbody>
      ${[...byU].map(([u, xs]) => xs.map((x, i) => `<tr>${i === 0 ? `<td rowspan="${xs.length}" class="pu-cell"><a href="#/eq/${esc(u)}?t=${t}"><b>${esc(unitName(u))}</b></a><div class="dim">${esc(isTF(u) ? DB.site.units[u].rating : bayTitle(u))}</div></td>` : ''}
        <td><a href="${elHref(t, u, x.e.sub)}">${esc(fullName(t, u, x.e.sub, true))}</a></td><td class="r">${x.e.L ? fmtDate(x.e.L.date) : '<span class="dim">never tested</span>'}</td><td class="r keyv">${keyVals(t, x.e.L)}</td><td class="r">${dueTxt(x.due)}</td>
        <td class="r">${x.due < today ? `<b class="due due-red">${-days(x.due)} d overdue</b>` : `in ${days(x.due)} d`}</td><td><a class="btn sm ghost" href="${elHref(t, u, x.e.sub)}">Open ${IC.arrow}</a></td></tr>`).join('')).join('')}
      </tbody></table></div></div></details>`; };
  mount.innerHTML = head('Planning', 'Pending tests', `Every CT, bushing, winding insulation, oil sampling point, CB pole and LA whose next due date falls on or before the chosen date — counted from its own latest completed test (never tested: commissioning + circular interval). Overdue items are always included.`, `<button class="btn" onclick="window.print()">${IC.print}Print / PDF</button>`)
    + `<section class="card filt"><div class="filt-r"><span class="filt-k">Due within</span><div class="seg">${[['30', 'Next 30 days'], ['60', 'Next 60 days'], ['90', 'Next 90 days'], ['fy', `This FY (to ${fmtDate(fyEnd)})`]].map(([k, l]) => `<a class="${h === k ? 'on' : ''}" href="${base({ h: k })}">${l}</a>`).join('')}</div>
        <label class="filt-d ${h === 'date' ? 'on' : ''}">Up to <input type="date" id="pendTo" value="${h === 'date' ? iso(horizon) : ''}"></label></div>
      <div class="filt-r"><span class="filt-k">Test</span>${testChips(tSel, (k) => base({ t: k }))}</div>
      <div class="filt-sum"><b>${all.length}</b> pending up to <b>${fmtDate(horizon)}</b> · <b class="due due-red">${od} overdue</b> · ${all.length - od} falling due</div></section>
    ${tSel === 'all' ? `<div class="pcards">${TKEYS().map(card).join('')}</div>` : ''}
    ${tests.map(sect).join('') || '<div class="empty">Nothing pending up to this date.</div>'}`;
  mount.querySelectorAll('[data-jump]').forEach(a => a.onclick = (e) => { e.preventDefault(); const sec = document.getElementById(a.dataset.jump); if (sec) { sec.open = true; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  const inp = $('#pendTo', mount); if (inp) inp.onchange = () => { if (inp.value) location.hash = '#/pending' + qs({ h: 'date', to: inp.value, t: tSel }); };
}

// ------------------------------------------------------------------ results by date
const KEYC = { ct: ['C', 'tand', 'temp', 'tand20', 'dTand', 'dC'], bushing: ['C', 'tand', 'temp', 'tand20', 'dTand', 'dC'], winding: ['C', 'tand', 'temp', 'tand20', 'dTand', 'dC'],
  cb_crm: ['R', 'I'], cb_timing: ['open1', 'co1', 'close', 'open2', 'co2'], la: ['Ith', 'Icorr', 'Itotal', 'IRtot'], dga: ['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2', 'TDCG', 'BDV', 'H2O'] };
export function resultsPage(mount, q, head) {
  const m = q.get('m') || 'fy', tSel = q.get('t') || 'all';
  const [fs, fe] = fyRange(curFY());
  let from, to;
  if (m === 'day') { from = to = q.get('d') || iso(DB.today); }
  else if (m === 'range') { from = q.get('from') || iso(fs); to = q.get('to') || iso(DB.today); }
  else { from = iso(fs); to = iso(fe); }
  const base = (o) => '#/results' + qs({ m, d: q.get('d'), from: q.get('from'), to: q.get('to'), t: tSel, ...o });
  const tests = tSel === 'all' ? TKEYS() : [tSel];
  const pick = (t) => recs(t).filter(r => done(r) && r.date >= from && r.date <= to).sort((a, b) => sortUnits(a.unit, b.unit) || a.date.localeCompare(b.date) || (a.ph || '').localeCompare(b.ph || ''));
  const sets = tests.map(t => [t, pick(t)]);
  const total = sets.reduce((a, [, r]) => a + r.length, 0);
  const sevOf = (t, r) => { const s = statusOf(r); return s === 'none' ? 'ok' : s; };
  const sect = ([t, rs]) => { if (!rs.length) return '';
    const cols = KEYC[t].map(k => COLS[t].find(c => c.k === k)).filter(Boolean);
    const issues = rs.filter(r => ['alert', 'critical'].includes(sevOf(t, r))).length;
    return `<details class="sec" open><summary><span class="sec-t">${IC[t]} ${esc(TESTS[t].name)}</span><span class="dim">${rs.length} result${rs.length === 1 ? '' : 's'} · ${new Set(rs.map(r => r.unit)).size} bays / units${issues ? ` · ${issues} beyond the circular` : ''}</span><span class="caret">▾</span></summary>
      <div class="sec-b"><div class="el-tbl"><table class="t seq"><thead><tr><th style="min-width:110px">Date of test</th><th style="min-width:240px">Bay / unit</th><th style="min-width:180px">${esc(NOUN[t][0][0].toUpperCase() + NOUN[t][0].slice(1))}</th>${cols.map(c => `<th class="r" style="min-width:78px">${c.label}</th>`).join('')}<th style="min-width:110px">Status</th><th style="min-width:180px">Remarks</th></tr></thead><tbody>
      ${rs.map(r => { const sub = ELEM[t](r).split('|').slice(1).join('|'), s = sevOf(t, r);
        return `<tr><td class="dt">${fmtDate(r.date)}</td><td><a href="#/eq/${esc(r.unit)}?t=${t}"><b>${esc(unitName(r.unit))}</b></a> <span class="dim">${esc(isTF(r.unit) ? '' : bayTitle(r.unit))}</span></td><td><a href="${elHref(t, r.unit, sub)}">${esc(fullName(t, r.unit, sub, true))}${t === 'dga' && r.pos !== 'OLTC' ? ` <span class="dim">(${esc((r.pos || '').toLowerCase())})</span>` : ''}</a></td>
          ${cols.map(c => { const v = r.v[c.k], sv = cellSev(t, c.k, v, r); return `<td class="r ${sv ? 'c-' + sv : ''} ${['dTand', 'dC'].includes(c.k) ? 'chgc' : ''}">${fmt(v, c.dp)}</td>`; }).join('')}
          <td>${pill(s, s === 'ok' ? 'Normal' : undefined)}</td><td class="rem">${esc(r.rem || '')}</td></tr>`; }).join('')}
      </tbody></table></div></div></details>`; };
  mount.innerHTML = head('Reporting', 'Test results by date', 'Every completed test in the chosen period — this financial year, between two dates, or on one day — test-wise, with the key readings coloured against the circular and industry limits.', `<button class="btn" onclick="window.print()">${IC.print}Print / PDF</button>`)
    + `<section class="card filt"><div class="filt-r"><span class="filt-k">Period</span><div class="seg">${[['fy', `This FY ${curFY()}`], ['range', 'Between dates'], ['day', 'On one date']].map(([k, l]) => `<a class="${m === k ? 'on' : ''}" href="${base({ m: k })}">${l}</a>`).join('')}</div>
        ${m === 'range' ? `<label class="filt-d on">From <input type="date" id="rFrom" value="${from}"></label><label class="filt-d on">To <input type="date" id="rTo" value="${to}"></label>` : ''}
        ${m === 'day' ? `<label class="filt-d on">Date <input type="date" id="rDay" value="${from}"></label>` : ''}</div>
      <div class="filt-r"><span class="filt-k">Test</span>${testChips(tSel, (k) => base({ t: k }))}</div>
      <div class="filt-sum"><b>${total}</b> completed test result${total === 1 ? '' : 's'} ${from === to ? `on <b>${fmtDate(from)}</b>` : `from <b>${fmtDate(from)}</b> to <b>${fmtDate(to)}</b>`}${m === 'day' ? ` · dates with tests nearby: ${nearDates(from).map(d => `<a href="${base({ m: 'day', d })}">${fmtDate(d)}</a>`).join(' · ') || '—'}` : ''}</div></section>
    ${tSel === 'all' || ['bushing', 'winding'].includes(tSel) ? extraInRange(from, to) : ''}
    ${sets.map(sect).join('') || '<div class="empty">No completed test in this period.</div>'}`;
  const go = (o) => { location.hash = base(o); };
  const f = $('#rFrom', mount), tt = $('#rTo', mount), d = $('#rDay', mount);
  if (f) f.onchange = () => go({ from: f.value }); if (tt) tt.onchange = () => go({ to: tt.value }); if (d) d.onchange = () => go({ d: d.value });
}
// the test dates closest to a chosen day (helps when nothing was tested on it)
function nearDates(day) {
  const ds = [...new Set(DB.records.filter(done).map(r => r.date))].sort((a, b) => Math.abs(toDate(a) - toDate(day)) - Math.abs(toDate(b) - toDate(day)));
  return ds.slice(0, 5).sort();
}
