#!/usr/bin/env python3
"""
common.py — shared config & helpers for the Alexandria-Klee pipeline.

The pipeline writes the SAME data shapes the web app consumes
(src/data/seed.json + /public/manuscripts images), so any chapter you
extract appears in the app automatically (see README_PIPELINE.md).
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────
SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPTS_DIR.parent                      # alexandria-klee/
DATA_DIR = PROJECT_DIR / "data"                       # pipeline working dirs
RAW_DIR = DATA_DIR / "raw" / "pages"
TRANSLATED_DIR = DATA_DIR / "translated" / "pages"
ENRICHED_DIR = DATA_DIR / "enriched" / "pages"
PUBLIC_IMG_DIR = PROJECT_DIR / "public" / "manuscripts"
SEED_PATH = PROJECT_DIR / "src" / "data" / "seed.json"
GLOSSARY_PATH = DATA_DIR / "glossary.json"

# ── Source archive ──────────────────────────────────────────────
# The Zentrum Paul Klee Gestaltungslehre archive. Override with the
# KLEE_BASE_URL env var if the host changes.
# NOTE: the archive is served over plain HTTP at the .zpk.org host, e.g.
#   http://www.kleegestaltungslehre.zpk.org/ee/ZPK/BG/2012/01/02/001/
import os

BASE_URL = os.environ.get("KLEE_BASE_URL", "http://www.kleegestaltungslehre.zpk.org")
REQUEST_DELAY = 1.0  # seconds between requests — be gentle with the server
USER_AGENT = "Alexandria-Klee-Research/1.0 (private academic study)"

# ── Chapter map (trilingual) — mirrors scripts/build-seed.mjs ───
# [section, part, chapter_number, name_de, name_en, name_es, url_path]
CHAPTERS = [
    ["BF", None, 0, "Bildnerische Formlehre", "Pictorial Theory of Form", "Teoría pictórica de la forma", "/ee/ZPK/BF/2012/01/01/"],
    ["BG", "I", 1, "Gestaltungslehre als Begriff", "Theory of Design as a Concept", "La teoría de la configuración como concepto", "/ee/ZPK/BG/2012/01/01/"],
    ["BG", "I", 2, "Principielle Ordnung", "Principial Order", "Orden principial", "/ee/ZPK/BG/2012/01/02/"],
    ["BG", "I", 3, "Specielle Ordnung", "Special Order", "Orden especial", "/ee/ZPK/BG/2012/01/03/"],
    ["BG", "I", 4, "Gliederung", "Articulation", "Articulación", "/ee/ZPK/BG/2012/01/04/"],
    ["BG", "II", 5, "Wege zur Form", "Ways to Form", "Caminos hacia la forma", "/ee/ZPK/BG/2012/02/05/"],
    ["BG", "II", 6, "Elementarform", "Elementary Form", "Forma elemental", "/ee/ZPK/BG/2012/02/06/"],
    ["BG", "II", 7, "Form im Format", "Form within the Format", "La forma en el formato", "/ee/ZPK/BG/2012/02/07/"],
    ["BG", "II", 8, "Formvermittlung", "Mediation of Form", "Mediación de la forma", "/ee/ZPK/BG/2012/02/08/"],
    ["BG", "II", 9, "Formgebilde", "Form-Structures", "Configuraciones formales", "/ee/ZPK/BG/2012/02/09/"],
    ["BG", "II", 10, "Zusammengesetzte Form", "Composite Form", "Forma compuesta", "/ee/ZPK/BG/2012/02/10/"],
    ["BG", "II", 11, "Abweichung auf Grund der Norm", "Deviation on the Basis of the Norm", "Desviación sobre la base de la norma", "/ee/ZPK/BG/2012/02/11/"],
    ["BG", "II", 12, "Lagenwechsel", "Change of Position", "Cambio de posición", "/ee/ZPK/BG/2012/02/12/"],
    ["BG", "II", 13, "Irreguläres Formgebilde", "Irregular Form-Structure", "Configuración formal irregular", "/ee/ZPK/BG/2012/02/13/"],
    ["BG", "II", 14, "Mehreinige Centren", "Multiple Unified Centres", "Centros múltiples unificados", "/ee/ZPK/BG/2012/02/14/"],
    ["BG", "II", 15, "Freie Irregularität", "Free Irregularity", "Irregularidad libre", "/ee/ZPK/BG/2012/02/15/"],
    ["BG", "II", 16, "Kegelschnitte", "Conic Sections", "Secciones cónicas", "/ee/ZPK/BG/2012/02/16/"],
    ["BG", "II", 17, "Wandernde Centren", "Wandering Centres", "Centros errantes", "/ee/ZPK/BG/2012/02/17/"],
    ["BG", "II", 18, "Pathologie", "Pathology", "Patología", "/ee/ZPK/BG/2012/02/18/"],
    ["BG", "II", 19, "Progressionen", "Progressions", "Progresiones", "/ee/ZPK/BG/2012/02/19/"],
    ["BG", "II", 20, "Statik und Dynamik", "Statics and Dynamics", "Estática y dinámica", "/ee/ZPK/BG/2012/02/20/"],
    ["BG", "II", 21, "Mechanik", "Mechanics", "Mecánica", "/ee/ZPK/BG/2012/02/21/"],
    ["BG", "II", 22, "Deutungen", "Interpretations", "Interpretaciones", "/ee/ZPK/BG/2012/02/22/"],
    ["BG", "II", 23, "Übungssammlung", "Collection of Exercises", "Colección de ejercicios", "/ee/ZPK/BG/2012/02/23/"],
    ["BG", "III", 24, "Stereometrische Gestaltung", "Stereometric Design", "Configuración estereométrica", "/ee/ZPK/BG/2012/03/24/"],
    ["BG", "Anhang", 0, "Anhang", "Appendix", "Apéndice", "/ee/ZPK/BG/2012/04/01/"],
]


def chapter_by_number(n: int) -> dict | None:
    """Resolve a chapter by its chapter_number (e.g. 2 → BG I.2)."""
    for section, part, num, de, en, es, url in CHAPTERS:
        if num == n and not (num == 0 and section == "BG"):
            # avoid the Anhang (num 0, BG); BF is num 0 + section BF
            return _chapter_dict(section, part, num, de, en, es, url)
        if num == n and section == "BF":
            return _chapter_dict(section, part, num, de, en, es, url)
    # exact match fallback (handles BF=0)
    for section, part, num, de, en, es, url in CHAPTERS:
        if num == n:
            return _chapter_dict(section, part, num, de, en, es, url)
    return None


def _chapter_dict(section, part, num, de, en, es, url) -> dict:
    return {
        "section": section,
        "part": part,
        "chapter_number": num,
        "name_de": de,
        "name_en": en,
        "name_es": es,
        "url_path": url,
        "image_subdir": f"{section}/{part}/{num:02d}" if part else f"{section}/{num:02d}",
    }


# ── id / slug helpers (MUST match src/lib/util.ts) ──────────────
def slug(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[.\s/]+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def chapter_id(section: str, part: str | None, num: int) -> str:
    return slug(f"{section}-{part or ''}-{num}")


def page_ref(section: str, part: str | None, num: int, page: int) -> str:
    return f"{section} {part}.{num}/{page}" if part else f"{section}/{page}"


def page_file_name(section: str, part: str | None, num: int, page: int) -> str:
    if part:
        return f"{section}_{part}_{num:02d}_{page:03d}.json"
    return f"{section}_{num:02d}_{page:03d}.json"


# ── JSON IO ─────────────────────────────────────────────────────
def read_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def write_json(path: Path, data) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_dirs() -> None:
    for d in (RAW_DIR, TRANSLATED_DIR, ENRICHED_DIR, PUBLIC_IMG_DIR):
        d.mkdir(parents=True, exist_ok=True)


# ── German tokenisation (shared by enrich + glossary) ───────────
STOPWORDS = {
    "der", "die", "das", "und", "ist", "als", "sich", "oder", "des", "sie",
    "nicht", "sind", "eine", "nach", "diese", "mehr", "ein", "den", "von",
    "durch", "mit", "dem", "dieser", "wird", "vom", "kann", "auch", "noch",
    "einen", "auf", "im", "in", "zu", "zur", "zum", "es", "an", "so", "wie",
    "wo", "da", "bei", "aus", "um", "für", "wenn", "doch", "schon", "aber",
    "man", "ihre", "ihr", "sein", "seine", "dass", "wieder", "immer", "nur",
    "etwa", "etwas", "alle", "alles", "diesem", "diesen", "dies", "wir",
    "unser", "unsere", "unsern", "we", "ri", "an", "be",
}

_word_re = re.compile(r"[A-Za-zÄÖÜäöüß]+")


def tokenize_de(text: str) -> list[str]:
    """Lowercased German word tokens, stopwords removed, length >= 3."""
    out = []
    for m in _word_re.findall(text or ""):
        w = m.lower()
        if len(w) >= 3 and w not in STOPWORDS:
            out.append(w)
    return out


def all_words(text: str) -> list[str]:
    return sorted({m.lower() for m in _word_re.findall(text or "")})
