import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBook, getBooks } from "@/lib/data";
import BookReaderView from "@/components/BookReaderView";

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((b) => ({ id: b.id }));
}

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
