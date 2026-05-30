#!/usr/bin/env python3
"""
run_pipeline.py — orchestrator for the Alexandria-Klee pipeline.

Runs all phases for a chapter, then ASSEMBLES the results into
src/data/seed.json (merging with chapters already present), so the
extracted chapter shows up in the web app.

    python run_pipeline.py --chapter 2                 # full run for BG I.2
    python run_pipeline.py --chapter 5 --ocr           # with OCR fallback
    python run_pipeline.py --chapter 2 --demo          # demo translations
    python run_pipeline.py --assemble                  # re-assemble seed only
    python run_pipeline.py --status                    # show pipeline state
    python run_pipeline.py --chapter 5 --push-mongo    # also load Atlas

Notes:
 • The app reads seed.json directly (no MongoDB) by default, so assembling
   is enough. If you run the app against MongoDB Atlas, add --push-mongo
   (runs `node scripts/seed-mongo.mjs`) or run `npm run seed:mongo` after.
 • This script never contacts ZPK except via 01_extract.py, which you call
   explicitly by running the pipeline.
"""
from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys
from collections import Counter
from pathlib import Path

import common as C


# ── dynamic import of digit-prefixed phase modules ──────────────
def load_module(filename: str):
    path = C.SCRIPTS_DIR / filename
    spec = importlib.util.spec_from_file_location(Path(filename).stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


# ── assemble enriched pages + existing seed → seed.json ─────────
def page_from_doc(doc: dict) -> dict:
    return {
        "id": C.slug(doc["page_ref"]),
        "page_ref": doc["page_ref"],
        "section": doc["section"],
        "part": doc["part"],
        "chapter_number": doc["chapter_number"],
        "chapter_name_de": doc.get("chapter_name_de", ""),
        "page_number": doc["page_number"],
        "url": doc.get("url", ""),
        "facsimile_local": doc.get("facsimile_local", ""),
        "articles": doc.get("articles", []),
        "total_articles": len(doc.get("articles", [])),
    }


PAGE_ESTIMATES = {"bf-0": 195, "bg-i-1": 10, "bg-i-2": 5, "bg-i-3": 10, "bg-i-4": 13}


def assemble(push_mongo: bool = False) -> None:
    seed = C.read_json(C.SEED_PATH, default={}) or {}
    existing_pages = seed.get("pages", [])

    # pages freshly produced by the pipeline (enriched)
    enriched_pages = [page_from_doc(C.read_json(f)) for f in sorted(C.ENRICHED_DIR.glob("*.json"))]
    enriched_ch_ids = {C.chapter_id(p["section"], p["part"], p["chapter_number"]) for p in enriched_pages}

    # keep existing pages whose chapter the pipeline did NOT just process
    kept = [p for p in existing_pages
            if C.chapter_id(p["section"], p["part"], p["chapter_number"]) not in enriched_ch_ids]
    pages = kept + enriched_pages
    pages.sort(key=lambda p: (p["section"], p["part"] or "", p["chapter_number"], p["page_number"]))

    articles = [a for p in pages for a in p["articles"]]
    present_ch_ids = {C.chapter_id(p["section"], p["part"], p["chapter_number"]) for p in pages}

    # full chapter list (trilingual), marking extracted ones
    chapters = []
    for section, part, num, de, en, es, url in C.CHAPTERS:
        cid = C.chapter_id(section, part, num)
        extracted = cid in present_ch_ids
        page_count = sum(
            1 for p in pages
            if C.chapter_id(p["section"], p["part"], p["chapter_number"]) == cid
        )
        chapters.append({
            "id": cid, "section": section, "part": part, "chapter_number": num,
            "name_de": de, "name_en": en, "name_es": es, "url_path": url,
            "total_pages": page_count if extracted else PAGE_ESTIMATES.get(cid, 0),
            "extracted": extracted,
        })

    # corpus-wide glossary (re-uses phase 4 logic over the merged corpus)
    g_mod = load_module("04_build_glossary.py")
    glossary_doc = g_mod.build_from_articles(articles, files_analyzed=len(pages))
    glossary = glossary_doc["glossary"]
    C.write_json(C.GLOSSARY_PATH, glossary_doc)

    # stats
    corpus_tokens = [w.lower() for a in articles for w in C._word_re.findall(a.get("text_de", "") or "")]
    concept_counts: Counter = Counter()
    for a in articles:
        for term in a.get("metadata", {}).get("concepts_de", []):
            concept_counts[term] += 1
    stats = {
        "total_files": len(pages),
        "total_articles": len(articles),
        "total_words": sum(a.get("search_index", {}).get("word_count_de", 0) for a in articles),
        "unique_words": len(set(corpus_tokens)),
        "top_50_words": dict(Counter(corpus_tokens).most_common(50)),
        "top_concepts": dict(concept_counts.most_common(20)),
        "glossary_entries": len(glossary),
    }

    out = {
        "chapters": chapters,
        "pages": pages,
        "articles": articles,
        "glossary": glossary,
        "stats": stats,
        "meta": {
            "project": "Alexandria-Klee",
            "source": "Zentrum Paul Klee — kleegestaltungslehre archive",
            "generated_at": seed.get("meta", {}).get("generated_at", "pipeline"),
        },
    }
    C.write_json(C.SEED_PATH, out)
    extracted_n = sum(1 for c in chapters if c["extracted"])
    print(f"\nAssembled seed.json — {len(pages)} pages, {len(articles)} articles, "
          f"{len(glossary)} glossary terms, {extracted_n} extracted chapter(s).")

    if push_mongo:
        print("Pushing to MongoDB Atlas (node scripts/seed-mongo.mjs)…")
        subprocess.run(["node", "scripts/seed-mongo.mjs"], cwd=C.PROJECT_DIR, check=False)


def status() -> None:
    def count(d: Path) -> int:
        return len(list(d.glob("*.json"))) if d.exists() else 0
    print("Pipeline status")
    print(f"  raw pages:        {count(C.RAW_DIR)}")
    print(f"  translated pages: {count(C.TRANSLATED_DIR)}")
    print(f"  enriched pages:   {count(C.ENRICHED_DIR)}")
    seed = C.read_json(C.SEED_PATH, default={}) or {}
    extracted = [c for c in seed.get("chapters", []) if c.get("extracted")]
    print(f"  seed chapters extracted: {len(extracted)} "
          f"({', '.join(c['id'] for c in extracted) or '—'})")


def run_chapter(n: int, demo: bool, ocr: bool, push_mongo: bool) -> None:
    extract = load_module("01_extract.py")
    translate = load_module("02_translate.py")
    enrich = load_module("03_enrich.py")

    print("── Phase 1: extract ──")
    if extract.extract_chapter(n, use_ocr=ocr) == 0:
        print("Nothing extracted; stopping.")
        return
    print("\n── Phase 2: translate ──")
    translate.run(n, demo)
    print("\n── Phase 3: enrich ──")
    enrich.run(n)
    print("\n── Phase 4 + assemble ──")
    assemble(push_mongo=push_mongo)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Alexandria-Klee extraction pipeline orchestrator")
    ap.add_argument("--chapter", type=int, help="Chapter number to run end-to-end")
    ap.add_argument("--demo", action="store_true", help="Use demo (offline) translations")
    ap.add_argument("--ocr", action="store_true", help="Enable OCR fallback in extraction")
    ap.add_argument("--assemble", action="store_true", help="Only (re)assemble seed.json")
    ap.add_argument("--status", action="store_true", help="Show pipeline status")
    ap.add_argument("--push-mongo", action="store_true", help="Load seed into Atlas afterwards")
    args = ap.parse_args()

    if args.status:
        status()
    elif args.assemble:
        assemble(push_mongo=args.push_mongo)
    elif args.chapter is not None:
        run_chapter(args.chapter, args.demo, args.ocr, args.push_mongo)
    else:
        ap.error("provide --chapter N, --assemble, or --status")
