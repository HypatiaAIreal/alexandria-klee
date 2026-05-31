"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Book } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";

const LANG_BADGE: Record<string, string> = { en: "EN", es: "ES", de: "DE" };

export default function BookReaderView({ book }: { book: Book }) {
  const { t } = useI18n();
  const search = useSearchParams();
  const initial = Math.max(0, Math.min(book.sections.length - 1, Number(search.get("s") ?? 0) || 0));
  const [active, setActive] = useState(initial);

  const hasText = book.sections.length > 0;
  const section = hasText ? book.sections[active] : null;

  return (
    <div className="space-y-6">
      <nav className="pt-4 text-sm text-parchment-400">
        <Link href="/library" className="link-underline hover:text-ochre">
          {t("books.backToLibrary")}
        </Link>
      </nav>

      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label mb-2">{book.author}</p>
          <h1 className="font-display text-4xl text-parchment-50">{book.title}</h1>
          <p className="mt-2 text-sm text-parchment-300">
            {book.year ? `${book.year} · ` : ""}
            {LANG_BADGE[book.language] ?? book.language.toUpperCase()} ·{" "}
            {t("books.pagesLabel", { count: book.total_pages })}
          </p>
        </div>
        {book.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover}
            alt={book.title}
            className="h-36 w-auto rounded-md border border-ink-700 object-contain"
          />
        )}
      </header>

      {!hasText ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-xl text-parchment-200">{t("books.scanned")}</p>
          <p className="mt-2 font-mono text-xs text-parchment-400">{book.source_file}</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          {/* Contents */}
          <aside className="lg:sticky lg:top-[88px] lg:h-fit">
            <p className="label mb-2">{t("books.contents")}</p>
            <ol className="max-h-[70vh] space-y-0.5 overflow-y-auto pr-1">
              {book.sections.map((s) => (
                <li key={s.index}>
                  <button
                    onClick={() => setActive(s.index)}
                    className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      s.index === active
                        ? "bg-ochre/15 text-ochre"
                        : "text-parchment-300 hover:bg-ink-800 hover:text-parchment-50"
                    }`}
                  >
                    <span className="font-mono text-[0.62rem] text-parchment-400">
                      p.{s.page_start}
                    </span>{" "}
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          {/* Section text */}
          <article className="panel p-6 sm:p-8">
            {section && (
              <>
                <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink-700/60 pb-3">
                  <h2 className="font-display text-2xl text-parchment-50">{section.title}</h2>
                  <span className="font-mono text-xs text-parchment-400">
                    pp. {section.page_start}–{section.page_end}
                  </span>
                </div>
                <div className="ms whitespace-pre-line leading-relaxed text-parchment-100">
                  {section.text}
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
