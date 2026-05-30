import { getConceptGraph } from "@/lib/data";
import ConceptMap from "@/components/ConceptMap";

export const metadata = { title: "Concept map" };

export default async function ConceptsPage() {
  const graph = await getConceptGraph();
  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">Co-occurrence network</p>
        <h1 className="font-display text-4xl text-parchment-50">Concept map</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">
          Which of Klee&rsquo;s terms think alongside one another. Two concepts are linked when they
          appear in the same article; the more often, the stronger the bond.
        </p>
      </header>
      <ConceptMap graph={graph} />
    </div>
  );
}
