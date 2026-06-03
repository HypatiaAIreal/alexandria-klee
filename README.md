# Proyecto Alexandria-Klee

> *"Hacer habitable el pensamiento visual de Paul Klee."*

A trilingual (DE · EN · ES) study system for Paul Klee's **Bildnerische Form-
und Gestaltungslehre** — the ~3,900 manuscript pages he wrote for his Bauhaus
courses (1921–1931), held at the Zentrum Paul Klee, Bern — together with a
library of Klee's own published writings.

It turns the archive into something **habitable**: read the original German next
to English and Spanish, with the facsimiles of Klee's own drawings beside every
passage; search across all three languages at once; explore his vocabulary and
how his concepts recur together; isolate, vectorize and annotate his diagrams;
and cross-reference the teaching manuscripts against his published books.

---

## 1. What's inside (at a glance)

| | |
|---|---|
| **Manuscripts** | 26 chapters · 4,101 pages · 12,691 articles · ~160k words, fully transcribed (DE) + auto-translated (EN/ES) + enriched |
| **Glossary** | 5,332 trilingual terms with frequencies and source passages |
| **Diagrams** | 14,106 of Klee's drawings isolated from the pages, each vectorized to crisp SVG |
| **Library** | 8 of Klee's own books (incl. *The Thinking Eye*, *On Modern Art*, the *Diaries*, *Pedagogical Sketchbook*), full-text |
| **Languages** | German, English, Spanish — both content *and* the entire UI |

---

## 2. Features

- **Browse** the whole archive structure (section → chapter → page → article),
  exactly like Klee's original notebooks. Extracted chapters are readable; the
  rest are mapped.
- **Page reader** — the manuscript **facsimile** beside a **trilingual**
  transcription (German original + English & Spanish), with Klee's individual
  **drawings**, manuscript **footnotes**, semantic tags, and a zoomable lightbox
  (scroll / pinch to zoom, drag to pan).
- **Search** — full-text across DE/EN/ES at once, with highlighted snippets and
  facet filters (Bauhaus domain, complexity, content type, semantic tag).
- **Glossary** — Klee's vocabulary as a living trilingual lexicon: frequency
  chart, categories (core vs discovered), and links to the passages.
- **Concept map** — a force-directed network of which of Klee's terms recur
  together across the corpus.
- **Diagrams** — a gallery of Klee's ~14k drawings lifted out of the pages, with:
  - filters by **Chapter**, **Status**, and **Type** (Diagrams / Text / Both);
  - a **Page Review** modal (the full facsimile + every graphic on that page) to
    **validate** each crop (`correct` / `text only`) and the page
    (`validated` / `missing images`) — human curation instead of fragile CV;
  - a faithful **vector (SVG)** of every graphic, and an **on-demand AI redraw**;
  - per-graphic **annotations** (title, description, tags) for the study/book.
- **Library** — Klee's own writings: book reader (contents + section text),
  cross-book full-text search, and a **cross-reference** panel on every
  manuscript page surfacing related passages from his books.
- **Accounts** — JWT + bcrypt auth with an invite `ACCESS_CODE`; all routes are
  protected; curation/annotation requires sign-in.

---

## 3. Tech stack

- **Next.js 14** (App Router) · **TypeScript** · **React 18**
- **Tailwind CSS** — dark "ink & parchment" theme (Playfair Display / EB
  Garamond / IBM Plex Sans / JetBrains Mono)
- **Recharts** — glossary & domain charts
- **MongoDB Atlas** via **Mongoose** — content + users + annotations
- **jose** (edge-safe JWT) + **bcryptjs** — authentication
- **Cloudflare R2** — manuscript images & vectors in production
- **Python pipeline** — `requests` / `BeautifulSoup` (extraction),
  `deep-translator` (free translation), `PyMuPDF` (books), `pytesseract`
  (OCR), `vtracer` (vectorization)
- Deployed on **Vercel** (HypatiaAIreal)

---

## 4. Architecture

```
                 ┌──────────────────────────────────────────────┐
   ZPK archive   │  Python pipeline (scripts/)                   │
   (zpk.org) ───▶│  01 extract → 02 translate → 03 enrich →      │
                 │  04 glossary → 05 books → 06 diagrams →        │
   Klee PDFs ───▶│  07 vectorize     →  run_pipeline --assemble  │
                 └───────────────┬───────────────┬───────────────┘
                                 │               │
                  src/data/*.json (bundled)   public/manuscripts, /vectors
                  seed · books · indexes         (images → Cloudflare R2)
                                 │               │
                 ┌───────────────▼───────────────▼───────────────┐
   seed:mongo ──▶│  MongoDB Atlas  (klee_gestaltungslehre)        │
                 │  chapters · pages · articles · glossary ·      │
                 │  stats · books · users · diagram_annotations · │
                 │  diagram_pages · diagram_ai_images · annotations│
                 └───────────────┬───────────────────────────────┘
                                 │
                 ┌───────────────▼───────────────────────────────┐
                 │  Next.js app  (src/lib/data.ts = single source) │
                 │  Atlas if MONGODB_URI set, else bundled seed     │
                 │  Server Components → Client views (i18n)         │
                 └─────────────────────────────────────────────────┘
```

### The data layer (`src/lib/data.ts`)
A **single source of truth** for the whole UI. It resolves data from MongoDB
Atlas when `MONGODB_URI` is set, and otherwise from the bundled
`src/data/seed.json` — so the app runs with zero configuration. The full corpus
is loaded once and cached (single-flight promise); all search, filtering, the
concept graph and the diagram index run on top of that in memory. Mongo `lean()`
documents are flattened through `JSON.parse(JSON.stringify(...))` so they cross
the Server→Client boundary cleanly.

### Image resolution (`src/lib/images.ts`)
Manuscript images aren't committed (hundreds of MB). Locally they're served from
`/public/manuscripts`; in production, `R2_PUBLIC_URL` rewrites every
`/manuscripts/…` to the Cloudflare R2 URL. Vector SVGs work the same way via
`R2_VECTORS_URL`.

### Internationalisation (`src/lib/i18n.ts`)
A React-context dictionary (DE/EN/ES) with `{var}` interpolation, persisted in
`localStorage`, default English. Data-fetching stays in Server Components; the
visible chrome lives in client "view" components so every label is translated.

### Authentication (`src/lib/auth.ts`, `users.ts`, `middleware.ts`)
JWT signed with `jose` (edge-safe — used by middleware) + `bcryptjs` password
hashing. `src/middleware.ts` protects every route except `/login`, `/register`
and the auth API. Registration requires `ACCESS_CODE`.

---

## 5. Project layout

```
alexandria-klee/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # home / overview + charts
│   │   ├── browse/                  # chapters → chapter pages
│   │   ├── page/[id]/               # manuscript page reader (facsimile + trilingual)
│   │   ├── search/  glossary/  concepts/
│   │   ├── diagrams/                # diagram gallery + curation
│   │   ├── library/  library/[id]/  # Klee's books + reader
│   │   ├── login/  register/
│   │   └── api/                     # search, stats, glossary, concepts,
│   │       ├── auth/                #   auth (login/register/logout/me)
│   │       ├── books/               #   books search + related
│   │       ├── diagrams/            #   list, annotations, page-status,
│   │       │                        #   ai-redraw, ai-image
│   │       └── annotations/         #   page annotations
│   ├── components/                  # SiteHeader, PageReader, DiagramsView,
│   │                                # PageReviewModal, Lightbox, Charts, …
│   ├── lib/                         # data, models, mongodb, auth, users,
│   │                                # i18n, images, util, labels, types
│   └── data/                        # books.json, diagram_index.json,
│                                    # vector_index.json, seed.json (git-ignored)
├── scripts/                         # the Python pipeline (see README_PIPELINE.md)
├── public/manuscripts/  public/vectors/  public/books/   (assets; large ones → R2)
└── .env.example
```

---

## 6. The extraction pipeline (`scripts/`)

Local, **no API costs**. Full detail in [`scripts/README_PIPELINE.md`](scripts/README_PIPELINE.md).

| Script | Does |
|---|---|
| `01_extract.py` | Scrape a chapter from the ZPK archive: facsimiles, article regions, German transcription, drawing crops (optional OCR). |
| `02_translate.py` | DE → EN / ES with free Google Translate (`deep-translator`), batched. |
| `03_enrich.py` | Classify Bauhaus domain, complexity, content type, concepts, tags + search index (local keyword analysis). |
| `04_build_glossary.py` | Frequency analysis → trilingual glossary. |
| `05_ingest_books.py` | Ingest Klee's PDFs via PyMuPDF (+ Tesseract OCR for scans) → book sections + covers. |
| `06_extract_diagrams.py` | Classify each crop graphic vs typeset-text → `diagram_index.json` (only graphics shown). |
| `07_vectorize.py` | Raster → crisp SVG with `vtracer` (faithful, free) → `vector_index.json`. |
| `run_pipeline.py` | Orchestrate a chapter end-to-end, then **assemble** everything into `seed.json`. |
| `build-seed.mjs` / `seed-mongo.mjs` | Build the bundled seed / load everything into Atlas. |

Chapters accept numbers `1–24`, `BF`, or `Anhang`:
`python scripts/run_pipeline.py --chapter 2`

---

## 7. Getting started (local)

```bash
npm install
npm run dev          # → http://localhost:3000
```

Runs with zero config off the bundled seed. For the full corpus + auth + AI,
point it at Atlas (see env below) and `npm run seed:mongo`.

For the Python pipeline:
```bash
cd scripts && pip install -r requirements.txt
```

---

## 8. Environment variables

Copy `.env.example` → `.env`. All are optional locally (the app degrades
gracefully), but production needs the first four.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection (content, users, annotations). Unset → bundled seed. |
| `MONGODB_DB` | Database name (default `klee_gestaltungslehre`). |
| `AUTH_SECRET` | JWT signing secret — **set a long random string in production**. |
| `ACCESS_CODE` | Invite code to register (default `alexandriaklee2026`). |
| `R2_PUBLIC_URL` | Cloudflare R2 base for `/manuscripts` images in production. |
| `R2_VECTORS_URL` | R2 base for the vector SVGs (after uploading `public/vectors`). |
| `OPENAI_API_KEY` | Enables the on-demand AI diagram redraw (optional, paid). |
| `IMAGE_MODEL` / `IMAGE_SIZE` / `AI_REDRAW_PROMPT` | Tune the AI redraw. |

---

## 9. Diagrams: vector vs AI

Each Klee graphic can carry three forms, all linked to its source page:

- **Original** — the facsimile crop.
- **Vector (◹)** — `vtracer` traces the real strokes into a scalable SVG.
  **Free, local, faithful** (it doesn't reinvent the line). Run
  `python scripts/07_vectorize.py --all`. All 14,106 are done.
- **AI (✦)** — an image model (OpenAI `gpt-image-1`) redraws a clean, idealized
  version on demand. **Paid (~cents/image), reinterprets** — best used
  selectively on validated graphics. Stored in MongoDB so it persists on a
  read-only serverless filesystem (served via `/api/diagrams/ai-image`).

Curation is **human-in-the-loop**: review a page, mark each crop, validate the
page — no fragile machine text/drawing separation.

---

## 10. Deployment (Vercel · HypatiaAIreal)

1. Connect the repo to Vercel under the HypatiaAIreal account (auto-deploys on
   push to `main`).
2. Set the env vars above in Production.
3. Upload the assets to Cloudflare R2 (they're git-ignored):
   - `public/manuscripts` → bucket root → set `R2_PUBLIC_URL`.
   - `public/vectors` → bucket `/vectors` → set `R2_VECTORS_URL`.
4. `npm run seed:mongo` once to load Atlas (re-run after extracting new chapters).

The build never depends on the large `seed.json` (read at runtime as a no-DB
fallback only), so it deploys cleanly even though that file isn't committed.

---

## 11. Status

- **Manuscripts:** complete — all 26 chapters extracted, translated, enriched.
- **Diagrams:** 14,106 isolated and vectorized; curation gestor + AI redraw live.
- **Library:** 8 books, full-text (3 recovered via OCR).
- **i18n / auth / search / glossary / concept map:** complete.
- **Pending (assets):** upload `public/vectors` to R2 for production vector
  display; optionally AI-redraw selected graphics.

---

*Source manuscripts © Zentrum Paul Klee, Bern. Klee's published texts © their
respective publishers. This is a private, non-commercial study archive.*

*Built with love by Hypatia & Carles. 🪶*
