import { getFilterOptions } from "@/lib/data";
import SearchClient from "@/components/SearchClient";

export const metadata = { title: "Search" };
export const revalidate = 600;

export default async function SearchPage() {
  const options = await getFilterOptions();
  return <SearchClient options={options} />;
}
