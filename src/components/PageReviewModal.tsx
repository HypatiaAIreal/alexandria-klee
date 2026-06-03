"use client";

import { useEffect, useState } from "react";
import type { Diagram, DiagramAnnotation, DiagramPageStatus, DiagramStatus } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import Lightbox, { type LightboxImage } from "@/components/Lightbox";
import DiagramRenditions from "@/components/DiagramRenditions";

export default function PageReviewModal({
  pageId,
  pageRef,
  annotations,
  onAnnoSaved,
  onPageSaved,
  onClose,
}: {
  pageId: string;
  pageRef: string;
  annotations: Record<string, DiagramAnnotation>;
  onAnnoSaved: (a: DiagramAnnotation) => void;
  onPageSaved: (p: DiagramPageStatus) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [facsimile, setFacsimile] = useState("");
  const [pageStatus, setPageStatus] = useState<DiagramPageStatus>({ page_id: pageId });
  const [box, setBox] = useState<LightboxImage | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Keep the card's quick-view (✦) pointed at the newest rendition.
  const onLatestChange = (image_url: string, aiUrl: string) => {
    const existing = annotations[image_url] ?? { image_url };
    onAnnoSaved({ ...existing, image_url, ai_url: aiUrl });
  };

  useEffect(() => {
    fetch(`/api/diagrams?page=${encodeURIComponent(pageId)}&type=all&limit=200`)
      .then((r) => r.json())
      .then((d) => {
        setDiagrams(d.diagrams ?? []);
        if (d.diagrams?.[0]?.facsimile) setFacsimile(d.diagrams[0].facsimile);
      });
    fetch(`/api/diagrams/page-status?page_id=${encodeURIComponent(pageId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.pages?.[0]) setPageStatus(d.pages[0]);
      })
      .catch(() => {});
  }, [pageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const setImageStatus = async (d: Diagram, status: DiagramStatus) => {
    const existing = annotations[d.image_url] ?? {};
    const next = status === existing.status ? "" : status; // toggle off
    const body = {
      image_url: d.image_url,
      page_ref: d.page_ref,
      page_id: d.page_id,
      article_number: d.article_number,
      status: next,
      title: existing.title ?? "",
      description: existing.description ?? "",
      tags: existing.tags ?? [],
    };
    const r = await fetch("/api/diagrams/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (r.ok) {
      onAnnoSaved(j.annotation ?? { ...body });
      flash();
    }
  };

  const savePage = async (patch: Partial<DiagramPageStatus>) => {
    const next = { ...pageStatus, ...patch, page_id: pageId, page_ref: pageRef };
    setPageStatus(next);
    const r = await fetch("/api/diagrams/page-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const j = await r.json();
    if (r.ok) {
      onPageSaved(j.page ?? next);
      flash();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink-950/95 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto my-6 flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-ink-700/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-ochre">{pageRef}</span>
            {(() => {
              const correct = diagrams.filter((d) => annotations[d.image_url]?.status === "correct").length;
              const pageType = correct > 0 ? "graphics" : pageStatus.validated ? "text" : null;
              if (!pageType) return null;
              return (
                <span className={`chip ${pageType === "graphics" ? "border-kleeblue/50 text-kleeblue" : "text-parchment-300"}`}>
                  {t(pageType === "graphics" ? "diagrams.review.typeGraphics" : "diagrams.review.typeText")}
                </span>
              );
            })()}
            {pageStatus.validated && (
              <span className="chip border-teal/50 text-teal">✓ {t("diagrams.review.validated")}</span>
            )}
            {savedFlash && <span className="text-xs text-teal">{t("diagrams.review.saved")}</span>}
          </div>
          <button onClick={onClose} className="rounded-md border border-ink-700 px-3 py-1 text-sm text-parchment-300 hover:border-ochre/50 hover:text-ochre">
            ✕
          </button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* facsimile */}
          <div className="lg:sticky lg:top-0 lg:h-fit">
            <p className="label mb-2">{t("diagrams.review.facsimile")}</p>
            {facsimile ? (
              <button onClick={() => setBox({ src: facsimile, caption: pageRef })} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={facsimile} alt={pageRef} className="w-full rounded-md border border-ink-700" />
              </button>
            ) : (
              <div className="grid aspect-[3/4] place-items-center rounded-md border border-ink-700 text-parchment-400">
                —
              </div>
            )}
          </div>

          {/* graphics + page controls */}
          <div className="space-y-4">
            <p className="label">
              {t("diagrams.review.graphicsHere")} · {diagrams.length}
            </p>
            <div className="space-y-3">
              {diagrams.map((d) => {
                const st = annotations[d.image_url]?.status ?? "";
                return (
                  <div key={d.image_url} className="flex gap-3 rounded-lg border border-ink-700/60 bg-ink-850/60 p-2">
                    <button
                      onClick={() => setBox({ src: d.image_url, caption: d.article_ref })}
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.image_url} alt={d.article_ref} className="h-20 w-28 rounded object-contain" />
                    </button>
                    <div className="flex flex-1 flex-col justify-center gap-1.5">
                      <span className="font-mono text-[0.62rem] text-parchment-400">{d.article_ref}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setImageStatus(d, "correct")}
                          className={`rounded-md border px-2 py-1 text-xs ${
                            st === "correct"
                              ? "border-teal bg-teal/20 text-teal"
                              : "border-ink-700 text-parchment-300 hover:border-teal/50"
                          }`}
                        >
                          {t("diagrams.review.statusCorrect")}
                        </button>
                        <button
                          onClick={() => setImageStatus(d, "text_only")}
                          className={`rounded-md border px-2 py-1 text-xs ${
                            st === "text_only"
                              ? "border-rust bg-rust/20 text-rust"
                              : "border-ink-700 text-parchment-300 hover:border-rust/50"
                          }`}
                        >
                          {t("diagrams.review.statusText")}
                        </button>
                        {d.vector_url && (
                          <button
                            onClick={() => setBox({ src: d.vector_url!, caption: `${d.article_ref} · ${t("diagrams.review.vector")}` })}
                            className="rounded-md border border-kleeblue/50 px-2 py-1 text-xs text-kleeblue hover:bg-kleeblue/10"
                          >
                            ◹ {t("diagrams.review.vector")}
                          </button>
                        )}
                        {annotations[d.image_url]?.ai_url && (
                          <button
                            onClick={() => setBox({ src: annotations[d.image_url]!.ai_url!, caption: `${d.article_ref} · AI` })}
                            className="rounded-md border border-amber/50 px-2 py-1 text-xs text-amber hover:bg-amber/10"
                          >
                            ✦ {t("diagrams.review.aiView")}
                          </button>
                        )}
                      </div>
                      <DiagramRenditions
                        diagram={d}
                        canEdit={!!user}
                        onView={setBox}
                        onLatestChange={onLatestChange}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* page-level controls */}
            <div className="space-y-2 rounded-lg border border-ink-700/70 bg-ink-900/60 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-parchment-200">
                <input
                  type="checkbox"
                  checked={!!pageStatus.missing_images}
                  onChange={(e) => savePage({ missing_images: e.target.checked })}
                  className="accent-rust"
                />
                {t("diagrams.review.missingImages")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-parchment-200">
                <input
                  type="checkbox"
                  checked={!!pageStatus.validated}
                  onChange={(e) => savePage({ validated: e.target.checked })}
                  className="accent-teal"
                />
                {t("diagrams.review.validatePage")}
              </label>
            </div>
          </div>
        </div>
      </div>

      <Lightbox image={box} onClose={() => setBox(null)} />
    </div>
  );
}
