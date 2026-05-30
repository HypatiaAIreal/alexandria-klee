import { notFound } from "next/navigation";
import { getChapter, getChapters, getPagesByChapter } from "@/lib/data";
import ChapterView from "@/components/ChapterView";

export async function generateStaticParams() {
  const chapters = await getChapters();
  return chapters.filter((c) => c.extracted).map((c) => ({ chapter: c.id }));
}

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
