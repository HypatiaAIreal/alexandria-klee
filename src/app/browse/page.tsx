import { getChapters, getPages } from "@/lib/data";
import BrowseView, { type BrowseChapter } from "@/components/BrowseView";

export const metadata = { title: "Browse the archive" };

export default async function BrowsePage() {
  const [chapters, pages] = await Promise.all([getChapters(), getPages()]);

  const withCounts: BrowseChapter[] = chapters.map((c) => ({
    ...c,
    pageCount: pages.filter(
      (p) =>
        p.section === c.section &&
        (p.part ?? "") === (c.part ?? "") &&
        p.chapter_number === c.chapter_number
    ).length,
  }));

  return <BrowseView chapters={withCounts} />;
}
