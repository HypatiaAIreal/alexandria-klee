import { getArticleDomainCounts, getChapters, getDrawingCount, getPages, getStats } from "@/lib/data";
import HomeView, { type HomeData } from "@/components/HomeView";

// Data-backed (Mongo) → render on demand so the build never touches the DB.
// Uses only light counts/aggregates (never the full corpus) to stay fast.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, pages, chapters, domain] = await Promise.all([
    getStats(),
    getPages(), // slim: page metadata only (no article text)
    getChapters(),
    getArticleDomainCounts(), // aggregation, not a full load
  ]);

  const facsimiles = pages.filter((p) => p.facsimile_local).length;

  const conceptArr = Object.entries(stats.top_concepts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count, color: "#d8a657" }));

  const ext = chapters.find((c) => c.extracted);
  const featuredPage = [...pages].sort((a, b) => b.total_articles - a.total_articles)[0];

  const data: HomeData = {
    stats: {
      pages: pages.length,
      articles: domain.total,
      drawings: getDrawingCount(),
      facsimiles,
      glossary: stats.glossary_entries ?? 0,
      words: stats.total_words,
    },
    conceptArr,
    domainData: domain.domains,
    featured: featuredPage ? { id: featuredPage.id, page_ref: featuredPage.page_ref } : null,
    extracted: ext
      ? {
          id: ext.id,
          label: `${ext.section}${ext.part ? ` ${ext.part}.${ext.chapter_number}` : ""} · ${ext.name_de}`,
        }
      : null,
    pendingCount: chapters.length - 1,
  };

  return <HomeView data={data} />;
}
