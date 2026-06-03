import { getDiagramChapters } from "@/lib/data";
import DiagramsView from "@/components/DiagramsView";

export const metadata = { title: "Diagrams" };

export default async function DiagramsPage() {
  const chapters = await getDiagramChapters();
  return <DiagramsView chapters={chapters} />;
}
