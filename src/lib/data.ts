// ─────────────────────────────────────────────────────────────
//  Data-access layer. Single source of truth for the UI.
//
//  Source resolution:
//   • If MONGODB_URI is set → load collections from MongoDB Atlas.
//   • Otherwise            → use the bundled seed dataset.
//
//  The full corpus is small, so the dataset is loaded once and cached
//  in memory; all search / filtering / graph logic runs on top of it,
//  giving a single code path regardless of the backing store.
// ─────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import booksSeed from "@/data/books.json";
import type {
  Article,
  Book,
  BookSearchHit,
  Chapter,
  ConceptGraph,
  CorpusStats,
  Diagram,
  GlossaryEntry,
  Lang,
  Page,
  RelatedPassage,
  SeedData,
} from "./types";
import { hasMongo } from "./mongodb";
import { applyImageBase, imageBase } from "./images";
import { chapterIdOf, slug as _slug } from "./util";
import diagramIndex from "@/data/diagram_index.json";

// Set of GRAPHIC image tails (e.g. "/BG/I/02/003/article1_1_large.jpg") —
// the typeset-text crops are excluded. Built by 06_extract_diagrams.py.
const GRAPHIC_TAILS = new Set<string>((diagramIndex as { graphics: string[] }).graphics ?? []);

// Reduce an image URL (local OR R2-rewritten) to its tail for set lookup.
function imageTail(url: string): string {
  if (url.startsWith("/manuscripts/")) return url.slice("/manuscripts".length);
  const base = imageBase();
  if (base && url.startsWith(base)) return url.slice(base.length);
  return url;
}

function isGraphic(url: string): boolean {
  if (GRAPHIC_TAILS.size === 0) return true; // no index → don't filter
  return GRAPHIC_TAILS.has(imageTail(url));
}

// The full corpus (src/data/seed.json) is large and git-ignored, so it is
// NOT statically imported (that would break the Vercel build when absent).
// It is read at runtime as a no-DB fallback; production reads MongoDB Atlas.
let bundledCache: SeedData | null = null;
function bundledSeed(): SeedData {
  if (bundledCache) return bundledCache;
  try {
    const p = path.join(process.cwd(), "src", "data", "seed.json");
    bundledCache = JSON.parse(fs.readFileSync(p, "utf-8")) as SeedData;
  } catch {
    bundledCache = {
      chapters: [],
      pages: [],
      articles: [],
      glossary: [],
      stats: {
        total_files: 0,
        total_articles: 0,
        total_words: 0,
        unique_words: 0,
        top_50_words: {},
        top_concepts: {},
        glossary_entries: 0,
      },
      meta: { project: "Alexandria-Klee", source: "", generated_at: "" },
    };
  }
  return bundledCache;
}

let cachePromise: Promise<SeedData> | null = null;

async function loadFromMongo(): Promise<SeedData> {
  const { connectMongo } = await import("./mongodb");
  const { ChapterModel, PageModel, ArticleModel, GlossaryModel, StatsModel } =
    await import("./models");
  await connectMongo();
  const [chapters, pages, articles, glossary, statsDoc] = await Promise.all([
    ChapterModel.find().lean(),
    PageModel.find().lean(),
    ArticleModel.find().lean(),
    GlossaryModel.find().lean(),
    StatsModel.findOne().lean(),
  ]);
  // Mongo lean() docs carry ObjectId `_id` (a class instance), which Next
  // refuses to pass from Server → Client Components. Round-tripping through
  // JSON flattens every value to a plain, serialisable object/string.
  const plain = <T,>(v: unknown): T => JSON.parse(JSON.stringify(v ?? null)) as T;
  return {
    chapters: plain<Chapter[]>(chapters),
    pages: plain<Page[]>(pages),
    articles: plain<Article[]>(articles),
    glossary: plain<GlossaryEntry[]>(glossary),
    stats: plain<CorpusStats>(statsDoc) ?? bundledSeed().stats,
    meta: bundledSeed().meta,
  };
}

// Single-flight: cache the PROMISE so concurrent callers (e.g. a page's
// Promise.all of getStats/getArticles/…) share one load and never race
// on a shared result object.
export function getDataset(): Promise<SeedData> {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    let data: SeedData;
    if (hasMongo) {
      try {
        const loaded = await loadFromMongo();
        // If Atlas has no content yet, fall back to the bundled seed.
        data = loaded.articles?.length ? loaded : bundledSeed();
      } catch (err) {
        console.warn("[data] Mongo load failed, using bundled seed:", err);
        data = bundledSeed();
      }
    } else {
      data = bundledSeed();
    }
    // Rewrite /manuscripts image paths to R2 when R2_PUBLIC_URL is set.
    return applyImageBase(data);
  })();
  return cachePromise;
}

// ── normalisation (diacritic-insensitive search) ────────────────
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");

// ── queries ─────────────────────────────────────────────────────
export async function getChapters(): Promise<Chapter[]> {
  const { chapters } = await getDataset();
  return [...chapters].sort((a, b) => {
    const order = (c: Chapter) =>
      (c.section === "BF" ? 0 : 1) * 1000 +
      ({ I: 1, II: 2, III: 3, Anhang: 4 }[c.part ?? ""] ?? 0) * 100 +
      c.chapter_number;
    return order(a) - order(b);
  });
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  const { chapters } = await getDataset();
  return chapters.find((c) => c.id === id);
}

export async function getPages(): Promise<Page[]> {
  const { pages } = await getDataset();
  return [...pages].sort((a, b) => a.page_number - b.page_number);
}

export async function getPagesByChapter(chapterId: string): Promise<Page[]> {
  const chapter = await getChapter(chapterId);
  if (!chapter) return [];
  const { pages } = await getDataset();
  return pages
    .filter(
      (p) =>
        p.section === chapter.section &&
        (p.part ?? "") === (chapter.part ?? "") &&
        p.chapter_number === chapter.chapter_number
    )
    .sort((a, b) => a.page_number - b.page_number);
}

export async function getPage(id: string): Promise<Page | undefined> {
  const { pages } = await getDataset();
  return pages.find((p) => p.id === id);
}

export async function getArticle(id: string): Promise<Article | undefined> {
  const { articles } = await getDataset();
  return articles.find((a) => a.id === id);
}

export async function getArticles(): Promise<Article[]> {
  const { articles } = await getDataset();
  return articles;
}

export async function getGlossary(): Promise<GlossaryEntry[]> {
  const { glossary } = await getDataset();
  return [...glossary].sort((a, b) => b.frequency - a.frequency);
}

export async function getStats(): Promise<CorpusStats> {
  const { stats } = await getDataset();
  return stats;
}

// ── filters ─────────────────────────────────────────────────────
export interface FilterOptions {
  domains: string[];
  complexities: string[];
  contentTypes: string[];
  tags: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const { articles } = await getDataset();
  const domains = new Set<string>();
  const complexities = new Set<string>();
  const contentTypes = new Set<string>();
  const tags = new Set<string>();
  for (const a of articles) {
    if (a.metadata.bauhaus_domain) domains.add(a.metadata.bauhaus_domain);
    if (a.metadata.complexity_level) complexities.add(a.metadata.complexity_level);
    if (a.metadata.content_type) contentTypes.add(a.metadata.content_type);
    a.metadata.semantic_tags?.forEach((t) => tags.add(t));
  }
  const order = ["introductory", "intermediate", "advanced"];
  return {
    domains: [...domains].sort(),
    complexities: [...complexities].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    contentTypes: [...contentTypes].sort(),
    tags: [...tags].sort(),
  };
}

export interface SearchParams {
  q?: string;
  lang?: Lang | "all";
  domain?: string;
  complexity?: string;
  contentType?: string;
  tag?: string;
}

export interface SearchHit {
  article: Article;
  snippets: { lang: Lang; html: string }[];
}

function makeSnippet(text: string, qFold: string, lang: Lang): { lang: Lang; html: string } | null {
  if (!text) return null;
  const tFold = fold(text);
  const idx = tFold.indexOf(qFold);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + qFold.length + 90);
  const before = (start > 0 ? "… " : "") + escapeHtml(text.slice(start, idx));
  const match = escapeHtml(text.slice(idx, idx + qFold.length));
  const after = escapeHtml(text.slice(idx + qFold.length, end)) + (end < text.length ? " …" : "");
  return { lang, html: `${before}<mark>${match}</mark>${after}` };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function searchArticles(params: SearchParams): Promise<SearchHit[]> {
  const { articles } = await getDataset();
  const q = (params.q ?? "").trim();
  const qFold = fold(q);
  const lang = params.lang ?? "all";

  const matchesFilters = (a: Article) =>
    (!params.domain || a.metadata.bauhaus_domain === params.domain) &&
    (!params.complexity || a.metadata.complexity_level === params.complexity) &&
    (!params.contentType || a.metadata.content_type === params.contentType) &&
    (!params.tag || a.metadata.semantic_tags?.includes(params.tag));

  const hits: SearchHit[] = [];
  for (const a of articles) {
    if (!matchesFilters(a)) continue;

    if (!q) {
      hits.push({ article: a, snippets: [] });
      continue;
    }

    const snippets: { lang: Lang; html: string }[] = [];
    const fields: [Lang, string][] = [
      ["de", a.text_de],
      ["en", a.text_en],
      ["es", a.text_es],
    ];
    for (const [l, text] of fields) {
      if (lang !== "all" && lang !== l) continue;
      const s = makeSnippet(text, qFold, l);
      if (s) snippets.push(s);
    }
    if (snippets.length) hits.push({ article: a, snippets });
  }
  return hits;
}

// ── concept co-occurrence graph ─────────────────────────────────
export async function getConceptGraph(minWeight = 1): Promise<ConceptGraph> {
  const { articles } = await getDataset();
  const freq = new Map<string, number>();
  const domain = new Map<string, string>();
  const enMap = new Map<string, string>();
  const pairs = new Map<string, number>();

  for (const a of articles) {
    const concepts = a.metadata.concepts_de ?? [];
    const enc = a.metadata.concepts_en ?? [];
    concepts.forEach((c, i) => {
      freq.set(c, (freq.get(c) ?? 0) + 1);
      if (!domain.has(c)) domain.set(c, a.metadata.bauhaus_domain);
      if (enc[i] && !enMap.has(c)) enMap.set(c, enc[i]);
    });
    const uniq = [...new Set(concepts)].sort();
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const key = `${uniq[i]}|||${uniq[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }

  const nodes = [...freq.entries()].map(([term, frequency]) => ({
    term,
    term_en: enMap.get(term) ?? "",
    frequency,
    domain: domain.get(term) ?? "general",
  }));

  const edges = [...pairs.entries()]
    .map(([key, weight]) => {
      const [source, target] = key.split("|||");
      return { source, target, weight };
    })
    .filter((e) => e.weight >= minWeight);

  return { nodes, edges };
}

// ── Books (Klee's own writings) ─────────────────────────────────
let booksPromise: Promise<Book[]> | null = null;

async function loadBooksFromMongo(): Promise<Book[]> {
  const { connectMongo } = await import("./mongodb");
  const { BookModel } = await import("./models");
  await connectMongo();
  const docs = await BookModel.find().lean();
  // Flatten ObjectId/_id so books can cross the Server→Client boundary.
  return JSON.parse(JSON.stringify(docs ?? [])) as Book[];
}

export function getBooks(): Promise<Book[]> {
  if (booksPromise) return booksPromise;
  booksPromise = (async () => {
    if (hasMongo) {
      try {
        const docs = await loadBooksFromMongo();
        if (docs.length) return docs;
      } catch (err) {
        console.warn("[data] Mongo books load failed, using bundled seed:", err);
      }
    }
    return ((booksSeed as { books: Book[] }).books ?? []) as Book[];
  })();
  return booksPromise;
}

export async function getBook(id: string): Promise<Book | undefined> {
  return (await getBooks()).find((b) => b.id === id);
}

function snippetAround(text: string, qFold: string): string {
  const tFold = fold(text);
  const idx = tFold.indexOf(qFold);
  const at = idx === -1 ? 0 : idx;
  const start = Math.max(0, at - 70);
  const end = Math.min(text.length, at + qFold.length + 130);
  const raw = (start > 0 ? "… " : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? " …" : "");
  if (idx === -1) return escapeHtml(raw);
  // re-locate within trimmed snippet for highlight
  const sFold = fold(raw);
  const i = sFold.indexOf(qFold);
  if (i === -1) return escapeHtml(raw);
  return (
    escapeHtml(raw.slice(0, i)) +
    "<mark>" +
    escapeHtml(raw.slice(i, i + qFold.length)) +
    "</mark>" +
    escapeHtml(raw.slice(i + qFold.length))
  );
}

export async function searchBooks(q: string, lang?: string): Promise<BookSearchHit[]> {
  const query = (q ?? "").trim();
  if (!query) return [];
  const qFold = fold(query);
  const books = await getBooks();
  const hits: BookSearchHit[] = [];
  for (const b of books) {
    if (lang && b.language !== lang) continue;
    for (const s of b.sections) {
      if (fold(s.text).includes(qFold) || fold(s.title).includes(qFold)) {
        hits.push({
          book_id: b.id,
          title: b.title,
          author: b.author,
          language: b.language,
          section_index: s.index,
          section_title: s.title,
          snippet: snippetAround(s.text || s.title, qFold),
        });
      }
    }
  }
  return hits.slice(0, 100);
}

export async function getRelatedPassages(terms: string[], limit = 6): Promise<RelatedPassage[]> {
  const cleaned = [...new Set(terms.map((t) => fold(t)).filter((t) => t.length >= 3))];
  if (!cleaned.length) return [];
  const books = await getBooks();
  const scored: RelatedPassage[] = [];
  for (const b of books) {
    for (const s of b.sections) {
      const tFold = fold(s.text);
      let score = 0;
      let best = "";
      for (const term of cleaned) {
        let i = tFold.indexOf(term);
        if (i === -1) continue;
        // count occurrences (cheap)
        let c = 0;
        while (i !== -1) {
          c++;
          i = tFold.indexOf(term, i + term.length);
        }
        score += c;
        if (!best) best = term;
      }
      if (score > 0) {
        scored.push({
          book_id: b.id,
          title: b.title,
          language: b.language,
          section_index: s.index,
          section_title: s.title,
          snippet: snippetAround(s.text, best),
          score,
        });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  // at most 2 passages per book, then take the top `limit`
  const perBook = new Map<string, number>();
  const out: RelatedPassage[] = [];
  for (const p of scored) {
    const n = perBook.get(p.book_id) ?? 0;
    if (n >= 2) continue;
    perBook.set(p.book_id, n + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

// ── Diagrams (individual drawings extracted from manuscript pages) ──
export interface DiagramChapter {
  id: string;
  label: string;
  count: number;
}

// NOTE: iterate over PAGES, not the flat articles array — pipeline-produced
// article docs only carry id/ref, while section/part/page_ref live on pages.
export async function getDiagramChapters(): Promise<DiagramChapter[]> {
  const { pages, chapters } = await getDataset();
  const counts = new Map<string, number>();
  for (const p of pages) {
    if (!p.section) continue;
    let n = 0;
    for (const a of p.articles ?? [])
      for (const img of a.images ?? []) if (img?.url_local && isGraphic(img.url_local)) n++;
    if (!n) continue;
    const cid = chapterIdOf(p.section, p.part, p.chapter_number);
    counts.set(cid, (counts.get(cid) ?? 0) + n);
  }
  const nameOf = (id: string) => chapters.find((c) => c.id === id);
  return [...counts.entries()]
    .map(([id, count]) => {
      const c = nameOf(id);
      const label = c
        ? `${c.section}${c.part ? ` ${c.part}.${c.chapter_number}` : ""} · ${c.name_de}`
        : id;
      return { id, label, count };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getDiagrams(opts: {
  chapter?: string;
  page?: string;
  offset?: number;
  limit?: number;
}): Promise<{ total: number; diagrams: Diagram[] }> {
  const { pages } = await getDataset();
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 60;
  const out: Diagram[] = [];
  for (const p of pages) {
    if (!p.section || !p.page_ref) continue;
    const pid = p.id || _slug(p.page_ref);
    if (opts.page && pid !== opts.page) continue;
    const cid = chapterIdOf(p.section, p.part, p.chapter_number);
    if (opts.chapter && cid !== opts.chapter) continue;
    for (const a of p.articles ?? []) {
      for (const img of a.images ?? []) {
        if (!img?.url_local || !isGraphic(img.url_local)) continue;
        out.push({
          image_url: img.url_local,
          facsimile: p.facsimile_local || "",
          page_id: pid,
          page_ref: p.page_ref,
          article_number: a.article_number,
          article_ref: a.ref || `${p.page_ref} art.${a.article_number}`,
          section: p.section,
          part: p.part,
          chapter_number: p.chapter_number,
          chapter_id: cid,
          chapter_name_de: p.chapter_name_de ?? "",
          domain: a.metadata?.bauhaus_domain ?? "general",
        });
      }
    }
  }
  return { total: out.length, diagrams: out.slice(offset, offset + limit) };
}
