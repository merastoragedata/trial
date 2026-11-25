#!/usr/bin/env python3
"""Generate assets/bg/substation.svg — a 400 kV switchyard in forested Sahyadri country.

Layers back to front: morning sky, haze, flat-topped Sahyadri plateaus, forested ridges,
transmission towers + lines, jungle band, the switchyard (gantries, strung buses,
insulator strings, breakers, CTs, isolators, arresters, ICTs, control building),
foreground jungle and framing trees. Deterministic (seeded) so the file is reproducible.

    python3 tools/make_background.py
"""
import random, math, pathlib

W, H = 2400, 1100
rnd = random.Random(400)
out = []
add = out.append

def f(x): return f'{x:.1f}'

# ---------------------------------------------------------------- sky & haze
add(f'''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#5f9ccc"/><stop offset=".38" stop-color="#9cc6e0"/><stop offset=".6" stop-color="#d9e8ea"/><stop offset=".72" stop-color="#efe7d2"/></linearGradient>
<radialGradient id="sun" cx="1820" cy="330" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff7dd" stop-opacity=".95"/><stop offset=".3" stop-color="#ffeab0" stop-opacity=".45"/><stop offset="1" stop-color="#ffeab0" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8eee9" stop-opacity="0"/><stop offset="1" stop-color="#e8eee9" stop-opacity=".75"/></linearGradient>
<linearGradient id="gravel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b5a7"/><stop offset="1" stop-color="#a7a294"/></linearGradient>
<linearGradient id="galv" x1="0" x2="1"><stop offset="0" stop-color="#8d979f"/><stop offset=".5" stop-color="#c8cfd4"/><stop offset="1" stop-color="#7f8a93"/></linearGradient>
<linearGradient id="tank" x1="0" x2="1"><stop offset="0" stop-color="#4f6a78"/><stop offset=".5" stop-color="#7b96a5"/><stop offset="1" stop-color="#4a6372"/></linearGradient>
<linearGradient id="vign" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#0b1726" stop-opacity="0"/><stop offset="1" stop-color="#0b1726" stop-opacity=".35"/></linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#sky)"/><rect width="{W}" height="{H}" fill="url(#sun)"/>''')
for _ in range(9):                                     # soft monsoon-season clouds
    cx, cy, s = rnd.uniform(0, W), rnd.uniform(60, 300), rnd.uniform(0.6, 1.5)
    g = ''.join(f'<ellipse cx="{f(cx + rnd.uniform(-120, 120) * s)}" cy="{f(cy + rnd.uniform(-18, 18) * s)}" rx="{f(rnd.uniform(60, 140) * s)}" ry="{f(rnd.uniform(18, 36) * s)}"/>' for _ in range(6))
    add(f'<g fill="#ffffff" opacity="{rnd.uniform(.35, .6):.2f}">{g}</g>')

# ---------------------------------------------------------------- Sahyadri plateaus (flat tops, steep scarps)
def ridge(base, tops, color, op=1.0):
    pts = [(0, H)]
    for x0, x1, y, slope in tops:
        pts += [(x0 - slope, base), (x0, y), (x0 + (x1 - x0) * .3, y - 4), (x1, y + 2), (x1 + slope, base)]
    pts += [(W, base), (W, H)]
    add(f'<path d="M{" L".join(f"{f(x)} {f(y)}" for x, y in pts)}Z" fill="{color}" opacity="{op}"/>')
ridge(640, [(60, 520, 470, 90), (700, 1180, 452, 110), (1350, 1900, 480, 120), (2050, 2400, 462, 90)], '#9db3bf', .95)
ridge(680, [(-80, 380, 540, 70), (520, 980, 520, 80), (1150, 1600, 548, 90), (1780, 2300, 530, 80)], '#7f9aa1', .95)
add(f'<rect y="430" width="{W}" height="280" fill="url(#haze)"/>')

# forested ridge texture (distant canopy dots)
def canopy_band(y0, y1, n, cols, rmin, rmax, op=1):
    g = []
    for _ in range(n):
        x, y = rnd.uniform(-20, W + 20), rnd.uniform(y0, y1)
        r = rnd.uniform(rmin, rmax)
        g.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{rnd.choice(cols)}"/>')
    add(f'<g opacity="{op}">{"".join(g)}</g>')
add(f'<path d="M0 700 C300 640 520 660 760 630 S1200 610 1480 640 S1980 620 2400 650 L2400 {H} L0 {H}Z" fill="#5d7d63"/>')
canopy_band(625, 720, 900, ['#5a7a5e', '#4f7055', '#668a69', '#57775b'], 7, 16, .9)

# ---------------------------------------------------------------- transmission towers on the hills + lines into the yard
def tower(x, base, h, op=1):
    w = h * .22; top = base - h
    s = f'<g stroke="#4c5761" stroke-width="{max(1, h / 90):.2f}" fill="none" opacity="{op}">'
    s += f'<path d="M{f(x - w)} {f(base)} L{f(x - w * .18)} {f(top)} L{f(x + w * .18)} {f(top)} L{f(x + w)} {f(base)}"/>'
    for k in range(1, 7):                                          # bracing
        y = base - h * k / 7; hw = w - (w - w * .18) * k / 7; y2 = base - h * (k - 1) / 7; hw2 = w - (w - w * .18) * (k - 1) / 7
        s += f'<path d="M{f(x - hw2)} {f(y2)} L{f(x + hw)} {f(y)} M{f(x + hw2)} {f(y2)} L{f(x - hw)} {f(y)}"/>'
    for k, cw in ((.78, 1.25), (.62, 1.05), (.46, .9)):           # cross-arms
        y = base - h * k
        s += f'<path d="M{f(x - w * cw)} {f(y)} L{f(x + w * cw)} {f(y)} M{f(x - w * cw)} {f(y)} l{f(w * .25)} {f(-h * .05)} M{f(x + w * cw)} {f(y)} l{f(-w * .25)} {f(-h * .05)}"/>'
        s += f'<path d="M{f(x - w * cw)} {f(y)} v{f(h * .06)} M{f(x + w * cw)} {f(y)} v{f(h * .06)}" stroke="#7a5a44" stroke-width="{max(1.2, h / 60):.2f}"/>'
    s += f'<path d="M{f(x - w * .18)} {f(top)} L{f(x)} {f(top - h * .08)} L{f(x + w * .18)} {f(top)}"/></g>'
    add(s)
    return [(x - w * cw, base - h * k + h * .06) for k, cw in ((.78, 1.25), (.62, 1.05), (.46, .9))] + [(x + w * cw, base - h * k + h * .06) for k, cw in ((.78, 1.25), (.62, 1.05), (.46, .9))]

def catenary(p, q, sag, col='#3e4952', wdt=1.1, op=.85):
    mx, my = (p[0] + q[0]) / 2, max(p[1], q[1]) + sag
    add(f'<path d="M{f(p[0])} {f(p[1])} Q{f(mx)} {f(my)} {f(q[0])} {f(q[1])}" stroke="{col}" stroke-width="{wdt}" fill="none" opacity="{op}"/>')

lines = [  # two 400 kV lines arriving from the hills (left and right), towers getting bigger as they approach
    [(90, 690, 90), (360, 725, 150), (640, 790, 240)],
    [(2330, 688, 95), (2060, 722, 155), (1790, 790, 245)],
]
for ln in lines:
    prev = None
    for x, b, h in ln:
        pts = tower(x, b, h)
        if prev:
            for i in range(0, 6):
                catenary(prev[i], pts[i], 10 + h * .08, op=.7)
        prev = pts

# ---------------------------------------------------------------- jungle band behind the yard
add(f'<path d="M0 760 Q600 720 1200 745 T2400 735 L2400 820 L0 820Z" fill="#355c3c"/>')
canopy_band(718, 790, 1400, ['#2f5636', '#3c6a43', '#477a4c', '#2a4d31', '#55894f'], 10, 24)

# ---------------------------------------------------------------- yard ground
add(f'<path d="M0 805 L{W} 795 L{W} {H} L0 {H}Z" fill="url(#gravel)"/>')
for _ in range(1600):                                  # gravel speckle
    x, y = rnd.uniform(0, W), rnd.uniform(800, H)
    add(f'<circle cx="{f(x)}" cy="{f(y)}" r="{rnd.uniform(.6, 1.8):.1f}" fill="{rnd.choice(["#8f8a7d", "#d1ccbe", "#9c978a"])}" opacity=".55"/>')
for x in range(0, W, 36):                              # perimeter fence (chain link) at the back
    add(f'<path d="M{x} 790 v28" stroke="#6d757c" stroke-width="1.4"/>')
add(f'<path d="M0 792 H{W} M0 800 H{W} M0 808 H{W}" stroke="#8c949a" stroke-width=".8" opacity=".8"/>')

# ---------------------------------------------------------------- switchyard structures
def lattice_col(x, base, h, w=16):
    s = f'<g stroke="url(#galv)" stroke-width="2.2" fill="none"><path d="M{f(x - w / 2)} {f(base)} V{f(base - h)} M{f(x + w / 2)} {f(base)} V{f(base - h)}"/>'
    n = int(h / 18)
    for k in range(n):
        y = base - k * h / n; y2 = base - (k + 1) * h / n
        s += f'<path d="M{f(x - w / 2)} {f(y)} L{f(x + w / 2)} {f(y2)}" stroke-width="1.1"/>'
    return s + '</g>'

def beam(x0, x1, y, d=14):
    s = f'<g stroke="url(#galv)" fill="none"><path d="M{f(x0)} {f(y)} H{f(x1)} M{f(x0)} {f(y + d)} H{f(x1)}" stroke-width="2.4"/>'
    n = int((x1 - x0) / 16)
    for k in range(n):
        xa = x0 + k * (x1 - x0) / n; xb = x0 + (k + 1) * (x1 - x0) / n
        s += f'<path d="M{f(xa)} {f(y + d)} L{f(xb)} {f(y)}" stroke-width="1"/>'
    return s + '</g>'

def insulator_string(x, y, n=10, down=True):
    s = f'<g fill="#5e6b74">'
    for k in range(n):
        s += f'<ellipse cx="{f(x)}" cy="{f(y + (k * 4.2 if down else -k * 4.2))}" rx="4.2" ry="1.4"/>'
    return s + '</g>'

def porcelain(x, base, h, w=7, n=None, col='#7a5642', col2='#5e4231'):
    n = n or max(6, int(h / 7))
    s = f'<rect x="{f(x - w * .3)}" y="{f(base - h)}" width="{f(w * .6)}" height="{f(h)}" fill="{col2}"/>'
    for k in range(n):
        s += f'<ellipse cx="{f(x)}" cy="{f(base - h + (k + .5) * h / n)}" rx="{f(w / 2)}" ry="{f(h / n * .3)}" fill="{col}"/>'
    return s

def support(x, base, h):
    return f'<path d="M{f(x)} {f(base)} V{f(base - h)}" stroke="#8f9aa2" stroke-width="5"/><path d="M{f(x - 8)} {f(base)} H{f(x + 8)}" stroke="#6c767d" stroke-width="3"/>'

def breaker(x, base):           # SF6 live-tank 2-break pole on a support
    s = support(x, base, 46) + porcelain(x, base - 46, 52, 9, 10, '#8b97a1', '#6d7882')
    s += f'<rect x="{f(x - 34)}" y="{f(base - 106)}" width="68" height="10" rx="5" fill="url(#galv)"/>'
    s += porcelain(x - 22, base - 96, 0.1) + f'<rect x="{f(x - 13)}" y="{f(base - 66)}" width="26" height="14" rx="2" fill="#9aa4ad"/>'
    return s
def ct(x, base):
    return support(x, base, 40) + porcelain(x, base - 40, 46, 10) + f'<ellipse cx="{f(x)}" cy="{f(base - 92)}" rx="13" ry="9" fill="url(#tank)"/>'
def la(x, base):
    return support(x, base, 34) + porcelain(x, base - 34, 60, 8, 14) + f'<ellipse cx="{f(x)}" cy="{f(base - 94)}" rx="14" ry="3" fill="none" stroke="#c3cbd2" stroke-width="2"/>'
def cvt(x, base):
    return support(x, base, 34) + f'<rect x="{f(x - 9)}" y="{f(base - 48)}" width="18" height="14" fill="url(#tank)"/>' + porcelain(x, base - 48, 54, 9)
def isolator(x, base):
    s = support(x - 26, base, 44) + support(x + 26, base, 44) + porcelain(x - 26, base - 44, 30, 7) + porcelain(x + 26, base - 44, 30, 7)
    return s + f'<path d="M{f(x - 26)} {f(base - 76)} L{f(x + 26)} {f(base - 76)}" stroke="#b9c2c9" stroke-width="3"/>'

yard = []
GB = 905                                       # ground line of the yard (equipment base)
# tall 400 kV gantries (back), bays spaced along the yard
bays = list(range(330, 2150, 150))
for gx in (bays[0] - 75, bays[-1] + 75):
    yard.append(lattice_col(gx, GB, 300, 20))
for i in range(len(bays) + 1):
    x = bays[0] - 75 + i * 150
    yard.append(lattice_col(x, GB, 300, 16))
yard.append(beam(bays[0] - 75, bays[-1] + 75, GB - 300, 16))
yard.append(beam(bays[0] - 75, bays[-1] + 75, GB - 220, 12))
# strung buses with insulator strings
for yb in (GB - 286, GB - 208):
    for i in range(len(bays)):
        x0 = bays[0] - 75 + i * 150
        for ph, off in enumerate((-34, 0, 34)):
            yard.append(insulator_string(x0 + 75 + off, yb, 7))
        for ph, off in enumerate((-34, 0, 34)):
            p = (x0 + 75 + off, yb + 30)
            q = (x0 + 225 + off, yb + 30) if i < len(bays) - 1 else None
            if q: yard.append(f'<path d="M{f(p[0])} {f(p[1])} Q{f((p[0] + q[0]) / 2)} {f(p[1] + 9)} {f(q[0])} {f(q[1])}" stroke="#4a545c" stroke-width="1.6" fill="none"/>')
# droppers + equipment rows per bay (3 phases each)
for i, bx in enumerate(bays):
    for off in (-34, 0, 34):
        x = bx + off
        yard.append(f'<path d="M{f(x)} {f(GB - 178)} V{f(GB - 120)}" stroke="#4a545c" stroke-width="1.4"/>')
        kind = i % 4
        if kind == 0: yard.append(breaker(x, GB))
        elif kind == 1: yard.append(ct(x, GB))
        elif kind == 2: yard.append(isolator(x, GB) if off == 0 else la(x, GB))
        else: yard.append(cvt(x, GB))
# two ICTs with firewalls (front right) and a control building (front left)
def ict(x, base):
    s = f'<rect x="{f(x - 85)}" y="{f(base - 6)}" width="170" height="10" fill="#5e676e"/><rect x="{f(x - 70)}" y="{f(base - 70)}" width="140" height="70" rx="4" fill="url(#tank)"/>'
    for k in range(9): s += f'<rect x="{f(x + 74 + k * 7)}" y="{f(base - 62)}" width="5" height="54" fill="url(#galv)"/>'
    s += f'<rect x="{f(x - 50)}" y="{f(base - 102)}" width="90" height="22" rx="11" fill="url(#galv)"/>'
    for bxo, h in ((-40, 70), (0, 52), (36, 34)): s += porcelain(x + bxo, base - 70, h, 9)
    return s + f'<rect x="{f(x - 75)}" y="{f(base)}" width="150" height="8" fill="#6f7a82"/>'
# front row (closer to the viewer → larger): ICT 1 and ICT 2 with firewalls between bays of equipment
FB = 1010
front = []
for x in (1150, 1520):
    front.append(f'<rect x="{x - 95}" y="{FB - 150}" width="16" height="158" fill="#a9a291"/><rect x="{x + 175}" y="{FB - 150}" width="16" height="158" fill="#a9a291"/>')
    front.append(ict(x + 40, FB))
for i, x in enumerate(range(640, 1000, 60)):
    front.append([breaker, ct, la, isolator, cvt, breaker][i % 6](x, FB))
yard.append(f'<g transform="translate(0 0)">{"".join(front)}</g>')
yard.append(f'<g><rect x="150" y="{GB - 95}" width="210" height="100" fill="#eef0ea"/><rect x="140" y="{GB - 104}" width="230" height="12" fill="#c9ccc4"/>' +
            ''.join(f'<rect x="{165 + k * 40}" y="{GB - 72}" width="26" height="30" fill="#5e86a8" opacity=".85"/>' for k in range(5)) +
            f'<rect x="240" y="{GB - 38}" width="28" height="43" fill="#7a6a58"/><text x="255" y="{GB - 80}" font-family="Inter,sans-serif" font-size="9" fill="#58605f" text-anchor="middle" opacity=".0">CR</text></g>')
add(f'<g>{"".join(yard)}</g>')

# ---------------------------------------------------------------- foreground jungle & framing trees
def shade(hexc, k):
    c = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    c = [max(0, min(255, int(v * k))) for v in c]
    return '#%02x%02x%02x' % tuple(c)

def tree(x, base, h, cols, op=1, kind='rain'):
    """Broad-leaf tree: trunk + branching + clustered canopy shaded dark-left / light-right."""
    tw = h * .05
    s = f'<g opacity="{op}">'
    s += f'<path d="M{f(x - tw)} {f(base)} Q{f(x - tw * .3)} {f(base - h * .45)} {f(x - tw * .25)} {f(base - h * .6)} L{f(x + tw * .25)} {f(base - h * .6)} Q{f(x + tw * .4)} {f(base - h * .45)} {f(x + tw)} {f(base)}Z" fill="#3a2a1f"/>'
    for d in (-1, 1):  # main limbs
        s += f'<path d="M{f(x)} {f(base - h * .55)} Q{f(x + d * h * .12)} {f(base - h * .68)} {f(x + d * h * .24)} {f(base - h * .74)}" stroke="#3a2a1f" stroke-width="{f(tw * .6)}" fill="none"/>'
    spread, cy0, vr = ((1.25, .74, .55) if kind == 'rain' else (.6, .72, .85))
    base_col = cols[0]
    clusters = int(18 + h / 18)
    pts = []
    for _ in range(clusters):
        a = rnd.uniform(0, math.pi); rr = rnd.uniform(.1, .45) * h
        cx = x + math.cos(a) * rr * spread * rnd.choice((-1, 1)); cy = base - h * cy0 - math.sin(a) * rr * vr + rnd.uniform(-h * .05, h * .08)
        pts.append((cx, cy, rnd.uniform(.09, .16) * h))
    pts.sort(key=lambda p: p[1])
    for cx, cy, r in pts:                           # each cluster: dark body, mid layer, sunlit cap
        c = rnd.choice(cols)
        s += f'<circle cx="{f(cx - r * .08)}" cy="{f(cy + r * .1)}" r="{f(r)}" fill="{shade(c, .72)}"/>'
        s += f'<circle cx="{f(cx + r * .05)}" cy="{f(cy - r * .02)}" r="{f(r * .82)}" fill="{c}"/>'
        s += f'<circle cx="{f(cx + r * .28)}" cy="{f(cy - r * .3)}" r="{f(r * .45)}" fill="{shade(c, 1.28)}" opacity=".85"/>'
        for _ in range(3):                          # leaf texture
            s += f'<circle cx="{f(cx + rnd.uniform(-r, r) * .7)}" cy="{f(cy + rnd.uniform(-r, r) * .7)}" r="{f(r * rnd.uniform(.1, .2))}" fill="{shade(c, rnd.choice((.8, 1.2)))}" opacity=".8"/>'
    return s + '</g>'

def palm(x, base, h, op=1):
    s = f'<g opacity="{op}"><path d="M{f(x)} {f(base)} Q{f(x + h * .08)} {f(base - h * .5)} {f(x + h * .03)} {f(base - h)}" stroke="#6b5642" stroke-width="{f(h * .025)}" fill="none"/>'
    tx, ty = x + h * .03, base - h
    for k in range(11):
        a = -math.pi + k * math.pi / 10 + rnd.uniform(-.1, .1); L = h * rnd.uniform(.28, .36)
        ex, ey = tx + math.cos(a) * L, ty + math.sin(a) * L * .55 + L * .35
        s += f'<path d="M{f(tx)} {f(ty)} Q{f(tx + math.cos(a) * L * .6)} {f(ty + math.sin(a) * L * .5 - L * .15)} {f(ex)} {f(ey)}" stroke="{rnd.choice(["#2f5a2f", "#3f7038", "#4c8240"])}" stroke-width="{f(h * .018)}" fill="none" stroke-linecap="round"/>'
    return s + '</g>'

DARK = ['#1f3d26', '#284d2f', '#2f5a35', '#23452a', '#36663b']
LIGHT = ['#3d7a43', '#4b8b4c', '#5a9a55', '#447f45']
for x, h, k in ((-60, 640, 'rain'), (170, 470, 'teak'), (340, 340, 'rain')):
    add(tree(x, H + 40, h, DARK + LIGHT[:2], kind=k))
add(palm(470, H + 20, 380, .95))
for x, h, k in ((2460, 660, 'rain'), (2230, 480, 'teak'), (2060, 350, 'rain')):
    add(tree(x, H + 40, h, DARK + LIGHT[:2], kind=k))
add(palm(1930, H + 20, 360, .95))
for x, h in ((70, 290), (2330, 300)):
    add(tree(x, H + 10, h, LIGHT, .95))
g = []
for _ in range(700):                                    # undergrowth / grass along the bottom edge
    x = rnd.uniform(0, W); y = rnd.uniform(H - 80, H + 10)
    if 520 < x < 1880 and y < H - 30: continue
    g.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(8, 22))}" fill="{rnd.choice(DARK + LIGHT)}"/>')
add(f'<g>{"".join(g)}</g>')
add(f'<rect width="{W}" height="{H}" fill="url(#vign)"/>')

svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">' + ''.join(out) + '</svg>'
p = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'bg' / 'substation.svg'
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(svg)
print(p, len(svg) // 1024, 'KB')
