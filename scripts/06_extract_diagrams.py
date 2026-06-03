#!/usr/bin/env python3
"""
06_extract_diagrams.py — classify article crops as graphic vs typeset-text.

The ZPK archive serves, per article, BOTH a facsimile crop (warm/cream paper —
Klee's actual drawing) AND a white typeset transcription rendered as an image.
The Diagrams view should show ONLY the graphics. This scans every
public/manuscripts/**/article*_large.jpg, classifies each by background
colour, and writes src/data/diagram_index.json — the set of graphic image
paths (tails) the app filters by.

    pip install pillow
    python 06_extract_diagrams.py            # classify all
    python 06_extract_diagrams.py --sample 40  # quick check, no write

Pixel test: parchment crops are warm (r>b, mid-bright) almost everywhere;
typeset crops are near-white. The split is bimodal, so a single threshold
separates them reliably.
"""
from __future__ import annotations

import argparse
import glob
import os

from PIL import Image

import common as C

WARM_THRESHOLD = 0.40  # fraction of warm pixels above which a crop is a graphic


def warm_fraction(path: str) -> float:
    im = Image.open(path).convert("RGB").resize((48, 32))
    data = list(im.getdata())
    n = len(data) or 1
    warm = sum(1 for p in data if p[0] > 175 and (p[0] - p[2]) > 12)
    return warm / n


def is_graphic(path: str) -> bool:
    try:
        return warm_fraction(path) > WARM_THRESHOLD
    except Exception as e:
        print(f"  [warn] {path}: {e}")
        return True  # keep on error rather than silently drop


def tail_of(path: str) -> str:
    """Path relative to /public/manuscripts, leading slash, posix — matches
    url_local.slice('/manuscripts'.length), e.g. '/BG/I/02/003/article1_1_large.jpg'."""
    rel = os.path.relpath(path, C.PUBLIC_IMG_DIR).replace(os.sep, "/")
    return "/" + rel


def run(sample: int | None) -> None:
    files = sorted(glob.glob(str(C.PUBLIC_IMG_DIR / "**" / "article*_large.jpg"), recursive=True))
    if sample:
        import random
        random.seed(1)
        files = random.sample(files, min(sample, len(files)))
        g = sum(1 for f in files if is_graphic(f))
        print(f"sample {len(files)}: {g} graphic, {len(files) - g} text")
        return

    print(f"Classifying {len(files)} article crops…")
    graphics: list[str] = []
    text = 0
    for i, f in enumerate(files):
        if is_graphic(f):
            graphics.append(tail_of(f))
        else:
            text += 1
        if (i + 1) % 4000 == 0:
            print(f"  {i + 1}/{len(files)}…")

    graphics.sort()
    out = C.PROJECT_DIR / "src" / "data" / "diagram_index.json"
    C.write_json(out, {"total_graphics": len(graphics), "total_text": text, "graphics": graphics})
    print(f"\nGraphics: {len(graphics)}  ·  typeset-text dropped: {text}")
    print(f"→ {out.relative_to(C.PROJECT_DIR)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Classify diagram crops (graphic vs text)")
    ap.add_argument("--sample", type=int, help="Classify a random sample and print the split only")
    args = ap.parse_args()
    run(args.sample)
