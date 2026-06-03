import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/data";
import BookReaderView from "@/components/BookReaderView";

// Render on demand so the build never depends on the database.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const book = await getBook(params.id);
  return { title: book ? `${book.title} — ${book.author}` : "Book" };
}

export default async function BookPage({ params }: { params: { id: string } }) {
  const book = await getBook(params.id);
  if (!book) notFound();
  return (
    <Suspense>
      <BookReaderView book={book} />
    </Suspense>
  );
}
