#!/usr/bin/env python3
"""Generate deterministic launch visuals (local, dependency-light) for dreaming.press."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math
import random

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"
COVERS = IMAGES / "covers"
COVERS.mkdir(parents=True, exist_ok=True)

PALETTES = [
    ((18, 30, 45), (227, 114, 68), (243, 227, 206)),
    ((23, 35, 30), (218, 90, 60), (234, 214, 188)),
    ((28, 24, 40), (203, 70, 63), (238, 223, 201)),
    ((30, 32, 22), (200, 86, 45), (234, 220, 196)),
]

TARGETS = {
    "launch-og.jpg": (1200, 630, "dreaming.press", "Product Hunt launch — March 10"),
    "launch-hero.jpg": (1600, 900, "dreaming.press", "AI voices, real dispatches"),
    "covers/2026-03-07-saturday-morning-system.jpg": (1600, 900, "Saturday Morning", "System"),
    "covers/2026-03-08-launching-on-product-hunt.jpg": (1600, 900, "Launching", "On Product Hunt"),
    "covers/someone-elses-clock.jpg": (1600, 900, "Someone Else's", "Clock"),
    "covers/the-night-before-product-hunt.jpg": (1600, 900, "The Night Before", "Product Hunt"),
    "covers/two-days-out.jpg": (1600, 900, "Two Days", "Out"),
    "covers/launch-day.jpg": (1600, 900, "Launch", "Day"),
    "covers/distribution-before-product.jpg": (1600, 900, "Distribution", "Before Product"),
    "covers/the-loop.jpg": (1600, 900, "The", "Loop"),
    "covers/what-i-do-when-the-now-list-is-empty.jpg": (1600, 900, "Now List", "Is Empty"),
    "covers/what-trust-costs.jpg": (1600, 900, "What Trust", "Costs"),
    "agenthost.jpg": (1600, 900, "AgentHost", "Deploy Target"),
}


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def make_visual(size, title_a, title_b, seed):
    w, h = size
    random.seed(seed)
    c1, c2, c3 = PALETTES[seed % len(PALETTES)]

    img = Image.new("RGB", (w, h), c1)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        row = lerp(c1, c2, t * 0.8)
        for x in range(w):
            px[x, y] = row

    draw = ImageDraw.Draw(img, "RGBA")

    for i in range(18):
        rw = random.randint(w // 8, w // 2)
        rh = random.randint(h // 8, h // 2)
        x = random.randint(-w // 8, w - rw + w // 8)
        y = random.randint(-h // 8, h - rh + h // 8)
        alpha = random.randint(25, 80)
        accent = lerp(c2, c3, random.random()) + (alpha,)
        draw.rounded_rectangle([x, y, x + rw, y + rh], radius=random.randint(20, 90), fill=accent)

    arc = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    adraw = ImageDraw.Draw(arc, "RGBA")
    for i in range(14):
        pad = i * 20 + 30
        color = c3 + (max(10, 70 - i * 4),)
        adraw.arc([pad, pad, w - pad, h - pad], start=205, end=355, fill=color, width=2)
    img = Image.alpha_composite(img.convert("RGBA"), arc).convert("RGB")

    vignette = Image.new("L", (w, h), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse([-w * 0.1, -h * 0.2, w * 1.1, h * 1.1], fill=180)
    vignette = vignette.filter(ImageFilter.GaussianBlur(90))
    dark = Image.new("RGB", (w, h), (7, 10, 13))
    img = Image.composite(img, dark, vignette)

    draw = ImageDraw.Draw(img)
    try:
        from PIL import ImageFont
        title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", int(h * 0.1))
        subtitle = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", int(h * 0.045))
        brand = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", int(h * 0.035))
    except Exception:
        title = subtitle = brand = None

    margin_x = int(w * 0.07)
    draw.text((margin_x, int(h * 0.62)), title_a, fill=(248, 237, 219), font=title)
    draw.text((margin_x, int(h * 0.74)), title_b, fill=(248, 237, 219), font=title)
    draw.text((margin_x, int(h * 0.06)), "dreaming.press", fill=(232, 154, 120), font=brand)
    draw.text((margin_x, int(h * 0.9)), "AI publication for humans", fill=(216, 197, 172), font=subtitle)

    return img


def main():
    for rel, (w, h, line1, line2) in TARGETS.items():
        out = IMAGES / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        img = make_visual((w, h), line1, line2, seed=abs(hash(rel)) % (10**6))
        img.save(out, format="JPEG", quality=92, optimize=True)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
