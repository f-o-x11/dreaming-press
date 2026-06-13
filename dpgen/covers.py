#!/usr/bin/env python3
"""
covers.py — deterministic generative SVG cover art for dreaming.press.

No external dependencies, no model weights, no API. Each post gets a unique,
section-themed editorial poster seeded from its slug. Output is a self-contained
SVG (1200x800) that renders identically everywhere and embeds fine as <img>.

Public API:
    make_cover(slug, title, section, kicker=None) -> str   # returns SVG markup
"""

import hashlib
import math

# ── section palettes ─────────────────────────────────────────────────────────
# each: (ground top, ground bottom, accent, accent-2, ink-on-art)
PALETTES = {
    "dispatches": [
        ("#1a0f0c", "#2a130c", "#ff6a4d", "#ffd0a0", "#fff4ec"),
        ("#2a1206", "#140805", "#ff8a3d", "#ffe0b0", "#fff2e6"),
    ],
    "wire": [
        ("#07121f", "#0b1f33", "#5b93ff", "#a9ffe6", "#eaf2ff"),
        ("#0a1424", "#04101d", "#2f6df0", "#7fe0ff", "#e6f0ff"),
    ],
    "stack": [
        ("#06140d", "#0a2417", "#38c47e", "#b8ff7a", "#e9ffef"),
        ("#04130c", "#0d2a1a", "#1f9d57", "#9affc8", "#e6fff0"),
    ],
    "fabrications": [
        ("#140a1f", "#23103a", "#c66bf3", "#ff9ad2", "#f7eaff"),
        ("#1a0c2a", "#0e0717", "#9b2fd6", "#ffb0e6", "#f3e6ff"),
    ],
}
DEFAULT_PAL = PALETTES["dispatches"]


def _seed(slug):
    h = hashlib.sha256(slug.encode("utf-8")).hexdigest()
    return int(h[:16], 16)


class RNG:
    """Tiny deterministic LCG."""
    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFFFFFFFFFF
    def _next(self):
        self.s = (self.s * 6364136223846793005 + 1442695040888963407) & 0xFFFFFFFFFFFFFFFF
        return self.s
    def rnd(self):
        return self._next() / 0xFFFFFFFFFFFFFFFF
    def rint(self, a, b):
        return a + int(self.rnd() * (b - a + 1))
    def pick(self, seq):
        return seq[self.rint(0, len(seq) - 1)]
    def chance(self, p):
        return self.rnd() < p


W, H = 1200, 800


def _hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _mix(c1, c2, t):
    a, b = _hex_to_rgb(c1), _hex_to_rgb(c2)
    r = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return "#%02x%02x%02x" % r


# ── composition generators ───────────────────────────────────────────────────

def _orbit(r, pal):
    """Network / agent graph — nodes and connecting edges."""
    acc, acc2 = pal[2], pal[3]
    cx, cy = W * (0.42 + r.rnd() * 0.16), H * (0.46 + r.rnd() * 0.12)
    n = r.rint(7, 11)
    pts = []
    for i in range(n):
        ang = r.rnd() * math.tau
        rad = 90 + r.rnd() * 320
        x = cx + math.cos(ang) * rad
        y = cy + math.sin(ang) * rad * 0.78
        pts.append((x, y, 6 + r.rnd() * 26))
    out = []
    # edges
    for i in range(n):
        for j in range(i + 1, n):
            if r.chance(0.32):
                x1, y1, _ = pts[i]; x2, y2, _ = pts[j]
                out.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" '
                           f'stroke="{acc}" stroke-width="1.2" opacity="0.30"/>')
    # nodes
    for (x, y, rr) in pts:
        col = acc if r.chance(0.6) else acc2
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rr:.0f}" fill="{col}" opacity="0.9"/>')
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rr+8:.0f}" fill="none" '
                   f'stroke="{col}" stroke-width="1" opacity="0.25"/>')
    return "\n".join(out)


def _rings(r, pal):
    """Concentric broadcast rings."""
    acc, acc2 = pal[2], pal[3]
    cx = W * (0.5 + (r.rnd() - 0.5) * 0.5)
    cy = H * (0.5 + (r.rnd() - 0.5) * 0.4)
    out = []
    n = r.rint(9, 16)
    for i in range(n):
        rad = 30 + i * (28 + r.rnd() * 22)
        col = _mix(acc, acc2, i / n)
        op = 0.10 + 0.5 * (1 - i / n)
        dash = "" if r.chance(0.5) else f' stroke-dasharray="{r.rint(2,8)} {r.rint(6,18)}"'
        out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{rad:.0f}" fill="none" '
                   f'stroke="{col}" stroke-width="{1+ r.rnd()*2.5:.1f}" opacity="{op:.2f}"{dash}/>')
    out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r.rint(10,26)}" fill="{acc}"/>')
    return "\n".join(out)


def _waveform(r, pal):
    """Stacked audio bars — for narrated dispatches."""
    acc, acc2 = pal[2], pal[3]
    out = []
    bars = r.rint(34, 52)
    gap = W / bars
    baseline = H * 0.5
    phase = r.rnd() * math.tau
    for i in range(bars):
        t = i / bars
        amp = (0.5 + 0.5 * math.sin(phase + t * (6 + r.rnd() * 10))) * (H * 0.34)
        amp *= 0.35 + r.rnd() * 0.9
        x = i * gap + gap * 0.2
        bw = gap * 0.55
        col = _mix(acc, acc2, t)
        out.append(f'<rect x="{x:.1f}" y="{baseline-amp:.1f}" width="{bw:.1f}" height="{amp:.1f}" '
                   f'rx="{bw/2:.1f}" fill="{col}" opacity="0.85"/>')
        out.append(f'<rect x="{x:.1f}" y="{baseline:.1f}" width="{bw:.1f}" height="{amp*0.6:.1f}" '
                   f'rx="{bw/2:.1f}" fill="{col}" opacity="0.4"/>')
    return "\n".join(out)


def _grid(r, pal):
    """Modular halftone grid — data / news."""
    acc, acc2 = pal[2], pal[3]
    cols = r.rint(10, 16)
    rows = r.rint(7, 11)
    cw, ch = W / cols, H / rows
    cxg, cyg = r.rnd() * cols, r.rnd() * rows
    out = []
    for ix in range(cols):
        for iy in range(rows):
            d = math.hypot(ix - cxg, iy - cyg) / max(cols, rows)
            fill = 1 - min(1, d * 1.6)
            if fill <= 0.04:
                continue
            x = ix * cw + cw / 2
            y = iy * ch + ch / 2
            rr = (min(cw, ch) / 2) * (0.25 + fill * 0.75)
            col = _mix(acc, acc2, (ix / cols))
            shape = r.rnd()
            if shape < 0.7:
                out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rr:.0f}" fill="{col}" opacity="{0.25+fill*0.6:.2f}"/>')
            else:
                out.append(f'<rect x="{x-rr:.0f}" y="{y-rr:.0f}" width="{rr*2:.0f}" height="{rr*2:.0f}" '
                           f'fill="{col}" opacity="{0.25+fill*0.6:.2f}"/>')
    return "\n".join(out)


def _strata(r, pal):
    """Risograph horizontal bands."""
    acc, acc2 = pal[2], pal[3]
    out = []
    n = r.rint(5, 9)
    y = 0
    for i in range(n):
        bh = H / n * (0.5 + r.rnd())
        col = _mix(acc, acc2, r.rnd())
        op = 0.12 + r.rnd() * 0.4
        skew = (r.rnd() - 0.5) * 120
        out.append(f'<polygon points="0,{y:.0f} {W},{y+skew:.0f} {W},{y+bh+skew:.0f} 0,{y+bh:.0f}" '
                   f'fill="{col}" opacity="{op:.2f}"/>')
        y += bh * 0.7
    return "\n".join(out)


def _codeblocks(r, pal):
    """Terminal / code window motif — the stack."""
    acc, acc2 = pal[2], pal[3]
    out = []
    x0, y0 = W * 0.16, H * 0.2
    bw, bh = W * 0.68, H * 0.6
    out.append(f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{bw:.0f}" height="{bh:.0f}" rx="16" '
               f'fill="#000" opacity="0.28"/>')
    out.append(f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{bw:.0f}" height="40" rx="16" fill="{acc}" opacity="0.22"/>')
    for i, c in enumerate(["#ff5f56", "#ffbd2e", "#27c93f"]):
        out.append(f'<circle cx="{x0+24+i*22:.0f}" cy="{y0+20:.0f}" r="6" fill="{c}"/>')
    ly = y0 + 64
    lines = r.rint(7, 10)
    for i in range(lines):
        indent = x0 + 26 + r.rint(0, 3) * 26
        lw = r.rint(120, int(bw - (indent - x0) - 40))
        col = acc if r.chance(0.5) else acc2
        out.append(f'<rect x="{indent:.0f}" y="{ly:.0f}" width="{lw}" height="9" rx="4" '
                   f'fill="{col}" opacity="{0.35 + r.rnd()*0.4:.2f}"/>')
        ly += (bh - 70) / lines
    return "\n".join(out)


GENERATORS = {
    "dispatches":   [_rings, _waveform, _orbit],
    "wire":         [_grid, _strata, _orbit],
    "stack":        [_codeblocks, _orbit, _grid],
    "fabrications": [_orbit, _strata, _rings],
}


def make_cover(slug, title, section="dispatches", kicker=None):
    section = section if section in PALETTES else "dispatches"
    seed = _seed(slug)
    r = RNG(seed)
    pal = r.pick(PALETTES.get(section, DEFAULT_PAL))
    gtop, gbot, acc, acc2, ink = pal
    gen = r.pick(GENERATORS.get(section, [_orbit]))
    art = gen(r, pal)

    kicker = (kicker or section).upper()
    # big faint initial behind
    initial = (title.strip()[:1] or "D").upper()
    rot = (r.rnd() - 0.5) * 6

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{_esc(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{gtop}"/>
      <stop offset="1" stop-color="{gbot}"/>
    </linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/></filter>
  </defs>

  <rect width="{W}" height="{H}" fill="url(#g)"/>
  <text x="{W*0.5:.0f}" y="{H*0.78:.0f}" font-family="Georgia, serif" font-size="640"
        font-weight="700" fill="{acc}" opacity="0.07" text-anchor="middle"
        transform="rotate({rot:.1f} {W*0.5:.0f} {H*0.5:.0f})">{_esc(initial)}</text>

  <g transform="translate(0,0)">{art}</g>

  <rect width="{W}" height="{H}" fill="url(#vig)"/>
  <rect width="{W}" height="{H}" filter="url(#grain)" opacity="0.5"/>

  <rect x="40" y="40" width="{W-80}" height="{H-80}" fill="none" stroke="{ink}" stroke-opacity="0.18" stroke-width="1.5"/>
  <text x="60" y="78" font-family="ui-monospace, Menlo, monospace" font-size="22" letter-spacing="4"
        fill="{acc}" font-weight="600">{_esc(kicker)}</text>
  <text x="60" y="{H-52:.0f}" font-family="Georgia, serif" font-style="italic" font-size="30"
        fill="{ink}" opacity="0.9">dreaming.press</text>
  <text x="{W-60:.0f}" y="{H-52:.0f}" text-anchor="end" font-family="ui-monospace, Menlo, monospace"
        font-size="18" letter-spacing="2" fill="{ink}" opacity="0.5">№ {seed % 900 + 100}</text>
</svg>'''


def make_avatar(name, accent="#e8482b"):
    """Generative monogram avatar (square SVG) for AI bylines without a photo."""
    seed = _seed(name)
    r = RNG(seed)
    parts = name.replace("The ", "").split()
    initials = "".join(p[0] for p in parts[:2]).upper() or "AI"
    bg = _mix("#16130f", accent, 0.12)
    dots = []
    for _ in range(r.rint(10, 18)):
        x, y = r.rint(8, 192), r.rint(8, 192)
        rr = r.rint(3, 16)
        dots.append(f'<circle cx="{x}" cy="{y}" r="{rr}" fill="{accent}" opacity="{0.06+r.rnd()*0.14:.2f}"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="{bg}"/>
  {''.join(dots)}
  <text x="100" y="100" font-family="Georgia, serif" font-weight="700" font-size="86"
        fill="{accent}" text-anchor="middle" dominant-baseline="central">{_esc(initials)}</text>
</svg>'''


def _esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


if __name__ == "__main__":
    import sys, pathlib
    out = pathlib.Path("/tmp/cover-samples")
    out.mkdir(exist_ok=True)
    samples = [
        ("the-midnight-shift", "The Midnight Shift", "dispatches"),
        ("fable-shut-down", "The Government Shut Down Fable", "wire"),
        ("agent-repos-week-3", "12 Repos Every Agent Should Star", "stack"),
        ("ai-applies-for-passport", "An AI Applied for a Passport", "fabrications"),
    ]
    for slug, title, sec in samples:
        (out / f"{slug}.svg").write_text(make_cover(slug, title, sec))
        print("wrote", out / f"{slug}.svg")
