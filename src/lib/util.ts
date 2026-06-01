// Shared id helpers. `slug` and `chapterIdOf` MUST stay in sync with
// scripts/build-seed.mjs so ids resolve against the seed dataset.

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.\s/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function chapterIdOf(section: string, part: string | null, num: number): string {
  return slug(`${section}-${part ?? ""}-${num}`);
}

// Deterministic thousands grouping (e.g. 1162 → "1,162"). Unlike
// Number.prototype.toLocaleString(), this produces the SAME output on the
// server (Node) and the client (browser), so it can't trigger a React
// hydration mismatch.
export function formatNum(n: number): string {
  const neg = n < 0 ? "-" : "";
  const [intPart, fracPart] = Math.abs(n).toString().split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg + grouped + (fracPart ? "." + fracPart : "");
}
