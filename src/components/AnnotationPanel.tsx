"use client";

import { useEffect, useState } from "react";

interface Annotation {
  tags: string[];
  note: string;
}

const KEY = (id: string) => `klee:annotation:${id}`;

export default function AnnotationPanel({ articleId }: { articleId: string }) {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [synced, setSynced] = useState<"local" | "cloud">("local");

  // Load from localStorage, then try the API (Atlas) and merge.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(articleId));
      if (raw) {
        const a: Annotation = JSON.parse(raw);
        setTags(a.tags ?? []);
        setNote(a.note ?? "");
      }
    } catch {}
    fetch(`/api/annotations?articleId=${encodeURIComponent(articleId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.persisted) {
          setSynced("cloud");
          const a = d.annotations?.[0];
          if (a) {
            setTags((prev) => [...new Set([...(a.tags ?? []), ...prev])]);
            if (a.note && !note) setNote(a.note);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const persist = (nextTags: string[], nextNote: string) => {
    try {
      localStorage.setItem(KEY(articleId), JSON.stringify({ tags: nextTags, note: nextNote }));
    } catch {}
    fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article_id: articleId, tags: nextTags, note: nextNote }),
    }).catch(() => {});
  };

  const addTag = (t: string) => {
    const v = t.trim().replace(/^#/, "");
    if (!v || tags.includes(v)) return;
    const next = [...tags, v];
    setTags(next);
    persist(next, note);
    setInput("");
  };
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    persist(next, note);
  };
  const saveNote = (v: string) => {
    setNote(v);
    persist(tags, v);
  };

  return (
    <div className="mt-4 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="label">
          My annotations {tags.length > 0 && <span className="text-ochre">· {tags.length}</span>}
        </span>
        <span className="text-parchment-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full border border-ochre/40 bg-ochre/10 px-2.5 py-0.5 font-mono text-[0.66rem] text-ochre"
              >
                #{t}
                <button onClick={() => removeTag(t)} className="text-ochre/70 hover:text-rust">
                  ✕
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-parchment-400">No tags yet — add your own below.</span>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTag(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="add a semantic tag…"
              className="flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-100 outline-none placeholder:text-parchment-400/60 focus:border-ochre/50"
            />
            <button
              type="submit"
              className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-200 hover:border-ochre/50 hover:text-ochre"
            >
              Add
            </button>
          </form>

          <textarea
            value={note}
            onChange={(e) => saveNote(e.target.value)}
            placeholder="a private note on this passage…"
            rows={2}
            className="w-full resize-y rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-parchment-100 outline-none placeholder:text-parchment-400/60 focus:border-ochre/50"
          />

          <p className="font-mono text-[0.62rem] text-parchment-400/70">
            {synced === "cloud" ? "● synced to MongoDB Atlas" : "● saved in this browser"}
          </p>
        </div>
      )}
    </div>
  );
}
