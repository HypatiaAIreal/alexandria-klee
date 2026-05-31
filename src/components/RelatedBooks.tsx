"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RelatedPassage } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";

const LANG_BADGE: Record<string, string> = { en: "EN", es: "ES", de: "DE" };

export default function RelatedBooks({ terms }: { terms: string[] }) {
  const { t } = useI18n();
  const [passages, setPassages] = useState<RelatedPassage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!terms.length) {
      setLoaded(true);
      return;
    }
    fetch(`/api/books/related?terms=${encodeURIComponent(terms.join(","))}`)
      .then((r) => r.json())
      .then((d) => setPassages(d.passages ?? []))
      .catch(() => setPassages([]))
      .finally(() => setLoaded(true));
  }, [terms]);

  if (loaded && passages.length === 0) return null; // stay quiet when nothing echoes

  return (
    <section className="mt-10 border-t border-ink-700/60 pt-6">
      <p className="label mb-1" style={{ color: "#6f9bb3" }}>
        {t("books.related")}
      </p>
      <p className="mb-4 text-sm text-parchment-400">{t("books.relatedIntro")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {passages.map((p, i) => (
          <Link
            key={`${p.book_id}-${p.section_index}-${i}`}
            href={`/library/${p.book_id}?s=${p.section_index}`}
            className="panel panel-hover block p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-kleeblue">{p.title}</span>
              <span className="chip">{LANG_BADGE[p.language] ?? p.language.toUpperCase()}</span>
            </div>
            <p
              className="ms mt-2 text-[0.95rem] text-parchment-200"
              dangerouslySetInnerHTML={{ __html: p.snippet }}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
