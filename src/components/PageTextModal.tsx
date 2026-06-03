"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { LANG_NAMES, UI_LANGS, type UILang } from "@/lib/i18n";

type ArticleText = {
  ref: string;
  article_number: number;
  paragraphs_de: string[];
  paragraphs_en: string[];
  paragraphs_es: string[];
  footnotes_de: string[];
};

type PageText = { page_ref: string; chapter_name_de: string; articles: ArticleText[] };

export default function PageTextModal({
  pageId,
  pageRef,
  onClose,
}: {
  pageId: string;
  pageRef: string;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<PageText | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<UILang>(lang);

  useEffect(() => {
    let alive = true;
    fetch(`/api/page-text?page_id=${encodeURIComponent(pageId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData(d.articles ? d : { page_ref: pageRef, chapter_name_de: "", articles: [] });
      })
      .catch(() => alive && setData({ page_ref: pageRef, chapter_name_de: "", articles: [] }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pageId, pageRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const paras = (a: ArticleText): string[] =>
    active === "de" ? a.paragraphs_de : active === "en" ? a.paragraphs_en : a.paragraphs_es;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-ink-950/95 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto my-6 flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header + language tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-ochre">{pageRef}</span>
            {data?.chapter_name_de && (
              <span className="hidden text-xs text-parchment-400 sm:block">{data.chapter_name_de}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-ink-700">
              {UI_LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setActive(l)}
                  title={LANG_NAMES[l]}
                  className={`px-2.5 py-1 text-xs uppercase ${
                    active === l ? "bg-ochre/15 text-ochre" : "text-parchment-300 hover:bg-ink-800"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="rounded-md border border-ink-700 px-3 py-1 text-sm text-parchment-300 hover:border-ochre/50 hover:text-ochre"
            >
              ✕
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="text-sm text-parchment-400">…</p>
          ) : !data || data.articles.length === 0 ? (
            <p className="text-sm text-parchment-400">{t("diagrams.pageText.empty")}</p>
          ) : (
            <div className="space-y-7">
              {data.articles.map((a) => {
                const ps = paras(a).filter((p) => p && p.trim());
                return (
                  <section key={a.ref}>
                    <p className="label mb-2">{a.ref}</p>
                    {ps.length ? (
                      ps.map((p, i) => (
                        <p key={i} className="ms mb-2.5">
                          {p}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm italic text-parchment-500">{t("diagrams.pageText.noText")}</p>
                    )}
                    {active === "de" && a.footnotes_de.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-ink-700/50 pt-2 text-xs text-parchment-400">
                        {a.footnotes_de.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
