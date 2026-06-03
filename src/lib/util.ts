// Shared id helpers. `slug` and `chapterIdOf` MUST stay in sync with
// scripts/build-seed.mjs so ids resolve against the seed dataset.

export function slug(s: string): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[.\s/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function chapterIdOf(section: string, part: string | null, num: number): string {
  return slug(`${section}-${part ?? ""}-${num}`);
}

// Reflow extracted/OCR'd book text into readable paragraphs.
// • Verse (mostly short lines, e.g. the poems) keeps its line breaks.
// • Prose joins broken lines into paragraphs, de-hyphenating line ends and
//   starting a new paragraph after sentence-final punctuation.
export function formatBookText(text: string): { verse: boolean; paragraphs: string[] } {
  if (!text) return { verse: false, paragraphs: [] };
  const t = text.replace(/\r/g, "");
  const lines = t.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length === 0) return { verse: false, paragraphs: [] };

  const shortFrac = nonEmpty.filter((l) => l.length < 48).length / nonEmpty.length;
  const verse = shortFrac > 0.72 && nonEmpty.length > 4;

  if (verse) {
    // keep line breaks; split stanzas on blank lines
    return {
      verse: true,
      paragraphs: t.split(/\n\s*\n/).map((b) => b.replace(/\n{2,}/g, "\n").trim()).filter(Boolean),
    };
  }

  const paras: string[] = [];
  let cur = "";
  const endsSentence = (s: string) => /[.!?:”"»]$/.test(s);
  const startsNew = (s: string) => /^[A-ZÄÖÜ0-9"“«¿¡(]/.test(s);
  for (const line of lines) {
    if (!line) {
      if (cur) {
        paras.push(cur);
        cur = "";
      }
      continue;
    }
    if (!cur) {
      cur = line;
    } else if (endsSentence(cur) && startsNew(line) && cur.length > 40) {
      paras.push(cur);
      cur = line;
    } else if (cur.endsWith("-")) {
      cur = cur.slice(0, -1) + line; // de-hyphenate
    } else {
      cur = cur + " " + line;
    }
  }
  if (cur) paras.push(cur);
  return { verse: false, paragraphs: paras.map((p) => p.replace(/[ \t]{2,}/g, " ").trim()) };
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
