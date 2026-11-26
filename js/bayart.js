// Bay layout drawings: each switchyard bay drawn in its own electrical sequence, as on the Karjat SLD,
// with every terminal connected by the conductor actually used in that bay:
//   400 kV — IPS aluminium tube between equipment; twin conductor only for the jumper to the main bus,
//            the stub bus (tie-bay ends) and the line / ICT / reactor jumpers.
//   220 kV — line bays: single ACSR Zebra; ICT IV bays and TBC: twin ACSR Zebra;
//            bus coupler: IPS tube between equipment with quad-conductor jumpers to the buses.
// Tie bays, the bus coupler and the TBC have no lightning arrester. One pole of three is drawn.
import { DB, unitName, kvOf } from './data.js?v=20261126.1917';
import { unitStatus, worst, SEV_LABEL } from './rules.js?v=20261126.1917';
import { esc } from './ui.js?v=20261126.1917';

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
const stOf = (u, ts) => worst(ts.map(t => unitStatus(u, t))) || 'none';
const COL = { ok: '#1f8a4c', none: '#8a97a6', info: '#2f6fb3', watch: '#b7791f', alert: '#c2561b', critical: '#b4232c' };

const GY = 280, TERM = 104, BUSY = 50;   // ground, equipment terminal height, main-bus height
const DEFS = `<defs>
  <linearGradient id="baSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6e7f6"/><stop offset=".7" stop-color="#f1f6fb"/><stop offset="1" stop-color="#f7f3ea"/></linearGradient>
  <linearGradient id="baGnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bdb6a5"/><stop offset="1" stop-color="#958e7e"/></linearGradient>
  <linearGradient id="baPorc" x1="0" x2="1"><stop offset="0" stop-color="#4a2a1c"/><stop offset=".45" stop-color="#b07a58"/><stop offset=".55" stop-color="#d4a585"/><stop offset="1" stop-color="#43261a"/></linearGradient>
  <linearGradient id="baPoly" x1="0" x2="1"><stop offset="0" stop-color="#4b5058"/><stop offset=".5" stop-color="#c3c8cf"/><stop offset="1" stop-color="#43484f"/></linearGradient>
  <linearGradient id="baAl" x1="0" x2="1"><stop offset="0" stop-color="#7d8792"/><stop offset=".5" stop-color="#f2f5f8"/><stop offset="1" stop-color="#6c7682"/></linearGradient>
  <linearGradient id="baTube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".45" stop-color="#c3cbd3"/><stop offset="1" stop-color="#7c8792"/></linearGradient>
  <linearGradient id="baGalv" x1="0" x2="1"><stop offset="0" stop-color="#7f8a93"/><stop offset=".5" stop-color="#d7dde2"/><stop offset="1" stop-color="#7a848d"/></linearGradient>
  <linearGradient id="baTank" x1="0" x2="1"><stop offset="0" stop-color="#7d8891"/><stop offset=".5" stop-color="#c9d0d6"/><stop offset="1" stop-color="#7d8891"/></linearGradient>
</defs>`;

function sheds(cx, y1, y2, r, kind = 'porc') {
  const g = kind === 'poly' ? 'baPoly' : 'baPorc', n = Math.max(4, Math.round((y2 - y1) / 7));
  let s = `<rect x="${cx - r * 0.42}" y="${y1}" width="${r * 0.84}" height="${y2 - y1}" fill="url(#${g})"/>`;
  for (let i = 0; i < n; i++) { const y = y1 + (i + 0.5) * (y2 - y1) / n, rr = i % 2 ? r * 0.78 : r; s += `<ellipse cx="${cx}" cy="${y}" rx="${rr}" ry="2.2" fill="url(#${g})" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>`; }
  return s;
}
const pedestal = (cx, top, w = 14) => `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${GY - top}" fill="url(#baGalv)"/><rect x="${cx - w}" y="${GY - 6}" width="${w * 2}" height="6" fill="#8b8f93"/>`;
const pad = (x, y) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2" fill="url(#baAl)" stroke="#6c7682" stroke-width=".8"/>`;

// ---- equipment; each returns { svg, L:[x,y], R:[x,y] } with its terminals at TERM height ----
function isolator(cx) {
  const a = cx - 26, b = cx + 26;
  const svg = `<g>${pedestal(a, 200, 10)}${pedestal(b, 200, 10)}<rect x="${a - 8}" y="194" width="${b - a + 16}" height="7" fill="url(#baGalv)"/>
    ${sheds(a, TERM + 10, 194, 7)}${sheds(b, TERM + 10, 194, 7)}<rect x="${a - 6}" y="${TERM + 4}" width="12" height="7" fill="url(#baAl)"/><rect x="${b - 6}" y="${TERM + 4}" width="12" height="7" fill="url(#baAl)"/>
    <path d="M${a} ${TERM} H${b}" stroke="#8d97a1" stroke-width="5" stroke-linecap="round"/><path d="M${a} ${TERM - 1} H${b}" stroke="#eef2f5" stroke-width="1.4"/>
    <rect x="${cx - 9}" y="${GY - 42}" width="18" height="22" rx="2" fill="#a9b3bc" stroke="#6e7881"/>${pad(a, TERM)}${pad(b, TERM)}</g>`;
  return { svg, L: [a, TERM], R: [b, TERM] };
}
function breaker(cx, kv, st) {
  const half = kv === 400 ? 48 : 30;
  const head = kv === 400
    ? `<rect x="${cx - half}" y="${TERM - 11}" width="${half * 2}" height="22" rx="10" fill="url(#baPoly)"/>${[-32, -16, 16, 32].map(d => `<ellipse cx="${cx + d}" cy="${TERM}" rx="2.4" ry="12" fill="#6a7079"/>`).join('')}<rect x="${cx - 11}" y="${TERM - 15}" width="22" height="30" rx="4" fill="url(#baAl)"/>`
    : `<rect x="${cx - half}" y="${TERM - 10}" width="${half * 2}" height="20" rx="9" fill="url(#baPoly)"/>${[-14, 0, 14].map(d => `<ellipse cx="${cx + d}" cy="${TERM}" rx="2.2" ry="11" fill="#6a7079"/>`).join('')}<rect x="${cx + half - 10}" y="${TERM - 13}" width="12" height="26" rx="3" fill="url(#baAl)"/>`;
  const svg = `<g>${pedestal(cx, 196, 16)}<rect x="${cx - 20}" y="${GY - 68}" width="40" height="46" rx="3" fill="#b8c1c9" stroke="#6e7881"/><circle cx="${cx}" cy="${GY - 45}" r="6" fill="${COL[st]}"/>
    <rect x="${cx - 18}" y="188" width="36" height="10" fill="url(#baGalv)"/>${sheds(cx, TERM + 15, 188, 10, 'poly')}${head}${pad(cx - half, TERM)}${pad(cx + half, TERM)}</g>`;
  return { svg, L: [cx - half, TERM], R: [cx + half, TERM] };
}
function ct(cx, st) {
  const svg = `<g>${pedestal(cx, 214, 14)}<rect x="${cx - 16}" y="206" width="32" height="10" fill="url(#baTank)"/>${sheds(cx, TERM + 18, 206, 10)}
    <rect x="${cx - 24}" y="${TERM - 14}" width="48" height="34" rx="14" fill="url(#baTank)" stroke="#5f6a73"/><path d="M${cx - 34} ${TERM} H${cx + 34}" stroke="#8d97a1" stroke-width="6"/>
    <circle cx="${cx}" cy="${TERM - 18}" r="5" fill="url(#baAl)"/><circle cx="${cx + 16}" cy="${TERM + 12}" r="5" fill="${COL[st]}"/>${pad(cx - 34, TERM)}${pad(cx + 34, TERM)}</g>`;
  return { svg, L: [cx - 34, TERM], R: [cx + 34, TERM] };
}
function arrester(cx, kv, st, drop) {
  const top = TERM + 44, units = kv === 400 ? 3 : 2, seg = (196 - top) / units;
  let s = pedestal(cx, 214, 14) + `<rect x="${cx - 14}" y="196" width="28" height="18" fill="url(#baGalv)"/>`;
  for (let i = 0; i < units; i++) s += sheds(cx, top + i * seg + 2, top + (i + 1) * seg - 2, 8, 'poly') + `<rect x="${cx - 9}" y="${top + (i + 1) * seg - 3}" width="18" height="4" fill="url(#baAl)"/>`;
  s += `<ellipse cx="${cx}" cy="${top + 6}" rx="22" ry="5" fill="none" stroke="#b8c1ca" stroke-width="3"/><rect x="${cx + 13}" y="${GY - 54}" width="16" height="18" rx="2" fill="#e8ecef" stroke="#6e7881"/><circle cx="${cx + 21}" cy="${GY - 45}" r="5" fill="${COL[st]}"/>`;
  s += drop(cx, TERM, cx, top) + `<circle cx="${cx}" cy="${TERM}" r="5" fill="#59636e"/>`;   // T-clamp on the run, dropper down to the arrester
  return { svg: `<g>${s}</g>`, L: [cx, TERM], R: [cx, TERM] };
}
// ---- bay ends ----
function busEnd(cx, label, sub, double) {
  const tubes = double ? [cx - 16, cx + 16] : [cx];
  const svg = `<g><path d="M${cx - 34} ${GY}V${BUSY - 22}H${cx + 34}V${GY}" fill="none" stroke="#8d97a1" stroke-width="3"/>${tubes.map(x => `<circle cx="${x}" cy="${BUSY}" r="11" fill="url(#baAl)" stroke="#6c7682"/><circle cx="${x}" cy="${BUSY}" r="5" fill="#9aa4ae"/>`).join('')}
    <text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-end">${esc(label)}</text>${sub ? `<text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">${esc(sub)}</text>` : ''}</g>`;
  return { svg, L: [cx, BUSY + 11], R: [cx, BUSY + 11], bus: true };
}
function lineEnd(cx, label, sub, fut) {
  const sx = cx - 52, sy = 62;
  const svg = `<g ${fut ? 'opacity=".55"' : ''}><path d="M${cx - 16} ${GY}L${cx - 6} 30h12l10 ${GY - 30}" fill="none" stroke="#6b7682" stroke-width="3"/><path d="M${cx - 13} ${GY - 70}h26M${cx - 10} ${GY - 140}h20M${cx - 8} 90h16M${cx - 13} ${GY - 70}L${cx + 10} ${GY - 140}M${cx + 13} ${GY - 70}L${cx - 10} ${GY - 140}" stroke="#6b7682" stroke-width="1.6"/>
    <path d="M${cx - 34} 44h68" stroke="#6b7682" stroke-width="3"/><path d="M${cx - 30} 44 L${sx} ${sy}" stroke="#7a4a32" stroke-width="4" stroke-dasharray="3 2"/>
    <path d="M${cx + 30} 44 L${cx + 30} 52 Q${cx + 70} 64 ${cx + 110} 40" fill="none" stroke="#59636e" stroke-width="2.4" ${fut ? 'stroke-dasharray="6 4"' : ''}/>
    <text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-end">to ${esc(label)}</text>${sub ? `<text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">${esc(sub)}</text>` : ''}</g>`;
  return { svg, L: [sx, sy], R: [sx, sy] };
}
function ictEnd(cx, label, sub, fut, reactor) {
  const bx = cx - 20;
  const svg = `<g ${fut ? 'opacity=".5"' : ''}><rect x="${cx - 46}" y="${GY - 96}" width="92" height="90" rx="4" fill="url(#baTank)" stroke="#5f6a73"/>${[0, 1, 2, 3, 4].map(i => `<rect x="${cx + 48 + i * 6}" y="${GY - 88}" width="4" height="72" fill="url(#baGalv)"/>`).join('')}
    ${reactor ? '' : `<rect x="${cx - 42}" y="${GY - 128}" width="34" height="20" rx="9" fill="url(#baTank)" stroke="#5f6a73"/>`}
    ${sheds(bx, TERM + 8, GY - 96, 7)}${pad(bx, TERM)}${sheds(cx + 18, GY - 140, GY - 96, 6)}
    <text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-end">${esc(label)}</text>${sub ? `<text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">${esc(sub)}</text>` : ''}</g>`;
  return { svg, L: [bx, TERM], R: [bx, TERM] };
}
function nodeEnd(cx, u, label) {
  const svg = `<g><circle cx="${cx}" cy="${TERM}" r="8" fill="#59636e"/><path d="M${cx} ${TERM + 8} V${GY - 70}" stroke="#59636e" stroke-width="2" stroke-dasharray="5 4"/>
    <a href="#/eq/${u}"><text x="${cx}" y="${GY - 52}" text-anchor="middle" class="ba-end ba-lnk">Bay ${u}</text><text x="${cx}" y="${GY + 22}" text-anchor="middle" class="ba-n ba-lnk">${esc(label)}</text><text x="${cx}" y="${GY + 40}" text-anchor="middle" class="ba-sub">stub bus of the diameter</text></a></g>`;
  return { svg, L: [cx, TERM], R: [cx, TERM], node: true };
}

// ---- conductors ----
function ips(x1, y1, x2, y2) {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#7c8792" stroke-width="8" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="url(#baTube)" stroke-width="6" stroke-linecap="round"/><path d="M${x1} ${y1 - 1.6} L${x2} ${y2 - 1.6}" stroke="#fbfdff" stroke-width="1.2" opacity=".9"/>`;
}
function flex(n) {
  return (x1, y1, x2, y2) => {
    const sag = 12 + Math.abs(x2 - x1) * 0.05, mx = (x1 + x2) / 2, my = Math.max(y1, y2) + sag;
    let s = '';
    for (let i = 0; i < n; i++) { const d = (i - (n - 1) / 2) * 4.2; s += `<path d="M${x1} ${y1 + d} Q${mx} ${my + d} ${x2} ${y2 + d}" fill="none" stroke="#4f5965" stroke-width="2"/>`; }
    if (n > 1) for (let k = 1; k < 4; k++) { const tt = k / 4, x = (1 - tt) ** 2 * x1 + 2 * (1 - tt) * tt * mx + tt ** 2 * x2, y = (1 - tt) ** 2 * y1 + 2 * (1 - tt) * tt * my + tt ** 2 * y2; s += `<rect x="${x - 2}" y="${y - n * 2.4}" width="4" height="${n * 4.8}" rx="1" fill="#59636e"/>`; }   // spacers
    return s;
  };
}
const CONDUCTOR = { ips: ['IPS aluminium tube', ips], single: ['single ACSR Zebra', flex(1)], twin: ['twin ACSR conductor', flex(2)], quad: ['quad-conductor jumper', flex(4)] };

/** Equipment sequence of the bay, left → right. */
function sequence(u) {
  const kv = kvOf(u), D = DIAS.find(d => d.includes(u)), k = D ? D.indexOf(u) : -1;
  const fut = /FUTURE/i.test(DB.site.bays[u] || '');
  const ct_ = has(u, 'ct') || fut, cb_ = has(u, 'cb_crm') || has(u, 'cb_timing') || fut, la_ = has(u, 'la');
  const dev = (laOn = la_) => [['iso'], cb_ && ['cb'], ct_ && ['ct'], ['iso'], laOn && ['la']].filter(Boolean);
  if (u === '200') return [['bus', '220 kV Main Bus', 'via ICT IV bay', true], ['la'], ['end']];
  if (u === '400') return [['bus', '400 kV Bus-II', 'Y-phase · keeps the spare charged'], ['iso'], ['cb'], ['ct'], ['la'], ['end']];
  if (kv === 400 && k === 1) return [['node', D[0]], ['iso'], ['ct'], ['cb'], ['iso'], ['node', D[2]]];   // tie bay
  if (kv === 400) return [['bus', k === 0 ? '400 kV Bus-I' : '400 kV Bus-II', ''], ...dev(), ['end']];
  if (u === '207') return [['bus', '220 kV Main Bus-I', ''], ['iso'], ['cb'], ['ct'], ['iso'], ['bus', '220 kV Main Bus-II', '']];
  if (u === '208') return [['bus', '220 kV Main Bus-I / II', 'via bus isolators', true], ['iso'], ['cb'], ['ct'], ['iso'], ['bus', '220 kV Transfer Bus', '']];
  return [['bus', '220 kV Main Bus-I / II', 'two bus isolators', true], ...dev(), ['end']];
}
/** Conductor between two neighbours, by voltage level and bay type. */
function conductorType(u, a, b) {
  const kv = kvOf(u), edge = (x) => ['bus', 'node', 'end'].includes(x);
  if (kv === 400) return a === 'bus' || b === 'bus' || a === 'node' || b === 'node' || ((a === 'end' || b === 'end') && ENDS[u]?.[0] === 'line') ? 'twin' : 'ips';
  if (u === '207') return a === 'bus' || b === 'bus' ? 'quad' : 'ips';
  if (['203', '204', '202', '200', '208'].includes(u)) return 'twin';
  return 'single';
}

export function bayArt(u) {
  if (!DB.site.bays[u]) return '';
  const kv = kvOf(u), fut = /FUTURE/i.test(DB.site.bays[u]), seq = sequence(u), step = 178;
  const W = 120 + (seq.length - 1) * step + 150, H = GY + 56, xs = seq.map((_, i) => 110 + i * step);
  const used = new Set(), dropT = kv === 400 ? 'ips' : conductorType(u, 'la', 'la');
  const items = seq.map(([kind, a, b, c], i) => {
    const x = xs[i];
    if (kind === 'iso') return { kind, ...isolator(x), lab: `<text x="${x}" y="${GY + 22}" text-anchor="middle" class="ba-n ba-dim">Isolator</text>` };
    if (kind === 'cb') { const s = fut ? 'none' : stOf(u, ['cb_crm', 'cb_timing']); return { kind, ...breaker(x, kv, s), lab: label(x, 'SF6 circuit breaker', fut ? 'proposed' : `CB · ${SEV_LABEL[s] || 'no data'}`, `#/eq/${u}?t=cb_crm`, s) }; }
    if (kind === 'ct') { const s = fut ? 'none' : stOf(u, ['ct']); return { kind, ...ct(x, s), lab: label(x, 'Current transformer', fut ? 'proposed' : `CT · ${SEV_LABEL[s] || 'no data'}`, `#/eq/${u}?t=ct`, s) }; }
    if (kind === 'la') { const s = stOf(u, ['la']); used.add(dropT); return { kind, ...arrester(x, kv, s, CONDUCTOR[dropT][1]), lab: label(x, 'Lightning arrester', `LA · ${SEV_LABEL[s] || 'no data'}`, `#/eq/${u}?t=la`, s) }; }
    if (kind === 'bus') return { kind, ...busEnd(x, a, b, c) };
    if (kind === 'node') return { kind, ...nodeEnd(x, a, unitName(a).replace(/^Bay \d+ - /, '').replace(/^400(\/220)? kV /, '')) };
    const [k2, l2, s2] = ENDS[u] || ['line', unitName(u), ''];
    return { kind, ...(k2 === 'line' ? lineEnd(x, l2, s2, fut) : ictEnd(x, l2, s2, fut || /proposed/.test(s2), k2 === 'reactor')) };
  });
  let wires = '';
  for (let i = 0; i < items.length - 1; i++) {
    const A = items[i], B = items[i + 1], ty = conductorType(u, A.kind, B.kind); used.add(ty);
    const [x1, y1] = A.R, [x2, y2] = B.L;
    wires += A.kind === 'bus' ? CONDUCTOR[ty][1](x1, y1, x2, y2) : CONDUCTOR[ty][1](x1, y1, x2, y2);
  }
  let g = DEFS + `<rect width="${W}" height="${H}" fill="url(#baSky)"/><rect y="${GY}" width="${W}" height="${H - GY}" fill="url(#baGnd)"/><path d="M0 ${GY}H${W}" stroke="#6f6859" stroke-width="2"/>`;
  g += `<g ${fut ? 'opacity=".75"' : ''}>${items.map(it => it.svg).join('')}${wires}${items.map(it => it.lab || '').join('')}</g>`;
  const legend = [...used].map(k => CONDUCTOR[k][0]);
  const tie = seq[0][0] === 'node';
  const cap = tie ? `Tie bay of diameter ${DIAS.findIndex(d => d.includes(u)) + 1}: joins the two feeders of the diameter through their stub buses; no lightning arrester in a tie bay.` : kv === 220 ? (u === '207' ? 'Bus coupler: connects 220 kV Main Bus-I and Main Bus-II.' : u === '208' ? 'Transfer bus coupler: takes over any feeder through the transfer bus during breaker maintenance.' : 'Double main + transfer bus bay: either main bus through its bus isolator; transfer-bus bypass available.') : 'Main bay of the one-and-a-half breaker diameter.';
  return `<figure class="bay-art"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Layout of ${esc(unitName(u))}">${g}</svg><figcaption>${esc(cap)} <b>Conductors:</b> ${esc(legend.join(' · '))}. One pole of three is drawn; coloured dots show the latest test status.</figcaption></figure>`;
}
const label = (x, name, sub, href, st) => `<a href="${href}" class="ba-it"><text x="${x}" y="${GY + 22}" text-anchor="middle" class="ba-n">${esc(name)}</text><text x="${x}" y="${GY + 40}" text-anchor="middle" class="ba-s" fill="${COL[st]}">${esc(sub)}</text></a>`;
