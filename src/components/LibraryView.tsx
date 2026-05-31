"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  year: number | null;
  language: string;
  total_pages: number;
  total_sections: number;
  needs_ocr: boolean;
  cover: string;
}

interface Hit {
  book_id: string;
  title: string;
  language: string;
  section_index: number;
  section_title: string;
  snippet: string;
}

const LANG_BADGE: Record<string, string> = { en: "EN", es: "ES", de: "DE" };

export default function LibraryView({ books }: { books: BookMeta[] }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const id = setTimeout(() => {
      setLoading(true);
      fetch(`/api/books/search?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  const searching = q.trim().length > 0;
  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    [books]
  );

  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">{t("books.kicker")}</p>
        <h1 className="font-display text-4xl text-parchment-50">{t("books.title")}</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">{t("books.intro")}</p>
      </header>

      <div className="panel flex items-center gap-3 p-4">
        <span className="text-parchment-400">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("books.searchPlaceholder")}
          className="w-full bg-transparent py-1 font-serif text-lg text-parchment-50 outline-none placeholder:text-parchment-400/60"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-parchment-400 hover:text-ochre">
            ✕
          </button>
        )}
      </div>

      {searching ? (
        <div className="space-y-3">
          <p className="text-sm text-parchment-400">
            {loading ? "…" : t("books.results", { count: hits.length })}
          </p>
          {hits.map((h, i) => (
            <Link
              key={`${h.book_id}-${h.section_index}-${i}`}
              href={`/library/${h.book_id}?s=${h.section_index}`}
              className="panel panel-hover block p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-ochre">{h.title}</span>
                <span className="chip">{h.section_title}</span>
              </div>
              <p
                className="ms mt-2 text-[0.98rem] text-parchment-200"
                dangerouslySetInnerHTML={{ __html: h.snippet }}
              />
            </Link>
          ))}
          {!loading && hits.length === 0 && (
            <div className="panel p-10 text-center text-parchment-400">{t("books.noResults")}</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sortedBooks.map((b) => (
            <Link key={b.id} href={`/library/${b.id}`} className="panel panel-hover group overflow-hidden">
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-900">
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.cover}
                    alt={b.title}
                    className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                ) : (
                  <div className="grid h-full place-items-center p-3 text-center font-display text-parchment-300">
                    {b.title}
                  </div>
                )}
                <span className="absolute right-2 top-2 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[0.6rem] text-parchment-200">
                  {LANG_BADGE[b.language] ?? b.language.toUpperCase()}
                </span>
              </div>
              <div className="p-3">
                <h3 className="font-display text-base leading-snug text-parchment-50 group-hover:text-ochre">
                  {b.title}
                </h3>
                <p className="mt-1 text-xs text-parchment-400">
                  {b.author}
                  {b.year ? ` · ${b.year}` : ""}
                </p>
                <p className="mt-2 font-mono text-[0.62rem] text-parchment-400">
                  {b.needs_ocr
                    ? t("books.scanned")
                    : `${t("books.pagesLabel", { count: b.total_pages })} · ${t("books.sectionsLabel", { count: b.total_sections })}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
