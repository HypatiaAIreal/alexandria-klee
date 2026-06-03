"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Diagram, DiagramAnnotation } from "@/lib/types";
import type { DiagramChapter } from "@/lib/data";
import { useI18n } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import Lightbox, { type LightboxImage } from "@/components/Lightbox";

const LIMIT = 60;

export default function DiagramsView({ chapters }: { chapters: DiagramChapter[] }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [chapter, setChapter] = useState("");
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [box, setBox] = useState<LightboxImage | null>(null);
  const [annos, setAnnos] = useState<Record<string, DiagramAnnotation>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async (chap: string, off: number, replace: boolean) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ offset: String(off), limit: String(LIMIT) });
      if (chap) p.set("chapter", chap);
      const d = await (await fetch(`/api/diagrams?${p}`)).json();
      setTotal(d.total ?? 0);
      setDiagrams((prev) => (replace ? d.diagrams : [...prev, ...(d.diagrams ?? [])]));
    } finally {
      setLoading(false);
    }
  }, []);

  // load annotations once
  useEffect(() => {
    fetch("/api/diagrams/annotations")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, DiagramAnnotation> = {};
        for (const a of d.annotations ?? []) map[a.image_url] = a;
        setAnnos(map);
      })
      .catch(() => {});
  }, []);

  // (re)load when chapter changes
  useEffect(() => {
    setOffset(0);
    load(chapter, 0, true);
  }, [chapter, load]);

  const onSaved = (a: DiagramAnnotation) => {
    setAnnos((m) => ({ ...m, [a.image_url]: a }));
    setEditing(null);
  };

  const hasMore = diagrams.length < total;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">{t("diagrams.kicker")}</p>
        <h1 className="font-display text-4xl text-parchment-50">{t("diagrams.title")}</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">{t("diagrams.intro")}</p>
      </header>

      <div className="panel flex flex-wrap items-end justify-between gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="label">{t("diagrams.chapter")}</span>
          <select
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="min-w-[16rem] rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none focus:border-ochre/50"
          >
            <option value="">{t("diagrams.allChapters")}</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>
        </label>
        <span className="font-mono text-xs text-parchment-400">
          {t("diagrams.showing", { shown: diagrams.length, total })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {diagrams.map((d, i) => {
          const a = annos[d.image_url];
          return (
            <div key={d.image_url + i} className="panel flex flex-col overflow-hidden">
              <button
                onClick={() =>
                  setBox({ src: d.image_url, caption: `${d.article_ref} · ${d.chapter_name_de}` })
                }
                className="group grid aspect-square place-items-center bg-parchment-50/5 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.image_url}
                  alt={a?.title || d.article_ref}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain transition group-hover:scale-[1.03]"
                />
              </button>
              <div className="flex flex-1 flex-col gap-1.5 border-t border-ink-700/60 p-3">
                {a?.title && (
                  <p className="font-display text-sm text-parchment-50">{a.title}</p>
                )}
                {a?.description && (
                  <p className="line-clamp-3 text-xs text-parchment-300">{a.description}</p>
                )}
                {a?.tags && a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.map((tg) => (
                      <span key={tg} className="chip text-parchment-300">
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <Link
                    href={`/page/${d.page_id}#a${d.article_number}`}
                    className="font-mono text-[0.62rem] text-kleeblue hover:text-ochre"
                  >
                    {d.page_ref} {t("diagrams.viewPage")}
                  </Link>
                  {user && (
                    <button
                      onClick={() => setEditing(editing === d.image_url ? null : d.image_url)}
                      className="font-mono text-[0.62rem] text-parchment-400 hover:text-ochre"
                    >
                      {a ? t("diagrams.edit") : t("diagrams.annotate")}
                    </button>
                  )}
                </div>
                {editing === d.image_url && user && (
                  <AnnotationForm diagram={d} existing={a} onSaved={onSaved} onCancel={() => setEditing(null)} />
                )}
                {!user && !a && (
                  <p className="font-mono text-[0.58rem] text-parchment-400/50">
                    {t("diagrams.signInHint")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && <p className="text-center text-sm text-parchment-400">{t("diagrams.loading")}</p>}
      {!loading && diagrams.length === 0 && (
        <div className="panel p-10 text-center text-parchment-400">{t("diagrams.none")}</div>
      )}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => {
              const next = offset + LIMIT;
              setOffset(next);
              load(chapter, next, false);
            }}
            className="rounded-md border border-ink-700 px-5 py-2.5 text-parchment-100 transition-colors hover:border-ochre/50 hover:text-ochre"
          >
            {t("diagrams.loadMore")}
          </button>
        </div>
      )}

      <Lightbox image={box} onClose={() => setBox(null)} />
    </div>
  );
}

function AnnotationForm({
  diagram,
  existing,
  onSaved,
  onCancel,
}: {
  diagram: Diagram;
  existing?: DiagramAnnotation;
  onSaved: (a: DiagramAnnotation) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);

  const field =
    "w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-parchment-100 outline-none focus:border-ochre/50";

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/diagrams/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: diagram.image_url,
          page_ref: diagram.page_ref,
          page_id: diagram.page_id,
          article_number: diagram.article_number,
          title,
          description,
          tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (d.persisted && d.annotation) onSaved(d.annotation);
      else if (r.ok) onSaved({ image_url: diagram.image_url, title, description, tags: tags.split(",").map((s) => s.trim()).filter(Boolean) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border border-ink-700/70 bg-ink-900/60 p-2.5">
      <input className={field} placeholder={t("diagrams.titleField")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={field} placeholder={t("diagrams.descriptionField")} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className={field} placeholder={t("diagrams.tagsField")} value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-md bg-ochre px-3 py-1 text-xs font-medium text-ink-950 hover:bg-amber disabled:opacity-60">
          {busy ? t("diagrams.saving") : t("diagrams.save")}
        </button>
        <button onClick={onCancel} className="rounded-md border border-ink-700 px-3 py-1 text-xs text-parchment-300 hover:text-ochre">
          {t("diagrams.cancel")}
        </button>
      </div>
    </div>
  );
}
