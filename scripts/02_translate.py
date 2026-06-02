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
        if not demo:
            try:
                from deep_translator import GoogleTranslator  # noqa
                self._cls = GoogleTranslator
            except ImportError:
                print("[warn] deep-translator not installed — run "
                      "`pip install -r requirements.txt`. Falling back to demo stubs.")
                self.demo = True

    def translate_many(self, texts: list[str], target: str) -> list[str]:
        """Translate a list DE→target, batched, with caching. Aligned output."""
        out: list[str] = [""] * len(texts)
        miss_i: list[int] = []
        miss_t: list[str] = []
        for i, t in enumerate(texts):
            if not t or not t.strip():
                out[i] = t
            elif self.demo:
                out[i] = f"[{target.upper()}] {t}"
            elif (target, t) in self.cache:
                out[i] = self.cache[(target, t)]
            else:
                miss_i.append(i)
                miss_t.append(t)
        if miss_t and not self.demo:
            try:
                res = self._cls(source="de", target=target).translate_batch(miss_t)
                time.sleep(0.3)
            except Exception as e:  # pragma: no cover
                print(f"  [translate err] {e}")
                res = miss_t  # fall back to the original text
            for j, i in enumerate(miss_i):
                val = res[j] if j < len(res) and res[j] else miss_t[j]
                out[i] = val
                self.cache[(target, miss_t[j])] = val
        return out


def translate_page(doc: dict, tr: Translator) -> dict:
    for a in doc.get("articles", []):
        paras = a.get("paragraphs_de", [])
        en = tr.translate_many(paras, "en")
        es = tr.translate_many(paras, "es")
        a["paragraphs_en"] = en
        a["paragraphs_es"] = es
        # Build the full text from the translated paragraphs (avoids a second
        # round-trip and keeps text/paragraphs consistent).
        a["text_en"] = "\n".join(p for p in en if p and p.strip())
        a["text_es"] = "\n".join(p for p in es if p and p.strip())
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
    ap.add_argument("--chapter", help="Chapter to translate: number 1–24, 'BF', or 'Anhang'")
    ap.add_argument("--all", action="store_true", help="Translate every raw page")
    ap.add_argument("--demo", action="store_true", help="No network; write [EN]/[ES] stubs")
    args = ap.parse_args()
    if not args.all and args.chapter is None:
        ap.error("provide --chapter N or --all")
    run(None if args.all else args.chapter, args.demo)
