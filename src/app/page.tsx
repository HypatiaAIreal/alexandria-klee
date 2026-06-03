import { getArticles, getChapters, getDiagrams, getGlossary, getPages, getStats } from "@/lib/data";
import HomeView, { type HomeData } from "@/components/HomeView";

export default async function HomePage() {
  const [stats, articles, pages, chapters, glossary, diagrams] = await Promise.all([
    getStats(),
    getArticles(),
    getPages(),
    getChapters(),
    getGlossary(),
    getDiagrams({ limit: 1 }),
  ]);

  const articleImages = diagrams.total; // graphic crops only (text renders excluded)
  const facsimiles = pages.filter((p) => p.facsimile_local).length;

  const conceptArr = Object.entries(stats.top_concepts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count, color: "#d8a657" }));

  const domainCounts = new Map<string, number>();
  for (const a of articles) {
    const d = a.metadata.bauhaus_domain || "general";
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const domainData = [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  const ext = chapters.find((c) => c.extracted);
  const featuredPage = [...pages].sort((a, b) => b.total_articles - a.total_articles)[0];

  const data: HomeData = {
    stats: {
      pages: pages.length,
      articles: articles.length,
      drawings: articleImages,
      facsimiles,
      glossary: glossary.length,
      words: stats.total_words,
    },
    conceptArr,
    domainData,
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
