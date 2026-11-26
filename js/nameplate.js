// Nameplates: recreated plates (from the site photographs), photo viewer and per-unit uploads.
// ICT plates are identical for all single-phase units except the serial number.
import { DB, isTF, unitName } from './data.js?v=20261126.1953';
import { esc, $, $$ } from './ui.js?v=20261126.1953';

let NP = null;
export async function loadNameplates() {
  if (!NP) NP = await fetch(`data/nameplates.json?v=${Date.now() >> 16}`).then(r => r.json()).catch(() => ({}));
  if (!CBN) CBN = await fetch(`data/cb_nameplates.json?v=${Date.now() >> 16}`).then(r => r.json()).catch(() => ({ bays: {} }));
  return NP;
}
let CBN = null;
/** Circuit-breaker nameplate data of a bay (type, serial, year, operation), or null. */
export const cbInfo = (u) => CBN?.bays?.[u] || null;
/** Collapsed section on a bay page: recreated CB nameplate with the type's full rating. */
export function cbNameplateSection(u, { open = false } = {}) {
  const B = cbInfo(u); if (!B) return '';
  const spec = CBN.types[B.type] || [], half = Math.ceil(spec.length / 2), S = CBN.summary?.[B.type];
  const plate = `<div class="np-plate"><div class="plate-screws"></div><div class="plate-maker">GE</div><div class="plate-title">SF6 CIRCUIT BREAKER · TYPE ${esc(B.type)}</div>
    <div class="np-serials"><span>BREAKER SERIAL No.</span> <b>${esc(B.serial)}</b> · <span>YEAR OF MFG.</span> <b>${esc(String(B.year))}</b></div>
    <div class="np-cols">${kv(spec.slice(0, half))}${kv(spec.slice(half))}</div>
    <div class="plate-foot"><span>Customer: Maharashtra State Electricity Transmission Company Ltd.</span><b>GE T&amp;D India Limited</b></div></div>`;
  const facts = [['Bay', `Bay ${u}`], ['Type', B.type], ['Serial no.', B.serial], ['Year of manufacture', B.year], ['Rated voltage', `${B.kv} kV`], ['Operation', B.operation], ['Commissioned', '11 Jan 2022'], ['Same type in service', S ? `${S.qty} · bays ${S.bays}` : '—']];
  return `<details class="sec inner np-sec cb-np" ${open ? 'open' : ''}><summary><span class="sec-t">🏷 CB nameplate · ${esc(B.type)} · Sr ${esc(B.serial)}</span><span class="dim">${esc(B.operation)} · ${B.kv} kV · ${esc(B.make)} ${B.year}</span><span class="caret">▾</span></summary>
    <div class="sec-b"><div class="cb-facts">${facts.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('')}</div>${plate}
    <p class="note">${esc(CBN.source || '')}. ${esc(CBN.note || '')}${/gang/i.test(B.operation) ? ' This breaker is gang-operated: one mechanism drives all three poles.' : ''}</p></div></details>`;
}
export const npReady = () => !!NP;
const serialOf = (u, ph) => DB.site.units[u]?.serials?.[ph] || null;
const kindOf = (u) => u === 'BUS_REACTOR' ? 'reactor' : /^(ICT1|ICT2|SPARE_ICT)$/.test(u) ? 'ict' : null;

// ------------------------------------------------------------------ recreated plates
const kv = (rows, serial) => `<table class="np-kv">${rows.map(([k, v]) => { const val = v === '@SERIAL' ? (serial || '—') : v; const ver = /verify|illegible|cut on photo|hidden/.test(val);
  return `<tr><th>${esc(k)}</th><td class="${ver ? 'np-ver' : ''}${v === '@SERIAL' ? ' np-serial' : ''}">${esc(val)}</td></tr>`; }).join('')}</table>`;
const grid = (t) => `<table class="np-t"><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function ictPlates(serial, serialsList) {
  const P = NP.ict, R = P.rating, half = Math.ceil(R.rows.length / 2);
  const rating = `<div class="np-plate"><div class="plate-screws"></div><div class="plate-maker">${esc(P.maker)}</div><div class="plate-title">${esc(R.title)}</div>
    ${serialsList ? `<div class="np-serials">${serialsList}</div>` : ''}
    <div class="np-cols">${kv(R.rows.slice(0, half), serial)}${kv(R.rows.slice(half), serial)}</div>
    <div class="np-sub">VECTOR GROUP (after 3-ϕ bank formation): <b>YNa0d11</b> · TOP VIEW: 1.1 · 2.1 · 3.1 · 3.2 · N · OLTC</div>
    ${vectorSvg()}
    <div class="np-sub">TABLE OF VOLTAGES</div>${grid(R.taps)}<div class="np-note">${esc(R.taps.note)}</div>
    ${R.cts.map(c => `<div class="np-sub">${esc(c.title)}</div>${grid(c)}`).join('')}
    <div class="np-sub">WTI CT TERMINALS</div>${kv(R.wti)}
    <div class="plate-foot"><span>DRG NO : ${esc(R.drg)}</span><b>${esc(P.maker_full)}</b></div></div>`;
  const O = P.overload;
  const over = `<div class="np-plate"><div class="plate-screws"></div><div class="plate-title">${esc(O.title)}</div><div class="np-sub c">${esc(O.sub)}</div>${grid(O)}</div>`;
  const V = P.valves;
  const valves = `<div class="np-plate"><div class="plate-screws"></div><div class="plate-maker">${esc(P.maker)}</div><div class="plate-title">${esc(V.title)}</div>
    <div class="np-sub">NOTES</div><ol class="np-notes">${V.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ol>
    ${grid({ head: ['S.No', 'Description', 'Qty'], rows: V.items })}<div class="plate-foot"><span>DRG NO : ${esc(V.drg)}</span><b>${esc(P.maker_full)}</b></div></div>`;
  return { rating, over, valves };
}
function reactorPlate() {
  const P = NP.reactor, half = Math.ceil(P.rows.length / 2);
  return `<div class="np-plate"><div class="plate-screws"></div><div class="plate-maker">${esc(P.maker)}</div><div class="plate-title">${esc(P.title)}</div>
    <div class="np-cols">${kv(P.rows.slice(0, half))}${kv(P.rows.slice(half))}</div>
    <div class="np-sub">${esc(P.cts.title)}</div>${grid(P.cts)}
    <div class="np-sub">NOTES</div><ol class="np-notes">${P.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ol>
    <div class="plate-foot"><b>${esc(P.maker_full)}</b></div></div>`;
}
function vectorSvg() {   // YNa0d11: auto star (HV/IV) with tertiary delta leading by 30° (11 o'clock)
  return `<svg class="np-vec" viewBox="0 0 300 130" aria-label="Vector group YNa0d11"><g fill="none" stroke="#1d232b" stroke-width="1.6">
    <path d="M70 70L70 20M70 70L27 95M70 70L113 95"/><circle cx="70" cy="70" r="2.5" fill="#1d232b"/><path d="M70 70v22M62 94h16M65 98h10M68 102h4"/>
    <path d="M190 18L240 104L140 104Z" transform="rotate(-30 190 75)"/></g>
    <g font-family="Inter,Arial" font-size="11" font-weight="700" fill="#1d232b"><text x="74" y="18">1U / 2U</text><text x="4" y="106">1W/2W</text><text x="104" y="106">1V/2V</text><text x="150" y="16">3U</text><text x="252" y="80">3V</text><text x="138" y="122">3W</text><text x="200" y="128" font-size="12">YNa0d11</text></g></svg>`;
}

// ------------------------------------------------------------------ uploads (IndexedDB, per unit)
const IDB = () => new Promise((res, rej) => { const r = indexedDB.open('ehv-nameplates', 1); r.onupgradeneeded = () => r.result.createObjectStore('img', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function store(mode, fn) { const db = await IDB(); return new Promise((res, rej) => { const tx = db.transaction('img', mode), st = tx.objectStore('img'); const q = fn(st); tx.oncomplete = () => res(q?.result); tx.onerror = () => rej(tx.error); }); }
const listUploads = async (key) => (await store('readonly', st => st.getAll()) || []).filter(x => x.key === key);
const addUpload = (key, file) => new Promise((res) => { const fr = new FileReader(); fr.onload = async () => { await store('readwrite', st => st.put({ id: `${key}|${Date.now()}`, key, name: file.name, data: fr.result, at: new Date().toISOString() })); res(); }; fr.readAsDataURL(file); });
const delUpload = (id) => store('readwrite', st => st.delete(id));

// ------------------------------------------------------------------ rich viewer (zoom · pan · rotate · fit)
export function openViewer(src, title) {
  const bg = document.createElement('div'); bg.className = 'np-viewer';
  bg.innerHTML = `<div class="npv-bar"><b>${esc(title || '')}</b><span class="sp"></span><button data-z="-">−</button><span class="npv-pct">100%</span><button data-z="+">+</button><button data-z="fit">Fit</button><button data-z="rot">⟳ Rotate</button><a class="npv-dl" href="${src}" download>Download</a><button data-z="x" aria-label="Close">✕</button></div>
    <div class="npv-stage"><img alt="${esc(title || '')}" src="${src}" draggable="false"></div>`;
  document.body.appendChild(bg);
  const img = bg.querySelector('img'), stage = bg.querySelector('.npv-stage'), pct = bg.querySelector('.npv-pct');
  let s = 1, x = 0, y = 0, rot = 0;
  const apply = () => { img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s}) rotate(${rot}deg)`; pct.textContent = Math.round(s * 100) + '%'; };
  const fit = () => { const r = stage.getBoundingClientRect(), w = img.naturalWidth || 1, h = img.naturalHeight || 1, sw = rot % 180 ? h : w, sh = rot % 180 ? w : h; s = Math.min(r.width / sw, r.height / sh) * 0.96; x = 0; y = 0; apply(); };
  img.onload = fit; if (img.complete) fit();
  const zoom = (f, cx, cy) => { const r = stage.getBoundingClientRect(); cx = cx ?? r.left + r.width / 2; cy = cy ?? r.top + r.height / 2; const ox = cx - r.left - r.width / 2 - x, oy = cy - r.top - r.height / 2 - y; const ns = Math.min(12, Math.max(0.1, s * f)); x -= ox * (ns / s - 1); y -= oy * (ns / s - 1); s = ns; apply(); };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  let drag = null, pinch = null; const pts = new Map();
  stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX - x, y: e.clientY - y }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s }; } });
  stage.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; s = Math.min(12, Math.max(0.1, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); apply(); } else if (drag) { x = e.clientX - drag.x; y = e.clientY - drag.y; apply(); } });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', (e) => zoom(2, e.clientX, e.clientY));
  bg.querySelector('.npv-bar').onclick = (e) => { const z = e.target.closest('[data-z]')?.dataset.z; if (!z) return;
    if (z === '+') zoom(1.3); if (z === '-') zoom(1 / 1.3); if (z === 'fit') fit(); if (z === 'rot') { rot = (rot + 90) % 360; fit(); } if (z === 'x') bg.remove(); };
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { bg.remove(); document.removeEventListener('keydown', k); } });
}

// ------------------------------------------------------------------ the collapsed section
/** Nameplate section for a transformer phase unit (u, ph), a whole ICT group (ph = null) or the reactor. */
export function nameplateSection(u, ph, { open = false } = {}) {
  const k = kindOf(u); if (!k || !NP) return '';
  const key = `${u}|${ph || '*'}`;
  let title, body, photos;
  if (k === 'reactor') { title = `Nameplate · ${unitName(u)} · Sr ${NP.reactor.rows.find(r => r[0] === 'Serial no.')?.[1] || ''}`; body = reactorPlate(); photos = NP.reactor.photos; }
  else {
    const serial = ph ? serialOf(u, ph) : null;
    const list = !ph && DB.site.units[u]?.serials ? ['R', 'Y', 'B'].map(p => `<span><b>${esc(u === 'ICT1' ? 'ICT1' : u === 'ICT2' ? 'ICT2' : u)} - ${p}ph</b> - ${esc(serialOf(u, p) || '—')}</span>`).join('') : '';
    const P = ictPlates(serial || (u === 'SPARE_ICT' ? 'not recorded in the sheet' : null), list);
    title = ph ? `Nameplate · ${unitName(u)}, ${ph}ph · Sr ${serial || '—'}` : `Nameplates · ${unitName(u)}${list ? ' · R / Y / B units' : ''}`;
    body = `<div class="np-tabs" role="tablist"><button class="on" data-np="rating">Rating & diagram plate</button><button data-np="over">Overloading plate</button><button data-np="valves">Valve schedule plate</button></div>
      <div data-npp="rating">${P.rating}</div><div data-npp="over" hidden>${P.over}</div><div data-npp="valves" hidden>${P.valves}</div>`;
    photos = NP.ict.photos;
  }
  return `<details class="sec inner np-sec" data-np-key="${esc(key)}" ${open ? 'open' : ''}><summary><span class="sec-t">🏷 ${esc(title)}</span><span class="dim">recreated plate · site photographs · upload your own</span><span class="caret">▾</span></summary>
    <div class="sec-b np-b">
      <div class="np-left">${body}</div>
      <div class="np-right"><div class="np-ph-h">Photographs</div>
        <div class="np-thumbs">${photos.map(p => `<button class="np-th" data-view="${esc(p.src)}" data-title="${esc(p.title)}"><img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy"><span>${esc(p.title)}</span></button>`).join('')}</div>
        <div class="np-ph-h">Uploaded for this ${ph ? 'unit' : 'equipment'}</div><div class="np-thumbs" data-up-list></div>
        <label class="btn np-up">⬆ Upload photo<input type="file" accept="image/*" multiple hidden data-up></label>
        <p class="note">Uploads are kept in this browser until the database is connected.</p></div></div></details>`;
}
export function wireNameplates(root) {
  $$('.np-sec', root).forEach(sec => {
    const key = sec.dataset.npKey;
    $$('[data-np]', sec).forEach(b => b.onclick = () => { $$('[data-np]', sec).forEach(x => x.classList.toggle('on', x === b)); $$('[data-npp]', sec).forEach(p => p.hidden = p.dataset.npp !== b.dataset.np); });
    const draw = async () => { const L = await listUploads(key).catch(() => []); const box = sec.querySelector('[data-up-list]');
      box.innerHTML = L.length ? L.map(x => `<div class="np-th up"><button data-view="${x.data}" data-title="${esc(x.name)}"><img src="${x.data}" alt="${esc(x.name)}"><span>${esc(x.name)}</span></button><button class="np-del" data-del="${esc(x.id)}" title="Remove">✕</button></div>`).join('') : '<span class="dim">none yet</span>'; };
    sec.addEventListener('toggle', () => { if (sec.open) draw(); });
    if (sec.open) draw();
    sec.addEventListener('click', async (e) => {
      const v = e.target.closest('[data-view]'); if (v) { openViewer(v.dataset.view, v.dataset.title); return; }
      const d = e.target.closest('[data-del]'); if (d && confirm('Remove this uploaded photo?')) { await delUpload(d.dataset.del); draw(); }
    });
    const inp = sec.querySelector('[data-up]'); if (inp) inp.onchange = async () => { for (const f of inp.files) await addUpload(key, f); inp.value = ''; draw(); };
  });
}

// ------------------------------------------------------------------ equipment details card (removable fields)
const HIDE_KEY = 'ehv-np-hide-v1';
const hidden = () => { try { return JSON.parse(localStorage.getItem(HIDE_KEY)) || {}; } catch { return {}; } };
const setHidden = (h) => { try { localStorage.setItem(HIDE_KEY, JSON.stringify(h)); } catch { } };
export function detailsCard(u) {
  const k = kindOf(u); if (!k || !NP) return '';
  const rows = k === 'reactor' ? NP.reactor.rows : NP.ict.rating.rows, H = hidden()[k] || [];
  const serials = k === 'ict' && DB.site.units[u]?.serials ? ['R', 'Y', 'B'].map(p => [`Sr No · ${p}-phase unit`, serialOf(u, p)]) : [];
  const all = [...serials, ...rows.filter(r => r[1] !== '@SERIAL')].map(([a, b]) => [a, b]);
  const shown = all.filter(([a]) => !H.includes(a));
  return `<details class="sec inner eqd" data-eqd="${k}"><summary><span class="sec-t">📋 Equipment details · as per nameplate</span><span class="dim">${shown.length} of ${all.length} fields shown · ✕ removes a field (kept in this browser)</span>${H.length ? `<button class="btn sm" data-eqd-reset>Restore all ${H.length} removed</button>` : ''}<span class="caret">▾</span></summary>
    <div class="eqd-g">${shown.map(([a, b]) => `<div class="eqd-i"><span>${esc(a)}</span><b class="${/verify|illegible|cut on photo|hidden/.test(b) ? 'np-ver' : ''}">${esc(b)}</b><button class="eqd-x" data-eqd-x="${esc(a)}" title="Remove this field">✕</button></div>`).join('')}</div></details>`;
}
let EQD_OPEN = false;
export function wireDetails(root, rerender) {
  $$('[data-eqd]', root).forEach(card => {
    card.open = EQD_OPEN; card.addEventListener('toggle', () => { EQD_OPEN = card.open; });
    const k = card.dataset.eqd;
    $$('[data-eqd-x]', card).forEach(b => b.onclick = () => { const h = hidden(); h[k] = [...new Set([...(h[k] || []), b.dataset.eqdX])]; setHidden(h); rerender(); });
    const r = card.querySelector('[data-eqd-reset]'); if (r) r.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); const h = hidden(); delete h[k]; setHidden(h); rerender(); };
  });
}
export { kindOf as nameplateKind };
