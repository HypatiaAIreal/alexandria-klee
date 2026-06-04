import {
  getArticleDomainCounts,
  getChapters,
  getCorpusSummary,
  getDrawingCount,
  getFeaturedPage,
  getStats,
} from "@/lib/data";
import HomeView, { type HomeData } from "@/components/HomeView";

// Cached (ISR): rendered once and reused so navigation is instant; refreshes
// in the background every 10 min. Uses only light counts/aggregates.
export const revalidate = 600;

export default async function HomePage() {
  const [stats, summary, chapters, domain, featuredPage] = await Promise.all([
    getStats(),
    getCorpusSummary(), // counts only
    getChapters(),
    getArticleDomainCounts(), // aggregation, not a full load
    getFeaturedPage(), // one tiny doc
  ]);

  const conceptArr = Object.entries(stats.top_concepts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count, color: "#d8a657" }));

  const ext = chapters.find((c) => c.extracted);

  const data: HomeData = {
    stats: {
      pages: summary.pages,
      articles: domain.total,
      drawings: getDrawingCount(),
      facsimiles: summary.facsimiles,
      glossary: stats.glossary_entries ?? 0,
      words: stats.total_words,
    },
    conceptArr,
    domainData: domain.domains,
    featured: featuredPage,
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
