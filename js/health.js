// Transformer Health Index — weighted-factor method in the spirit of CIGRE TB 761 and
// Jahromi et al. (2009). Indicative only: weights and break-points are set here, openly,
// so S.E. PAC can tune them. Each factor keeps the reading that drove its score.
import { DB, recs, groupBy } from './data.js?v=20261126.1804';
import { LIM } from './rules.js?v=20261126.1804';

const lerp = (x, pts) => {           // piecewise-linear: pts = [[x,score],...] ascending x
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};
const latestBy = (rs, key) => [...groupBy(rs, key).values()].map(s => s.sort((a, b) => a.date.localeCompare(b.date)).at(-1));

const recsOK = (t, f) => recs(t, f).filter(r => !r.excluded);
export const HI_WEIGHTS = { dga: 30, oil: 15, winding: 25, bushing: 30 };
export const HI_BANDS = [[85, 1, 'Excellent', 'Normal ageing — continue routine tests'], [70, 2, 'Good', 'Routine tests at circular frequency'], [50, 3, 'Satisfactory', 'Closer monitoring; plan investigation'], [30, 4, 'Needs care', 'Plan corrective action at next outage'], [0, 5, 'Priority care', 'Priority assessment']];
export const band = (hi) => HI_BANDS.find(b => hi >= b[0]);

const GAS_W = { H2: 2, CH4: 3, C2H6: 3, C2H4: 3, C2H2: 5, CO: 1, CO2: 1 };
const ratioScore = (r) => lerp(r, [[0.5, 100], [1, 70], [2, 40], [4, 10], [8, 0]]);

export function healthIndex(unit) {
  const f = {};
  // DGA — weighted gas-ratio score on the worst main-tank sample
  const dga = latestBy(recsOK('dga', { unit }).filter(r => r.pos !== 'OLTC'), r => r.ph + r.pos);
  if (dga.length) {
    const scored = dga.map(r => {
      let sw = 0, ss = 0, worstG = null, worstR = 0;
      for (const [g, w] of Object.entries(GAS_W)) if (r.v[g] != null) { const rt = r.v[g] / LIM.dga[g]; ss += w * ratioScore(rt); sw += w; if (rt > worstR) { worstR = rt; worstG = g; } }
      // weighted average, but the worst gas governs (a single fault gas must not be diluted)
      return { r, s: sw ? Math.min(ss / sw, ratioScore(worstR) + 20) : 100, worstG, worstR };
    }).sort((a, b) => a.s - b.s)[0];
    f.dga = { score: scored.s, label: 'Dissolved gases', why: `${scored.r.ph !== '-' ? scored.r.ph + '-ph ' : ''}${scored.r.pos}, ${scored.r.date}: highest ${scored.worstG} at ${scored.worstR.toFixed(1)}× IEEE Cond-1`, date: scored.r.date };
  }
  // Oil quality — BDV & water of the same samples
  const oil = dga.filter(r => r.v.BDV != null || r.v.H2O != null).map(r => {
    const a = r.v.BDV != null ? lerp(r.v.BDV, [[30, 0], [40, 10], [50, 40], [60, 70], [70, 100]]) : 100;
    const b = r.v.H2O != null ? lerp(r.v.H2O, [[10, 100], [15, 85], [20, 60], [30, 30], [40, 0]]) : 100;
    return { r, s: (a + b) / 2 };
  }).sort((a, b) => a.s - b.s)[0];
  if (oil) f.oil = { score: oil.s, label: 'Oil quality', why: `BDV ${oil.r.v.BDV ?? '—'} kV · water ${oil.r.v.H2O ?? '—'} ppm (${oil.r.ph !== '-' ? oil.r.ph + '-ph ' : ''}${oil.r.pos})`, date: oil.r.date };
  // Winding insulation — worst tan δ @20 °C of latest test
  const w = latestBy(recsOK('winding', { unit }).filter(r => r.v.tand20 != null), r => r.ph + r.acting).sort((a, b) => b.v.tand20 - a.v.tand20)[0];
  if (w) f.winding = { score: lerp(w.v.tand20, [[0.3, 100], [0.5, 85], [0.7, 60], [1.0, 30], [1.5, 0]]), label: 'Winding insulation', why: `${w.ph !== '-' ? w.ph + '-ph ' : ''}${w.acting} tan δ₂₀ ${w.v.tand20.toFixed(3)} %`, date: w.date };
  // Bushings — worst measured tan δ, capped if rising > 0.1 %/yr
  const bs = latestBy(recsOK('bushing', { unit }).filter(r => r.v.tand20 != null), r => r.pos + r.ph);
  if (bs.length) {
    const b = bs.sort((a, b) => b.v.tand20 - a.v.tand20)[0];
    let sc = lerp(b.v.tand20, [[0.4, 100], [0.5, 85], [0.7, 60], [1.0, 20], [1.2, 0]]);
    const rising = DB.records.some(r => r.t === 'bushing' && r.unit === unit) && FIND_RISE(unit);
    if (rising) sc = Math.min(sc, 60);
    f.bushing = { score: sc, label: 'Bushings', why: `${b.pos ? b.pos + ' ' : ''}${b.ph}-ph corrected tan δ ${b.v.tand20.toFixed(3)} %${rising ? ' · rising > 0.1 %/yr (capped at 60)' : ''}`, date: b.date };
  }
  const keys = Object.keys(f);
  if (!keys.length) return null;
  const tw = keys.reduce((a, k) => a + HI_WEIGHTS[k], 0);
  const gov = [...keys].sort((a, b) => f[a].score - f[b].score)[0];
  // governing-factor override: a poor factor caps the overall index (CIGRE TB 761 principle)
  const hi = Math.min(keys.reduce((a, k) => a + HI_WEIGHTS[k] * f[k].score, 0) / tw, f[gov].score + 25);
  return { hi: Math.round(hi), band: band(hi), factors: f, governing: gov };
}

let FIND_RISE = () => false;
export function bindRise(fn) { FIND_RISE = fn; }

export function gaugeSVG(hi, size = 76) {
  const b = band(hi), r = 30, c = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, hi / 100));
  const col = `var(--${['good', 'brand-2', 'watch', 'alert', 'crit'][b[1] - 1]})`;
  return `<svg class="gauge" viewBox="0 0 76 76" width="${size}" height="${size}" role="img" aria-label="Health index ${hi} of 100, ${b[2]}">
    <circle cx="38" cy="38" r="${r}" fill="none" stroke="var(--panel-3)" stroke-width="8"/>
    <circle cx="38" cy="38" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/>
    <text x="38" y="42" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="19" font-weight="600" fill="var(--ink)">${hi}</text></svg>`;
}

// ---------------------------------------------------------------------------
// Bay Health Index — breaker (CRM + timing), CT insulation and LA condition.
// Same mechanics as the transformer index: weighted factors, worst factor governs.
// CRM is scored against the fleet median of the same voltage class (healthy-fleet
// baseline), because the circular's 400 kV 50 µΩ figure does not match per-pole
// measurement (see finding); the circular limit is still shown on every chart.
import { kvOf, done } from './data.js?v=20261126.1804';
export const BAY_WEIGHTS = { cb_crm: 20, cb_timing: 20, ct: 30, la: 30 };
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const latestPh = (t, unit) => latestBy(recsOK(t, { unit }).filter(done), r => r.ph);

export function bayHealth(unit) {
  const f = {}, kv = kvOf(unit);
  const crm = latestPh('cb_crm', unit).filter(r => r.v.R != null);
  if (crm.length) {
    const lim = { 400: 50, 220: 100 }[kv], hi = crm.sort((a, b) => b.v.R - a.v.R)[0];
    const sc = lerp(hi.v.R / lim, [[0.8, 100], [1.0, 80], [1.2, 60], [1.5, 30], [2, 0]]);
    f.cb_crm = { score: sc, label: 'Breaker contacts', why: `max ${hi.v.R} µΩ (${hi.ph}-ph) vs circular ${lim} µΩ`, date: hi.date };
  }
  const tm = latestPh('cb_timing', unit);
  if (tm.length) {
    const trip = { 400: 25, 220: 35 }[kv];
    const op = Math.max(...tm.map(r => Math.max(r.v.open1 ?? 0, r.v.open2 ?? 0)));
    const cl = Math.max(...tm.map(r => r.v.close ?? 0));
    let sc = Math.min(lerp(op / trip, [[0.8, 100], [0.9, 90], [1.0, 65], [1.2, 25], [1.5, 0]]), cl ? lerp(cl / 150, [[0.7, 100], [0.85, 90], [1.0, 60], [1.5, 10], [2, 0]]) : 100);
    const spread = (k) => { const v = tm.map(r => r.v[k]).filter(x => x != null); return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0; };
    if (spread('close') > 5 || spread('open1') > 3.33) sc = Math.min(sc, 70);
    f.cb_timing = { score: sc, label: 'Breaker mechanism', why: `trip ${op.toFixed(1)} ms (limit ${trip}) · close ${cl ? cl.toFixed(1) : '—'} ms (limit 150)${spread('close') > 5 ? ` · close-pole spread ${spread('close').toFixed(1)} ms` : ''}`, date: tm[0].date };
  }
  const c = latestPh('ct', unit).filter(r => r.v.tand20 != null);
  if (c.length) {
    const w = c.sort((a, b) => b.v.tand20 - a.v.tand20)[0];
    f.ct = { score: lerp(w.v.tand20, [[0.3, 100], [0.5, 85], [0.7, 60], [1.0, 20], [1.2, 0]]), label: 'CT insulation', why: `${w.ph}-ph corrected tan δ ${w.v.tand20.toFixed(3)} % · C ${w.v.C ?? '—'} pF`, date: w.date };
  }
  const l = latestPh('la', unit).filter(r => r.v.Icorr != null);
  if (l.length) {
    const w = l.sort((a, b) => b.v.Icorr - a.v.Icorr)[0];
    f.la = { score: lerp(w.v.Icorr, [[30, 100], [100, 85], [150, 65], [350, 25], [500, 0]]), label: 'Surge arresters', why: `${w.ph}-ph Icorr ${w.v.Icorr} µA (${w.season || ''} ${w.date})`, date: w.date };
  }
  const keys = Object.keys(f);
  if (!keys.length) return null;
  const tw = keys.reduce((a, k) => a + BAY_WEIGHTS[k], 0);
  const gov = [...keys].sort((a, b) => f[a].score - f[b].score)[0];
  const hi = Math.min(keys.reduce((a, k) => a + BAY_WEIGHTS[k] * f[k].score, 0) / tw, f[gov].score + 25);
  return { hi: Math.round(hi), band: band(hi), factors: f, governing: gov, weights: BAY_WEIGHTS };
}
export function assetHealth(u) { if (/^(ICT1|ICT2|SPARE_ICT|BUS_REACTOR)$/.test(u)) { const h = healthIndex(u); return h && { ...h, weights: HI_WEIGHTS }; } return bayHealth(u); }
