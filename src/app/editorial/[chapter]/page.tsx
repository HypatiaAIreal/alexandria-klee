import { notFound } from "next/navigation";
import { getEditorialChapter } from "@/lib/data";
import EditorialChapterView from "@/components/EditorialChapterView";

export const dynamic = "force-dynamic"; // depends on live annotations

export default async function EditorialChapterPage({ params }: { params: { chapter: string } }) {
  const chapter = await getEditorialChapter(params.chapter);
  if (!chapter) notFound();
  return <EditorialChapterView chapter={chapter} />;
}
