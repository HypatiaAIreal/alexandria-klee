#!/usr/bin/env python3
"""
07_vectorize.py — make crisp, scalable SVG versions of Klee's graphics.

Local & economical: uses vtracer (raster → SVG, pip-installable, no API).
Faithful to Klee's actual strokes (it traces them, doesn't reinvent them).
Only operates on the GRAPHIC crops (from diagram_index.json), never the
typeset-text ones. Writes public/vectors/<same path>.svg and a manifest
src/data/vector_index.json mapping each image tail → its svg url.

    pip install vtracer pillow
    python 07_vectorize.py --image /BF/00/011/article1_1_large.jpg
    python 07_vectorize.py --chapter 2        # BG I.2 (also BF / Anhang)
    python 07_vectorize.py --all              # every graphic (slow)
    python 07_vectorize.py --chapter BF --limit 20

For production, upload public/vectors to R2 alongside the manuscripts.
"""
from __future__ import annotations

import argparse

from PIL import Image, ImageOps
import vtracer

import common as C

VECTORS_DIR = C.PROJECT_DIR / "public" / "vectors"
INDEX_PATH = C.PROJECT_DIR / "src" / "data" / "diagram_index.json"
MANIFEST_PATH = C.PROJECT_DIR / "src" / "data" / "vector_index.json"
THRESHOLD = 165  # ink/paper cut (0–255); lower keeps more faint strokes


def vectorize_one(tail: str, threshold: int = THRESHOLD) -> bool:
    src = C.PUBLIC_IMG_DIR / tail.lstrip("/")
    if not src.exists():
        print(f"  [skip] missing {tail}")
        return False
    out = VECTORS_DIR / (tail.lstrip("/").rsplit(".", 1)[0] + ".svg")
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".prep.png")
    try:
        im = Image.open(src).convert("L")
        im = ImageOps.autocontrast(im)
        bw = im.point(lambda x: 255 if x > threshold else 0, mode="1")
        bw.save(tmp)
        vtracer.convert_image_to_svg_py(
            str(tmp), str(out),
            colormode="binary", mode="spline",
            filter_speckle=4, corner_threshold=60, length_threshold=4.0,
        )
        return True
    except Exception as e:
        print(f"  [err] {tail}: {e}")
        return False
    finally:
        if tmp.exists():
            tmp.unlink()


def chapter_prefix(key: str) -> str | None:
    ch = C.resolve_chapter(key)
    return "/" + ch["image_subdir"] + "/" if ch else None


def run(args) -> None:
    VECTORS_DIR.mkdir(parents=True, exist_ok=True)
    graphics = C.read_json(INDEX_PATH, default={}).get("graphics", [])

    if args.image:
        targets = [args.image if args.image.startswith("/") else "/" + args.image]
    elif args.chapter:
        pref = chapter_prefix(args.chapter)
        if not pref:
            print(f"Unknown chapter '{args.chapter}'")
            return
        targets = [g for g in graphics if g.startswith(pref)]
    elif args.all:
        targets = list(graphics)
    else:
        print("Provide --image, --chapter, or --all")
        return

    if args.limit:
        targets = targets[: args.limit]

    manifest = C.read_json(MANIFEST_PATH, default={"map": {}})
    mp = manifest.get("map", {})
    done = 0
    print(f"Vectorizing {len(targets)} graphic(s)…")
    for i, tail in enumerate(targets):
        if vectorize_one(tail, args.threshold):
            svg_tail = tail.rsplit(".", 1)[0] + ".svg"
            mp[tail] = "/vectors" + svg_tail
            done += 1
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(targets)}…")
            C.write_json(MANIFEST_PATH, {"map": mp, "total": len(mp)})

    C.write_json(MANIFEST_PATH, {"map": mp, "total": len(mp)})
    print(f"\nVectorized {done}.  Manifest: {len(mp)} total → {MANIFEST_PATH.relative_to(C.PROJECT_DIR)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Vectorize Klee graphics → SVG (vtracer)")
    ap.add_argument("--image", help="A single graphic tail, e.g. /BF/00/011/article1_1_large.jpg")
    ap.add_argument("--chapter", help="Chapter key (1–24, BF, Anhang)")
    ap.add_argument("--all", action="store_true", help="All graphics (slow)")
    ap.add_argument("--limit", type=int, help="Cap number processed")
    ap.add_argument("--threshold", type=int, default=THRESHOLD, help="Ink/paper threshold 0–255")
    run(ap.parse_args())
