"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FilterOptions } from "@/lib/data";
import type { Article, Lang } from "@/lib/types";
import { slug } from "@/lib/util";
import { MetaChips } from "@/components/MetaChips";
import {
  complexityLabel,
  contentTypeLabel,
  domainLabel,
  LANG_LABELS,
  tagLabel,
} from "@/lib/labels";

interface Hit {
  article: Article;
  snippets: { lang: Lang; html: string }[];
}

const LANG_COLOR: Record<Lang, string> = { de: "#d8a657", en: "#6f9bb3", es: "#c1632f" };

function Select({
  label,
  value,
  onChange,
  options,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none focus:border-ochre/50"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {render ? render(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SearchClient({ options }: { options: FilterOptions }) {
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

  const hasFilters = domain || complexity || contentType || tag || lang !== "all";

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="panel p-4">
        <div className="flex items-center gap-3">
          <span className="text-parchment-400">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any word in German, English or Spanish…"
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
            <span className="label">Language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang | "all")}
              className="rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none focus:border-ochre/50"
            >
              <option value="all">All languages</option>
              {(["de", "en", "es"] as Lang[]).map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
          <Select label="Domain" value={domain} onChange={setDomain} options={options.domains} render={domainLabel} />
          <Select label="Complexity" value={complexity} onChange={setComplexity} options={options.complexities} render={complexityLabel} />
          <Select label="Content type" value={contentType} onChange={setContentType} options={options.contentTypes} render={contentTypeLabel} />
          <Select label="Semantic tag" value={tag} onChange={setTag} options={options.tags} render={tagLabel} />
        </div>
      </div>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-parchment-400">
          {loading ? "Searching…" : `${hits.length} result${hits.length === 1 ? "" : "s"}`}
          {!q && (hasFilters ? " · filtered" : " · showing all articles")}
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
            Clear filters
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
                      <span
                        className="mt-0.5 font-mono text-[0.62rem] uppercase"
                        style={{ color: LANG_COLOR[s.lang] }}
                      >
                        {s.lang}
                      </span>
                      <p
                        className="ms flex-1 text-[0.98rem]"
                        dangerouslySetInnerHTML={{ __html: s.html }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ms mt-3 line-clamp-2 text-[0.98rem] text-parchment-300">
                  {article.text_de || "— diagram only —"}
                </p>
              )}
            </Link>
          );
        })}

        {!loading && hits.length === 0 && (
          <div className="panel p-10 text-center text-parchment-400">
            <p className="font-display text-xl text-parchment-200">No passages found</p>
            <p className="mt-2 text-sm">Try a different term or clear the filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
