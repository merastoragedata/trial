// Bay layout drawings: each switchyard bay drawn in its own electrical sequence, as on the Karjat SLD.
//   400 kV (one-and-a-half breaker): main bays (bus → isolator → CB → CT → isolator → LA → line / ICT / reactor),
//   tie bays (feeder A → isolator → CT → CB → isolator → feeder B; no LA in a tie bay).
//   220 kV (double main + transfer bus): bus isolators → CB → CT → line isolator → LA → line / ICT,
//   bus coupler (Main Bus-I ↔ Main Bus-II) and TBC (main buses ↔ transfer bus) have no LA.
// Only equipment that exists in the bay is drawn; each CT, CB and LA is coloured by its test status and links to it.
import { DB, unitName, kvOf } from './data.js?v=20261126.1804';
import { unitStatus, worst, SEV_LABEL } from './rules.js?v=20261126.1804';
import { esc } from './ui.js?v=20261126.1804';

const DIAS = [['401', '402', '403'], ['404', '405', '406'], ['407', '408', '409'], ['410', '411', '412'], ['413', '414', '415']];
const ENDS = {
  '404': ['line', '400 kV Girawali S/S', 'MSPGCL Parli generation'], '407': ['line', '400 kV Girawali S/S', 'MSPGCL Parli generation'],
  '410': ['line', '400 kV Lonikand S/S', 'Pune load centre'], '413': ['line', '400 kV Lonikand S/S', 'Pune load centre'],
  '412': ['line', '765/400 kV Pune East S/S', 'proposed quad-bundled line'], '415': ['line', '765/400 kV Pune East S/S', 'proposed quad-bundled line'],
  '401': ['reactor', '125 MVAr Bus Reactor', 'TBEA'], '403': ['ict', '501 MVA ICT 1 (HV)', '3 × 167 MVA 1-ph'], '406': ['ict', '501 MVA ICT 2 (HV)', '3 × 167 MVA 1-ph'],
  '409': ['ict', '501 MVA ICT 3 (HV)', 'proposed'], '400': ['ict', '167 MVA Spare ICT (HV)', 'standby 1-ph unit'],
  '205': ['line', '220 kV Ahilyanagar S/S', ''], '206': ['line', '220 kV Bhose S/S', ''], '209': ['line', '220 kV Shirsuphal S/S', ''], '210': ['line', '220 kV Bhigwan S/S', ''],
  '211': ['line', '220 kV Jeur S/S', 'Ckt 1'], '212': ['line', '220 kV Jeur S/S', 'Ckt 2'], '201': ['line', 'Future 220 kV feeder', ''],
  '203': ['ict', '501 MVA ICT 2 (IV)', '220 kV side'], '204': ['ict', '501 MVA ICT 1 (IV)', '220 kV side'], '202': ['ict', '501 MVA ICT 3 (IV)', 'proposed'],
  '200': ['ict', '167 MVA Spare ICT (IV)', '220 kV side'],
};
const has = (u, t) => DB.all.some(r => r.unit === u && r.t === t) || (DB.site.population?.[t] || []).some(([b]) => String(b) === u);
const stOf = (u, ts) => { const s = worst(ts.map(t => unitStatus(u, t))); return s || 'none'; };
const COL = { ok: '#1f8a4c', none: '#8a97a6', info: '#2f6fb3', watch: '#b7791f', alert: '#c2561b', critical: '#b4232c' };

const GY = 268, TERM = 92;   // ground line, equipment terminal height
const DEFS = `<defs>
  <linearGradient id="baSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6e7f6"/><stop offset=".7" stop-color="#f1f6fb"/><stop offset="1" stop-color="#f7f3ea"/></linearGradient>
  <linearGradient id="baGnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bdb6a5"/><stop offset="1" stop-color="#958e7e"/></linearGradient>
  <linearGradient id="baPorc" x1="0" x2="1"><stop offset="0" stop-color="#4a2a1c"/><stop offset=".45" stop-color="#b07a58"/><stop offset=".55" stop-color="#d4a585"/><stop offset="1" stop-color="#43261a"/></linearGradient>
  <linearGradient id="baPoly" x1="0" x2="1"><stop offset="0" stop-color="#4b5058"/><stop offset=".5" stop-color="#c3c8cf"/><stop offset="1" stop-color="#43484f"/></linearGradient>
  <linearGradient id="baAl" x1="0" x2="1"><stop offset="0" stop-color="#7d8792"/><stop offset=".5" stop-color="#f2f5f8"/><stop offset="1" stop-color="#6c7682"/></linearGradient>
  <linearGradient id="baGalv" x1="0" x2="1"><stop offset="0" stop-color="#7f8a93"/><stop offset=".5" stop-color="#d7dde2"/><stop offset="1" stop-color="#7a848d"/></linearGradient>
  <linearGradient id="baTank" x1="0" x2="1"><stop offset="0" stop-color="#7d8891"/><stop offset=".5" stop-color="#c9d0d6"/><stop offset="1" stop-color="#7d8891"/></linearGradient>
</defs>`;

function sheds(cx, y1, y2, r, kind = 'porc') {
  const n = Math.max(4, Math.round((y2 - y1) / 7)); let s = `<rect x="${cx - r * 0.42}" y="${y1}" width="${r * 0.84}" height="${y2 - y1}" fill="url(#ba${kind === 'poly' ? 'Poly' : 'Porc'})"/>`;
  for (let i = 0; i < n; i++) { const y = y1 + (i + 0.5) * (y2 - y1) / n, rr = i % 2 ? r * 0.78 : r; s += `<ellipse cx="${cx}" cy="${y}" rx="${rr}" ry="2.2" fill="url(#ba${kind === 'poly' ? 'Poly' : 'Porc'})" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>`; }
  return s;
}
const pedestal = (cx, top, w = 14) => `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${GY - top}" fill="url(#baGalv)"/><rect x="${cx - w}" y="${GY - 6}" width="${w * 2}" height="6" fill="#8b8f93"/>`;

// ---- equipment (one pole shown; the bay has three) ----
function isolator(cx) {
  const t = TERM + 8;
  return `<g>${pedestal(cx - 22, 196, 10)}${pedestal(cx + 22, 196, 10)}<rect x="${cx - 30}" y="190" width="60" height="7" fill="url(#baGalv)"/>
    ${sheds(cx - 22, t + 6, 190, 7)}${sheds(cx + 22, t + 6, 190, 7)}
    <rect x="${cx - 27}" y="${t}" width="10" height="7" fill="url(#baAl)"/><rect x="${cx + 17}" y="${t}" width="10" height="7" fill="url(#baAl)"/>
    <path d="M${cx - 22} ${t + 2} H${cx + 22}" stroke="#9aa4ae" stroke-width="5" stroke-linecap="round"/><path d="M${cx - 22} ${t + 1} H${cx + 22}" stroke="#eef2f5" stroke-width="1.5"/>
    <rect x="${cx - 9}" y="${GY - 40}" width="18" height="22" rx="2" fill="#a9b3bc" stroke="#6e7881"/></g>`;
}
function breaker(cx, kv, st) {
  const c = COL[st];
  const head = kv === 400
    ? `<rect x="${cx - 46}" y="${TERM - 2}" width="92" height="20" rx="9" fill="url(#baPoly)"/>${[-30, -14, 14, 30].map(d => `<ellipse cx="${cx + d}" cy="${TERM + 8}" rx="2.4" ry="11" fill="#6a7079"/>`).join('')}<rect x="${cx - 10}" y="${TERM - 6}" width="20" height="28" rx="4" fill="url(#baAl)"/>`
    : `<rect x="${cx - 11}" y="${TERM - 4}" width="22" height="40" rx="8" fill="url(#baPoly)"/>${[0, 1, 2, 3].map(i => `<ellipse cx="${cx}" cy="${TERM + 2 + i * 9}" rx="14" ry="2.4" fill="#6a7079"/>`).join('')}`;
  return `<g>${pedestal(cx, 196, 16)}<rect x="${cx - 20}" y="${GY - 66}" width="40" height="44" rx="3" fill="#b8c1c9" stroke="#6e7881"/><circle cx="${cx}" cy="${GY - 44}" r="5" fill="${c}"/>
    <rect x="${cx - 18}" y="188" width="36" height="10" fill="url(#baGalv)"/>${sheds(cx, kv === 400 ? TERM + 20 : TERM + 38, 188, 10, 'poly')}${head}</g>`;
}
function ct(cx, st) {
  return `<g>${pedestal(cx, 214, 14)}<rect x="${cx - 16}" y="206" width="32" height="10" fill="url(#baTank)"/>${sheds(cx, TERM + 30, 206, 10)}
    <rect x="${cx - 22}" y="${TERM + 4}" width="44" height="28" rx="12" fill="url(#baTank)" stroke="#5f6a73"/><rect x="${cx - 30}" y="${TERM + 12}" width="60" height="6" fill="url(#baAl)"/>
    <circle cx="${cx}" cy="${TERM + 2}" r="5" fill="url(#baAl)"/><circle cx="${cx + 15}" cy="${TERM + 18}" r="4" fill="${COL[st]}"/></g>`;
}
function arrester(cx, kv, st) {
  const units = kv === 400 ? 3 : 2, top = TERM + (kv === 400 ? 14 : 44), seg = (196 - top) / units;
  let s = pedestal(cx, 214, 14) + `<rect x="${cx - 14}" y="196" width="28" height="18" fill="url(#baGalv)"/>`;
  for (let i = 0; i < units; i++) s += sheds(cx, top + i * seg + 2, top + (i + 1) * seg - 2, 8, 'poly') + `<rect x="${cx - 9}" y="${top + (i + 1) * seg - 3}" width="18" height="4" fill="url(#baAl)"/>`;
  s += `<ellipse cx="${cx}" cy="${top + 8}" rx="22" ry="5" fill="none" stroke="#b8c1ca" stroke-width="3"/><rect x="${cx + 12}" y="${GY - 52}" width="14" height="16" rx="2" fill="#e8ecef" stroke="#6e7881"/><circle cx="${cx + 19}" cy="${GY - 44}" r="4" fill="${COL[st]}"/>`;
  return `<g>${s}</g>`;
}
// ---- bay ends ----
function busEnd(cx, label, sub) {
  return `<g><rect x="${cx - 4}" y="${TERM - 6}" width="8" height="${GY - TERM + 6}" fill="url(#baGalv)"/><circle cx="${cx}" cy="${TERM}" r="11" fill="url(#baAl)" stroke="#6c7682"/><circle cx="${cx}" cy="${TERM}" r="5" fill="#9aa4ae"/>
    <text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-end">${esc(label)}</text>${sub ? `<text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">${esc(sub)}</text>` : ''}</g>`;
}
function lineEnd(cx, label, sub, fut) {
  return `<g ${fut ? 'opacity=".55"' : ''}><path d="M${cx - 16} ${GY}L${cx - 6} 30h12l10 ${GY - 30}" fill="none" stroke="#6b7682" stroke-width="3"/><path d="M${cx - 13} ${GY - 70}h26M${cx - 10} ${GY - 140}h20M${cx - 8} 90h16M${cx - 13} ${GY - 70}L${cx + 10} ${GY - 140}M${cx + 13} ${GY - 70}L${cx - 10} ${GY - 140}" stroke="#6b7682" stroke-width="1.6"/>
    <path d="M${cx - 30} 40h60" stroke="#6b7682" stroke-width="3"/><path d="M${cx + 30} 40 l60 -16" stroke="#59636e" stroke-width="2" ${fut ? 'stroke-dasharray="6 4"' : ''}/>
    <text x="${cx + 4}" y="${GY + 22}" text-anchor="middle" class="ba-end">to ${esc(label)}</text>${sub ? `<text x="${cx + 4}" y="${GY + 40}" text-anchor="middle" class="ba-sub">${esc(sub)}</text>` : ''}</g>`;
}
function ictEnd(cx, label, sub, fut, reactor) {
  return `<g ${fut ? 'opacity=".5"' : ''}><rect x="${cx - 44}" y="${GY - 92}" width="88" height="86" rx="4" fill="url(#baTank)" stroke="#5f6a73"/>${[0, 1, 2, 3, 4].map(i => `<rect x="${cx + 46 + i * 6}" y="${GY - 84}" width="4" height="70" fill="url(#baGalv)"/>`).join('')}
    ${reactor ? '' : `<rect x="${cx - 40}" y="${GY - 124}" width="34" height="20" rx="9" fill="url(#baTank)" stroke="#5f6a73"/>`}
    ${sheds(cx - 18, TERM + 8, GY - 92, 7)}<circle cx="${cx - 18}" cy="${TERM + 4}" r="5" fill="url(#baAl)"/>${sheds(cx + 18, GY - 140, GY - 92, 6)}
    <text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-end">${esc(label)}</text>${sub ? `<text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">${esc(sub)}</text>` : ''}</g>`;
}
function nodeEnd(cx, u, label, right) {
  const tx = right ? cx + 14 : cx - 14, an = right ? 'end' : 'start';
  return `<g><circle cx="${cx}" cy="${TERM}" r="7" fill="#59636e"/><path d="M${cx} ${TERM} V${GY - 70}" stroke="#59636e" stroke-width="2" stroke-dasharray="5 4"/>
    <a href="#/eq/${u}"><text x="${cx}" y="${GY - 52}" text-anchor="middle" class="ba-end ba-lnk">Bay ${u}</text><text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-n ba-lnk">${esc(label)}</text><text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">to the other side of the tie →</text></a></g>`;
}

/** Equipment sequence of the bay, left → right. */
function sequence(u) {
  const kv = kvOf(u), D = DIAS.find(d => d.includes(u)), k = D ? D.indexOf(u) : -1;
  const fut = /FUTURE/i.test(DB.site.bays[u] || '');
  const ct_ = has(u, 'ct') || fut, cb_ = has(u, 'cb_crm') || has(u, 'cb_timing') || fut, la_ = has(u, 'la');
  const dev = (iso1, iso2, laOn = la_) => [iso1 && ['iso'], cb_ && ['cb'], ct_ && ['ct'], iso2 && ['iso'], laOn && ['la']].filter(Boolean);
  if (u === '200') return [['bus', '220 kV Main Bus', 'via ICT 1/2 IV bay'], ['la'], ['end']];
  if (u === '400') return [['bus', '400 kV Bus', 'spare connection'], ['cb'], ['ct'], ['la'], ['end']];
  if (kv === 400 && k === 1) {   // tie bay between the two feeders of the diameter
    return [['node', D[0]], ['iso'], ['ct'], ['cb'], ['iso'], ['node', D[2]]];
  }
  if (kv === 400) return [['bus', k === 0 ? '400 kV Bus-I' : '400 kV Bus-II', ''], ...dev(true, true), ['end']];
  if (u === '207') return [['bus', '220 kV Main Bus-I', ''], ['iso'], ['cb'], ['ct'], ['iso'], ['bus', '220 kV Main Bus-II', '']];
  if (u === '208') return [['bus', '220 kV Main Bus-I / II', 'via bus isolators'], ['iso'], ['cb'], ['ct'], ['iso'], ['bus', '220 kV Transfer Bus', '']];
  return [['bus', '220 kV Main Bus-I / II', 'two bus isolators'], ...dev(true, true), ['end']];
}

export function bayArt(u) {
  if (!DB.site.bays[u]) return '';
  const kv = kvOf(u), fut = /FUTURE/i.test(DB.site.bays[u]), seq = sequence(u), step = 175;
  const W = 110 + seq.length * step + 40, H = GY + 56, xs = seq.map((_, i) => 120 + i * step);
  let g = DEFS + `<rect width="${W}" height="${H}" fill="url(#baSky)"/><rect y="${GY}" width="${W}" height="${H - GY}" fill="url(#baGnd)"/><path d="M0 ${GY}H${W}" stroke="#6f6859" stroke-width="2"/>`;
  // gantry
  g += `<path d="M30 ${GY}V30H${W - 30}V${GY}" fill="none" stroke="#9aa4ae" stroke-width="3" opacity=".6"/>`;
  // conductor between terminals
  const tx = xs.map((x, i) => seq[i][0] === 'iso' ? [x - 22, x + 22] : [x, x]);
  for (let i = 0; i < seq.length - 1; i++) { const a = tx[i][1], b = tx[i + 1][0], ya = seq[i][0] === 'iso' ? TERM + 10 : TERM, yb = seq[i + 1][0] === 'iso' ? TERM + 10 : TERM;
    g += `<path d="M${a} ${ya} Q${(a + b) / 2} ${Math.max(ya, yb) + 18} ${b} ${yb}" fill="none" stroke="#59636e" stroke-width="2.6" ${fut ? 'stroke-dasharray="7 5"' : ''}/>`; }
  const lab = (x, name, sub, href, st) => `<a href="${href}" class="ba-it"><text x="${x}" y="${GY + 22}" text-anchor="middle" class="ba-n">${esc(name)}</text><text x="${x}" y="${GY + 40}" text-anchor="middle" class="ba-s" fill="${COL[st]}">${esc(sub)}</text></a>`;
  seq.forEach(([kind, a, b], i) => {
    const x = xs[i];
    if (kind === 'iso') { g += isolator(x) + `<text x="${x}" y="${GY + 22}" text-anchor="middle" class="ba-n ba-dim">Isolator</text>`; return; }
    if (kind === 'cb') { const s = fut ? 'none' : stOf(u, ['cb_crm', 'cb_timing']); g += breaker(x, kv, s) + lab(x, kv === 400 ? 'SF6 circuit breaker' : 'SF6 circuit breaker', fut ? 'proposed' : `CB · ${SEV_LABEL[s] || 'no data'}`, `#/eq/${u}?t=cb_crm`, s); return; }
    if (kind === 'ct') { const s = fut ? 'none' : stOf(u, ['ct']); g += ct(x, s) + lab(x, 'Current transformer', fut ? 'proposed' : `CT · ${SEV_LABEL[s] || 'no data'}`, `#/eq/${u}?t=ct`, s); return; }
    if (kind === 'la') { const s = stOf(u, ['la']); g += arrester(x, kv, s) + lab(x, 'Lightning arrester', `LA · ${SEV_LABEL[s] || 'no data'}`, `#/eq/${u}?t=la`, s); return; }
    if (kind === 'bus') { g += busEnd(x, a, b); return; }
    if (kind === 'node') { g += nodeEnd(x, a, unitName(a).replace(/^Bay \d+ - /, '').replace(/^400(\/220)? kV /, ''), i > 0); return; }
    if (kind === 'end') { const [k2, l2, s2] = ENDS[u] || ['line', unitName(u), '']; g += k2 === 'line' ? lineEnd(x, l2, s2, fut) : ictEnd(x, l2, s2, fut || /proposed/.test(s2), k2 === 'reactor'); }
  });
  const tie = seq[0][0] === 'node';
  const cap = tie ? `Tie bay of diameter ${DIAS.findIndex(d => d.includes(u)) + 1}: joins the two feeders of the diameter; no lightning arrester in a tie bay.` : kv === 220 ? (u === '207' ? 'Bus coupler: connects 220 kV Main Bus-I and Main Bus-II.' : u === '208' ? 'Transfer bus coupler: takes over any feeder through the transfer bus during breaker maintenance.' : 'Double main + transfer bus bay: either main bus through its bus isolator; transfer-bus bypass available.') : 'Main bay of the one-and-a-half breaker diameter.';
  return `<figure class="bay-art"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Layout of ${esc(unitName(u))}">${g}</svg><figcaption>${esc(cap)} One pole of three is drawn; coloured dots show the latest test status.</figcaption></figure>`;
}
