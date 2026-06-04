import { getChapterPageCounts, getChapters } from "@/lib/data";
import BrowseView, { type BrowseChapter } from "@/components/BrowseView";

export const metadata = { title: "Browse the archive" };
export const revalidate = 600;

export default async function BrowsePage() {
  const [chapters, counts] = await Promise.all([getChapters(), getChapterPageCounts()]);

  const withCounts: BrowseChapter[] = chapters.map((c) => ({
    ...c,
    pageCount: counts[c.id] ?? 0,
  }));

  return <BrowseView chapters={withCounts} />;
}
