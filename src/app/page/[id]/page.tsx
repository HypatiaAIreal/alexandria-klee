import Link from "next/link";
import { notFound } from "next/navigation";
import { getChapter, getPage, getPages, getPagesByChapter } from "@/lib/data";
import { chapterIdOf } from "@/lib/util";
import PageReader from "@/components/PageReader";

export async function generateStaticParams() {
  const pages = await getPages();
  return pages.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const page = await getPage(params.id);
  return { title: page ? `${page.page_ref} · ${page.chapter_name_de}` : "Page" };
}

export default async function PageDetail({ params }: { params: { id: string } }) {
  const page = await getPage(params.id);
  if (!page) notFound();

  const chapterId = chapterIdOf(page.section, page.part, page.chapter_number);
  const [chapter, siblings] = await Promise.all([
    getChapter(chapterId),
    getPagesByChapter(chapterId),
  ]);

  const idx = siblings.findIndex((p) => p.id === page.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <div className="space-y-6">
      <nav className="pt-4 text-sm text-parchment-400">
        <Link href="/browse" className="link-underline hover:text-ochre">
          Browse
        </Link>
        <span className="mx-2">/</span>
        {chapter && (
          <>
            <Link href={`/browse/${chapter.id}`} className="link-underline hover:text-ochre">
              {chapter.name_de}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-parchment-200">{page.page_ref}</span>
      </nav>

      <header className="animate-fade-up">
        <p className="label mb-2">{page.chapter_name_de}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-4xl text-parchment-50">
            Page <span className="text-ochre">{page.page_number}</span>
          </h1>
          <span className="font-mono text-sm text-parchment-400">{page.page_ref}</span>
        </div>
      </header>

      <PageReader page={page} />

      {/* Prev / next */}
      <nav className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-6">
        {prev ? (
          <Link
            href={`/page/${prev.id}`}
            className="panel panel-hover flex-1 p-4 text-left"
          >
            <span className="label">← Previous page</span>
            <div className="mt-1 font-display text-lg text-parchment-100">{prev.page_ref}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/page/${next.id}`}
            className="panel panel-hover flex-1 p-4 text-right"
          >
            <span className="label">Next page →</span>
            <div className="mt-1 font-display text-lg text-parchment-100">{next.page_ref}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </nav>
    </div>
  );
}
