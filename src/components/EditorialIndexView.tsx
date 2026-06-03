"use client";

import Link from "next/link";
import type { EditorialChapterSummary } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";

export default function EditorialIndexView({ chapters }: { chapters: EditorialChapterSummary[] }) {
  const { t } = useI18n();
  const total = chapters.reduce((n, c) => n + c.count, 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <p className="label">{t("editorial.title")}</p>
      <h1 className="mt-1 font-display text-3xl text-parchment-50">{t("editorial.heading")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-parchment-300">{t("editorial.intro")}</p>

      {chapters.length === 0 ? (
        <div className="mt-8 rounded-xl border border-ink-700/70 bg-ink-850/50 p-8 text-center text-parchment-300">
          {t("editorial.empty")}
        </div>
      ) : (
        <>
          <p className="mt-6 label">{t("editorial.platesTotal", { n: String(total) })}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {chapters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/editorial/${c.id}`}
                  className="panel panel-hover flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-parchment-100">{c.label}</span>
                  <span className="chip border-ochre/40 text-ochre">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
