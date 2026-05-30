import Link from "next/link";
import { notFound } from "next/navigation";
import { getChapter, getChapters, getPagesByChapter } from "@/lib/data";

export async function generateStaticParams() {
  const chapters = await getChapters();
  return chapters.filter((c) => c.extracted).map((c) => ({ chapter: c.id }));
}

export async function generateMetadata({ params }: { params: { chapter: string } }) {
  const c = await getChapter(params.chapter);
  return { title: c ? `${c.name_de} — ${c.name_en}` : "Chapter" };
}

export default async function ChapterPage({ params }: { params: { chapter: string } }) {
  const chapter = await getChapter(params.chapter);
  if (!chapter) notFound();
  const pages = await getPagesByChapter(params.chapter);

  return (
    <div className="space-y-8">
      <nav className="pt-4 text-sm text-parchment-400">
        <Link href="/browse" className="link-underline hover:text-ochre">
          Browse
        </Link>
        <span className="mx-2">/</span>
        <span className="text-parchment-200">
          {chapter.section}
          {chapter.part ? ` ${chapter.part}.${chapter.chapter_number}` : ""}
        </span>
      </nav>

      <header className="animate-fade-up">
        <p className="label mb-2">
          {chapter.section}
          {chapter.part ? ` · Part ${chapter.part} · Chapter ${chapter.chapter_number}` : ""}
        </p>
        <h1 className="font-display text-4xl text-parchment-50">{chapter.name_de}</h1>
        <p className="mt-2 text-lg text-parchment-300">
          {chapter.name_en} · <span className="italic">{chapter.name_es}</span>
        </p>
        <p className="mt-4 font-mono text-xs text-parchment-400">
          {pages.length} page{pages.length === 1 ? "" : "s"} ·{" "}
          {pages.reduce((n, p) => n + p.total_articles, 0)} articles
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const concepts = [
            ...new Set(page.articles.flatMap((a) => a.metadata.concepts_de)),
          ].slice(0, 6);
          return (
            <Link key={page.id} href={`/page/${page.id}`} className="panel panel-hover group overflow-hidden">
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-900">
                {page.facsimile_local ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.facsimile_local}
                    alt={`Facsimile of ${page.page_ref}`}
                    className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-parchment-400">no facsimile</div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent p-3">
                  <span className="font-mono text-xs text-ochre">{page.page_ref}</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-parchment-300">
                  {page.total_articles} article{page.total_articles === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {concepts.map((c) => (
                    <span key={c} className="chip text-parchment-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
