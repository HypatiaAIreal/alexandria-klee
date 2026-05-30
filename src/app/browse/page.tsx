import Link from "next/link";
import { getChapters, getPages } from "@/lib/data";
import type { Chapter } from "@/lib/types";

export const metadata = { title: "Browse the archive" };

const PART_TITLES: Record<string, string> = {
  "BF::": "A · Bildnerische Formlehre",
  "BG:I": "B · Bildnerische Gestaltungslehre — I. Allgemeiner Teil",
  "BG:II": "II. Planimetrische Gestaltung",
  "BG:III": "III. Stereometrische Gestaltung",
  "BG:Anhang": "Anhang",
};

export default async function BrowsePage() {
  const [chapters, pages] = await Promise.all([getChapters(), getPages()]);

  const pageCountFor = (c: Chapter) =>
    pages.filter(
      (p) => p.section === c.section && (p.part ?? "") === (c.part ?? "") && p.chapter_number === c.chapter_number
    ).length;

  // Group by section+part
  const groups = new Map<string, Chapter[]>();
  for (const c of chapters) {
    const key = `${c.section}:${c.part ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <div className="space-y-10">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">The archive</p>
        <h1 className="font-display text-4xl text-parchment-50">Browse by structure</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">
          The complete structure of Klee&rsquo;s teaching corpus. Chapters marked{" "}
          <span className="text-ochre">extracted</span> are available to read now; the rest map the
          full scope the pipeline will cover.
        </p>
      </header>

      {[...groups.entries()].map(([key, chs]) => (
        <section key={key} className="space-y-4">
          <h2 className="font-display text-lg text-parchment-200">
            {PART_TITLES[key] ?? key}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chs.map((c) => {
              const count = pageCountFor(c);
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs text-parchment-400">
                      {c.section}
                      {c.part ? ` ${c.part}.${c.chapter_number}` : ""}
                    </span>
                    {c.extracted ? (
                      <span className="chip border-ochre/40 text-ochre">extracted</span>
                    ) : (
                      <span className="chip text-parchment-400/60">pending</span>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg text-parchment-50">{c.name_de}</h3>
                  <p className="mt-0.5 text-sm text-parchment-300">{c.name_en}</p>
                  <p className="text-sm italic text-parchment-400">{c.name_es}</p>
                  <p className="mt-3 font-mono text-xs text-parchment-400">
                    {c.extracted
                      ? `${count} page${count === 1 ? "" : "s"} · ready`
                      : c.total_pages
                      ? `~${c.total_pages} pages`
                      : "not yet mapped"}
                  </p>
                </>
              );
              return c.extracted ? (
                <Link key={c.id} href={`/browse/${c.id}`} className="panel panel-hover block p-5">
                  {inner}
                </Link>
              ) : (
                <div key={c.id} className="panel p-5 opacity-55">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
