// ─────────────────────────────────────────────────────────────
//  Image source resolution.
//
//  Manuscript images (/manuscripts/...) are NOT committed to the repo
//  (thousands of facsimiles + drawings). Locally they are served from
//  /public/manuscripts. In production they live on Cloudflare R2.
//
//  Set R2_PUBLIC_URL (e.g. https://pub-xxxx.r2.dev) and every
//  "/manuscripts/<path>" becomes "${R2_PUBLIC_URL}/<path>".
//  When R2_PUBLIC_URL is unset, paths are left untouched (local files).
//
//  This runs in the data layer (server side), so the rewritten, plain
//  string is what reaches the client components — no NEXT_PUBLIC_ needed.
// ─────────────────────────────────────────────────────────────
import type { Article, Page, SeedData } from "./types";

const LOCAL_PREFIX = "/manuscripts";

export function imageBase(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
}

/** Rewrite a single "/manuscripts/..." path to the R2 URL when configured. */
export function resolveImageSrc(path: string | undefined | null): string {
  if (!path) return path ?? "";
  const base = imageBase();
  if (base && path.startsWith(LOCAL_PREFIX + "/")) {
    return base + path.slice(LOCAL_PREFIX.length); // "/manuscripts/BG/..." → base + "/BG/..."
  }
  return path;
}

function rewriteArticleImages(a: Article): void {
  if (a.images) {
    for (const img of a.images) img.url_local = resolveImageSrc(img.url_local);
  }
}

/**
 * Rewrite every manuscript image path in a dataset in place.
 * Idempotent (already-rewritten https paths don't start with /manuscripts).
 */
export function applyImageBase(data: SeedData): SeedData {
  if (!imageBase()) return data; // no-op locally
  for (const p of data.pages ?? []) {
    p.facsimile_local = resolveImageSrc(p.facsimile_local);
    (p.articles ?? []).forEach(rewriteArticleImages);
  }
  // The top-level articles array may hold separate object instances.
  (data.articles ?? []).forEach((a: Page["articles"][number]) => rewriteArticleImages(a));
  return data;
}
