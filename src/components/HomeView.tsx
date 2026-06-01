"use client";

import Link from "next/link";
import { ConceptBarChart, DomainDonut, DomainLegend } from "@/components/Charts";
import { domainColor } from "@/lib/labels";
import { formatNum } from "@/lib/util";
import { useI18n } from "@/components/LanguageProvider";

export interface HomeData {
  stats: { pages: number; articles: number; drawings: number; facsimiles: number; glossary: number; words: number };
  conceptArr: { term: string; count: number; color: string }[];
  domainData: { domain: string; count: number }[];
  featured: { id: string; page_ref: string } | null;
  extracted: { id: string; label: string } | null;
  pendingCount: number;
}

export default function HomeView({ data }: { data: HomeData }) {
  const { t } = useI18n();
  const s = data.stats;

  const statCards = [
    { value: s.pages, key: "home.stats.pages" },
    { value: s.articles, key: "home.stats.articles" },
    { value: s.drawings, key: "home.stats.drawings" },
    { value: s.facsimiles, key: "home.stats.facsimiles" },
    { value: s.glossary, key: "home.stats.glossary" },
    { value: s.words, key: "home.stats.words" },
  ];

  const features = [
    { href: "/browse", titleKey: "nav.browse", bodyKey: "home.features.browse" },
    { href: "/search", titleKey: "nav.search", bodyKey: "home.features.search" },
    { href: "/glossary", titleKey: "nav.glossary", bodyKey: "home.features.glossary" },
    { href: "/concepts", titleKey: "nav.concepts", bodyKey: "home.features.concepts" },
  ];
  const featureAccents = ["form_theory", "dynamics", "lineature", "composition"];

  return (
    <div className="space-y-12">
      <section className="animate-fade-up pt-6">
        <p className="label mb-4">{t("home.kicker")}</p>
        <h1 className="max-w-4xl font-display text-4xl leading-[1.1] text-parchment-50 sm:text-6xl">
          {t("home.heroPre")} <span className="text-ochre">{t("home.heroHighlight")}</span>
        </h1>
        <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-parchment-200">
          {t("home.heroBody")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/browse" className="rounded-md bg-ochre px-5 py-2.5 font-medium text-ink-950 transition-colors hover:bg-amber">
            {t("home.browseCta")}
          </Link>
          {data.featured && (
            <Link
              href={`/page/${data.featured.id}`}
              className="rounded-md border border-ink-700 px-5 py-2.5 text-parchment-100 transition-colors hover:border-ochre/50 hover:text-ochre"
            >
              {t("home.beginReading")} · {data.featured.page_ref}
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((c) => (
          <div key={c.key} className="panel p-4">
            <div className="font-display text-3xl text-ochre">{formatNum(c.value)}</div>
            <div className="label mt-2">{t(c.key)}</div>
          </div>
        ))}
      </section>

      <section className="panel flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-parchment-50">{t("home.poc.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-parchment-300">
            {t("home.poc.body", { chapter: data.extracted?.label ?? "BG I.2", count: data.pendingCount })}
          </p>
        </div>
        {data.extracted && (
          <Link
            href={`/browse/${data.extracted.id}`}
            className="shrink-0 rounded-md border border-ochre/40 px-4 py-2 text-sm text-ochre transition-colors hover:bg-ochre/10"
          >
            {t("home.poc.cta")}
          </Link>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="panel p-6 lg:col-span-3">
          <h2 className="font-display text-xl text-parchment-50">{t("home.concepts.title")}</h2>
          <p className="mt-1 text-sm text-parchment-400">{t("home.concepts.desc")}</p>
          <div className="mt-4">
            <ConceptBarChart data={data.conceptArr} />
          </div>
        </div>
        <div className="panel p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-parchment-50">{t("home.domains.title")}</h2>
          <p className="mt-1 text-sm text-parchment-400">{t("home.domains.desc")}</p>
          <div className="mt-4">
            <DomainDonut data={data.domainData} />
          </div>
          <div className="mt-4 border-t border-ink-700/60 pt-4">
            <DomainLegend data={data.domainData} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            className="panel panel-hover group flex flex-col p-5"
            style={{ borderTopColor: domainColor(featureAccents[i]), borderTopWidth: 2 }}
          >
            <span className="font-display text-lg text-parchment-50 group-hover:text-ochre">{t(f.titleKey)}</span>
            <span className="mt-2 text-sm text-parchment-300">{t(f.bodyKey)}</span>
            <span className="mt-4 text-sm text-ochre opacity-0 transition-opacity group-hover:opacity-100">
              {t("home.features.open")}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
