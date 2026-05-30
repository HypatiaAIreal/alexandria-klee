"use client";

import Link from "next/link";
import type { Page } from "@/lib/types";
import PageReader from "@/components/PageReader";
import { useI18n } from "@/components/LanguageProvider";

interface NavRef {
  id: string;
  page_ref: string;
}

export default function PageView({
  page,
  chapter,
  prev,
  next,
}: {
  page: Page;
  chapter: { id: string; name_de: string } | null;
  prev: NavRef | null;
  next: NavRef | null;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <nav className="pt-4 text-sm text-parchment-400">
        <Link href="/browse" className="link-underline hover:text-ochre">
          {t("nav.browse")}
        </Link>
        <span className="mx-2">/</span>
        {chapter && (
          <>
            <Link href={`/browse/${chapter.id}`} className="link-underline hover:text-ochre">
              {chapter.name_de}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-parchment-200">{page.page_ref}</span>
      </nav>

      <header className="animate-fade-up">
        <p className="label mb-2">{page.chapter_name_de}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-4xl text-parchment-50">
            {t("page.pageWord")} <span className="text-ochre">{page.page_number}</span>
          </h1>
          <span className="font-mono text-sm text-parchment-400">{page.page_ref}</span>
        </div>
      </header>

      <PageReader page={page} />

      <nav className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-6">
        {prev ? (
          <Link href={`/page/${prev.id}`} className="panel panel-hover flex-1 p-4 text-left">
            <span className="label">{t("page.prev")}</span>
            <div className="mt-1 font-display text-lg text-parchment-100">{prev.page_ref}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link href={`/page/${next.id}`} className="panel panel-hover flex-1 p-4 text-right">
            <span className="label">{t("page.next")}</span>
            <div className="mt-1 font-display text-lg text-parchment-100">{next.page_ref}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </nav>
    </div>
  );
}
