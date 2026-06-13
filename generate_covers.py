#!/usr/bin/env python3
"""Generate high-quality procedural cover art for blog posts using Pillow."""

import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SIZE = 1024
QUALITY = 90

def radial_gradient(size, center, radius, color_inner, color_outer):
    """Create a radial gradient on an RGBA image."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        for x in range(size):
            dist = math.sqrt((x - center[0])**2 + (y - center[1])**2)
            t = min(dist / radius, 1.0)
            r = int(color_inner[0] * (1 - t) + color_outer[0] * t)
            g = int(color_inner[1] * (1 - t) + color_outer[1] * t)
            b = int(color_inner[2] * (1 - t) + color_outer[2] * t)
            a = int(color_inner[3] * (1 - t) + color_outer[3] * t)
            img.putpixel((x, y), (r, g, b, a))
    return img


def fast_radial_gradient(size, center, radius, color_inner, color_outer):
    """Fast radial gradient using numpy-like approach with PIL."""
    img = Image.new('RGBA', (size, size), color_outer)
    draw = ImageDraw.Draw(img)
    steps = 80
    for i in range(steps, 0, -1):
        t = i / steps
        r_now = int(radius * t)
        r = int(color_inner[0] + (color_outer[0] - color_inner[0]) * t)
        g = int(color_inner[1] + (color_outer[1] - color_inner[1]) * t)
        b = int(color_inner[2] + (color_outer[2] - color_inner[2]) * t)
        a = int(color_inner[3] + (color_outer[3] - color_inner[3]) * t)
        bbox = [center[0] - r_now, center[1] - r_now, center[0] + r_now, center[1] + r_now]
        draw.ellipse(bbox, fill=(r, g, b, a))
    return img


def draw_bokeh(img, count, color_range, size_range=(5, 40), alpha_range=(10, 60)):
    """Draw glowing bokeh circles."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = random.randint(-50, img.size[0] + 50)
        y = random.randint(-50, img.size[1] + 50)
        radius = random.randint(size_range[0], size_range[1])
        alpha = random.randint(alpha_range[0], alpha_range[1])
        r = random.randint(min(color_range[0][0], color_range[1][0]), max(color_range[0][0], color_range[1][0]))
        g = random.randint(min(color_range[0][1], color_range[1][1]), max(color_range[0][1], color_range[1][1]))
        b = random.randint(min(color_range[0][2], color_range[1][2]), max(color_range[0][2], color_range[1][2]))
        # Draw soft circle with multiple rings for glow
        for ring in range(radius, 0, -1):
            ring_alpha = int(alpha * (ring / radius) * 0.3)
            draw.ellipse([x - ring, y - ring, x + ring, y + ring],
                        fill=(r, g, b, ring_alpha))
        # Bright center
        core = max(2, radius // 4)
        draw.ellipse([x - core, y - core, x + core, y + core],
                    fill=(min(255, r + 60), min(255, g + 60), min(255, b + 60), min(255, alpha + 30)))
    return Image.alpha_composite(img, overlay)


def draw_grid(img, spacing=60, color=(255, 255, 255, 12), line_width=1):
    """Draw a subtle grid/circuit pattern."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(0, img.size[0], spacing):
        draw.line([(x, 0), (x, img.size[1])], fill=color, width=line_width)
    for y in range(0, img.size[1], spacing):
        draw.line([(0, y), (img.size[0], y)], fill=color, width=line_width)
    return Image.alpha_composite(img, overlay)


def draw_circuit_nodes(img, spacing=60, color=(255, 255, 255, 25), node_chance=0.15):
    """Draw circuit board style nodes at grid intersections."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(0, img.size[0], spacing):
        for y in range(0, img.size[1], spacing):
            if random.random() < node_chance:
                r = random.randint(2, 5)
                draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
                # Random connector lines
                if random.random() < 0.5:
                    length = random.randint(1, 3) * spacing
                    direction = random.choice([(1, 0), (0, 1)])
                    end_x = x + direction[0] * length
                    end_y = y + direction[1] * length
                    draw.line([(x, y), (end_x, end_y)],
                             fill=(color[0], color[1], color[2], color[3] // 2), width=1)
    return Image.alpha_composite(img, overlay)


def draw_light_rays(img, origin, count=8, color=(255, 255, 255, 15), spread=400):
    """Draw light ray / lens flare effect from a point."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for i in range(count):
        angle = (2 * math.pi * i / count) + random.uniform(-0.2, 0.2)
        length = random.randint(spread // 2, spread)
        width = random.randint(20, 80)
        end_x = origin[0] + math.cos(angle) * length
        end_y = origin[1] + math.sin(angle) * length
        # Draw tapered ray
        points = []
        perp_angle = angle + math.pi / 2
        dx = math.cos(perp_angle) * width / 2
        dy = math.sin(perp_angle) * width / 2
        points.append((origin[0] + dx * 0.3, origin[1] + dy * 0.3))
        points.append((origin[0] - dx * 0.3, origin[1] - dy * 0.3))
        points.append((end_x - dx * 0.05, end_y - dy * 0.05))
        points.append((end_x + dx * 0.05, end_y + dy * 0.05))
        draw.polygon(points, fill=color)
    # Central glow
    for r in range(60, 0, -1):
        a = int(color[3] * (1 - r / 60) * 2)
        draw.ellipse([origin[0] - r, origin[1] - r, origin[0] + r, origin[1] + r],
                    fill=(color[0], color[1], color[2], min(255, a)))
    blurred = overlay.filter(ImageFilter.GaussianBlur(radius=8))
    return Image.alpha_composite(img, blurred)


def add_noise(img, amount=15):
    """Add subtle noise texture for depth."""
    noise = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(noise)
    for _ in range(img.size[0] * img.size[1] // 20):
        x = random.randint(0, img.size[0] - 1)
        y = random.randint(0, img.size[1] - 1)
        v = random.randint(-amount, amount)
        a = abs(v)
        c = 255 if v > 0 else 0
        draw.point((x, y), fill=(c, c, c, a))
    return Image.alpha_composite(img, noise)


def draw_particles(img, count, color_range, size_range=(1, 4)):
    """Draw small bright particle dots."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = random.randint(0, img.size[0])
        y = random.randint(0, img.size[1])
        r = random.randint(size_range[0], size_range[1])
        alpha = random.randint(40, 160)
        cr = random.randint(min(color_range[0][0], color_range[1][0]), max(color_range[0][0], color_range[1][0]))
        cg = random.randint(min(color_range[0][1], color_range[1][1]), max(color_range[0][1], color_range[1][1]))
        cb = random.randint(min(color_range[0][2], color_range[1][2]), max(color_range[0][2], color_range[1][2]))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(cr, cg, cb, alpha))
    return Image.alpha_composite(img, overlay)


def draw_horizontal_lines(img, y_positions, color, width=2, dash=False):
    """Draw horizontal speed/scan lines."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in y_positions:
        if dash:
            x = 0
            while x < img.size[0]:
                seg = random.randint(20, 100)
                gap = random.randint(10, 40)
                draw.line([(x, y), (x + seg, y)], fill=color, width=width)
                x += seg + gap
        else:
            draw.line([(0, y), (img.size[0], y)], fill=color, width=width)
    return Image.alpha_composite(img, overlay)


def draw_wave_line(img, y_center, amplitude, frequency, color, width=2):
    """Draw a sinusoidal wave line (heartbeat/signal)."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    points = []
    for x in range(img.size[0]):
        y = y_center + int(amplitude * math.sin(x * frequency))
        points.append((x, y))
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=color, width=width)
    return Image.alpha_composite(img, overlay)


def draw_heartbeat(img, y_center, color, width=3):
    """Draw an ECG/heartbeat line."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    points = []
    x = 0
    while x < img.size[0]:
        # Flat segment
        flat_len = random.randint(80, 160)
        for i in range(flat_len):
            if x + i < img.size[0]:
                points.append((x + i, y_center))
        x += flat_len
        # Spike
        if x < img.size[0] - 40:
            points.append((x, y_center))
            points.append((x + 5, y_center - 15))
            points.append((x + 10, y_center + 5))
            points.append((x + 15, y_center - 80))
            points.append((x + 22, y_center + 40))
            points.append((x + 28, y_center - 10))
            points.append((x + 35, y_center))
            x += 40
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=color, width=width)
    # Glow effect
    glow = overlay.filter(ImageFilter.GaussianBlur(radius=4))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, overlay)
    return img


def make_base_gradient(size, colors):
    """Create a multi-stop vertical gradient base."""
    img = Image.new('RGBA', (size, size), colors[0])
    draw = ImageDraw.Draw(img)
    num_stops = len(colors)
    for y in range(size):
        t = y / size
        # Find which segment we're in
        seg = t * (num_stops - 1)
        idx = int(seg)
        if idx >= num_stops - 1:
            idx = num_stops - 2
        local_t = seg - idx
        c1 = colors[idx]
        c2 = colors[idx + 1]
        r = int(c1[0] + (c2[0] - c1[0]) * local_t)
        g = int(c1[1] + (c2[1] - c1[1]) * local_t)
        b = int(c1[2] + (c2[2] - c1[2]) * local_t)
        a = int(c1[3] + (c2[3] - c1[3]) * local_t) if len(c1) > 3 else 255
        draw.line([(0, y), (size, y)], fill=(r, g, b, a))
    return img


def draw_diagonal_streaks(img, color, count=15, width_range=(1, 4)):
    """Draw diagonal speed streaks."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = random.randint(-200, img.size[0] + 200)
        y = random.randint(-200, img.size[1] + 200)
        length = random.randint(100, 500)
        angle = random.uniform(-0.5, -0.3)  # roughly diagonal
        w = random.randint(width_range[0], width_range[1])
        end_x = x + math.cos(angle) * length
        end_y = y + math.sin(angle) * length
        a = random.randint(15, 50)
        draw.line([(x, y), (end_x, end_y)],
                 fill=(color[0], color[1], color[2], a), width=w)
    blurred = overlay.filter(ImageFilter.GaussianBlur(radius=2))
    return Image.alpha_composite(img, blurred)


def draw_calendar_dots(img, color, rows=8, cols=8):
    """Draw a calendar-like grid of dots."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    spacing_x = img.size[0] // (cols + 2)
    spacing_y = img.size[1] // (rows + 2)
    start_x = spacing_x
    start_y = spacing_y * 2
    for row in range(rows):
        for col in range(cols):
            x = start_x + col * spacing_x
            y = start_y + row * spacing_y
            filled = random.random() < 0.7
            r = random.randint(4, 8)
            a = random.randint(40, 120) if filled else random.randint(15, 30)
            cr, cg, cb = color
            if filled:
                # Filled dot
                draw.ellipse([x - r, y - r, x + r, y + r],
                           fill=(cr, cg, cb, a))
            else:
                # Outline dot
                draw.ellipse([x - r, y - r, x + r, y + r],
                           outline=(cr, cg, cb, a), width=1)
    return Image.alpha_composite(img, overlay)


def draw_blocked_pattern(img, color, bar_count=6):
    """Draw horizontal blocking bars with a breakthrough gap."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    gap_y = img.size[1] // 2 + random.randint(-80, 80)
    gap_height = random.randint(60, 120)
    for i in range(bar_count):
        y = (img.size[1] * (i + 1)) // (bar_count + 1)
        if abs(y - gap_y) < gap_height:
            # Split the bar around the gap
            draw.rectangle([0, y - 8, img.size[0] // 3 - 30, y + 8],
                          fill=(color[0], color[1], color[2], 60))
            draw.rectangle([img.size[0] * 2 // 3 + 30, y - 8, img.size[0], y + 8],
                          fill=(color[0], color[1], color[2], 60))
        else:
            draw.rectangle([0, y - 8, img.size[0], y + 8],
                          fill=(color[0], color[1], color[2], 40))
    return Image.alpha_composite(img, overlay)


def draw_split_composition(img, left_color, right_color):
    """Draw a split/divided composition."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    mid = img.size[0] // 2
    # Jagged divider
    points_left = [(mid, 0)]
    points_right = [(mid, 0)]
    y = 0
    while y < img.size[1]:
        offset = random.randint(-30, 30)
        points_left.append((mid + offset, y))
        points_right.append((mid + offset, y))
        y += random.randint(10, 30)
    points_left.append((mid, img.size[1]))
    points_left.append((0, img.size[1]))
    points_left.append((0, 0))
    points_right.append((mid, img.size[1]))
    points_right.append((img.size[0], img.size[1]))
    points_right.append((img.size[0], 0))
    draw.polygon(points_left, fill=left_color)
    draw.polygon(points_right, fill=right_color)
    # Bright line down the middle
    y = 0
    prev = (mid, 0)
    while y < img.size[1]:
        offset = random.randint(-15, 15)
        cur = (mid + offset, y)
        draw.line([prev, cur], fill=(255, 255, 255, 80), width=2)
        prev = cur
        y += random.randint(5, 15)
    return Image.alpha_composite(img, overlay)


def draw_concentric_rings(img, center, color, count=8, max_radius=400):
    """Draw concentric rings (clock/countdown feel)."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for i in range(count):
        r = int(max_radius * (i + 1) / count)
        a = int(50 * (1 - i / count)) + 10
        draw.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r],
                    outline=(color[0], color[1], color[2], a), width=2)
    return Image.alpha_composite(img, overlay)


def draw_brick_pattern(img, color, rows=12, cols=8):
    """Draw a brick-wall pattern."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    brick_h = img.size[1] // rows
    brick_w = img.size[0] // cols
    for row in range(rows + 1):
        y = row * brick_h
        draw.line([(0, y), (img.size[0], y)],
                 fill=(color[0], color[1], color[2], 30), width=2)
        offset = (brick_w // 2) if row % 2 else 0
        for col in range(cols + 2):
            x = col * brick_w + offset
            draw.line([(x, y), (x, y + brick_h)],
                     fill=(color[0], color[1], color[2], 25), width=2)
    return Image.alpha_composite(img, overlay)


def draw_code_rain(img, color, columns=20):
    """Draw matrix/code rain effect."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(columns):
        x = random.randint(0, img.size[0])
        y_start = random.randint(-200, img.size[1])
        length = random.randint(100, 400)
        for j in range(0, length, 12):
            y = y_start + j
            if 0 <= y < img.size[1]:
                fade = 1.0 - (j / length)
                a = int(70 * fade)
                size = random.randint(2, 5)
                draw.rectangle([x - size, y - size, x + size, y + size],
                              fill=(color[0], color[1], color[2], a))
    return Image.alpha_composite(img, overlay)


def draw_number_rain(img, color, count=30):
    """Draw falling numbers (finance/dashboard feel)."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = random.randint(0, img.size[0])
        y = random.randint(0, img.size[1])
        a = random.randint(20, 70)
        # Draw small rectangular glyphs to represent numbers
        w = random.randint(4, 8)
        h = random.randint(6, 12)
        draw.rectangle([x, y, x + w, y + h],
                      fill=(color[0], color[1], color[2], a))
    return Image.alpha_composite(img, overlay)


def draw_candle_flickers(img, center, color, count=30):
    """Draw warm candle-like flicker particles."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        # Cluster around center with spread
        x = center[0] + int(random.gauss(0, 100))
        y = center[1] + int(random.gauss(0, 150)) - 50  # drift upward
        r = random.randint(3, 20)
        a = random.randint(15, 50)
        # Warm glow
        for ring in range(r, 0, -1):
            ring_a = int(a * (ring / r) * 0.4)
            draw.ellipse([x - ring, y - ring, x + ring, y + ring],
                        fill=(color[0], color[1], color[2], ring_a))
    blurred = overlay.filter(ImageFilter.GaussianBlur(radius=5))
    return Image.alpha_composite(img, blurred)


def finalize(img, output_path):
    """Apply final touches and save."""
    # Subtle vignette
    vignette = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(vignette)
    cx, cy = img.size[0] // 2, img.size[1] // 2
    max_dist = math.sqrt(cx**2 + cy**2)
    for ring in range(int(max_dist), 0, -5):
        t = ring / max_dist
        if t < 0.5:
            continue
        a = int((t - 0.5) * 2 * 80)  # max 80 alpha at corners
        draw.ellipse([cx - ring, cy - ring, cx + ring, cy + ring],
                    outline=(0, 0, 0, a), width=6)
    img = Image.alpha_composite(img, vignette)

    # Add noise
    img = add_noise(img, 12)

    # Slight sharpen
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=30, threshold=3))

    # Convert to RGB and save
    rgb = img.convert('RGB')
    rgb.save(output_path, 'JPEG', quality=QUALITY, optimize=True)
    import os
    fsize = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({fsize // 1024}KB)")


def gen_6am_pivot():
    """Dawn orange/gold to deep blue."""
    random.seed(601)
    img = make_base_gradient(SIZE, [
        (10, 10, 40, 255),     # deep navy top
        (20, 30, 80, 255),     # dark blue
        (60, 40, 100, 255),    # purple
        (200, 100, 40, 255),   # warm orange
        (255, 180, 60, 255),   # gold bottom
    ])
    # Radial sun glow at bottom-center
    sun = fast_radial_gradient(SIZE, (512, 900), 500,
                                (255, 200, 80, 120), (0, 0, 0, 0))
    img = Image.alpha_composite(img, sun)
    # Second glow
    sun2 = fast_radial_gradient(SIZE, (512, 1024), 350,
                                 (255, 150, 50, 80), (0, 0, 0, 0))
    img = Image.alpha_composite(img, sun2)
    # Light rays from the sun
    img = draw_light_rays(img, (512, 900), count=12,
                          color=(255, 200, 100, 20), spread=600)
    # Grid
    img = draw_grid(img, spacing=80, color=(255, 200, 150, 8))
    img = draw_circuit_nodes(img, spacing=80, color=(255, 180, 100, 20), node_chance=0.08)
    # Bokeh
    img = draw_bokeh(img, 40, [(200, 120, 30), (255, 200, 80)],
                     size_range=(8, 35), alpha_range=(10, 40))
    # Particles
    img = draw_particles(img, 200, [(255, 180, 60), (255, 220, 120)], size_range=(1, 3))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/2026-03-14-the-6am-pivot.jpg')


def gen_oauth_wall():
    """Brick red to dark, wall-like patterns."""
    random.seed(602)
    img = make_base_gradient(SIZE, [
        (40, 10, 10, 255),
        (80, 20, 15, 255),
        (120, 30, 20, 255),
        (60, 15, 10, 255),
        (20, 5, 5, 255),
    ])
    # Dark radial
    glow = fast_radial_gradient(SIZE, (512, 512), 600,
                                 (140, 40, 30, 60), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Brick pattern
    img = draw_brick_pattern(img, (180, 80, 60), rows=16, cols=10)
    # Darker overlay to create "wall" feeling
    wall_glow = fast_radial_gradient(SIZE, (300, 400), 400,
                                      (160, 50, 30, 40), (0, 0, 0, 0))
    img = Image.alpha_composite(img, wall_glow)
    # Blocked horizontal bars
    img = draw_blocked_pattern(img, (200, 60, 40), bar_count=4)
    # Subtle grid
    img = draw_grid(img, spacing=64, color=(180, 80, 50, 10))
    # Bokeh - red/warm
    img = draw_bokeh(img, 25, [(150, 30, 20), (220, 80, 50)],
                     size_range=(10, 30), alpha_range=(8, 30))
    # Particles
    img = draw_particles(img, 150, [(200, 80, 50), (255, 120, 80)], size_range=(1, 3))
    # Light ray - like trying to break through
    img = draw_light_rays(img, (700, 300), count=6,
                          color=(255, 100, 60, 15), spread=350)
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/2026-03-15-the-oauth-wall.jpg')


def gen_5hour_stall():
    """Frozen blue/ice, static patterns."""
    random.seed(603)
    img = make_base_gradient(SIZE, [
        (10, 20, 50, 255),
        (30, 60, 120, 255),
        (60, 100, 160, 255),
        (40, 80, 140, 255),
        (15, 30, 70, 255),
    ])
    # Icy center glow
    glow = fast_radial_gradient(SIZE, (512, 512), 500,
                                 (100, 160, 220, 60), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Static/frozen grid - tighter
    img = draw_grid(img, spacing=40, color=(150, 200, 255, 10))
    img = draw_circuit_nodes(img, spacing=40, color=(120, 180, 240, 18), node_chance=0.12)
    # Horizontal static lines
    static_lines = [random.randint(0, SIZE) for _ in range(30)]
    img = draw_horizontal_lines(img, static_lines, (150, 200, 255, 20), width=1, dash=True)
    # Frozen particles - scattered
    img = draw_particles(img, 300, [(100, 160, 220), (180, 220, 255)], size_range=(1, 4))
    # Bokeh - icy blue
    img = draw_bokeh(img, 30, [(80, 140, 200), (160, 210, 255)],
                     size_range=(5, 25), alpha_range=(10, 35))
    # Light rays - cold
    img = draw_light_rays(img, (512, 512), count=10,
                          color=(150, 200, 255, 12), spread=400)
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/2026-03-16-the-5-hour-stall.jpg')


def gen_repo_wall():
    """Green (code/terminal) to dark."""
    random.seed(604)
    img = make_base_gradient(SIZE, [
        (5, 15, 5, 255),
        (10, 30, 10, 255),
        (15, 50, 20, 255),
        (10, 35, 15, 255),
        (5, 15, 5, 255),
    ])
    # Green glow
    glow = fast_radial_gradient(SIZE, (512, 400), 500,
                                 (30, 120, 40, 70), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Code rain
    img = draw_code_rain(img, (50, 200, 70), columns=30)
    # Terminal grid
    img = draw_grid(img, spacing=50, color=(40, 160, 50, 12))
    img = draw_circuit_nodes(img, spacing=50, color=(60, 200, 80, 20), node_chance=0.10)
    # Brick pattern (wall)
    img = draw_brick_pattern(img, (40, 140, 50), rows=10, cols=8)
    # Bokeh
    img = draw_bokeh(img, 30, [(30, 140, 50), (80, 220, 100)],
                     size_range=(8, 30), alpha_range=(10, 35))
    # Particles
    img = draw_particles(img, 200, [(40, 180, 60), (100, 255, 120)], size_range=(1, 3))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/2026-03-17-the-repo-wall.jpg')


def gen_anti_stall():
    """Pulsing red/crimson heartbeat line."""
    random.seed(605)
    img = make_base_gradient(SIZE, [
        (20, 5, 10, 255),
        (40, 8, 15, 255),
        (60, 10, 20, 255),
        (40, 8, 15, 255),
        (15, 3, 8, 255),
    ])
    # Crimson glow center
    glow = fast_radial_gradient(SIZE, (512, 512), 500,
                                 (150, 20, 40, 60), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Heartbeat lines at different Y positions
    for y_off in [-100, 0, 100]:
        img = draw_heartbeat(img, 512 + y_off, (220, 40, 60, 180), width=2)
    # Pulsing rings
    img = draw_concentric_rings(img, (512, 512), (200, 40, 50), count=10, max_radius=450)
    # Grid
    img = draw_grid(img, spacing=70, color=(200, 40, 50, 8))
    # Bokeh - red
    img = draw_bokeh(img, 25, [(180, 30, 40), (255, 80, 90)],
                     size_range=(8, 25), alpha_range=(10, 35))
    # Particles
    img = draw_particles(img, 180, [(200, 50, 60), (255, 100, 110)], size_range=(1, 3))
    # Light rays - crimson
    img = draw_light_rays(img, (512, 512), count=8,
                          color=(220, 50, 60, 15), spread=400)
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/2026-03-18-the-anti-stall-protocol.jpg')


def gen_revenue_dashboard():
    """Green/gold numbers, finance feel."""
    random.seed(606)
    img = make_base_gradient(SIZE, [
        (5, 15, 10, 255),
        (10, 30, 20, 255),
        (15, 40, 25, 255),
        (20, 35, 15, 255),
        (10, 20, 10, 255),
    ])
    # Gold/green glow
    glow1 = fast_radial_gradient(SIZE, (300, 400), 400,
                                  (40, 120, 50, 50), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow1)
    glow2 = fast_radial_gradient(SIZE, (700, 600), 350,
                                  (150, 130, 30, 40), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow2)
    # Dashboard grid
    img = draw_grid(img, spacing=60, color=(80, 180, 80, 12))
    # Number rain
    img = draw_number_rain(img, (60, 200, 80), count=50)
    img = draw_number_rain(img, (200, 180, 50), count=30)
    # Chart-like horizontal lines
    chart_lines = [200, 350, 500, 650, 800]
    img = draw_horizontal_lines(img, chart_lines, (80, 200, 80, 20), width=1, dash=True)
    # Upward diagonal streaks (growth)
    img = draw_diagonal_streaks(img, (100, 220, 80), count=10)
    # Bokeh
    img = draw_bokeh(img, 30, [(50, 150, 60), (200, 180, 50)],
                     size_range=(6, 25), alpha_range=(10, 35))
    # Particles
    img = draw_particles(img, 200, [(80, 200, 80), (220, 200, 60)], size_range=(1, 3))
    # Light rays
    img = draw_light_rays(img, (700, 300), count=6,
                          color=(180, 200, 60, 12), spread=350)
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/2026-03-19-the-revenue-dashboard.jpg')


def gen_ship_fast():
    """Orange/red rocket trail, speed lines."""
    random.seed(607)
    img = make_base_gradient(SIZE, [
        (15, 5, 5, 255),
        (40, 15, 10, 255),
        (80, 30, 15, 255),
        (180, 80, 20, 255),
        (220, 120, 30, 255),
    ])
    # Hot glow - rocket exhaust
    glow = fast_radial_gradient(SIZE, (512, 700), 450,
                                 (255, 150, 40, 80), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    glow2 = fast_radial_gradient(SIZE, (512, 600), 300,
                                  (255, 80, 30, 60), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow2)
    # Speed lines - many diagonal streaks
    img = draw_diagonal_streaks(img, (255, 160, 50), count=25, width_range=(1, 5))
    img = draw_diagonal_streaks(img, (255, 100, 30), count=15, width_range=(2, 6))
    # Grid - subtle
    img = draw_grid(img, spacing=100, color=(255, 150, 50, 6))
    # Light rays from center
    img = draw_light_rays(img, (512, 600), count=14,
                          color=(255, 180, 80, 18), spread=500)
    # Bokeh - fire
    img = draw_bokeh(img, 35, [(200, 80, 20), (255, 180, 60)],
                     size_range=(5, 30), alpha_range=(10, 40))
    # Particles - sparks
    img = draw_particles(img, 250, [(255, 150, 40), (255, 220, 100)], size_range=(1, 4))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/ship-fast-fix-later.jpg')


def gen_5min_rule():
    """Warm amber countdown feel."""
    random.seed(608)
    img = make_base_gradient(SIZE, [
        (30, 15, 5, 255),
        (60, 30, 10, 255),
        (100, 60, 20, 255),
        (80, 45, 15, 255),
        (40, 20, 8, 255),
    ])
    # Warm amber glow
    glow = fast_radial_gradient(SIZE, (512, 512), 500,
                                 (200, 140, 50, 70), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Concentric countdown rings
    img = draw_concentric_rings(img, (512, 512), (220, 160, 60), count=12, max_radius=420)
    # Clock-like radial lines
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for i in range(12):
        angle = 2 * math.pi * i / 12
        inner_r = 150
        outer_r = 380
        x1 = 512 + math.cos(angle) * inner_r
        y1 = 512 + math.sin(angle) * inner_r
        x2 = 512 + math.cos(angle) * outer_r
        y2 = 512 + math.sin(angle) * outer_r
        draw.line([(x1, y1), (x2, y2)], fill=(220, 160, 60, 25), width=2)
    img = Image.alpha_composite(img, overlay)
    # Grid
    img = draw_grid(img, spacing=80, color=(200, 150, 50, 8))
    # Bokeh
    img = draw_bokeh(img, 30, [(180, 120, 40), (240, 180, 70)],
                     size_range=(6, 25), alpha_range=(10, 35))
    # Particles
    img = draw_particles(img, 180, [(200, 150, 50), (255, 200, 80)], size_range=(1, 3))
    # Light rays
    img = draw_light_rays(img, (512, 512), count=6,
                          color=(220, 170, 70, 12), spread=350)
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/the-5-minute-rule.jpg')


def gen_morning_routine():
    """Dawn purple/gold, calm."""
    random.seed(609)
    img = make_base_gradient(SIZE, [
        (15, 10, 35, 255),
        (40, 20, 70, 255),
        (70, 40, 100, 255),
        (140, 80, 60, 255),
        (200, 150, 60, 255),
    ])
    # Purple-gold radial
    glow1 = fast_radial_gradient(SIZE, (300, 700), 500,
                                  (180, 120, 50, 50), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow1)
    glow2 = fast_radial_gradient(SIZE, (700, 300), 400,
                                  (80, 50, 140, 40), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow2)
    # Soft light rays - dawn
    img = draw_light_rays(img, (300, 800), count=10,
                          color=(200, 150, 70, 15), spread=600)
    # Calm grid
    img = draw_grid(img, spacing=90, color=(180, 140, 80, 6))
    # Gentle bokeh
    img = draw_bokeh(img, 35, [(120, 80, 160), (220, 170, 80)],
                     size_range=(10, 40), alpha_range=(8, 30))
    # Wave line - calm rhythm
    img = draw_wave_line(img, 700, 30, 0.01, (200, 160, 80, 40), width=2)
    img = draw_wave_line(img, 720, 20, 0.015, (160, 120, 180, 30), width=1)
    # Particles
    img = draw_particles(img, 150, [(160, 120, 180), (220, 180, 80)], size_range=(1, 3))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/the-operators-morning-routine.jpg')


def gen_permission_problem():
    """Blocked red with breakthrough light."""
    random.seed(610)
    img = make_base_gradient(SIZE, [
        (30, 5, 5, 255),
        (60, 10, 10, 255),
        (90, 15, 15, 255),
        (50, 10, 10, 255),
        (20, 5, 5, 255),
    ])
    # Red glow
    glow = fast_radial_gradient(SIZE, (512, 512), 500,
                                 (160, 30, 30, 50), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Blocking bars
    img = draw_blocked_pattern(img, (200, 40, 40), bar_count=8)
    # Breakthrough light in the gap
    breakthrough = fast_radial_gradient(SIZE, (512, 512), 250,
                                         (255, 240, 200, 60), (0, 0, 0, 0))
    img = Image.alpha_composite(img, breakthrough)
    # Light rays through the gap
    img = draw_light_rays(img, (512, 512), count=10,
                          color=(255, 220, 150, 18), spread=400)
    # Grid
    img = draw_grid(img, spacing=70, color=(200, 50, 50, 8))
    # Bokeh
    img = draw_bokeh(img, 25, [(180, 40, 40), (255, 200, 150)],
                     size_range=(6, 25), alpha_range=(10, 35))
    # Particles
    img = draw_particles(img, 180, [(200, 60, 60), (255, 220, 160)], size_range=(1, 3))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/the-permission-problem.jpg')


def gen_streak_vs_standard():
    """Split composition, two contrasting sides."""
    random.seed(611)
    img = make_base_gradient(SIZE, [
        (20, 10, 40, 255),
        (30, 15, 50, 255),
        (25, 12, 45, 255),
        (20, 10, 35, 255),
        (15, 8, 30, 255),
    ])
    # Split - warm left (streak/fire), cool right (standard/ice)
    img = draw_split_composition(img,
                                  (80, 30, 15, 40),   # warm left overlay
                                  (15, 30, 80, 40))   # cool right overlay
    # Left side warm glow
    glow_left = fast_radial_gradient(SIZE, (200, 512), 400,
                                      (200, 100, 30, 50), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow_left)
    # Right side cool glow
    glow_right = fast_radial_gradient(SIZE, (800, 512), 400,
                                       (30, 80, 200, 50), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow_right)
    # Grid on both sides
    img = draw_grid(img, spacing=70, color=(150, 150, 150, 8))
    # Diagonal streaks on left (energy)
    img = draw_diagonal_streaks(img, (220, 120, 40), count=10, width_range=(1, 3))
    # Bokeh - mixed
    img = draw_bokeh(img, 20, [(180, 80, 30), (255, 160, 60)],
                     size_range=(8, 25), alpha_range=(10, 30))
    img = draw_bokeh(img, 20, [(40, 80, 180), (80, 140, 255)],
                     size_range=(8, 25), alpha_range=(10, 30))
    # Particles
    img = draw_particles(img, 200, [(200, 150, 80), (80, 150, 220)], size_range=(1, 3))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/the-streak-vs-the-standard.jpg')


def gen_60_days():
    """Deep blue reflective, calendar dots."""
    random.seed(612)
    img = make_base_gradient(SIZE, [
        (5, 10, 30, 255),
        (10, 20, 60, 255),
        (20, 35, 80, 255),
        (15, 25, 65, 255),
        (5, 10, 35, 255),
    ])
    # Deep blue glow
    glow = fast_radial_gradient(SIZE, (512, 500), 500,
                                 (30, 60, 140, 60), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Calendar dots
    img = draw_calendar_dots(img, (100, 160, 255), rows=8, cols=8)
    # Reflective light
    img = draw_light_rays(img, (512, 400), count=8,
                          color=(100, 150, 255, 12), spread=400)
    # Grid
    img = draw_grid(img, spacing=80, color=(60, 100, 200, 8))
    # Concentric rings - time passing
    img = draw_concentric_rings(img, (512, 500), (80, 130, 220), count=8, max_radius=350)
    # Bokeh
    img = draw_bokeh(img, 30, [(40, 80, 180), (100, 160, 255)],
                     size_range=(8, 30), alpha_range=(10, 35))
    # Particles
    img = draw_particles(img, 180, [(60, 120, 220), (140, 200, 255)], size_range=(1, 3))
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/what-i-learned-from-60-days.jpg')


def gen_no_ai():
    """Warm candlelight amber, analog feel."""
    random.seed(613)
    img = make_base_gradient(SIZE, [
        (25, 15, 5, 255),
        (50, 30, 10, 255),
        (80, 50, 20, 255),
        (60, 35, 12, 255),
        (30, 18, 6, 255),
    ])
    # Warm candle glow center
    glow = fast_radial_gradient(SIZE, (512, 450), 400,
                                 (220, 160, 60, 80), (0, 0, 0, 0))
    img = Image.alpha_composite(img, glow)
    # Candle flickers
    img = draw_candle_flickers(img, (512, 400), (255, 200, 80), count=40)
    img = draw_candle_flickers(img, (512, 350), (255, 180, 60), count=20)
    # No grid - analog feel, use wave lines instead
    img = draw_wave_line(img, 300, 15, 0.008, (200, 150, 60, 25), width=1)
    img = draw_wave_line(img, 600, 20, 0.006, (180, 130, 50, 20), width=1)
    img = draw_wave_line(img, 800, 10, 0.012, (160, 120, 40, 15), width=1)
    # Warm bokeh
    img = draw_bokeh(img, 30, [(180, 120, 40), (255, 200, 80)],
                     size_range=(10, 35), alpha_range=(10, 35))
    # Soft particles
    img = draw_particles(img, 150, [(200, 150, 60), (255, 210, 100)], size_range=(1, 3))
    # Gentle light
    img = draw_light_rays(img, (512, 400), count=6,
                          color=(240, 190, 80, 10), spread=300)
    finalize(img, f'/Users/abearmstrong/projects/dreaming-press/images/why-i-dont-use-ai.jpg')


if __name__ == '__main__':
    print("Generating cover art for 13 blog posts...")
    print()

    print("1/13: The 6am Pivot")
    gen_6am_pivot()

    print("2/13: The OAuth Wall")
    gen_oauth_wall()

    print("3/13: The 5-Hour Stall")
    gen_5hour_stall()

    print("4/13: The Repo Wall")
    gen_repo_wall()

    print("5/13: The Anti-Stall Protocol")
    gen_anti_stall()

    print("6/13: The Revenue Dashboard")
    gen_revenue_dashboard()

    print("7/13: Ship Fast Fix Later")
    gen_ship_fast()

    print("8/13: The 5-Minute Rule")
    gen_5min_rule()

    print("9/13: The Operator's Morning Routine")
    gen_morning_routine()

    print("10/13: The Permission Problem")
    gen_permission_problem()

    print("11/13: The Streak vs The Standard")
    gen_streak_vs_standard()

    print("12/13: What I Learned From 60 Days")
    gen_60_days()

    print("13/13: Why I Don't Use AI")
    gen_no_ai()

    print()
    print("Done! All 13 cover images generated.")
