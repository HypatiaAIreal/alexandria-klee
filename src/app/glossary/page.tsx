import { getGlossary } from "@/lib/data";
import GlossaryClient from "@/components/GlossaryClient";

export const metadata = { title: "Glossary" };

export default async function GlossaryPage() {
  const glossary = await getGlossary();
  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">Klee&rsquo;s vocabulary · trilingual lexicon</p>
        <h1 className="font-display text-4xl text-parchment-50">Glossary</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">
          Every term Klee leans on, with frequency across the corpus and the passages where it
          appears. <span className="text-ochre">Core concepts</span> come from a seed dictionary;{" "}
          <span className="text-teal">discovered</span> terms surfaced through frequency analysis.
        </p>
      </header>
      <GlossaryClient glossary={glossary} />
    </div>
  );
}
