# Proyecto Alexandria-Klee — Study Interface

> *“Hacer habitable el pensamiento visual de Paul Klee.”*

A trilingual (DE / EN / ES) web application for studying Paul Klee's
**Bildnerische Form- und Gestaltungslehre** — the ~3,900 pages of manuscripts
he wrote for his Bauhaus courses (1921–1931), held at the Zentrum Paul Klee, Bern.

This build is the **study interface** that sits on top of the
extraction → translation → enrichment pipeline. It is seeded with the first
chapter extracted end-to-end as proof of concept:
**BG I.2 · *Principielle Ordnung*** (“Principial Order”) — 5 pages, 23 articles,
67 drawings, 60 glossary terms.

---

## Features

- **Browse** the full archive structure (chapter → page → article), exactly like
  the original notebooks. Extracted chapters are readable; the rest map the scope.
- **Read** each page with the **facsimile** of Klee's manuscript beside a
  **trilingual** transcription (German original + English & Spanish), with his
  individual **drawings**, manuscript **footnotes**, and a click-to-enlarge lightbox.
- **Search** full-text across all three languages at once, with highlighted
  snippets and filters by Bauhaus domain, complexity, content type and semantic tag.
- **Glossary** — Klee's vocabulary as a living trilingual lexicon, with a
  frequency chart and the passages where each term appears.
- **Concept map** — a force-directed network showing which of Klee's terms
  recur together across the manuscripts.
- **Tag system** — annotate any article with your own semantic tags and notes
  (stored locally, or synced to MongoDB Atlas when configured).

## Stack

- **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS** · **Recharts**
- **MongoDB Atlas** (optional) via Mongoose — schema from
  `klee-gestaltungslehre-project.md`
- Dark “ink &amp; parchment” theme; Playfair Display / EB Garamond / IBM Plex Sans / JetBrains Mono

## Data model

The app works against a single dataset (`src/data/seed.json`) exposed through
`src/lib/data.ts`. Source resolution:

- **`MONGODB_URI` set** → collections are loaded from MongoDB Atlas.
- **unset** → the bundled seed dataset is used, so the app runs with zero config.

Collections mirror the project schema: `chapters`, `pages`, `articles`,
`glossary`, `stats`, plus `annotations` (the user tag system).

---

## Getting started

```bash
npm install
npm run dev          # → http://localhost:3000   (uses the bundled seed)
```

### Rebuild the seed from the extraction (optional)

Regenerates `src/data/seed.json` and copies the manuscript images into
`public/manuscripts` from the enriched extraction in `../005/klee-gestaltungslehre`:

```bash
npm run build:seed
```

> The translations of the 23 fragments and the EN/ES glossary terms are authored
> in `scripts/build-seed.mjs` (the pipeline had left `[EN]`/`[ES]` placeholders).
> This script **does not** contact the ZPK archive — it only reads local data.

### Use MongoDB Atlas

1. Copy `.env.example` → `.env` and set `MONGODB_URI` (and optionally `MONGODB_DB`).
2. Load the seed into the cluster (creates the indexes from the schema doc):

   ```bash
   npm run seed:mongo
   ```

3. `npm run dev` / deploy — the app now reads from Atlas.

---

## Deploy to Vercel

This is a standard Next.js app and deploys to Vercel with no changes.

```bash
npm i -g vercel
vercel            # link to the HypatiaAIreal account / scope when prompted
vercel --prod
```

In the Vercel project settings add the environment variables (only if you want
Atlas instead of the bundled seed):

| Variable      | Value                                  |
| ------------- | -------------------------------------- |
| `MONGODB_URI` | your Atlas connection string           |
| `MONGODB_DB`  | `klee_gestaltungslehre` (default)      |

The manuscript images ship in `public/manuscripts`, so no external storage or
ZPK access is required at runtime.

---

*Source manuscripts © Zentrum Paul Klee, Bern. This is a private, non-commercial
study archive.*
