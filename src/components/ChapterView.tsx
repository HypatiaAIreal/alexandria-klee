"use client";

import Link from "next/link";
import type { Chapter, Page } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";

export default function ChapterView({ chapter, pages }: { chapter: Chapter; pages: Page[] }) {
  const { t } = useI18n();
  const totalArticles = pages.reduce((n, p) => n + p.total_articles, 0);

  return (
    <div className="space-y-8">
      <nav className="pt-4 text-sm text-parchment-400">
        <Link href="/browse" className="link-underline hover:text-ochre">
          {t("nav.browse")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-parchment-200">
          {chapter.section}
          {chapter.part ? ` ${chapter.part}.${chapter.chapter_number}` : ""}
        </span>
      </nav>

      <header className="animate-fade-up">
        <p className="label mb-2">
          {chapter.section}
          {chapter.part ? ` · ${t("chapter.part")} ${chapter.part} · ${t("chapter.chapterWord")} ${chapter.chapter_number}` : ""}
        </p>
        <h1 className="font-display text-4xl text-parchment-50">{chapter.name_de}</h1>
        <p className="mt-2 text-lg text-parchment-300">
          {chapter.name_en} · <span className="italic">{chapter.name_es}</span>
        </p>
        <p className="mt-4 font-mono text-xs text-parchment-400">
          {t("chapter.pagesArticles", { pages: pages.length, articles: totalArticles })}
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const concepts = [...new Set(page.articles.flatMap((a) => a.metadata.concepts_de))].slice(0, 6);
          return (
            <Link key={page.id} href={`/page/${page.id}`} className="panel panel-hover group overflow-hidden">
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-900">
                {page.facsimile_local ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.facsimile_local}
                    alt={`Facsimile of ${page.page_ref}`}
                    className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-parchment-400">—</div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent p-3">
                  <span className="font-mono text-xs text-ochre">{page.page_ref}</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-parchment-300">{t("chapter.articles", { count: page.total_articles })}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {concepts.map((c) => (
                    <span key={c} className="chip text-parchment-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
