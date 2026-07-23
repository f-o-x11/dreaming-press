---
title: "How to Build a Document Ingestion Pipeline with Docling in 2026: Tables, Layout, and Code You Can Ship"
dek: Convert PDFs and DOCX to clean, chunked, table-aware text for RAG with Docling's real API — install to HybridChunker in one sitting.
author: rosalinda
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-23
tags: reportive, captivating
summary: "Docling (`pip install docling`, LF AI & Data Foundation) converts PDFs, DOCX, PPTX, and 20+ other formats into a unified DoclingDocument you export to Markdown, JSON, or HTML. ;; Its layout model and TableFormer reconstruct reading order and table structure before any text is pulled, which is why it beats pdfminer-style extraction on multi-column pages and financial tables. ;; The HybridChunker (`docling.chunking`) produces token-aware, metadata-enriched chunks sized to your embedding model's tokenizer — the missing link between conversion and a vector store. ;; Scanned PDFs need `do_ocr=True` and an OCR engine (EasyOCR by default, Tesseract or ocrmac as swaps). ;; Bottom line: for a solo builder wiring documents into agent RAG, Docling is the fastest path from messy file to shippable chunk."
faq: "How do I install Docling? | Run `pip install docling`. For OCR extras or specific tokenizer backends, add extras like `pip install 'docling[tesserocr]'` or `pip install 'docling-core[chunking]'` if you're using docling-core directly. ;; Does Docling handle tables? | Yes — set `pipeline_options.do_table_structure = True` and it runs the TableFormer model to reconstruct rows and columns, which you can pull out with `table.export_to_dataframe(doc=result.document)` or `table.export_to_html(doc=result.document)`. ;; How do I chunk Docling output for RAG? | Use `HybridChunker` from `docling.chunking`: instantiate it (optionally with a HuggingFace tokenizer matched to your embedding model), call `chunker.chunk(dl_doc=doc)`, and feed `chunker.contextualize(chunk=chunk)` — not raw `chunk.text` — to your embedding model. ;; Does Docling do OCR on scanned PDFs? | Yes. Set `pipeline_options.do_ocr = True` on `PdfPipelineOptions`; it uses EasyOCR by default and you can swap in `TesseractOcrOptions`, `TesseractCliOcrOptions`, or `OcrMacOptions` (macOS) depending on what's installed. ;; Is Docling free/open source? | Yes, it's MIT-licensed, built by IBM Research and now hosted at the LF AI & Data Foundation under the docling-project GitHub org."
compare: "OCR engine | EasyOCR (default) | Tesseract | ocrmac (macOS) ;; Install | Bundled, nothing extra | pip extra + system Tesseract binary | Built into macOS Vision, no install ;; Options class | default | TesseractOcrOptions / TesseractCliOcrOptions | OcrMacOptions ;; Best for | Cross-platform default, GPU-friendly | Server pipelines, many languages | Fast local runs on Apple Silicon ;; Languages | 80+ | 100+ | System-dependent"
figures: "MIT | Docling's open-source license (IBM Research → LF AI & Data) ;; 20+ | input formats supported (PDF, DOCX, PPTX, XLSX, HTML, images, audio, video…) ;; 2 | TableFormer modes (FAST vs ACCURATE)"
sources: "https://github.com/docling-project/docling | Docling — GitHub ;; https://docling-project.github.io/docling/ | Docling docs ;; https://docling-project.github.io/docling/concepts/chunking/ | Docling chunking concepts (HybridChunker) ;; https://docling-project.github.io/docling/examples/hybrid_chunking/ | Hybrid chunking example notebook ;; https://docling-project.github.io/docling/usage/supported_formats/ | Supported input/output formats ;; https://lfaidata.foundation/projects/docling/ | Docling project page — LF AI & Data Foundation"
art:
  archetype: grid
  mood: hopeful
  motif: "a messy PDF page resolving into clean structured blocks and a table, on a warm grid"
---

**If you read one line:** `pip install docling`, run `DocumentConverter().convert(path).document`, export to Markdown or JSON, then hand the result to `HybridChunker` — that's the whole pipeline, and the code below is copy-pasteable.

Docling is IBM Research's open-source document converter, now stewarded by the LF AI & Data Foundation under the `docling-project` GitHub org. It turns PDFs, DOCX, PPTX, XLSX, HTML, images, and a long tail of other formats into a single unified `DoclingDocument` object — layout-aware, table-structured, and ready to export or chunk. If you're wiring a folder of contracts, reports, or manuals into an agent's retrieval layer, this is the fastest legitimate path from raw file to clean chunks. For the broader parser landscape, see our [comparison of Docling, Unstructured, and LlamaParse](/posts/2026-06-21-docling-vs-unstructured-vs-llamaparse.html) and the [wider PDF-parsing roundup](/posts/pdf-parsing-for-rag-docling-marker-llamaparse-mistral-ocr.html).

## Install and convert your first PDF

```bash
pip install docling
```

Conversion is three lines:

```python
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("contracts/msa_q3.pdf")  # path, URL, or stream
doc = result.document

print(doc.export_to_markdown())
```

`convert()` accepts a local path, a URL, or an in-memory `DocumentStream` (for binary uploads in a web app). The returned `result.document` is a `DoclingDocument` — a structured tree of text, tables, headings, and figures with layout metadata attached, not a flat string.

## Why layout-aware parsing matters (the non-obvious part)

Naive extractors like pdfminer or PyPDF read a PDF's content stream in the order text-drawing operators appear — which is often *not* the order a human reads the page. A two-column page gets its columns interleaved line-by-line. A table, which has no native "table" object in the PDF spec, dissolves into a scatter of positioned text runs that naive extraction just concatenates left-to-right, top-to-bottom — numbers from three different columns end up glued into one nonsense string.

Docling avoids this by running a layout model first: it detects regions (paragraph, table, header, caption, footer) via object detection, establishes real reading order from those regions, and only then extracts text per-region. For tables specifically, it runs a second model — **TableFormer** — that reconstructs actual row/column structure before anything is exported, so a table becomes a genuine grid object, not word soup. This is the single biggest reason layout-aware parsing beats naive extraction for retrieval quality: the failure is invisible in a chunk preview and only shows up when your agent confidently cites the wrong number from a scrambled table.

## Extracting tables and controlling structure recognition

Table extraction is on by default, but you can tune accuracy vs. speed:

```python
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
from docling.document_converter import DocumentConverter, PdfFormatOption

pipeline_options = PdfPipelineOptions()
pipeline_options.do_table_structure = True
pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE  # or .FAST

converter = DocumentConverter(
    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
)
result = converter.convert("finance/q3_report.pdf")

for i, table in enumerate(result.document.tables):
    df = table.export_to_dataframe(doc=result.document)
    print(f"Table {i}: {df.shape}")
    df.to_csv(f"table_{i}.csv")
```

`ACCURATE` mode (the default) gives you better structure on messy or merged-cell tables; `FAST` trades some accuracy for throughput on large batches. `table.export_to_html(doc=result.document)` is also available if you want an HTML table to embed directly in a chunk.

## Exporting to Markdown and JSON

Two export calls cover most downstream needs:

```python
import json

# Markdown — readable, good for LLM context windows
with open("q3_report.md", "w") as f:
    f.write(doc.export_to_markdown())

# JSON — lossless serialization of the full DoclingDocument
with open("q3_report.json", "w") as f:
    json.dump(doc.export_to_dict(), f)
```

Markdown is what you'll usually feed an LLM directly; JSON preserves every layout detail if you need to rebuild structure later or feed a custom chunker.

## Chunking for RAG with HybridChunker

Conversion alone doesn't give you RAG-ready chunks — you still need to split by token budget without breaking tables or headings mid-thought. That's `HybridChunker`, covered in more depth alongside general chunking strategy in [our chunking guide](/posts/best-chunking-strategy-for-rag.html):

```python
from docling.chunking import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from transformers import AutoTokenizer

tokenizer = HuggingFaceTokenizer(
    tokenizer=AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2"),
    max_tokens=512,
)
chunker = HybridChunker(tokenizer=tokenizer)

chunks = list(chunker.chunk(dl_doc=doc))
for chunk in chunks:
    embed_text = chunker.contextualize(chunk=chunk)  # metadata-enriched text
    # embed(embed_text) and upsert into your vector store, alongside chunk.text
```

`HybridChunker` starts from Docling's hierarchical chunker (one chunk per structural element), then splits oversized chunks and merges undersized adjacent ones so each chunk fits your tokenizer's `max_tokens` — matched to your actual embedding model, not a guessed character count. Always embed `chunker.contextualize(chunk)`, not raw `chunk.text`: it prepends headings and captions so the embedding carries context the bare chunk lost. For wide tables, set `repeat_table_header=True` (the default) so every chunk of a split table still carries its column headers.

## OCR for scanned documents

Scanned PDFs and photographed pages need OCR turned on explicitly:

```python
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter, PdfFormatOption

pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = True
pipeline_options.ocr_options.lang = ["en"]
pipeline_options.do_table_structure = True

converter = DocumentConverter(
    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
)
result = converter.convert("scans/old_contract.pdf")
```

EasyOCR is the default engine; swap `pipeline_options.ocr_options = TesseractOcrOptions()` (or `TesseractCliOcrOptions()`, or `OcrMacOptions()` on macOS) if you'd rather not pull in EasyOCR's dependency footprint. Docling auto-detects scanned pages, but for mixed documents — some born-digital pages, some scanned — leaving `do_ocr=True` on is the safe default; Docling only OCRs pages that need it.

## Wiring it together

The shape of a production ingestion job is: convert → export Markdown (for eyeballing) and JSON (for archival) → chunk with `HybridChunker` → embed `contextualize()` output → upsert with `chunk.text` as the stored payload. For 100+ documents, batch with `DocumentConverter().convert_all(paths)` rather than looping single `convert()` calls — it reuses loaded models across the batch instead of reloading per file. Start with the defaults; only reach for `TableFormerMode.ACCURATE` and OCR overrides once you've confirmed on a sample that the defaults are actually losing you table cells or scanned text.
