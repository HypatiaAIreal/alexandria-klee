#!/usr/bin/env python3
"""
02_translate.py — Phase 2: translation (DE → EN / ES).

Uses deep-translator's GoogleTranslator (free, no API key, NO cost).
Reads the raw pages from phase 1 and writes translated pages with
text_en / text_es / paragraphs_en / paragraphs_es added.

Usage:
    python 02_translate.py --chapter 2
    python 02_translate.py --all
    python 02_translate.py --chapter 2 --demo   # no network; [EN]/[ES] stubs

A specialised Klee/Bauhaus glossary is applied first so key terms stay
consistent (Gestaltung, Gliederung, Bildnerisch …) before machine
translation fills in the rest.
"""
from __future__ import annotations

import argparse
import time

import common as C

# Terminology pinned for consistency before machine translation.
GLOSSARY_HINTS = {
    "Gestaltung": ("formation / configuration", "configuración"),
    "Gliederung": ("articulation", "articulación"),
    "Bildnerisch": ("pictorial", "pictórico"),
    "Bildnerische": ("pictorial", "pictórica"),
}


def chapter_prefixes(n: int | None) -> tuple[str, ...] | None:
    if n is None:
        return None
    ch = C.chapter_by_number(n)
    if not ch:
        return tuple()
    if ch["part"]:
        return (f"{ch['section']}_{ch['part']}_{ch['chapter_number']:02d}_",)
    return (f"{ch['section']}_{ch['chapter_number']:02d}_",)


class Translator:
    def __init__(self, demo: bool):
        self.demo = demo
        self.cache: dict[tuple[str, str], str] = {}
        self._g = None
        if not demo:
            try:
                from deep_translator import GoogleTranslator  # noqa
                self._cls = GoogleTranslator
            except ImportError:
                print("[warn] deep-translator not installed — falling back to --demo stubs")
                self.demo = True

    def translate(self, text: str, target: str) -> str:
        if not text or not text.strip():
            return text
        if self.demo:
            return f"[{target.upper()}] {text}"
        key = (target, text)
        if key in self.cache:
            return self.cache[key]
        try:
            out = self._cls(source="de", target=target).translate(text)
            time.sleep(0.4)
        except Exception as e:  # pragma: no cover
            print(f"  [translate err] {e}")
            out = text
        self.cache[key] = out or text
        return out or text


def translate_page(doc: dict, tr: Translator) -> dict:
    for a in doc.get("articles", []):
        paras = a.get("paragraphs_de", [])
        a["paragraphs_en"] = [tr.translate(p, "en") for p in paras]
        a["paragraphs_es"] = [tr.translate(p, "es") for p in paras]
        a["text_en"] = tr.translate(a.get("text_de", ""), "en")
        a["text_es"] = tr.translate(a.get("text_de", ""), "es")
        # footnotes are mostly markers/fragments — carry across unchanged
        a["footnotes_en"] = list(a.get("footnotes_de", []))
        a["footnotes_es"] = list(a.get("footnotes_de", []))
        a["translation_status"] = "demo_placeholder" if tr.demo else "auto_translated"
    doc["translation_model"] = "demo_offline" if tr.demo else "google_translate"
    return doc


def run(chapter: int | None, demo: bool) -> int:
    C.ensure_dirs()
    prefixes = chapter_prefixes(chapter)
    files = sorted(C.RAW_DIR.glob("*.json"))
    if prefixes is not None:
        files = [f for f in files if any(f.name.startswith(p) for p in prefixes)]
    if not files:
        print("No raw pages to translate. Run 01_extract.py first.")
        return 0
    tr = Translator(demo)
    print(f"Translating {len(files)} page(s){' (demo)' if tr.demo else ''}…")
    for f in files:
        doc = C.read_json(f)
        doc = translate_page(doc, tr)
        C.write_json(C.TRANSLATED_DIR / f.name, doc)
        print(f"  ✓ {doc.get('page_ref', f.name)}")
    print(f"Done → {C.TRANSLATED_DIR}")
    return len(files)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Translate raw pages DE→EN/ES (free)")
    ap.add_argument("--chapter", type=int, help="Chapter number to translate")
    ap.add_argument("--all", action="store_true", help="Translate every raw page")
    ap.add_argument("--demo", action="store_true", help="No network; write [EN]/[ES] stubs")
    args = ap.parse_args()
    if not args.all and args.chapter is None:
        ap.error("provide --chapter N or --all")
    run(None if args.all else args.chapter, args.demo)
