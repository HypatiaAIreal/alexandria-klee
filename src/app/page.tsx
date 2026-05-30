import Link from "next/link";
import { getArticles, getChapters, getGlossary, getPages, getStats } from "@/lib/data";
import { ConceptBarChart, DomainDonut, DomainLegend } from "@/components/Charts";
import { domainColor } from "@/lib/labels";

export default async function HomePage() {
  const [stats, articles, pages, chapters, glossary] = await Promise.all([
    getStats(),
    getArticles(),
    getPages(),
    getChapters(),
    getGlossary(),
  ]);

  const articleImages = articles.reduce((n, a) => n + a.images.length, 0);
  const facsimiles = pages.filter((p) => p.facsimile_local).length;

  // Top concepts for the bar chart
  const conceptArr = Object.entries(stats.top_concepts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count, color: "#d8a657" }));

  // Domain distribution
  const domainCounts = new Map<string, number>();
  for (const a of articles) {
    const d = a.metadata.bauhaus_domain || "general";
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const domainData = [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  const extractedChapter = chapters.find((c) => c.extracted);
  const featuredPage = [...pages].sort((a, b) => b.total_articles - a.total_articles)[0];

  const statCards = [
    { value: pages.length, label: "Pages extracted" },
    { value: articles.length, label: "Articles" },
    { value: articleImages, label: "Drawings & diagrams" },
    { value: facsimiles, label: "Facsimiles" },
    { value: glossary.length, label: "Glossary terms" },
    { value: stats.total_words, label: "Words transcribed" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="animate-fade-up pt-6">
        <p className="label mb-4">Proyecto Alexandria-Klee · Zentrum Paul Klee</p>
        <h1 className="max-w-4xl font-display text-4xl leading-[1.1] text-parchment-50 sm:text-6xl">
          Making Paul Klee&rsquo;s visual thinking{" "}
          <span className="text-ochre">habitable.</span>
        </h1>
        <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-parchment-200">
          A trilingual study interface for the <em>Bildnerische Form- und Gestaltungslehre</em> —
          the ~3,900 pages of manuscripts Klee wrote for his Bauhaus courses between 1921 and 1931.
          Read the original German alongside English and Spanish, with the facsimiles of his own
          drawings beside every passage.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/browse"
            className="rounded-md bg-ochre px-5 py-2.5 font-medium text-ink-950 transition-colors hover:bg-amber"
          >
            Browse the archive
          </Link>
          {featuredPage && (
            <Link
              href={`/page/${featuredPage.id}`}
              className="rounded-md border border-ink-700 px-5 py-2.5 text-parchment-100 transition-colors hover:border-ochre/50 hover:text-ochre"
            >
              Begin reading · {featuredPage.page_ref}
            </Link>
          )}
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <div key={s.label} className="panel p-4">
            <div className="font-display text-3xl text-ochre">{s.value.toLocaleString()}</div>
            <div className="label mt-2">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Proof-of-concept note */}
      <section className="panel flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-parchment-50">Proof of concept</h2>
          <p className="mt-1 max-w-2xl text-sm text-parchment-300">
            This build is seeded with the first chapter extracted end-to-end —{" "}
            <strong className="text-parchment-100">
              {extractedChapter ? `${extractedChapter.section} ${extractedChapter.part}.${extractedChapter.chapter_number} · ${extractedChapter.name_de}` : "BG I.2"}
            </strong>{" "}
            (&ldquo;Principial Order&rdquo;) — fully transcribed, translated and enriched. The
            pipeline scales to the remaining {chapters.length - 1} chapters.
          </p>
        </div>
        {extractedChapter && (
          <Link
            href={`/browse/${extractedChapter.id}`}
            className="shrink-0 rounded-md border border-ochre/40 px-4 py-2 text-sm text-ochre transition-colors hover:bg-ochre/10"
          >
            Open chapter →
          </Link>
        )}
      </section>

      {/* Charts */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="panel p-6 lg:col-span-3">
          <h2 className="font-display text-xl text-parchment-50">Most frequent concepts</h2>
          <p className="mt-1 text-sm text-parchment-400">
            How often each of Klee&rsquo;s key terms appears across the extracted corpus.
          </p>
          <div className="mt-4">
            <ConceptBarChart data={conceptArr} />
          </div>
        </div>
        <div className="panel p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-parchment-50">By Bauhaus domain</h2>
          <p className="mt-1 text-sm text-parchment-400">Distribution of articles across teaching domains.</p>
          <div className="mt-4">
            <DomainDonut data={domainData} />
          </div>
          <div className="mt-4 border-t border-ink-700/60 pt-4">
            <DomainLegend data={domainData} />
          </div>
        </div>
      </section>

      {/* Feature links */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/browse", title: "Browse", body: "Navigate chapter → page → article, exactly like the original notebooks." },
          { href: "/search", title: "Search", body: "Full-text search across German, English and Spanish at once." },
          { href: "/glossary", title: "Glossary", body: "Klee's vocabulary as a living, trilingual lexicon with frequencies." },
          { href: "/concepts", title: "Concept map", body: "See which of Klee's terms recur together across the manuscripts." },
        ].map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            className="panel panel-hover group flex flex-col p-5"
            style={{ borderTopColor: domainColor(["form_theory", "dynamics", "lineature", "composition"][i]), borderTopWidth: 2 }}
          >
            <span className="font-display text-lg text-parchment-50 group-hover:text-ochre">{f.title}</span>
            <span className="mt-2 text-sm text-parchment-300">{f.body}</span>
            <span className="mt-4 text-sm text-ochre opacity-0 transition-opacity group-hover:opacity-100">
              Open →
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
