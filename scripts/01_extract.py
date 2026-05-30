#!/usr/bin/env python3
"""
01_extract.py — Phase 1: extraction.

Scrapes one chapter from the Zentrum Paul Klee Gestaltungslehre archive:
  • downloads the full-page facsimile (page.jpg) into /public/manuscripts
  • detects the article regions on each page
  • pulls the German transcription for each article (the archive serves it
    via an AJAX endpoint), and downloads the individual drawing crops
  • optional --ocr: also run Tesseract OCR (German) on the facsimile as a
    fallback / supplement when no transcription is available

Writes one JSON per page to data/raw/pages/ in the app's article shape.

Usage:
    python 01_extract.py --chapter 2          # extract BG I.2
    python 01_extract.py --chapter 5 --ocr    # + OCR fallback
    python 01_extract.py --list               # list chapter numbers

This script ONLY reads local config + the public archive. It never writes
to MongoDB; run run_pipeline.py to assemble results into the app.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

import common as C

session = requests.Session()
session.headers.update({"User-Agent": C.USER_AGENT, "Accept": "text/html,application/xhtml+xml"})


def fetch(url: str, accept: str = "text/html"):
    time.sleep(C.REQUEST_DELAY)
    try:
        r = session.get(url, headers={"Accept": accept}, timeout=30)
        r.raise_for_status()
        return r
    except requests.RequestException as e:
        print(f"  [ERROR] {url}: {e}")
        return None


def download(url: str, dest) -> bool:
    dest = C.Path(dest)
    if dest.exists():
        return True
    full = url if url.startswith("http") else C.BASE_URL + url
    r = fetch(full, accept="image/jpeg,image/*")
    if r and r.status_code == 200:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(r.content)
        return True
    return False


def detect_pages(url_path: str) -> list[dict]:
    """Find the page numbers in a chapter via the <select id="select-page">."""
    r = fetch(C.BASE_URL + url_path + "001/")
    if not r:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    pages: list[dict] = []
    select = soup.find("select", id="select-page")
    if select:
        for opt in select.find_all("option"):
            v = (opt.get("value") or "").strip()
            if re.match(r"\d{3}", v):
                pages.append({"page_number": int(v), "url": C.BASE_URL + url_path + f"{v}/"})
    if not pages:  # fallback: probe sequentially until a page 404s (capped)
        for i in range(1, 400):
            u = C.BASE_URL + url_path + f"{i:03d}/"
            rr = fetch(u)
            if not rr:
                break
            pages.append({"page_number": i, "url": u})
    # dedupe + sort
    seen, uniq = set(), []
    for p in sorted(pages, key=lambda x: x["page_number"]):
        if p["page_number"] not in seen:
            seen.add(p["page_number"])
            uniq.append(p)
    return uniq


def detect_articles(page_url: str) -> list[int]:
    r = fetch(page_url)
    if not r:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    nums: set[int] = set()
    scope = soup.find("div", id="page") or soup
    for div in scope.find_all("div", class_=True):
        for cls in div.get("class", []):
            m = re.match(r"article(\d+)", cls)
            if m:
                nums.add(int(m.group(1)))
    return sorted(nums)


def extract_article(page_url: str, num: int) -> dict | None:
    r = fetch(page_url + f"article/{num}")
    if not r:
        return None
    soup = BeautifulSoup(r.text, "lxml")
    art = soup.find("div", id="article") or soup
    images, paragraphs, footnotes = [], [], []

    pdf = soup.find("a", id="btn_pdf")
    pdf_url = pdf["href"] if pdf and pdf.get("href") else ""

    body = art.find("div", class_="body") or art
    for img in body.find_all("img"):
        src = img.get("src", "")
        if src:
            images.append({
                "url_remote": src,
                "url_large": img.get("data-large", src),
            })
    for p in body.find_all("p"):
        t = p.get_text(strip=True)
        if not t:
            continue
        if re.match(r"^\d+\s*$", t) or re.match(r"^\d+\s+\\", t):
            footnotes.append(t)
        else:
            paragraphs.append(t)

    return {
        "article_number": num,
        "text_de": "\n".join(paragraphs),
        "paragraphs_de": paragraphs,
        "footnotes_de": footnotes,
        "images": images,
        "pdf_url": pdf_url,
    }


def ocr_image(path) -> str:
    """OCR a facsimile with Tesseract (German). Returns '' if unavailable."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        print("  [ocr] pytesseract/Pillow not installed — skipping OCR")
        return ""
    try:
        return pytesseract.image_to_string(Image.open(path), lang="deu").strip()
    except Exception as e:  # pragma: no cover
        print(f"  [ocr] failed: {e}")
        return ""


def extract_chapter(n: int, use_ocr: bool = False) -> int:
    ch = C.chapter_by_number(n)
    if not ch:
        print(f"No chapter with number {n}. Use --list.")
        return 0
    C.ensure_dirs()
    label = f"{ch['section']}{(' ' + ch['part'] + '.' + str(ch['chapter_number'])) if ch['part'] else ''}"
    print(f"\n{'='*60}\n  Extracting {label} — {ch['name_de']}\n  {C.BASE_URL}{ch['url_path']}\n{'='*60}")

    pages = detect_pages(ch["url_path"])
    print(f"  Found {len(pages)} page(s)")
    written = 0

    for pinfo in pages:
        page = pinfo["page_number"]
        ref = C.page_ref(ch["section"], ch["part"], ch["chapter_number"], page)
        pad = f"{page:03d}"
        subdir = ch["image_subdir"]
        # facsimile
        facs_local = C.PUBLIC_IMG_DIR / subdir / pad / "page.jpg"
        download(pinfo["url"] + "page.jpg", facs_local)
        facsimile = f"/manuscripts/{subdir}/{pad}/page.jpg" if facs_local.exists() else ""

        ocr_text = ocr_image(facs_local) if (use_ocr and facs_local.exists()) else ""

        articles = []
        for num in detect_articles(pinfo["url"]):
            a = extract_article(pinfo["url"], num)
            if not a:
                continue
            # download drawing crops, rewrite to local /manuscripts paths
            for img in a["images"]:
                remote = img.get("url_large") or img.get("url_remote")
                if not remote:
                    continue
                fname = os.path.basename(remote.split("?")[0])
                local = C.PUBLIC_IMG_DIR / subdir / pad / fname
                if download(remote, local):
                    img["url_local"] = f"/manuscripts/{subdir}/{pad}/{fname}"
            # OCR fallback when the archive has no transcription
            if not a["text_de"] and ocr_text:
                a["text_de"] = ocr_text
                a["paragraphs_de"] = [ln for ln in ocr_text.splitlines() if ln.strip()]
                a["ocr"] = True
            pid = C.slug(ref)
            a["id"] = f"{pid}-a{num}"
            a["ref"] = f"{ref} art.{num}"
            articles.append(a)

        page_doc = {
            "section": ch["section"],
            "part": ch["part"],
            "chapter_number": ch["chapter_number"],
            "chapter_name_de": ch["name_de"],
            "page_number": page,
            "page_ref": ref,
            "url": pinfo["url"],
            "facsimile_local": facsimile,
            "ocr_text": ocr_text,
            "articles": articles,
            "total_articles": len(articles),
        }
        out = C.RAW_DIR / C.page_file_name(ch["section"], ch["part"], ch["chapter_number"], page)
        C.write_json(out, page_doc)
        written += 1
        print(f"    {ref}: {len(articles)} article(s), "
              f"{sum(len(x['images']) for x in articles)} image(s)")

    print(f"\n  Done: {written} page(s) → {C.RAW_DIR}")
    return written


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Extract a chapter from the ZPK archive")
    ap.add_argument("--chapter", type=int, help="Chapter number (e.g. 2 for BG I.2)")
    ap.add_argument("--ocr", action="store_true", help="Run Tesseract OCR fallback on facsimiles")
    ap.add_argument("--list", action="store_true", help="List chapters")
    args = ap.parse_args()

    if args.list:
        for s, p, num, de, *_ in C.CHAPTERS:
            print(f"  {num:>2}  {s}{(' ' + p + '.' + str(num)) if p else ''} — {de}")
        sys.exit(0)
    if args.chapter is None:
        ap.error("provide --chapter N (or --list)")
    extract_chapter(args.chapter, use_ocr=args.ocr)
