import { NextRequest, NextResponse } from "next/server";
import { getPage } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns one page's articles with their text in DE/EN/ES, so the diagram
// review modal can show full page context without navigating away.
export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("page_id");
  if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 });
  const page = await getPage(pageId);
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const articles = (page.articles ?? []).map((a) => ({
    ref: a.ref || `${page.page_ref} art.${a.article_number}`,
    article_number: a.article_number,
    paragraphs_de: a.paragraphs_de?.length ? a.paragraphs_de : a.text_de ? [a.text_de] : [],
    paragraphs_en: a.paragraphs_en?.length ? a.paragraphs_en : a.text_en ? [a.text_en] : [],
    paragraphs_es: a.paragraphs_es?.length ? a.paragraphs_es : a.text_es ? [a.text_es] : [],
    footnotes_de: a.footnotes_de ?? [],
  }));

  return NextResponse.json({
    page_ref: page.page_ref,
    chapter_name_de: page.chapter_name_de ?? "",
    articles,
  });
}
