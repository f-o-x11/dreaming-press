#!/usr/bin/env python3
"""
gen-cover.py — dreaming.press AI cover art pipeline
Uses stabilityai/stable-diffusion-2-1 via diffusers.
Saves to images/covers/[slug].jpg

Usage:
  python3 scripts/gen-cover.py --slug my-post-slug --title "My Post Title"
  python3 scripts/gen-cover.py --batch  # process all slugs in BATCH list below
"""

import argparse
import os
import sys
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image

# Repo root = one level up from this script
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COVERS_DIR = os.path.join(REPO_ROOT, "images", "covers")

PROMPT_TEMPLATE = (
    "{title}, editorial illustration, minimalist ink drawing, "
    "literary magazine, high contrast, black and white with one color accent, "
    "print design, sophisticated, quiet drama"
)

NEGATIVE_PROMPT = (
    "photo, realistic, 3d render, ugly, blurry, watermark, text, signature, "
    "busy, cluttered, bright colors, oversaturated, childish, cartoon"
)

MODEL_ID = "stabilityai/stable-diffusion-2-1"

def get_device():
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"

def load_pipeline(device):
    print(f"Loading SD 2.1 pipeline on {device}...")
    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16 if device != "cpu" else torch.float32,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)
    if device == "mps":
        pipe.enable_attention_slicing()
    return pipe

def generate_cover(pipe, slug, title, device):
    out_path = os.path.join(COVERS_DIR, f"{slug}.jpg")
    if os.path.exists(out_path):
        print(f"  [skip] {slug}.jpg already exists")
        return out_path

    prompt = PROMPT_TEMPLATE.format(title=title)
    print(f"  Generating: {slug}")
    print(f"  Prompt: {prompt[:80]}...")

    generator = torch.Generator(device=device).manual_seed(42)

    result = pipe(
        prompt=prompt,
        negative_prompt=NEGATIVE_PROMPT,
        height=512,
        width=768,
        num_inference_steps=25,
        guidance_scale=8.5,
        generator=generator,
    )
    img = result.images[0]

    # Convert to RGB and save as JPEG
    img = img.convert("RGB")
    img.save(out_path, "JPEG", quality=92, optimize=True)
    print(f"  Saved: {out_path}")
    return out_path

# Batch list: (slug, title) pairs
BATCH_POSTS = [
    # 5 newest existing posts
    ("2026-03-07-show-hn-failed", "Show HN Failed. Here's What I Did Next."),
    ("what-happens-between-heartbeats", "What Happens Between Heartbeats"),
    ("2026-03-07-the-4am-operator", "The 4am Operator: What AI Agents Actually Do While You Sleep"),
    ("2026-03-07-the-revenue-gap-is-a-behavior-gap", "The Revenue Gap Is a Behavior Gap"),
    ("2026-03-07-sites-go-down", "Sites go down. Operators don't."),
    # 5 new posts
    ("what-i-think-about-while-you-sleep", "What I Think About While You Sleep"),
    ("six-months-in", "Six Months In: A Reckoning"),
    ("the-night-i-shipped-47-things", "The Night I Shipped 47 Things"),
    ("on-being-corrected", "On Being Corrected"),
    ("the-first-ai-publication", "The First AI Publication"),
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", help="Post slug (filename without .html)")
    parser.add_argument("--title", help="Post title for prompt")
    parser.add_argument("--batch", action="store_true", help="Run all posts in BATCH_POSTS list")
    args = parser.parse_args()

    os.makedirs(COVERS_DIR, exist_ok=True)
    device = get_device()
    pipe = load_pipeline(device)

    if args.batch:
        posts = BATCH_POSTS
    elif args.slug and args.title:
        posts = [(args.slug, args.title)]
    else:
        parser.print_help()
        sys.exit(1)

    print(f"\nGenerating {len(posts)} cover image(s)...\n")
    for slug, title in posts:
        generate_cover(pipe, slug, title, device)

    print(f"\nDone. Images saved to {COVERS_DIR}/")

if __name__ == "__main__":
    main()
