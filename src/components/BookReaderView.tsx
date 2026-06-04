"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
import type { Book } from "@/lib/types";
import { formatBookText } from "@/lib/util";
import { useI18n } from "@/components/LanguageProvider";

const LANG_BADGE: Record<string, string> = { en: "EN", es: "ES", de: "DE" };

// Case/diacritic-insensitive fold for in-book search.
const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

export default function BookReaderView({ book }: { book: Book }) {
  const { t } = useI18n();
  const search = useSearchParams();
  const initial = Math.max(0, Math.min(book.sections.length - 1, Number(search.get("s") ?? 0) || 0));
  const [active, setActive] = useState(initial);
  const [query, setQuery] = useState("");

  const hasText = book.sections.length > 0;
  const q = query.trim();
  const qf = fold(q);

  // Pre-fold each section's haystack once.
  const folded = useMemo(
    () => book.sections.map((s) => fold(`${s.title}\n${s.text}`)),
    [book.sections]
  );

  const matches = useMemo(() => {
    if (!qf) return book.sections;
    return book.sections.filter((_, i) => folded[i].includes(qf));
  }, [book.sections, folded, qf]);

  // When a search narrows the list and the active section isn't a match,
  // jump to the first match.
  useEffect(() => {
    if (qf && matches.length > 0 && !matches.some((s) => s.index === active)) {
      setActive(matches[0].index);
    }
  }, [qf, matches, active]);

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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          {/* Contents + in-book search */}
          <aside className="lg:sticky lg:top-[88px] lg:h-fit">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("books.inBookSearch")}
              className="mb-2 w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none focus:border-ochre/50"
            />
            <div className="mb-2 flex items-center justify-between">
              <p className="label">{t("books.contents")}</p>
              {q && (
                <span className="font-mono text-[0.62rem] text-parchment-400">
                  {t("books.inBookMatches", { n: matches.length })}
                </span>
              )}
            </div>
            <ol className="max-h-[68vh] space-y-0.5 overflow-y-auto pr-1">
              {matches.map((s) => (
                <li key={s.index}>
                  <button
                    onClick={() => setActive(s.index)}
                    className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      s.index === active
                        ? "bg-ochre/15 text-ochre"
                        : "text-parchment-300 hover:bg-ink-800 hover:text-parchment-50"
                    }`}
                  >
                    <span className="font-mono text-[0.62rem] text-parchment-400">p.{s.page_start}</span>{" "}
                    {s.title}
                  </button>
                </li>
              ))}
              {q && matches.length === 0 && (
                <li className="px-3 py-2 text-sm text-parchment-400">{t("books.inBookNoMatch")}</li>
              )}
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
                <BookSectionText text={section.text} query={q} />
              </>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

// Wrap occurrences of the query in <mark>, diacritic-insensitively.
function highlight(text: string, q: string) {
  if (!q) return text;
  const hay = fold(text);
  const needle = fold(q);
  if (!needle) return text;
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  // fold() preserves length for the chars we care about (lowercasing +
  // stripping combining marks may shift, but for highlight purposes a simple
  // same-length fold is good enough since we don't decompose base letters).
  for (;;) {
    const idx = hay.indexOf(needle, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={k++}>{text.slice(idx, idx + needle.length)}</mark>);
    i = idx + needle.length;
  }
  return parts;
}

function BookSectionText({ text, query }: { text: string; query: string }) {
  const { verse, paragraphs } = formatBookText(text);
  if (paragraphs.length === 0) {
    return <p className="text-sm italic text-parchment-400">—</p>;
  }
  return (
    <div className="ms space-y-4 leading-relaxed text-parchment-100">
      {paragraphs.map((p, i) => (
        <p key={i} className={verse ? "whitespace-pre-line" : undefined}>
          {query ? <Fragment>{highlight(p, query)}</Fragment> : p}
        </p>
      ))}
    </div>
  );
}
