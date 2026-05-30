"use client";

import Link from "next/link";
import type { Chapter } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";

export interface BrowseChapter extends Chapter {
  pageCount: number;
}

export default function BrowseView({ chapters }: { chapters: BrowseChapter[] }) {
  const { t } = useI18n();

  const groups = new Map<string, BrowseChapter[]>();
  for (const c of chapters) {
    const key = `${c.section}:${c.part ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <div className="space-y-10">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">{t("browse.kicker")}</p>
        <h1 className="font-display text-4xl text-parchment-50">{t("browse.title")}</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">{t("browse.intro")}</p>
      </header>

      {[...groups.entries()].map(([key, chs]) => (
        <section key={key} className="space-y-4">
          <h2 className="font-display text-lg text-parchment-200">{t(`browse.parts.${key}`)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chs.map((c) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs text-parchment-400">
                      {c.section}
                      {c.part ? ` ${c.part}.${c.chapter_number}` : ""}
                    </span>
                    {c.extracted ? (
                      <span className="chip border-ochre/40 text-ochre">{t("browse.extracted")}</span>
                    ) : (
                      <span className="chip text-parchment-400/60">{t("browse.pending")}</span>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg text-parchment-50">{c.name_de}</h3>
                  <p className="mt-0.5 text-sm text-parchment-300">{c.name_en}</p>
                  <p className="text-sm italic text-parchment-400">{c.name_es}</p>
                  <p className="mt-3 font-mono text-xs text-parchment-400">
                    {c.extracted
                      ? t("browse.pagesReady", { count: c.pageCount })
                      : c.total_pages
                      ? t("browse.pagesApprox", { count: c.total_pages })
                      : t("browse.notMapped")}
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
