#!/usr/bin/env python3
"""
05_ingest_books.py — Phase 5: ingest Paul Klee's own writings (PDFs).

Local only, NO API. Uses PyMuPDF (fitz) to extract text, detects
chapter/section headings by font size (with an ALL-CAPS heuristic), and
writes one JSON per book to data/books/, plus a bundled src/data/books.json
the app reads (and a cover image per book into public/books/).

    pip install pymupdf            # (also in requirements.txt)
    python 05_ingest_books.py            # ingest the registry (<= --max-mb)
    python 05_ingest_books.py --all      # include large files too
    python 05_ingest_books.py --file "134343205-Klee-Paul-on-Modern-Art.pdf"
    python 05_ingest_books.py --ocr      # OCR image-only pages (slow)
    python 05_ingest_books.py --list     # list the registry + which exist

Only Paul-Klee-authored works are registered here. The big Notebooks
(Vol 1 & 2, 40+ MB) are registered but skipped unless --all.
"""
from __future__ import annotations

import argparse
import re
from collections import Counter
from datetime import datetime, timezone

import fitz  # PyMuPDF

import common as C

# ── Registry: only works BY Paul Klee ───────────────────────────
# file, title, year, language, [skip_by_default]
BOOKS = [
    ("70856952-5-a-the-Diaries-of-Klee.pdf", "The Diaries of Paul Klee, 1898–1918", 1957, "en", False),
    ("134343205-Klee-Paul-on-Modern-Art.pdf", "On Modern Art", 1948, "en", False),
    ("146335658-Paul-Klee-Pedagogical-Sketchbook.pdf", "Pedagogical Sketchbook", 1925, "en", False),
    ("101315116-Paul-Klee-Some-Poems-by-Paul-Klee-1962.pdf", "Some Poems by Paul Klee", 1962, "en", False),
    ("231332962-Paul-Klee-Sketching-and-Drawing.pdf", "Sketching and Drawing", None, "en", False),
    ("Bases para la estructuración del arte (Paul Klee) .pdf", "Bases para la estructuración del arte", None, "es", False),
    # Large notebooks — skipped unless --all
    ("408268293-Paul-Klee-Notebooks-v1-The-Thinking-Eye-Art-Ebook-pdf.pdf", "Notebooks, Vol. 1 — The Thinking Eye", 1961, "en", True),
    ("315988739-Paul-Klee-Notebooks-Vol-2-the-Nature-of-Nature.pdf", "Notebooks, Vol. 2 — The Nature of Nature", 1973, "en", True),
]

AUTHOR = "Paul Klee"


def clean_text(s: str) -> str:
    s = re.sub(r"-\n(?=\w)", "", s)        # de-hyphenate across line breaks
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def is_heading(text: str, size: float, heading_min: float) -> bool:
    t = text.strip()
    if len(t) < 3 or len(t) > 90:
        return False
    if not re.search(r"[A-Za-zÄÖÜäöüáéíóúñ]", t):
        return False
    if t.endswith((".", ",", ";", ":")):
        return False
    if size >= heading_min and len(t) <= 72:
        return True
    letters = [c for c in t if c.isalpha()]
    if letters and t.upper() == t and len(letters) >= 3 and len(t) <= 60:
        return True
    return False


def ocr_page(page) -> str:
    try:
        import pytesseract
        from PIL import Image
        import io
        pix = page.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        return pytesseract.image_to_string(img).strip()
    except Exception:
        return ""


def page_lines(page) -> list[tuple[str, float]]:
    """Return [(line_text, max_span_size)] for a page."""
    out = []
    d = page.get_text("dict")
    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            txt = "".join(s.get("text", "") for s in spans).strip()
            if not txt:
                continue
            size = max((s.get("size", 0) for s in spans), default=0)
            out.append((txt, size))
    return out


def ingest_book(path, title, year, language, do_ocr=False, do_cover=True) -> dict:
    doc = fitz.open(path)
    n_pages = doc.page_count
    book_id = C.slug(title)

    # body font size (most common, weighted by char count)
    size_counts: Counter = Counter()
    for page in doc:
        for txt, size in page_lines(page):
            size_counts[round(size)] += len(txt)
    body_size = size_counts.most_common(1)[0][0] if size_counts else 12
    heading_min = body_size * 1.3

    page_texts: list[str] = []
    sections: list[dict] = []
    cur: dict | None = None

    def flush():
        if cur and cur["text"].strip():
            cur["text"] = clean_text(cur["text"])
            cur["index"] = len(sections)
            sections.append(cur)

    for pno in range(1, n_pages + 1):
        page = doc[pno - 1]
        lines = page_lines(page)
        raw = page.get_text("text")
        if (not raw or len(raw.strip()) < 15) and do_ocr:
            raw = ocr_page(page)
            if raw:
                lines = [(ln, body_size) for ln in raw.splitlines() if ln.strip()]
        page_texts.append(raw or "")

        for txt, size in lines:
            if is_heading(txt, size, heading_min):
                flush()
                cur = {"index": 0, "title": txt.strip(), "page_start": pno, "page_end": pno, "text": ""}
            else:
                if cur is None:
                    cur = {"index": 0, "title": "Opening", "page_start": pno, "page_end": pno, "text": ""}
                cur["text"] += txt + "\n"
                cur["page_end"] = pno
    flush()

    # Fallback: no real headings detected → chunk by pages.
    if len(sections) < 2:
        sections = []
        CH = 10
        for start in range(0, n_pages, CH):
            end = min(start + CH, n_pages)
            text = clean_text("\n".join(page_texts[start:end]))
            if not text:
                continue
            sections.append({
                "index": len(sections),
                "title": f"Pages {start + 1}–{end}",
                "page_start": start + 1,
                "page_end": end,
                "text": text,
            })

    total_chars = sum(len(s["text"]) for s in sections)
    needs_ocr = total_chars < n_pages * 40  # likely a scanned/image PDF

    # cover image (first page → jpg)
    cover = ""
    if do_cover and n_pages:
        try:
            out_dir = C.PUBLIC_BOOKS_DIR / book_id
            out_dir.mkdir(parents=True, exist_ok=True)
            pix = doc[0].get_pixmap(dpi=96)
            pix.save(str(out_dir / "cover.jpg"))
            cover = f"/books/{book_id}/cover.jpg"
        except Exception as e:
            print(f"  [cover] {e}")

    doc.close()
    return {
        "id": book_id,
        "title": title,
        "author": AUTHOR,
        "year": year,
        "language": language,
        "source_file": C.Path(path).name,
        "total_pages": n_pages,
        "total_sections": len(sections),
        "total_chars": total_chars,
        "needs_ocr": needs_ocr,
        "cover": cover,
        "sections": sections,
        "ingested_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }


def assemble_books_seed() -> None:
    books = []
    for f in sorted(C.BOOKS_DATA_DIR.glob("*.json")):
        books.append(C.read_json(f))
    books.sort(key=lambda b: (b.get("year") or 9999, b.get("title", "")))
    C.write_json(C.BOOKS_SEED, {"books": books, "total": len(books)})
    print(f"\nBundled {len(books)} book(s) → {C.BOOKS_SEED.relative_to(C.PROJECT_DIR)}")


def run(only_file: str | None, include_large: bool, do_ocr: bool, max_mb: float) -> None:
    C.BOOKS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    targets = BOOKS if not only_file else [b for b in BOOKS if b[0] == only_file]
    if only_file and not targets:
        # allow ingesting an arbitrary file not in the registry
        targets = [(only_file, C.Path(only_file).stem, None, "en", False)]

    done = 0
    for fname, title, year, lang, skip in targets:
        path = C.BOOKS_SRC_DIR / fname
        if not path.exists():
            print(f"  [skip] not found: {fname}")
            continue
        size_mb = path.stat().st_size / (1024 * 1024)
        if skip and not include_large and not only_file:
            print(f"  [skip] large notebook ({size_mb:.0f} MB), use --all: {title}")
            continue
        if size_mb > max_mb and not include_large and not only_file:
            print(f"  [skip] {size_mb:.0f} MB > {max_mb} MB cap: {title}")
            continue
        print(f"  Ingesting: {title}  ({size_mb:.0f} MB)…")
        book = ingest_book(str(path), title, year, lang, do_ocr=do_ocr)
        C.write_json(C.BOOKS_DATA_DIR / f"{book['id']}.json", book)
        flag = " [needs OCR — image PDF]" if book["needs_ocr"] else ""
        print(f"    → {book['total_pages']} pages, {book['total_sections']} sections, "
              f"{book['total_chars']:,} chars{flag}")
        done += 1

    if done:
        assemble_books_seed()
    print(f"\nDone: ingested {done} book(s).")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Ingest Paul Klee's writings (PDF → JSON)")
    ap.add_argument("--all", action="store_true", help="Include the large notebooks too")
    ap.add_argument("--file", help="Ingest a single file name from the books dir")
    ap.add_argument("--ocr", action="store_true", help="OCR image-only pages (slow)")
    ap.add_argument("--max-mb", type=float, default=15.0, help="Skip files larger than this (default 15)")
    ap.add_argument("--list", action="store_true", help="List the registry")
    args = ap.parse_args()

    if args.list:
        for fname, title, year, lang, skip in BOOKS:
            exists = (C.BOOKS_SRC_DIR / fname).exists()
            print(f"  [{'x' if exists else ' '}] {lang} {year or '----'}  {title}"
                  + ("  (large)" if skip else ""))
        raise SystemExit(0)

    run(args.file, args.all, args.ocr, args.max_mb)
