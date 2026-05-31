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
import seed from "@/data/seed.json";
import booksSeed from "@/data/books.json";
import type {
  Article,
  Book,
  BookSearchHit,
  Chapter,
  ConceptGraph,
  CorpusStats,
  GlossaryEntry,
  Lang,
  Page,
  RelatedPassage,
  SeedData,
} from "./types";
import { hasMongo } from "./mongodb";

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
    stats: plain<CorpusStats>(statsDoc) ?? (seed as unknown as SeedData).stats,
    meta: (seed as unknown as SeedData).meta,
  };
}

// Single-flight: cache the PROMISE so concurrent callers (e.g. a page's
// Promise.all of getStats/getArticles/…) share one load and never race
// on a shared result object.
export function getDataset(): Promise<SeedData> {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    if (hasMongo) {
      try {
        const data = await loadFromMongo();
        // If Atlas has no content yet, fall back to the bundled seed.
        return data.articles?.length ? data : (seed as unknown as SeedData);
      } catch (err) {
        console.warn("[data] Mongo load failed, using bundled seed:", err);
        return seed as unknown as SeedData;
      }
    }
    return seed as unknown as SeedData;
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
