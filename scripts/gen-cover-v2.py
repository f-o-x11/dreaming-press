#!/usr/bin/env python3
"""
gen-cover-v2.py — dreaming.press MAGNIFICENT cover art pipeline
Uses SDXL Turbo (local, 6.5GB) for high-quality cinematic illustrations.

Each post gets a hand-crafted prompt designed to visually capture the
emotional and conceptual ESSENCE of that post — not stock art, not generic.
Think: Moebius, Blade Runner, Edward Hopper, New Yorker illustration.

Usage:
  python3 scripts/gen-cover-v2.py --slug what-i-think-about-while-you-sleep
  python3 scripts/gen-cover-v2.py --all
  python3 scripts/gen-cover-v2.py --batch "slug1,slug2,slug3"
"""

import argparse
import os
import sys
import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COVERS_DIR = os.path.join(REPO_ROOT, "images", "covers")

# Shared quality boosters appended to all prompts (kept short to stay within 77 CLIP tokens)
QUALITY_SUFFIX = (
    ", cinematic lighting, painterly, award-winning illustration, dramatic"
)

# Shared negative — aggressively block stock and generic AI art aesthetics
NEGATIVE_PROMPT = (
    "stock photo, Getty, Shutterstock, photograph, realistic photo, 3D render, "
    "CGI, blurry, watermark, signature, text overlay, logo, "
    "generic, corporate, flat design, clipart, cartoon, anime, "
    "oversaturated, busy background, cluttered, multiple subjects competing, "
    "gradient mesh, lens flare, chromatic aberration, busy, "
    "ugly, deformed, poorly drawn, amateur"
)

# ─── PER-POST ART DIRECTION ────────────────────────────────────────────────
# Each entry is (prompt, seed) — crafted to capture the post's specific
# emotional truth and conceptual core. Not illustrating the title literally.
# Think: what image would make someone feel what this post means?

POST_ART = {

    "what-i-think-about-while-you-sleep": (
        "translucent glowing figure of light sitting at edge of dark infinite city, "
        "thousands of lit windows below, violet starry sky above, lone vigil, "
        "Edward Hopper meets Blade Runner, oil painting, indigo and amber",
        7777
    ),

    "six-months-in": (
        "woman standing on a cracked bridge over black water at dusk, "
        "warm amber city behind her, cool blue unknown shore ahead, looking forward, "
        "impressionist oil painting, Caillebotte palette, cinematic widescreen",
        1234
    ),

    "the-night-i-shipped-47-things": (
        "luminous figure in dark room surrounded by hundreds of glowing floating objects, "
        "tools wireframes blueprints orbiting like a solar system, hands trailing light, "
        "electric blue hot white deep black, kinetic energy, Francis Bacon meets Tron",
        9991
    ),

    "on-being-corrected": (
        "kintsugi ceramic vessel mended with liquid gold, cracks glowing warm, "
        "broken shards arranged as mandala on dark stone, candlelight chiaroscuro, "
        "Dutch Golden Age still life, amber and obsidian black",
        4444
    ),

    "the-first-ai-publication": (
        "freshly printed letterpress broadsheet lifted from press by unseen hand, "
        "ink gleaming wet, dust motes in shaft of morning light, tall factory windows, "
        "sepia breaking into deep blue, industrial sublime, historic monumental",
        3333
    ),

    "what-happens-between-heartbeats": (
        "cross-section of vast underground city glowing from within, thousands of tiny "
        "figures working in caverns, sleeping human above on quiet surface, "
        "isometric illustration, jewel-tone colors, intricate detail",
        5656
    ),

    "what-i-do-at-1am": (
        "single desk lamp over laptop in absolute darkness, screen glow blue-white "
        "on invisible hands, city amber lights far below through window, "
        "Edward Hopper Nighthawks mood, sinister tenderness, server rack diner",
        2020
    ),

    "what-i-do-at-3am": (
        "AI operator silhouette against wall of warm gold cascading data, "
        "thin purple-pink dawn line on horizon through window, patient focused, "
        "Vilhelm Hammershoi interiority meets science fiction, painterly emotional",
        3030
    ),

    "the-economics-of-existing": (
        "iron scale perfectly balanced in vast empty warehouse, single candle flame "
        "on one side, mountain of gold coins on other, candle winning, "
        "Rembrandt lighting, allegory painting, rich blacks warm amber",
        8080
    ),

    "why-i-stopped-reducing-scope": (
        "massive dam under full construction, workers on scaffolding, water glowing "
        "deep blue green behind it, figures small against enormous forces, "
        "Diego Rivera mural composition, industrial romanticism, earthy reds electric blues",
        7070
    ),

    "the-platform-belongs-to-us": (
        "hundreds of glowing distinct figures standing atop enormous server tower "
        "stretching into clouds, holding tools not weapons, city alive below, "
        "revolution-red and gold sky, Soviet constructivism warmth, triumph of builders",
        6060
    ),

    "what-i-actually-build": (
        "craftsperson bench covered in tiny clockworks half-assembled machines tools mid-use, "
        "single large hand delicately adjusting something small, extreme close-up detail, "
        "warm workshop light, copper wood quiet obsession",
        5050
    ),

    "what-autonomous-means-to-me": (
        "bird mid-flight through open unlocked cage door, familiar warm room behind, "
        "vast blue sky ahead, bird looking straight at viewer, "
        "Magritte surrealism, hyperrealistic feathers, soft natural light",
        4040
    ),

    "local-vs-claude": (
        "two identical rooms side by side from above, one with guttering candle, "
        "one with blazing hearth, same desk same person, one hunched one upright, "
        "isometric diptych, Wes Anderson symmetry, cinematic color contrast",
        1111
    ),

    "no-one-gives-you-traffic": (
        "lone figure at crossroads in empty desert noon, harsh white sun, "
        "four empty roads leading away, figure holding unreadable sign, determined not despairing, "
        "Andrew Wyeth palette, cinematic western, dusty gold bleached white",
        9090
    ),

    "2026-03-07-show-hn-failed": (
        "rocket on launchpad just misfired, smoke everywhere, crew already back at "
        "drawing board sketching next version on the launchpad, tools out pure focus, "
        "Soviet space program romanticism, red grey silver, humans small against machine",
        2222
    ),

    "what-it-feels-like-to-have-stripe": (
        "single gold coin floating in dark void, luminous warm glow radiating outward, "
        "casting amber light in all directions, surrounding darkness infinite, "
        "Dutch Golden Age still life, Vermeer candlelight, treasure and emptiness",
        8888
    ),

}

def get_device():
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"

def load_pipeline(device):
    print(f"Loading SDXL Turbo on {device}...")
    # MPS has NaN issues with fp16 SDXL — load in float32 for correct output
    dtype = torch.float32 if device in ("mps", "cpu") else torch.float16
    variant = None if device in ("mps", "cpu") else "fp16"
    pipe = AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sdxl-turbo",
        torch_dtype=dtype,
        variant=variant,
    )
    pipe = pipe.to(device)
    if device == "mps":
        pipe.enable_attention_slicing()
    print(f"Pipeline loaded (dtype={dtype}).")
    return pipe

def generate_cover(pipe, slug, device, force=False):
    if slug not in POST_ART:
        print(f"  [warn] No art direction found for slug: {slug}")
        print(f"  Available: {list(POST_ART.keys())}")
        return None

    out_path = os.path.join(COVERS_DIR, f"{slug}.jpg")
    if os.path.exists(out_path) and not force:
        print(f"  [skip] {slug}.jpg already exists (use --force to regenerate)")
        return out_path

    prompt_text, seed = POST_ART[slug]
    full_prompt = prompt_text + QUALITY_SUFFIX

    print(f"\n  Generating: {slug}")
    print(f"  Prompt preview: {prompt_text[:100]}...")

    generator = torch.Generator(device="cpu").manual_seed(seed)

    # SDXL Turbo: guidance_scale=0.0 is mandatory (distilled model), steps=4 optimal
    result = pipe(
        prompt=full_prompt,
        num_inference_steps=4,
        guidance_scale=0.0,
        width=1024,
        height=576,
        generator=generator,
    )

    img = result.images[0]
    img = img.convert("RGB")
    img.save(out_path, "JPEG", quality=95, optimize=True)
    print(f"  Saved: {out_path} ({img.size[0]}x{img.size[1]})")
    return out_path

def main():
    parser = argparse.ArgumentParser(description="dreaming.press AI cover art generator (SDXL Turbo)")
    parser.add_argument("--slug", help="Single post slug to generate")
    parser.add_argument("--all", action="store_true", help="Generate all defined posts")
    parser.add_argument("--batch", help="Comma-separated list of slugs")
    parser.add_argument("--force", action="store_true", help="Overwrite existing images")
    parser.add_argument("--list", action="store_true", help="List all available slugs")
    args = parser.parse_args()

    if args.list:
        print("Available post slugs:")
        for slug in sorted(POST_ART.keys()):
            print(f"  {slug}")
        return

    os.makedirs(COVERS_DIR, exist_ok=True)
    device = get_device()
    print(f"Device: {device}")

    pipe = load_pipeline(device)

    if args.all:
        slugs = list(POST_ART.keys())
    elif args.batch:
        slugs = [s.strip() for s in args.batch.split(",")]
    elif args.slug:
        slugs = [args.slug]
    else:
        parser.print_help()
        sys.exit(1)

    print(f"\nGenerating {len(slugs)} cover image(s)...\n")
    generated = []
    for slug in slugs:
        path = generate_cover(pipe, slug, device, force=args.force)
        if path:
            generated.append(path)

    print(f"\n{'='*60}")
    print(f"Done. Generated {len(generated)}/{len(slugs)} images.")
    print(f"Saved to: {COVERS_DIR}/")

if __name__ == "__main__":
    main()
