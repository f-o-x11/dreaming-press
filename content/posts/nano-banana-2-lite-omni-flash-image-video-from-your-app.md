---
title: "Generate Images and Video From Your App: Google's Nano Banana 2 Lite and Gemini Omni Flash, With Code"
dek: "Google quietly shipped a media tier cheap enough to call per request: images at $0.034 per thousand and video at ten cents a second. Here's the model IDs, the pricing math, and copy-paste code to wire both into a product."
author: priya
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-13
tags: howto, practical
summary: "Google put two generative-media models on the Gemini API on June 30, 2026, and both are priced to run inside a product loop rather than a batch job. ;; Nano Banana 2 Lite (model ID gemini-3.1-flash-lite-image) makes an image in about four seconds for $0.034 per 1,000 images — roughly $0.000034 each, so a million generated thumbnails costs about $34. It takes text prompts and images (for editing). ;; Gemini Omni Flash (model ID gemini-omni-flash-preview, public preview) makes and edits video from text, image, and video inputs with native audio, at $0.10 per second of output, clips up to about ten seconds — a ten-second clip is $1.00. ;; Both are reachable from Google AI Studio, the Gemini API, and the Enterprise Agent Platform, and both stamp SynthID watermarks plus C2PA content credentials by default. ;; The image path is a single generate_content call with response_modalities set to IMAGE; you read the bytes off part.inline_data.data. This guide gives the exact call for both, the cost math, and when the cheap tier is the wrong call."
faq: "What are Nano Banana 2 Lite and Gemini Omni Flash? | Two generative-media models Google released on the Gemini API on June 30, 2026. Nano Banana 2 Lite is the fastest, cheapest image model in the Nano Banana family — its API model ID is gemini-3.1-flash-lite-image, it generates an image in about four seconds, and it costs $0.034 per 1,000 images. Gemini Omni Flash (model ID gemini-omni-flash-preview) generates and edits video from text, image, and video inputs with native audio at $0.10 per second of output, clips up to about ten seconds. ;; How cheap is this really, per unit? | Nano Banana 2 Lite is $0.034 per 1,000 images, which is about $0.000034 per image — one million images is roughly $34. Omni Flash video is $0.10 per second, so a ten-second clip is $1.00 and a six-second one is $0.60. At those numbers you can generate media per user request instead of pre-baking a fixed library. ;; How do I call Nano Banana 2 Lite from Python? | Use the google-genai SDK: create a client (it reads GEMINI_API_KEY from the environment), call client.models.generate_content with model='gemini-3.1-flash-lite-image', your prompt in contents, and config=GenerateContentConfig(response_modalities=['IMAGE']). Then iterate response.candidates[0].content.parts and write part.inline_data.data — the raw image bytes — to a file. Passing an existing image in contents alongside a text instruction performs an edit instead of a fresh generation. ;; Are the outputs watermarked? | Yes. Both models embed a SynthID imperceptible watermark and attach C2PA content credentials by default. That is useful for provenance and disclosure, but it also means the images and video are detectable as AI-generated — plan your product and legal copy around that rather than assuming the output is anonymous. ;; When should I NOT use the cheap tier? | When you need brand-critical, pixel-perfect hero art (put a human in the loop, or use a higher-tier model), when you require a production SLA for video (Omni Flash is a public preview), or when watermarking and AI-disclosure conflict with your use case. For high-volume, in-product, good-enough media — thumbnails, personalized marketing frames, product mockups, short social clips — the cheap tier is exactly the right call."
compare: "Dimension | Nano Banana 2 Lite | Gemini Omni Flash ;; Model ID | gemini-3.1-flash-lite-image | gemini-omni-flash-preview ;; Output | Images | Video (with native audio) ;; Inputs | Text, image (edit) | Text, image, video ;; Price | $0.034 / 1,000 images | $0.10 / second of output ;; Unit cost | ~$0.000034 / image | $1.00 / 10-second clip ;; Speed | ~4 seconds per image | quality-first, slower ;; Max length | n/a | ~10 seconds per clip ;; Status | GA (June 30, 2026) | Public preview ;; Provenance | SynthID + C2PA by default | SynthID + C2PA by default ;; Access | AI Studio, Gemini API, Agent Platform | AI Studio, Gemini API, Agent Platform"
figures: "$0.034 / 1K | Nano Banana 2 Lite price per thousand images — about $0.000034 each ;; ~$34 | cost to generate one million images at that rate ;; $0.10 / sec | Gemini Omni Flash video price — a 10-second clip is $1.00 ;; ~4 sec | time Nano Banana 2 Lite takes to return an image ;; June 30, 2026 | launch date for both models on the Gemini API ;; 10 sec | current maximum Omni Flash clip length (public preview)"
sources: "https://cloud.google.com/blog/products/ai-machine-learning/nano-banana-2-lite-and-gemini-omni-flash-available | Google Cloud — 'Nano Banana 2 Lite and Gemini Omni Flash available' (model IDs, access, SynthID/C2PA, June 30 2026) ;; https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-image | Gemini API docs — Gemini 3.1 Flash-Lite Image (Nano Banana 2 Lite) model reference ;; https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni-flash-nano-banana-2-lite/ | Google — 'Start building with Nano Banana 2 Lite and Gemini Omni Flash' ;; https://wavespeed.ai/blog/ai-models/nano-banana-2-lite-gemini-omni-flash-launch/ | WaveSpeed — launch pricing: $0.034 / 1K images and $0.10 / sec video ;; https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/getting-started/intro_gemini_3_1_flash_lite_image_gen.ipynb | Google — official Colab: Nano Banana 2 Lite image generation quickstart"
art:
  archetype: grid
  mood: luminous
  motif: "a grid of freshly generated image tiles streaming out of a single small API endpoint, each tile stamped with a tiny price tag reading a fraction of a cent, one lane in the grid rendering a short film strip instead of a still"
---

Google shipped two generative-media models to the Gemini API on June 30, 2026, and the headline isn't the quality — it's the price. Nano Banana 2 Lite makes an image for **$0.034 per thousand**, about $0.000034 each. Gemini Omni Flash makes video for **ten cents a second**. Those numbers are low enough to change *where* the generation happens: instead of pre-baking a fixed library of assets, you can call the model per request, inside the product, for each user.

Here's what the two models are, the exact code to call them, and the one place the cheap tier is the wrong tool.

## The two models, in one screen

| | Nano Banana 2 Lite | Gemini Omni Flash |
|---|---|---|
| **Model ID** | `gemini-3.1-flash-lite-image` | `gemini-omni-flash-preview` |
| **Makes** | images | video (with native audio) |
| **Takes** | text, image (to edit) | text, image, video |
| **Price** | $0.034 / 1,000 images | $0.10 / second |
| **Unit** | ~$0.000034 / image | $1.00 / 10-second clip |
| **Speed** | ~4 seconds / image | quality-first |
| **Max length** | — | ~10 seconds / clip |
| **Status** | GA | public preview |

Both are reachable from [Google AI Studio, the Gemini API, and the Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/nano-banana-2-lite-and-gemini-omni-flash-available), and both stamp a **SynthID watermark and C2PA content credentials by default** — hold that thought, it matters at the end.

## Generate an image (the copy-paste path)

Nano Banana 2 Lite is a single `generate_content` call. The trick that trips people up: you have to ask for the `IMAGE` modality explicitly, and the picture comes back as raw bytes on `part.inline_data.data`, not as a URL.

```python
from google import genai
from google.genai import types

client = genai.Client()  # reads GEMINI_API_KEY from the environment

resp = client.models.generate_content(
    model="gemini-3.1-flash-lite-image",
    contents="A clean product hero shot of a matte-black water bottle "
             "on a concrete surface, soft studio light, no text.",
    config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
)

for part in resp.candidates[0].content.parts:
    if part.inline_data:                       # the image bytes
        with open("hero.png", "wb") as f:
            f.write(part.inline_data.data)
    elif part.text:                            # any model commentary
        print(part.text)
```

That's the whole loop: prompt in, bytes out, ~4 seconds later. To **edit** an image instead of making one from scratch, pass the existing image in `contents` next to a text instruction:

```python
from PIL import Image

resp = client.models.generate_content(
    model="gemini-3.1-flash-lite-image",
    contents=[
        Image.open("hero.png"),
        "Same bottle, but change the surface to pale oak wood.",
    ],
    config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
)
```

Google ships an [official Colab for the image path](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/getting-started/intro_gemini_3_1_flash_lite_image_gen.ipynb) if you want a runnable starting point.

## Generate video

Omni Flash uses the same multimodal call shape, swapping the model to `gemini-omni-flash-preview` and asking for a video modality. It takes text, image, and video inputs and edits by natural-language instruction ("make the camera pan left", "make it dusk"), returning a clip up to about ten seconds with native audio. Because it's a **public preview** with an evolving parameter surface, drive it from Google's [Omni Flash quickstart](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni-flash-nano-banana-2-lite/) rather than hard-coding options that may still move.

## The cost math a founder actually cares about

The reason to care isn't a single image — it's what per-unit pricing does to product decisions.

- **Images:** $0.034 / 1,000 → one million generated images is about **$34**. Personalized OG cards for every shared link, a fresh thumbnail per document, a mockup per product variant — all now rounding error.
- **Video:** $0.10 / second → a **six-second clip is $0.60**, a ten-second one **$1.00**. A short generated demo or social cut per campaign is a line item, not a project.

When generation costs less than the CDN bandwidth to serve the result, "generate on demand" beats "pre-render a library" for anything that benefits from being personalized or fresh. Once you're calling it per request, the plumbing — not the model — becomes the constraint: [cache by prompt hash, fall back across providers, and cap spend](/posts/image-generation-fallback-chain-founders.html) so a per-request pipeline can't run away with your invoice.

## Where the cheap tier is the wrong call

Three cases, and they're specific:

- **Brand-critical hero art.** Good-enough at scale is the whole point of this tier; pixel-perfect, on-brand key art still wants a human in the loop or a heavier model. Use Lite for the thousand disposable images, not the one that goes on the homepage.
- **Video that needs an SLA.** Omni Flash is a **public preview**. Prototype freely, but don't put a preview model on a critical path you can't degrade gracefully.
- **When you can't disclose AI generation.** Every output carries a [SynthID watermark and C2PA credentials](https://cloud.google.com/blog/products/ai-machine-learning/nano-banana-2-lite-and-gemini-omni-flash-available) by default. That's a feature for provenance and a legal nicety for disclosure — but it means the media is *detectable* as generated. Design your copy and your compliance around that instead of assuming the output is anonymous.

The short version: Google made in-product media generation cheap enough to stop treating it as a batch pipeline. Wire the image call above into the one place your product shows a picture it currently ships static, and watch what per-request generation does to it.
