import { getBooks } from "@/lib/data";
import LibraryView, { type BookMeta } from "@/components/LibraryView";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const books = await getBooks();
  const meta: BookMeta[] = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    year: b.year,
    language: b.language,
    total_pages: b.total_pages,
    total_sections: b.total_sections,
    needs_ocr: b.needs_ocr,
    cover: b.cover,
  }));
  return <LibraryView books={meta} />;
}
