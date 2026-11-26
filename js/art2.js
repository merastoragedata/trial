// Realistic EHV equipment drawings (SVG, 720 × 520):
//   ctLive()  — 400 kV live-tank (head-type) oil-filled current transformer
//   cbLive()  — GL316-type SF6 live-tank circuit breaker, three poles on a common frame, spring mechanism
//   ict()     — 501 MVA (3 × 167 MVA) single-phase ICT unit, Toshiba-style, ONAN/ONAF with OLTC
// Shading is done with cylindrical gradients so porcelain, aluminium, galvanised steel and painted
// tanks read as real materials.
const W = 720, H = 520, GY = 470;
const DEFS = `<defs>
  <linearGradient id="a2sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe2f3"/><stop offset=".62" stop-color="#eef5fb"/><stop offset="1" stop-color="#f7f3ea"/></linearGradient>
  <linearGradient id="a2gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b2a2"/><stop offset="1" stop-color="#8d8677"/></linearGradient>
  <pattern id="a2gravel" width="14" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#7b7466" opacity=".55"/><circle cx="10" cy="7" r="1.1" fill="#a49d8c" opacity=".6"/><circle cx="7" cy="2" r=".8" fill="#5f594d" opacity=".4"/></pattern>
  <linearGradient id="a2porc" x1="0" x2="1"><stop offset="0" stop-color="#3e2418"/><stop offset=".22" stop-color="#7a4a32"/><stop offset=".42" stop-color="#b07a58"/><stop offset=".5" stop-color="#d7a988"/><stop offset=".62" stop-color="#93603f"/><stop offset="1" stop-color="#3a2116"/></linearGradient>
  <linearGradient id="a2poly" x1="0" x2="1"><stop offset="0" stop-color="#4b5058"/><stop offset=".3" stop-color="#8a9099"/><stop offset=".5" stop-color="#c3c8cf"/><stop offset=".68" stop-color="#7d838c"/><stop offset="1" stop-color="#43484f"/></linearGradient>
  <linearGradient id="a2al" x1="0" x2="1"><stop offset="0" stop-color="#7d8792"/><stop offset=".35" stop-color="#d9dfe5"/><stop offset=".5" stop-color="#f6f8fa"/><stop offset=".7" stop-color="#aab3bd"/><stop offset="1" stop-color="#6c7682"/></linearGradient>
  <linearGradient id="a2alV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f5"/><stop offset=".5" stop-color="#b8c1ca"/><stop offset="1" stop-color="#7b8590"/></linearGradient>
  <linearGradient id="a2galv" x1="0" x2="1"><stop offset="0" stop-color="#7f8a93"/><stop offset=".45" stop-color="#c9d0d6"/><stop offset=".55" stop-color="#dfe4e8"/><stop offset="1" stop-color="#7a848d"/></linearGradient>
  <linearGradient id="a2tank" x1="0" x2="1"><stop offset="0" stop-color="#8e979f"/><stop offset=".18" stop-color="#b6bec5"/><stop offset=".5" stop-color="#c9d0d6"/><stop offset=".85" stop-color="#a7b0b8"/><stop offset="1" stop-color="#848d96"/></linearGradient>
  <linearGradient id="a2tankV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d3d9de"/><stop offset="1" stop-color="#9aa3ab"/></linearGradient>
  <linearGradient id="a2rib" x1="0" x2="1"><stop offset="0" stop-color="#7f8890"/><stop offset=".5" stop-color="#c2c9cf"/><stop offset="1" stop-color="#78818a"/></linearGradient>
  <linearGradient id="a2fin" x1="0" x2="1"><stop offset="0" stop-color="#7c858d"/><stop offset=".5" stop-color="#bcc4cb"/><stop offset="1" stop-color="#848d95"/></linearGradient>
  <linearGradient id="a2cab" x1="0" x2="1"><stop offset="0" stop-color="#a6afb7"/><stop offset=".5" stop-color="#d7dde2"/><stop offset="1" stop-color="#9aa3ab"/></linearGradient>
  <radialGradient id="a2fan" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#5a636b"/><stop offset="1" stop-color="#2b3137"/></radialGradient>
  <linearGradient id="a2shadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
</defs>`;
const scene = (inner) => `${DEFS}<rect width="${W}" height="${H}" fill="url(#a2sky)"/>
  <g opacity=".22" stroke="#5a6b7c" fill="none" stroke-width="1.2"><path d="M20 ${GY - 150}L40 ${GY - 330}h10l20 180M28 ${GY - 230}h36M34 ${GY - 290}h24"/><path d="M640 ${GY - 140}L660 ${GY - 320}h10l20 180M648 ${GY - 220}h36M654 ${GY - 280}h24"/><path d="M45 ${GY - 322}Q350 ${GY - 250} 665 ${GY - 312}"/><path d="M45 ${GY - 300}Q350 ${GY - 225} 665 ${GY - 290}"/></g>
  <rect y="${GY}" width="${W}" height="${H - GY}" fill="url(#a2gnd)"/><rect y="${GY}" width="${W}" height="${H - GY}" fill="url(#a2gravel)"/><path d="M0 ${GY}H${W}" stroke="#6f6859" stroke-width="2"/>${inner}`;

/** Insulator column: core + alternating big / small sheds, glazed porcelain or grey silicone. */
function insulator(cx, yTop, yBot, rBig, n, kind = 'porc') {
  const fill = kind === 'porc' ? 'url(#a2porc)' : 'url(#a2poly)', edge = kind === 'porc' ? '#2e1a11' : '#353a40';
  const h = yBot - yTop, step = h / n, core = rBig * 0.46;
  let s = `<rect x="${cx - core}" y="${yTop}" width="${core * 2}" height="${h}" fill="${fill}"/>`;
  for (let i = 0; i < n; i++) {
    const y = yTop + step * (i + 0.55), big = i % 2 === 0, r = big ? rBig : rBig * 0.8, t = Math.max(2.2, step * (big ? 0.34 : 0.28));
    s += `<ellipse cx="${cx}" cy="${y + t * 0.35}" rx="${r}" ry="${t * 0.9}" fill="#000" opacity=".18"/>`;
    s += `<ellipse cx="${cx}" cy="${y}" rx="${r}" ry="${t}" fill="${fill}" stroke="${edge}" stroke-width=".7"/>`;
    s += `<ellipse cx="${cx - r * 0.25}" cy="${y - t * 0.35}" rx="${r * 0.35}" ry="${t * 0.25}" fill="#fff" opacity="${kind === 'porc' ? .22 : .18}"/>`;
  }
  return s;
}
const flange = (cx, y, r, h = 8) => `<rect x="${cx - r}" y="${y}" width="${r * 2}" height="${h}" rx="1.5" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".6"/>${[...Array(6)].map((_, i) => `<circle cx="${cx - r + 4 + i * (r * 2 - 8) / 5}" cy="${y + h / 2}" r="1.1" fill="#4d555c"/>`).join('')}`;
const pad = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="url(#a2alV)" stroke="#6c7682" stroke-width=".7"/>${[0.3, 0.7].map(f => `<circle cx="${x + w * f}" cy="${y + h / 2}" r="1.6" fill="#59626c"/>`).join('')}`;
const ring = (cx, cy, rx, ry, w = 5) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#6f7983" stroke-width="${w + 1.5}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="url(#a2al)" stroke-width="${w}"/><ellipse cx="${cx}" cy="${cy - ry * 0.35}" rx="${rx * 0.7}" ry="${ry * 0.35}" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/>`;
const shadow = (cx, w) => `<ellipse cx="${cx}" cy="${GY + 6}" rx="${w}" ry="9" fill="#000" opacity=".22"/>`;
const label = (x, y, t, size = 11, col = '#1d2a36', anchor = 'middle') => `<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="700" fill="${col}" text-anchor="${anchor}">${t}</text>`;

// ------------------------------------------------------------------ live-tank (head-type) CT
export function ctLive() {
  const cx = 360;
  let s = shadow(cx, 90);
  // galvanised pedestal (tubular column on a base plate)
  s += `<rect x="${cx - 70}" y="${GY - 10}" width="140" height="10" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".7"/>`;
  s += `<rect x="${cx - 22}" y="${GY - 118}" width="44" height="108" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".7"/>`;
  s += [0, 1, 2].map(i => `<path d="M${cx - 22} ${GY - 112 + i * 34}l44 30M${cx + 22} ${GY - 112 + i * 34}l-44 30" stroke="#6b757e" stroke-width="1.2" opacity=".5"/>`).join('');
  s += `<rect x="${cx - 46}" y="${GY - 126}" width="92" height="10" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".7"/>`;
  // base tank with secondary terminal box, oil drain valve, earthing pad
  const by = GY - 172;
  s += `<rect x="${cx - 56}" y="${by}" width="112" height="46" rx="5" fill="url(#a2al)" stroke="#5d6772" stroke-width=".8"/>`;
  s += `<rect x="${cx - 44}" y="${by + 8}" width="46" height="32" rx="3" fill="url(#a2cab)" stroke="#5d6772" stroke-width=".8"/><circle cx="${cx - 6}" cy="${by + 24}" r="2" fill="#4a535c"/><rect x="${cx - 40}" y="${by + 12}" width="22" height="10" rx="1" fill="#f5f0dc" stroke="#8a8270" stroke-width=".5"/>`;
  s += `<rect x="${cx + 14}" y="${by + 26}" width="18" height="8" rx="2" fill="#56606a"/><circle cx="${cx + 42}" cy="${by + 30}" r="4" fill="#b87333" stroke="#7a4b20"/>`;
  s += flange(cx, by - 8, 40, 9);
  // porcelain column with alternating sheds
  const iTop = 152, iBot = by - 8;
  s += insulator(cx, iTop, iBot, 40, 24, 'porc');
  s += flange(cx, iTop - 8, 34, 9);
  // aluminium head tank (horizontal drum) with primary terminals P1 / P2
  const hy = 82, hh = 64;
  s += `<rect x="${cx - 92}" y="${hy}" width="184" height="${hh}" rx="${hh / 2}" fill="url(#a2alV)" stroke="#5d6772" stroke-width="1"/>`;
  s += `<path d="M${cx - 92 + hh / 2} ${hy + 6}H${cx + 92 - hh / 2}" stroke="#fff" stroke-width="3" opacity=".65" stroke-linecap="round"/>`;
  s += `<path d="M${cx - 60} ${hy}v${hh}M${cx + 60} ${hy}v${hh}" stroke="#7b8590" stroke-width="1.2" opacity=".7"/>`;
  s += pad(cx - 128, hy + 22, 38, 18) + pad(cx + 90, hy + 22, 38, 18);
  s += label(cx - 109, hy + 15, 'P1', 10) + label(cx + 109, hy + 15, 'P2', 10);
  // oil-level window and metallic bellows expansion dome
  s += `<rect x="${cx + 34}" y="${hy + 20}" width="16" height="26" rx="3" fill="#2d3a45" stroke="#c9d1d8" stroke-width="1.4"/><rect x="${cx + 37}" y="${hy + 30}" width="10" height="13" fill="#d8b04a" opacity=".85"/>`;
  s += `<path d="M${cx - 40} ${hy + 2}Q${cx - 40} ${hy - 44} ${cx} ${hy - 46}Q${cx + 40} ${hy - 44} ${cx + 40} ${hy + 2}Z" fill="url(#a2al)" stroke="#5d6772" stroke-width=".9"/>`;
  s += [...Array(6)].map((_, i) => `<path d="M${cx - 36 + i * 2} ${hy - 6 - i * 6}H${cx + 36 - i * 2}" stroke="#7d8792" stroke-width="1.1" opacity=".75"/>`).join('');
  s += `<circle cx="${cx}" cy="${hy - 46}" r="4" fill="url(#a2al)" stroke="#5d6772"/>`;
  // line conductors arriving at P1 / P2
  s += `<path d="M0 ${hy + 31}C60 ${hy + 28} 140 ${hy + 31} ${cx - 128} ${hy + 31}" stroke="#6b7682" stroke-width="3" fill="none"/><path d="M${cx + 128} ${hy + 31}C560 ${hy + 31} 640 ${hy + 28} ${W} ${hy + 31}" stroke="#6b7682" stroke-width="3" fill="none"/>`;
  s += label(cx, GY + 30, '400 kV live-tank (head-type) CT · oil-filled · tan δ via test tap', 12, '#2b3340');
  return scene(s);
}

// ------------------------------------------------------------------ GL316-type SF6 live-tank breaker
export function cbLive() {
  let s = '';
  const xs = [170, 360, 550], beamY = GY - 150;
  s += shadow(360, 290);
  // common galvanised frame on two legs
  for (const x of [110, 610]) s += `<rect x="${x - 14}" y="${beamY + 14}" width="28" height="${GY - beamY - 14}" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".7"/><rect x="${x - 26}" y="${GY - 8}" width="52" height="8" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".7"/>`;
  s += `<rect x="80" y="${beamY}" width="560" height="18" fill="url(#a2galv)" stroke="#5f6870" stroke-width=".8"/>`;
  s += `<path d="M110 ${beamY + 50}L360 ${beamY + 18}L610 ${beamY + 50}" stroke="#6f7a83" stroke-width="3" fill="none" opacity=".6"/>`;
  // spring operating mechanism cabinet (under the middle pole) and pole linkage
  const cy = beamY + 26;
  s += `<rect x="300" y="${cy}" width="120" height="108" rx="4" fill="url(#a2cab)" stroke="#59636c" stroke-width="1"/>`;
  s += `<rect x="308" y="${cy + 8}" width="104" height="92" rx="2" fill="none" stroke="#7b858e" stroke-width="1"/><rect x="402" y="${cy + 46}" width="5" height="18" rx="2" fill="#4a535c"/>`;
  s += `<rect x="322" y="${cy + 16}" width="44" height="22" rx="2" fill="#20303d" stroke="#9aa6b1"/><text x="344" y="${cy + 31}" font-family="IBM Plex Mono,monospace" font-size="9" fill="#9fe3b1" text-anchor="middle">OPEN</text>`;
  s += `<circle cx="384" cy="${cy + 27}" r="9" fill="#e9edf0" stroke="#59636c"/><path d="M384 ${cy + 27}l5 -4" stroke="#c4161c" stroke-width="1.6"/>`;
  s += `<rect x="318" y="${cy + 70}" width="58" height="14" rx="2" fill="#f5f0dc" stroke="#8a8270" stroke-width=".6"/>${label(347, cy + 81, 'SPRING · FK', 8, '#3a3a2e')}`;
  s += `<path d="M${xs[0]} ${beamY - 6}H${xs[2]}" stroke="#5f6870" stroke-width="5"/><path d="M${xs[0]} ${beamY - 6}H${xs[2]}" stroke="#aeb7bf" stroke-width="2.2"/>`;
  xs.forEach((x, i) => {
    // crank housing + SF6 density monitor
    s += `<rect x="${x - 26}" y="${beamY - 22}" width="52" height="22" rx="3" fill="url(#a2al)" stroke="#5d6772" stroke-width=".8"/>`;
    s += `<circle cx="${x + 34}" cy="${beamY - 14}" r="9" fill="#eef1f3" stroke="#5d6772"/><path d="M${x + 34} ${beamY - 14}l-5 -4" stroke="#1f7a4d" stroke-width="1.6"/><circle cx="${x + 34}" cy="${beamY - 14}" r="1.4" fill="#333"/>`;
    // support insulator (grey composite)
    const sTop = beamY - 152, sBot = beamY - 22;
    s += flange(x, sBot - 8, 25, 8) + insulator(x, sTop + 8, sBot - 8, 25, 14, 'poly') + flange(x, sTop, 25, 8);
    // lower terminal housing with pad
    const mY = sTop - 30;
    s += `<rect x="${x - 30}" y="${mY}" width="60" height="30" rx="5" fill="url(#a2al)" stroke="#5d6772" stroke-width=".9"/>${pad(x + 30, mY + 7, 30, 15)}`;
    // interrupter chamber (larger composite insulator)
    const iTop = 40, iBot = mY;
    s += flange(x, iBot - 8, 30, 8) + insulator(x, iTop + 22, iBot - 8, 30, 12, 'poly') + flange(x, iTop + 14, 30, 8);
    // top head with upper terminal pad
    s += `<rect x="${x - 32}" y="${iTop - 12}" width="64" height="28" rx="6" fill="url(#a2al)" stroke="#5d6772" stroke-width=".9"/>${pad(x - 62, iTop - 5, 30, 15)}`;
    s += `<path d="M${x - 62} ${iTop + 2}C${x - 100} ${iTop + 4} ${x - 110} ${iTop - 20} ${x - 150} ${iTop - 22}" stroke="#6b7682" stroke-width="3" fill="none"/><path d="M${x + 60} ${mY + 14}C${x + 80} ${mY + 16} ${x + 85} ${mY + 50} ${x + 95} ${mY + 70}" stroke="#6b7682" stroke-width="3" fill="none"/>`;
    s += label(x, GY - 2 - 160 + 150 + 22 - 150, '', 1);
    s += label(x - 46, beamY - 26, ['R', 'Y', 'B'][i], 13, ['#c4161c', '#b78a00', '#1a5fc2'][i]);
  });
  s += label(360, GY + 30, 'SF6 live-tank CB · GL316-type pole: support insulator + interrupter · spring mechanism', 12, '#2b3340');
  return scene(s);
}

// ------------------------------------------------------------------ 501 MVA ICT · single-phase 167 MVA unit
export function ict({ reactor = false } = {}) {
  let s = shadow(330, 290);
  const tx = 150, tw = 330, ty = 262, th = 168, cov = ty;
  // rails and wheels
  s += `<rect x="90" y="${GY - 8}" width="480" height="6" fill="#5c5f63"/><rect x="90" y="${GY - 3}" width="480" height="3" fill="#3f4246"/>`;
  for (const x of [tx + 30, tx + 110, tx + tw - 110, tx + tw - 30]) s += `<circle cx="${x}" cy="${GY - 14}" r="11" fill="#3a3f44" stroke="#25292d" stroke-width="2"/><circle cx="${x}" cy="${GY - 14}" r="4" fill="#8f979e"/>`;
  s += `<rect x="${tx - 10}" y="${ty + th}" width="${tw + 20}" height="18" fill="#7d868e" stroke="#5c646b" stroke-width=".8"/>`;
  // radiator bank (separately mounted) with header pipes and fans
  const rx = 512, rw = 150, ry = 232, rh = 196;
  s += `<path d="M${tx + tw} ${ty + 22}H${rx + 10}M${tx + tw} ${ty + th - 24}H${rx + 10}" stroke="#6f7880" stroke-width="10"/><path d="M${tx + tw} ${ty + 22}H${rx + 10}M${tx + tw} ${ty + th - 24}H${rx + 10}" stroke="#aeb7bf" stroke-width="4"/>`;
  s += `<rect x="${rx}" y="${ry - 8}" width="${rw}" height="10" rx="3" fill="url(#a2galv)"/><rect x="${rx}" y="${ry + rh - 2}" width="${rw}" height="10" rx="3" fill="url(#a2galv)"/>`;
  for (let i = 0; i < 14; i++) s += `<rect x="${rx + 4 + i * 10.4}" y="${ry}" width="7.4" height="${rh}" rx="2" fill="url(#a2fin)" stroke="#6c757d" stroke-width=".4"/>`;
  for (const [fx, fy] of [[rx + 40, ry + rh - 46], [rx + 110, ry + rh - 46]]) {
    s += `<circle cx="${fx}" cy="${fy}" r="28" fill="url(#a2fan)" stroke="#9aa3ab" stroke-width="3"/>`;
    s += [0, 72, 144, 216, 288].map(a => `<path d="M${fx} ${fy}q10 -6 22 -2q-8 8 -22 2z" fill="#8c959d" transform="rotate(${a} ${fx} ${fy})"/>`).join('');
    s += `<circle cx="${fx}" cy="${fy}" r="5" fill="#cfd5da"/><g stroke="#9aa3ab" stroke-width="1" opacity=".8">${[-20, -10, 0, 10, 20].map(d => `<path d="M${fx - 28} ${fy + d}H${fx + 28}"/>`).join('')}</g>`;
  }
  s += `<rect x="${rx + rw - 8}" y="${ry + rh + 8}" width="10" height="${GY - ry - rh - 8}" fill="url(#a2galv)"/><rect x="${rx + 2}" y="${ry + rh + 8}" width="10" height="${GY - ry - rh - 8}" fill="url(#a2galv)"/>`;
  // main tank with vertical stiffeners
  s += `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="6" fill="url(#a2tank)" stroke="#5f686f" stroke-width="1.2"/>`;
  for (let i = 1; i < 8; i++) s += `<rect x="${tx + i * tw / 8 - 5}" y="${ty + 10}" width="10" height="${th - 20}" rx="2" fill="url(#a2rib)" opacity=".9"/>`;
  s += `<rect x="${tx - 6}" y="${ty - 8}" width="${tw + 12}" height="12" rx="3" fill="url(#a2tankV)" stroke="#5f686f" stroke-width=".9"/>`;
  s += `<rect x="${tx + 96}" y="${ty + 60}" width="104" height="44" rx="3" fill="#f3f0e6" stroke="#7c7562" stroke-width=".8"/>${label(tx + 148, ty + 78, 'TOSHIBA', 13, '#c4161c')}${label(tx + 148, ty + 95, reactor ? '125 MVAr · 420 kV' : '167 MVA · 1-ph · 400/√3 / 220/√3 kV', 7.5, '#3a3a2e')}`;
  // OLTC compartment, drive mechanism, marshalling box
  if (!reactor) {
    s += `<rect x="${tx - 46}" y="${ty + 18}" width="46" height="120" rx="4" fill="url(#a2tank)" stroke="#5f686f" stroke-width="1"/>`;
    s += `<rect x="${tx - 92}" y="${ty + 70}" width="40" height="70" rx="3" fill="url(#a2cab)" stroke="#5f686f"/><path d="M${tx - 52} ${ty + 100}H${tx - 46}" stroke="#5f686f" stroke-width="4"/>${label(tx - 72, ty + 96, 'OLTC', 7.5, '#334')}${label(tx - 72, ty + 106, 'drive', 7.5, '#334')}`;
  }
  s += `<rect x="${tx + 228}" y="${ty + 112}" width="62" height="48" rx="3" fill="url(#a2cab)" stroke="#5f686f"/><rect x="${tx + 280}" y="${ty + 130}" width="4" height="12" rx="1" fill="#4a535c"/>${label(tx + 256, ty + 134, 'MB', 8, '#334')}`;
  // conservator (main + OLTC compartment) on brackets, Buchholz relay, breather, oil-level gauge
  const cy = 150, cl = 200, cr = 450;
  s += `<path d="M${cl + 30} ${cy + 46}V${ty - 8}M${cr - 30} ${cy + 46}V${ty - 8}" stroke="#6f7880" stroke-width="6"/>`;
  s += `<rect x="${cl}" y="${cy}" width="${cr - cl}" height="50" rx="25" fill="url(#a2tankV)" stroke="#5f686f" stroke-width="1"/><path d="M${cl + 25} ${cy + 8}H${cr - 25}" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>`;
  if (!reactor) s += `<path d="M${cl + 62} ${cy + 2}V${cy + 48}" stroke="#5f686f" stroke-width="1.5"/>`;
  s += `<circle cx="${cr - 2}" cy="${cy + 25}" r="11" fill="#f4f6f7" stroke="#5f686f" stroke-width="1.2"/><path d="M${cr - 2} ${cy + 25}l6 -5" stroke="#c4161c" stroke-width="1.6"/>`;
  s += `<path d="M${cr - 60} ${cy + 50}V${cy + 74}H${tx + 210}V${ty - 8}" stroke="#6f7880" stroke-width="7" fill="none"/><rect x="${cr - 76}" y="${cy + 62}" width="30" height="22" rx="3" fill="url(#a2cab)" stroke="#5f686f"/>`;
  s += `<path d="M${cl + 10} ${cy + 40}V${ty + 40}" stroke="#6f7880" stroke-width="3"/><rect x="${cl + 2}" y="${ty + 40}" width="16" height="34" rx="4" fill="#d9a400" stroke="#8a6a00"/><rect x="${cl + 5}" y="${ty + 46}" width="10" height="22" rx="2" fill="#f2c94c" opacity=".7"/>`;
  // bushings on the cover: HV 400 kV (tall), IV 220 kV, LV 3.1 / 3.2 (tertiary), neutral
  const bush = (x, top, r, n, rr, lab) => { let b = `<rect x="${x - r - 4}" y="${cov - 30}" width="${(r + 4) * 2}" height="24" rx="3" fill="url(#a2tank)" stroke="#5f686f"/>` + flange(x, cov - 38, r + 2, 8) + insulator(x, top + 14, cov - 38, r, n, 'porc') + `<rect x="${x - r * 0.55}" y="${top - 4}" width="${r * 1.1}" height="20" rx="3" fill="url(#a2al)" stroke="#5d6772"/>` + `<rect x="${x - 3}" y="${top - 20}" width="6" height="18" fill="url(#a2al)"/>`;
    if (rr) b += ring(x, top - 22, rr, rr * 0.32, 5);
    return b + label(x, cov + 18, lab, 8.5, '#2b3340'); };
  if (reactor) { s += bush(250, 48, 22, 20, 30, 'HV 400 kV') + bush(330, 196, 11, 5, 0, 'N'); }
  else s += bush(240, 38, 22, 22, 32, 'HV 400 kV') + bush(318, 118, 16, 12, 18, 'IV 220 kV') + bush(378, 196, 10, 5, 0, 'LV 3.1') + bush(410, 196, 10, 5, 0, 'LV 3.2') + bush(444, 206, 8, 4, 0, 'N');
  // pressure relief device on the cover
  s += `<rect x="${tx + 22}" y="${cov - 20}" width="22" height="12" rx="3" fill="url(#a2al)" stroke="#5d6772"/><path d="M${tx + 33} ${cov - 20}v-8" stroke="#6f7880" stroke-width="3"/>`;
  // line connection to HV terminal
  s += `<path d="M0 30C120 26 190 ${reactor ? 22 : 12} ${reactor ? 250 : 240} ${reactor ? 18 : 8}" stroke="#6b7682" stroke-width="3" fill="none"/>`;
  s += label(330, GY + 30, reactor ? '125 MVAr shunt reactor · ONAN' : '501 MVA ICT (3 × 167 MVA single-phase units) · ONAN/ONAF · OLTC', 12, '#2b3340');
  return scene(s);
}
export const A2 = { W, H };
