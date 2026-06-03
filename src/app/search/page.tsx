import { getFilterOptions } from "@/lib/data";
import SearchClient from "@/components/SearchClient";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const options = await getFilterOptions();
  return <SearchClient options={options} />;
}
