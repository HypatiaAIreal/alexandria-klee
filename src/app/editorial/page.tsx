import { getEditorialChapters } from "@/lib/data";
import EditorialIndexView from "@/components/EditorialIndexView";

export const metadata = { title: "Editorial" };
export const dynamic = "force-dynamic"; // depends on live annotations

export default async function EditorialPage() {
  const chapters = await getEditorialChapters();
  return <EditorialIndexView chapters={chapters} />;
}
