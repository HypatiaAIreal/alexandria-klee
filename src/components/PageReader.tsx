"use client";

import { useState } from "react";
import type { Article, Lang, Page } from "@/lib/types";
import { MetaChips, TagList } from "@/components/MetaChips";
import Lightbox, { type LightboxImage } from "@/components/Lightbox";
import AnnotationPanel from "@/components/AnnotationPanel";

const ZPK = "http://www.kleegestaltungslehre.zpk.org";

type Mode = Lang | "all";

const LANG_META: Record<Lang, { label: string; color: string }> = {
  de: { label: "Deutsch · original", color: "#d8a657" },
  en: { label: "English", color: "#6f9bb3" },
  es: { label: "Español", color: "#c1632f" },
};

function paras(article: Article, lang: Lang): string[] {
  if (lang === "de") return article.paragraphs_de;
  if (lang === "en") return article.paragraphs_en;
  return article.paragraphs_es;
}

function LangBlock({ article, lang }: { article: Article; lang: Lang }) {
  const meta = LANG_META[lang];
  const p = paras(article, lang).filter(Boolean);
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: `${meta.color}88` }}>
      <div className="label mb-1.5" style={{ color: meta.color }}>
        {meta.label}
      </div>
      {p.length ? (
        <div className="ms space-y-1.5">
          {p.map((para, i) => (
            <p key={i} className={lang === "de" ? "whitespace-pre-line" : ""}>
              {para}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-parchment-400">— diagram only, no transcription —</p>
      )}
    </div>
  );
}

export default function PageReader({ page }: { page: Page }) {
  const [mode, setMode] = useState<Mode>("all");
  const [box, setBox] = useState<LightboxImage | null>(null);

  const modes: { id: Mode; label: string }[] = [
    { id: "all", label: "Trilingual" },
    { id: "de", label: "DE" },
    { id: "en", label: "EN" },
    { id: "es", label: "ES" },
  ];

  return (
    <>
      {/* language mode bar */}
      <div className="sticky top-[57px] z-30 -mx-1 mb-6 flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-900/80 px-3 py-2 backdrop-blur">
        <span className="label hidden sm:block">View</span>
        <div className="flex gap-1">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                mode === m.id
                  ? "bg-ochre/15 text-ochre"
                  : "text-parchment-300 hover:bg-ink-800 hover:text-parchment-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Facsimile column */}
        <div className="lg:sticky lg:top-[120px] lg:h-fit">
          <div className="panel overflow-hidden">
            {page.facsimile_local ? (
              <button
                onClick={() =>
                  setBox({ src: page.facsimile_local, caption: `Facsimile · ${page.page_ref}` })
                }
                className="group block w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.facsimile_local}
                  alt={`Facsimile of ${page.page_ref}`}
                  className="w-full object-contain transition group-hover:opacity-95"
                />
              </button>
            ) : (
              <div className="grid aspect-[3/4] place-items-center text-parchment-400">
                facsimile unavailable
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="font-mono text-xs text-parchment-400">
              Click to enlarge the manuscript
            </span>
            <a
              href={page.url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-xs text-kleeblue hover:text-ochre"
            >
              View on ZPK ↗
            </a>
          </div>
        </div>

        {/* Articles column */}
        <div className="space-y-10">
          {page.articles.map((a) => {
            const hasText =
              a.text_de.trim() || a.text_en.trim() || a.text_es.trim();
            return (
              <article key={a.id} id={`a${a.article_number}`} className="scroll-mt-32">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 pb-3">
                  <h2 className="font-mono text-sm text-ochre">{a.ref}</h2>
                  <MetaChips metadata={a.metadata} />
                </div>

                {/* Transcription */}
                {mode === "all" ? (
                  <div className="space-y-4">
                    {(["de", "en", "es"] as Lang[]).map((l) => (
                      <LangBlock key={l} article={a} lang={l} />
                    ))}
                  </div>
                ) : (
                  <LangBlock article={a} lang={mode} />
                )}

                {/* Footnotes */}
                {a.footnotes_de.length > 0 && (
                  <div className="mt-4 rounded-md bg-ink-900/50 p-3">
                    <div className="label mb-1.5">Manuscript footnotes / corrections</div>
                    <ul className="space-y-0.5 font-serif text-sm text-parchment-300">
                      {a.footnotes_de.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!hasText && a.images.length > 0 && (
                  <p className="mb-2 text-sm italic text-parchment-400">
                    This region of the manuscript is a drawing without running text.
                  </p>
                )}

                {/* Drawings */}
                {a.images.length > 0 && (
                  <div className="mt-4">
                    <div className="label mb-2">Klee&rsquo;s drawings · {a.images.length}</div>
                    <div className="flex flex-wrap gap-3">
                      {a.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            setBox({ src: img.url_local, caption: `${a.ref} · drawing ${i + 1}` })
                          }
                          className="overflow-hidden rounded-md border border-ink-700 bg-parchment-50/5 p-1 transition hover:border-ochre/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url_local}
                            alt={`Drawing ${i + 1} from ${a.ref}`}
                            className="h-28 w-auto object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Semantic tags + concepts */}
                <div className="mt-4 space-y-2">
                  {a.metadata.semantic_tags.length > 0 && (
                    <TagList tags={a.metadata.semantic_tags} />
                  )}
                  {a.pdf_url && (
                    <a
                      href={`${ZPK}${a.pdf_url}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-block font-mono text-xs text-kleeblue hover:text-ochre"
                    >
                      Original article PDF ↗
                    </a>
                  )}
                </div>

                {/* User annotations */}
                <AnnotationPanel articleId={a.id} />
              </article>
            );
          })}
        </div>
      </div>

      <Lightbox image={box} onClose={() => setBox(null)} />
    </>
  );
}
