import { getConceptGraph } from "@/lib/data";
import ConceptMap from "@/components/ConceptMap";

export const metadata = { title: "Concept map" };

export default async function ConceptsPage() {
  const graph = await getConceptGraph();
  return <ConceptMap graph={graph} />;
}
