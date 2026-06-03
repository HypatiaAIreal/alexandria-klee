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

// All articles WITHOUT search_index — for search & the concept graph.
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
  const articles = await getArticles();
  return articles;
}

export async function getGlossary(): Promise<GlossaryEntry[]> {
  if (hasMongo) {
    try {
      const { GlossaryModel } = await models();
      const docs = await GlossaryModel.find().lean();
      if (docs.length) return plainClone<GlossaryEntry[]>(docs).sort((a, b) => b.frequency - a.frequency);
    } catch (e) {
      console.warn("[data] getGlossary Mongo failed:", e);
    }
  }
  const { glossary } = await getDataset();
  return [...glossary].sort((a, b) => b.frequency - a.frequency);
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

// ── filters ─────────────────────────────────────────────────────
export interface FilterOptions {
  domains: string[];
  complexities: string[];
  contentTypes: string[];
  tags: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const articles = await getArticles();
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
  const articles = await getArticles();
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
  const articles = await getArticles();
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

// NOTE: iterate over PAGES, not the flat articles array — pipeline-produced
// article docs only carry id/ref, while section/part/page_ref live on pages.
export async function getDiagramChapters(): Promise<DiagramChapter[]> {
  const [pages, chapters] = await Promise.all([loadDiagramPages(), getChapters()]);
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
  return { total: out.length, diagrams: out.slice(offset, offset + limit) };
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
  const { diagrams } = await getDiagrams({ type: "all", limit: 1_000_000 });
  const { chapters } = await getDataset();
  const counts = new Map<string, number>();
  for (const d of diagrams) {
    if (!ann.has(d.image_url)) continue;
    counts.set(d.chapter_id, (counts.get(d.chapter_id) ?? 0) + 1);
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
