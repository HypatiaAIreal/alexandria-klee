import { getFilterOptions } from "@/lib/data";
import SearchClient from "@/components/SearchClient";

export const metadata = { title: "Search" };

export default async function SearchPage() {
  const options = await getFilterOptions();
  return (
    <div className="space-y-6">
      <header className="animate-fade-up pt-4">
        <p className="label mb-3">Full-text · trilingual</p>
        <h1 className="font-display text-4xl text-parchment-50">Search the manuscripts</h1>
        <p className="mt-3 max-w-2xl text-parchment-300">
          Search across the German originals and the English &amp; Spanish translations at once.
          Try <em>Gliederung</em>, <em>energy</em>, or <em>hoja</em>.
        </p>
      </header>
      <SearchClient options={options} />
    </div>
  );
}
