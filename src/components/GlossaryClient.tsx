"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GlossaryEntry } from "@/lib/types";
import { slug } from "@/lib/util";
import { ConceptBarChart } from "@/components/Charts";
import { useI18n } from "@/components/LanguageProvider";

function refToHref(ref: string): { href: string; label: string } {
  const m = ref.match(/^(.*?)\s+art\.(\d+)/);
  if (!m) return { href: "#", label: ref };
  const [, pageRef, art] = m;
  return { href: `/page/${slug(pageRef)}#a${art}`, label: ref };
}

type Sort = "frequency" | "alpha";

export default function GlossaryClient({ glossary }: { glossary: GlossaryEntry[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "core_concept" | "discovered">("all");
  const [sort, setSort] = useState<Sort>("frequency");
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  // Example contexts are fetched lazily per term (the list itself ships without
  // them so the page loads fast).
  const [ctxCache, setCtxCache] = useState<Record<string, { ref: string; context: string }[]>>({});
  const [ctxLoading, setCtxLoading] = useState<string | null>(null);

  const toggleTerm = async (term: string) => {
    if (openTerm === term) {
      setOpenTerm(null);
      return;
    }
    setOpenTerm(term);
    if (!ctxCache[term]) {
      setCtxLoading(term);
      try {
        const r = await fetch(`/api/glossary/contexts?term=${encodeURIComponent(term)}`);
        const j = await r.json();
        setCtxCache((prev) => ({ ...prev, [term]: j.contexts ?? [] }));
      } catch {
        setCtxCache((prev) => ({ ...prev, [term]: [] }));
      } finally {
        setCtxLoading(null);
      }
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = glossary.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (!q) return true;
      return (
        g.term_de.toLowerCase().includes(q) ||
        g.term_en.toLowerCase().includes(q) ||
        g.term_es.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) =>
      sort === "frequency" ? b.frequency - a.frequency : a.term_de.localeCompare(b.term_de)
    );
    return list;
  }, [glossary, query, category, sort]);

  const chartData = useMemo(
    () =>
      glossary
        .filter((g) => g.frequency > 0)
        .slice(0, 15)
        .map((g) => ({
          term: g.term_de,
          count: g.frequency,
          color: g.category === "core_concept" ? "#d8a657" : "#4f8a86",
        })),
    [glossary]
  );

  const selectCls =
    "rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none focus:border-ochre/50";

  const catLabel = (c: string) =>
    c === "core_concept" ? t("glossary.coreConcept") : c === "discovered" ? t("glossary.discovered") : c;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">{t("glossary.kicker")}</p>
        <h1 className="font-display text-4xl text-parchment-50">{t("glossary.title")}</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">{t("glossary.intro")}</p>
      </header>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-parchment-50">{t("glossary.chartTitle")}</h2>
        <p className="mt-1 text-sm text-parchment-400">{t("glossary.chartDesc")}</p>
        <div className="mt-4">
          <ConceptBarChart data={chartData} />
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="label">{t("glossary.filterTerms")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("glossary.filterPlaceholder")}
            className={selectCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t("glossary.category")}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={selectCls}>
            <option value="all">{t("glossary.all")}</option>
            <option value="core_concept">{t("glossary.coreConcept")}</option>
            <option value="discovered">{t("glossary.discovered")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t("glossary.sort")}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectCls}>
            <option value="frequency">{t("glossary.byFrequency")}</option>
            <option value="alpha">{t("glossary.alphabetical")}</option>
          </select>
        </label>
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1.4fr_1.4fr_auto] gap-3 border-b border-ink-700/60 px-5 py-3 text-parchment-300">
          <span className="label">{t("glossary.headerDe")}</span>
          <span className="label">{t("glossary.headerEn")}</span>
          <span className="label">{t("glossary.headerEs")}</span>
          <span className="label text-right">{t("glossary.headerFreq")}</span>
        </div>
        <ul>
          {filtered.map((g) => {
            const open = openTerm === g.term_de;
            return (
              <li key={g.term_de} className="border-b border-ink-700/40 last:border-0">
                <button
                  onClick={() => toggleTerm(g.term_de)}
                  className="grid w-full grid-cols-[1.4fr_1.4fr_1.4fr_auto] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-ink-800/50"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: g.category === "core_concept" ? "#d8a657" : "#4f8a86" }}
                    />
                    <span className="font-serif text-lg text-parchment-50">{g.term_de}</span>
                  </span>
                  <span className="text-sm text-parchment-300">{g.term_en || "—"}</span>
                  <span className="text-sm italic text-parchment-300">{g.term_es || "—"}</span>
                  <span className="text-right font-mono text-sm text-ochre">{g.frequency}</span>
                </button>

                {open && (
                  <div className="bg-ink-900/40 px-5 pb-4 pt-1">
                    <span className="chip">{catLabel(g.category)}</span>
                    {ctxLoading === g.term_de && !ctxCache[g.term_de] ? (
                      <p className="mt-3 text-sm text-parchment-400">…</p>
                    ) : (ctxCache[g.term_de]?.length ?? 0) > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {ctxCache[g.term_de].map((ctx, i) => {
                          const { href, label } = refToHref(ctx.ref);
                          return (
                            <li key={i} className="text-sm">
                              <Link href={href} className="font-mono text-xs text-kleeblue hover:text-ochre">
                                {label}
                              </Link>
                              <p className="ms mt-0.5 text-[0.95rem] text-parchment-300">…{ctx.context}…</p>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-parchment-400">{t("glossary.inSeedDict")}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-5 py-10 text-center text-parchment-400">{t("glossary.noMatch")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
