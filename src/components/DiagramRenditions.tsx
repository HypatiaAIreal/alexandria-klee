"use client";

import { useRef, useState } from "react";
import type { Diagram } from "@/lib/types";
import type { LightboxImage } from "@/components/Lightbox";
import { useI18n } from "@/components/LanguageProvider";

export type Rendition = {
  id: string;
  kind: "ai" | "upload";
  prompt: string;
  label: string;
  model?: string;
  created_by: string;
  created_at: string | null;
  url: string;
};

type ModelOption = { id: string; label: string; provider: string; note?: string };

// Fetch & download a same/cross-origin image as a file.
async function downloadImage(url: string, name: string) {
  const ext = (type: string) =>
    type.includes("svg") ? ".svg" : type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = name.replace(/[^\w.-]+/g, "_") + ext(blob.type);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch {
    window.open(url, "_blank");
  }
}

/**
 * Version manager for a single diagram: AI redraws (with an optional custom
 * instruction), external uploads, and a gallery of every stored version.
 * Renditions persist in MongoDB so they survive serverless restarts.
 */
export default function DiagramRenditions({
  diagram,
  canEdit,
  onView,
  onLatestChange,
}: {
  diagram: Diagram;
  canEdit: boolean;
  onView: (img: LightboxImage) => void;
  onLatestChange?: (image_url: string, aiUrl: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Rendition[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"ai" | "upload" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoaded(true);
    try {
      const [r, m] = await Promise.all([
        fetch(`/api/diagrams/renditions?image_url=${encodeURIComponent(diagram.image_url)}`),
        fetch("/api/diagrams/models"),
      ]);
      const j = await r.json();
      setItems(j.renditions ?? []);
      const mj = await m.json();
      const list: ModelOption[] = mj.models ?? [];
      setModels(list);
      if (list[0]) setModel((prev) => prev || list[0].id);
    } catch {
      setItems([]);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  const errText = (code: string) =>
    code === "no_model"
      ? t("diagrams.review.aiNoModel")
      : code === "too_large"
        ? t("diagrams.versions.tooLarge")
        : t("diagrams.review.aiError");

  const afterCreate = (rend: Rendition) => {
    setItems((prev) => [rend, ...prev]);
    onLatestChange?.(diagram.image_url, rend.url);
    onView({ src: rend.url, caption: `${diagram.article_ref} · ${rend.kind === "ai" ? "AI" : t("diagrams.versions.upload")}` });
  };

  const generate = async () => {
    setErr(null);
    setBusy("ai");
    try {
      const r = await fetch("/api/diagrams/renditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: diagram.image_url, prompt: prompt.trim(), model }),
      });
      const j = await r.json();
      if (r.ok && j.rendition) {
        afterCreate(j.rendition);
        setPrompt("");
      } else setErr(errText(j.error));
    } catch {
      setErr(t("diagrams.review.aiError"));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File) => {
    setErr(null);
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("image_url", diagram.image_url);
      fd.append("file", file);
      if (prompt.trim()) fd.append("label", prompt.trim());
      const r = await fetch("/api/diagrams/renditions", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.rendition) {
        afterCreate(j.rendition);
        setPrompt("");
      } else setErr(errText(j.error));
    } catch {
      setErr(t("diagrams.review.aiError"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/diagrams/renditions?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        onLatestChange?.(diagram.image_url, next[0]?.url ?? "");
        return next;
      });
    }
  };

  return (
    <div className="mt-1.5">
      <button
        onClick={toggle}
        className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-300 hover:border-amber/50 hover:text-amber"
      >
        ✦ {t("diagrams.versions.manage")}
        {items.length > 0 && <span className="ml-1 text-parchment-400">({items.length})</span>}
        <span className="ml-1">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-ink-700/70 bg-ink-900/70 p-3">
          {canEdit ? (
            <>
              {models.length > 0 && (
                <label className="flex items-center gap-2 text-[0.62rem] text-parchment-400">
                  <span className="shrink-0">{t("diagrams.versions.model")}</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-parchment-100 focus:border-amber/50 focus:outline-none"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.note ? ` — ${m.note}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("diagrams.versions.promptPlaceholder")}
                rows={2}
                className="w-full resize-y rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-parchment-100 placeholder:text-parchment-500 focus:border-amber/50 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={generate}
                  disabled={busy !== null || models.length === 0}
                  title={models.length === 0 ? t("diagrams.review.aiNoModel") : undefined}
                  className="rounded-md border border-amber/50 px-2.5 py-1 text-xs text-amber hover:bg-amber/10 disabled:opacity-50"
                >
                  {busy === "ai" ? t("diagrams.review.aiGenerating") : "✦ " + t("diagrams.versions.generate")}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy !== null}
                  className="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-parchment-300 hover:border-kleeblue/50 hover:text-kleeblue disabled:opacity-50"
                >
                  {busy === "upload" ? t("diagrams.versions.uploading") : "⬆ " + t("diagrams.versions.upload")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
                {err && <span className="text-xs text-rust">{err}</span>}
              </div>
              <p className="text-[0.62rem] leading-snug text-parchment-500">
                {t("diagrams.versions.hint")}
              </p>
            </>
          ) : null}

          {/* gallery */}
          {items.length === 0 ? (
            <p className="text-xs text-parchment-500">{t("diagrams.versions.empty")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((it) => (
                <li key={it.id} className="rounded-md border border-ink-700/60 bg-ink-950/60 p-1.5">
                  <button onClick={() => onView({ src: it.url, caption: `${diagram.article_ref} · ${it.kind === "ai" ? "AI" : t("diagrams.versions.upload")}` })} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt={it.kind} className="h-20 w-full rounded bg-white object-contain" />
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className={`chip text-[0.55rem] ${it.kind === "ai" ? "border-amber/40 text-amber" : "border-kleeblue/40 text-kleeblue"}`}>
                      {it.kind === "ai" ? "AI" : t("diagrams.versions.upload")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => downloadImage(it.url, `${diagram.article_ref}-${it.kind}-${it.id}`)}
                        className="text-[0.7rem] text-parchment-400 hover:text-ochre"
                        title={t("diagrams.versions.download")}
                      >
                        ⬇
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => remove(it.id)}
                          className="text-[0.62rem] text-parchment-500 hover:text-rust"
                          title={t("diagrams.versions.delete")}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {it.model && (
                    <p className="mt-0.5 text-[0.55rem] text-parchment-500">{it.model}</p>
                  )}
                  {it.prompt && (
                    <p className="mt-0.5 line-clamp-2 text-[0.58rem] leading-snug text-parchment-500" title={it.prompt}>
                      {it.prompt}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
