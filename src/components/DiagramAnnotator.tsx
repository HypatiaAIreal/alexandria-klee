"use client";

import { useState } from "react";
import type { Diagram, DiagramAnnotation } from "@/lib/types";
import { useI18n } from "@/components/LanguageProvider";

/**
 * Per-image annotation: a free-text note plus two memorized taxonomies
 * (categories & themes). Existing values across the corpus are offered as a
 * growing dropdown — pick one or type a new one. Everything is tied to the
 * single image_url and persisted in the diagram_annotations collection.
 */
export default function DiagramAnnotator({
  diagram,
  annotation,
  canEdit,
  onSaved,
}: {
  diagram: Diagram;
  annotation?: DiagramAnnotation;
  canEdit: boolean;
  onSaved: (a: DiagramAnnotation) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState(annotation?.note ?? "");
  const [categories, setCategories] = useState<string[]>(annotation?.categories ?? []);
  const [themes, setThemes] = useState<string[]>(annotation?.themes ?? []);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allThemes, setAllThemes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const count = (annotation?.categories?.length ?? 0) + (annotation?.themes?.length ?? 0);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoaded(true);
      // seed editable state from the latest annotation
      setNote(annotation?.note ?? "");
      setCategories(annotation?.categories ?? []);
      setThemes(annotation?.themes ?? []);
      try {
        const r = await fetch("/api/diagrams/taxonomy");
        const j = await r.json();
        setAllCategories(j.categories ?? []);
        setAllThemes(j.themes ?? []);
      } catch {
        /* offline: dropdowns just stay empty */
      }
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/diagrams/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: diagram.image_url,
          page_ref: diagram.page_ref,
          page_id: diagram.page_id,
          article_number: diagram.article_number,
          note: note.trim(),
          categories,
          themes,
        }),
      });
      const j = await r.json();
      if (r.ok && j.annotation) {
        onSaved(j.annotation);
        // grow the dropdown memory
        setAllCategories((prev) => Array.from(new Set([...prev, ...categories])).sort((a, b) => a.localeCompare(b)));
        setAllThemes((prev) => Array.from(new Set([...prev, ...themes])).sort((a, b) => a.localeCompare(b)));
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1.5">
      <button
        onClick={toggle}
        className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-300 hover:border-teal/50 hover:text-teal"
      >
        ✎ {t("diagrams.notes.manage")}
        {count > 0 && <span className="ml-1 text-parchment-400">({count})</span>}
        <span className="ml-1">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-ink-700/70 bg-ink-900/70 p-3">
          <div>
            <p className="label mb-1 text-[0.6rem]">{t("diagrams.notes.note")}</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!canEdit}
              placeholder={t("diagrams.notes.notePlaceholder")}
              rows={2}
              className="w-full resize-y rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-parchment-100 placeholder:text-parchment-500 focus:border-teal/50 focus:outline-none disabled:opacity-60"
            />
          </div>

          <TagPicker
            label={t("diagrams.notes.categories")}
            placeholder={t("diagrams.notes.addCategory")}
            value={categories}
            options={allCategories}
            canEdit={canEdit}
            onChange={setCategories}
            accent="ochre"
          />
          <TagPicker
            label={t("diagrams.notes.themes")}
            placeholder={t("diagrams.notes.addTheme")}
            value={themes}
            options={allThemes}
            canEdit={canEdit}
            onChange={setThemes}
            accent="kleeblue"
          />

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md border border-teal/50 px-2.5 py-1 text-xs text-teal hover:bg-teal/10 disabled:opacity-50"
              >
                {saving ? t("diagrams.notes.saving") : t("diagrams.notes.save")}
              </button>
              {savedFlash && <span className="text-xs text-teal">{t("diagrams.review.saved")}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TagPicker({
  label,
  placeholder,
  value,
  options,
  canEdit,
  onChange,
  accent,
}: {
  label: string;
  placeholder: string;
  value: string[];
  options: string[];
  canEdit: boolean;
  onChange: (v: string[]) => void;
  accent: "ochre" | "kleeblue";
}) {
  const [input, setInput] = useState("");
  const listId = `dl-${label.replace(/\W+/g, "")}-${accent}`;
  const border = accent === "ochre" ? "border-ochre/40 text-ochre" : "border-kleeblue/40 text-kleeblue";

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setInput("");
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));
  // Suggestions not already chosen.
  const suggestions = options.filter((o) => !value.includes(o));

  return (
    <div>
      <p className="label mb-1 text-[0.6rem]">{label}</p>
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className={`chip flex items-center gap-1 text-[0.6rem] ${border}`}>
              {v}
              {canEdit && (
                <button onClick={() => remove(v)} className="opacity-70 hover:opacity-100" aria-label="remove">
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="flex gap-1.5">
          <input
            list={listId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(input);
              }
            }}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-parchment-100 placeholder:text-parchment-500 focus:border-ochre/50 focus:outline-none"
          />
          <datalist id={listId}>
            {suggestions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <button
            onClick={() => add(input)}
            className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-300 hover:border-ochre/50 hover:text-ochre"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
