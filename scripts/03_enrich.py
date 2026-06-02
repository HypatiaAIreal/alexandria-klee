#!/usr/bin/env python3
"""
03_enrich.py — Phase 3: semantic enrichment (local, NO API).

Reads translated pages (falls back to raw) and adds, per article:
  • metadata: concepts (DE/EN/ES), themes, bauhaus_domain, content_type,
    semantic_tags, complexity_level, has_diagrams, has_mathematical_notation
  • search_index: word list, counts and frequencies

All classification is done with local keyword matching — no model calls.

Usage:
    python 03_enrich.py --chapter 2
    python 03_enrich.py --all
"""
from __future__ import annotations

import argparse
import re
from collections import Counter

import common as C

# canonical German term → (en, es, domain, [tags])
CONCEPTS = {
    "Linie":       ("line", "línea", "lineature", ["lineature"]),
    "Linien":      ("line", "línea", "lineature", ["lineature"]),
    "Energie":     ("energy", "energía", "dynamics", ["energy_dynamics", "dynamics"]),
    "Energien":    ("energy", "energía", "dynamics", ["energy_dynamics", "dynamics"]),
    "Gliederung":  ("articulation", "articulación", "form_theory", ["structural_analysis"]),
    "Teilung":     ("division", "división", "lineature", ["structural_analysis"]),
    "Fläche":      ("surface", "superficie", "planimetry", ["planimetry"]),
    "Form":        ("form", "forma", "form_theory", ["form_theory"]),
    "Blatt":       ("leaf", "hoja", "general", ["botanical_analogy", "nature_study", "organic_form"]),
    "Baum":        ("tree", "árbol", "general", ["botanical_analogy", "organic_form"]),
    "Rippe":       ("rib", "nervio", "lineature", ["botanical_analogy", "lineature"]),
    "Punkt":       ("point", "punto", "lineature", ["lineature"]),
    "Bewegung":    ("movement", "movimiento", "dynamics", ["movement_process"]),
    "Farbe":       ("colour", "color", "color_theory", ["color_theory"]),
    "Ton":         ("tone", "tono", "color_theory", ["color_theory"]),
    "Symmetrie":   ("symmetry", "simetría", "composition", ["structural_analysis"]),
    "Gewicht":     ("weight", "peso", "composition", ["energy_dynamics"]),
    "Maass":       ("measure", "medida", "composition", ["mathematical_reasoning"]),
    "Maß":         ("measure", "medida", "composition", ["mathematical_reasoning"]),
    "Ordnung":     ("order", "orden", "form_theory", ["structural_analysis"]),
    "Wachstum":    ("growth", "crecimiento", "dynamics", ["movement_process", "organic_form"]),
    "Organismus":  ("organism", "organismo", "general", ["organic_form"]),
    "Natur":       ("nature", "naturaleza", "general", ["nature_study"]),
    "Bildnerisch": ("pictorial", "pictórico", "form_theory", ["form_theory"]),
    "Kontur":      ("contour", "contorno", "lineature", ["lineature"]),
    "Strahlung":   ("radiation", "radiación", "dynamics", ["energy_dynamics"]),
}

DOMAIN_THEME = {
    "form_theory": ("Formlehre", "form theory", "teoría de la forma"),
    "color_theory": ("Farblehre", "color theory", "teoría del color"),
    "composition": ("Komposition", "composition", "composición"),
    "dynamics": ("Dynamik", "dynamics", "dinámica"),
    "lineature": ("Lineatur", "lineature", "lineatura"),
    "planimetry": ("Planimetrie", "planimetry", "planimetría"),
    "mechanics": ("Mechanik", "mechanics", "mecánica"),
    "general": (None, None, None),
}

MATH_RE = re.compile(r"[½¼¾]|[0-9]\s*[+=]|=\s*[0-9]|∑|\b\d+\s*[:/]\s*\d+\b")
EXERCISE_RE = re.compile(r"\bZeichne|\bZeichnen|Übung|aufgabe", re.IGNORECASE)


def enrich_article(a: dict) -> dict:
    text = a.get("text_de", "") or ""
    words = C.tokenize_de(text)
    n = len(words)

    # concept detection (substring on canonical stems)
    matched = []
    for term in CONCEPTS:
        if term.lower() in text.lower():
            matched.append(term)
    concepts_de = sorted(set(matched))
    concepts_en = [CONCEPTS[t][0] for t in concepts_de]
    concepts_es = [CONCEPTS[t][1] for t in concepts_de]

    # domain = most frequent among matched concepts
    domain_votes = Counter(CONCEPTS[t][2] for t in concepts_de if CONCEPTS[t][2] != "general")
    domain = domain_votes.most_common(1)[0][0] if domain_votes else "general"

    # tags
    tags: set[str] = set()
    for t in concepts_de:
        tags.update(CONCEPTS[t][3])
    if domain in ("dynamics", "form_theory", "lineature", "planimetry", "composition", "color_theory"):
        tags.add(domain)

    # themes from domain (+ nature)
    themes, themes_en, themes_es = [], [], []
    de_theme = DOMAIN_THEME.get(domain, DOMAIN_THEME["general"])
    if de_theme[0]:
        themes.append(de_theme[0]); themes_en.append(de_theme[1]); themes_es.append(de_theme[2])
    if "nature_study" in tags or "botanical_analogy" in tags:
        themes.append("Naturstudium"); themes_en.append("nature study"); themes_es.append("estudio de la naturaleza")

    has_math = bool(MATH_RE.search(text))
    has_diagrams = len(a.get("images", [])) > 0

    # content type
    if n <= 4 and has_diagrams and not text.strip():
        content_type = "diagram"
    elif n <= 4:
        content_type = "diagram"
    elif EXERCISE_RE.search(text):
        content_type = "exercise"
    else:
        content_type = "theory"

    # complexity
    if n < 8:
        complexity = "introductory"
    elif n < 40 and not has_math:
        complexity = "intermediate"
    else:
        complexity = "advanced" if (n >= 40 or has_math) else "intermediate"

    a["metadata"] = {
        "concepts_de": concepts_de,
        "concepts_en": concepts_en,
        "concepts_es": concepts_es,
        "themes": themes,
        "themes_en": themes_en,
        "themes_es": themes_es,
        "bauhaus_domain": domain,
        "content_type": content_type,
        "semantic_tags": sorted(tags),
        "complexity_level": complexity,
        "has_diagrams": has_diagrams,
        "has_mathematical_notation": has_math,
        "teaching_context": "lecture",
        "enrichment_method": "local_analysis",
    }

    freqs = Counter(words)
    a["search_index"] = {
        "all_words_de": C.all_words(text),
        "word_count_de": len(C._word_re.findall(text)),
        "unique_words_de": len(set(w.lower() for w in C._word_re.findall(text))),
        "word_frequencies_de": dict(freqs.most_common(20)),
    }
    return a


def chapter_prefixes(n: int | None):
    if n is None:
        return None
    ch = C.chapter_by_number(n)
    if not ch:
        return tuple()
    if ch["part"]:
        return (f"{ch['section']}_{ch['part']}_{ch['chapter_number']:02d}_",)
    return (f"{ch['section']}_{ch['chapter_number']:02d}_",)


def run(chapter: int | None) -> int:
    C.ensure_dirs()
    src_dir = C.TRANSLATED_DIR if any(C.TRANSLATED_DIR.glob("*.json")) else C.RAW_DIR
    prefixes = chapter_prefixes(chapter)
    files = sorted(src_dir.glob("*.json"))
    if prefixes is not None:
        files = [f for f in files if any(f.name.startswith(p) for p in prefixes)]
    if not files:
        print("No pages to enrich. Run 01_extract.py (and 02_translate.py) first.")
        return 0
    print(f"Enriching {len(files)} page(s) from {src_dir.name}…")
    for f in files:
        doc = C.read_json(f)
        for a in doc.get("articles", []):
            enrich_article(a)
        C.write_json(C.ENRICHED_DIR / f.name, doc)
        print(f"  ✓ {doc.get('page_ref', f.name)}")
    print(f"Done → {C.ENRICHED_DIR}")
    return len(files)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Enrich pages with local keyword analysis")
    ap.add_argument("--chapter", help="Chapter to enrich: number 1–24, 'BF', or 'Anhang'")
    ap.add_argument("--all", action="store_true", help="Enrich every page")
    args = ap.parse_args()
    if not args.all and args.chapter is None:
        ap.error("provide --chapter N or --all")
    run(None if args.all else args.chapter)
