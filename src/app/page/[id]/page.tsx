import { notFound } from "next/navigation";
import { getChapter, getPage, getPagesByChapter } from "@/lib/data";
import { chapterIdOf } from "@/lib/util";
import PageView from "@/components/PageView";

// Render on demand (~4k pages live in Mongo) so the build never pre-collects
// the whole corpus and never depends on the database being up.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const page = await getPage(params.id);
  return { title: page ? `${page.page_ref} · ${page.chapter_name_de}` : "Page" };
}

export default async function PageDetail({ params }: { params: { id: string } }) {
  const page = await getPage(params.id);
  if (!page) notFound();

  const chapterId = chapterIdOf(page.section, page.part, page.chapter_number);
  const [chapter, siblings] = await Promise.all([
    getChapter(chapterId),
    getPagesByChapter(chapterId),
  ]);

  const idx = siblings.findIndex((p) => p.id === page.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <PageView
      page={page}
      chapter={chapter ? { id: chapter.id, name_de: chapter.name_de } : null}
      prev={prev ? { id: prev.id, page_ref: prev.page_ref } : null}
      next={next ? { id: next.id, page_ref: next.page_ref } : null}
    />
  );
}
