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
