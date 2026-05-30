"use client";

import { useMemo, useState } from "react";
import type { ConceptGraph } from "@/lib/types";
import { domainColor } from "@/lib/labels";
import { useI18n } from "@/components/LanguageProvider";

const W = 760;
const H = 560;

interface Pos {
  x: number;
  y: number;
}

// Deterministic force-directed layout (small graph, runs once in useMemo).
function layout(graph: ConceptGraph): Pos[] {
  const n = graph.nodes.length;
  if (n === 0) return [];
  const idx = new Map(graph.nodes.map((node, i) => [node.term, i]));
  const cx = W / 2;
  const cy = H / 2;

  // Initial positions on a circle (deterministic).
  const pos: Pos[] = graph.nodes.map((_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 200, y: cy + Math.sin(a) * 200 };
  });

  const edges = graph.edges
    .map((e) => ({ s: idx.get(e.source)!, t: idx.get(e.target)!, w: e.weight }))
    .filter((e) => e.s != null && e.t != null);

  const K_REP = 9000; // repulsion
  const L = 130; // ideal spring length
  const K_SPRING = 0.02;
  const CENTER = 0.012;

  for (let iter = 0; iter < 400; iter++) {
    const disp: Pos[] = pos.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = K_REP / d2;
        const d = Math.sqrt(d2);
        const ux = dx / d;
        const uy = dy / d;
        disp[i].x += ux * f;
        disp[i].y += uy * f;
        disp[j].x -= ux * f;
        disp[j].y -= uy * f;
      }
    }

    for (const e of edges) {
      const dx = pos[e.t].x - pos[e.s].x;
      const dy = pos[e.t].y - pos[e.s].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = K_SPRING * (d - L) * Math.min(e.w, 3);
      const ux = dx / d;
      const uy = dy / d;
      disp[e.s].x += ux * force;
      disp[e.s].y += uy * force;
      disp[e.t].x -= ux * force;
      disp[e.t].y -= uy * force;
    }

    const damping = 1 - iter / 600;
    for (let i = 0; i < n; i++) {
      disp[i].x += (cx - pos[i].x) * CENTER;
      disp[i].y += (cy - pos[i].y) * CENTER;
      const mag = Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2) || 0.01;
      const max = 18 * damping;
      const s = Math.min(mag, max) / mag;
      pos[i].x += disp[i].x * s;
      pos[i].y += disp[i].y * s;
    }
  }

  // Fit into viewport with padding.
  const pad = 48;
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (W - pad * 2) / (maxX - minX || 1);
  const sy = (H - pad * 2) / (maxY - minY || 1);
  const s = Math.min(sx, sy);
  return pos.map((p) => ({
    x: pad + (p.x - minX) * s,
    y: pad + (p.y - minY) * s,
  }));
}

export default function ConceptMap({ graph }: { graph: ConceptGraph }) {
  const { t } = useI18n();
  const pos = useMemo(() => layout(graph), [graph]);
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const idx = useMemo(() => new Map(graph.nodes.map((nd, i) => [nd.term, i])), [graph.nodes]);
  const maxFreq = Math.max(1, ...graph.nodes.map((nd) => nd.frequency));
  const radius = (f: number) => 8 + (f / maxFreq) * 20;

  const current = active ?? pinned;

  // Neighbours of the current node
  const neighbours = useMemo(() => {
    if (!current) return new Set<string>();
    const s = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === current) s.add(e.target);
      if (e.target === current) s.add(e.source);
    }
    return s;
  }, [current, graph.edges]);

  const currentNode = graph.nodes.find((nd) => nd.term === current);
  const currentEdges = graph.edges
    .filter((e) => e.source === current || e.target === current)
    .map((e) => ({ other: e.source === current ? e.target : e.source, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight);

  const isDim = (term: string) => current != null && term !== current && !neighbours.has(term);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">{t("concepts.kicker")}</p>
        <h1 className="font-display text-4xl text-parchment-50">{t("concepts.title")}</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">{t("concepts.intro")}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="panel overflow-hidden p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Concept co-occurrence map">
          {/* edges */}
          {graph.edges.map((e, i) => {
            const a = pos[idx.get(e.source)!];
            const b = pos[idx.get(e.target)!];
            if (!a || !b) return null;
            const activeEdge = current && (e.source === current || e.target === current);
            const dim = current && !activeEdge;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={activeEdge ? "#d8a657" : "#5a4c3a"}
                strokeWidth={Math.min(e.weight, 4) * (activeEdge ? 1.2 : 0.8)}
                strokeOpacity={dim ? 0.06 : activeEdge ? 0.7 : 0.28}
              />
            );
          })}

          {/* nodes */}
          {graph.nodes.map((nd) => {
            const p = pos[idx.get(nd.term)!];
            if (!p) return null;
            const r = radius(nd.frequency);
            const dim = isDim(nd.term);
            const isCurrent = nd.term === current;
            const c = domainColor(nd.domain);
            return (
              <g
                key={nd.term}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.25 : 1}
                onMouseEnter={() => setActive(nd.term)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setPinned((prev) => (prev === nd.term ? null : nd.term))}
              >
                <circle
                  r={r}
                  fill={c}
                  fillOpacity={isCurrent ? 0.95 : 0.7}
                  stroke={isCurrent ? "#f7f1e4" : c}
                  strokeWidth={isCurrent ? 2 : 1}
                />
                <text
                  y={-r - 6}
                  textAnchor="middle"
                  className="pointer-events-none select-none font-serif"
                  fill={dim ? "#6b6051" : "#efe6d4"}
                  fontSize={12 + (r - 8) * 0.25}
                >
                  {nd.term}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail / legend panel */}
      <div className="space-y-4">
        <div className="panel p-5">
          {currentNode ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: domainColor(currentNode.domain) }}
                />
                <h3 className="font-display text-2xl text-parchment-50">{currentNode.term}</h3>
              </div>
              {currentNode.term_en && (
                <p className="mt-1 text-sm text-parchment-300">{currentNode.term_en}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">{t(`domains.${currentNode.domain}`)}</span>
                <span className="chip text-ochre">{t("concepts.inCorpus", { count: currentNode.frequency })}</span>
              </div>
              <div className="mt-4 border-t border-ink-700/60 pt-3">
                <p className="label mb-2">{t("concepts.appearsTogether")}</p>
                {currentEdges.length ? (
                  <ul className="space-y-1.5">
                    {currentEdges.map((e) => (
                      <li key={e.other} className="flex items-center justify-between text-sm">
                        <button
                          onClick={() => setPinned(e.other)}
                          className="text-parchment-200 hover:text-ochre"
                        >
                          {e.other}
                        </button>
                        <span className="font-mono text-xs text-parchment-400">
                          {t("concepts.sharedArticles", { count: e.weight })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-parchment-400">{t("concepts.noCo")}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl text-parchment-50">{t("concepts.howTitle")}</h3>
              <p className="mt-2 text-sm text-parchment-300">{t("concepts.howBody")}</p>
              <p className="mt-2 text-sm text-parchment-400">{t("concepts.howHint")}</p>
            </>
          )}
        </div>

        <div className="panel p-5">
          <p className="label mb-3">{t("concepts.domainsTitle")}</p>
          <ul className="grid grid-cols-2 gap-1.5 text-sm text-parchment-300">
            {[...new Set(graph.nodes.map((n) => n.domain))].map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: domainColor(d) }} />
                {t(`domains.${d}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}
