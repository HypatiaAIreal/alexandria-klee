"use client";

import { useRef, useState } from "react";
import type { Page } from "@/lib/types";
import { chapterIdOf } from "@/lib/util";
import { useI18n } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";

type Captured = { id: string; image_url: string };

/**
 * Manual graphic capture: when the automatic extraction missed a drawing on a
 * page, crop it from the facsimile with Win+Shift+S (→ clipboard), then paste
 * (Ctrl+V) or drop it here. It's stored and appears in Diagrams for this page.
 */
export default function DiagramCapture({ page }: { page: Page }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const upload = async (file: Blob) => {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file, "capture.png");
      fd.append("page_id", page.id);
      fd.append("page_ref", page.page_ref);
      fd.append("chapter_id", chapterIdOf(page.section, page.part, page.chapter_number));
      fd.append("section", page.section ?? "");
      fd.append("part", page.part ?? "");
      fd.append("chapter_number", String(page.chapter_number ?? ""));
      fd.append("chapter_name_de", page.chapter_name_de ?? "");
      fd.append("facsimile", page.facsimile_local ?? "");
      const r = await fetch("/api/diagrams/capture", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.diagram) {
        setCaptured((prev) => [{ id: j.diagram.id, image_url: j.diagram.image_url }, ...prev]);
      } else {
        setErr(j.error === "too_large" ? t("capture.tooLarge") : t("capture.error"));
      }
    } catch {
      setErr(t("capture.error"));
    } finally {
      setBusy(false);
    }
  };

  const fromClipboard = (items: DataTransferItemList | undefined) => {
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          upload(f);
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-parchment-300 hover:border-ochre/50 hover:text-ochre"
      >
        ✂ {t("capture.title")}
        {captured.length > 0 && <span className="ml-1 text-parchment-400">({captured.length})</span>}
        <span className="ml-1">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-ink-700/70 bg-ink-900/70 p-3">
          <p className="text-[0.66rem] leading-snug text-parchment-400">{t("capture.hint")}</p>
          <div
            tabIndex={0}
            onPaste={(e) => {
              if (fromClipboard(e.clipboardData?.items)) e.preventDefault();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer?.files?.[0];
              if (f) upload(f);
            }}
            className="grid min-h-[88px] cursor-text place-items-center rounded-md border border-dashed border-ink-600 bg-ink-950 px-3 py-4 text-center text-xs text-parchment-400 outline-none focus:border-ochre/60 focus:text-ochre"
          >
            {busy ? t("capture.saving") : t("capture.pasteHere")}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-parchment-300 hover:border-kleeblue/50 hover:text-kleeblue disabled:opacity-50"
            >
              ⬆ {t("capture.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            {err && <span className="text-xs text-rust">{err}</span>}
          </div>

          {captured.length > 0 && (
            <div>
              <p className="text-[0.62rem] text-teal">✓ {t("capture.saved")}</p>
              <ul className="mt-1.5 grid grid-cols-3 gap-2">
                {captured.map((c) => (
                  <li key={c.id} className="rounded-md border border-ink-700/60 bg-ink-950/60 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image_url} alt="capture" className="h-16 w-full rounded bg-white object-contain" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
