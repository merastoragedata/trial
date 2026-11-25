// Technical illustrations of EHV equipment (SVG, theme-aware), with a nameplate.
// A site photo placed at assets/photos/<asset>.jpg (e.g. ICT1.jpg, 403.jpg)
// automatically replaces the illustration.
import { esc } from './ui.js';

const P = { porc: '#8a6a52', porcD: '#6e523f', porcL: '#a8866b', steel: '#8e9aa8', steelD: '#66727f', steelL: '#c4ccd6', tank: '#5f7a8c', tankD: '#465d6c', tankL: '#7d97a8', al: '#b7c0ca', ring: '#c9d1da', cu: '#b87333' };

function sheds(x, y, h, w, n, col = P.porc, colD = P.porcD) {           // porcelain insulator with sheds
  let s = `<rect x="${x - w * 0.28}" y="${y}" width="${w * 0.56}" height="${h}" fill="${colD}"/>`;
  for (let i = 0; i < n; i++) {
    const yy = y + (i + 0.5) * h / n, big = i % 2 === 0, ww = big ? w : w * 0.8;
    s += `<ellipse cx="${x}" cy="${yy}" rx="${ww / 2}" ry="${h / n * 0.32}" fill="${col}" stroke="${colD}" stroke-width=".6"/>`;
  }
  return s;
}
const defs = `<defs>
  <linearGradient id="gTank" x1="0" x2="1"><stop offset="0" stop-color="${P.tankD}"/><stop offset=".45" stop-color="${P.tankL}"/><stop offset="1" stop-color="${P.tankD}"/></linearGradient>
  <linearGradient id="gSteel" x1="0" x2="1"><stop offset="0" stop-color="${P.steelD}"/><stop offset=".5" stop-color="${P.steelL}"/><stop offset="1" stop-color="${P.steelD}"/></linearGradient>
  <linearGradient id="gAl" x1="0" x2="1"><stop offset="0" stop-color="#8f99a5"/><stop offset=".5" stop-color="#e4e9ee"/><stop offset="1" stop-color="#8f99a5"/></linearGradient>
  <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--art-sky1)"/><stop offset="1" stop-color="var(--art-sky2)"/></linearGradient>
</defs>`;
const ground = (W, H) => `<rect width="${W}" height="${H}" fill="url(#gSky)"/><rect y="${H - 26}" width="${W}" height="26" fill="var(--art-ground)"/><path d="M0 ${H - 26}H${W}" stroke="var(--art-ground-l)" stroke-width="2"/>`;

function transformer({ reactor = false } = {}) {
  const W = 360, H = 260, gx = 70, gy = 112, tw = 190, th = 108;
  let s = defs + ground(W, H);
  // radiators
  for (let i = 0; i < 7; i++) s += `<rect x="${gx + tw + 6 + i * 9}" y="${gy + 8}" width="6" height="${th - 16}" rx="1.5" fill="url(#gSteel)"/>`;
  s += `<rect x="${gx + tw + 4}" y="${gy + 14}" width="${68}" height="4" fill="${P.steelD}"/><rect x="${gx + tw + 4}" y="${gy + th - 18}" width="68" height="4" fill="${P.steelD}"/>`;
  // tank
  s += `<rect x="${gx}" y="${gy}" width="${tw}" height="${th}" rx="4" fill="url(#gTank)"/>`;
  for (let i = 1; i < 6; i++) s += `<path d="M${gx + i * tw / 6} ${gy + 4}V${gy + th - 4}" stroke="${P.tankD}" stroke-width="2" opacity=".6"/>`;
  s += `<rect x="${gx - 4}" y="${gy - 6}" width="${tw + 8}" height="9" rx="2" fill="${P.tankD}"/>`;
  s += `<rect x="${gx + 6}" y="${gy + th}" width="${tw - 12}" height="10" fill="${P.steelD}"/><circle cx="${gx + 24}" cy="${gy + th + 14}" r="6" fill="#333"/><circle cx="${gx + tw - 24}" cy="${gy + th + 14}" r="6" fill="#333"/>`;
  // conservator on pipe
  s += `<path d="M${gx + tw - 30} ${gy - 6}V${gy - 46}" stroke="${P.steelD}" stroke-width="4"/><rect x="${gx + tw - 92}" y="${gy - 72}" width="118" height="30" rx="15" fill="url(#gSteel)"/><circle cx="${gx + tw - 4}" cy="${gy - 57}" r="5" fill="#ddd" stroke="${P.steelD}"/>`;
  // OLTC compartment
  if (!reactor) s += `<rect x="${gx - 26}" y="${gy + 18}" width="26" height="58" rx="3" fill="url(#gTank)"/><text x="${gx - 13}" y="${gy + 50}" font-size="7" fill="#fff" text-anchor="middle" opacity=".8">OLTC</text>`;
  // bushings: HV tall, IV medium, LV short
  const b = reactor ? [[gx + 50, 96, 13], [gx + 95, 96, 13], [gx + 140, 96, 13]] : [[gx + 40, 104, 14], [gx + 92, 72, 10], [gx + 140, 44, 7]];
  for (const [x, h, n] of b) { s += `<rect x="${x - 8}" y="${gy - 14}" width="16" height="10" fill="${P.steelD}"/>` + sheds(x, gy - 14 - h, h, 15, n) + `<rect x="${x - 3}" y="${gy - 22 - h}" width="6" height="9" fill="${P.al}"/><circle cx="${x}" cy="${gy - 24 - h}" r="4" fill="url(#gAl)"/>`; }
  if (reactor) s += `<text x="${gx + tw / 2}" y="${gy + th / 2 + 4}" font-size="11" font-weight="700" fill="#fff" opacity=".35" text-anchor="middle">SHUNT REACTOR</text>`;
  return [W, H, s];
}

function breaker(breaks = 2) {
  const W = 360, H = 260, cx = 180;
  let s = defs + ground(W, H);
  s += `<rect x="${cx - 40}" y="${H - 26 - 64}" width="80" height="64" rx="3" fill="url(#gSteel)"/><rect x="${cx - 30}" y="${H - 26 - 54}" width="60" height="30" rx="2" fill="${P.steelD}" opacity=".5"/><text x="${cx}" y="${H - 26 - 35}" font-size="7.5" fill="#fff" text-anchor="middle">SPRING / HYD. MECH.</text>`;
  s += `<rect x="${cx - 10}" y="${H - 26 - 76}" width="20" height="14" fill="${P.steelD}"/>`;
  s += sheds(cx, 92, 72, 22, 14, '#9aa6b2', '#6f7b87');                  // support column
  if (breaks === 2) {
    s += `<rect x="${cx - 26}" y="74" width="52" height="22" rx="4" fill="url(#gAl)"/>`;
    for (const d of [-1, 1]) {
      const x0 = cx + d * 26, x1 = cx + d * 132;
      s += `<g transform="translate(${(x0 + x1) / 2} 85) rotate(90)">${sheds(0, -(Math.abs(x1 - x0)) / 2, Math.abs(x1 - x0) - 22, 26, 16, '#9aa6b2', '#6f7b87')}</g>`;
      s += `<rect x="${x1 - (d > 0 ? 12 : -2)}" y="72" width="14" height="26" rx="3" fill="url(#gAl)"/><circle cx="${x1 + d * 4}" cy="85" r="8" fill="none" stroke="${P.ring}" stroke-width="3"/>`;
    }
    s += `<rect x="${cx - 60}" y="50" width="44" height="14" rx="7" fill="url(#gSteel)" opacity=".9"/><text x="${cx - 38}" y="60" font-size="7" fill="#fff" text-anchor="middle">C</text><rect x="${cx + 16}" y="50" width="44" height="14" rx="7" fill="url(#gSteel)" opacity=".9"/><text x="${cx + 38}" y="60" font-size="7" fill="#fff" text-anchor="middle">C</text>`;
  } else {
    s += sheds(cx, 20, 72, 26, 14, '#9aa6b2', '#6f7b87') + `<rect x="${cx - 14}" y="10" width="28" height="14" rx="3" fill="url(#gAl)"/>`;
  }
  s += `<text x="${cx}" y="${H - 8}" font-size="8" fill="var(--ink-3)" text-anchor="middle">SF₆ live-tank breaker · ${breaks}-break pole</text>`;
  return [W, H, s];
}

function ct() {
  const W = 360, H = 260, cx = 180;
  let s = defs + ground(W, H);
  s += `<rect x="${cx - 36}" y="${H - 26 - 34}" width="72" height="34" rx="3" fill="url(#gTank)"/><rect x="${cx - 46}" y="${H - 26 - 6}" width="92" height="6" fill="${P.steelD}"/>`;
  s += sheds(cx, 84, H - 26 - 34 - 84, 30, 18);
  s += `<ellipse cx="${cx}" cy="64" rx="40" ry="26" fill="url(#gTank)"/><rect x="${cx - 40}" y="60" width="80" height="24" fill="url(#gTank)"/><ellipse cx="${cx}" cy="84" rx="40" ry="6" fill="${P.tankD}"/>`;
  s += `<rect x="${cx - 62}" y="64" width="22" height="10" rx="2" fill="url(#gAl)"/><rect x="${cx + 40}" y="64" width="22" height="10" rx="2" fill="url(#gAl)"/><text x="${cx - 70}" y="72" font-size="8" fill="var(--ink-3)" text-anchor="end">P1</text><text x="${cx + 70}" y="72" font-size="8" fill="var(--ink-3)">P2</text>`;
  s += `<circle cx="${cx}" cy="50" r="5" fill="#ddd" stroke="${P.steelD}"/><text x="${cx}" y="${H - 8}" font-size="8" fill="var(--ink-3)" text-anchor="middle">Oil-filled live-tank CT · tan δ via test tap</text>`;
  return [W, H, s];
}

function la() {
  const W = 360, H = 260, cx = 180;
  let s = defs + ground(W, H);
  s += `<rect x="${cx - 30}" y="${H - 26 - 22}" width="60" height="22" fill="url(#gSteel)"/>`;
  const units = 3, top = 44, bot = H - 26 - 30, uh = (bot - top) / units;
  for (let i = 0; i < units; i++) s += sheds(cx, top + i * uh + 3, uh - 6, 30, 9) + `<rect x="${cx - 18}" y="${top + i * uh - 2}" width="36" height="6" fill="url(#gAl)"/>`;
  s += `<ellipse cx="${cx}" cy="${top + 10}" rx="52" ry="10" fill="none" stroke="${P.ring}" stroke-width="4"/><path d="M${cx} ${top - 2}V${top - 26}" stroke="${P.al}" stroke-width="4"/>`;
  s += `<rect x="${cx + 44}" y="${H - 26 - 70}" width="36" height="28" rx="4" fill="#20303f"/><circle cx="${cx + 62}" cy="${H - 26 - 56}" r="9" fill="#e9eef3"/><path d="M${cx + 62} ${H - 26 - 56}l5 -4" stroke="#c4161c" stroke-width="1.5"/><text x="${cx + 62}" y="${H - 26 - 36}" font-size="6.5" fill="var(--ink-3)" text-anchor="middle">LCM / counter</text><path d="M${cx + 30} ${H - 26 - 12}H${cx + 44}" stroke="${P.cu}" stroke-width="2"/>`;
  s += `<text x="${cx}" y="${H - 8}" font-size="8" fill="var(--ink-3)" text-anchor="middle">ZnO surge arrester · 3 stacked units · grading ring</text>`;
  return [W, H, s];
}

function bay(kv) {          // CT + CB + LA in a gantry, for bay headers
  const W = 520, H = 260;
  let s = defs + ground(W, H);
  s += `<path d="M20 ${H - 26}V40H${W - 20}V${H - 26}" fill="none" stroke="${P.steelD}" stroke-width="5"/><path d="M20 40l18 -12h${W - 76}l18 12" fill="none" stroke="${P.steelD}" stroke-width="3"/>`;
  for (let i = 0; i < 7; i++) s += `<path d="M${20 + i * (W - 40) / 6} 40l${(W - 40) / 12} -12" stroke="${P.steelD}" stroke-width="1.5"/>`;
  const item = (fn, x, sc) => { const [w, h, g] = fn; return `<g transform="translate(${x} ${H - h * sc}) scale(${sc})"><g clip-path="none">${g.replace(/<rect width="\d+" height="\d+" fill="url\(#gSky\)"\/>/, '').replace(/<rect y="\d+" width="\d+" height="26" fill="var\(--art-ground\)"\/><path d="M0 \d+H\d+" stroke="var\(--art-ground-l\)" stroke-width="2"\/>/, '')}</g></g>`; };
  s += item(la(), 10, 0.62) + item(ct(), 150, 0.62) + item(breaker(kv === 400 ? 2 : 1), 290, 0.62);
  s += `<path d="M0 ${H - 26}H${W}" stroke="var(--art-ground-l)" stroke-width="2"/>`;
  return [W, H, s];
}

const KINDS = { transformer: () => transformer(), reactor: () => transformer({ reactor: true }), breaker2: () => breaker(2), breaker1: () => breaker(1), ct, la, bay400: () => bay(400), bay220: () => bay(220) };

/** Illustration with optional nameplate; a matching site photo, if present, is shown instead. */
export function art(kind, { photo, plate, alt } = {}) {
  const [W, H, g] = KINDS[kind]();
  const pl = plate ? `<div class="plate-tag">${plate.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : '';
  return `<figure class="art">${photo ? `<img src="assets/photos/${encodeURIComponent(photo)}.jpg" alt="${esc(alt || photo)}" onerror="this.remove()">` : ''}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt || kind)}">${g}</svg>${pl}</figure>`;
}
export const kindForTest = { bushing: 'transformer', winding: 'transformer', dga: 'transformer', ct: 'ct', cb_crm: 'breaker2', cb_timing: 'breaker2', la: 'la' };

/** Decorative switchyard skyline for page heroes. */
export function skyline() {
  let s = '';
  const tower = (x, h, sc = 1) => `<g transform="translate(${x} ${200 - h * sc}) scale(${sc})" stroke="currentColor" fill="none" stroke-width="1.4"><path d="M-14 ${h}L-4 0h8l10 ${h}"/><path d="M-11 ${h * .75}h22M-8 ${h * .5}h16M-6 ${h * .25}h12"/><path d="M-11 ${h * .75}L8 ${h * .5}M11 ${h * .75}L-8 ${h * .5}M-8 ${h * .5}L6 ${h * .25}M8 ${h * .5}L-6 ${h * .25}"/><path d="M-30 ${h * .12}h60M-22 ${h * .3}h44"/><path d="M-30 ${h * .12}v8M30 ${h * .12}v8M-22 ${h * .3}v8M22 ${h * .3}v8"/></g>`;
  s += tower(70, 150) + tower(330, 170, 1) + tower(600, 140) + tower(880, 165) + tower(1120, 150);
  s += `<g stroke="currentColor" fill="none" stroke-width="1" opacity=".8"><path d="M40 ${200 - 150 + 18}Q200 ${200 - 150 + 60} 300 ${200 - 170 + 18}T570 ${200 - 140 + 18}T850 ${200 - 165 + 18}T1150 ${200 - 150 + 18}"/><path d="M48 ${200 - 150 + 45}Q200 ${200 - 150 + 85} 308 ${200 - 170 + 51}T578 ${200 - 140 + 42}T858 ${200 - 165 + 50}T1142 ${200 - 150 + 45}"/></g>`;
  s += `<g fill="currentColor" opacity=".9"><rect x="430" y="150" width="90" height="50" rx="2"/><rect x="440" y="128" width="8" height="22"/><rect x="460" y="122" width="8" height="28"/><rect x="480" y="128" width="8" height="22"/><rect x="525" y="160" width="40" height="40"/><rect x="700" y="165" width="120" height="35"/><path d="M700 165V120H820V165" fill="none" stroke="currentColor" stroke-width="3"/>${[715, 745, 775, 805].map(x => `<rect x="${x - 3}" y="132" width="6" height="33"/>`).join('')}</g>`;
  return `<svg class="skyline" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${s}</svg>`;
}
