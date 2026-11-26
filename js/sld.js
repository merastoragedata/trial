// Single-line diagrams (IEC 60617-style symbols) for Karjat:
//   400 kV — one-and-a-half breaker scheme, 5 diameters between Bus-I and Bus-II
//   220 kV — double main bus + transfer bus, with bus coupler (207) and TBC (208)
// Breaker boxes are coloured by CB test health; feeder dots by CT / LA health;
// transformer / reactor symbols by their own health. Everything is a link.
import { DB, unitName, bayTitle } from './data.js?v=20261126.0443';
import { unitStatus, worst } from './rules.js?v=20261126.0443';
import { esc } from './ui.js?v=20261126.0443';

const has = (u, ts) => DB.records.some(r => r.unit === u && ts.includes(r.t));
const st = (u, ts) => has(u, ts) ? worst(ts.map(t => unitStatus(u, t))) : 'none';
const short = (u) => (bayTitle(u) || '').replace(/^\d+\s*kV\s*/i, '').replace(/KARJAT\s*-\s*/i, '').replace(/\s*\(.*\)\s*/, '').replace(/400\/220 kV|501 MVA|125 MVAr/gi, '').trim();
const isFuture = (u) => /FUTURE/i.test(bayTitle(u));

function cb(x, y, u, label) {
  const s = st(u, ['cb_crm', 'cb_timing']);
  return `<a href="#/eq/${u}" class="cb st-${s}${isFuture(u) ? ' fut' : ''}" aria-label="Breaker ${u} — ${esc(bayTitle(u))}"><title>Bay ${u} CB · ${esc(bayTitle(u))} · ${s === 'none' ? 'no CB test data' : 'CB tests: ' + s}</title>
    <rect x="${x - 17}" y="${y - 13}" width="34" height="26"/><text x="${x}" y="${y + 3.5}" text-anchor="middle">${label || u}</text></a>`;
}
function feederDot(x, y, u) {
  const s = st(u, ['ct', 'la']);
  const col = { critical: 'var(--crit)', alert: 'var(--alert)', watch: 'var(--watch)', ok: 'var(--ok)', info: 'var(--info)', none: 'var(--line-2)' }[s];
  return `<circle cx="${x}" cy="${y}" r="4" fill="${col}"><title>Bay ${u} CT / LA: ${s}</title></circle>`;
}
function tf(x, y, unit, dir = 1) {          // two-winding transformer symbol
  const s = unitStatus(unit);
  return `<a href="#/eq/${unit}" class="tf"><title>${esc(unitName(unit))} — ${s}</title><circle class="eq-${s}" cx="${x + dir * 12}" cy="${y}" r="10"/><circle class="eq-${s}" cx="${x + dir * 26}" cy="${y}" r="10"/></a>`;
}
function reactor(x, y, unit) {
  const s = unitStatus(unit);
  return `<a href="#/eq/${unit}" class="tf"><title>${esc(unitName(unit))} — ${s}</title><circle class="eq-${s}" cx="${x + 14}" cy="${y}" r="11"/><path class="eq-${s}" d="M${x + 3} ${y} h11 v-11" stroke-width="1.8" fill="none"/></a>`;
}
function lineArrow(x, y) { return `<path class="wire" d="M${x} ${y} h26 m-6 -5 l6 5 l-6 5"/>`; }

export function sld400() {
  const dias = [['401', '402', '403'], ['404', '405', '406'], ['407', '408', '409'], ['410', '411', '412'], ['413', '414', '415']];
  const W = 1160, top = 46, bot = 344, x0 = 70, dx = 196;
  let g = `<line class="bus" x1="28" y1="${top}" x2="${W - 20}" y2="${top}"/><line class="bus" x1="28" y1="${bot}" x2="${W - 20}" y2="${bot}"/>
    <text class="busl" x="28" y="${top - 12}">400 kV BUS-I</text><text class="busl" x="28" y="${bot + 24}">400 kV BUS-II</text>`;
  dias.forEach((d, i) => {
    const x = x0 + i * dx, yA = 98, yT = 195, yB = 292, fA = 146, fB = 244;
    g += `<text class="lbl-s" x="${x + 6}" y="${top + 16}">Dia ${i + 1}</text>`;
    g += `<path class="wire" d="M${x} ${top} V${yA - 13} M${x} ${yA + 13} V${yT - 13} M${x} ${yT + 13} V${yB - 13} M${x} ${yB + 13} V${bot}"/>`;
    g += cb(x, yA, d[0]) + cb(x, yT, d[1], d[1]) + cb(x, yB, d[2]);
    g += `<text class="lbl-s" x="${x - 24}" y="${yT + 4}" text-anchor="end">tie</text>`;
    for (const [u, fy] of [[d[0], fA], [d[2], fB]]) {
      const nm = short(u), fut = isFuture(u);
      g += `<g class="${fut ? 'fut' : ''}"><path class="wire" d="M${x} ${fy} H${x + 30}"/>${feederDot(x, fy, u)}`;
      if (u === '401') g += reactor(x + 30, fy, 'BUS_REACTOR');
      else if (u === '403') g += tf(x + 30, fy, 'ICT1');
      else if (u === '406') g += tf(x + 30, fy, 'ICT2');
      else g += lineArrow(x + 30, fy);
      const tx = x + (['401', '403', '406', '409'].includes(u) ? 72 : 64);
      g += `<a href="#/eq/${u}"><text class="lbl-b" x="${tx}" y="${fy - 3}">${esc(nm.split(/\s+CKT|\s+HV/)[0] || nm)}</text><text class="lbl-s" x="${tx}" y="${fy + 11}">${esc(u === '401' ? '125 MVAr reactor' : u === '403' || u === '406' ? '501 MVA → 220 kV' : /CKT\s*\d/.test(nm) ? 'Ckt ' + nm.match(/CKT\s*(\d)/)[1] : fut ? 'future' : '')}</text></a></g>`;
    }
  });
  // spare ICT (bay 400): standby single-phase unit
  const sx = x0 + 5 * dx + 10;
  g += `<g><text class="lbl-s" x="${sx + 16}" y="${top + 16}">Spare</text>${feederDot(sx + 10, 196, '400')}<path class="wire" d="M${sx + 10} ${top} V186"/>${tf(sx + 10, 196, 'SPARE_ICT', 1).replace(/cx="(\d+(?:\.\d+)?)"/g, (m, v) => `cx="${v}"`)}
    <a href="#/eq/400"><text class="lbl-b" x="${sx + 4}" y="${232}">Spare ICT</text><text class="lbl-s" x="${sx + 4}" y="${246}">167 MVA 1-ph</text><text class="lbl-s" x="${sx + 4}" y="${259}">bay 400 · standby</text></a></g>`;
  return `<svg class="sld" viewBox="0 0 ${W} 380" role="img" aria-label="400 kV one-and-a-half breaker single-line diagram">${g}</svg>`;
}

export function sld220() {
  const bays = ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212'];
  const W = 1160, b1 = 40, b2 = 66, tb = 286, x0 = 140, dx = 88;
  let g = `<line class="bus" x1="28" y1="${b1}" x2="${W - 20}" y2="${b1}"/><line class="bus" x1="28" y1="${b2}" x2="${W - 20}" y2="${b2}"/><line class="bus" x1="28" y1="${tb}" x2="${W - 20}" y2="${tb}" style="stroke-width:2.5;stroke-dasharray:8 5"/>
    <text class="busl" x="28" y="${b1 - 9}">220 kV MAIN BUS-I</text><text class="busl" x="28" y="${b2 + 17}">MAIN BUS-II</text><text class="busl" x="28" y="${tb + 18}">TRANSFER BUS</text>`;
  bays.forEach((u, i) => {
    const x = x0 + i * dx, yc = 140, fut = isFuture(u);
    if (u === '207') {           // bus coupler: Bus-I ↔ Bus-II
      g += `<path class="wire" d="M${x - 12} ${b1} V${yc} H${x - 17}"/><path class="wire" d="M${x + 12} ${b2} V${yc} H${x + 17}"/>`;
      g += cb(x, yc, u) + `<text class="lbl-b" x="${x}" y="${yc + 34}" text-anchor="middle">Bus</text><text class="lbl-b" x="${x}" y="${yc + 48}" text-anchor="middle">coupler</text>`;
      return;
    }
    if (u === '208') {           // TBC: main buses ↔ transfer bus
      g += `<path class="wire" d="M${x - 6} ${b1} V96 M${x + 6} ${b2} V96 M${x - 6} 96 H${x + 6} M${x} 96 V${yc - 13} M${x} ${yc + 13} V${tb}"/>`;
      g += cb(x, yc, u) + `<text class="lbl-b" x="${x + 22}" y="${yc + 40}">TBC</text>`;
      return;
    }
    g += `<g class="${fut ? 'fut' : ''}"><path class="wire" d="M${x - 6} ${b1} V96 M${x + 6} ${b2} V96 M${x - 6} 96 H${x + 6} M${x} 96 V${yc - 13} M${x} ${yc + 13} V214"/>`;
    g += `<path class="wire" d="M${x} 200 H${x + 38} V${tb}" style="stroke-dasharray:3 3"><title>Transfer-bus bypass isolator</title></path>`;
    g += cb(x, yc, u) + feederDot(x, 200, u);
    const nm = short(u);
    if (u === '203' || u === '204' || u === '202') g += `<g transform="rotate(90 ${x} 214)">${tf(x, 214, u === '203' ? 'ICT2' : u === '204' ? 'ICT1' : 'ICT1').replace(/eq-\w+/g, u === '202' ? 'eq-none' : '$&')}</g>`;
    else g += `<path class="wire" d="M${x} 214 v18 m-5 -6 l5 6 l5 -6"/>`;
    const lab = u === '203' ? 'ICT 2' : u === '204' ? 'ICT 1' : u === '202' ? 'ICT 3' : nm.replace(/\s*CKT\s*/, ' ').replace('FUTURE BAY', 'Future').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    g += `<a href="#/eq/${u}"><text class="lbl" style="font-weight:600" x="${x}" y="${u <= '204' ? 268 : 254}" text-anchor="middle">${esc(lab)}</text></a></g>`;
  });
  return `<svg class="sld" viewBox="0 0 ${W} 312" role="img" aria-label="220 kV double main and transfer bus single-line diagram">${g}</svg>`;
}

export const SLD_LEGEND = `<div class="sld-legend"><span><i style="border-color:var(--ink-3);background:var(--panel)"></i>CB tests normal</span><span><i style="border-color:var(--watch);background:var(--watch-bg)"></i>Watch</span><span><i style="border-color:var(--alert);background:var(--alert-bg)"></i>Alert</span><span><i style="border-color:var(--crit);background:var(--crit-bg)"></i>Critical</span><span><i style="border-color:var(--line-2);border-style:dashed;background:var(--panel-3)"></i>No data / future</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--ok)"/></svg>Dot = CT / LA health</span><span>Click any breaker or transformer</span></div>`;
