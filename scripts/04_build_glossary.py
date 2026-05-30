#!/usr/bin/env python3
"""
04_build_glossary.py — Phase 4: trilingual glossary.

Scans every enriched page and builds data/glossary.json:
  • core concepts from a seed dictionary (with EN/ES)
  • discovered terms via German frequency analysis
  • per term: total frequency + up to 4 example contexts (ref + snippet)

NO API. Pure local frequency analysis.

Usage:
    python 04_build_glossary.py            # scan all enriched pages
"""
from __future__ import annotations

import argparse
import re
from collections import Counter

import common as C

# Core seed dictionary: term_de -> (en, es)
SEED_TERMS = {
    "Gestaltung": ("formation / configuration / design", "configuración / formación / diseño"),
    "Form": ("form / shape", "forma"),
    "Linie": ("line", "línea"),
    "Punkt": ("point / dot", "punto"),
    "Fläche": ("surface / plane / area", "superficie / plano / área"),
    "Raum": ("space", "espacio"),
    "Energie": ("energy", "energía"),
    "Bewegung": ("movement / motion", "movimiento"),
    "Gliederung": ("articulation / structuring", "articulación / estructuración"),
    "Teilung": ("division", "división"),
    "Ordnung": ("order", "orden"),
    "Rhythmus": ("rhythm", "ritmo"),
    "Gleichgewicht": ("equilibrium / balance", "equilibrio"),
    "Spannung": ("tension", "tensión"),
    "Proportion": ("proportion", "proporción"),
    "Symmetrie": ("symmetry", "simetría"),
    "Gewicht": ("weight", "peso"),
    "Maass": ("measure / dimension", "medida / dimensión"),
    "Farbe": ("colour", "color"),
    "Ton": ("tone / hue", "tono"),
    "Natur": ("nature", "naturaleza"),
    "Wachstum": ("growth", "crecimiento"),
    "Organismus": ("organism", "organismo"),
    "Bildnerisch": ("pictorial / visual / formative", "pictórico / visual / formativo"),
    "Konstruktion": ("construction", "construcción"),
    "Komposition": ("composition", "composición"),
    "Dynamik": ("dynamics", "dinámica"),
    "Statik": ("statics", "estática"),
    "Mechanik": ("mechanics", "mecánica"),
    "Progression": ("progression", "progresión"),
    "Kegelschnitt": ("conic section", "sección cónica"),
    "Ellipse": ("ellipse", "elipse"),
    "Spirale": ("spiral", "espiral"),
    "Centrum": ("centre", "centro"),
    "Peripherie": ("periphery", "periferia"),
}

# EN/ES for frequently-discovered morphology (optional niceties)
DISCOVERED_HINTS = {
    "stiel": ("stalk / stem", "pecíolo / tallo"),
    "blatt": ("leaf", "hoja"),
    "element": ("element", "elemento"),
    "rippen": ("ribs", "nervios"),
    "hauptrippe": ("main rib / midrib", "nervio central"),
    "blattstiel": ("leaf-stalk / petiole", "pecíolo"),
    "seitenrippen": ("side-ribs", "nervios laterales"),
    "abzweigungen": ("branchings", "ramificaciones"),
    "linien": ("lines", "líneas"),
    "energien": ("energies", "energías"),
}

MIN_DISCOVERED_FREQ = 3
MAX_CONTEXTS = 4


def load_articles() -> list[dict]:
    arts = []
    for f in sorted(C.ENRICHED_DIR.glob("*.json")):
        doc = C.read_json(f)
        for a in doc.get("articles", []):
            arts.append(a)
    return arts


def count_term(term: str, text: str) -> int:
    return len(re.findall(re.escape(term), text, flags=re.IGNORECASE))


def contexts_for(term: str, articles: list[dict]) -> list[dict]:
    out = []
    pat = re.compile(re.escape(term), re.IGNORECASE)
    for a in articles:
        text = a.get("text_de", "") or ""
        m = pat.search(text)
        if not m:
            continue
        i = m.start()
        snippet = text[max(0, i - 30): i + len(term) + 30].replace("\n", " ").strip()
        out.append({"ref": a.get("ref", ""), "context": snippet})
        if len(out) >= MAX_CONTEXTS:
            break
    return out


def build_from_articles(articles: list[dict], files_analyzed: int | None = None) -> dict:
    corpus = "\n".join(a.get("text_de", "") or "" for a in articles)
    entries = []

    # core concepts
    seed_keys = set()
    for term, (en, es) in SEED_TERMS.items():
        freq = count_term(term, corpus)
        seed_keys.add(term.lower())
        entries.append({
            "term_de": term, "term_en": en, "term_es": es,
            "frequency": freq,
            "example_contexts": contexts_for(term, articles) if freq else [],
            "category": "core_concept", "source": "seed_dictionary",
        })

    # discovered terms via frequency
    tokens = C.tokenize_de(corpus)
    freqs = Counter(tokens)
    for word, freq in freqs.most_common():
        if freq < MIN_DISCOVERED_FREQ:
            break
        if word in seed_keys:
            continue
        term_de = word.capitalize()
        en, es = DISCOVERED_HINTS.get(word, ("", ""))
        entries.append({
            "term_de": term_de, "term_en": en, "term_es": es,
            "frequency": freq,
            "example_contexts": contexts_for(term_de, articles),
            "category": "discovered", "source": "frequency_analysis",
        })

    entries.sort(key=lambda e: e["frequency"], reverse=True)
    return {
        "glossary": entries,
        "total_entries": len(entries),
        "seed_terms": sum(1 for e in entries if e["category"] == "core_concept"),
        "discovered_terms": sum(1 for e in entries if e["category"] == "discovered"),
        "built_from": "enriched",
        "files_analyzed": files_analyzed if files_analyzed is not None
        else len(list(C.ENRICHED_DIR.glob("*.json"))),
    }


def build() -> dict:
    articles = load_articles()
    if not articles:
        print("No enriched pages found. Run phases 1–3 first.")
    glossary = build_from_articles(articles)
    C.write_json(C.GLOSSARY_PATH, glossary)
    print(f"Glossary: {glossary['total_entries']} terms "
          f"({glossary['seed_terms']} seed + {glossary['discovered_terms']} discovered) → {C.GLOSSARY_PATH}")
    return glossary


if __name__ == "__main__":
    argparse.ArgumentParser(description="Build the trilingual glossary").parse_args()
    build()
