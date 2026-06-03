# Alexandria-Klee — Extraction Pipeline

Python scripts that turn the Zentrum Paul Klee *Gestaltungslehre* archive
into the data the web app reads. Each chapter you process is written in the
**same shape as `src/data/seed.json`** and its images into
`public/manuscripts/`, so it appears in the app automatically.

> **No API costs.** Translation uses free Google Translate (via
> `deep-translator`); enrichment and the glossary are pure local keyword /
> frequency analysis.

## Install

```bash
cd alexandria-klee/scripts
python -m venv .venv && . .venv/Scripts/activate   # Windows
# or: source .venv/bin/activate                     # macOS/Linux
pip install -r requirements.txt
```

### OCR (for scanned PDFs)

Scanned books/manuscripts (no text layer) need Tesseract + the language data.

- Windows: install Tesseract (e.g. the UB-Mannheim build); it ships `eng`.
- macOS: `brew install tesseract tesseract-lang`
- Linux: `sudo apt install tesseract-ocr tesseract-ocr-deu`

The ingester auto-detects `tesseract.exe` and a `scripts/tessdata/` folder
(git-ignored). To OCR with `eng+deu`, put `eng.traineddata` + `deu.traineddata`
there (the path may contain spaces, so we set `TESSDATA_PREFIX` rather than
`--tessdata-dir`). To fetch the German model:

```powershell
# from scripts/
mkdir tessdata
copy "C:\Program Files\Tesseract-OCR\tessdata\eng.traineddata" tessdata\
iwr https://github.com/tesseract-ocr/tessdata_fast/raw/main/deu.traineddata -OutFile tessdata\deu.traineddata
```

Then ingest a scanned book:

```bash
python 05_ingest_books.py --ocr --lang eng+deu --file "70856952-5-a-the-Diaries-of-Klee.pdf"
```

OCR-derived books are paginated into "Pages X–Y" sections automatically.

## The phases

| Script | What it does | Input → Output |
| --- | --- | --- |
| `01_extract.py` | Scrape a chapter: facsimiles, article regions, German transcription, drawing crops (optionally OCR). | ZPK → `data/raw/pages/` + `public/manuscripts/` |
| `02_translate.py` | DE → EN / ES with free Google Translate. | `data/raw` → `data/translated` |
| `03_enrich.py` | Classify Bauhaus domain, complexity, content type, concepts, tags + build the search index (local). | `data/translated` → `data/enriched` |
| `04_build_glossary.py` | Frequency analysis → trilingual glossary. | `data/enriched` → `data/glossary.json` |
| `run_pipeline.py` | Run all phases for a chapter, then **assemble** everything into `src/data/seed.json`. | everything → `src/data/seed.json` |
| `06_extract_diagrams.py` | Classify every article crop as graphic (warm parchment facsimile) vs typeset-text (white render); the Diagrams view shows only graphics. | `public/manuscripts` → `src/data/diagram_index.json` |
| `07_vectorize.py` | Make crisp, faithful SVG versions of the graphics with vtracer (local, free). Run per `--image`, `--chapter` or `--all`. | `public/manuscripts` → `public/vectors` + `src/data/vector_index.json` |

OCR/vector deps: `pip install vtracer pillow`. Generated SVGs live in
`public/vectors` (git-ignored; upload to R2 for production, like the
manuscripts). The Diagrams "Review page" modal shows a **Vector** button on
any graphic that has been vectorised. AI image-to-image redraw (per the
"both" option) is planned as an on-demand button once an image model/key is
configured — vtracer is the faithful, zero-cost default.

## Usage

Run a whole chapter end-to-end (chapter numbers: 1–24; `--list` to see them):

```bash
python run_pipeline.py --chapter 2            # BG I.2 "Principielle Ordnung"
python run_pipeline.py --chapter 5 --ocr      # with OCR fallback
python run_pipeline.py --chapter 2 --demo     # offline demo translations
python run_pipeline.py --status               # show what's been processed
python run_pipeline.py --assemble             # rebuild seed.json from data/enriched
```

Or run phases individually:

```bash
python 01_extract.py --chapter 5 --ocr
python 02_translate.py --chapter 5
python 03_enrich.py --chapter 5
python 04_build_glossary.py
python run_pipeline.py --assemble
```

## How extracted chapters reach the app

- **Default (no database):** the app reads `src/data/seed.json`. Assembling is
  all you need — refresh the app.
- **MongoDB Atlas:** push the freshly assembled seed into Atlas:

  ```bash
  python run_pipeline.py --chapter 5 --push-mongo
  # equivalently, afterwards:  npm run seed:mongo
  ```

The orchestrator **merges**: chapters you have not processed keep their
existing data in `seed.json`; only the chapter you run is replaced. The
glossary and corpus statistics are recomputed across the full merged corpus.

## Configuration

- `KLEE_BASE_URL` — override the archive host (default
  `http://www.kleegestaltungslehre.zpk.org`).
- Request pacing (`REQUEST_DELAY`) and the chapter map live in `common.py`.

## Data format (per article)

```jsonc
{
  "id": "bg-i-2-3-a24",
  "page_ref": "BG I.2/3",
  "ref": "BG I.2/3 art.24",
  "article_number": 24,
  "text_de": "…", "paragraphs_de": ["…"], "footnotes_de": ["…"],
  "text_en": "…", "text_es": "…",
  "paragraphs_en": ["…"], "paragraphs_es": ["…"],
  "translation_status": "auto_translated",
  "images": [{ "url_remote": "…", "url_large": "…", "url_local": "/manuscripts/BG/I/02/003/article24_1_large.jpg" }],
  "pdf_url": "/ee/ZPK/BG/2012/01/02/003/article24.pdf",
  "metadata": { "concepts_de": [...], "bauhaus_domain": "dynamics", "complexity_level": "intermediate", "content_type": "theory", "semantic_tags": [...], "has_diagrams": true, "has_mathematical_notation": false },
  "search_index": { "all_words_de": [...], "word_count_de": 65, "unique_words_de": 55, "word_frequencies_de": {...} }
}
```
