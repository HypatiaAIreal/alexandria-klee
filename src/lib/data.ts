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
import { unstable_cache } from "next/cache";
import booksSeed from "@/data/books.json";
import type {
  Article,
  Book,
  BookSearchHit,
  Chapter,
  ConceptGraph,
  CorpusStats,
  Diagram,
  EditorialChapter,
  EditorialChapterSummary,
  EditorialPlate,
  GlossaryEntry,
  Lang,
  Page,
  RelatedPassage,
  SeedData,
} from "./types";
import { hasMongo } from "./mongodb";
import { applyImageBase, imageBase, resolveImageSrc, resolveVectorSrc } from "./images";
import { chapterIdOf, slug as _slug } from "./util";
import diagramIndex from "@/data/diagram_index.json";
import vectorIndex from "@/data/vector_index.json";

// image tail → vectorized SVG url (built by 07_vectorize.py)
const VECTOR_MAP = new Map<string, string>(
  Object.entries((vectorIndex as { map?: Record<string, string> }).map ?? {})
);

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

// ── lightweight per-need loaders ─────────────────────────────────
// The full corpus is ~85 MB. Loading + deep-cloning all of it inside a
// serverless function (which `getDataset()` does) is too slow on the free
// Atlas tier and times out the request. So the hot paths query Mongo
// directly for ONLY the documents/fields they need, and fall back to the
// cached dataset only when there's no database (local dev with the seed).
const plainClone = <T,>(v: unknown): T => JSON.parse(JSON.stringify(v ?? null)) as T;

async function models() {
  const { connectMongo } = await import("./mongodb");
  const m = await import("./models");
  await connectMongo();
  return m;
}

function rewritePage<T extends Page>(p: T): T {
  if (!imageBase()) return p;
  p.facsimile_local = resolveImageSrc(p.facsimile_local);
  for (const a of p.articles ?? [])
    for (const img of a.images ?? []) if (img) img.url_local = resolveImageSrc(img.url_local);
  return p;
}

const sortChapters = (chapters: Chapter[]): Chapter[] =>
  [...chapters].sort((a, b) => {
    const order = (c: Chapter) =>
      (c.section === "BF" ? 0 : 1) * 1000 +
      ({ I: 1, II: 2, III: 3, Anhang: 4 }[c.part ?? ""] ?? 0) * 100 +
      c.chapter_number;
    return order(a) - order(b);
  });

// ── normalisation (diacritic-insensitive search) ────────────────
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");

// ── queries ─────────────────────────────────────────────────────
export async function getChapters(): Promise<Chapter[]> {
  if (hasMongo) {
    try {
      const { ChapterModel } = await models();
      const docs = await ChapterModel.find().lean();
      if (docs.length) return sortChapters(plainClone<Chapter[]>(docs));
    } catch (e) {
      console.warn("[data] getChapters Mongo failed:", e);
    }
  }
  const { chapters } = await getDataset();
  return sortChapters(chapters);
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return (await getChapters()).find((c) => c.id === id);
}

// All pages WITHOUT their (heavy) articles — for list/grid views (home,
// browse) that only need page-level metadata.
export async function getPages(): Promise<Page[]> {
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const docs = await PageModel.find().select("-articles").lean();
      if (docs.length)
        return plainClone<Page[]>(docs)
          .map((p) => rewritePage(p))
          .sort((a, b) => a.page_number - b.page_number);
    } catch (e) {
      console.warn("[data] getPages Mongo failed:", e);
    }
  }
  const { pages } = await getDataset();
  return [...pages].sort((a, b) => a.page_number - b.page_number);
}

export async function getPagesByChapter(chapterId: string): Promise<Page[]> {
  const chapter = await getChapter(chapterId);
  if (!chapter) return [];
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      // One chapter's pages, with articles but without the unused search_index.
      const docs = await PageModel.find({
        section: chapter.section,
        chapter_number: chapter.chapter_number,
      })
        .select("-articles.search_index")
        .lean();
      const filtered = plainClone<Page[]>(docs).filter((p) => (p.part ?? "") === (chapter.part ?? ""));
      if (filtered.length || docs.length)
        return filtered.map((p) => rewritePage(p)).sort((a, b) => a.page_number - b.page_number);
    } catch (e) {
      console.warn("[data] getPagesByChapter Mongo failed:", e);
    }
  }
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
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const doc = await PageModel.findOne({ id }).select("-articles.search_index").lean();
      if (doc) return rewritePage(plainClone<Page>(doc));
    } catch (e) {
      console.warn("[data] getPage Mongo failed:", e);
    }
  }
  const { pages } = await getDataset();
  return pages.find((p) => p.id === id);
}

export async function getArticle(id: string): Promise<Article | undefined> {
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      const doc = await ArticleModel.findOne({ id }).select("-search_index").lean();
      if (doc) return plainClone<Article>(doc);
    } catch (e) {
      console.warn("[data] getArticle Mongo failed:", e);
    }
  }
  const articles = await getArticles();
  return articles.find((a) => a.id === id);
}

// All articles WITHOUT search_index — for full-text search.
export async function getArticles(): Promise<Article[]> {
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      const docs = await ArticleModel.find().select("-search_index").lean();
      if (docs.length) return plainClone<Article[]>(docs);
    } catch (e) {
      console.warn("[data] getArticles Mongo failed:", e);
    }
  }
  const { articles } = await getDataset();
  return articles;
}

// Just article metadata (no text) — for the concept graph & filter options,
// which never touch the multilingual body text.
export async function getArticleMetas(): Promise<Pick<Article, "metadata">[]> {
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      const docs = await ArticleModel.find().select("metadata").lean();
      if (docs.length) return plainClone<Pick<Article, "metadata">[]>(docs);
    } catch (e) {
      console.warn("[data] getArticleMetas Mongo failed:", e);
    }
  }
  const { articles } = await getDataset();
  return articles;
}

// Glossary list = TERMS ONLY (no example_contexts) → tiny & cacheable. The
// contexts are fetched on demand when a term is expanded (getGlossaryContexts).
async function computeGlossary(): Promise<GlossaryEntry[]> {
  if (hasMongo) {
    try {
      const { GlossaryModel } = await models();
      const docs = await GlossaryModel.find().select("term_de term_en term_es frequency category").lean();
      if (docs.length)
        return plainClone<GlossaryEntry[]>(docs)
          .map((g) => ({ ...g, example_contexts: g.example_contexts ?? [] }))
          .sort((a, b) => b.frequency - a.frequency);
    } catch (e) {
      console.warn("[data] getGlossary Mongo failed:", e);
    }
  }
  const { glossary } = await getDataset();
  return [...glossary].sort((a, b) => b.frequency - a.frequency);
}
export const getGlossary = unstable_cache(computeGlossary, ["glossary-terms-v1"], { revalidate: 86400 });

// Example contexts for ONE term, fetched lazily when the user expands it.
export async function getGlossaryContexts(term: string): Promise<{ ref: string; context: string }[]> {
  if (!term) return [];
  if (hasMongo) {
    try {
      const { GlossaryModel } = await models();
      const doc = await GlossaryModel.findOne({ term_de: term })
        .select({ example_contexts: { $slice: 6 } })
        .lean<{ example_contexts?: { ref: string; context: string }[] }>();
      return doc?.example_contexts ?? [];
    } catch (e) {
      console.warn("[data] getGlossaryContexts Mongo failed:", e);
    }
  }
  const { glossary } = await getDataset();
  return glossary.find((g) => g.term_de === term)?.example_contexts ?? [];
}

export async function getStats(): Promise<CorpusStats> {
  if (hasMongo) {
    try {
      const { StatsModel } = await models();
      const doc = await StatsModel.findOne().lean();
      if (doc) return plainClone<CorpusStats>(doc);
    } catch (e) {
      console.warn("[data] getStats Mongo failed:", e);
    }
  }
  const { stats } = await getDataset();
  return stats;
}

// ── light summaries (counts/aggregations — never a full corpus load) ──

// Total page count + how many have a facsimile (for the home stat tiles).
export async function getCorpusSummary(): Promise<{ pages: number; facsimiles: number }> {
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const [pages, facsimiles] = await Promise.all([
        PageModel.estimatedDocumentCount(),
        PageModel.countDocuments({ facsimile_local: { $nin: [null, ""] } }),
      ]);
      return { pages, facsimiles };
    } catch (e) {
      console.warn("[data] getCorpusSummary Mongo failed:", e);
    }
  }
  const { pages } = await getDataset();
  return { pages: pages.length, facsimiles: pages.filter((p) => p.facsimile_local).length };
}

// The page with the most articles (home "featured"), fetched as one tiny doc.
export async function getFeaturedPage(): Promise<{ id: string; page_ref: string } | null> {
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const doc = await PageModel.findOne().sort({ total_articles: -1 }).select("id page_ref").lean<{ id?: string; page_ref?: string }>();
      if (doc?.id) return { id: doc.id, page_ref: doc.page_ref ?? "" };
    } catch (e) {
      console.warn("[data] getFeaturedPage Mongo failed:", e);
    }
  }
  const { pages } = await getDataset();
  const f = [...pages].sort((a, b) => b.total_articles - a.total_articles)[0];
  return f ? { id: f.id, page_ref: f.page_ref } : null;
}

// Page count per chapter id (for the browse list) via one aggregation.
export async function getChapterPageCounts(): Promise<Record<string, number>> {
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const agg = (await PageModel.aggregate([
        { $group: { _id: { section: "$section", part: "$part", chapter_number: "$chapter_number" }, count: { $sum: 1 } } },
      ])) as { _id: { section: string; part: string | null; chapter_number: number }; count: number }[];
      const out: Record<string, number> = {};
      for (const r of agg) {
        const id = chapterIdOf(r._id.section, r._id.part ?? null, r._id.chapter_number);
        out[id] = (out[id] ?? 0) + r.count;
      }
      return out;
    } catch (e) {
      console.warn("[data] getChapterPageCounts Mongo failed:", e);
    }
  }
  const { pages } = await getDataset();
  const out: Record<string, number> = {};
  for (const p of pages) {
    const id = chapterIdOf(p.section, p.part, p.chapter_number);
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

// Slim prev/next navigation list for one chapter (page reader) — no article text.
export async function getChapterPageNav(
  chapterId: string
): Promise<{ id: string; page_ref: string; page_number: number }[]> {
  const chapter = await getChapter(chapterId);
  if (!chapter) return [];
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const docs = await PageModel.find({ section: chapter.section, chapter_number: chapter.chapter_number })
        .select("id page_ref page_number part")
        .lean<{ id: string; page_ref: string; page_number: number; part: string | null }[]>();
      return docs
        .filter((p) => (p.part ?? "") === (chapter.part ?? ""))
        .map((p) => ({ id: p.id, page_ref: p.page_ref, page_number: p.page_number }))
        .sort((a, b) => a.page_number - b.page_number);
    } catch (e) {
      console.warn("[data] getChapterPageNav Mongo failed:", e);
    }
  }
  const pages = await getPagesByChapter(chapterId);
  return pages.map((p) => ({ id: p.id, page_ref: p.page_ref, page_number: p.page_number }));
}

// ── filters ─────────────────────────────────────────────────────
export interface FilterOptions {
  domains: string[];
  complexities: string[];
  contentTypes: string[];
  tags: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const order = ["introductory", "intermediate", "advanced"];
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      // distinct() returns only the small set of unique values — no full load.
      const [domains, complexities, contentTypes, tags] = await Promise.all([
        ArticleModel.distinct("metadata.bauhaus_domain"),
        ArticleModel.distinct("metadata.complexity_level"),
        ArticleModel.distinct("metadata.content_type"),
        ArticleModel.distinct("metadata.semantic_tags"),
      ]);
      const clean = (a: unknown[]) =>
        Array.from(new Set(a.filter((x): x is string => typeof x === "string" && x.trim() !== "")));
      return {
        domains: clean(domains).sort(),
        complexities: clean(complexities).sort((a, b) => order.indexOf(a) - order.indexOf(b)),
        contentTypes: clean(contentTypes).sort(),
        tags: clean(tags).sort(),
      };
    } catch (e) {
      console.warn("[data] getFilterOptions Mongo failed:", e);
    }
  }
  const articles = await getArticleMetas();
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

const SEARCH_LIMIT = 120;

function plainExcerpt(text: string): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return escapeHtml(t.slice(0, 180)) + (t.length > 180 ? " …" : "");
}

// Build the per-language highlighted snippets for one matching article.
function buildHit(a: Article, qFold: string, lang: Lang | "all"): SearchHit {
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
  // Word-stem matches (from the text index) may not contain the exact folded
  // substring — show a plain excerpt so the result still has context.
  if (snippets.length === 0) {
    const l: Lang = lang === "all" ? "de" : lang;
    const primary = l === "en" ? a.text_en : l === "es" ? a.text_es : a.text_de;
    snippets.push({ lang: l, html: plainExcerpt(primary || a.text_de || a.text_en || a.text_es) });
  }
  return { article: a, snippets };
}

export async function searchArticles(params: SearchParams): Promise<SearchHit[]> {
  const q = (params.q ?? "").trim();
  const qFold = fold(q);
  const lang = params.lang ?? "all";
  const hasFilters = !!(params.domain || params.complexity || params.contentType || params.tag);

  // Nothing to search → return nothing. (Prevents the page from loading the
  // ENTIRE corpus just to "show all articles", which hung the search page.)
  if (!q && !hasFilters) return [];

  const filterDoc: Record<string, unknown> = {};
  if (params.domain) filterDoc["metadata.bauhaus_domain"] = params.domain;
  if (params.complexity) filterDoc["metadata.complexity_level"] = params.complexity;
  if (params.contentType) filterDoc["metadata.content_type"] = params.contentType;
  if (params.tag) filterDoc["metadata.semantic_tags"] = params.tag;

  // ── Fast path: MongoDB text index returns only matching docs ──
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      if (q) {
        const docs = await ArticleModel.find({ $text: { $search: q }, ...filterDoc })
          .select("-search_index")
          .limit(SEARCH_LIMIT)
          .lean();
        return plainClone<Article[]>(docs).map((a) => buildHit(a, qFold, lang));
      }
      // filters only (no query word) → return the matching subset
      const docs = await ArticleModel.find(filterDoc).select("-search_index").limit(SEARCH_LIMIT).lean();
      return plainClone<Article[]>(docs).map((a) => ({ article: a, snippets: [] }));
    } catch (e) {
      console.warn("[data] text-index search failed, using in-memory:", e);
    }
  }

  // ── Fallback: in-memory scan (no DB, or the text index is missing) ──
  const articles = await getArticles();
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
      if (hits.length >= SEARCH_LIMIT) break;
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
    if (hits.length >= SEARCH_LIMIT) break;
  }
  return hits;
}

// Only the fields the concept graph needs (concepts + domain) — much lighter
// than loading every article's full metadata.
async function getConceptSeeds(): Promise<{ concepts_de: string[]; concepts_en: string[]; bauhaus_domain: string }[]> {
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      const docs = await ArticleModel.find()
        .select("metadata.concepts_de metadata.concepts_en metadata.bauhaus_domain")
        .lean<{ metadata?: { concepts_de?: string[]; concepts_en?: string[]; bauhaus_domain?: string } }[]>();
      if (docs.length)
        return docs.map((d) => ({
          concepts_de: d.metadata?.concepts_de ?? [],
          concepts_en: d.metadata?.concepts_en ?? [],
          bauhaus_domain: d.metadata?.bauhaus_domain ?? "general",
        }));
    } catch (e) {
      console.warn("[data] getConceptSeeds Mongo failed:", e);
    }
  }
  const articles = await getArticleMetas();
  return articles.map((a) => ({
    concepts_de: a.metadata.concepts_de ?? [],
    concepts_en: a.metadata.concepts_en ?? [],
    bauhaus_domain: a.metadata.bauhaus_domain ?? "general",
  }));
}

// ── concept co-occurrence graph ─────────────────────────────────
// Cached: computed once and reused across requests (the corpus is static), so
// the concept map doesn't re-scan every article on every visit.
export const getConceptGraph = unstable_cache(computeConceptGraph, ["concept-graph-v1"], {
  revalidate: 86400,
});

async function computeConceptGraph(minWeight = 1): Promise<ConceptGraph> {
  const articles = await getConceptSeeds();
  const freq = new Map<string, number>();
  const domain = new Map<string, string>();
  const enMap = new Map<string, string>();
  const pairs = new Map<string, number>();

  for (const a of articles) {
    const concepts = a.concepts_de ?? [];
    const enc = a.concepts_en ?? [];
    concepts.forEach((c, i) => {
      freq.set(c, (freq.get(c) ?? 0) + 1);
      if (!domain.has(c)) domain.set(c, a.bauhaus_domain);
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

// Slim page loader for diagram views: only the fields needed to list/curate
// drawings — never the heavy multilingual text or search_index.
const DIAGRAM_PAGE_FIELDS =
  "id page_ref section part chapter_number chapter_name_de page_number facsimile_local " +
  "articles.ref articles.article_number articles.images articles.metadata.bauhaus_domain";

async function loadDiagramPages(filter: Record<string, unknown> = {}): Promise<Page[]> {
  if (hasMongo) {
    try {
      const { PageModel } = await models();
      const docs = await PageModel.find(filter).select(DIAGRAM_PAGE_FIELDS).lean();
      return plainClone<Page[]>(docs).map((p) => rewritePage(p));
    } catch (e) {
      console.warn("[data] loadDiagramPages Mongo failed:", e);
    }
  }
  const { pages } = await getDataset();
  return pages;
}

// Total number of graphic crops (from the prebuilt index) — instant, no DB.
export function getDrawingCount(): number {
  return GRAPHIC_TAILS.size;
}

// Article count + per-domain distribution via a cheap aggregation (no full load).
export async function getArticleDomainCounts(): Promise<{
  total: number;
  domains: { domain: string; count: number }[];
}> {
  if (hasMongo) {
    try {
      const { ArticleModel } = await models();
      const [total, agg] = await Promise.all([
        ArticleModel.estimatedDocumentCount(),
        ArticleModel.aggregate([
          { $group: { _id: { $ifNull: ["$metadata.bauhaus_domain", "general"] }, count: { $sum: 1 } } },
        ]),
      ]);
      const domains = (agg as { _id: string; count: number }[])
        .map((d) => ({ domain: d._id || "general", count: d.count }))
        .sort((a, b) => b.count - a.count);
      return { total, domains };
    } catch (e) {
      console.warn("[data] getArticleDomainCounts Mongo failed:", e);
    }
  }
  const articles = await getArticles();
  const m = new Map<string, number>();
  for (const a of articles) {
    const d = a.metadata.bauhaus_domain || "general";
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return {
    total: articles.length,
    domains: [...m.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
  };
}

// Graphic count per chapter id, derived from the prebuilt diagram index — the
// tail path encodes section/part/chapter (e.g. "/BG/II/05/001/…" or
// "/BF/00/003/…"). No database load at all → instant.
// "/BG/II/05/001/…" or "/BF/00/003/…" → the chapter id (chapterIdOf).
function chapterIdFromTail(tail: string): string | null {
  const seg = tail.split("/").filter(Boolean); // section[/part]/chapter/page/file
  if (seg.length < 3) return null;
  const section = seg[0];
  const part = section === "BF" ? null : seg[1];
  const num = parseInt(section === "BF" ? seg[1] : seg[2], 10);
  if (Number.isNaN(num)) return null;
  return chapterIdOf(section, part, num);
}

let GRAPHIC_CHAPTER_COUNTS: Record<string, number> | null = null;
function graphicCountsByChapter(): Record<string, number> {
  if (GRAPHIC_CHAPTER_COUNTS) return GRAPHIC_CHAPTER_COUNTS;
  const out: Record<string, number> = {};
  for (const tail of GRAPHIC_TAILS) {
    const id = chapterIdFromTail(tail);
    if (id) out[id] = (out[id] ?? 0) + 1;
  }
  GRAPHIC_CHAPTER_COUNTS = out;
  return out;
}

export async function getDiagramChapters(): Promise<DiagramChapter[]> {
  const chapters = await getChapters(); // light (one small collection)
  const counts = graphicCountsByChapter();
  return chapters
    .map((c) => ({
      id: c.id,
      label: `${c.section}${c.part ? ` ${c.part}.${c.chapter_number}` : ""} · ${c.name_de}`,
      count: counts[c.id] ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getDiagrams(opts: {
  chapter?: string;
  page?: string;
  type?: "graphics" | "text" | "all";
  offset?: number;
  limit?: number;
}): Promise<{ total: number; diagrams: Diagram[] }> {
  // Narrow the Mongo query to the requested page/chapter so we never scan the
  // whole corpus. The per-row checks below still refine (e.g. chapter part).
  let filter: Record<string, unknown> = {};
  if (opts.page) {
    filter = { id: opts.page };
  } else if (opts.chapter) {
    const ch = await getChapter(opts.chapter);
    if (ch) filter = { section: ch.section, chapter_number: ch.chapter_number };
  }
  const pages = await loadDiagramPages(filter);
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 60;
  const type = opts.type ?? "graphics";
  const out: Diagram[] = [];
  for (const p of pages) {
    if (!p.section || !p.page_ref) continue;
    const pid = p.id || _slug(p.page_ref);
    if (opts.page && pid !== opts.page) continue;
    const cid = chapterIdOf(p.section, p.part, p.chapter_number);
    if (opts.chapter && cid !== opts.chapter) continue;
    for (const a of p.articles ?? []) {
      for (const img of a.images ?? []) {
        if (!img?.url_local) continue;
        const g = isGraphic(img.url_local);
        if (type === "graphics" && !g) continue;
        if (type === "text" && g) continue;
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
          vector_url: resolveVectorSrc(VECTOR_MAP.get(imageTail(img.url_local))),
        });
      }
    }
  }

  // Merge manually-captured crops (pasted from a page's facsimile). They show
  // first so a freshly-added capture is easy to find. Skipped for type "text".
  if (type !== "text") {
    const manual = await loadManualDiagrams(opts);
    out.unshift(...manual);
  }

  return { total: out.length, diagrams: out.slice(offset, offset + limit) };
}

// User-captured crops stored in Mongo, mapped to Diagram objects.
async function loadManualDiagrams(opts: { chapter?: string; page?: string }): Promise<Diagram[]> {
  if (!hasMongo) return [];
  try {
    const { ManualDiagramModel } = await models();
    const q: Record<string, unknown> = opts.page
      ? { page_id: opts.page }
      : opts.chapter
        ? { chapter_id: opts.chapter }
        : {};
    const docs = await ManualDiagramModel.find(q)
      .select("page_id page_ref chapter_id section part chapter_number chapter_name_de article_number facsimile created_at")
      .sort({ created_at: -1 })
      .lean<
        Array<{
          _id: unknown;
          page_id?: string;
          page_ref?: string;
          chapter_id?: string;
          section?: string;
          part?: string | null;
          chapter_number?: number;
          chapter_name_de?: string;
          article_number?: number;
          facsimile?: string;
        }>
      >();
    return docs.map((d) => {
      const id = String(d._id);
      return {
        image_url: `/api/diagrams/capture-image?id=${id}`,
        facsimile: d.facsimile || "",
        page_id: d.page_id ?? "",
        page_ref: d.page_ref ?? "",
        article_number: d.article_number ?? 0,
        article_ref: `${d.page_ref ?? ""} · ✂`,
        section: d.section ?? "",
        part: d.part ?? null,
        chapter_number: d.chapter_number ?? 0,
        chapter_id: d.chapter_id ?? "",
        chapter_name_de: d.chapter_name_de ?? "",
        domain: "general",
        vector_url: undefined,
      };
    });
  } catch (e) {
    console.warn("[data] loadManualDiagrams failed:", e);
    return [];
  }
}

// ── Editorial export (curated plates per chapter) ───────────────────
// Gathers every diagram marked `correct`, paired with its chosen "plate"
// (explicit plate_url → latest rendition → vector → original) and its note
// + categories + themes. Requires MongoDB (annotations live there).

type DiagramAnnotationDoc = {
  image_url: string;
  status?: string;
  note?: string;
  categories?: string[];
  themes?: string[];
  ai_url?: string;
  plate_url?: string;
};

async function loadCorrectAnnotations(): Promise<Map<string, DiagramAnnotationDoc>> {
  if (!hasMongo) return new Map();
  try {
    const { connectMongo } = await import("./mongodb");
    const { DiagramAnnotationModel } = await import("./models");
    await connectMongo();
    const docs = await DiagramAnnotationModel.find({ status: "correct" }).lean();
    const plain = JSON.parse(JSON.stringify(docs ?? [])) as DiagramAnnotationDoc[];
    const m = new Map<string, DiagramAnnotationDoc>();
    for (const d of plain) if (d.image_url) m.set(d.image_url, d);
    return m;
  } catch (err) {
    console.warn("[data] correct-annotations load failed:", err);
    return new Map();
  }
}

const platePageSort = (a: { page_ref: string; article_number: number }, b: typeof a) =>
  a.page_ref.localeCompare(b.page_ref, undefined, { numeric: true }) ||
  a.article_number - b.article_number;

function resolvePlate(d: Diagram, a: DiagramAnnotationDoc): { plate: string; kind: EditorialPlate["plate_kind"] } {
  if (a.plate_url) return { plate: a.plate_url, kind: "chosen" };
  if (a.ai_url) return { plate: a.ai_url, kind: "ai" };
  if (d.vector_url) return { plate: d.vector_url, kind: "vector" };
  return { plate: d.image_url, kind: "original" };
}

export async function getEditorialChapter(chapterId: string): Promise<EditorialChapter | null> {
  const chapter = await getChapter(chapterId);
  const ann = await loadCorrectAnnotations();
  const { diagrams } = await getDiagrams({ chapter: chapterId, type: "all", limit: 1_000_000 });
  const plates: EditorialPlate[] = [];
  for (const d of diagrams) {
    const a = ann.get(d.image_url);
    if (!a) continue; // only validated ("correct") drawings
    const { plate, kind } = resolvePlate(d, a);
    plates.push({
      image_url: d.image_url,
      plate,
      plate_kind: kind,
      article_ref: d.article_ref,
      page_ref: d.page_ref,
      page_id: d.page_id,
      article_number: d.article_number,
      note: a.note ?? "",
      categories: a.categories ?? [],
      themes: a.themes ?? [],
    });
  }
  plates.sort(platePageSort);
  const label = chapter
    ? `${chapter.section}${chapter.part ? ` ${chapter.part}.${chapter.chapter_number}` : ""} · ${chapter.name_de}`
    : chapterId;
  return {
    id: chapterId,
    label,
    name_de: chapter?.name_de ?? "",
    name_en: chapter?.name_en,
    name_es: chapter?.name_es,
    plates,
  };
}

export async function getEditorialChapters(): Promise<EditorialChapterSummary[]> {
  const ann = await loadCorrectAnnotations();
  if (ann.size === 0) return [];
  const chapters = await getChapters(); // light
  // Derive each validated drawing's chapter from its image path — no page load.
  const counts: Record<string, number> = {};
  for (const a of ann.values()) {
    const id = chapterIdFromTail(imageTail(a.image_url));
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return chapters
    .map((c) => ({
      id: c.id,
      label: `${c.section}${c.part ? ` ${c.part}.${c.chapter_number}` : ""} · ${c.name_de}`,
      count: counts[c.id] ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}
