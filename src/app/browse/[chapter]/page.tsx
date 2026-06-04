import { notFound } from "next/navigation";
import { getChapter, getPagesByChapter } from "@/lib/data";
import ChapterView from "@/components/ChapterView";

// Render on demand (data lives in Mongo) so the build never depends on the
// database and pages always reflect the latest content.
export const revalidate = 600;

export async function generateMetadata({ params }: { params: { chapter: string } }) {
  const c = await getChapter(params.chapter);
  return { title: c ? `${c.name_de} — ${c.name_en}` : "Chapter" };
}

export default async function ChapterPage({ params }: { params: { chapter: string } }) {
  const chapter = await getChapter(params.chapter);
  if (!chapter) notFound();
  const pages = await getPagesByChapter(params.chapter);
  return <ChapterView chapter={chapter} pages={pages} />;
}
