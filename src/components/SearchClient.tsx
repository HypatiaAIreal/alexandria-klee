"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FilterOptions } from "@/lib/data";
import type { Article, Lang } from "@/lib/types";
import { slug } from "@/lib/util";
import { tagLabel } from "@/lib/labels";
import { MetaChips } from "@/components/MetaChips";
import { useI18n } from "@/components/LanguageProvider";

interface Hit {
  article: Article;
  snippets: { lang: Lang; html: string }[];
}

const LANG_COLOR: Record<Lang, string> = { de: "#d8a657", en: "#6f9bb3", es: "#c1632f" };

export default function SearchClient({ options }: { options: FilterOptions }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<Lang | "all">("all");
  const [domain, setDomain] = useState("");
  const [complexity, setComplexity] = useState("");
  const [contentType, setContentType] = useState("");
  const [tag, setTag] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (lang !== "all") p.set("lang", lang);
    if (domain) p.set("domain", domain);
    if (complexity) p.set("complexity", complexity);
    if (contentType) p.set("contentType", contentType);
    if (tag) p.set("tag", tag);
    return p.toString();
  }, [q, lang, domain, complexity, contentType, tag]);

  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?${params}`)
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(id);
  }, [params]);

  const hasFilters = !!(domain || complexity || contentType || tag) || lang !== "all";
  const selectCls =
    "rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none focus:border-ochre/50";

  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">{t("search.kicker")}</p>
        <h1 className="font-display text-4xl text-parchment-50">{t("search.title")}</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">{t("search.intro")}</p>
      </header>

      <div className="panel p-4">
        <div className="flex items-center gap-3">
          <span className="text-parchment-400">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full bg-transparent py-1 font-serif text-lg text-parchment-50 outline-none placeholder:text-parchment-400/60"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-parchment-400 hover:text-ochre">
              ✕
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-700/60 pt-4 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="label">{t("search.language")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang | "all")} className={selectCls}>
              <option value="all">{t("search.allLanguages")}</option>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">{t("search.domain")}</span>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className={selectCls}>
              <option value="">{t("search.all")}</option>
              {options.domains.map((o) => (
                <option key={o} value={o}>
                  {t(`domains.${o}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">{t("search.complexity")}</span>
            <select value={complexity} onChange={(e) => setComplexity(e.target.value)} className={selectCls}>
              <option value="">{t("search.all")}</option>
              {options.complexities.map((o) => (
                <option key={o} value={o}>
                  {t(`complexity.${o}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">{t("search.contentType")}</span>
            <select value={contentType} onChange={(e) => setContentType(e.target.value)} className={selectCls}>
              <option value="">{t("search.all")}</option>
              {options.contentTypes.map((o) => (
                <option key={o} value={o}>
                  {t(`contentTypes.${o}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">{t("search.tag")}</span>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={selectCls}>
              <option value="">{t("search.all")}</option>
              {options.tags.map((o) => (
                <option key={o} value={o}>
                  {tagLabel(o)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-parchment-400">
          {loading ? t("search.searching") : t("search.results", { count: hits.length })}
          {!q && (hasFilters ? t("search.filtered") : t("search.showingAll"))}
        </p>
        {hasFilters && (
          <button
            onClick={() => {
              setLang("all");
              setDomain("");
              setComplexity("");
              setContentType("");
              setTag("");
            }}
            className="text-sm text-parchment-400 hover:text-ochre"
          >
            {t("search.clearFilters")}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {hits.map(({ article, snippets }) => {
          const href = `/page/${slug(article.page_ref)}#a${article.article_number}`;
          return (
            <Link key={article.id} href={href} className="panel panel-hover block p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm text-ochre">{article.ref}</span>
                <MetaChips metadata={article.metadata} />
              </div>
              {snippets.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {snippets.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-0.5 font-mono text-[0.62rem] uppercase" style={{ color: LANG_COLOR[s.lang] }}>
                        {s.lang}
                      </span>
                      <p className="ms flex-1 text-[0.98rem]" dangerouslySetInnerHTML={{ __html: s.html }} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ms mt-3 line-clamp-2 text-[0.98rem] text-parchment-300">
                  {article.text_de || t("search.diagramOnly")}
                </p>
              )}
            </Link>
          );
        })}

        {!loading && hits.length === 0 && (
          <div className="panel p-10 text-center text-parchment-400">
            <p className="font-display text-xl text-parchment-200">{t("search.noneTitle")}</p>
            <p className="mt-2 text-sm">{t("search.noneBody")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
