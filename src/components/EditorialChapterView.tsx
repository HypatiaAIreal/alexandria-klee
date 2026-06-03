"use client";

import { useState } from "react";
import Link from "next/link";
import type { EditorialChapter } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";
import Lightbox, { type LightboxImage } from "@/components/Lightbox";

export default function EditorialChapterView({ chapter }: { chapter: EditorialChapter }) {
  const { t } = useI18n();
  const [box, setBox] = useState<LightboxImage | null>(null);

  return (
    <div className="px-4 py-6 sm:px-8">
      {/* controls (hidden when printing) */}
      <div className="no-print mx-auto mb-5 flex max-w-4xl items-center justify-between gap-3">
        <Link href="/editorial" className="text-sm text-parchment-300 hover:text-ochre">
          ← {t("editorial.back")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="label">{t("editorial.platesTotal", { n: String(chapter.plates.length) })}</span>
          <button
            onClick={() => window.print()}
            className="rounded-md border border-ochre/50 px-3 py-1.5 text-sm text-ochre hover:bg-ochre/10"
          >
            ⎙ {t("editorial.print")}
          </button>
        </div>
      </div>

      {/* the paper sheet — looks like the printed page on screen too */}
      <article className="print-page mx-auto max-w-4xl rounded-lg bg-white px-8 py-10 text-ink-950 shadow-2xl sm:px-12">
        <header className="mb-8 border-b border-ink-200 pb-4 text-center">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-500">
            Bildnerische Gestaltungslehre · {chapter.id}
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink-950">{chapter.name_de || chapter.label}</h1>
          {chapter.name_es && <p className="mt-1 font-serif text-base italic text-ink-600">{chapter.name_es}</p>}
        </header>

        {chapter.plates.length === 0 ? (
          <p className="py-10 text-center text-ink-500">{t("editorial.emptyChapter")}</p>
        ) : (
          <div className="space-y-10">
            {chapter.plates.map((p, i) => (
              <figure key={p.image_url} className="plate-figure">
                <button
                  onClick={() => setBox({ src: p.plate, caption: p.article_ref })}
                  className="block w-full"
                  title={t("editorial.enlarge")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.plate}
                    alt={p.article_ref}
                    className="mx-auto max-h-[60vh] w-auto max-w-full object-contain"
                  />
                </button>
                <figcaption className="mt-3 border-t border-ink-100 pt-2 text-sm text-ink-700">
                  <span className="font-mono text-[0.7rem] text-ink-500">
                    {t("editorial.plate")} {i + 1} · {p.article_ref}
                  </span>
                  {p.note && <p className="mt-1 font-serif text-[0.95rem] leading-relaxed text-ink-800">{p.note}</p>}
                  {(p.categories?.length || p.themes?.length) ? (
                    <p className="mt-1.5 flex flex-wrap gap-1.5 text-[0.66rem]">
                      {p.categories?.map((c) => (
                        <span key={`c-${c}`} className="rounded-full border border-ochre/50 px-2 py-0.5 text-ochre">
                          {c}
                        </span>
                      ))}
                      {p.themes?.map((th) => (
                        <span key={`t-${th}`} className="rounded-full border border-kleeblue/50 px-2 py-0.5 text-kleeblue">
                          {th}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </article>

      <Lightbox image={box} onClose={() => setBox(null)} />
    </div>
  );
}
